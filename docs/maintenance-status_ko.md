# Skill Rails 유지보수 상태와 다음 세션 진입점

문서 상태: 교체형 작업 snapshot

최종 갱신: 2026-08-29 KST

이 문서는 새 세션이 “마지막으로 어디까지 끝났고 어디서 이어야 하는가”를 빠르게 복구하기 위한 시작점이다. 제품 계약은 [제품·설계 정본](skill-rails_ko.md), 정확한 수치·지원 주장·V5 변경 근거는 [구현·검증 기록](implementation-verification_ko.md)이 소유한다.

이 파일을 일지처럼 계속 덧붙이지 않는다. 의미 있는 유지보수 milestone이 끝날 때 현재 상태로 교체한다. 과거 세션의 상세 chronology는 Git과 Orca 실행 기록에 맡긴다.

---

## 1. 저장소 기준선

- branch: `main`
- 기준 commit: `b277a4c` (`chore: release v0.1.2`)
- 이 tree에는 아직 commit하지 않은 유지보수 delta가 작업 tree에 landing되어 있다.
- 구현 delta가 건드린 경로는 다섯 개다: `references/authoring-workflow.md`, `scripts/lib/io.mjs`, `scripts/lib/maintenance.mjs`, `scripts/lib/semantic-diff.mjs`, `tests/authoring.test.mjs`.
- 작업 tree 전체 현황은 tracked 수정 11개와 untracked 추가 2개다. 위 다섯 경로 외의 tracked 수정은 Windows checkout portability correction인 `.gitattributes`와 `AGENTS.md`, `docs/implementation-verification_ko.md`, `docs/maintenance-status_ko.md`, `docs/skill-rails_ko.md`, `references/evaluation.md`의 문서 갱신이고, untracked 추가는 `fixtures/next-core-single-skill-pilot/` pilot subtree와 `docs/evidence/`다.
- `scripts/runtime/`, `schemas/`, `references/v5-contract.md`에는 변경이 없다.
- 최초 구현 기획과 통합 문서는 Git commit `4929b5b`에서 복구 가능하다.

이 저장소 밖 project는 작업 범위 밖이며 read-only다.

---

## 2. 마지막 완료 milestone

목적은 P2 package의 whole-file 유지보수를 임의 소스 덮어쓰기로 넓히지 않으면서, 등록된 typed artifact에 한해 hash로 잠긴 원자적 교체를 제공하는 것이다. 같은 milestone에서 declared-column evidence-credit pilot을 fixture로 확정했다.

완료된 구현:

- `replace-artifact` operation과 닫힌 registry: `spec`은 `spec.mjs`, `collector`는 `collectors/index.mjs`, `reference`는 `references/` 아래 기존 파일만 대상이며 셋 다 P2 전용이다.
- 적용 전 preflight가 미등록 kind, kind–path 불일치, profile 불일치, 형식 불량·stale `expected_hash`, 비-string content, generated 경로, 존재하지 않는 target, 한 transaction 안의 동일 physical file 중복, 비-portable 또는 비-canonical 경로 철자, symlink/junction 경로, 비정규 entry를 거부한다.
- `replace-spec`는 `spec` kind로 정규화되어 기존 의미와 stale-hash 거부 문구를 유지한다.
- install 경계: 원본 fingerprint 계산 → stage 복사 후 동일성 확인 → operation 적용 → 전체 package build → build가 canonical artifact를 바꾸지 않았는지 확인 → install 직전 root fingerprint 재확인 → 원본을 captured backup으로 rename 후 시작 fingerprint와 대조 → 그 다음에만 stage 설치.
- 실패 시 captured backup을 삭제하지 않고 target/stage/captured_backup/installed/recovery 상태를 오류 메시지에 남긴다.
- semantic diff가 `artifact_receipts`, `source_changes`, `any_changed`를 추가하고 기존 `spec_hash`·`changed`·`groups` 의미를 유지한다.
- package 순회가 symlink·junction·비정규 entry를 명시적으로 거부한다.
- declared-column pilot: 검증자가 돌려준 task, snapshot, selection locator, 선택 byte SHA-256, continuation, 기록된 currentness, verdict를 갓 수집한 사실과 대조해야만 pass가 credit된다. 은퇴한 continuation receipt·singleton recorded-JSON·합성 runtime-state fixture는 남기지 않았다.
- pilot collector가 project root와 선택 경로를 canonical하게 해석한 뒤 containment를 검사하므로, 상위 traversal·symlink·junction 탈출은 hashing 전에 fail-closed된다.

P0/P1 profile, conditional guidance, P2 `spec.mjs` 계약, V5 runtime, obligation ledger, 생성 package shape는 바꾸지 않았다. 하나의 authorized writer가 package root를 단독 소유한다는 전제는 이번 원자성의 명시적 경계이며, capture 이후에도 계속 쓰는 out-of-band writer에 대한 보존은 주장하지 않는다.

---

## 3. 마지막 검증

이번 delta에 대해 실제로 관찰한 것:

