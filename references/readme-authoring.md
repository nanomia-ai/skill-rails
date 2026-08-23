# Reader-first README authoring guide

Use this guide when the user asks for a README for a skill or asks to improve an existing one. It is a decision guide, not a rigid template. The user's requested audience, tone, structure, and emphasis always take priority.

The goal is simple: a person with no project history should be able to glance at the first screen, understand what problem the skill solves and how, then find enough evidence and instructions to decide whether to use it.

## The first-screen contract

Before the first detailed paragraph, let the reader answer four questions:

1. What is this?
2. What concrete problem does it solve?
3. What does it change mechanically or operationally?
4. What becomes easier or more reliable as a result?
Do not begin with the project's history, internal taxonomy, platform list, or a slogan that only makes sense after reading the rest of the document.

A strong opening usually contains:

- one plain sentence that states the product transformation;
- a compact problem → mechanism → result mapping;

The first example and start command should be easy to find, but they do not need to crowd the opening when the product needs a short explanation first.

For a complex skill, this pattern is often effective:

| Current problem | What the skill actually does | Immediate result |
| --- | --- | --- |
| A requirement is scattered across prose and conversation. | Record it as an individual item and link it to its implementation and check. | Omissions and change locations become visible. |
| The AI repeatedly interprets an exact rule. | Execute or validate the rule in code and test the result. | The same input is handled the same way across sessions. |
| The AI reloads the entire rulebook. | Return only the instructions and evidence requirements for the current state. | Prompt context shrinks and long-session drift is less likely. |

Adapt the rows to the real product. Do not reuse a mechanism the repository does not implement.

## Build the product model before writing

Do not draft a README directly from filenames or a feature list. First write short answers to this card:

```text
Primary reader:
Problem they already feel:
Failure process that makes the problem grow:
What the product changes:
What code or tests handle mechanically:
What still requires AI or human judgment:
What the AI sees during normal use:
What becomes easier to maintain:
Smallest convincing example:
Evidence already available:
Important limits or unverified areas:
First action a new reader should take:
```

If an answer is unclear, inspect the implementation, tests, and existing design documents. Do not fill the gap with an attractive but unsupported claim.

## Explain the cause, mechanism, and outcome together

A benefit without its cause sounds like marketing. A mechanism without its outcome sounds like internal documentation. Connect both.

Weak:

> Improves maintainability and reduces drift.

Stronger:

> Exact rules move from repeated prose into one code path and its tests. A maintainer changes the rule there and reruns the affected cases, while the using AI no longer has to reinterpret every paraphrase.

Use this sentence test:

```text
[Concrete subject] does [observable action] to [named input or artifact],
so [reader-visible result] changes.
```

Not every sentence must use that grammar, but every important claim should provide all four pieces nearby.

## Make mechanization visible

When mechanization is central to the product, say it early and show its boundary clearly.

Explain:

- which inputs are recorded;
- which rules code executes or validates;
- which cases tests replay;
- which result the AI receives;
- which judgment remains in prose because it cannot be calculated honestly.

Avoid vague substitutions such as “structured,” “aligned,” “optimized,” or “deterministic” when a concrete action can be named instead.

Weak:

> The design remains outside the conversation.

Stronger:

> Each user requirement is written to `intent.json`. A tracking file links it to the rule that implements it and the file section or test that checks it.

Weak:

> The agent receives a small current view.

Stronger:

> For the current state, the execution script returns allowed actions, forbidden actions, material to load, and evidence still required.

Weak:

> Rules have stable addresses.

Stronger:

> If the freshness threshold changes from 24 hours to 12, update the one definition that owns the threshold and rerun its related cases.

Use actual artifact and field names only when they help the reader verify the explanation. Define an internal term in ordinary language the first time it appears.

## Choose sections by reader need

Do not copy every section below into every README. Use the smallest set that answers the reader's real questions.

1. **Outcome-first opening** — the product transformation and compact problem/mechanism/result mapping.
2. **Problem process** — why the current approach fails as the skill grows.
3. **Concrete example** — one representative request or workflow before and after the skill is applied.
4. **Mechanism** — files, code, tests, or runtime behavior that produce the result.
5. **Modes or profiles** — only when readers must choose among them.
6. **Generated structure** — only files that help the reader operate or maintain the result.
7. **Installation and first use** — copyable commands and one realistic prompt.
8. **Verified scope** — what was actually executed, on which platforms or versions.
9. **Product boundary** — what the tool does not automate, intercept, or guarantee.
10. **Further documentation** — links for readers who need the full contract.

For a small judgment-only skill, the opening, one example, usage, and limits may be enough. A stateful skill may need a decision example and a compact state explanation. A migration tool may benefit more from a before/after example than from a component inventory.

The README explains the product. It does not replace the full design specification.

## Use examples before taxonomy

Readers understand a new category more easily after seeing one case.

When the product has profiles, levels, modes, or multiple output shapes:

1. show one ordinary use case;
2. show what the system creates or returns;
3. then explain how the available profiles differ.

In a comparison table, use reader questions as columns:

- When should I choose it?
- What files or behavior will exist?
- What does the using AI do?

Avoid columns such as “capability surface” or “alignment model” unless the document has already defined them and the distinction helps a real choice.

## Design visuals from the root cause

Use a visual only when it makes a relationship easier to understand than a short paragraph.

For a failure loop:

1. start with the original practice, not a late symptom;
2. show how the problem grows;
3. show the observable failure;
4. show why the usual fix feeds the loop;
5. branch to the product at the point where it changes the structure.

For example, start with “rules are kept in growing prose,” not “a rule was missed.” The missed rule is an outcome of the process, not its origin.

