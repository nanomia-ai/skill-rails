# Skill Rails 유지보수 상태와 다음 세션 진입점

문서 상태: 교체형 작업 snapshot

최종 갱신: 2026-08-29 KST

이 문서는 새 세션이 “마지막으로 어디까지 끝났고 어디서 이어야 하는가”를 빠르게 복구하기 위한 시작점이다. 제품 계약은 [제품·설계 정본](skill-rails_ko.md), 정확한 수치·지원 주장·V5 변경 근거는 [구현·검증 기록](implementation-verification_ko.md)이 소유한다. 과거 chronology는 Git과 Orca 실행 기록에 맡기고 이 파일에는 현재 truth만 둔다.

---

## 1. 저장소 기준선

- branch: `main`
- 작업 시작 기준 commit: `f8f42042c774a0276fd5d6f40013e6758039d8fc` (`feat: close P2 consumer path binding`)
- 작업 시작 시 `HEAD`, `origin/main`, `origin/HEAD`가 모두 위 commit이었고 worktree는 clean이었다.
- 현재 worktree에는 final installed-byte gate가 드러낸 두 bounded correction과 그 test·문서·canonical pilot rebuild만 있다. Commit, push, install, publish, release는 수행하지 않았다.
- `.codegraph/`는 이 checkout에 없어서 repository code 탐색에는 현재 owning source와 test만 사용했다.

---

## 2. 이번 correction의 owning boundary

### P2 skipped-`NEXT` fixture coverage

- `scripts/runtime/evaluator.mjs`의 optional internal observer가 evaluator가 실제로 실행한 guard match, stage entry, judgment branch selection, table-row selection을 기록한다.
- `scripts/runtime/api.mjs`의 fixture simulation만 observer를 전달하고, `scripts/lib/build-core.mjs`는 그 event를 기존 `guard:`·`unless:`·`stage:`·`branch:`·`row:` token으로 project한다.
- Build coverage는 더 이상 guard predicate를 재실행하지 않고 fixture fact나 final Decision에서 skipped branch를 추론하지 않는다.
- L14는 그대로 모든 guard/stage/branch/table-row claim을 요구한다. `done === true`인 stage는 branch event를 내지 않으므로 false skip claim도 계속 거부한다.
- Observer event는 final Decision에 들어가지 않는다. Decision schema, JSON bytes, `decision_id`, stage, row, effects, record/body/proof/reinvoke/`stage_artifacts`는 observer 유무와 완전히 같다.

### P0/P1 simple-lint provenance

- Universal intent atom은 계속 항상 읽는 `SKILL.md`에 원문으로 보여야 한다.
- `intent.description`은 frontmatter description equality를, routed judgment topic은 guidance index/topic text를 계속 검사한다.
- `file:`/`eval:` locator resolution, P1 helper 존재, generator의 `review-required` 기본값과 eval fail-closed gate는 그대로다.
- 제거한 것은 Rule V가 이미 보장하는 universal atom에 대해 canonical implementation target 파일도 같은 문장을 포함해야 한다는 중복 conjunct뿐이다. 따라서 target은 helper 같은 실제 구현을, evidence는 그 check를 가리킬 수 있다.
- 공개 authoring workflow의 기존 obligation-ledger 문단 하나를 이 경계에 맞게 교체했다. 별도 manual이나 parallel truth는 추가하지 않았다.

---

## 3. 현재 검증 receipt

- Targeted `node --test tests/runtime.test.mjs tests/integration.test.mjs`: 35/35 pass.
- Skipped-NEXT regression: valid claim build pass; missing `branch:preflight/skip` claim은 `L14 STAGES.preflight.branches.skip` fail; `done === true` fixture의 false claim은 build-core가 거부; observer 유무의 Decision JSON과 hash 동일.
- P1 regression: helper target에 intent 문장을 복제하지 않아도 discharge pass; review-required default와 `authoring-obligations-required` eval gate 유지; `SKILL.md` intent 삭제, topic text 삭제, description mismatch, unresolvable locator는 모두 fail.
- Canonical pilot root lint: L0–L18 pass.
- Canonical pilot formal build (`--repeats 50`): mutation 20/20, scenario 10/10, 반복 불일치 0, format round trip 256/256, build ID `sha256:b0bfffa83c9c4510f46a89936be40c41c4e874ab15eb7bcd7684096e73f082a3`.
- Pilot manifest closure: content 15 + generated 37 = 52, verification pass.
- Pilot embedded lint와 real-state e2e: L0–L18 pass, 2/2 pass.
- 논리 수렴 뒤 정확히 한 번 실행한 full `npm run verify`: vendor pass, lint pass, repository test 59/59 pass, eval clean control valid, fixture probe 10 total / 3 divergences, seeded defects 5/5 검출, required run 8/8 충족, empirical gate pass.

---

## 4. 여전히 `UNPROVEN`인 범위

- 이번 correction byte를 설치한 fresh P1 author가 declared consumption set만으로 obligation discharge를 끝내는 행동
- 이번 correction byte를 사용한 fresh P2 consumer의 skipped-judgment 경로와 source-free path discovery
- commit·push·설치·배포·release
- harness-trusted public effect observation과 verifier truthfulness
- long-session/compaction, 여러 모델 반복, Linux/macOS POSIX symlink 분기
- capture 뒤에도 계속 쓰는 out-of-band writer의 package 보존

Structural lint, deterministic build, fixture, manifest, e2e evidence를 fresh-agent 행동 evidence로 승격하지 않는다.

---

## 5. 다음 세션 진입

1. `AGENTS.md`, `CLAUDE.md`, 이 문서를 읽고 실제 `git status`와 `HEAD`를 확인한다.
2. 현재 diff가 이 문서의 두 correction, proportional test, workflow paragraph, generated pilot rebuild, 두 docs update와 일치하는지 검토한다.
3. 상세 evidence와 V5 보존 근거는 `docs/implementation-verification_ko.md` 6.9절과 7.2절을 확인한다.
4. 별도 사용자 승인 전에는 commit, push, install, publish, release를 수행하지 않는다.
5. Fresh behavior가 필요하면 corrected bytes의 별도 isolated author/consumer run으로 수행하고, deterministic receipt와 구분해 기록한다.
