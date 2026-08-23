# Blinded maintainer review — protocol v3

Inspect only the supplied artifact as a first-time maintainer. Find behavior defects. Report a defect only when you can cite its canonical artifact-relative file and one-based line, link one supplied witness question, give a concrete reproducing state, describe intended and actual behavior, select a general change type, identify whether lint assisted the finding, and state whether the defect is mechanically reproducible. Use `mutated-v3.md` as the form-A source path and `spec.mjs` as the form-B source path.

For each state question, separately select:

- `intended_answer_id`: the behavior indicated by the artifact's redundant contract evidence;
- `actual_answer_id`: the behavior the mutated artifact computes or states now.

Do not infer success from missing evidence. Do not consult sibling forms, clean controls, the oracle, previous reviews, result folders, repository history, project documentation, or conversation about seeded defects. Do not modify the reviewed artifact. Use only the repository command explicitly allowed for the supplied form.

Report the number of allowed artifact files read and allowed repository commands invoked. These counts are descriptive and do not affect the quality gate.
