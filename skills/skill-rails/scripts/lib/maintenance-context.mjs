import { lstat, readFile, readdir, realpath } from "node:fs/promises";
import { dirname, isAbsolute, join, resolve } from "node:path";
import { analyzeSpecSource, staticValue } from "../runtime/ast-policy.mjs";
import { parseBody } from "../runtime/body.mjs";
import { resolveSpecLocator } from "../runtime/authoring-ledger.mjs";
import { RUNTIME_VERSION, VALIDATOR_VERSION } from "../runtime/constants.mjs";
import { sha256 } from "../runtime/hash.mjs";
import { parse } from "../runtime/vendor/acorn.mjs";
import * as walk from "../runtime/vendor/acorn-walk.mjs";
import { parseSkillMarkdown } from "./frontmatter.mjs";
import { simpleProjectionEntries } from "./generator.mjs";
import { validateIntent } from "./profiles.mjs";

const PREVIEW_SCHEMA = "skill-rails/maintenance-context-preview/1";
const EXCLUDED_ROOTS = new Set([".git", "node_modules"]);
const MAX_TEXT_BYTES = 512 * 1024;
const MAX_EXCERPT_CHARS = 1800;
const MAX_CAPSULE_SUBJECTS = 72;
const MAX_CAPSULE_RELATIONS = 180;
const SPEC_ARRAY_GROUPS = new Set(["GUARDS", "STAGES", "DEFERRED"]);
const SPEC_KEYED_L16_GROUPS = new Set(["OBSERVATIONS", "FORMATS", "TEMPLATES", "ARTIFACTS", "DECLARATIONS", "ROLES"]);
const SPEC_OBJECT_GROUPS = new Set(["OBSERVATIONS", "FORMATS", "TEMPLATES", "ORDERS", "OWNERSHIP", "TABLES", "ARTIFACTS", "ROLES", "DECLARATIONS"]);
const SPEC_SOURCE_KIND_GROUP = {
  "spec-guard": "GUARDS",
  "spec-stage": "STAGES",
  "spec-deferred": "DEFERRED",
  "spec-observations": "OBSERVATIONS",
  "spec-formats": "FORMATS",
  "spec-templates": "TEMPLATES",
  "spec-table": "TABLES",
  "spec-table-row": "TABLES",
  "spec-artifacts": "ARTIFACTS",
  "spec-roles": "ROLES",
  "spec-read-first": "READ_FIRST",
  "spec-declarations": "DECLARATIONS",
  "spec-ownership": "OWNERSHIP"
};
const SPEC_KIND_RELATION_FAMILIES = {
  "spec-guard": ["reads", "unless-reads", "uses-body"],
  "spec-stage": ["reads", "needs-judgment", "uses-body", "selects-table", "records-artifact", "records-format", "uses-artifact", "uses-template", "uses-format", "dispatches-role"],
  "spec-table": ["owns-row"],
  "spec-table-row": ["reads"],
  "spec-observations": ["implemented-by-collector-module"],
  "spec-templates": ["uses-template-file"],
  "spec-artifacts": ["uses-template", "declares-project-path", "writer", "reader"],
  "spec-roles": ["uses-body", "returns-template"],
  "spec-read-first": ["read-first-body", "read-first-file"],
  "spec-declarations": ["declares-consumer"],
  "spec-ownership": ["owns-project-path"]
};
const DECLARED_INCOMING_BY_KIND = {
  "intent-requirement": ["originates-from"],
  "spec-guard": ["targets", "names-evidence", "declares-cover", "writer", "reader"],
  "spec-stage": ["targets", "names-evidence", "declares-cover", "declares-stage-expectation", "writer", "reader"],
  "spec-observations": ["targets", "names-evidence", "reads", "unless-reads", "needs-judgment"],
  "spec-formats": ["targets", "names-evidence", "uses-format", "records-format"],
  "spec-templates": ["targets", "names-evidence", "uses-template", "returns-template"],
  "spec-table": ["targets", "names-evidence", "selects-table"],
  "spec-table-row": ["targets", "names-evidence", "owns-row", "declares-cover"],
  "spec-artifacts": ["targets", "names-evidence", "uses-artifact", "records-artifact"],
  "spec-roles": ["targets", "names-evidence", "dispatches-role"],
  "spec-declarations": ["targets", "names-evidence"],
  "body-section": ["targets", "names-evidence", "uses-body", "read-first-body"]
};

export async function createMaintenanceContext(skillRoot, options = {}) {
  const root = resolve(skillRoot);
  const started = await captureInventory(root, options);
  const entries = started.entries;
  const entryByPath = new Map(entries.map((entry) => [entry.path, entry]));
  const issues = [...started.issues];
  const extraction = {};
  const jsonSpans = new Map();
  const relationSites = [];

  const parseJsonEntry = (local, family) => {
    const entry = entryByPath.get(local);
    if (!entry) {
      extraction[family] ??= { status: "not-present", scope: local, issues: [] };
      return null;
    }
    if (entry.text === null) {
      const message = `${local} is not available as bounded UTF-8 text.`;
      issues.push(issue(local, "unreadable-structured-source", message, "high"));
      extraction[family] = { status: "partial", scope: local, issues: [message] };
      return null;
    }
    try {
      const value = JSON.parse(entry.text);
      const shapeIssues = validateJsonFamily(family, value);
      const spanResult = parseJsonSpans(entry.text);
      if (spanResult.issue) shapeIssues.push(spanResult.issue);
      jsonSpans.set(local, spanResult.spans);
      entry.handling = "parsed";
      extraction[family] = { status: shapeIssues.length ? "partial" : "complete-for-declared-scope", scope: local, issues: shapeIssues };
      for (const message of shapeIssues) issues.push(issue(local, "invalid-structured-shape", message, "high"));
      return value;
    } catch (error) {
      const message = `${local} is invalid JSON: ${error.message}`;
      issues.push(issue(local, "invalid-json", message, "high"));
      extraction[family] = { status: "partial", scope: local, issues: [message] };
      return null;
    }
  };

  const manifest = parseJsonEntry(".generated.json", "manifest");
  const generatedPaths = new Set(recordEntries(manifest?.generated_files).map(([path]) => path));
  generatedPaths.add(".generated.json");
  for (const entry of entries) entry.generated = generatedPaths.has(entry.path) || entry.path.startsWith("scripts/skill-rails/");

  const intent = parseJsonEntry(".skill-rails/intent.json", "intent");
  const profileDecision = parseJsonEntry(".skill-rails/profile-decision.json", "profile-decision");
  const ledger = parseJsonEntry(".skill-rails/obligation-ledger.json", "obligation-ledger");
  const evalCases = parseJsonEntry(".skill-rails/eval-cases.json", "eval-cases");
  const scenarios = parseJsonEntry("fixtures/scenarios.json", "scenario-fixtures");
  const semanticDiff = parseJsonEntry(".skill-rails/semantic-diff.json", "semantic-diff");
  const intentValidationIssues = intent === null ? [] : validateIntent(intent);
  if (intentValidationIssues.length && extraction.intent) {
    extraction.intent.status = "partial";
    extraction.intent.issues.push(...intentValidationIssues);
    for (const message of intentValidationIssues) issues.push(issue(".skill-rails/intent.json", "invalid-intent-shape", message, "high"));
  }

  const declaredProfile = typeof profileDecision?.profile === "string" ? profileDecision.profile : null;
  if (intent && ["p0", "p1"].includes(declaredProfile) && intentValidationIssues.length === 0) {
    for (const [local, expected] of simpleProjectionEntries(intent, declaredProfile)) {
      const entry = entryByPath.get(local);
      const matches = Boolean(entry && entry.text !== null && normalizeNewlines(entry.text) === normalizeNewlines(expected));
      if (entry) entry.projection = { owner: ".skill-rails/intent.json", status: matches ? "matches-current-intent" : "conflict-with-current-intent" };
      if (matches) generatedPaths.add(local);
      else {
        const message = entry ? `${local} differs from its current intent-derived projection.` : `${local} is missing from the current intent-derived projection set.`;
        issues.push(issue(local, "simple-projection-conflict", message, "high"));
        extraction["simple-projections"] ??= { status: "partial", scope: "P0/P1 intent-derived SKILL, adapter, and guidance projections", issues: [] };
        extraction["simple-projections"].issues.push(message);
      }
    }
    extraction["simple-projections"] ??= { status: "complete-for-declared-scope", scope: "P0/P1 intent-derived SKILL, adapter, and guidance projections", issues: [] };
  } else if (intent && ["p0", "p1"].includes(declaredProfile)) {
    extraction["simple-projections"] = {
      status: "partial",
      scope: "P0/P1 intent-derived SKILL, adapter, and guidance projections",
      issues: ["Projection ownership was not rendered because the current intent is invalid; raw files remain navigable but direct-edit permission is unknown."]
    };
  }
  for (const entry of entries) entry.generated = generatedPaths.has(entry.path) || entry.path.startsWith("scripts/skill-rails/");

  const builder = createModelBuilder(entryByPath, generatedPaths);
  for (const entry of entries) builder.addSubject(fileSubject(entry));

  const skillEntry = entryByPath.get("SKILL.md");
  let skillDocument = null;
  if (skillEntry?.text !== null && skillEntry) {
    skillDocument = parseSkillMarkdown(skillEntry.text);
    extraction.skill = {
      status: skillDocument.diagnostics.length === 0 ? "complete-for-declared-scope" : "partial",
      scope: "SKILL.md frontmatter and headings",
      issues: skillDocument.diagnostics.map((item) => item.message)
    };
    for (const diagnostic of skillDocument.diagnostics) issues.push(issue(diagnostic.pointer, diagnostic.code, diagnostic.message, "medium"));
  }

  addIntentSubjects(builder, intent, entryByPath.get(".skill-rails/intent.json"), jsonSpans.get(".skill-rails/intent.json"));
  addLedgerSubjects(builder, ledger, entryByPath.get(".skill-rails/obligation-ledger.json"), jsonSpans.get(".skill-rails/obligation-ledger.json"));
  addArraySubjects(builder, evalCases, entryByPath.get(".skill-rails/eval-cases.json"), "eval", "eval-case", jsonSpans.get(".skill-rails/eval-cases.json"));
  addArraySubjects(builder, scenarios, entryByPath.get("fixtures/scenarios.json"), "fixture", "scenario-fixture", jsonSpans.get("fixtures/scenarios.json"));

  const genericCandidates = entries.filter((item) => shouldExtractGenericSource(item, options.query));
  const genericEntries = genericCandidates.filter((item) => item.text !== null);
  for (const entry of genericEntries.filter((item) => /\.md$/i.test(item.path))) {
    addMarkdownLinks(builder, entry);
  }
  const moduleExtraction = { parsed: 0, partial: [], dynamic: [] };
  for (const entry of genericEntries.filter((item) => /\.(?:mjs|cjs|js|ts|tsx|jsx)$/i.test(item.path))) addLiteralModuleRelations(builder, entry, entryByPath, moduleExtraction);
  extraction.module_literals = {
    status: moduleExtraction.partial.length ? "partial" : "complete-for-declared-scope",
    scope: "literal import/export/require edges in Acorn-parseable authored JavaScript; no call graph or TypeScript/JSX semantics",
    issues: moduleExtraction.partial
  };

  let staticSpec = null;
  let specGroups = {};
  let specAnalysis = null;
  const specEntry = entryByPath.get("spec.mjs");
  if (specEntry?.text !== null && specEntry) {
    specAnalysis = analyzeSpecSource(specEntry.text, "spec.mjs");
    const extracted = extractSpec(builder, specEntry, specAnalysis);
    staticSpec = extracted?.spec ?? null;
    specGroups = extracted?.groups ?? {};
    const specShapeIssues = validateExtractedSpecShapes(staticSpec);
    const specGroupIssues = Object.values(specGroups).flatMap((item) => item.issues ?? []);
    const specIssues = [...specAnalysis.diagnostics.map((item) => `${item.pointer}: ${item.message}`), ...specGroupIssues, ...specShapeIssues];
    extraction.spec = {
      status: specAnalysis.ast && specIssues.length === 0 ? "complete-for-declared-scope" : "partial",
      scope: "P2 export keys, native entries, and the explicit runtime-owned reference field matrix",
      issues: specIssues,
      groups: specGroups,
      ast: Boolean(specAnalysis.ast),
      l_fast_static_admission: specAnalysis.diagnostics.length === 0
    };
    for (const diagnostic of specAnalysis.diagnostics) issues.push(issue(diagnostic.pointer, diagnostic.code, diagnostic.message, "high"));
    for (const message of [...specGroupIssues, ...specShapeIssues]) issues.push(issue("spec.mjs", "partial-spec-extraction", message, "high"));
  } else if (specEntry) {
    extraction.spec = { status: "partial", scope: "spec.mjs", issues: ["spec.mjs is not bounded UTF-8 text."], ast: false, l_fast_static_admission: false };
  } else {
    extraction.spec = { status: "not-present", scope: "spec.mjs", issues: [], ast: false, l_fast_static_admission: null };
  }

  for (const language of ["body.md", "body_ko.md"]) {
    const entry = entryByPath.get(language);
    if (!entry) continue;
    if (entry.text === null) {
      extraction[`body:${language}`] = { status: "partial", scope: language, issues: ["Body is not bounded UTF-8 text."] };
      continue;
    }
    const parsed = parseBody(entry.text, language);
    addBodySubjects(builder, entry, parsed);
    const bodyIssues = [
      ...parsed.invalidHeadings.map((item) => `Unsupported level-two heading: ${item.title}`),
      ...parsed.duplicates.map((item) => `Duplicate body ref: ${item.ref}`)
    ];
    extraction[`body:${language}`] = { status: bodyIssues.length ? "partial" : "complete-for-declared-scope", scope: `${language} recognized body sections`, issues: bodyIssues };
    for (const message of bodyIssues) issues.push(issue(language, "body-parse", message, "medium"));
  }

  addSpecRelations(builder, relationSites);
  addFixtureRelations(builder);
  addManifestRelations(builder, manifest, started);
  addGenericPathCandidates(builder, genericEntries);
  const textMatches = addQueryTextSubjects(builder, genericEntries, options.query);
  builder.resolveRelations();

  const manifestAssessment = assessManifest(manifest, started, entryByPath);
  const frontiers = collectFrontiers({ entries, issues, builder, staticSpec, specEntry, manifest, moduleExtraction });
  extraction.inventory = {
    status: started.complete ? "complete-for-declared-scope" : "partial",
    scope: "regular entries below the package root excluding .git and node_modules; symlink and special-entry targets are not followed",
    issues: started.issues.map((item) => item.message)
  };
  extraction.generic_text = {
    status: genericCandidates.every((entry) => entry.type !== "file" || entry.text !== null || entry.handling === "opaque") ? "complete-for-declared-scope" : "partial",
    scope: `authored UTF-8 files up to ${MAX_TEXT_BYTES} bytes; generated projections are inventory-only unless named by an exact file query, and opaque or larger content is not semantically searched`,
    issues: genericCandidates.filter((entry) => ["oversize", "unreadable"].includes(entry.handling)).map((entry) => entry.path)
  };

  const finished = await captureInventory(root, options);
  const stable = started.fingerprint === finished.fingerprint;
  if (!stable) issues.unshift(issue(".", "changed-during-query", "Package entries or bytes changed while describe was analyzing the captured source.", "high"));

  const purpose = derivePurpose(intent, skillDocument, profileDecision, staticSpec);
  const classification = classifyPackage({ profileDecision, intent, specEntry, skillEntry, staticSpec, manifest });
  const model = {
    schema: PREVIEW_SCHEMA,
    preview: true,
    snapshot: {
      root,
      root_identity: await safeRealpath(root),
      source_basis: started.fingerprint,
      stable,
      status: stable ? "stable" : "changed",
      captured_files: entries.filter((entry) => entry.type === "file").length,
      started_fingerprint: started.fingerprint,
      finished_fingerprint: finished.fingerprint,
      inspector: { maintenance_context: "preview/1", runtime_version: RUNTIME_VERSION, validator_version: VALIDATOR_VERSION }
    },
    classification,
    purpose,
    assessment: {
      extraction,
      full_validation: "not-assessed-no-package-source-execution",
      write_admission: "not-assessed-read-only-does-not-grant-mutation",
      runtime_admission: "not-assessed-read-only-does-not-reconstruct-a-decision",
      manifest: manifestAssessment
    },
    inventory: {
      scope: extraction.inventory.scope,
      complete: started.complete && stable,
      excluded: started.excluded,
      entries: entries.map(publicEntry)
    },
    subjects: builder.subjects,
    relations: builder.relations,
    evidence: evidenceSummary(manifest, semanticDiff, manifestAssessment),
    relation_sites: relationSites,
    frontiers,
    issues: dedupeObjects(issues),
    limits: { max_text_bytes: MAX_TEXT_BYTES, max_excerpt_chars: MAX_EXCERPT_CHARS, max_capsule_subjects: MAX_CAPSULE_SUBJECTS, max_capsule_relations: MAX_CAPSULE_RELATIONS }
  };
  model.spec_groups = specGroups;
  model.text_matches = textMatches;
  return projectMaintenanceContext(model, options.query ?? null, { staticSpec });
}

