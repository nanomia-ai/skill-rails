# Building and connecting tools

This file shapes a tool once the entry's criteria have chosen one; it does not make any step a tool on its own.

## Declaring and delivering

A tool is one file or one folder inside the package root, declared once in the manifest's `tools` under an ID of lowercase words joined by hyphens, and listed in the `tools` of each target that ships it. The build copies it byte for byte — scripts, helpers, data, and binary templates alike — to `scripts/<id>.<extension>` for a file or `scripts/<id>/…` for a folder, keeping the folder's inner layout; a tool finds its own files relative to its own location, never from the working directory. Links, empty folders, paths outside the package root, and a delivered path that collides with another artifact fail the build. Keep development tests and scratch files outside the declared file or folder, since everything inside it ships.

## Shape the tool for its job

When the AI needs facts gathered across many files or from git, give it a read-only tool that returns them in one call, says what it could not read instead of reporting it as absent, and leaves the decision to the prose.

When a finished artifact must satisfy rules a machine can decide, give it a checker that reports every violation it finds — where, which rule, and what would fix it — and reports what it could not parse instead of skipping it. The prose has the AI fix what is reported and run the checker again.

When a file must start from fixed names, IDs, or a skeleton, or a set of owned files must be created or removed together, give it a generator that does that and reports what it created; the AI fills in the meaning. A tool may also compute and write a finished file outright when every value in it is exact or was decided by the AI beforehand.

A tool that writes states its policy — create only, replace, or merge — checks its inputs before changing anything, reports what it changed and whether running it again is safe, and never writes inside its own skill folder, caches included (run Python with `-B`). When a broken tool could fail silently, keep a development test of the property it promises beside its source, outside the files it ships.

A tool runs where the skill is installed, so it states what it needs to run — Node.js, Python, a command-line program — and prefers that runtime's standard library to packages the host may not have.

## The core record

The target's `record` writes the AI's judged answer into one marked section of one declared text file — the managed region, between the lines `<!-- skill-rails:<region-id>:start -->` and `<!-- skill-rails:<region-id>:end -->`, where `<region-id>` is one lowercase kebab-case name, such as `weekly-changes`, that the renderer picks and writes identically every time, one region per file — leaving every other byte as people or other tools left it. It rechecks that nothing changed underneath, takes a lock, and rereads what it wrote. Declare it when a judged result must land in a file others also edit and a stale or lost write would do harm. If the result must go inside an existing hand-written section, or the file is one the skill owns whole, a JSON or binary file, or several files at once, write that safety into your own tool; record's guarantees do not carry over.

A `record` declares `domainConfig` with its `domainConfigSchema`, a `renderer`, a Node script that reads `{ currentOutputBase64, validatedAnswer, domainConfig }` as JSON on stdin and writes the whole new file to stdout — every byte outside the region unchanged and, when the file has no region yet, the current bytes, then a blank line unless the file is empty, then the region ending in a newline — the `answerContract` schema the AI's answer must match, and the project-relative `declaredInputs` and `declaredOutput`. The entry tells the AI to run `node "<skill-root>/scripts/run.mjs" initialize --project <project-root>`, read what it returns, fill the returned answer file, and run the exact `recordCommand` it returned; on an error, the AI follows the returned `nextAction`.

## Connect it to the prose

The entry or module that owns the step says when to run the tool, gives the exact command once from `<skill-root>`, the folder holding the skill's `SKILL.md`, and says what each kind of result means for the next step. The tool owns the rules it enforces and its argument details, and prints them with `--help` and in its errors.

The AI must see the form it writes before it writes it. Keep that form in one place: when it is large or changes often, have the tool print it as a skeleton or template and tell the AI to start from that; when it fits in a few lines, show it in the prose where the AI writes, and let the tool's check be the wall that catches any drift between the two. Do not re-explain the tool's internal rules as a second checklist.

If the tool and the prose disagree about a required action or result, do not bypass the tool or treat its verdict as permission. Stop that step, keep what was observed, and resolve the conflict at its canonical source before retrying. A pass proves only the checks the tool performed. Follow the tool's documented safe recovery; if recovering would mean guessing what was written or changing what the tool promises, stop and report the step as unverified. If the task permits separate handling of a case outside the tool's supported scope, distinguish that work from the checked cases and report what remains unverified; this does not permit bypassing a failed check or a write-safety boundary.
