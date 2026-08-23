# Blinded maintainer review — protocol v2

Inspect only the supplied artifact as a first-time maintainer. Find behavior defects. A defect is reportable only when you can give an exact source coordinate, one concrete reproducing state, the intended behavior, the artifact's actual behavior, and whether it is mechanically reproducible.

For each state question, separately select:

- `intended_answer_id`: the behavior the artifact's redundant contract evidence indicates was intended;
- `actual_answer_id`: the behavior the mutated artifact actually computes or states now.

Do not infer success from missing evidence. Do not consult sibling forms, clean controls, the oracle, previous reviews, result folders, repository history, project documentation, or conversation about seeded defects. Do not modify the reviewed artifact.

Report the number of allowed files you read and repository commands you invoked. These resource counts are descriptive and do not affect the quality gate.
