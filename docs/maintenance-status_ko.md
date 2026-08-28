# Skill Rails 유지보수 상태와 다음 세션 진입점

문서 상태: 교체형 작업 snapshot

최종 갱신: 2026-08-29 KST

이 문서는 새 세션이 “마지막으로 어디까지 끝났고 어디서 이어야 하는가”를 빠르게 복구하기 위한 시작점이다. 제품 계약은 [제품·설계 정본](skill-rails_ko.md), 정확한 수치·지원 주장·V5 변경 근거는 [구현·검증 기록](implementation-verification_ko.md)이 소유한다.

이 파일을 일지처럼 계속 덧붙이지 않는다. 의미 있는 유지보수 milestone이 끝날 때 현재 상태로 교체한다. 과거 세션의 상세 chronology는 Git과 Orca 실행 기록에 맡긴다.

---

## 1. 저장소 기준선

- branch: `main`
- 배포 기준 commit: `0b70194` (`fix: preserve generated package bytes across checkouts`)
- 작업 시작 시 `HEAD`, `origin/main`, `origin/HEAD`가 모두 `0b70194`였고 worktree는 clean이었다.
- `0b70194`는 `5ea44c2`의 typed-artifact 유지보수와 declared-column pilot 위에서 generated P2 package의 raw-byte checkout portability를 닫은 배포 기준선이다.
- 현재 worktree에는 fresh-consumer path discoverability gap을 닫는 미commit correction과 final-diff audit의 두 blocking runtime correction이 있다. `ARTIFACTS`를 path·writer·template의 단일 정본으로 유지하면서 `readers`가 선택된 stage/guard의 정적 소비 의존성을 선언하고, Decision schema 2의 `stage_artifacts`와 guide가 그 부분집합을 투영한다. Alignment는 supplied Decision의 self-seal과 runtime-emitted structural equality를 expectation보다 먼저 검사하고, evaluator는 judgment-only `NEXT` skip의 row·plan·dependent iteration state를 다음 stage에 넘기지 않는다. Runtime evaluator·alignment·validator·schema·generator, authoring 정본, canonical pilot과 proportional test가 이 변경을 함께 소유한다.
- `docs/next-core-compass_ko.md`는 이 clean revision에 존재하지 않는다. 존재하지 않는 문서를 continuation 정본으로 만들거나 내용을 추정하지 않는다.
- 이 저장소 밖 project는 작업 범위 밖이며 read-only다.

---

## 2. 마지막 완료 milestone

배포된 `0b70194`는 typed-artifact 교체, declared-column evidence credit, package-root `.gitattributes` byte ownership을 포함한다. 배포 뒤 독립 fresh consumer 실행은 trigger와 종료 가능성을 실제로 관찰했지만, 필수 artifact path가 mandatory consumption set에 없다는 반복 discoverability gap도 드러냈다.

관찰된 소비 행동:

- Sol은 `.selection-proof` 경로를 찾기 위해 coordinator 답변이 필요했다.
- Fable과 Luna는 둘 다 작업을 완료했지만, 정확한 observable artifact path가 `SKILL.md`, `enter`/`READ_FIRST`, 현재 Decision, 선택 body 또는 template에 없어서 generated package source를 검사해야 했다.
- 따라서 이 배포본의 fresh-consumer composition 판정은 `PARTIAL`이다. 완료 자체는 관찰됐지만, conversation-only 도움이나 authoring/source inspection 없이 닫힌 소비 경로는 관찰되지 않았다.
- Fable의 alignment reason 차이는 현재 evidence상 runtime defect가 아니다. Record와 alignment는 정확한 Decision에 묶이며, 재호출 뒤 새 Decision에 이전 Decision의 effect claim을 적용하면 `claimed-unplanned-effect`가 될 수 있다. Evidence는 reinvocation을 넘어 자동 승계되지 않는다.

현재 local correction은 관찰마다 artifact를 강제하거나 path를 별도 registry에 복제하지 않고 다음 owning surface를 고친다.

