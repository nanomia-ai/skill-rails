# Skill Rails 유지보수 상태와 다음 세션 진입점

문서 상태: 교체형 작업 snapshot

최종 갱신: 2026-08-29 KST

이 문서는 새 세션이 “마지막으로 어디까지 끝났고 어디서 이어야 하는가”를 빠르게 복구하기 위한 시작점이다. 제품 계약은 [제품·설계 정본](skill-rails_ko.md), 정확한 수치·지원 주장·V5 변경 근거는 [구현·검증 기록](implementation-verification_ko.md)이 소유한다. 과거 chronology는 Git과 Orca 실행 기록에 맡기고 이 파일에는 현재 truth만 둔다.

---

## 1. 저장소 기준선

- branch: `main`
- 현재 제품 구현 기준 commit: `126be238574e8fb1f34caa64e241fc93e5a079dd` (`fix: project exact format into owning effects`)
- 이 commit은 기존 consumer path binding과 final-gate correction 위에 exact-format 예시를 그 format을 소유한 effect에도 투영한다.
- Commit과 normal push, 공식 project-local 설치 검증은 완료했다. 설치본의 root self-lint, 생성 pilot L0–L18, 설치 pilot의 exact effect projection이 pass했다.
- Windows installer checkout의 일반 text 249개 전체는 byte-identical이라고 주장하지 않는다. `* -text`로 봉인된 생성 pilot 54개 파일만 Git blob과 54/54 byte-identical임을 확인했다.
- 별도 version·publish·release는 수행하지 않았다.
- `.codegraph/`는 이 checkout에 없어서 repository code 탐색에는 현재 owning source와 test만 사용했다.

---

## 2. 이번 correction의 owning boundary

### P2 exact-format effect projection

- `fixtures/formats.json`의 L15 golden `expect`가 `Decision.format.example`과 format-owning effect의 `format_example`에 같은 값으로 투영된다.
- Spec effect는 mutation하지 않고 Decision만 복제한다. Fixture를 읽을 수 없으면 기존 합성 example로 fallback한다.
- 별도 prose instruction이나 format 정본은 추가하지 않았다. WRITE effect 자체가 소비 위치를 소유한다.

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
- Canonical pilot formal build (`--repeats 50`): mutation 20/20, scenario 10/10, 반복 불일치 0, format round trip 256/256, build ID `sha256:932d2462f413afd8c40d58a68e40f0efa4bbcd65c8b0c47a4ee16b855ea53003`.
- Pilot manifest closure: content 15 + generated 37 = 52, verification pass.
- Pilot embedded lint와 real-state e2e: L0–L18 pass, 2/2 pass.
- 논리 수렴 뒤 실행한 full `npm run verify`: vendor pass, lint pass, repository test 60/60 pass, eval clean control valid, fixture probe 10 total / 3 divergences, seeded defects 5/5 검출, required run 8/8 충족, empirical gate pass.
- 공식 installer로 Codex와 Claude의 별도 project-local home에 설치한 249개 파일은 exact `770cd3755d23c17a626822079c47d17b8387b326` archive와 path·byte가 모두 같았다.
- Fresh Sol xhigh P1 author는 helper/test locator에 intent 문장을 복제하지 않고 11/11 helper test, full lint, held-out byte equality, `open_obligations: 0`, `forward-test-required`에 도달했다.
- Fresh Fable Max P2 consumer의 기존 `Decision.format.example` 복구에 이어, fresh Luna Max는 새 owning-effect `format_example`을 source inspection 없이 발견하고 verifier 실행, same-run reentry, `matching-pass / DONE`, final lane report까지 완료했다.
- Luna의 acquire alignment는 `partial`, REPORT 기록 뒤 final alignment는 `unproven`이다. Agent claim만 존재하기 때문이며 fail-closed evidence 경계의 의도된 결과다.
- 최종 경험적 판정은 `PARTIAL`이다. Fresh skipped-judgment와 tampered-Decision rejection, harness-trusted public effect observation은 직접 끝내지 않았다.

---

## 4. 여전히 `UNPROVEN`인 범위

- Fresh P2 consumer의 skipped-judgment branch와 tampered-Decision rejection
- 생성 P1 skill의 fresh trigger 선택, AI category 판단과 실제 첫 산출물 유용성
- 별도 version·publish·release
- 공식 installer 경로 자체에서 시작한 fresh AI 행동. 다만 그 설치본의 생성 pilot 54개 파일은 fresh Luna가 사용한 package와 byte-identical이다.
- harness-trusted public effect observation과 verifier truthfulness
- long-session/compaction, 여러 모델 반복, Linux/macOS POSIX symlink 분기
- capture 뒤에도 계속 쓰는 out-of-band writer의 package 보존

Structural lint, deterministic build, fixture, manifest, e2e evidence를 fresh-agent 행동 evidence로 승격하지 않는다.

---

## 5. 다음 세션 진입

1. `AGENTS.md`, `CLAUDE.md`, 이 문서를 읽고 실제 `git status`와 `HEAD`를 확인한다.
2. `HEAD`와 `origin/main`이 `770cd3755d23c17a626822079c47d17b8387b326`인지, worktree가 clean인지 확인한다.
3. 상세 deterministic·installed-byte evidence와 V5 보존 근거는 `docs/implementation-verification_ko.md` 6.9절, 6.10절, 7.2절을 확인한다.
4. 남은 empirical claim이 실제로 필요할 때만 한 번의 clean consumer-only run으로 skipped judgment, tamper, final REPORT alignment를 연결한다. Repository verify나 P1 authoring을 반복하지 않는다.
5. 새 product falsification이 없으면 현재 commit을 다시 설계하지 않는다. 별도 사용자 승인 전에는 version·publish·release를 수행하지 않는다.