export function renderMaintenanceContextText(value) {
  const lines = [];
  lines.push("Skill Rails maintenance context (PREVIEW)");
  lines.push(`STATUS: snapshot=${value.snapshot.status}; extraction=${value.summary.extraction_status}; query=${value.query.status}; declared-relations=${value.assessment.relation_coverage.status}`);
  lines.push(`BASIS: ${value.snapshot.source_basis}; root=${value.snapshot.root}`);
  lines.push(`SCOPE: ${value.summary.scope}`);
  lines.push("SAFETY: This result is read-only navigation. found is not exhaustive; scoped absence is not deletion safety; definitions are not execution receipts; write/runtime admission is not assessed.");
  if (value.summary.critical_gaps.length) {
    lines.push("CRITICAL GAPS:");
    for (const gap of value.summary.critical_gaps) lines.push(`- ${gap}`);
  } else lines.push("CRITICAL GAPS: none inside the declared extraction scopes; external and unassessed semantics still remain outside those scopes.");
  if (value.assessment.relation_coverage.blockers.length) {
    lines.push("RELATION COVERAGE BLOCKERS:");
    for (const blocker of value.assessment.relation_coverage.blockers) lines.push(`- ${blocker.family ?? "owner"}: ${blocker.reason} Hint: ${blocker.hint}`);
  }
  lines.push("");
  lines.push("Purpose");
  lines.push(`- name: ${value.purpose.name ?? "unknown"}`);
  lines.push(`- profile: ${value.classification.profile ?? "unknown"} (${value.classification.profile_basis})`);
  lines.push(`- problem: ${value.purpose.problem ?? "unknown"}`);
  if (value.purpose.profile_reason) lines.push(`- profile reason: ${value.purpose.profile_reason}`);
  if (value.purpose.profile_warning) lines.push(`- profile warning: ${value.purpose.profile_warning}`);
  lines.push("");
  lines.push(`Query: ${value.query.input ?? "<overview>"} -> ${value.query.status}${value.query.scope ? ` within ${value.query.scope}` : ""}`);
  if (value.query.note) lines.push(`- ${value.query.note}`);
  lines.push("");
  lines.push("Source-linked capsule");
  if (!value.capsule.subjects.length) lines.push("- No bounded subject was selected. Follow the next read; do not infer global absence.");
  for (const subject of value.capsule.subjects) {
    const label = subject.locator ?? subject.display;
    lines.push(`- ${label} [${subject.kind}; ${subject.identity}]${subject.generated ? " GENERATED" : ""}`);
    if (subject.path) lines.push(`  source: ${subject.display ?? subject.path}`);
    if (subject.text) lines.push(indentBlock(subject.text, "  "));
  }
  lines.push("");
  lines.push("Relations");
  if (!value.capsule.relations.length) lines.push("- none in the bounded capsule; this is not proof that no relation exists");
  for (const relation of value.capsule.relations) {
    lines.push(`- ${relation.kind}: ${relation.from_label} -> ${relation.to_label} [${relation.basis}; ${relation.resolution}]${relation.ordinal == null ? "" : ` order=${relation.ordinal}`}`);
  }
  if (value.capsule.omitted.subjects || value.capsule.omitted.relations) {
    lines.push(`- TRUNCATED: omitted subjects=${value.capsule.omitted.subjects}, relations=${value.capsule.omitted.relations}; follow the exact continuation below.`);
  }
  lines.push("");
  lines.push("Evidence and receipts");
  lines.push(`- definitions: ${value.evidence.definitions}; locator resolution or fixture presence is not adequacy or execution proof`);
  lines.push(`- build manifest: ${value.evidence.build_manifest.status}; scope=${value.evidence.build_manifest.authority}`);
  lines.push(`- semantic diff: ${value.evidence.semantic_diff.status}; authority=change receipt only`);
  lines.push(`- fresh-agent behavior: ${value.evidence.fresh_agent.status}`);
  lines.push("");
  lines.push("Next");
  for (const item of value.next.read) lines.push(`- read: ${item}`);
  for (const item of value.next.constraints) lines.push(`- constraint: ${item}`);
  for (const item of value.next.change) lines.push(`- change: ${item}`);
  for (const item of value.next.verify) lines.push(`- verify: ${item}`);
  lines.push(`- resume: ${value.resume_key.next_invocation}`);
  return `${lines.join("\n")}\n`;
}

export function renderSkillMapPreview(value) {
  const ownerRows = ownerSummary(value).slice(0, 12);
  const extractionRows = Object.entries(value.assessment.extraction)
    .filter(([, item]) => item.status !== "not-present")
    .map(([name, item]) => `${name}=${item.status}`);
  const chain = representativeMaintenanceChain(value);
  const lines = [
    "<!-- @generated by Skill Rails maintenance context preview; stdout preview only; do not edit as a behavior source -->",
    "# Skill Map (Preview)",
    "",
    `> Source basis: \`${value.snapshot.source_basis}\`. Snapshot: **${value.snapshot.status}**. Extraction: **${value.summary.extraction_status}** for the declared scopes only. Relation coverage: **${value.assessment.relation_coverage.status}** (maps are discovery-only; exact-owner queries are required at checkpoints). Omitted: subjects=${value.summary.omitted.subjects}, relations=${value.summary.omitted.relations}.`,
    `> Extractors: ${extractionRows.join("; ") || "none"}.`,
    `> Critical gaps: ${value.summary.critical_gaps.length ? value.summary.critical_gaps.slice(0, 3).join(" | ") : "none inside declared scopes"}. This map is not a complete behavior proof or write/runtime admission.`,
    "",
    "## Purpose",
    "",
    value.purpose.problem ?? "Purpose is unknown from the current bounded sources.",
    "",
    `- Skill: \`${value.purpose.name ?? "unknown"}\``,
    `- Profile: \`${value.classification.profile ?? "unknown"}\` (${value.classification.profile_basis})`,
    `- Profile reason: ${value.purpose.profile_reason ?? "unknown"}`,
    ...(value.purpose.profile_warning ? [`- Scaffold warning: ${value.purpose.profile_warning}`] : []),
    `- Inputs: ${summarizeIntent(value, "inputs")}`,
    `- Outputs: ${summarizeIntent(value, "outputs")}`,
    `- Important boundaries: ${summarizeIntent(value, "irreversible_boundaries")}`,
    "",
    "## Owners and consumers",
    "",
    "| Area | Current source | Meaning |",
    "| --- | --- | --- |",
    ...ownerRows.map((row) => `| ${escapeTable(row.area)} | ${escapeTable(row.source)} | ${escapeTable(row.meaning)} |`),
    "",
    "## Representative maintenance path",
    "",
    ...chain,
    "",
    "## Evidence and limits",
    "",
    `- Build evidence: ${value.evidence.build_manifest.status}; ${value.evidence.build_manifest.authority}.`,
    `- Fresh-agent behavior: ${value.evidence.fresh_agent.status}.`,
    ...value.summary.critical_gaps.slice(0, 8).map((gap) => `- Gap: ${gap}`),
    "- A missing result outside an explicitly complete finite locator universe is unknown, not absent.",
    "",
    "## Current entry",
    "",
    "```text",
    `node "<skill-rails-root>/scripts/maintain.mjs" --skill ${quoteCommandArg(value.snapshot.root)} --describe --query <locator-or-interest> --json`,
    "```",
    ""
  ];
  return lines.join("\n");
}

function createModelBuilder(entryByPath, generatedPaths) {
  const subjects = [];
  const relations = [];
  const values = new Map();
  const locatorIndex = new Map();
  const relationKeys = new Set();

  const addSubject = (subject, value = subject.data) => {
    const normalized = {
      id: subject.id,
      locator: subject.locator ?? null,
      display: subject.display ?? subject.path ?? subject.locator ?? subject.id,
      kind: subject.kind,
      name: subject.name ?? null,
      path: subject.path ?? null,
      span: subject.span ?? null,
      identity: subject.identity ?? "snapshot-local",
      basis: subject.basis ?? "observed-source",
      authority: subject.authority ?? "source-navigation",
      generated: Boolean(subject.generated ?? generatedPaths.has(subject.path)),
      text: excerpt(subject.text ?? ""),
      data: compactValue(subject.data ?? null)
    };
    subjects.push(normalized);
    values.set(normalized.id, value);
    if (normalized.locator) {
      const list = locatorIndex.get(normalized.locator) ?? [];
      list.push(normalized.id);
      locatorIndex.set(normalized.locator, list);
    }
    return normalized;
  };

  const addRelation = (from, target, kind, options = {}) => {
    const targetKey = typeof target === "string" ? `locator:${target}` : `id:${target?.id}`;
    const key = `${from}\0${targetKey}\0${kind}\0${options.ordinal ?? ""}\0${options.source_locator ?? ""}`;
    if (relationKeys.has(key)) return;
    relationKeys.add(key);
    relations.push({
      id: `relation:${sha256(key).slice(7, 23)}`,
      from,
      to: typeof target === "object" ? target.id : null,
      target: typeof target === "string" ? target : null,
      candidates: [],
      kind,
      basis: options.basis ?? "derived",
      source_locator: options.source_locator ?? null,
      resolution: typeof target === "object" ? "resolved" : "pending",
      ordinal: Number.isInteger(options.ordinal) ? options.ordinal : null,
      note: options.note ?? null
    });
  };

  const addExternalSubject = (kind, name, text, options = {}) => {
    const id = `external:${kind}:${sha256(`${name}\0${text}`).slice(7, 23)}`;
    const existing = subjects.find((subject) => subject.id === id);
    if (existing) return existing;
    return addSubject({ id, locator: null, display: name, kind: `external-${kind}`, name, identity: "external-boundary", basis: options.basis ?? "declared", authority: "external-endpoint", text, data: options.data ?? null });
  };

  const resolveRelations = () => {
    for (const [locator, ids] of locatorIndex) {
      if (ids.length > 1) for (const id of ids) {
        const subject = subjects.find((item) => item.id === id);
        if (subject?.identity === "native-stable") subject.identity = "native-ambiguous";
      }
    }
    for (const relation of relations) {
      if (relation.resolution !== "pending") continue;
      const ids = locatorIndex.get(relation.target) ?? [];
      relation.candidates = ids;
      if (ids.length === 1) {
        relation.to = ids[0];
        relation.resolution = "resolved";
      } else if (ids.length > 1) relation.resolution = "ambiguous";
      else relation.resolution = "unresolved";
    }
  };

  const find = (predicate) => subjects.filter(predicate);
  const value = (subject) => values.get(typeof subject === "string" ? subject : subject.id);
  const nearestSourceSubject = (path, offset) => find((subject) => subject.path === path && subject.span && subject.span.start <= offset && subject.span.end >= offset)
    .sort((left, right) => (left.span.end - left.span.start) - (right.span.end - right.span.start))[0]
    ?? subjects.find((subject) => subject.id === `file:${path}`);

  return { subjects, relations, addSubject, addRelation, addExternalSubject, resolveRelations, find, value, nearestSourceSubject, entryByPath, locatorIndex };
}

async function captureInventory(root, options = {}) {
  const entries = [];
  const issues = [];
  const excluded = [];
  let rootEntry;
  try { rootEntry = await lstat(root); }
  catch (error) { throw new Error(`SR_DESCRIBE_ROOT: cannot inspect target package root: ${error.message}`); }
  if (!rootEntry.isDirectory()) throw new Error("SR_DESCRIBE_ROOT: target package root must be a directory.");

  const walk = async (absolute, prefix = "") => {
    let children;
    try { children = await readdir(absolute, { withFileTypes: true }); }
    catch (error) {
      issues.push(issue(prefix || ".", "unreadable-directory", error.message, "high"));
      return;
    }
    children.sort((left, right) => left.name.localeCompare(right.name));
    for (const child of children) {
      const local = prefix ? `${prefix}/${child.name}` : child.name;
      if (!prefix && EXCLUDED_ROOTS.has(child.name)) {
        excluded.push({ path: local, reason: "declared-root-exclusion" });
        continue;
      }
      const path = join(absolute, child.name);
      let entry;
      try { entry = await lstat(path); }
      catch (error) {
        issues.push(issue(local, "unreadable-entry", error.message, "high"));
        entries.push({ path: local, type: "unreadable", bytes: null, hash: null, text: null, handling: "unreadable", generated: false });
        continue;
      }
      if (entry.isSymbolicLink()) {
        entries.push({ path: local, type: "symlink", bytes: null, hash: null, text: null, handling: "unsupported", generated: false });
        issues.push(issue(local, "symlink-frontier", "Symlink or junction target was not followed.", "high"));
      } else if (entry.isDirectory()) {
        entries.push({ path: local, type: "directory", bytes: 0, hash: null, text: null, handling: "enumerated", generated: false });
        await walk(path, local);
      } else if (entry.isFile()) {
        let bytes;
        try { bytes = await readFile(path); }
        catch (error) {
          entries.push({ path: local, type: "file", bytes: Number(entry.size), hash: null, text: null, handling: "unreadable", generated: false });
          issues.push(issue(local, "unreadable-file", error.message, "high"));
          continue;
        }
        let text = null;
        let handling = "opaque";
        if (bytes.length <= (options.maxTextBytes ?? MAX_TEXT_BYTES)) {
          try {
            text = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
            handling = "text-searched";
          } catch { handling = "opaque"; }
        } else handling = "oversize";
        entries.push({ path: local, type: "file", bytes: bytes.length, hash: sha256(bytes), text, handling, generated: false });
      } else {
        entries.push({ path: local, type: "special", bytes: null, hash: null, text: null, handling: "unsupported", generated: false });
        issues.push(issue(local, "unsupported-entry", "Special filesystem entry was not inspected.", "high"));
      }
    }
  };
  await walk(root);
  const fingerprint = sha256(entries.map((entry) => `${entry.path}\0${entry.type}\0${entry.hash ?? ""}\0${entry.bytes ?? ""}`).join("\n"));
  return { root, entries, issues, excluded, complete: issues.length === 0, fingerprint };
}