- pilot package 대상 root full lint L0–L18 pass, 진단 없음
- pilot package 대상 formal build: mutation 20/20, scenario 10/10, 50회 반복 불일치 0, format round trip 256/256과 CR/LF 거부
- 저장소 밖 임시 복제본에서 같은 build를 재실행해 in-repo package와 파일 차이 없음
- 생성 package 내장 lint pass, real-state e2e 2/2 pass
- manifest 선언 hash 51개(content 15 + generated 36) 확인
- fresh Windows `npm ci`는 pass했고, 이어서 실행한 full `npm run verify`도 pass했다. 세부 receipt는 vendor pass, lint pass, repository test 52/52 pass, eval clean control valid, fixture probe 10 total / 3 divergences, seeded defects 5/5 검출, required run 8/8 충족, empirical gate pass다.
- 최초 full verify의 두 실패는 migration semantic-unit test와 G0.5 scorer test였다. 둘 다 행동 결함이 아니라 raw-byte fixture·corpus·scorer helper가 CRLF checkout으로 바뀐 portability defect였고, `.gitattributes`의 다섯 `-text` pattern으로 현재 92개 matched tracked path를 보호한 뒤 닫혔다. 사전에 worktree·index diff가 없음을 확인한 그 경로들만 index LF byte로 복원했으며 protected path에는 수정이 남지 않았다.

유지보수 delta에는 bounded test 두 건이 추가되어 registry·경로·hash·원자성·junction 거부·legacy `replace-spec`·동시 쓰기 감지와 semantic diff effect 인자 변화를 덮는다. 이 test들은 위 fresh repository test 52/52 pass에 포함되어 관찰되었다.

아직 관찰하지 않았고 따라서 `UNPROVEN`인 것:

- commit, push, 설치, 배포
- 최종 declared-column package에 대한 fresh-agent 행동(trigger 선택, 지시 준수, 출력 품질)
- 사용할 수 있는 project-local orchestration channel이 없어 관찰하지 못한 Decision. 이는 제품 실패가 아니라 `UNPROVEN`이다.
- out-of-band writer가 계속 쓰는 상황에서의 package 보존
- POSIX symlink 분기(이번 실행은 Windows junction 분기만 관찰)

이전 release에서 관찰한 수치를 현재 tree의 결과로 인용하지 않는다. 정확한 receipt와 그 재현 명령은 [구현·검증 기록](implementation-verification_ko.md)이 소유한다.

---

## 4. 이번 maintenance 종료 상태

- typed-artifact 유지보수 구현과 bounded test landing 완료
- declared-column pilot fixture와 그 보고서 정합화 완료
- AI-facing reference, 제품 설계, 구현·검증 기록 갱신 완료
- V5 공개 계약과 runtime·schema는 불변
- 코드 blocking finding 없음
- structural/staging readiness는 `LANDING PASS`; commit/push, 설치, 배포, fresh-agent/live 행동은 아직 수행하지 않음

---

## 5. 다음에 할 일

정확한 다음 단계는 하나다.

1. exact allowlist를 지금 stage하고 commit 직전 status·staged diff·ignored-file 경계를 검증한다. 현재 status는 tracked 수정 11개와 untracked root 2개이며, pilot의 `.skill-rails/eval-cases.json`, `.skill-rails/intent.json`, `.skill-rails/obligation-ledger.json`, `.skill-rails/profile-decision.json` 네 파일은 force-add 대상이고 `.skill-rails/semantic-diff.json`은 ignored 상태로 stage하지 않는다. 이 staging/commit 검증 전에는 commit하지 않는다.

그 뒤에도 commit, push, 설치, 배포는 사용자가 명시적으로 요청한 범위에서만 수행한다. 배포 이후에만 최종 package에 대한 fresh-agent 행동 test를 수행하고, 그 결과를 [냉시작 행동 증거 카드](evidence/proof-03-cold-behavior_ko.md)의 대체물로 기록한다.

선택적 범위는 그대로 남는다: 추가 host의 fresh trigger와 실제 task output, Node 20 설치 smoke, Linux/macOS 경계, P0/P1 conditional guidance의 multi-match·no-match·near-miss, 실제 대형 기존 skill migration.

증거가 필요하지 않은 항목을 관성적으로 실행하지 않는다. 구조적 설치와 fresh AI 행동을 같은 지원 주장으로 합치지 않는다.

---

## 6. 새 세션 시작 순서

1. `AGENTS.md`와 `CLAUDE.md`를 읽는다.
2. 이 문서에서 마지막 milestone과 남은 작업을 확인한다.
3. `git status`, `git log`, 기준 commit과 실제 diff를 확인한다.
4. 제품 경계를 바꾸는 작업일 때만 `docs/skill-rails_ko.md`를 읽는다.
5. 지원·성공·V5 보존을 주장하거나 검증할 때만 `docs/implementation-verification_ko.md`를 읽는다.
6. 생성·마이그레이션·P2·평가·adapter·README 중 현재 작업에 필요한 `references/`만 읽는다.
7. deterministic 구조, model 행동, output 품질 evidence를 분리한다.
8. blocking finding이 아니면 코드를 추가하지 않고, finding이면 owning abstraction을 먼저 판정한다.

이 문서의 고정 shape는 위 여섯 절이다. 새 항목이 생겨도 일곱 번째 chronology 절을 추가하지 말고 해당 절의 현재 상태를 교체한다.