Every node must contain a concrete subject and action. A reader should understand the visual without decoding labels such as “design surface,” “current view,” or “alignment.” Keep the graph readable without zooming and remove a node if the same relationship is already obvious from an adjacent one.

Use:

- a table for exact mappings or choices;
- a flowchart for a failure loop or execution sequence;
- a tree for generated files;
- a short real output for an execution contract.

Do not use a visual merely to decorate the README.

## Write for a reader with no project history

Assume the reader does not know:

- why the project was created;
- what earlier versions attempted;
- which words are internal terms;
- how the repository is organized;
- which features are implemented versus planned.

Introduce a term by explaining the action first, then naming it if the name is useful:

> Fixed test inputs and expected results, called fixtures, replay each important branch.

Do not make the reader assemble a conclusion from distant sections. State the conclusion first, then supply the reasoning and evidence below it.

Prefer ordinary verbs: record, check, run, return, stop, ask, compare, create, and update. Use abstract nouns only when they shorten an idea the document has already made concrete.

Concise writing removes repetition; it does not remove the cause, mechanism, or result. Do not compress an explanation into slogan-like fragments that only an informed reader can decode. Keep the sentence that supplies necessary context, and cut the sentence that merely repeats it.

Keep the tone knowledgeable and direct. Avoid inflated claims, ceremonial language, repeated slogans, uniform sentence patterns, and sentences that sound precise but do not name an observable action.

## Preserve user voice and authority

The guide supplies defaults only. If the user specifies audience, tone, order, terminology, or material to exclude, follow that direction unless it would make a factual claim false.

When the user corrects one sentence, determine whether it reveals a document-wide pattern. Search the entire README for the same problem and repair every relevant instance. Do not limit the change to the quoted line.

If corrections accumulate, stop adding patches to the existing prose. Rebuild the affected section from the product model and remove superseded wording. A shorter coherent rewrite is better than layers of local exceptions.

Explain the product on its own terms. Do not name research projects, competitors, or sources of inspiration unless the user asks for that history or attribution is required. Reused ideas should appear as the product's concrete behavior, not as a comparison narrative.

## Keep claims inside the evidence

Separate these categories:

- implemented;
- checked by automated tests;
- exercised in a fresh-agent or real installation run;
- planned but not implemented;
- not yet verified.

Name the tested operating system, runtime version, installation path, model surface, or scenario only when the evidence supports it. A structural validator passing does not prove that a fresh AI will trigger the skill correctly or follow it through a long session.

State important limits in concrete terms:

Weak:

> This is not a security boundary.

Stronger:

> The runtime can mark `release` as forbidden, but it cannot physically prevent the host agent from calling a release tool.

Current platform support belongs near installation and verification. Do not describe the whole product as if it exists only for the platforms currently tested when the core design is platform-independent.

## Keep multiple languages equivalent, not literal

When the README has multiple language versions:

- keep section order, examples, commands, claims, and limits equivalent;
- write naturally in each language instead of translating word for word;
- preserve exact code identifiers and command syntax;
- update both versions in the same change;
- verify that neither version makes a stronger claim.

## Adaptive README blueprint

Use this only as a starting frame. Remove sections the reader does not need and rename headings in the reader's language.

```markdown
# Product name

[Language links]

[One sentence: what changes for the reader and the using AI]

| Current problem | What the product actually does | Immediate result |
| --- | --- | --- |
| ... | ... | ... |

## Why the problem grows

[Short explanation or one simple visual]

## One concrete example

[Representative input or old prose]

[Concrete transformation]

[Real output, files, or decision]

## How it works

[Mechanized rules, judgment boundary, context behavior]

## Choose the right mode

[Only if the reader must choose]

## Install and try it

[Verified commands]

[One realistic first request]

## What has been verified

[Executed evidence and exact scope]

## Boundaries

[What it does not do or guarantee]

## Further documentation

[Links]
```

## Authoring and review procedure

1. Read the user's request and current project instructions.
2. Inspect the implementation, tests, and canonical design sources.
3. Complete the product-model card.
4. Draft the first-screen contract before the detailed sections.
5. Add one example that makes the central mechanism observable.
6. Choose only the remaining sections the target reader needs.
7. Audit every abstract phrase: ask what file, input, code path, output, or reader action it means.
8. Audit every benefit: require a nearby mechanism and reader-visible result.
9. Audit every visual from the root cause and remove labels that need prior explanation.
10. Audit claims against current evidence and state unverified areas plainly.
11. Simulate a cold reader: after the first screen, can they explain what the product is, what problem it solves, how it works, and why it helps?
12. If another language is present, check claim and structure parity.
13. Validate Markdown, local links, and copyable commands.

## Completion checklist

- [ ] The first screen states the problem, concrete mechanism, and immediate outcome.
- [ ] Mechanically executed or checked behavior is visible, not hidden behind an abstract label.
- [ ] Judgment that cannot be mechanized honestly remains explicit.
- [ ] A reader needs no prior conversation to understand the main explanation.
- [ ] Every internal term is explained at first use or removed.
- [ ] At least one example shows actual input, output, files, or decisions.
- [ ] Visuals begin at the real cause and remain understandable on their own.
- [ ] Modes or profiles are assigned per skill or unit at the correct boundary.
- [ ] Installation commands match the currently supported paths.
- [ ] Verified claims and unverified areas are separated.
- [ ] Platform support is described as current support, not the product's identity.
- [ ] User-specified tone, exclusions, and priorities take precedence over this guide.
- [ ] Feedback was applied to the whole document wherever the same pattern appeared.
- [ ] Multiple language versions make equivalent claims.
- [ ] Links and commands were checked.
