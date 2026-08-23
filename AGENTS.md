# Skill Rails project instructions

These instructions apply to every change in this repository. The user's current explicit direction has higher priority than these defaults.

## Product intent

Skill Rails helps an AI create and maintain one standalone skill without keeping all behavior in growing prose.

- Record user intent and keep each requirement traceable to its implementation and check.
- Mechanize every rule that can be executed or verified reliably. Keep genuine interpretation and judgment in concise prose.
- Choose P0, P1, or P2 per skill, never for an entire plugin or repository. Use the smallest profile that still mechanizes the real repeatable behavior.
- For P2, keep `spec.mjs` as the only behavior source. The runtime calculates the current Decision; it does not perform the domain work or enforce host tool permissions.
- Missing evidence is `unproven`, not success. Structural validity is not proof of fresh-agent behavior.
- The core authoring model is platform-independent. Codex and Claude Code are the adapters currently implemented and tested, not the permanent product boundary.

## Change discipline

- Understand the whole authoring, generated-package, and using-agent flow before changing one local symptom.
- Prefer a coherent correction at the owning abstraction over accumulating special cases or parallel sources of truth.
- Do not silently weaken the V5 contract or reduce a rule that can be mechanized back into prose. A better design is allowed, but record what changed, why it is safer or clearer, and which evidence supports it in `docs/skill-rails_ko.md`.
- Preserve existing user changes and keep all writes inside this repository unless the user explicitly expands the scope.
- Never hand-edit generated files governed by `.generated.json`; change the canonical source and rebuild.
- Do not commit, push, publish, or deploy unless the user explicitly requests that action. Keep unrelated milestones in separate commits when the user asks for a checkpoint.
- If an implementation choice changes a product boundary, behavior contract, or irreversible action, stop and obtain the user's direction.

## README and public documentation

Before creating or revising a skill README, read [references/readme-authoring.md](references/readme-authoring.md) completely.

- Treat the guide as a quality and review protocol, not a fixed template.
- Lead with the concrete problem, the mechanism that changes it, and the immediate result.
- Name files, inputs, code paths, outputs, and checks instead of relying on abstract method labels.
- Make mechanical execution and the remaining judgment boundary visible when they are central to the product.
- Write for a reader with no project history. Define internal terms at first use.
- Apply user feedback to every similar pattern in the document, not only the quoted sentence.
- Keep English and Korean README claims, examples, commands, and boundaries equivalent while writing naturally in each language.
- Describe verified support and unverified areas separately. Do not turn current platform support into the identity of the product.
- Explain Skill Rails on its own terms. Do not include research or competitor provenance unless the user asks for it or attribution is required.

## Verification

- Run checks proportional to the change while iterating.
- For documentation, validate Markdown structure, local links, commands, language parity, and claim accuracy against code and tests.
- Before a release claim, run `npm run verify` and any required fresh-agent or installation tests. Report the exact verified scope and remaining unknowns.

## Canonical references

- `SKILL.md` — agent entry procedure and conditional reference routing
- `references/authoring-workflow.md` — creation and maintenance order
- `references/v5-contract.md` — P2 behavior contract
- `references/readme-authoring.md` — README authoring and review protocol
- `docs/skill-rails_ko.md` — complete product design, operation, and verification record
