import { access, readFile } from "node:fs/promises";
import { constants as fsConstants } from "node:fs";
import { join, relative, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { analyzeSpecSource } from "./ast-policy.mjs";
import { EXPORT_NAMES, EFFECT_VERBS, TERMINALS } from "./constants.mjs";
import { isOpenDomain, isValidDomainDeclaration } from "./domains.mjs";
import { hashFile, sha256 } from "./hash.mjs";
import { loadBody, parseBody, resolveBodySection, validateBodyKinds } from "./body.mjs";
import { extractInlineTemplates, resolveTemplate, validateTemplateDeclaration } from "./templates.mjs";
import { isPortableRelativePath } from "./path-policy.mjs";
import { loadScenarioFixtures, validateScenarioExpectations } from "./scenario-checks.mjs";
import { validateFormatFixtures } from "./format-checks.mjs";
import { validateAuthoringLedger } from "./authoring-ledger.mjs";
import { nestFlat, prepareFixtureInputs } from "./observations.mjs";
import { checkReads } from "./evaluator.mjs";

export async function validateFast(skillRoot) {
  const root = resolve(skillRoot);
  const specPath = join(root, "spec.mjs");
  let source;
  try { source = new TextDecoder("utf-8", { fatal: true }).decode(await readFile(specPath)); }
  catch (error) { return { ok: false, level: "L-fast", diagnostics: [{ code: "L0", pointer: specPath, message: `Cannot read spec.mjs: ${error.message}`, hint: null, level: "error" }], analysis: null, source: null, specPath }; }
  const analysis = analyzeSpecSource(source, relative(root, specPath).replace(/\\/g, "/"));
  return { ok: analysis.diagnostics.length === 0, level: "L-fast", diagnostics: analysis.diagnostics, analysis, source, specPath };
}

export async function importVerifiedSource(fastResult) {
  if (!fastResult.ok) throw new Error("L-fast must pass before importing spec.mjs");
  const current = new TextDecoder("utf-8", { fatal: true }).decode(await readFile(fastResult.specPath));
  if (current !== fastResult.source) {
    const error = new Error("spec.mjs changed after L-fast validation; validate the current bytes again before import.");
    error.code = "SR_SPEC_CHANGED";
    throw error;
  }
  const fingerprint = sha256(current);
  const url = pathToFileURL(fastResult.specPath);
  url.searchParams.set("skill_rails_spec", fingerprint.slice(7));
  return import(url.href);
}

export async function validateFull(skillRoot, options = {}) {
  const fast = await validateFast(skillRoot);
  if (!fast.ok) return { ...fast, level: "L-structural", checks: coverageTemplate(fast.diagnostics) };
  let spec;
  try { spec = await importVerifiedSource(fast); }
  catch (error) {
    const diagnostics = [...fast.diagnostics, { code: "L0", pointer: "spec.mjs", message: `Verified source failed to import: ${error.message}`, hint: null, level: "error" }];
    return { ok: false, level: "L-structural", diagnostics, analysis: fast.analysis, spec: null, checks: coverageTemplate(diagnostics) };
  }
  const diagnostics = [];
  const check = (code, condition, pointer, message, hint = null) => { if (!condition) diagnostics.push({ code, pointer, message, hint, level: "error" }); };

  check("L0", EXPORT_NAMES.every((name) => Object.hasOwn(spec, name)) && Object.keys(spec).sort().join("\0") === [...EXPORT_NAMES].sort().join("\0"), "spec.mjs", "Imported module must expose exactly the closed 14 exports.");
  check("L0", Boolean(spec.SPEC && spec.SPEC.version === "5" && /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(spec.SPEC.id ?? "") && spec.SPEC.profile === "single"), "SPEC", "SPEC requires version 5, a kebab-case id, and profile single.");
  check("L0", Array.isArray(spec.SPEC?.imports) && spec.SPEC.imports.length === 0, "SPEC.imports", "The single profile requires an empty imports array.");

  const collectorRegistry = await loadCollectorMetadata(skillRoot, spec.SPEC.id);
  const collectorNames = collectorRegistry.names;
  diagnostics.push(...collectorRegistry.diagnostics);
  for (const [field, declaration] of Object.entries(spec.OBSERVATIONS ?? {})) {
    check("L2", /^[a-z][a-zA-Z0-9]*(?:\.[a-z][a-zA-Z0-9]*)*$/.test(field), `OBSERVATIONS.${field}`, "Observation ids must be stable field paths.");
    check("L2", Boolean(declaration && typeof declaration === "object" && !Array.isArray(declaration)), `OBSERVATIONS.${field}`, "Observation declaration must be an object.");
    check("L2", Boolean(declaration.judged || declaration.decided || (declaration.collector && collectorNames.has(declaration.collector))), `OBSERVATIONS.${field}`, "Observed field requires a registered collector, judged, or decided source.");
    check("L3", isValidDomainDeclaration(declaration.domain), `OBSERVATIONS.${field}.domain`, "Observation domain is invalid.");
    check("L3", !(Array.isArray(declaration.domain) && declaration.domain.includes("UNKNOWN")), `OBSERVATIONS.${field}.domain`, "Exact string UNKNOWN is reserved for the version-5 unknown observation sentinel.");
    check("L3", [declaration.judged, declaration.decided, Boolean(declaration.collector)].filter(Boolean).length === 1, `OBSERVATIONS.${field}`, "Observation must have exactly one source class.");
  }

  checkUniqueIds(spec.GUARDS ?? [], "GUARDS", "L6", diagnostics);
  checkUniqueIds(spec.STAGES ?? [], "STAGES", "L6", diagnostics);
  checkUniqueIds(Object.keys(spec.ROLES ?? {}).map((id) => ({ id })), "ROLES", "L12", diagnostics);

  for (const [index, guard] of (spec.GUARDS ?? []).entries()) {
    const pointer = `GUARDS.${index}:${guard.id ?? "?"}`;
    check("L6", Boolean(guard.id && /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(guard.id)), pointer, "Guard id must be kebab-case.");
    check("L6", Array.isArray(guard.reads) && typeof guard.when === "function", pointer, "Guard requires reads and a when predicate.");
    check("L6", ["ASK", "BLOCK", "RESTRICT"].includes(guard.then) || /^ROUTE:[a-z0-9]+(?:-[a-z0-9]+)*$/.test(guard.then ?? ""), `${pointer}.then`, "Guard terminal must be ASK, BLOCK, RESTRICT, or ROUTE:<id>.");
    if (guard.then === "RESTRICT") check("L6", Array.isArray(guard.forbids) && guard.forbids.length > 0 && new Set(guard.forbids).size === guard.forbids.length && guard.forbids.every((verb) => EFFECT_VERBS.includes(verb)), `${pointer}.forbids`, "RESTRICT requires unique known effect verbs.");
    else check("L6", guard.forbids === undefined || (Array.isArray(guard.forbids) && guard.forbids.length === 0), `${pointer}.forbids`, "Only RESTRICT guards may declare forbids.");
    check("L7", typeof guard.body === "string" && guard.body.length > 0, `${pointer}.body`, "Guard requires a body reference.");
    if (guard.unless) {
      check("L6", Boolean(guard.unless.id && /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(guard.unless.id)), `${pointer}.unless.id`, "Unless id must be kebab-case.");
      check("L6", Array.isArray(guard.unless.reads) && typeof guard.unless.when === "function", `${pointer}.unless`, "Unless requires reads and a when predicate.");
    }
  }

  for (const [tableId, table] of Object.entries(spec.TABLES ?? {})) {
    const rows = table.rows ?? [];
    checkUniqueIds(rows.map((row) => ({ id: row.state })), `TABLES.${tableId}.rows`, "L5", diagnostics);
    check("L5", rows.length > 0, `TABLES.${tableId}.rows`, "Table requires at least one row.");
    const last = rows.at(-1);
    let defaultMatches = false;
    try { defaultMatches = Array.isArray(last?.reads) && last.reads.length === 0 && last.when({}) === true; } catch { defaultMatches = false; }
    check("L5", defaultMatches, `TABLES.${tableId}.rows`, "Last table row must be an unconditional default with reads=[].");
    if (table.exclusive) {
      for (const fixture of await loadScenarioFixtures(skillRoot)) {
        let prepared;
        try { prepared = prepareFixtureInputs(spec, fixture); }
        catch { continue; }
        const matches = rows.slice(0, -1).filter((row) => {
          try {
            if (!checkReads(spec, row, prepared.observations.flat, new Map()).ok) return false;
            return row.when(prepared.observations.nested) === true;
          } catch { return false; }
        });
        check("L5", matches.length <= 1, `TABLES.${tableId}.fixture:${fixture.id}`, `Exclusive table has overlapping non-default rows: ${matches.map((row) => row.state).join(", ")}`);
      }
    }
  }

  const observationSources = Object.fromEntries(Object.entries(spec.OBSERVATIONS ?? {}).map(([field, declaration]) => [field, declaration]));
  for (const [index, stage] of (spec.STAGES ?? []).entries()) {
    const pointer = `STAGES.${index}:${stage.id ?? "?"}`;
    check("L6", Boolean(stage.id && /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(stage.id)), pointer, "Stage id must be kebab-case.");
    check("L6", Boolean(stage.record) !== Boolean(stage.reentry), pointer, "Stage requires exactly one of record or reentry.");
    check("L6", Array.isArray(stage.reads), `${pointer}.reads`, "Stage requires a reads array.");
    check("L6", typeof stage.done === "function", pointer, "Stage requires a done predicate.");
    check("L7", typeof stage.body === "string" && stage.body.length > 0, `${pointer}.body`, "Stage requires a body reference.");
    if (stage.reentry) check("L6", stage.reentry === "rejudge", `${pointer}.reentry`, "The initial single profile supports only reentry='rejudge'.");
    for (const field of stage.needs ?? []) check("L6", Boolean(observationSources[field]?.judged || observationSources[field]?.decided), `${pointer}.needs`, `Need ${field} must be judged or decided.`);
    if (stage.table) {
      check("L6", Boolean(spec.TABLES?.[stage.table]), `${pointer}.table`, `Stage table does not exist: ${stage.table}`);
      const states = (spec.TABLES?.[stage.table]?.rows ?? []).map((row) => row.state).sort();
      const branches = Object.keys(stage.branches ?? {}).sort();
      check("L6", states.join("\0") === branches.join("\0"), `${pointer}.branches`, `Branch keys must equal table states. states=${states.join(",")} branches=${branches.join(",")}`);
    } else {
      check("L6", Array.isArray(stage.effects) || (stage.needs && stage.branches), pointer, "Stage requires effects or judgment branches.");
      if (stage.needs?.length === 1 && stage.branches) {
        const field = stage.needs[0];
        const domain = spec.OBSERVATIONS?.[field]?.domain;
        if (Array.isArray(domain)) {
          const actionable = domain.filter((value) => { try { return stage.done(nestField(field, value)) !== true; } catch { return true; } });
          check("L6", actionable.every((value) => Object.hasOwn(stage.branches, value)), `${pointer}.branches`, `Judgment branches must cover every non-done domain value: ${actionable.join(", ")}`);
        }
      }
    }
    if (stage.record?.artifact) check("L6", Boolean(spec.ARTIFACTS?.[stage.record.artifact]), `${pointer}.record.artifact`, "Stage record references an unknown artifact.");
    if (stage.record?.format) check("L6", Boolean(spec.FORMATS?.[stage.record.format]), `${pointer}.record.format`, "Stage record references an unknown format.");
    for (const [branch, plan] of plansForStage(stage)) {
      validatePlan(plan, `${pointer}.${branch}`, diagnostics);
      validateEffectReferences(plan, `${pointer}.${branch}`, spec, check);
    }
    if (stage.cycle) {
      check("L6", Boolean(observationSources[stage.cycle.counter]), `${pointer}.cycle.counter`, "Cycle counter must be an observation.");
      check("L6", observationSources[stage.cycle.counter]?.domain === "integer", `${pointer}.cycle.counter`, "Cycle counter must use the integer domain.");
      const states = spec.TABLES?.[stage.table]?.rows?.map((row) => row.state) ?? [];
      check("L6", states.includes(stage.cycle.boundedBy), `${pointer}.cycle.boundedBy`, "Cycle boundedBy must name a table row.");
    }
  }

  let body;
  try {
    body = await loadBody(skillRoot, options.language ?? "en");
    diagnostics.push(...validateBodyKinds(body));
    check("L7", body.duplicates.length === 0, body.path, "Body section ids must be unique.");
    const expectedRefs = expectedBodyRefs(spec);
    const actualRefs = body.sections.map((section) => section.ref);
    check("L7", expectedRefs.join("\0") === actualRefs.join("\0"), body.path, `Body section order mismatch. expected=${expectedRefs.join(",")} actual=${actualRefs.join(",")}`);
    for (const reference of referencedBodyRefs(spec)) resolveBodySection(body, reference, spec.SPEC.id);
    validateBodyProse(body, spec, diagnostics);
  } catch (error) {
    diagnostics.push({ code: error.code ?? "L7", pointer: error.pointer ?? "body.md", message: error.message, hint: error.hint ?? null, level: "error" });
  }

  const markedInline = body ? extractInlineTemplates(body.markdown) : {};
  for (const [id, declaration] of Object.entries(spec.TEMPLATES ?? {})) {
    if (declaration.file) check("L11", isPortableRelativePath(declaration.file) && declaration.file.startsWith("templates/"), `TEMPLATES.${id}.file`, "Template files must stay under templates/ using portable relative paths.");
    try {
      const text = await resolveTemplate(skillRoot, id, declaration, body?.markdown ?? "");
      diagnostics.push(...validateTemplateDeclaration(id, declaration, text));
    } catch (error) { diagnostics.push({ code: error.code ?? "L11", pointer: error.pointer ?? `TEMPLATES.${id}`, message: error.message, hint: error.hint ?? null, level: "error" }); }
  }
  for (const marker of Object.keys(markedInline)) check("L11", Object.values(spec.TEMPLATES ?? {}).some((item) => item.inline === marker), `body.md#template:${marker}`, "Inline template marker is not declared in TEMPLATES.");

  for (const [id, artifact] of Object.entries(spec.ARTIFACTS ?? {})) {
    check("L10", isPortableRelativePath(artifact.path), `ARTIFACTS.${id}.path`, "Artifact path must be portable and project-relative.");
    check("L10", Array.isArray(artifact.readers) && artifact.readers.length > 0, `ARTIFACTS.${id}.readers`, "Artifact requires at least one reader.");
    check("L10", typeof artifact.writer === "string" && artifact.writer.length > 0, `ARTIFACTS.${id}.writer`, "Artifact requires a writer id.");
    check("L10", validArtifactWriter(artifact.writer, spec), `ARTIFACTS.${id}.writer`, "Artifact writer must be this skill, a declared role, or a named external/project actor.");
    for (const reader of artifact.readers ?? []) check("L10", validReader(reader, spec), `ARTIFACTS.${id}.readers`, `Unknown artifact reader: ${reader}`);
    if (artifact.template) check("L10", Boolean(spec.TEMPLATES?.[artifact.template]), `ARTIFACTS.${id}.template`, "Artifact template reference does not exist.");
  }

  for (const [index, item] of (spec.READ_FIRST ?? []).entries()) {
    check("L7", Boolean(item && typeof item.body === "string"), `READ_FIRST.${index}.body`, "READ_FIRST requires a body reference.");
    if (item?.path) check("L7", isPortableRelativePath(item.path), `READ_FIRST.${index}.path`, "READ_FIRST paths must be portable and remain inside the skill package.");
  }

  for (const [index, stage] of (spec.STAGES ?? []).entries()) {
    for (const [, plan] of plansForStage(stage)) {
      for (const effect of plan ?? []) {
        if (!Array.isArray(effect) || effect[0] !== "WRITE") continue;
        const artifactId = effect[1]?.artifact;
        const artifact = spec.ARTIFACTS?.[artifactId];
        check("L12", Boolean(artifact), `STAGES.${index}.WRITE.${artifactId}`, "WRITE must reference a declared artifact.");
        if (artifact) check("L12", resolveOwner(spec.OWNERSHIP ?? {}, artifact.path) === spec.SPEC.id, `ARTIFACTS.${artifactId}.path`, "WRITE artifact path is not owned by this skill.");
      }
    }
  }
  for (const [id, role] of Object.entries(spec.ROLES ?? {})) {
    check("L12", /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(id), `ROLES.${id}`, "Role id must be kebab-case.");
    check("L12", (role.effects ?? []).every((effect) => !["WRITE", "COMMIT", "DISPATCH"].includes(Array.isArray(effect) ? effect[0] : effect)), `ROLES.${id}.effects`, "Clean-context roles may not own state-changing effects.");
    check("L7", typeof role.body === "string" && role.body.length > 0, `ROLES.${id}.body`, "Role requires a body reference.");
    if (role.returns) check("L12", Boolean(spec.TEMPLATES?.[role.returns]), `ROLES.${id}.returns`, "Role returns must reference a declared template.");
  }

  await validateLanguagePair(skillRoot, diagnostics);

  const fixtures = await loadScenarioFixtures(skillRoot);
  diagnostics.push(...await validateScenarioExpectations(skillRoot, spec, fixtures));
  const coverage = new Set(fixtures.flatMap((fixture) => fixture.cover ?? []));
  for (const guard of spec.GUARDS ?? []) {
    check("L14", coverage.has(`guard:${guard.id}`) || coverage.has(`guard-pending:${guard.id}`), `GUARDS.${guard.id}`, "Guard has no covering fixture.");
    if (guard.unless) check("L14", coverage.has(`unless:${guard.id}/${guard.unless.id}`), `GUARDS.${guard.id}.unless`, "Unless branch has no covering fixture.");
  }
  for (const stage of spec.STAGES ?? []) {
    check("L14", coverage.has(`stage:${stage.id}`), `STAGES.${stage.id}`, "Stage has no covering fixture.");
    if (!stage.table) for (const branch of Object.keys(stage.branches ?? {})) check("L14", coverage.has(`branch:${stage.id}/${branch}`), `STAGES.${stage.id}.branches.${branch}`, "Judgment branch has no covering fixture.");
  }
  for (const [tableId, table] of Object.entries(spec.TABLES ?? {})) for (const row of table.rows ?? []) {
    check("L14", coverage.has(`row:${tableId}/${row.state}`), `TABLES.${tableId}.${row.state}`, "Table row has no covering fixture.");
    check("L14", coverage.has(`branch:${tableId}/${row.state}`), `TABLES.${tableId}.${row.state}`, "Table branch has no covering fixture.");
  }

  for (const [id, format] of Object.entries(spec.FORMATS ?? {})) {
    check("L15", Boolean(format && typeof format.render === "function" && typeof format.parse === "function" && format.fields), `FORMATS.${id}`, "Format must be created by line/progressLine.");
    for (const [field, domain] of Object.entries(format.fields ?? {})) check("L15", isValidDomainDeclaration(domain), `FORMATS.${id}.fields.${field}`, "Format field domain is invalid.");
    const openFields = Object.entries(format.fields ?? {}).filter(([, domain]) => isOpenDomain(domain));
    check("L15", openFields.length <= 1 && (openFields.length === 0 || Object.keys(format.fields).at(-1) === openFields[0][0]), `FORMATS.${id}.fields`, "An open field may appear at most once and must be last.");
  }
  diagnostics.push(...await validateFormatFixtures(skillRoot, spec));

  for (const [id, declaration] of Object.entries(spec.DECLARATIONS ?? {})) check("L16", Boolean(declaration && "value" in declaration && declaration.consumer), `DECLARATIONS.${id}`, "Declaration requires value and consumer.");
  for (const [index, item] of (spec.DEFERRED ?? []).entries()) for (const field of ["id", "rule", "collector", "fixture", "owner", "until"]) check("L16", Boolean(item?.[field]), `DEFERRED.${index}.${field}`, "Deferred item is incomplete.");
  diagnostics.push(...await validateAuthoringLedger(skillRoot, spec, body, fixtures));

  for (const guard of spec.GUARDS ?? []) for (const field of guard.unless?.reads ?? []) check("L18", Boolean(observationSources[field]?.collector), `GUARDS.${guard.id}.unless.reads`, "Guard bypass may read collector evidence only.");

  diagnostics.push(...await validateMutationManifest(skillRoot));
  const all = [...fast.diagnostics, ...diagnostics];
  return { ok: all.length === 0, level: "L-structural", diagnostics: all, analysis: fast.analysis, spec, body, fixtures, checks: coverageTemplate(all) };
}

function validatePlan(plan, pointer, diagnostics) {
  if (!Array.isArray(plan) || plan.length === 0) { diagnostics.push({ code: "L6", pointer, message: "Effect plan must be a non-empty array.", hint: null, level: "error" }); return; }
  const terminals = plan.filter((item) => typeof item === "string" && validTerminal(item));
  if (terminals.length !== 1 || typeof plan.at(-1) !== "string" || terminals[0] !== plan.at(-1)) diagnostics.push({ code: "L6", pointer, message: "Effect plan must end in exactly one terminal.", hint: null, level: "error" });
  for (const item of plan.slice(0, -1)) if (!Array.isArray(item) || item.length !== 2 || !EFFECT_VERBS.includes(item[0]) || !item[1] || typeof item[1] !== "object" || Array.isArray(item[1])) diagnostics.push({ code: "L6", pointer, message: "Effect entries must be exact [VERB, args] pairs.", hint: null, level: "error" });
}

function validTerminal(value) { return TERMINALS.includes(value) || /^ROUTE:[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value); }

function validateEffectReferences(plan, pointer, spec, check) {
  for (const [index, effect] of (plan ?? []).entries()) {
    if (!Array.isArray(effect)) continue;
    const [verb, args] = effect;
    const local = `${pointer}.${index}:${verb}`;
    if (args?.artifact) check("L12", Boolean(spec.ARTIFACTS?.[args.artifact]), `${local}.artifact`, `Effect references an unknown artifact: ${args.artifact}`);
    if (args?.template) check("L12", Boolean(spec.TEMPLATES?.[args.template]), `${local}.template`, `Effect references an unknown template: ${args.template}`);
    if (args?.format) check("L12", Boolean(spec.FORMATS?.[args.format]), `${local}.format`, `Effect references an unknown format: ${args.format}`);
    if (verb === "DISPATCH") check("L12", typeof args?.role === "string" && Boolean(spec.ROLES?.[args.role]), `${local}.role`, "DISPATCH requires a declared role.");
    if (verb === "WRITE") check("L12", typeof args?.artifact === "string" && Boolean(spec.ARTIFACTS?.[args.artifact]), `${local}.artifact`, "WRITE requires a declared artifact.");
    if (verb === "REPORT" && args?.template !== undefined) check("L12", Boolean(spec.TEMPLATES?.[args.template]), `${local}.template`, "REPORT template must be declared.");
  }
}

function plansForStage(stage) {
  if (stage.table || stage.branches) return Object.entries(stage.branches ?? {});
  return [["effects", stage.effects]];
}

function expectedBodyRefs(spec) {
  return [
    ...(spec.READ_FIRST ?? []).map((item) => localRef(item.body, spec.SPEC.id)),
    ...(spec.GUARDS ?? []).map((item) => localRef(item.body, spec.SPEC.id)),
    ...(spec.STAGES ?? []).map((item) => localRef(item.body, spec.SPEC.id)),
    ...Object.values(spec.ROLES ?? {}).map((item) => localRef(item.body, spec.SPEC.id))
  ].filter(Boolean);
}

function referencedBodyRefs(spec) {
  return [
    ...(spec.READ_FIRST ?? []).map((item) => item.body),
    ...(spec.GUARDS ?? []).map((item) => item.body),
    ...(spec.STAGES ?? []).map((item) => item.body),
    ...Object.values(spec.ROLES ?? {}).map((item) => item.body)
  ].filter(Boolean);
}

function localRef(reference, skillId) {
  if (!reference) return null;
  if (!reference.includes("#")) return reference;
  const [skill, ref] = reference.split("#", 2);
  return skill === skillId ? ref : reference;
}

function validateBodyProse(body, spec, diagnostics) {
  const formatHeads = Object.values(spec.FORMATS ?? {}).map((format) => format.head).filter(Boolean);
  const ownershipLiterals = [...Object.keys(spec.OWNERSHIP ?? {}), ...Object.values(spec.ARTIFACTS ?? {}).map((artifact) => artifact.path)].filter((value) => value && !/[<*>]/.test(value));
  for (const section of body.sections) {
    const prose = section.markdown.replace(/```[\s\S]*?```/g, "");
    if (/(?:READ|RUN|WRITE|COMMIT|DISPATCH|REPORT)\b[^\n]*→/.test(prose)) diagnostics.push({ code: "L8", pointer: `${body.path}#${section.ref}`, message: "Body duplicates ordered effects.", hint: null, level: "error" });
    if (/\b(?:retry|repeat|maximum|at most|bytes?|lines?)\s*[:=]?\s*\d+\b|(?:재시도|반복|최대|이하|바이트|줄)\s*\d+/i.test(prose)) diagnostics.push({ code: "L8", pointer: `${body.path}#${section.ref}`, message: "Body contains a machine quantity.", hint: null, level: "error" });
    if (/\b\d{2}(?:\.\d+)+\b/.test(prose)) diagnostics.push({ code: "L8", pointer: `${body.path}#${section.ref}`, message: "Body duplicates a machine consistency/card identifier.", hint: null, level: "error" });
    for (const head of formatHeads) if (prose.includes(head) && section.kind !== "why") diagnostics.push({ code: "L8", pointer: `${body.path}#${section.ref}`, message: `Body duplicates format label: ${head}`, hint: null, level: "error" });
    for (const literal of ownershipLiterals) if (prose.includes(literal)) diagnostics.push({ code: "L8", pointer: `${body.path}#${section.ref}`, message: `Body duplicates an ownership or artifact path: ${literal}`, hint: null, level: "error" });
    if (section.kind === "stage") {
      const hasJudgment = /^(?:Judgment|판단):/m.test(section.markdown);
      const hasWhy = /^(?:Why|왜):/m.test(section.markdown);
      if (!hasJudgment || !hasWhy) diagnostics.push({ code: "L9", pointer: `${body.path}#${section.ref}`, message: "Stage body requires Judgment:/Why: (or 판단:/왜:) signatures.", hint: null, level: "error" });
      const judgment = section.markdown.match(/^(?:Judgment|판단):([^\n]*)/m)?.[1] ?? "";
      const stage = (spec.STAGES ?? []).find((item) => item.id === section.id);
      for (const field of stage?.needs ?? []) {
        const domain = spec.OBSERVATIONS?.[field]?.domain;
        const values = Array.isArray(domain) ? domain : [];
        if (!judgment.includes(field) || values.some((value) => !judgment.includes(value))) diagnostics.push({ code: "L9", pointer: `${body.path}#${section.ref}`, message: `Judgment signature must name ${field} and its declared domain values.`, hint: null, level: "error" });
      }
    } else if (/^(?:Judgment|판단|Why|왜):/m.test(section.markdown)) {
      diagnostics.push({ code: "L9", pointer: `${body.path}#${section.ref}`, message: "Judgment/Why signatures are allowed only in stage sections.", hint: null, level: "error" });
    }
  }
}

function checkUniqueIds(items, pointer, code, diagnostics) {
  const seen = new Set();
  for (const [index, item] of items.entries()) {
    if (!item.id || seen.has(item.id)) diagnostics.push({ code, pointer: `${pointer}.${index}`, message: `Stable id is missing or duplicated: ${item.id ?? "<missing>"}`, hint: null, level: "error" });
    seen.add(item.id);
  }
}

function nestField(field, value) {
  return nestFlat({ [field]: value });
}

function validReader(reader, spec) {
  if (typeof reader !== "string") return false;
  if (reader.startsWith("guard.")) return (spec.GUARDS ?? []).some((guard) => guard.id === reader.slice(6));
  if (reader.startsWith("stage.")) return (spec.STAGES ?? []).some((stage) => stage.id === reader.slice(6));
  if (reader.startsWith("role.")) return Boolean(spec.ROLES?.[reader.slice(5)]);
  return /^(?:external|project)\.[a-z0-9.-]+$/.test(reader);
}

function validArtifactWriter(writer, spec) {
  if (typeof writer !== "string") return false;
  return writer === spec.SPEC.id || Boolean(spec.ROLES?.[writer]) || /^(?:external|project)\.[a-z0-9.-]+$/.test(writer);
}

function resolveOwner(ownership, path) {
  const matches = Object.entries(ownership).filter(([pattern]) => globMatches(pattern, path));
  matches.sort((a, b) => specificity(b[0]) - specificity(a[0]));
  if (matches.length > 1 && specificity(matches[0][0]) === specificity(matches[1][0]) && matches[0][1] !== matches[1][1]) return null;
  return matches[0]?.[1] ?? null;
}

function globMatches(pattern, path) {
  const escaped = pattern.replace(/[.+^${}()|[\]\\]/g, "\\$&").replaceAll("**", "\0").replaceAll("*", "[^/]*").replaceAll("\0", ".*").replaceAll("<id>", "[^/]+");
  return new RegExp(`^${escaped}$`).test(path);
}

function specificity(pattern) { return pattern.replaceAll("**", "").replaceAll("*", "").replace(/<[^>]+>/g, "").length; }

async function loadCollectorMetadata(skillRoot, skillId) {
  const path = join(resolve(skillRoot), "collectors", "index.mjs");
  try {
    await access(path, fsConstants.R_OK);
    const url = pathToFileURL(path); url.searchParams.set("v", (await hashFile(path)).slice(7));
    const module = await import(url.href);
    const diagnostics = [];
    const exported = Object.keys(module).sort();
    if (exported.some((name) => !["collectors", "snapshotBasis"].includes(name))) diagnostics.push({ code: "L2", pointer: "collectors/index.mjs", message: "Collector module may export only collectors and snapshotBasis.", hint: null, level: "error" });
    if (!module.collectors || typeof module.collectors !== "object" || Array.isArray(module.collectors)) diagnostics.push({ code: "L2", pointer: "collectors/index.mjs", message: "Collector module must export a collectors object.", hint: null, level: "error" });
    if (module.snapshotBasis !== undefined && module.snapshotBasis !== null && typeof module.snapshotBasis !== "function") diagnostics.push({ code: "L2", pointer: "collectors/index.mjs:snapshotBasis", message: "snapshotBasis must be a function or null.", hint: null, level: "error" });
    const names = new Set(Object.keys(module.collectors ?? {}));
    for (const [name, collector] of Object.entries(module.collectors ?? {})) {
      if (!validCollectorName(name, skillId)) diagnostics.push({ code: "L2", pointer: `collectors.${name}`, message: "Collector name must expose its source namespace.", hint: null, level: "error" });
      if (typeof collector !== "function" || collector.length > 1) diagnostics.push({ code: "L2", pointer: `collectors.${name}`, message: "Collector must be a function accepting at most one ctx argument.", hint: null, level: "error" });
    }
    return { names, diagnostics };
  } catch (error) {
    if (error.code === "ENOENT") return { names: new Set(), diagnostics: [] };
    return { names: new Set(), diagnostics: [{ code: "L2", pointer: "collectors/index.mjs", message: `Collector registry failed to load: ${error.message}`, hint: null, level: "error" }] };
  }
}

function validCollectorName(name, skillId) {
  const generic = /^(?:state|git|knowledge|journal)\.[a-z0-9]+(?:[.-][a-z0-9]+)*$/;
  const local = new RegExp(`^${escapeRegExp(skillId)}/[a-z0-9]+(?:-[a-z0-9]+)*\\.[a-z0-9]+(?:[.-][a-z0-9]+)*$`);
  return generic.test(name) || local.test(name);
}

function escapeRegExp(value) { return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&"); }

async function validateLanguagePair(skillRoot, diagnostics) {
  const root = resolve(skillRoot);
  try {
    const [en, ko] = await Promise.all([readFile(join(root, "body.md"), "utf8"), readFile(join(root, "body_ko.md"), "utf8")]);
    const enBody = parseBody(en); const koBody = parseBody(ko);
    const enRefs = enBody.sections.map((item) => item.ref);
    const koRefs = koBody.sections.map((item) => item.ref);
    if (enRefs.join("\0") !== koRefs.join("\0")) diagnostics.push({ code: "L13", pointer: "body_ko.md", message: "English/Korean body section sets and order differ.", hint: null, level: "error" });
    const signature = (section) => ({ judgment: /^(?:Judgment|판단):/m.test(section.markdown), why: /^(?:Why|왜):/m.test(section.markdown) });
    if (JSON.stringify(enBody.sections.map(signature)) !== JSON.stringify(koBody.sections.map(signature))) diagnostics.push({ code: "L13", pointer: "body_ko.md", message: "English/Korean body section signatures differ.", hint: null, level: "error" });
    const enInline = extractInlineTemplates(en); const koInline = extractInlineTemplates(ko);
    for (const [id, text] of Object.entries(enInline)) if (koInline[id] !== text) diagnostics.push({ code: "L11", pointer: `body_ko.md#template:${id}`, message: "Inline templates must be byte-identical across languages.", hint: null, level: "error" });
  } catch { /* generic single-language profile */ }
  try {
    const [en, ko] = await Promise.all([readFile(join(root, "SKILL.md"), "utf8"), readFile(join(root, "SKILL_ko.md"), "utf8")]);
    const commands = (text) => text.split(/\r?\n/).filter((line) => /\bnode\b.*scripts\//.test(line)).map((line) => line.trim());
    if (commands(en).join("\0") !== commands(ko).join("\0")) diagnostics.push({ code: "L13", pointer: "SKILL_ko.md", message: "English/Korean bootstrap command lines differ.", hint: null, level: "error" });
  } catch { /* generic single-language profile */ }
}

async function validateMutationManifest(skillRoot) {
  const path = join(resolve(skillRoot), "fixtures", "lint", "manifest.json");
  try {
    const manifest = JSON.parse(await readFile(path, "utf8"));
    const entries = Array.isArray(manifest) ? manifest : (manifest.cases ?? []).map((item) => ({ lint: item.expected_code, mutation: item.mutation, id: item.id }));
    const covered = new Set(entries.filter((item) => item.id && item.mutation?.operation).map((item) => item.lint));
    return [...Array(19).keys()].map((index) => `L${index}`).filter((id) => !covered.has(id)).map((id) => ({ code: "L17", pointer: "fixtures/lint/manifest.json", message: `Missing negative fixture for ${id}.`, hint: null, level: "error" }));
  } catch {
    return [{ code: "L17", pointer: "fixtures/lint/manifest.json", message: "Missing mutation fixture manifest.", hint: null, level: "error" }];
  }
}

function coverageTemplate(diagnostics) {
  const failed = new Set(diagnostics.map((item) => item.code));
  return Object.fromEntries([...Array(19).keys()].map((index) => [`L${index}`, failed.has(`L${index}`) ? "fail" : "pass"]));
}