function fileSubject(entry) {
  return {
    id: `file:${entry.path}`,
    locator: `file:${entry.path}`,
    display: entry.path,
    kind: "file",
    name: entry.path,
    path: entry.path,
    identity: "path-stable-current-bytes",
    basis: "observed-source",
    authority: entry.projection ? "intent-derived-projection" : entry.generated ? "generated-projection" : "file-presence",
    generated: entry.generated,
    text: "",
    data: { type: entry.type, bytes: entry.bytes, hash: entry.hash, handling: entry.handling, projection: entry.projection ?? null }
  };
}

function addIntentSubjects(builder, intent, entry, spans) {
  if (!intent || !entry?.text) return;
  const visit = (value, path, tokens) => {
    if (typeof value === "string") {
      const span = jsonSpan(spans, tokens);
      const identity = tokens.some((token) => Number.isInteger(token)) ? "positional" : "native-stable";
      const subject = sourceSubject(entry, span, "intent-requirement", path, intentLocator(path), sourceSlice(entry, span), { source: path, value }, identity);
      builder.addSubject(subject, value);
      builder.addRelation(subject.id, { id: `file:${entry.path}` }, "contained-in", { source_locator: subject.display });
      return;
    }
    if (Array.isArray(value)) return value.forEach((item, index) => visit(item, `${path}[${index}]`, [...tokens, index]));
    if (value && typeof value === "object") for (const [key, item] of Object.entries(value)) visit(item, path ? `${path}.${key}` : key, [...tokens, key]);
  };
  for (const [key, value] of Object.entries(intent)) visit(value, `intent.${key}`, [key]);
}

function addLedgerSubjects(builder, ledger, entry, spans) {
  if (!Array.isArray(ledger?.atoms) || !entry?.text) return;
  for (const [index, atom] of ledger.atoms.entries()) {
    const span = jsonSpan(spans, ["atoms", index]);
    const locator = atom?.id ? `atom:${atom.id}` : null;
    const subject = sourceSubject(entry, span, "obligation-atom", atom?.id ?? `index-${index}`, locator, sourceSlice(entry, span), {
      source: atom?.source ?? null,
      candidate_class: atom?.candidate_class ?? null,
      consequence: atom?.consequence ?? null,
      disposition: atom?.disposition ?? null,
      targets: atom?.targets ?? [],
      evidence: atom?.evidence ?? []
    }, "positional");
    builder.addSubject(subject, atom);
    builder.addRelation(subject.id, { id: `file:${entry.path}` }, "contained-in", { source_locator: subject.display });
    if (atom?.source) builder.addRelation(subject.id, intentLocator(atom.source), "originates-from", { basis: "declared", source_locator: subject.display });
    for (const [ordinal, target] of (Array.isArray(atom?.targets) ? atom.targets : []).entries()) builder.addRelation(subject.id, target, "targets", { basis: "declared", source_locator: subject.display, ordinal });
    for (const [ordinal, target] of (Array.isArray(atom?.evidence) ? atom.evidence : []).entries()) builder.addRelation(subject.id, target, "names-evidence", { basis: "declared", source_locator: subject.display, ordinal, note: "Membership is not a direct proof edge." });
  }
}

function addArraySubjects(builder, value, entry, locatorPrefix, kind, spans) {
  if (!Array.isArray(value) || !entry?.text) return;
  for (const [index, item] of value.entries()) {
    const name = item?.id ?? `index-${index}`;
    const span = jsonSpan(spans, [index]);
    const subject = sourceSubject(entry, span, kind, name, item?.id ? `${locatorPrefix}:${item.id}` : null, sourceSlice(entry, span), item, item?.id ? "native-stable" : "positional");
    builder.addSubject(subject, item);
    builder.addRelation(subject.id, { id: `file:${entry.path}` }, "contained-in", { source_locator: subject.display });
  }
}

function addBodySubjects(builder, entry, parsed) {
  for (const section of parsed.sections) {
    const locator = `body:${section.ref}`;
    const subject = sourceSubject(entry, { start: section.start, end: section.end }, "body-section", section.ref, locator, section.markdown, {
      kind: section.kind,
      body_id: section.id,
      rationale: extractWhy(section.markdown)
    }, "native-stable");
    builder.addSubject(subject, { kind: section.kind, id: section.id, ref: section.ref, markdown: section.markdown });
    builder.addRelation(subject.id, { id: `file:${entry.path}` }, "contained-in", { source_locator: subject.display });
  }
}