- `ARTIFACTS`만 project-relative path·writer·template을 소유한다. `writer`는 skill/declared role 외에 `external.*`와 `project.*` actor를 표현하고, `readers`는 기존 stage/role/project/external에 `guard.<id>`를 더한다.
- Runtime은 현재 선택된 `stage.<id>`와 실제로 멈춘 `guard.<id>` reader가 가리키는 정적 artifact만 `{id,path,writer,template}` 형태로 `Decision.stage_artifacts`에 결정적으로 정렬해 싣고 guide에도 투영한다.
- P2 authoring card와 workflow는 file-backed consumer dependency를 `ARTIFACTS.readers`에 선언하고 collector/e2e host가 같은 registry를 재사용하게 한다. Card나 collector source 자체는 소비 surface로 credit하지 않는다.
- Collector-backed observation이 모두 file은 아니므로 `OBSERVATIONS.artifact`나 `artifact:null` 의무를 추가하지 않았다. 현재 stage 선택 전에 필요한 동적 collector input을 일반화해 강제하는 것도 이번 경계가 아니다.
- Generated loader는 현재 Decision의 `stage_artifacts`와 선택된 body/template만 따르고 collector/authoring file에서 대체 path를 추론하지 않으며, exact-Decision evidence binding과 reinvocation 뒤 evidence 비승계를 명시한다.

Trace/alignment schema, observation source 종류, collector 이름 문법, cross-skill composition은 바꾸지 않았다. Alignment algorithm은 새 기대 종류를 추가하지 않고 exact-Decision admission을 fail-closed로 복구했으며, stage evaluator는 선택 bundle의 iteration locality를 복구했다. Decision schema는 `skill-rails/decision/1`에서 `/2`로 올라가므로 기존 P2 generated package는 canonical rebuild가 필요하지만 P0/P1 package에는 영향이 없다.

---

## 3. 마지막 검증

배포 기준선 `0b70194`에서 관찰된 결정적 receipt:

- full `npm run verify`: vendor pass, lint pass, repository test 53/53 pass, eval clean control valid, fixture probe 10 total / 3 divergences, seeded defects 5/5 검출, required run 8/8 충족, empirical gate pass
- declared-column pilot: L0–L18 pass, mutation 20/20, scenario 10/10, 50회 반복 불일치 0, format round trip 256/256과 CR/LF 거부, real-state e2e 2/2
- `core.autocrlf=true`와 `false` clone에서 sealed byte와 build ID 일치, tracked pilot package path `attr/-text`, manifest verification pass
- `0b70194` push·배포와 Sol/Fable/Luna fresh-consumer 실행 완료

현재 local correction에서 관찰된 targeted receipt:

- `node --test tests/runtime.test.mjs tests/authoring.test.mjs tests/integration.test.mjs`: 48/48 pass
- canonical pilot root full lint: L0–L18 pass
- canonical pilot formal build (`--repeats 50`): mutation 20/20, scenario 10/10, 반복 불일치 0, format 256/256, build ID `sha256:125adab7ef7a6e172272ada9dc247a8fdd9470c7d99fa649aa13f5b828a5bb11`
- pilot manifest closure: content 15 + generated 37 = 52, verification pass
- pilot real-state e2e: 2/2 pass
- selected stage/guard projection test는 현재 reader 교집합만 나오고 다른 stage artifact는 숨겨짐을 확인한다. Pilot falsification test는 필요한 `stage.acquire` reader 하나를 제거하면 fixture expectation이 L14로 실패함을 확인한다.
- alignment tamper regression은 `effects`, `proof_required`, `restrict`, `stage_artifacts`, `decision_id` 각각에 대해 API와 CLI가 expectations를 만들기 전에 critical `misaligned`로 닫힘을 확인하며 record exact-match 거부/수락도 함께 보존한다.
- skipped-judgment regression은 첫 stage의 `['NEXT']`가 다음 선택 stage의 stage·row·effects·record/body·proof·reinvoke·`stage_artifacts`에 잔류하지 않음을 확인한다.
- full `npm run verify`는 canonical build 뒤 정확히 한 번 실행했다: vendor pass, lint pass, repository test 58/58 pass, eval clean control valid, fixture probe 10 total / 3 divergences, seeded defects 5/5 검출, required run 8/8 충족, empirical gate pass

아직 관찰하지 않았고 따라서 `UNPROVEN`인 것:

