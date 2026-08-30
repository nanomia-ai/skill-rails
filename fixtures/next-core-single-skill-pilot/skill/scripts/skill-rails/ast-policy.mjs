import { parse } from "./vendor/acorn.mjs";
import * as walk from "./vendor/acorn-walk.mjs";
import { EXPORT_NAMES } from "./constants.mjs";
import { isValidDomainDeclaration, validateDomainValue } from "./domains.mjs";

const ALLOWED_NODES = new Set([
  "Program",
  "ImportDeclaration",
  "ImportSpecifier",
  "Identifier",
  "Literal",
  "ExportNamedDeclaration",
  "VariableDeclaration",
  "VariableDeclarator",
  "ObjectExpression",
  "Property",
  "ArrayExpression",
  "ArrowFunctionExpression",
  "FunctionExpression",
  "FunctionDeclaration",
  "BlockStatement",
  "ReturnStatement",
  "MemberExpression",
  "BinaryExpression",
  "LogicalExpression",
  "UnaryExpression",
  "CallExpression",
  "ConditionalExpression",
  "TemplateLiteral",
  "TemplateElement",
  "ObjectPattern",
  "ArrayPattern",
  "RestElement"
]);

const ALLOWED_MEMBER_CALLS = new Set(["every", "some", "includes", "map", "filter", "find"]);
const ALLOWED_MEMBER_READS = new Set(["length"]);
const ALLOWED_HELPERS = new Set(["UNKNOWN", "NONE", "line", "progressLine", "template", "compareCardNumbers", "comparePaths"]);
const BANNED_IDENTIFIERS = new Set([
  "process", "globalThis", "fetch", "eval", "Function", "require", "module", "exports", "Date", "Intl", "Math", "JSON",
  "WebAssembly", "Atomics", "SharedArrayBuffer", "setTimeout", "setInterval", "queueMicrotask", "Buffer", "console"
]);