function addMarkdownLinks(builder, entry) {
  for (const match of entry.text.matchAll(/\[[^\]]+\]\(([^)]+)\)/g)) {
    const raw = match[1].trim().replace(/^<|>$/g, "");
    if (/^(?:https?:|mailto:|#)/i.test(raw)) continue;
    const target = normalizeLinkedPath(entry.path, raw.split("#", 1)[0]);
    if (!target) continue;
    const owner = builder.nearestSourceSubject(entry.path, match.index);
    builder.addRelation(owner.id, `file:${target}`, "links", { basis: "declared", source_locator: sourceDisplay(entry, match.index, match.index + match[0].length), note: raw.includes("#") ? `fragment=${raw.slice(raw.indexOf("#"))}` : null });
  }
}

function addLiteralModuleRelations(builder, entry, entryByPath, summary) {
  if (/\.(?:ts|tsx|jsx)$/i.test(entry.path)) {
    summary.partial.push(`${entry.path}: TypeScript/JSX module edges are outside the Acorn JavaScript scope.`);
    return;
  }
  let ast;
  try {
    ast = parse(entry.text, { ecmaVersion: "latest", sourceType: "module", allowHashBang: true });
  } catch (error) {
    summary.partial.push(`${entry.path}: JavaScript module edges were not extracted: ${error.message}`);
    return;
  }
  summary.parsed += 1;
  const seen = new Set();
  const add = (node, sourceNode, basis = "derived-static-ast", resolution = "exact-esm") => {
    const specifier = typeof sourceNode?.value === "string" ? sourceNode.value : null;
    if (!specifier || !specifier.startsWith(".")) return;
    const key = `${node.start}\0${specifier}`;
    if (seen.has(key)) return;
    seen.add(key);
    const target = resolveModuleCandidate(entry.path, specifier, entryByPath, resolution);
    const owner = builder.nearestSourceSubject(entry.path, node.start);
    builder.addRelation(owner.id, target ? `file:${target}` : `module:${specifier}`, "imports", { basis, source_locator: sourceDisplay(entry, node.start, node.end) });
  };
  walk.simple(ast, {
    ImportDeclaration(node) { add(node, node.source); },
    ExportNamedDeclaration(node) { if (node.source) add(node, node.source); },
    ExportAllDeclaration(node) { add(node, node.source); },
    ImportExpression(node) {
      summary.dynamic.push(`${entry.path}:${sourceLocation(entry.text, node.start).line}`);
      add(node, node.source, "derived-literal-dynamic-import");
    },
    CallExpression(node) {
      if (node.callee?.type === "Identifier" && node.callee.name === "require" && node.arguments?.length === 1) add(node, node.arguments[0], "derived-static-cjs-require", "node-cjs");
    }
  });
}

function extractSpec(builder, entry, analysis) {
  if (!analysis.ast) return null;
  const spec = {};
  const groups = {};
  for (const top of analysis.ast.body) {
    if (top.type !== "ExportNamedDeclaration" || top.declaration?.type !== "VariableDeclaration") continue;
    for (const declaration of top.declaration.declarations) {
      if (declaration.id?.type !== "Identifier") continue;
      const group = declaration.id.name;
      const initializer = declaration.init;
      const value = staticValue(initializer);
      spec[group] = value;
      const groupSubject = sourceSubject(entry, initializer ?? declaration, "spec-export", group, null, sourceSlice(entry, initializer ?? declaration), { group, value }, "snapshot-local");
      builder.addSubject(groupSubject, value);
      builder.addRelation(groupSubject.id, { id: `file:${entry.path}` }, "contained-in", { source_locator: groupSubject.display });

      if (SPEC_ARRAY_GROUPS.has(group) && initializer?.type === "ArrayExpression") {
        const groupIssues = [];
        for (const element of initializer.elements.filter(Boolean)) {
          const item = staticValue(element);
          const name = item?.id;
          if (typeof name !== "string") groupIssues.push(`${group} contains an entry whose literal id could not be enumerated.`);
          const locator = typeof name === "string" ? `spec:${group}/${name}` : null;
          const kind = { GUARDS: "spec-guard", STAGES: "spec-stage", DEFERRED: "spec-deferred" }[group];
          const subject = sourceSubject(entry, element, kind, name ?? "unnamed", locator, sourceSlice(entry, element), { group, ...item }, locator ? "native-stable" : "snapshot-local");
          builder.addSubject(subject, item);
          builder.addRelation(groupSubject.id, { id: subject.id }, "owns-entry", { source_locator: subject.display });
        }
        groups[group] = { status: groupIssues.length ? "partial" : "complete-for-declared-scope", scope: `literal ids in ${group}`, issues: groupIssues };
        continue;
      }

      if (SPEC_ARRAY_GROUPS.has(group)) {
        groups[group] = { status: "partial", scope: `literal ids in ${group}`, issues: [`${group} is not declared as a direct array literal; its finite key set is unknown to the static index.`] };
        continue;
      }

      if (group === "READ_FIRST" && initializer?.type === "ArrayExpression") {
        const groupIssues = [];
        for (const [index, element] of initializer.elements.filter(Boolean).entries()) {
          const item = staticValue(element);
          if (!isRecord(item)) groupIssues.push(`READ_FIRST[${index}] is not a directly enumerable static object.`);
          const subject = sourceSubject(entry, element, "spec-read-first", String(index), null, sourceSlice(entry, element), { group, index, ...item }, "positional");
          builder.addSubject(subject, item);
          builder.addRelation(groupSubject.id, { id: subject.id }, "owns-entry", { source_locator: subject.display, ordinal: index });
        }
        groups[group] = { status: groupIssues.length ? "partial" : "complete-for-declared-scope", scope: "literal entries in READ_FIRST", issues: groupIssues };
        continue;
      }

      if (group === "READ_FIRST") {
        groups[group] = { status: "partial", scope: "literal entries in READ_FIRST", issues: ["READ_FIRST is not declared as a direct array literal; its finite entry set is unknown to the static index."] };
        continue;
      }

      if (!SPEC_OBJECT_GROUPS.has(group)) continue;
      if (initializer?.type !== "ObjectExpression") {
        groups[group] = { status: "partial", scope: `literal keys in ${group}`, issues: [`${group} is not declared as a direct object literal; its finite key set is unknown to the static index.`] };
        continue;
      }
      const groupIssues = [];
      for (const property of initializer.properties.filter((item) => item.type === "Property" && !item.computed)) {
        const name = propertyName(property.key);
        const item = staticValue(property.value);
        if (group === "TABLES") {
          const table = sourceSubject(entry, property, "spec-table", name, null, sourceSlice(entry, property), { group, table: name, ...item }, "snapshot-local");
          builder.addSubject(table, item);
          builder.addRelation(groupSubject.id, { id: table.id }, "owns-entry", { source_locator: table.display });
          const rowsProperty = objectProperty(property.value, "rows");
          if (rowsProperty?.value?.type === "ArrayExpression") {
            for (const [ordinal, rowNode] of rowsProperty.value.elements.filter(Boolean).entries()) {
              const row = staticValue(rowNode);
              const state = row?.state;
              if (typeof state !== "string") groupIssues.push(`TABLES.${name}.rows contains a row whose literal state could not be enumerated.`);
              const locator = typeof state === "string" ? `spec:TABLES/${name}/${state}` : null;
              const subject = sourceSubject(entry, rowNode, "spec-table-row", state ?? `row-${ordinal}`, locator, sourceSlice(entry, rowNode), { group, table: name, ordinal, ...row }, locator ? "native-stable" : "positional");
              builder.addSubject(subject, row);
              builder.addRelation(table.id, { id: subject.id }, "owns-row", { source_locator: subject.display, ordinal });
            }
          } else groupIssues.push(`TABLES.${name}.rows is not a direct array literal; its finite row set is unknown to the static index.`);
          continue;
        }
        const locator = SPEC_KEYED_L16_GROUPS.has(group) ? `spec:${group}/${name}` : null;
        const subject = sourceSubject(entry, property, `spec-${group.toLowerCase()}`, name, locator, sourceSlice(entry, property), { group, key: name, value: item }, locator ? "native-stable" : "snapshot-local");
        builder.addSubject(subject, item);
        builder.addRelation(groupSubject.id, { id: subject.id }, "owns-entry", { source_locator: subject.display });
      }
      if (initializer.properties.some((item) => item.type !== "Property" || item.computed)) groupIssues.push(`${group} contains a computed or spread key that could not be enumerated.`);
      groups[group] = { status: groupIssues.length ? "partial" : "complete-for-declared-scope", scope: group === "TABLES" ? "literal table and row keys in TABLES" : `literal keys in ${group}`, issues: groupIssues };
    }
  }
  for (const group of [...SPEC_ARRAY_GROUPS, ...SPEC_OBJECT_GROUPS, "READ_FIRST"]) groups[group] ??= { status: "partial", scope: `literal keys in ${group}`, issues: [`${group} was not exported as a statically enumerable declaration.`] };
  return { spec, groups };
}

function addSpecRelations(builder, relationSites) {
  const specSubjects = builder.find((subject) => subject.path === "spec.mjs");
  const byKindName = (kind, name) => specSubjects.filter((subject) => subject.kind === kind && subject.name === name);
  const firstTarget = (kind, name) => byKindName(kind, name)[0] ?? null;

  for (const subject of specSubjects) {
    const value = builder.value(subject);
    if (!value || typeof value !== "object") continue;
    const sourceLocator = subject.display;
    if (subject.kind === "spec-guard") {
      recordRelationSite(relationSites, subject, value, ["reads"], "reads", "string-array");
      recordRelationSite(relationSites, subject, value, ["unless", "reads"], "unless-reads", "string-array");
      recordRelationSite(relationSites, subject, value, ["body"], "uses-body", "string");
      addObservationReads(builder, subject, value.reads, "reads", sourceLocator);
      addObservationReads(builder, subject, value.unless?.reads, "unless-reads", sourceLocator);
      if (value.body) builder.addRelation(subject.id, `body:${value.body}`, "uses-body", { basis: "declared", source_locator: sourceLocator });
    } else if (subject.kind === "spec-stage") {
      recordRelationSite(relationSites, subject, value, ["reads"], "reads", "string-array");
      recordRelationSite(relationSites, subject, value, ["needs"], "needs-judgment", "string-array");
      recordRelationSite(relationSites, subject, value, ["body"], "uses-body", "string");
      recordRelationSite(relationSites, subject, value, ["table"], "selects-table", "string");
      recordRelationSite(relationSites, subject, value, ["record", "artifact"], "records-artifact", "string");
      recordRelationSite(relationSites, subject, value, ["record", "format"], "records-format", "string");
      for (const family of ["uses-artifact", "uses-template", "uses-format", "dispatches-role"]) {
        recordRelationSite(relationSites, subject, value, ["effects"], family, "effect-plan");
        recordRelationSite(relationSites, subject, value, ["branches"], family, "effect-branches");
      }
      addObservationReads(builder, subject, value.reads, "reads", sourceLocator);
      addObservationReads(builder, subject, value.needs, "needs-judgment", sourceLocator);
      if (value.body) builder.addRelation(subject.id, `body:${value.body}`, "uses-body", { basis: "declared", source_locator: sourceLocator });
      if (value.table) {
        const table = firstTarget("spec-table", value.table);
        builder.addRelation(subject.id, table ? { id: table.id } : `spec-table:${value.table}`, "selects-table", { basis: "declared", source_locator: sourceLocator });
      }
      if (value.record?.artifact) builder.addRelation(subject.id, `spec:ARTIFACTS/${value.record.artifact}`, "records-artifact", { basis: "declared", source_locator: sourceLocator });
      if (value.record?.format) builder.addRelation(subject.id, `spec:FORMATS/${value.record.format}`, "records-format", { basis: "declared", source_locator: sourceLocator });
      addEffectPlanRelations(builder, subject, value.effects, "default");
      for (const [branch, plan] of Object.entries(value.branches ?? {})) addEffectPlanRelations(builder, subject, plan, `branch:${branch}`);
    } else if (subject.kind === "spec-table") {
      recordRelationSite(relationSites, subject, value, ["rows"], "owns-row", "array");
    } else if (subject.kind === "spec-table-row") {
      recordRelationSite(relationSites, subject, value, ["reads"], "reads", "string-array");
      addObservationReads(builder, subject, value.reads, "reads", sourceLocator);
    } else if (subject.kind === "spec-observations") {
      recordRelationSite(relationSites, subject, value, ["collector"], "implemented-by-collector-module", "string");
      if (value.collector) {
        const file = builder.find((item) => item.id === "file:collectors/index.mjs")[0];
        builder.addRelation(subject.id, file ? { id: file.id } : "file:collectors/index.mjs", "implemented-by-collector-module", { basis: "declared", source_locator: sourceLocator, note: `collector=${value.collector}; collector behavior remains dynamically implemented` });
      }
    } else if (subject.kind === "spec-templates") {
      recordRelationSite(relationSites, subject, value, ["file"], "uses-template-file", "string");
      if (value.file) builder.addRelation(subject.id, `file:${value.file}`, "uses-template-file", { basis: "declared", source_locator: sourceLocator });
    } else if (subject.kind === "spec-artifacts") {
      recordRelationSite(relationSites, subject, value, ["template"], "uses-template", "string");
      recordRelationSite(relationSites, subject, value, ["path"], "declares-project-path", "string");
      recordRelationSite(relationSites, subject, value, ["writer"], "writer", "string");
      recordRelationSite(relationSites, subject, value, ["readers"], "reader", "string-array");
      if (value.template) builder.addRelation(subject.id, `spec:TEMPLATES/${value.template}`, "uses-template", { basis: "declared", source_locator: sourceLocator });
      if (value.path) {
        const endpoint = builder.addExternalSubject("project-path", value.path, "ARTIFACTS.path is project-relative domain data, not a package file.", { data: { artifact: subject.name, path: value.path } });
        builder.addRelation(subject.id, { id: endpoint.id }, "declares-project-path", { basis: "declared", source_locator: sourceLocator });
      }
      if (value.writer) addActorRelation(builder, subject, value.writer, "writer", sourceLocator);
      for (const [ordinal, reader] of (Array.isArray(value.readers) ? value.readers : []).entries()) addActorRelation(builder, subject, reader, "reader", sourceLocator, ordinal);
    } else if (subject.kind === "spec-roles") {
      recordRelationSite(relationSites, subject, value, ["body"], "uses-body", "string");
      recordRelationSite(relationSites, subject, value, ["returns"], "returns-template", "string");
      if (value.body) builder.addRelation(subject.id, `body:${value.body}`, "uses-body", { basis: "declared", source_locator: sourceLocator });
      if (value.returns) builder.addRelation(subject.id, `spec:TEMPLATES/${value.returns}`, "returns-template", { basis: "declared", source_locator: sourceLocator });
    } else if (subject.kind === "spec-read-first") {
      recordRelationSite(relationSites, subject, value, ["body"], "read-first-body", "string");
      recordRelationSite(relationSites, subject, value, ["path"], "read-first-file", "string");
      if (value.body) builder.addRelation(subject.id, `body:${value.body}`, "read-first-body", { basis: "declared", source_locator: sourceLocator });
      if (value.path) builder.addRelation(subject.id, `file:${value.path}`, "read-first-file", { basis: "declared", source_locator: sourceLocator });
    } else if (subject.kind === "spec-declarations") {
      recordRelationSite(relationSites, subject, value, ["consumer"], "declares-consumer", "string");
      if (value.consumer) {
        const endpoint = builder.addExternalSubject("declared-consumer", value.consumer, "Declaration consumer is named by the spec; its implementation may be outside this package.");
        builder.addRelation(subject.id, { id: endpoint.id }, "declares-consumer", { basis: "declared", source_locator: sourceLocator });
      }
    } else if (subject.kind === "spec-ownership") {
      recordSyntheticRelationSite(relationSites, subject, "owns-project-path");
      const endpoint = builder.addExternalSubject("project-path", subject.name, "OWNERSHIP addresses a project-relative path, not a package file.");
      builder.addRelation(subject.id, { id: endpoint.id }, "owns-project-path", { basis: "declared", source_locator: sourceLocator, note: String(value) });
    }
  }
}

function recordRelationSite(sites, subject, value, path, family, shape) {
  const inspected = inspectStaticPath(value, path);
  const intentionallyEmpty = inspected.status === "present" && inspected.value === null;
  const valid = inspected.status === "present" && relationSlotShape(inspected.value, shape);
  const status = inspected.status === "absent" || intentionallyEmpty ? "absent" : valid ? "decoded" : "blocked";
  const field = path.join(".");
  sites.push({
    source_id: subject.id,
    source_kind: subject.kind,
    source_group: SPEC_SOURCE_KIND_GROUP[subject.kind] ?? null,
    family,
    field,
    status,
    source_locator: `${subject.display}#${field}`,
    span: subject.span,
    reason: status === "blocked" ? `The declared ${field} relation slot is not a supported static ${shape}.` : null,
    hint: status === "blocked" ? `Inspect ${subject.display} and preserve ${field}; the index cannot enumerate its ${family} edges.` : null
  });
}

function recordSyntheticRelationSite(sites, subject, family) {
  sites.push({
    source_id: subject.id,
    source_kind: subject.kind,
    source_group: SPEC_SOURCE_KIND_GROUP[subject.kind] ?? null,
    family,
    field: "<property-key>",
    status: "decoded",
    source_locator: subject.display,
    span: subject.span,
    reason: null,
    hint: null
  });
}

function inspectStaticPath(value, path) {
  let current = value;
  for (const part of path) {
    if (!current || typeof current !== "object" || Array.isArray(current)) return { status: "blocked", value: current };
    if (!Object.hasOwn(current, part)) return { status: "absent", value: undefined };
    current = current[part];
  }
  return { status: current === undefined || containsUndefined(current) ? "blocked" : "present", value: current };
}

function containsUndefined(value) {
  if (value === undefined) return true;
  if (Array.isArray(value)) return value.some(containsUndefined);
  if (value && typeof value === "object") return Object.values(value).some(containsUndefined);
  return false;
}

function relationSlotShape(value, shape) {
  if (shape === "string") return typeof value === "string";
  if (shape === "string-array") return Array.isArray(value) && value.every((item) => typeof item === "string");
  if (shape === "array") return Array.isArray(value);
  if (shape === "effect-plan") return Array.isArray(value) && value.every((item) => typeof item === "string" || (Array.isArray(item) && typeof item[0] === "string" && isRecord(item[1])));
  if (shape === "effect-branches") return isRecord(value) && Object.values(value).every((plan) => relationSlotShape(plan, "effect-plan"));
  return false;
}

function addObservationReads(builder, subject, reads, kind, sourceLocator) {
  for (const [ordinal, field] of (Array.isArray(reads) ? reads : []).entries()) {
    builder.addRelation(subject.id, `spec:OBSERVATIONS/${field}`, kind, { basis: "declared", source_locator: sourceLocator, ordinal });
  }
}

function addEffectPlanRelations(builder, subject, plan, planName) {
  if (!Array.isArray(plan)) return;
  for (const [ordinal, effect] of plan.entries()) {
    if (!Array.isArray(effect)) continue;
    const [verb, args] = effect;
    if (!args || typeof args !== "object" || Array.isArray(args)) continue;
    const common = { basis: "declared", source_locator: subject.display, ordinal, note: `plan=${planName}; verb=${verb}` };
    if (args.artifact) builder.addRelation(subject.id, `spec:ARTIFACTS/${args.artifact}`, "uses-artifact", common);
    if (args.template) builder.addRelation(subject.id, `spec:TEMPLATES/${args.template}`, "uses-template", common);
    if (args.format) builder.addRelation(subject.id, `spec:FORMATS/${args.format}`, "uses-format", common);
    if (verb === "DISPATCH" && args.role) builder.addRelation(subject.id, `spec:ROLES/${args.role}`, "dispatches-role", common);
    for (const field of ["path", "reference"]) if (typeof args[field] === "string") {
      builder.addRelation(subject.id, `file:${args[field]}`, "literal-path-candidate", { ...common, basis: "candidate-literal", note: `${common.note}; ${field} is rendered text, not declaration authority` });
    }
  }
}

function addActorRelation(builder, subject, actor, kind, sourceLocator, ordinal = null) {
  if (typeof actor !== "string") return;
  const match = actor.match(/^(stage|guard|role)\.(.+)$/);
  if (match) {
    const group = { stage: "STAGES", guard: "GUARDS", role: "ROLES" }[match[1]];
    builder.addRelation(subject.id, `spec:${group}/${match[2]}`, kind, { basis: "declared", source_locator: sourceLocator, ordinal });
    return;
  }
  const endpoint = builder.addExternalSubject("actor", actor, "Artifact actor is a declared endpoint; external/project actors are outside package inventory.");
  builder.addRelation(subject.id, { id: endpoint.id }, kind, { basis: "declared", source_locator: sourceLocator, ordinal });
}

function addFixtureRelations(builder) {
  for (const subject of builder.find((item) => item.kind === "scenario-fixture")) {
    const fixture = builder.value(subject);
    for (const [ordinal, token] of (Array.isArray(fixture?.cover) ? fixture.cover : []).entries()) {
      const target = coverageTarget(builder, token);
      builder.addRelation(subject.id, target, "declares-cover", { basis: "declared", source_locator: subject.display, ordinal, note: token });
    }
    if (fixture?.expect?.stage) builder.addRelation(subject.id, `spec:STAGES/${fixture.expect.stage}`, "declares-stage-expectation", { basis: "declared", source_locator: subject.display });
  }
}

function coverageTarget(builder, token) {
  const text = String(token);
  const colon = text.indexOf(":");
  const kind = colon < 0 ? text : text.slice(0, colon);
  const rest = colon < 0 ? "" : text.slice(colon + 1);
  if (kind === "stage") return `spec:STAGES/${rest}`;
  if (kind === "guard" || kind === "guard-pending") return `spec:GUARDS/${rest}`;
  if (kind === "row") {
    const [table, row] = rest.split("/", 2);
    return `spec:TABLES/${table}/${row}`;
  }
  if (kind === "branch") {
    const [owner, branch] = rest.split("/", 2);
    const row = builder.find((subject) => subject.locator === `spec:TABLES/${owner}/${branch}`)[0];
    if (row) return { id: row.id };
    const stage = builder.find((subject) => subject.locator === `spec:STAGES/${owner}`)[0];
    if (stage) return { id: stage.id };
    return `spec:TABLES/${owner}/${branch}`;
  }
  if (kind === "unless") {
    const [guard] = rest.split("/", 1);
    return `spec:GUARDS/${guard}`;
  }
  return `coverage:${token}`;
}

function addManifestRelations(builder, manifest, inventory) {
  if (!manifest || !builder.find((subject) => subject.id === "file:.generated.json").length) return;
  for (const [path] of recordEntries(manifest.generated_files)) {
    builder.addRelation("file:.generated.json", `file:${path}`, "generated-owner", { basis: "recorded-manifest", source_locator: ".generated.json:generated_files" });
  }
  for (const [path] of recordEntries(manifest.content)) {
    builder.addRelation("file:.generated.json", `file:${path}`, "records-content-hash", { basis: "recorded-manifest", source_locator: ".generated.json:content" });
  }
  if (!inventory.complete) builder.addRelation("file:.generated.json", "inventory:partial", "manifest-assessment-frontier", { basis: "derived", source_locator: ".generated.json" });
}

function addGenericPathCandidates(builder, entries) {
  const pattern = /(?:references|templates|fixtures|scripts|collectors|schemas|agents)\/[A-Za-z0-9_.\-/ ]+?\.(?:md|json|mjs|cjs|js|ya?ml)(?:#[A-Za-z0-9_.:-]+)?/g;
  for (const entry of entries) {
    if (!entry.text) continue;
    for (const match of entry.text.matchAll(pattern)) {
      const raw = match[0];
      const target = raw.split("#", 1)[0].trim();
      if (target === entry.path) continue;
      const owner = builder.nearestSourceSubject(entry.path, match.index);
      builder.addRelation(owner.id, `file:${target}`, "literal-path-candidate", {
        basis: "candidate-literal",
        source_locator: sourceDisplay(entry, match.index, match.index + raw.length),
        note: "Literal source text; not automatically a runtime-owned reference."
      });
    }
  }
}

function addQueryTextSubjects(builder, entries, queryInput) {
  const query = queryInput === null || queryInput === undefined ? "" : String(queryInput).trim();
  if (!query || exactQueryKind(query)) return { total: 0, provided: 0, omitted: 0 };
  const needle = query.toLowerCase();
  let total = 0;
  let provided = 0;
  for (const entry of entries) {
    if (!entry.text) continue;
    const lower = entry.text.toLowerCase();
    let cursor = 0;
    while (true) {
      const start = lower.indexOf(needle, cursor);
      if (start < 0) break;
      const end = start + query.length;
      total += 1;
      if (provided < 24) {
        const windowStart = Math.max(0, entry.text.lastIndexOf("\n", Math.max(0, start - 320)) + 1);
        const nextBreak = entry.text.indexOf("\n", Math.min(entry.text.length, end + 640));
        const windowEnd = nextBreak < 0 ? Math.min(entry.text.length, end + 640) : nextBreak;
        const subject = sourceSubject(
          entry,
          { start, end },
          "source-text-hit",
          query,
          null,
          entry.text.slice(windowStart, windowEnd),
          { query, match: entry.text.slice(start, end), context_span: { start: windowStart, end: windowEnd } },
          "snapshot-local"
        );
        builder.addSubject(subject);
        builder.addRelation(subject.id, { id: `file:${entry.path}` }, "contained-in", { basis: "derived-text-match", source_locator: subject.display });
        provided += 1;
      }
      cursor = Math.max(end, start + 1);
    }
  }
  return { total, provided, omitted: Math.max(0, total - provided) };
}

function shouldExtractGenericSource(entry, queryInput) {
  if (!entry.generated) return true;
  const query = queryInput === null || queryInput === undefined ? "" : String(queryInput).trim();
  if (!query.startsWith("file:")) return false;
  return query.slice(5) === entry.path;
}

function assessManifest(manifest, inventory, entryByPath) {
  if (!manifest) return { status: "not-present", schema: null, recorded_versions: null, path_hashes: { matched: 0, mismatched: [], missing: [], unsafe: [] }, aggregate_integrity: "not-assessed" };
  const result = { matched: 0, mismatched: [], missing: [], unsafe: [] };
  const compare = (path, expected, group) => {
    if (!isPortablePath(path)) {
      result.unsafe.push({ path, group });
      return;
    }
    const entry = entryByPath.get(path);
    if (!entry?.hash) result.missing.push({ path, group });
    else if (entry.hash !== expected) result.mismatched.push({ path, group, expected, actual: entry.hash });
    else result.matched += 1;
  };
  for (const [path, expected] of recordEntries(manifest.generated_files)) compare(path, expected, "generated_files");
  for (const [path, expected] of recordEntries(manifest.content)) compare(path, expected, "content");
  if (manifest.spec_hash) compare("spec.mjs", manifest.spec_hash, "spec_hash");
  const supported = manifest.schema === "skill-rails/build-manifest/1";
  const noMismatch = supported && inventory.complete && result.mismatched.length === 0 && result.missing.length === 0 && result.unsafe.length === 0;
  return {
    status: !supported ? "unsupported-recorded-schema" : noMismatch ? "recorded-path-hashes-match-captured-bytes" : "recorded-path-hash-mismatch-or-partial",
    schema: manifest.schema ?? null,
    recorded_versions: { runtime_version: manifest.runtime_version ?? null, validator_version: manifest.validator_version ?? null, minimum_node_major: manifest.minimum_node_major ?? null },
    recorded_build_id: manifest.build_id ?? null,
    path_hashes: result,
    aggregate_integrity: "not-assessed-with-current-inspector-constants",
    note: "Recorded safe path hashes are compared to the captured inventory. runtime_hash, validator_hash, content_hash and build_id are not recomputed by describe."
  };
}

function evidenceSummary(manifest, semanticDiff, manifestAssessment) {
  const fixtureCount = Number(manifest?.evidence?.fixtures?.total ?? 0);
  const mutationCount = Number(manifest?.evidence?.mutations?.total ?? 0);
  const evidence = manifest?.evidence ?? null;
  return {
    definitions: "Fixture and eval subjects are declarations until linked to an applicable execution receipt.",
    build_manifest: {
      status: manifest ? manifestAssessment.status : "not-present",
      authority: manifest ? `recorded builder scope only; fixtures=${fixtureCount}, mutations=${mutationCount}; not fresh-agent or public-effect proof` : "UNPROVEN",
      recorded_summary: evidence ? {
        lint: evidence.lint ?? null,
        fixtures: summarizeCountReceipt(evidence.fixtures),
        mutations: summarizeCountReceipt(evidence.mutations, ["survivors"]),
        formats: summarizeCountReceipt(evidence.formats),
        isolated_import: typeof evidence.isolated_import === "string" || typeof evidence.isolated_import === "boolean" ? evidence.isolated_import : compactValue(evidence.isolated_import, 4),
        build_timestamp: evidence.build_timestamp ?? null
      } : null,
      recorded_build_id: manifest?.build_id ?? null
    },
    semantic_diff: {
      status: semanticDiff ? "recorded-change-receipt" : "not-present",
      authority: "change receipt only; it does not attest test execution, host authority, or fresh-agent behavior",
      summary: semanticDiff ? summarizeSemanticDiff(semanticDiff) : null
    },
    fresh_agent: { status: "UNPROVEN-by-package-inventory", authority: "requires a separate applicable forward-run receipt" },
    external_runtime_receipts: { status: "frontier", authority: "runtime traces are deliberately outside the installed package and observed project" }
  };
}

function collectFrontiers({ entries, issues, builder, staticSpec, specEntry, manifest, moduleExtraction }) {
  const frontiers = [];
  for (const item of issues) frontiers.push({ kind: item.code, source: item.path, consequence: item.consequence, message: item.message });
  for (const entry of entries.filter((item) => ["oversize", "opaque", "unreadable", "unsupported"].includes(item.handling))) {
    frontiers.push({ kind: `${entry.handling}-content`, source: entry.path, consequence: entry.handling === "opaque" ? "medium" : "high", message: `${entry.handling} content was not semantically extracted.` });
  }
  for (const relation of builder.relations.filter((item) => item.resolution === "unresolved" || item.resolution === "ambiguous")) {
    frontiers.push({ kind: `relation-${relation.resolution}`, source: relation.source_locator ?? relation.from, consequence: relation.kind === "targets" || relation.kind === "names-evidence" ? "high" : "medium", message: `${relation.kind} -> ${relation.target} is ${relation.resolution}.` });
  }
  const collector = entries.find((entry) => entry.path === "collectors/index.mjs");
  if (collector) frontiers.push({ kind: "dynamic-collector-implementation", source: collector.path, consequence: "high", message: "Collector code can compute observations and selected paths dynamically; static relation extraction does not prove its full read or consumer set." });
  if (moduleExtraction?.dynamic?.length) frontiers.push({ kind: "dynamic-import", source: moduleExtraction.dynamic[0], consequence: "medium", message: "At least one authored dynamic import was observed; only literal targets are linked and runtime dispatch remains outside this static scope." });
  if (specEntry && !staticSpec) frontiers.push({ kind: "spec-static-model-unavailable", source: "spec.mjs", consequence: "high", message: "No complete AST-backed static spec model exists; spec absence and value-derived relations remain unknown." });
  if (staticSpec?.ORDERS && Object.keys(staticSpec.ORDERS).length) frontiers.push({ kind: "orders-unconsumed", source: "spec.mjs", consequence: "medium", message: "ORDERS is reserved and not consumed by the version-5 runtime; names here do not earn enforcement credit." });
  if (manifest) frontiers.push({ kind: "outside-package-receipts", source: ".generated.json", consequence: "high", message: "Package inventory cannot exhaust external traces, host authority, or fresh-agent behavior receipts." });
  return dedupeObjects(frontiers);
}

function derivePurpose(intent, skillDocument, profileDecision, staticSpec) {
  const skillBody = skillDocument?.body ?? "";
  const paragraph = skillBody.split(/\r?\n\s*\r?\n/).map((item) => item.replace(/^#+\s+.*$/gm, "").trim()).find(Boolean) ?? null;
  const signals = Array.isArray(profileDecision?.signals) ? profileDecision.signals.map((item) => {
    if (!isRecord(item)) return String(item);
    return `${item.kind ?? "signal"} -> ${item.profile ?? "unknown"}${Number.isFinite(item.count) ? ` (${item.count})` : ""}`;
  }) : [];
  return {
    name: intent?.name ?? skillDocument?.frontmatter?.name ?? staticSpec?.SPEC?.id ?? null,
    description: intent?.description ?? skillDocument?.frontmatter?.description ?? null,
    problem: intent?.problem ?? paragraph,
    profile_reason: profileDecision?.explicit === true ? `explicit ${profileDecision.profile ?? "profile"}${signals.length ? `; observed signals: ${signals.join("; ")}` : ""}` : signals.join("; ") || null,
    profile_warning: typeof profileDecision?.warning === "string" ? profileDecision.warning : null,
    inputs: Array.isArray(intent?.inputs) ? intent.inputs : [],
    outputs: Array.isArray(intent?.outputs) ? intent.outputs : [],
    irreversible_boundaries: Array.isArray(intent?.irreversible_boundaries) ? intent.irreversible_boundaries : []
  };
}

function classifyPackage({ profileDecision, intent, specEntry, skillEntry, staticSpec, manifest }) {
  const declaredProfile = typeof profileDecision?.profile === "string" ? profileDecision.profile : null;
  const inferred = declaredProfile ?? (specEntry ? "p2-like" : intent && skillEntry ? "p0-or-p1-managed" : skillEntry ? "prose-skill" : null);
  const management = declaredProfile ? "skill-rails-managed" : specEntry || skillEntry ? "inspectable-without-current-management-declaration" : "unmanaged-directory";
  return {
    management,
    profile: inferred,
    profile_basis: declaredProfile ? ".skill-rails/profile-decision.json" : specEntry ? "package shape only" : skillEntry ? "SKILL.md presence only" : "unknown",
    spec_version: staticSpec?.SPEC?.version ?? null,
    manifest_schema: manifest?.schema ?? null,
    package_runtime_version: manifest?.runtime_version ?? null,
    package_validator_version: manifest?.validator_version ?? null
  };
}

function projectMaintenanceContext(model, queryInput, { staticSpec }) {
  const query = queryInput === null || queryInput === undefined ? null : String(queryInput).trim();
  const exact = query ? exactQueryKind(query) : null;
  const normalizedQuery = query ? normalizeSearchText(query) : null;
  let matches = [];
  let modeledMatchTotal = 0;
  if (query) {
    const allMatches = model.subjects.filter((subject) => {
      if (subject.locator === query || subject.id === query) return true;
      if (exact) return false;
      const haystack = `${subject.locator ?? ""}\n${subject.display ?? ""}\n${subject.name ?? ""}\n${subject.path ?? ""}\n${subject.text ?? ""}\n${JSON.stringify(subject.data ?? null)}`.toLowerCase();
      return normalizeSearchText(haystack).includes(normalizedQuery);
    }).sort(compareSubjectPriority);
    modeledMatchTotal = allMatches.length;
    matches = allMatches.slice(0, 24);
  } else {
    const preferred = model.subjects.filter((subject) => subject.kind === "obligation-atom" && subject.data?.consequence === "high");
    const owners = model.subjects.filter((subject) => ["intent-requirement", "spec-stage", "spec-guard", "body-section"].includes(subject.kind));
    const overview = [...preferred, ...owners];
    modeledMatchTotal = overview.length;
    matches = overview.slice(0, 16);
  }

  const finite = finiteScopeForQuery(exact, model, staticSpec, query);
  let status;
  let note = null;
  if (matches.length) status = "found";
  else if (!query) status = "found";
  else if (!exact) {
    status = "unknown";
    note = "A natural-language or substring miss never establishes absence.";
  } else if (!finite.valid) {
    status = "unknown";
    note = finite.note;
  } else if (finite.complete && model.snapshot.stable) {
    status = "absent-in-declared-scope";
    note = `No subject exists in the finite scope: ${finite.scope}. This says nothing about unextracted consumers, protections, or deletion safety.`;
  } else {
    status = "unknown";
    note = `The finite scope could not be completed on stable current bytes: ${finite.scope}.`;
  }

  const capsule = expandCapsule(model, matches);
  capsule.omitted.subjects += Math.max(0, modeledMatchTotal - matches.length) + (model.text_matches?.omitted ?? 0);
  const subjectById = new Map(model.subjects.map((subject) => [subject.id, subject]));
  const selectedIds = new Set(capsule.subjects.map((subject) => subject.id));
  const cutRelations = model.relations.filter((relation) => {
    if (!selectedIds.has(relation.from) || !relation.to || selectedIds.has(relation.to)) return false;
    const target = subjectById.get(relation.to);
    return target && !target.generated && ["targets", "reads", "unless-reads", "needs-judgment", "uses-body", "selects-table", "uses-template", "uses-format", "uses-artifact", "dispatches-role", "returns-template", "links", "imports"].includes(relation.kind);
  });
  const readContinuations = unique([
    ...capsule.subjects.filter((subject) => subject.path && !subject.generated && subject.kind !== "file").slice(0, 7).map((subject) => subject.display ?? subject.path),
    ...cutRelations.slice(0, 3).map((relation) => subjectLabel(subjectById.get(relation.to)) ?? relation.target)
  ].filter(Boolean)).slice(0, 8);
  const criticalGaps = unique([
    ...model.frontiers.filter((item) => item.consequence === "high").map((item) => `${item.kind} at ${item.source}: ${item.message}`),
    ...(capsule.omitted.subjects || capsule.omitted.relations ? [`Capsule truncated: subjects omitted=${capsule.omitted.subjects}, relations omitted=${capsule.omitted.relations}.`] : []),
    ...(!model.snapshot.stable ? ["Source changed during analysis; no negative conclusion is current."] : [])
  ]);
  const relevantExtraction = Object.values(model.assessment.extraction).filter((item) => item.status !== "not-present");
  const extractionStatus = !model.snapshot.stable ? "changed" : relevantExtraction.some((item) => item.status === "partial") ? "partial" : "complete-for-declared-scope";
  const relationCoverage = assessRelationCoverage({ model, exact, queryStatus: status, matches, capsule });
  const nextInvocation = describeInvocation(model.snapshot.root, query ?? matches[0]?.locator ?? null);
  const next = {
    read: unique([
      ...relationCoverage.blockers.map((item) => item.hint).filter(Boolean),
      ...(readContinuations.length ? readContinuations : ["Open the first canonical source named by the inventory; no complete subject was selected."])
    ]).slice(0, 12),
    constraints: ownershipGuidance(capsule.subjects),
    change: relationCoverage.status === "closed" ? changeGuidance(matches, model.classification.profile) : [],
    verify: verifyGuidance(model.snapshot.root, model.classification.profile)
  };

  const capsuleRelations = capsule.relations.map((relation) => projectCapsuleRelation(relation, subjectById));
  const selectedSubjects = capsule.subjects.map(projectCapsuleSubject);
  const nativeLocatorSubjects = model.subjects.filter((subject) => subject.locator);
  const compactDiscovery = Boolean(query && status === "found");
  const catalogSubjects = compactDiscovery ? capsule.subjects.filter((subject) => subject.locator) : nativeLocatorSubjects;
  const output = {
    schema: model.schema,
    preview: model.preview,
    snapshot: model.snapshot,
    classification: model.classification,
    purpose: model.purpose,
    summary: {
      extraction_status: extractionStatus,
      scope: "Only the listed inventory and extractor families; all-package semantic and consumer completeness is not assessed.",
      critical_gaps: criticalGaps,
      omitted: capsule.omitted
    },
    query: {
      input: query,
      kind: exact ?? (query ? "normalized-natural-language-or-substring" : "overview"),
      match_basis: exact ? "exact-native-locator-or-source-id" : query ? "case-insensitive separator-normalized substring" : "representative overview owners",
      status,
      scope: finite.scope,
      note,
      modeled_match_count: modeledMatchTotal,
      provided_match_count: matches.length,
      source_text_scan: model.text_matches,
      matched_subjects: matches.map((subject) => ({ locator: subject.locator ?? subject.id, kind: subject.kind, display: subject.display }))
    },
    capsule: { subjects: selectedSubjects, relations: capsuleRelations, omitted: capsule.omitted },
    index: {
      scope: "Native locators and relation-family counts for discovery; query again for source-linked causal detail.",
      modeled_subject_count: model.subjects.length,
      modeled_relation_count: model.relations.length,
      native_locator_count: nativeLocatorSubjects.length,
      provided_locator_count: catalogSubjects.length,
      catalog_complete_for_native_locators: !compactDiscovery,
      locator_catalog: catalogSubjects.map((subject) => ({
        locator: subject.locator,
        kind: subject.kind,
        display: subject.display,
        identity: subject.identity,
        generated: subject.generated
      })),
      full_catalog_invocation: describeInvocation(model.snapshot.root, null),
      relation_families: relationFamilySummary(model.relations)
    },
    inventory: projectInventory(model.inventory, capsule.subjects, compactDiscovery, model.snapshot.root),
    assessment: { ...model.assessment, relation_coverage: relationCoverage },
    evidence: model.evidence,
    frontiers: model.frontiers,
    issues: model.issues,
    next,
    resume_key: {
      target_root_identity: model.snapshot.root_identity,
      original_task_or_intent_locator: query ?? matches[0]?.locator ?? "unknown",
      baseline_fingerprint: model.snapshot.source_basis,
      selected_subjects: selectedSubjects.slice(0, 16).map((subject) => ({ locator: subject.locator ?? subject.id, identity: subject.identity })),
      unresolved: unique([...criticalGaps, ...relationCoverage.blockers.map((item) => item.reason)]),
      next_invocation: nextInvocation
    },
    limits: model.limits
  };
  return output;
}

function expandCapsule(model, matches) {
  const subjectById = new Map(model.subjects.map((subject) => [subject.id, subject]));
  const selected = new Set();
  const selectedOrder = [];
  const relationSelection = new Set();
  const relationSemantics = new Set();
  const relationOrder = [];
  const candidateSubjects = new Set();
  const candidateRelations = new Set();
  const targetIds = (relation) => relation.to ? [relation.to] : relation.candidates;
  const addSubject = (id) => {
    if (!id || !subjectById.has(id)) return;
    candidateSubjects.add(id);
    if (selected.has(id) || selected.size >= MAX_CAPSULE_SUBJECTS) return;
    selected.add(id);
    selectedOrder.push(id);
  };
  const addRelation = (relation, { from = true, targets = true } = {}) => {
    const semanticKey = `${relation.from}\0${relation.kind}\0${relation.to ?? relation.target}\0${relation.ordinal ?? ""}`;
    candidateRelations.add(semanticKey);
    if (!relationSemantics.has(semanticKey) && relationSelection.size < MAX_CAPSULE_RELATIONS) {
      relationSemantics.add(semanticKey);
      relationSelection.add(relation.id);
      relationOrder.push(relation.id);
    }
    if (from) addSubject(relation.from);
    if (targets) for (const id of targetIds(relation)) addSubject(id);
  };

  const anchorIds = new Set();
  for (const subject of [...matches].sort(compareSubjectPriority).slice(0, MAX_CAPSULE_SUBJECTS)) {
    anchorIds.add(subject.id);
    addSubject(subject.id);
  }

  const structuralKinds = new Set([
    "reads", "unless-reads", "needs-judgment", "uses-body", "selects-table", "owns-row",
    "uses-template", "uses-template-file", "uses-format", "uses-artifact", "records-artifact", "records-format", "dispatches-role", "returns-template",
    "read-first-body", "read-first-file", "implemented-by-collector-module", "literal-path-candidate", "links", "imports",
    "declares-project-path", "writer", "reader", "declares-consumer", "owns-project-path"
  ]);
  const expandableCore = new Set(selected);
  for (let depth = 0; depth < 3; depth += 1) {
    const before = expandableCore.size;
    for (const relation of model.relations) {
      if (!structuralKinds.has(relation.kind) || !expandableCore.has(relation.from)) continue;
      const owner = subjectById.get(relation.from);
      if (!shouldExpandStructuralRelation(owner, relation, anchorIds)) continue;
      addRelation(relation);
      for (const id of targetIds(relation)) {
        const target = subjectById.get(id);
        if (target && (target.kind.startsWith("spec-") || target.kind === "body-section" || target.kind === "markdown-section")) expandableCore.add(id);
      }
    }
    if (expandableCore.size === before) break;
  }

  // Exact owners also need their declared consumers. Traverse only relation families whose
  // direction has a stable maintenance meaning; this is not a general call graph.
  const reverseTargets = new Set(anchorIds);
  const reverseOwners = new Set();
  for (let depth = 0; depth < 3; depth += 1) {
    const nextTargets = new Set();
    for (const relation of model.relations) {
      const targets = targetIds(relation);
      for (const id of targets) {
        const target = subjectById.get(id);
        if (!reverseTargets.has(id) || !roleIncomingKinds(target).has(relation.kind)) continue;
        const endpointOnly = ["spec-stage", "spec-guard"].includes(target.kind) && ["writer", "reader"].includes(relation.kind);
        addRelation(relation, { from: !endpointOnly });
        if (!endpointOnly) reverseOwners.add(relation.from);
        if (["spec-table", "spec-table-row"].includes(subjectById.get(relation.from)?.kind)) nextTargets.add(relation.from);
      }
    }
    if (!nextTargets.size) break;
    for (const id of nextTargets) reverseTargets.add(id);
  }
  for (const relation of model.relations) {
    const owner = subjectById.get(relation.from);
    if (anchorIds.has(relation.from) && roleOutgoingKinds(owner, anchorIds).has(relation.kind)) addRelation(relation);
    else if (reverseOwners.has(relation.from) && shouldExpandStructuralRelation(owner, relation, anchorIds)) addRelation(relation);
  }

  // A natural text hit may sit inside an authored helper or prose file. Include that file's
  // direct literal connections, but stop at their targets rather than treating a file as a graph hub.
  const contextFiles = new Set();
  for (const relation of model.relations) {
    if (relation.kind === "contained-in" && anchorIds.has(relation.from) && subjectById.get(relation.from)?.kind === "source-text-hit") {
      addRelation(relation);
      for (const id of targetIds(relation)) contextFiles.add(id);
    }
  }
  for (const relation of model.relations) {
    if (contextFiles.has(relation.from) && ["links", "imports", "literal-path-candidate"].includes(relation.kind)) addRelation(relation);
  }

  const obligationIds = new Set(matches.filter((subject) => subject.kind === "obligation-atom").map((subject) => subject.id));
  const exactObligationIds = new Set(obligationIds);
  const causalTargets = new Set([...expandableCore].filter((id) => isObligationLanding(subjectById.get(id), anchorIds)));
  for (const relation of model.relations) {
    if (relation.kind !== "targets" || !targetIds(relation).some((id) => causalTargets.has(id))) continue;
    obligationIds.add(relation.from);
    addRelation(relation);
  }
  for (const relation of model.relations) {
    if (!obligationIds.has(relation.from)) continue;
    if (!["originates-from", "names-evidence"].includes(relation.kind) && !(relation.kind === "targets" && exactObligationIds.has(relation.from))) continue;
    addRelation(relation);
  }

  const fixtureIds = new Set(matches.filter((subject) => ["scenario-fixture", "eval-case"].includes(subject.kind)).map((subject) => subject.id));
  for (const relation of model.relations) {
    if (!["declares-cover", "declares-stage-expectation"].includes(relation.kind)) continue;
    if (targetIds(relation).some((id) => expandableCore.has(id))) {
      fixtureIds.add(relation.from);
      addRelation(relation);
    }
  }
  for (const relation of model.relations) {
    if (anchorIds.has(relation.from) && fixtureIds.has(relation.from) && ["declares-cover", "declares-stage-expectation"].includes(relation.kind)) addRelation(relation);
  }

  // Source containers help a maintainer open the exact owner but are terminal here.
  for (const relation of model.relations) {
    if (relation.kind === "contained-in" && selected.has(relation.from)) addRelation(relation);
  }

  const relationsById = new Map(model.relations.map((relation) => [relation.id, relation]));
  const subjects = selectedOrder.map((id) => subjectById.get(id)).filter(Boolean);
  const relations = relationOrder.map((id) => relationsById.get(id)).filter(Boolean);
  return {
    subjects,
    relations,
    omitted: {
      subjects: Math.max(0, matches.length - Math.min(matches.length, MAX_CAPSULE_SUBJECTS)) + Math.max(0, candidateSubjects.size - selected.size),
      relations: Math.max(0, candidateRelations.size - relations.length)
    }
  };
}

function finiteScopeForQuery(kind, model, staticSpec, query) {
  if (!kind) return { valid: true, complete: false, scope: "natural-language discovery has no finite absence universe", note: null };
  if (kind === "file") return { valid: true, complete: model.inventory.complete, scope: model.inventory.scope, note: null };
  const family = {
    spec: "spec",
    body: kind.startsWith("body") ? kind.slice(5) || "body.md" : null,
    fixture: "scenario-fixtures",
    eval: "eval-cases",
    atom: "obligation-ledger",
    intent: "intent"
  }[kind];
  if (kind === "source") return { valid: true, complete: model.snapshot.stable, scope: "exact snapshot-local source subject identity", note: null };
  if (!family) return { valid: false, complete: false, scope: "unrecognized exact query", note: "The query prefix is not a declared finite locator family." };
  if (kind === "spec") {
    const raw = query?.slice(5);
    const resolved = raw && staticSpec ? resolveSpecLocator(staticSpec, raw) : null;
    if (resolved && (!resolved.recognized || !resolved.shape)) return { valid: false, complete: false, scope: "accepted L16 spec locators", note: "The query is not a valid accepted L16 spec locator shape." };
    const group = raw?.split("/", 1)[0];
    const groupScope = model.spec_groups?.[group];
    return {
      valid: Boolean(resolved?.recognized && resolved?.shape),
      complete: groupScope?.status === "complete-for-declared-scope",
      scope: groupScope?.scope ?? `literal keys in ${group ?? "the addressed spec group"}`,
      note: groupScope?.issues?.[0] ?? null
    };
  }
  const entry = Object.entries(model.assessment.extraction).find(([key]) => key === family || (kind.startsWith("body") && key.startsWith("body:")))?.[1];
  return { valid: true, complete: entry?.status === "complete-for-declared-scope", scope: entry?.scope ?? family, note: null };
}

function exactQueryKind(query) {
  if (query.startsWith("file:")) return "file";
  if (query.startsWith("spec:")) return "spec";
  if (query.startsWith("body:")) return "body";
  if (query.startsWith("fixture:")) return "fixture";
  if (query.startsWith("eval:")) return "eval";
  if (query.startsWith("atom:")) return "atom";
  if (query.startsWith("intent:")) return "intent";
  if (query.startsWith("source:")) return "source";
  return null;
}

function assessRelationCoverage({ model, exact, queryStatus, matches, capsule }) {
  const base = {
    status: "discovery-only",
    scope: "Exact one-owner queries can close only the supported explicit relation envelope; this is not whole-impact, runtime, deletion, or semantic-edit authority.",
    source_basis: model.snapshot.source_basis,
    owner_ids: matches.map((subject) => subject.id),
    required_families: { outgoing: [], incoming: [] },
    families: [],
    blockers: []
  };
  if (!exact || queryStatus !== "found") return base;
  if (matches.length !== 1) {
    return { ...base, status: "blocked", blockers: [coverageBlocker("ambiguous-owner", matches[0], null, "The exact locator does not identify exactly one current source owner.", "Query one collision-free source:... id from the returned candidates.")] };
  }
  const owner = matches[0];
  const outgoing = SPEC_KIND_RELATION_FAMILIES[owner.kind]
    ?? (owner.kind === "obligation-atom" ? ["originates-from", "targets", "names-evidence"] : owner.kind === "scenario-fixture" ? ["declares-cover", "declares-stage-expectation"] : []);
  const incoming = DECLARED_INCOMING_BY_KIND[owner.kind] ?? [];
  const supported = outgoing.length > 0 || incoming.length > 0;
  if (!supported) return base;

  const blockers = [];
  if (!model.snapshot.stable) blockers.push(coverageBlocker("unstable-source", owner, null, "Source bytes changed while relation coverage was assessed.", "Rerun the saved exact describe query on stable current bytes."));
  if (owner.identity === "native-ambiguous") blockers.push(coverageBlocker("ambiguous-owner-identity", owner, null, "The owner shares its native locator with another source occurrence.", "Use the collision-free source id and resolve the duplicate native locator before relying on incoming relations."));
  for (const item of requiredOwnerExtraction(model, owner)) if (item.status !== "complete-for-declared-scope") {
    blockers.push(coverageBlocker("owner-source-incomplete", owner, null, `${item.name} is ${item.status}; the owner universe is not closed.`, `Inspect ${item.scope} and resolve: ${item.issues?.[0] ?? "incomplete deterministic extraction"}.`));
  }

  const selectedRelationIds = new Set(capsule.relations.map((relation) => relation.id));
  const requirements = [
    ...outgoing.map((family) => ({ family, direction: "outgoing" })),
    ...incoming.map((family) => ({ family, direction: "incoming" }))
  ];
  const families = [];
  for (const requirement of requirements) {
    const sourceKinds = sourceKindsForRelationFamily(requirement.family);
    const sourceUniverses = requirement.direction === "outgoing"
      ? ["queried-owner"]
      : relationSourceUniverseLabels(requirement.family, sourceKinds);
    const sites = requirement.direction === "outgoing"
      ? model.relation_sites.filter((site) => site.source_id === owner.id && site.family === requirement.family)
      : model.relation_sites.filter((site) => sourceKinds.includes(site.source_kind) && site.family === requirement.family);

    if (requirement.direction === "outgoing" && SPEC_KIND_RELATION_FAMILIES[owner.kind] && sites.length === 0) {
      blockers.push(coverageBlocker("missing-source-site", owner, requirement.family, `No deterministic source-site accounting exists for required ${requirement.family} relations.`, `Inspect ${owner.display}; do not infer that ${requirement.family} is absent.`));
    }
    if (requirement.direction === "incoming") {
      for (const source of incompleteRelationSourceUniverses(model, requirement.family, sourceKinds)) {
        blockers.push(coverageBlocker("source-universe-incomplete", owner, requirement.family, `${source.name} is ${source.status}; incoming ${requirement.family} consumers are not exhaustively enumerable.`, `Inspect ${source.scope} and resolve: ${source.issues?.[0] ?? "incomplete deterministic extraction"}.`));
      }
    }
    for (const site of sites.filter((item) => item.status === "blocked")) {
      blockers.push({ code: "unresolved-relation-site", family: requirement.family, source_id: site.source_id, source_locator: site.source_locator, span: site.span, reason: site.reason, hint: site.hint });
    }

    const relevantRelations = model.relations.filter((relation) => {
      if (relation.kind !== requirement.family) return false;
      if (requirement.direction === "outgoing") return relation.from === owner.id;
      return relation.to === owner.id || relation.target === owner.locator || relation.candidates?.includes(owner.id);
    });
    for (const relation of relevantRelations.filter((item) => item.resolution !== "resolved")) {
      blockers.push(coverageBlocker(`relation-${relation.resolution}`, owner, requirement.family, `${relation.source_locator ?? relation.from} has a ${relation.resolution} ${requirement.family} target.`, `Inspect ${relation.source_locator ?? relation.from} and make the declared target unambiguous.`));
    }
    const supplementalRelations = relevantRelations.filter((relation) => !selectedRelationIds.has(relation.id));
    const omittedRelations = supplementalRelations.slice(12);
    if (omittedRelations.length) {
      blockers.push(coverageBlocker("required-output-cut", owner, requirement.family, `Required ${requirement.family} context was cut: relations=${omittedRelations.length}.`, "Run a narrower exact query or increase the owning bounded projection before planning the change."));
    }
    families.push({
      kind: requirement.family,
      direction: requirement.direction,
      finite_source_universe: sourceUniverses,
      source_sites: sites.length,
      unresolved_sites: sites.filter((item) => item.status === "blocked").length,
      provided_relations: relevantRelations.length - omittedRelations.length,
      omitted_relations: omittedRelations.length,
      supplemental_relations: supplementalRelations.slice(0, 12).map((relation) => ({ source_locator: relation.source_locator, resolution: relation.resolution }))
    });
  }
  const reportedFamilies = families.filter((item) => item.unresolved_sites || item.supplemental_relations.length || item.omitted_relations);
  return {
    ...base,
    status: blockers.length ? "blocked" : "closed",
    owner_ids: [owner.id],
    required_families: { outgoing, incoming },
    closed_family_count: families.length - new Set(blockers.map((item) => item.family).filter(Boolean)).size,
    families: reportedFamilies,
    blockers: dedupeObjects(blockers)
  };
}

function requiredOwnerExtraction(model, owner) {
  const items = [];
  const add = (name, value) => items.push({ name, status: value?.status ?? "not-present", scope: value?.scope ?? name, issues: value?.issues ?? [] });
  const group = SPEC_SOURCE_KIND_GROUP[owner.kind];
  if (group) add(`spec.${group}`, model.spec_groups?.[group]);
  else if (owner.kind === "body-section") add(`body:${owner.path}`, model.assessment.extraction[`body:${owner.path}`]);
  else if (owner.kind === "intent-requirement") {
    add("intent", model.assessment.extraction.intent);
    if (["p0", "p1"].includes(model.classification.profile)) add("simple-projections", model.assessment.extraction["simple-projections"]);
  } else if (owner.kind === "obligation-atom") add("obligation-ledger", model.assessment.extraction["obligation-ledger"]);
  else if (owner.kind === "scenario-fixture") add("scenario-fixtures", model.assessment.extraction["scenario-fixtures"]);
  return items;
}

function sourceKindsForRelationFamily(family) {
  return Object.entries(SPEC_KIND_RELATION_FAMILIES).filter(([, families]) => families.includes(family)).map(([kind]) => kind);
}

function relationSourceUniverseLabels(family, sourceKinds) {
  const labels = unique(sourceKinds.map((kind) => `spec.${SPEC_SOURCE_KIND_GROUP[kind]}`));
  if (["originates-from", "targets", "names-evidence"].includes(family)) labels.push("obligation-ledger");
  if (["declares-cover", "declares-stage-expectation"].includes(family)) labels.push("scenario-fixtures");
  return unique(labels);
}

function incompleteRelationSourceUniverses(model, family, sourceKinds) {
  const sources = [];
  for (const group of unique(sourceKinds.map((kind) => SPEC_SOURCE_KIND_GROUP[kind]).filter(Boolean))) {
    const value = model.spec_groups?.[group];
    if (value?.status !== "complete-for-declared-scope") sources.push({ name: `spec.${group}`, status: value?.status ?? "not-present", scope: value?.scope ?? `spec.${group}`, issues: value?.issues ?? [] });
  }
  const addExtraction = (name) => {
    const value = model.assessment.extraction[name];
    if (value?.status !== "complete-for-declared-scope") sources.push({ name, status: value?.status ?? "not-present", scope: value?.scope ?? name, issues: value?.issues ?? [] });
  };
  if (["originates-from", "targets", "names-evidence"].includes(family)) addExtraction("obligation-ledger");
  if (["declares-cover", "declares-stage-expectation"].includes(family)) addExtraction("scenario-fixtures");
  return sources;
}

function coverageBlocker(code, owner, family, reason, hint) {
  return { code, family, source_id: owner?.id ?? null, source_locator: owner?.display ?? null, span: owner?.span ?? null, reason, hint };
}

function changeGuidance(subjects, profile) {
  const canonical = subjects.filter((subject) => !subject.generated && ["intent-requirement", "spec-stage", "spec-guard", "spec-table-row", "body-section", "obligation-atom"].includes(subject.kind));
  const result = [];
  for (const item of canonical.slice(0, 6)) result.push(`${item.display ?? item.locator} is a current source candidate; preserve incoming obligations and protection context before editing.`);
  if (String(profile).startsWith("p1")) result.push("A separately authored P1 helper is not an intent projection; maintain its code and golden tests at their own owner.");
  if (!result.length) result.push("No safe canonical edit owner was established by this bounded result; read the exact continuation first.");
  return unique(result);
}

function ownershipGuidance(subjects) {
  const generated = subjects.filter((subject) => subject.generated);
  if (!generated.length) return [];
  const paths = unique(generated.map((item) => item.path).filter(Boolean));
  const examples = paths.slice(0, 3).join(", ");
  return [`Do not hand-edit ${paths.length} generated match${paths.length === 1 ? "" : "es"}; locate the creator-owned source and rebuild${examples ? `. Examples: ${examples}` : ""}.`];
}

function verifyGuidance(root, profile) {
  const quotedRoot = quoteCommandArg(root);
  if (String(profile).startsWith("p2")) return [
    `node "<skill-root>/scripts/lint.mjs" --skill ${quotedRoot} --full --json`,
    `node "<skill-root>/scripts/build.mjs" --skill ${quotedRoot} --json`,
    `node "<skill-root>/scripts/eval.mjs" --skill ${quotedRoot}`,
    "Treat missing applicable fresh-agent or host-authority evidence as UNPROVEN."
  ];
  return [`node "<skill-root>/scripts/lint.mjs" --skill ${quotedRoot} --json`, `node "<skill-root>/scripts/eval.mjs" --skill ${quotedRoot}`, "Verify authored helper behavior separately from generated intent projections."];
}

function describeInvocation(root, query) {
  return `node "<skill-root>/scripts/maintain.mjs" --skill ${quoteCommandArg(root)} --describe${query ? ` --query ${quoteCommandArg(query)}` : ""} --json`;
}

function ownerSummary(value) {
  const rows = [];
  if (value.inventory.entries.some((entry) => entry.path === ".skill-rails/intent.json")) rows.push({ area: "purpose and requirements", source: ".skill-rails/intent.json", meaning: "canonical user intent" });
  if (value.inventory.entries.some((entry) => entry.path === ".skill-rails/obligation-ledger.json")) rows.push({ area: "traceability", source: ".skill-rails/obligation-ledger.json", meaning: "atom membership; not behavior or proof" });
  if (value.inventory.entries.some((entry) => entry.path === "spec.mjs")) rows.push({ area: "P2 behavior", source: "spec.mjs", meaning: "sole behavior source" });
  if (value.inventory.entries.some((entry) => entry.path === "body.md")) rows.push({ area: "judgment and rationale", source: "body.md", meaning: "attributed current prose" });
  if (value.inventory.entries.some((entry) => entry.path === "collectors/index.mjs")) rows.push({ area: "observation", source: "collectors/index.mjs", meaning: "dynamic fact collection; no policy" });
  if (value.inventory.entries.some((entry) => entry.path.startsWith("templates/"))) rows.push({ area: "exact output shape", source: "templates/", meaning: "template-owned shape" });
  if (value.inventory.entries.some((entry) => entry.path.startsWith("references/"))) rows.push({ area: "selected context", source: "references/", meaning: "explicit prose consumers and candidates" });
  if (value.inventory.entries.some((entry) => entry.path.startsWith("fixtures/"))) rows.push({ area: "verification definition", source: "fixtures/", meaning: "declared cases; not current pass" });
  if (value.inventory.entries.some((entry) => entry.path === ".generated.json")) rows.push({ area: "generated ownership", source: ".generated.json", meaning: "recorded bytes and builder evidence scope" });
  if (value.inventory.entries.some((entry) => entry.path === "scripts/skill-rails/run.mjs" && entry.generated)) rows.push({ area: "using-agent runtime", source: "scripts/skill-rails/run.mjs", meaning: "generated consumer of the canonical P2 spec and body" });
  if (value.inventory.entries.some((entry) => entry.projection?.owner === ".skill-rails/intent.json")) rows.push({ area: "P0/P1 using-agent entry", source: "SKILL.md and agents/openai.yaml", meaning: "intent-derived projections; rebuild from intent" });
  if (value.inventory.entries.some((entry) => entry.path === "scripts/run.mjs" && !entry.generated)) rows.push({ area: "P1 helper", source: "scripts/run.mjs", meaning: "separately authored deterministic helper" });
  return rows;
}

function representativeMaintenanceChain(value) {
  const atom = value.capsule.subjects.find((subject) => subject.kind === "obligation-atom" && subject.data?.consequence === "high")
    ?? value.capsule.subjects.find((subject) => subject.kind === "obligation-atom");
  if (!atom) return [
    "1. Query an exact locator or interest with the read-only command below.",
    "2. Open the returned owner and bounded incoming consumers; unresolved edges remain gaps.",
    "3. Change the canonical owner, rebuild its projections, and run the named checks on current bytes."
  ];
  const fromAtom = value.capsule.relations.filter((relation) => relation.from_id === atom.id);
  const origin = fromAtom.find((relation) => relation.kind === "originates-from");
  const target = fromAtom.find((relation) => relation.kind === "targets");
  const evidence = fromAtom.find((relation) => relation.kind === "names-evidence");
  const fixture = target ? value.capsule.relations.find((relation) => ["declares-cover", "declares-stage-expectation"].includes(relation.kind) && relation.to_id === target.to_id) : null;
  return [
    `1. Requirement/provenance: ${origin?.to_label ?? atom.data?.source ?? "unresolved"} -> ${atom.locator ?? atom.id} (${atom.data?.consequence ?? "unknown"} consequence).`,
    `2. Current owner/landing: ${target?.to_label ?? "unresolved; follow the reported gap"}.`,
    `3. Declared check definition: ${fixture?.from_label ?? evidence?.to_label ?? "unresolved; definition membership is not execution proof"}.`,
    `4. Receipt boundary: ${value.evidence.build_manifest.status}; ${value.evidence.build_manifest.authority}. Rebuild and re-run the named verification before completion.`
  ];
}

function summarizeIntent(value, field) {
  const items = value.purpose[field] ?? [];
  return items.length ? items.slice(0, 3).join("; ") : "unknown in current bounded sources";
}

function summarizeCountReceipt(value, extraKeys = []) {
  if (!value || typeof value !== "object") return value ?? null;
  const keys = ["status", "passed", "total", "mismatches", "deterministic_repeats", "predicate_evaluations", "round_trips", ...extraKeys];
  return Object.fromEntries(keys.filter((key) => Object.hasOwn(value, key)).map((key) => [key, compactValue(value[key])]));
}

function summarizeSemanticDiff(value) {
  if (!value || typeof value !== "object") return null;
  const summary = {};
  for (const [key, item] of Object.entries(value)) {
    if (Array.isArray(item)) summary[key] = { count: item.length, examples: item.slice(0, 5).map((entry) => compactValue(entry, 4)) };
    else if (item && typeof item === "object") summary[key] = compactValue(item, 4);
    else summary[key] = item;
  }
  return compactValue(summary, 4);
}

function relationFamilySummary(relations) {
  const families = new Map();
  for (const relation of relations) {
    const value = families.get(relation.kind) ?? { kind: relation.kind, total: 0, resolved: 0, ambiguous: 0, unresolved: 0 };
    value.total += 1;
    if (Object.hasOwn(value, relation.resolution)) value[relation.resolution] += 1;
    families.set(relation.kind, value);
  }
  return [...families.values()].sort((left, right) => left.kind.localeCompare(right.kind));
}

function projectInventory(inventory, subjects, compact, root) {
  if (!compact) return { ...inventory, catalog_complete: true, entry_count: inventory.entries.length, provided_entry_count: inventory.entries.length };
  const selectedPaths = new Set(subjects.map((subject) => subject.path).filter(Boolean));
  const entries = inventory.entries.filter((entry) => selectedPaths.has(entry.path));
  return {
    scope: inventory.scope,
    complete: inventory.complete,
    catalog_complete: false,
    entry_count: inventory.entries.length,
    provided_entry_count: entries.length,
    excluded: inventory.excluded,
    entries,
    full_inventory_invocation: describeInvocation(root, null)
  };
}

function intentLocator(path) {
  return `intent:${String(path).replace(/^intent\./, "")}`;
}

function normalizeSearchText(value) {
  return String(value).toLowerCase().replace(/[_:\/.\\-]+/g, " ").replace(/\s+/g, " ").trim();
}

function compareSubjectPriority(left, right) {
  const weight = (subject) => {
    if (subject.kind === "obligation-atom") return 0;
    if (subject.kind === "intent-requirement") return 1;
    if (subject.kind.startsWith("spec-")) return 2;
    if (subject.kind === "body-section") return 3;
    if (["scenario-fixture", "eval-case"].includes(subject.kind)) return 4;
    if (subject.kind === "source-text-hit") return 5;
    if (subject.generated) return 8;
    if (subject.kind === "file") return 7;
    return 6;
  };
  return weight(left) - weight(right) || String(left.display).localeCompare(String(right.display));
}

function projectCapsuleSubject(subject) {
  const textLimit = subject.kind === "scenario-fixture" ? 590
    : subject.kind === "obligation-atom" ? 600
      : subject.kind === "intent-requirement" || subject.kind === "spec-observations" ? 450
        : 1000;
  const projected = {
    id: publicSubjectId(subject),
    locator: subject.locator,
    display: subject.display,
    kind: subject.kind,
    name: subject.name,
    path: subject.path,
    span: subject.span,
    identity: subject.identity,
    basis: subject.basis,
    authority: subject.authority,
    generated: subject.generated,
    text: boundedExcerpt(subject.text, textLimit)
  };
  if (subject.kind === "file" || subject.kind.startsWith("external-") || subject.kind === "obligation-atom") projected.data = subject.data;
  return projected;
}

function projectCapsuleRelation(relation, subjectById) {
  const from = subjectById.get(relation.from);
  const to = relation.to ? subjectById.get(relation.to) : null;
  const projected = {
    kind: relation.kind,
    from_id: publicSubjectId(from) ?? relation.from,
    to_id: publicSubjectId(to) ?? relation.to ?? relation.target,
    from_label: subjectLabel(from) ?? relation.from,
    to_label: relation.to ? subjectLabel(to) ?? relation.target : relation.target,
    basis: relation.basis,
    resolution: relation.resolution
  };
  if (relation.ordinal !== null) projected.ordinal = relation.ordinal;
  if (relation.source_locator && relation.source_locator !== from?.display) projected.source_locator = relation.source_locator;
  if (relation.note) projected.note = relation.note;
  return projected;
}

function publicSubjectId(subject) {
  if (!subject) return null;
  return subject.locator && subject.identity !== "native-ambiguous" ? subject.locator : subject.id;
}

function boundedExcerpt(text, limit) {
  const value = String(text ?? "");
  return value.length > limit ? `${value.slice(0, limit)}\n…[excerpt truncated; open the exact source span]` : value;
}

function shouldExpandStructuralRelation(subject, relation, anchorIds) {
  if (!subject) return false;
  if (["spec-stage", "spec-guard"].includes(subject.kind)) return true;
  if (subject.kind === "spec-table") return relation.kind === "owns-row";
  if (subject.kind === "spec-table-row") return anchorIds.has(subject.id) && ["reads", "unless-reads"].includes(relation.kind);
  if (subject.kind === "spec-observations") return anchorIds.has(subject.id) && relation.kind === "implemented-by-collector-module";
  if (["spec-templates", "spec-artifacts", "spec-roles", "spec-read-first", "spec-declarations", "spec-ownership"].includes(subject.kind)) return true;
  if (subject.kind === "source-text-hit") return anchorIds.has(subject.id) && ["links", "imports", "literal-path-candidate"].includes(relation.kind);
  return false;
}

function roleIncomingKinds(subject) {
  if (!subject) return new Set();
  if (subject.kind === "body-section") return new Set(["uses-body", "read-first-body"]);
  if (subject.kind === "spec-observations") return new Set(["reads", "unless-reads", "needs-judgment"]);
  if (subject.kind === "spec-table-row") return new Set(["owns-row"]);
  if (subject.kind === "spec-table") return new Set(["selects-table", "owns-entry"]);
  if (subject.kind === "spec-templates") return new Set(["uses-template", "returns-template", "records-template"]);
  if (subject.kind === "spec-artifacts") return new Set(["uses-artifact", "records-artifact"]);
  if (subject.kind === "spec-formats") return new Set(["uses-format", "records-format"]);
  if (subject.kind === "spec-roles") return new Set(["dispatches-role"]);
  if (subject.kind === "file") return new Set(["imports", "links", "read-first-file", "uses-template-file", "literal-path-candidate"]);
  return new Set();
}

function roleOutgoingKinds(subject, anchorIds) {
  if (subject?.kind === "file" && anchorIds.has(subject.id)) return new Set(["imports", "links"]);
  return new Set();
}

function isObligationLanding(subject, anchorIds) {
  if (!subject) return false;
  if (anchorIds.has(subject.id)) return true;
  return ["spec-table", "spec-table-row", "spec-templates", "spec-artifacts", "spec-roles", "body-section"].includes(subject.kind);
}

function sourceSubject(entry, nodeOrSpan, kind, name, locator, text, data, identity) {
  const located = Number.isInteger(nodeOrSpan?.start) && Number.isInteger(nodeOrSpan?.end);
  const start = located ? nodeOrSpan.start : null;
  const end = located ? nodeOrSpan.end : null;
  const location = located ? sourceLocation(entry.text ?? "", start) : null;
  const discriminator = `${entry.path}\0${entry.hash}\0${start ?? "unlocated"}\0${end ?? "unlocated"}\0${kind}\0${locator ?? ""}\0${name ?? ""}`;
  return {
    id: `source:${entry.path}:${entry.hash?.slice(7, 19) ?? "unhashed"}:${start ?? "unlocated"}:${end ?? "unlocated"}:${kind}:${sha256(discriminator).slice(7, 15)}`,
    locator,
    display: located ? `${entry.path}:${location.line}:${location.column}` : `${entry.path}:unlocated`,
    kind,
    name,
    path: entry.path,
    span: located ? { start, end, unit: "utf16-code-unit", line: location.line, column: location.column, source_hash: entry.hash } : null,
    identity,
    basis: "observed-source",
    authority: authorityForKind(kind),
    generated: entry.generated,
    text,
    data
  };
}

function authorityForKind(kind) {
  if (kind === "intent-requirement") return "canonical-intent";
  if (kind === "obligation-atom") return "provenance-membership";
  if (kind.startsWith("spec-")) return "static-spec-source";
  if (kind === "body-section") return "attributed-judgment-rationale";
  if (kind.includes("fixture") || kind === "eval-case") return "verification-definition";
  return "source-navigation";
}

function parseJsonSpans(text) {
  const spans = new Map();
  try {
    const ast = parse(`(${text}\n)`, { ecmaVersion: "latest", sourceType: "script" });
    const root = ast.body[0]?.expression;
    const visit = (node, tokens) => {
      if (!node) return;
      spans.set(JSON.stringify(tokens), { start: Math.max(0, node.start - 1), end: Math.max(0, node.end - 1) });
      if (node.type === "ArrayExpression") node.elements.forEach((item, index) => visit(item, [...tokens, index]));
      else if (node.type === "ObjectExpression") for (const property of node.properties) {
        if (property.type !== "Property" || property.computed) continue;
        visit(property.value, [...tokens, propertyName(property.key)]);
      }
    };
    visit(root, []);
    return { spans, issue: null };
  } catch (error) {
    return { spans, issue: `Exact JSON source positions could not be mapped: ${error.message}` };
  }
}

function jsonSpan(spans, tokens) {
  return spans?.get(JSON.stringify(tokens)) ?? null;
}

function validateJsonFamily(family, value) {
  const issues = [];
  const requireRecord = (label, candidate) => {
    if (!isRecord(candidate)) issues.push(`${label} must be an object.`);
  };
  if (["manifest", "intent", "profile-decision", "obligation-ledger", "semantic-diff"].includes(family)) requireRecord(family, value);
  if (family === "manifest" && isRecord(value)) {
    for (const key of ["generated_files", "content"]) if (value[key] !== undefined && !isRecord(value[key])) issues.push(`manifest.${key} must be an object when present.`);
  }
  if (family === "obligation-ledger" && isRecord(value)) {
    if (!Array.isArray(value.atoms)) issues.push("obligation-ledger.atoms must be an array.");
    else for (const [index, atom] of value.atoms.entries()) {
      if (!isRecord(atom)) {
        issues.push(`obligation-ledger.atoms[${index}] must be an object.`);
        continue;
      }
      if (atom.source !== undefined && typeof atom.source !== "string") issues.push(`obligation-ledger.atoms[${index}].source must be a string when present.`);
      for (const key of ["targets", "evidence"]) {
        if (atom[key] !== undefined && !Array.isArray(atom[key])) issues.push(`obligation-ledger.atoms[${index}].${key} must be an array when present.`);
        else if (Array.isArray(atom[key]) && atom[key].some((item) => typeof item !== "string")) issues.push(`obligation-ledger.atoms[${index}].${key} entries must be strings.`);
      }
    }
  }
  if (["eval-cases", "scenario-fixtures"].includes(family)) {
    if (!Array.isArray(value)) issues.push(`${family} must be an array.`);
    else for (const [index, item] of value.entries()) {
      if (!isRecord(item)) issues.push(`${family}[${index}] must be an object.`);
      if (family === "scenario-fixtures" && isRecord(item)) {
        if (item.cover !== undefined && !Array.isArray(item.cover)) issues.push(`${family}[${index}].cover must be an array when present.`);
        else if (Array.isArray(item.cover) && item.cover.some((token) => typeof token !== "string")) issues.push(`${family}[${index}].cover entries must be strings.`);
        if (item.expect !== undefined && !isRecord(item.expect)) issues.push(`${family}[${index}].expect must be an object when present.`);
        else if (item.expect?.stage !== undefined && typeof item.expect.stage !== "string") issues.push(`${family}[${index}].expect.stage must be a string when present.`);
      }
    }
  }
  return issues;
}

function validateExtractedSpecShapes(spec) {
  if (!spec || typeof spec !== "object") return [];
  const issues = [];
  for (const [name, artifact] of recordEntries(spec.ARTIFACTS)) if (artifact?.readers !== undefined && !Array.isArray(artifact.readers)) issues.push(`ARTIFACTS.${name}.readers must be an array for declared reader extraction.`);
  return issues;
}

function isRecord(value) {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function recordEntries(value) {
  return isRecord(value) ? Object.entries(value) : [];
}

function normalizeNewlines(text) {
  return String(text).replace(/\r\n/g, "\n");
}

function sourceSlice(entry, node) {
  if (!entry.text || !node) return "";
  return entry.text.slice(node.start, node.end);
}

function sourceDisplay(entry, start, end = start) {
  const location = sourceLocation(entry.text ?? "", start);
  const finish = sourceLocation(entry.text ?? "", end);
  return `${entry.path}:${location.line}:${location.column}${finish.line === location.line ? `-${finish.column}` : `-${finish.line}:${finish.column}`}`;
}

function sourceLocation(text, offset) {
  const before = text.slice(0, Math.max(0, offset));
  const lines = before.split("\n");
  return { line: lines.length, column: lines.at(-1).length + 1 };
}

function propertyName(node) {
  if (!node) return "";
  return node.type === "Identifier" ? node.name : String(node.value);
}

function objectProperty(node, name) {
  if (node?.type !== "ObjectExpression") return null;
  return node.properties.find((property) => property.type === "Property" && !property.computed && propertyName(property.key) === name) ?? null;
}

function extractWhy(markdown) {
  const match = markdown.match(/(?:^|\n)Why:\s*([^\n]*(?:\n(?!\s*(?:Judgment|Why):)[^\n]*)*)/i);
  return match?.[1]?.trim() ?? null;
}

function normalizeLinkedPath(fromPath, raw) {
  if (!raw || isAbsolute(raw) || raw.includes("\\") || raw.includes(":")) return null;
  const parts = `${dirname(fromPath).replace(/\\/g, "/")}/${raw}`.split("/");
  const output = [];
  for (const part of parts) {
    if (!part || part === ".") continue;
    if (part === "..") {
      if (!output.length) return null;
      output.pop();
    } else output.push(part);
  }
  return output.join("/");
}

function resolveModuleCandidate(fromPath, specifier, entryByPath, resolution = "exact-esm") {
  const normalized = normalizeLinkedPath(fromPath, specifier);
  if (!normalized) return null;
  const candidates = resolution === "node-cjs"
    ? [normalized, `${normalized}.cjs`, `${normalized}.js`, `${normalized}.json`, `${normalized}/index.cjs`, `${normalized}/index.js`, `${normalized}/index.json`]
    : [normalized];
  for (const candidate of candidates) if (entryByPath.has(candidate)) return candidate;
  return null;
}

function publicEntry(entry) {
  return { path: entry.path, type: entry.type, bytes: entry.bytes, hash: entry.hash, handling: entry.handling, generated: entry.generated, projection: entry.projection ?? null };
}

function issue(path, code, message, consequence = "medium") {
  return { path, code, message, consequence };
}

function compactValue(value, depth = 0) {
  if (depth > 5) return "[depth-limited]";
  if (Array.isArray(value)) return value.slice(0, 40).map((item) => compactValue(item, depth + 1));
  if (value && typeof value === "object") return Object.fromEntries(Object.entries(value).slice(0, 80).map(([key, item]) => [key, compactValue(item, depth + 1)]));
  if (typeof value === "string") return value.length > MAX_EXCERPT_CHARS ? `${value.slice(0, MAX_EXCERPT_CHARS)}…` : value;
  if (typeof value === "function") return "[function]";
  return value;
}

function excerpt(text) {
  const value = String(text ?? "").trim();
  return value.length > MAX_EXCERPT_CHARS ? `${value.slice(0, MAX_EXCERPT_CHARS)}\n…[excerpt truncated]` : value;
}

function indentBlock(text, prefix) {
  return String(text).split("\n").map((line) => `${prefix}${line}`).join("\n");
}

function subjectLabel(subject) {
  return subject ? subject.locator ?? subject.display ?? subject.id : null;
}

function isPortablePath(path) {
  return typeof path === "string" && path.length > 0 && !isAbsolute(path) && !path.includes("\\") && !path.includes(":") && path.split("/").every((part) => part && part !== "." && part !== "..");
}

async function safeRealpath(path) {
  try { return await realpath(path); }
  catch { return path; }
}

function quoteCommandArg(value) {
  return `"${String(value).replaceAll('"', '\\"')}"`;
}

function escapeTable(value) {
  return String(value ?? "").replaceAll("|", "\\|").replace(/\r?\n/g, " ");
}

function unique(values) {
  return [...new Set(values)];
}

function dedupeObjects(items) {
  const seen = new Set();
  return items.filter((item) => {
    const key = JSON.stringify(item);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