- correction byte에 대한 fresh consumer가 coordinator 답변이나 package source inspection 없이 현재 stage의 required artifact path/grammar를 찾는지
- 여러 static input, non-file observation, stopping guard, skipped judgment stage, dynamic target, Decision tamper와 reinvocation을 연결한 audit 제안 fresh-agent stress scenario
- 이 local correction의 commit, push, 설치, 배포
- public lane에서 harness-trusted `effect_observed`; agent claim과 artifact verification만으로는 effect 실행 credit이 partial 또는 unproven이다.
- verifier가 실제로 검사한 사실의 정직성
- long-session/compaction recovery와 여러 모델·반복 실행의 통계적 trigger precision
- 비-Windows host의 POSIX symlink 분기
- out-of-band writer가 capture 이후에도 계속 쓰는 상황에서의 package 보존

Cross-skill import/composition은 `UNPROVEN`이 아니라 의도적으로 `unsupported`인 제품 비목표다. 위 `PARTIAL`은 배포된 단일 P2 package의 fresh-consumer composition 결과를 뜻한다.

---

## 4. 이번 maintenance 종료 상태

- 배포 기준선 `0b70194`와 배포 후 Sol/Fable/Luna 행동 evidence를 현재 truth로 반영
- repeated consumer path discoverability gap을 `ARTIFACTS.readers → Decision.stage_artifacts → guide` projection으로 닫고 authoring-only path source를 제거
- non-file observation에 artifact/null을 강제하지 않고, observation·collector 계약과 trace/alignment 의미를 보존
- record/alignment exact-Decision binding을 consumer-facing loader에 명료화하고 `alignDecision`의 self-seal·runtime-emission equality로 실제 fail-closed invariant를 복구
- judgment-only `NEXT` skip의 evaluator iteration state를 격리해 다음 selected stage의 Decision bundle을 일관되게 계산
- runtime/authoring/integration targeted test 48/48와 canonical pilot rebuild·manifest·real-state e2e pass
- canonical build 뒤 full repository verify를 정확히 한 번 실행해 58/58 pass; local correction은 review 가능한 상태이며 commit·push·설치·배포는 별도 승인 전까지 하지 않음

---

## 5. 다음에 할 일

현재 local correction, 두 blocker regression, canonical build와 full `npm run verify` receipt를 review한다. 이후 사용자가 별도로 승인한 경우에만 commit·push·설치·배포하고, 배포된 corrected byte에서 fresh consumer가 현재 Decision/guide의 `stage_artifacts`와 선택된 body/template만으로 artifact path와 grammar를 발견하며 collector/source inspection 없이 완료하는지 재실행한다. Audit가 제안한 chained stress scenario는 아직 설계뿐이므로 실행 전 별도 fresh-agent 범위로 유지한다.

선택적 empirical 범위는 long-session/compaction, 여러 모델 반복, Linux/macOS 경계, P0/P1 conditional guidance의 multi-match·no-match·near-miss, 실제 대형 기존 skill migration이다.

증거가 필요하지 않은 항목을 관성적으로 실행하지 않는다. 구조적 설치, fresh AI 행동, output 품질, trusted effect observation을 같은 지원 주장으로 합치지 않는다.

---

## 6. 새 세션 시작 순서

1. `AGENTS.md`와 `CLAUDE.md`를 읽는다.
2. 이 문서에서 배포 기준선, local correction, 남은 `UNPROVEN`을 확인한다.
3. `git status`, `git log`, `0b70194`와 실제 diff를 확인한다.
4. `docs/next-core-compass_ko.md`가 없음을 확인하고 없는 문서를 추정하지 않는다.
5. 제품 경계를 바꾸는 작업일 때만 `docs/skill-rails_ko.md`를 읽는다.
6. 지원·성공·V5 보존을 주장하거나 검증할 때만 `docs/implementation-verification_ko.md`를 읽는다.
7. 생성·마이그레이션·P2·평가·adapter·README 중 현재 작업에 필요한 `references/`만 읽는다.
8. deterministic 구조, model 행동, output 품질 evidence를 분리한다.
9. blocking finding이 아니면 코드를 추가하지 않고, finding이면 owning abstraction을 먼저 판정한다.

이 문서의 고정 shape는 위 여섯 절이다. 새 항목이 생겨도 일곱 번째 chronology 절을 추가하지 말고 해당 절의 현재 상태를 교체한다.