export function analyzeSpecSource(source, sourcePath = "spec.mjs") {
  const diagnostics = [];
  let ast;
  try {
    ast = parse(source, { ecmaVersion: "latest", sourceType: "module", locations: true, allowHashBang: false });
  } catch (error) {
    diagnostics.push(diag("L1", sourcePath, `JavaScript syntax error: ${error.message}`, error.loc));
    return { diagnostics, ast: null, exports: [], imports: [], observationDomains: {}, predicateReads: [], callGraph: {} };
  }

  const exports = [];
  const imports = [];
  const declared = new Set();
  const imported = new Set();
  const functionNodes = new Map();

  for (const node of ast.body) {
    if (node.type === "ImportDeclaration") {
      imports.push(node.source.value);
      if (node.source.value !== "./scripts/skill-rails/dsl.mjs") diagnostics.push(diag("L1", sourcePath, `Only ./scripts/skill-rails/dsl.mjs may be imported in the single profile.`, node.loc?.start));
      for (const specifier of node.specifiers) {
        if (specifier.type !== "ImportSpecifier") diagnostics.push(diag("L1", sourcePath, "Default and namespace imports are forbidden.", specifier.loc?.start));
        const importedName = specifier.imported?.name;
        if (!ALLOWED_HELPERS.has(importedName)) diagnostics.push(diag("L1", sourcePath, `Unknown DSL import: ${importedName}`, specifier.loc?.start));
        imported.add(specifier.local.name);
      }
      continue;
    }
    if (node.type === "VariableDeclaration" && node.kind === "const") {
      for (const declaration of node.declarations) registerLocalDeclaration(declaration, declared, functionNodes, diagnostics, sourcePath);
      continue;
    }
    if (node.type === "FunctionDeclaration" && node.id?.name) {
      declared.add(node.id.name);
      functionNodes.set(node.id.name, node);
      continue;
    }
    if (node.type !== "ExportNamedDeclaration" || !node.declaration || node.declaration.type !== "VariableDeclaration" || node.declaration.kind !== "const") {
      diagnostics.push(diag("L0", sourcePath, "Top-level statements must be DSL imports, private const/function helpers, or `export const` declarations.", node.loc?.start));
      continue;
    }
    for (const declaration of node.declaration.declarations) {
      if (declaration.id.type !== "Identifier") {
        diagnostics.push(diag("L0", sourcePath, "Export declarations must use a single identifier.", declaration.loc?.start));
        continue;
      }
      exports.push(declaration.id.name);
      declared.add(declaration.id.name);
      if (["ArrowFunctionExpression", "FunctionExpression"].includes(declaration.init?.type)) functionNodes.set(declaration.id.name, declaration.init);
    }
  }

  const sortedExports = [...exports].sort();
  const expected = [...EXPORT_NAMES].sort();
  if (sortedExports.join("\0") !== expected.join("\0")) {
    diagnostics.push(diag("L0", sourcePath, `Exports must be exactly: ${EXPORT_NAMES.join(", ")}. Found: ${exports.join(", ")}.`));
  }
  if (new Set(exports).size !== exports.length) diagnostics.push(diag("L0", sourcePath, "Duplicate export names are forbidden."));

  walk.full(ast, (node) => {
    if (!ALLOWED_NODES.has(node.type)) diagnostics.push(diag("L1", sourcePath, `AST node is not in the positive list: ${node.type}`, node.loc?.start));
    if (node.type === "Literal" && (node.regex || node.bigint)) diagnostics.push(diag("L1", sourcePath, "Regular expression and bigint literals are forbidden.", node.loc?.start));
    if (node.type === "Literal" && typeof node.value === "number" && !Number.isInteger(node.value)) diagnostics.push(diag("L1", sourcePath, "Only integer numeric literals are allowed.", node.loc?.start));
    if (node.type === "TemplateLiteral" && node.expressions.length > 0) diagnostics.push(diag("L1", sourcePath, "Interpolated template literals are forbidden.", node.loc?.start));
    if (node.type === "Property" && (node.computed || node.kind !== "init" || node.method || propertyName(node.key) === "__proto__")) diagnostics.push(diag("L1", sourcePath, "Computed, getter/setter, method, and __proto__ object properties are forbidden.", node.loc?.start));
    if (node.type === "MemberExpression") {
      if (node.computed || node.optional) diagnostics.push(diag("L1", sourcePath, "Computed and optional member access are forbidden.", node.loc?.start));
      if (node.property.type === "Identifier" && BANNED_IDENTIFIERS.has(node.property.name)) diagnostics.push(diag("L1", sourcePath, `Forbidden member: ${node.property.name}`, node.loc?.start));
    }
    if (node.type === "CallExpression") validateCall(node, imported, functionNodes, diagnostics, sourcePath);
    if (node.type === "Identifier" && BANNED_IDENTIFIERS.has(node.name)) diagnostics.push(diag("L1", sourcePath, `Forbidden global identifier: ${node.name}`, node.loc?.start));
    if (node.type === "VariableDeclaration" && node.kind !== "const") diagnostics.push(diag("L1", sourcePath, "Only const declarations are allowed.", node.loc?.start));
    if ((node.type === "ArrowFunctionExpression" || node.type === "FunctionExpression" || node.type === "FunctionDeclaration") && (node.async || node.generator)) diagnostics.push(diag("L1", sourcePath, "Async and generator functions are forbidden.", node.loc?.start));
    if (node.type === "BinaryExpression" && !["===", "!==", ">", ">=", "<", "<="].includes(node.operator)) diagnostics.push(diag("L1", sourcePath, `Binary operator is forbidden: ${node.operator}`, node.loc?.start));
    if (node.type === "LogicalExpression" && !["&&", "||"].includes(node.operator)) diagnostics.push(diag("L1", sourcePath, `Logical operator is forbidden: ${node.operator}`, node.loc?.start));
    if (node.type === "UnaryExpression" && node.operator !== "!") diagnostics.push(diag("L1", sourcePath, `Unary operator is forbidden: ${node.operator}`, node.loc?.start));
  });

  const exportInitializers = exportInitializerMap(ast);
  const specValue = staticValue(exportInitializers.get("SPEC"));
  if (!specValue || specValue.version !== "5" || typeof specValue.id !== "string") diagnostics.push(diag("L0", sourcePath, "SPEC must statically declare version '5' and an id."));
  if (specValue?.profile !== "single") diagnostics.push(diag("L0", sourcePath, "Initial implementation requires SPEC.profile='single'."));
  if (!Array.isArray(specValue?.imports) || specValue.imports.length !== 0) diagnostics.push(diag("L0", sourcePath, "The single profile requires SPEC.imports=[]."));

  const observations = staticValue(exportInitializers.get("OBSERVATIONS")) ?? {};
  const observationDomains = {};
  for (const [field, declaration] of Object.entries(observations)) {
    if (!declaration || !isValidDomainDeclaration(declaration.domain)) diagnostics.push(diag("L3", sourcePath, `Observation ${field} has an invalid static domain.`));
    else if (Array.isArray(declaration.domain) && declaration.domain.includes("UNKNOWN")) diagnostics.push(diag("L3", sourcePath, `Observation ${field} uses reserved version-5 sentinel string UNKNOWN in its domain.`));
    else observationDomains[field] = declaration.domain;
  }

  const predicateReads = [];
  walk.simple(ast, {
    ObjectExpression(node) {
      const propertyMap = new Map(node.properties.filter((item) => item.type === "Property" && !item.computed).map((item) => [propertyName(item.key), item]));
      for (const predicateName of ["when", "done"]) {
        const predicateProperty = propertyMap.get(predicateName);
        if (!predicateProperty || !["ArrowFunctionExpression", "FunctionExpression"].includes(predicateProperty.value.type)) continue;
        validateStateFunction(predicateProperty.value, `${predicateName} predicate`, functionNodes, diagnostics, sourcePath, { allowZero: true });
        const readsProperty = propertyMap.get("reads");
        const declaredReads = staticValue(readsProperty?.value);
        const derivedReads = deriveReads(predicateProperty.value, Object.keys(observationDomains), functionNodes);
        predicateReads.push({ predicateName, declared: Array.isArray(declaredReads) ? declaredReads : null, derived: derivedReads.fields, loc: predicateProperty.loc?.start });
        if (!Array.isArray(declaredReads)) diagnostics.push(diag("L4", sourcePath, `${predicateName} predicate requires a reads array.`, predicateProperty.loc?.start));
        else if ([...declaredReads].sort().join("\0") !== [...derivedReads.fields].sort().join("\0")) diagnostics.push(diag("L4", sourcePath, `${predicateName} reads differ from AST-derived reads. declared=${declaredReads.join(",")} derived=${derivedReads.fields.join(",")}`, predicateProperty.loc?.start));
        if (Array.isArray(declaredReads)) for (const field of declaredReads) if (!Object.hasOwn(observationDomains, field)) diagnostics.push(diag("L4", sourcePath, `${predicateName} reads undeclared observation: ${field}`, predicateProperty.loc?.start));
        const acceptsUnknown = staticValue(propertyMap.get("acceptsUnknown")?.value) ?? [];
        if (!Array.isArray(acceptsUnknown) || acceptsUnknown.some((field) => !declaredReads?.includes(field))) diagnostics.push(diag("L4", sourcePath, "acceptsUnknown must be a subset of reads.", propertyMap.get("acceptsUnknown")?.loc?.start));
        validateTypedComparisons(predicateProperty.value, observationDomains, diagnostics, sourcePath);
      }
    }
  });

  for (const [name, functionNode] of functionNodes) {
    validateStateFunction(functionNode, `private helper ${name}`, functionNodes, diagnostics, sourcePath);
    validateTypedComparisons(functionNode, observationDomains, diagnostics, sourcePath);
  }

  const callGraph = buildCallGraph(functionNodes);
  for (const cycle of findCycles(callGraph)) diagnostics.push(diag("L1", sourcePath, `Spec-local call graph is cyclic: ${cycle.join(" -> ")}`));

  return { diagnostics: deduplicate(diagnostics), ast, exports, imports, observationDomains, predicateReads, callGraph, specValue };
}

function validateCall(node, imported, functionNodes, diagnostics, sourcePath) {
  if (node.optional) diagnostics.push(diag("L1", sourcePath, "Optional calls are forbidden.", node.loc?.start));
  if (node.callee.type === "Identifier") {
    if (!imported.has(node.callee.name) && !functionNodes.has(node.callee.name)) diagnostics.push(diag("L1", sourcePath, `Call target is not an imported DSL helper or spec-local function: ${node.callee.name}`, node.loc?.start));
    return;
  }
  if (node.callee.type !== "MemberExpression" || node.callee.computed || node.callee.property.type !== "Identifier") {
    diagnostics.push(diag("L1", sourcePath, "Dynamic call targets are forbidden.", node.loc?.start));
    return;
  }
  const method = node.callee.property.name;
  const objectName = node.callee.object.type === "Identifier" ? node.callee.object.name : null;
  if (objectName === "Object" && method === "freeze") return;
  if (!ALLOWED_MEMBER_CALLS.has(method)) diagnostics.push(diag("L1", sourcePath, `Member call is not in the positive list: ${method}`, node.loc?.start));
}

function validateStateFunction(node, label, functionNodes, diagnostics, sourcePath, options = {}) {
  const parameter = node.params?.length === 1 && node.params[0]?.type === "Identifier" ? node.params[0].name : null;
  const zeroParameter = options.allowZero && node.params?.length === 0;
  if (!parameter && !zeroParameter) {
    diagnostics.push(diag("L1", sourcePath, `${label} must accept exactly one identifier parameter representing the complete observation state.`, node.loc?.start));
    return;
  }
  walk.ancestor(node.body, {
    VariableDeclaration(local) {
      diagnostics.push(diag("L1", sourcePath, `${label} may not declare local aliases; read observations directly from ${parameter}.`, local.loc?.start));
    },
    CallExpression(call) {
      if (call.callee.type !== "Identifier" || !functionNodes.has(call.callee.name)) return;
      if (!parameter || call.arguments.length !== 1 || call.arguments[0]?.type !== "Identifier" || call.arguments[0].name !== parameter) {
        diagnostics.push(diag("L1", sourcePath, `${label} must pass its complete observation state unchanged to private helper ${call.callee.name}.`, call.loc?.start));
      }
    }
  });
}

function registerLocalDeclaration(declaration, declared, functionNodes, diagnostics, sourcePath) {
  if (declaration.id.type !== "Identifier") {
    diagnostics.push(diag("L1", sourcePath, "Top-level private declarations require a single identifier.", declaration.loc?.start));
    return;
  }
  declared.add(declaration.id.name);
  if (["ArrowFunctionExpression", "FunctionExpression"].includes(declaration.init?.type)) functionNodes.set(declaration.id.name, declaration.init);
}

function exportInitializerMap(ast) {
  const map = new Map();
  for (const node of ast.body) {
    if (node.type !== "ExportNamedDeclaration" || node.declaration?.type !== "VariableDeclaration") continue;
    for (const declaration of node.declaration.declarations) if (declaration.id.type === "Identifier") map.set(declaration.id.name, declaration.init);
  }
  return map;
}

export function staticValue(node) {
  if (!node) return undefined;
  if (node.type === "Literal") return node.value;
  if (node.type === "TemplateLiteral" && node.expressions.length === 0) return node.quasis[0].value.cooked;
  if (node.type === "ArrayExpression") return node.elements.map(staticValue);
  if (node.type === "ObjectExpression") {
    const value = {};
    for (const property of node.properties) {
      if (property.type !== "Property" || property.computed || property.kind !== "init") return undefined;
      value[propertyName(property.key)] = staticValue(property.value);
    }
    return value;
  }
  if (node.type === "UnaryExpression" && node.operator === "-" && node.argument.type === "Literal" && typeof node.argument.value === "number") return -node.argument.value;
  return undefined;
}

function deriveReads(functionNode, observationFields, functionNodes, seen = new Set()) {
  const parameter = functionNode.params[0]?.type === "Identifier" ? functionNode.params[0].name : null;
  const fields = new Set();
  if (!parameter) return { fields: [] };
  if (seen.has(functionNode)) return { fields: [] };
  const nextSeen = new Set(seen).add(functionNode);
  walk.full(functionNode.body, (node) => {
    if (node.type === "MemberExpression" && !node.computed) {
      const chain = memberChain(node);
      if (!chain || chain[0] !== parameter) return;
      const raw = chain.slice(1).join(".");
      const candidate = observationFields.filter((field) => raw === field || raw.startsWith(`${field}.`)).sort((a, b) => b.length - a.length)[0];
      if (candidate) fields.add(candidate);
    }
    if (node.type === "CallExpression" && node.callee.type === "Identifier" && functionNodes.has(node.callee.name) && node.arguments[0]?.type === "Identifier" && node.arguments[0].name === parameter) {
      for (const field of deriveReads(functionNodes.get(node.callee.name), observationFields, functionNodes, nextSeen).fields) fields.add(field);
    }
  });
  return { fields: [...fields].sort() };
}

function validateTypedComparisons(functionNode, domains, diagnostics, sourcePath) {
  const parameter = functionNode.params[0]?.type === "Identifier" ? functionNode.params[0].name : null;
  if (!parameter) return;
  walk.simple(functionNode.body, {
    BinaryExpression(node) {
      const left = observationOperand(node.left, parameter, domains);
      const right = observationOperand(node.right, parameter, domains);
      const literal = node.left.type === "Literal" ? node.left.value : node.right.type === "Literal" ? node.right.value : undefined;
      const observed = left ?? right;
      if (observed && literal !== undefined) {
        const operand = left ? node.left : node.right;
        const domain = comparisonDomain(operand, observed, domains);
        const ordering = [">", ">=", "<", "<="].includes(node.operator);
        if (ordering && domain !== "integer") diagnostics.push(diag("L4", sourcePath, `Ordering comparison requires integer domain: ${observed}`, node.loc?.start));
        if (literal === "UNKNOWN" && memberChain(operand)?.slice(1).join(".") === observed) diagnostics.push(diag("L4", sourcePath, `Comparison uses reserved version-5 sentinel string UNKNOWN: ${observed}`, node.loc?.start));
        if (!validateDomainValue(domain, literal).ok) diagnostics.push(diag("L4", sourcePath, `Comparison literal is outside ${observed} domain: ${JSON.stringify(literal)}`, node.loc?.start));
      }
      if (left && right && domainClass(comparisonDomain(node.left, left, domains)) !== domainClass(comparisonDomain(node.right, right, domains))) diagnostics.push(diag("L4", sourcePath, `Comparison domains are incompatible: ${left} and ${right}`, node.loc?.start));
    },
    CallExpression(node) {
      if (node.callee.type !== "MemberExpression" || node.callee.computed || node.callee.property.type !== "Identifier") return;
      const observed = observationOperand(node.callee.object, parameter, domains);
      if (observed && ALLOWED_MEMBER_CALLS.has(node.callee.property.name) && domainClass(domains[observed]) !== "array") {
        diagnostics.push(diag("L4", sourcePath, `Member call ${node.callee.property.name} requires a list domain: ${observed}`, node.loc?.start));
      }
    }
  });
}

function observationOperand(node, parameter, domains) {
  if (node.type !== "MemberExpression" || node.computed) return null;
  const chain = memberChain(node);
  if (!chain || chain[0] !== parameter) return null;
  const raw = chain.slice(1).join(".");
  return Object.keys(domains).filter((field) => raw === field || raw.startsWith(`${field}.`)).sort((a, b) => b.length - a.length)[0] ?? null;
}

function comparisonDomain(node, field, domains) {
  const chain = memberChain(node);
  return chain?.at(-1) === "length" && domainClass(domains[field]) === "array" ? "integer" : domains[field];
}

function domainClass(domain) {
  if (domain === "integer") return "number";
  if (domain && typeof domain === "object" && !Array.isArray(domain)) return "object";
  if (typeof domain === "string" && domain.startsWith("list:")) return "array";
  return "string";
}

function memberChain(node) {
  const parts = [];
  let current = node;
  while (current?.type === "MemberExpression" && !current.computed && current.property.type === "Identifier") {
    parts.unshift(current.property.name);
    current = current.object;
  }
  if (current?.type !== "Identifier") return null;
  parts.unshift(current.name);
  return parts;
}

function buildCallGraph(functionNodes) {
  const graph = Object.fromEntries([...functionNodes.keys()].map((name) => [name, []]));
  for (const [name, node] of functionNodes) {
    walk.simple(node.body, { CallExpression(call) { if (call.callee.type === "Identifier" && functionNodes.has(call.callee.name)) graph[name].push(call.callee.name); } });
    graph[name] = [...new Set(graph[name])];
  }
  return graph;
}

function findCycles(graph) {
  const cycles = [];
  const visiting = new Set();
  const visited = new Set();
  const visit = (node, path) => {
    if (visiting.has(node)) { cycles.push([...path.slice(path.indexOf(node)), node]); return; }
    if (visited.has(node)) return;
    visiting.add(node);
    for (const next of graph[node] ?? []) visit(next, [...path, node]);
    visiting.delete(node);
    visited.add(node);
  };
  for (const node of Object.keys(graph)) visit(node, []);
  return cycles;
}

function propertyName(node) {
  return node.type === "Identifier" ? node.name : String(node.value);
}

function diag(code, path, message, loc = null) {
  return { code, pointer: loc ? `${path}:${loc.line}:${loc.column + 1}` : path, message, hint: null, level: "error" };
}

function deduplicate(items) {
  const seen = new Set();
  return items.filter((item) => {
    const key = `${item.code}\0${item.pointer}\0${item.message}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
