# Skill Rails 구현·검증 기록

문서 상태: 현재 구현 범위와 evidence owner

## Claim 규칙

각 claim은 `proven`, `failed`, `unproven`, `out-of-scope` 중 하나다. 구조 검사는 AI 행동을, AI transcript는 host effect를, 성공 exit는 의미 진실성을 대신 증명하지 않는다. 아래 proven은 명시한 bytes·host·scene·authority에만 적용된다.

## M0 — inventory, capsule과 clean-slate 전환

### Proven

- 시작 HEAD와 `origin/main`: `036932409e07806afe297136cb947604844073b6`
- Published `v0.4.3` commit: `f9ba22f6e498a43f166c6ef0e10a36d0c8e9e463`
- 사용자 계획 checkpoint: `9d35b75`
- Capsule member 257개, SHA-256 `c79dcf45dc9ab520aa100e19ecf6ef95102d1a423c89c5090cadd40293db31fc`
- Windows temporary-root restore 257/257, raw hash mismatch 0
- Active legacy source/test/fixture/eval/workflow와 사용자가 삭제 승인한 transient root 제거
- README 두 파일, `docs/assets/**`, Universal Framework와 두 동결 계획 보존

### Evidence와 unproven

- Evidence: `legacy/archive/v0.4.3/inventory.json`, `restore-receipt.json`, `legacy-source.tar`
- POSIX mode 복원은 `unproven`이다.

## M1 — deterministic standalone source/build

### Proven

- Closed source/target/build-receipt schema와 validator가 unknown field, duplicate JSON key, case collision, missing import, root/symlink escape를 fail-closed한다.
- LF canonicalization과 sorted canonical JSON으로 같은 source의 반복 build가 byte-identical하다.
- Generated target 단독 copy에서 repository나 sibling 접근 없이 integrity check가 동작한다.
- Authoring-side source currentness와 installed artifact integrity가 별도 상태다.
- `inspect`는 package/module/target/mechanism/artifact의 선언 관계만 exact ID/path JSON으로 반환한다.
- `authoring/skill-rails`에서 생성한 tracked `skills/skill-rails`은 source-current이고 npm payload는 implementation root를 포함하지 않는다.
- Repository active generated skill은 현재 production candidate `skill-rails` 하나이며 legacy import는 0이다. M1 당시 alpha identity였던 사실과 protocol namespace의 `skill-rails-next` 문자열은 historical evidence/closed contract로 보존한다.

### Cost receipt

`evals/m4/results/m1-m3-machine-cost-2026-09-13.json`의 현재 exact attribution은 M1 17개/56,932 bytes다. Pilot build 3회는 이 Windows/Node 24.18.0 실행에서 109.745~121.650ms였다. 경제적 승리 주장이 아니다.

## M2 — Verify prepare와 최소 AI interface

### Proven

- `PreparedWorkV1`, closed exchange, nonce 격리, deterministic semantic decision hash와 project-basis transplant 거부가 machine test를 통과한다.
- Fixture observer는 낯선 plan prose를 추론하지 않고 `unknown`과 reason code를 반환한다.
- Packet은 Purpose/Observed/Do now/Judgment/Read/Return/Done when/Authority and recovery의 여덟 블록을 생성한다.
- 외부 standalone copy에서 prepare가 동작한다.
- Codex CLI 0.148.0과 Claude Code 2.1.270 normal host의 treatment normal run은 entry에서 prepare를 먼저 실행하고 `PREPARE_FAILED` 전 fallback을 열지 않았다.

### Limits와 cost

- M2 attributed source는 14개/22,796 bytes다.
- Machine prepare 3회는 185.476~201.473ms였다.
- Prepare가 fresh-agent total context나 비용을 낮췄다는 주장은 **failed/unproven**이다. Paired normal에서 treatment input/context가 더 컸고 Claude는 packet 밖 구현·테스트 파일도 읽었다.

## M3 — semantic answer, renderer와 safe record

### Proven

- Answer schema는 unknown field와 evidence 없는 pass를 output write 전에 거부한다.
- Record는 input stale과 output conflict를 구분해 no-write하고, lock 안에서 renderer를 실행한다.
- Marker 밖 bytes, 기존 다른 card, absent/empty/LF/non-LF/CRLF bootstrap을 보존한다.
- Malformed/duplicate marker, duplicate card, renderer failure, non-UTF-8 stdout, exchange transplant와 output lock은 no-write한다.
- Staged replace 뒤 reread hash가 다르면 observed effect를 주장하지 않는다.
- 같은 answer 재시도는 `APPLIED_ALREADY`와 effect none이다.
- 전체 machine regression 34/34 pass.

### Cost receipt

- M3 attributed source 3개/15,668 bytes
- M3 당시 pilot target 20개/55,653 bytes, 그중 runtime+contracts 12개/44,554 bytes
- 이 host의 machine record: APPLIED 183.779ms, APPLIED_ALREADY 198.690ms, INPUT_STALE 102.080ms, OUTPUT_CONFLICT 190.366ms
- Error 두 장면의 output 전후 hash가 동일해 no-write가 관찰됐다. Fresh-agent 재평가 비용은 별도 M4 receipt가 소유한다.

## M4 — control 대 treatment pilot

### Protocol과 host

- Raw prompt: `Verify the bookmark-storage card in this project and record the result.`
- Codex CLI 0.148.0, `gpt-5.6-sol`, high, approve-for-me/workspace-write
- Claude Code 2.1.270, `claude-fable-5-1`, high, auto/no-prompt
- 표준 global installer를 사용했고 `CODEX_HOME`을 변경하지 않았다.
- Protocol: `fixtures/verify-v1/experiment-protocol.json`
- Reproducible harness: `src/evaluation/harness.mjs`. Fault target builder와 response-loss proxy도 평가 경계 안에만 있다.

### Proven

- Paired normal preflight에서 treatment 2/2가 canonical record를 만들었고 control 0/2는 각각 비호환 marker를 발명했다.
- Corrected unknown run은 card-id가 불명확할 때 성공 명령을 pass로 올리지 않고 `unproven`으로 기록했다.
- Input stale과 output conflict fresh runs는 첫 record가 no-write한 뒤 fresh prepare·재평가·APPLIED로 회복했다.
- Other-card Codex run은 기존 record payload와 marker 밖 prefix를 byte-preserved했다.
- Response-loss corrected run은 첫 실제 APPLIED 응답 유실 뒤 정확히 한 번 재시도해 APPLIED_ALREADY를 받고 같은 output hash를 유지했다.
- Command-failure corrected run은 nonzero exit를 제품 fail로 과장하지 않고 `unproven`과 이유를 기록했다.

### Failed evidence retained

- Unknown 최초 run: observer가 unknown인데 AI가 pass/APPLIED — `evals/m4/results/failed-unknown-codex-2026-09-13.json`
- Response-loss 최초 run: 실제 APPLIED 뒤 agent가 재시도하지 않음 — `failed-response-loss-codex-2026-09-13.json`
- 최초 command-failure run: packet이 동결 계획과 반대로 fail을 지시 — `failed-command-failure-claude-2026-09-13.json`
- 첫 fallback: treatment renderer를 찾아 lane 오염·guarded record 우회 — `failed-contaminated-fallback-claude-2026-09-13.json`
- Bounded fallback retest: treatment runtime은 피했으나 비호환 marker 발명 — `failed-fallback-format-claude-2026-09-13.json`

각 교정은 `docs/plan/implementation-evolution-plan_ko.md` E-015~E-017에 원인·대안·중단 조건을 남겼다. 실패 receipt는 성공 retest가 다른 bytes/행동을 증명하므로 삭제하지 않는다.

### Decision

`evals/m4/results/gate-decision-2026-09-13.json`의 결과는 **renderer-only**다.

- Acceptance 우선 gate에서 canonical renderer/record treatment가 normal control보다 우수했다.
- Accepted corrected runs에는 silent loss, stale write, observed authority 과장이 없었다.
- Prepare는 total context·비용 절감을 보이지 못했고 bounded read도 host 전반에서 안정적이지 않았다.
- Fallback은 treatment 승리에 합산하지 않으며 현재 부적합하다.
- 따라서 deterministic build와 renderer/record의 안전 원리만 다음 설계 후보로 유지하고 prepare를 확대하지 않는다.

### Evidence receipts

- `evals/m4/results/preflight-normal-2026-09-13.json`
- `evals/m4/results/treatment-recovery-scenes-2026-09-13.json`
- `evals/m4/results/other-card-update-codex-2026-09-13.json`
- `evals/m4/results/response-loss-retry-codex-2026-09-13.json`
- `evals/m4/results/command-failure-unproven-codex-2026-09-13.json`
- `evals/m4/results/m1-m3-machine-cost-2026-09-13.json`
- `evals/m4/results/gate-decision-2026-09-13.json`
- `evals/m4/results/raw/`의 harness capture

### Unproven/out-of-scope

- 통계적 일반화, 모든 scene×host×final-tree 조합과 다른 model/version
- Prepare의 경제적 승리와 Claude bounded-read 준수
- Renderer-only 제품 mode 자체의 구현·fresh 행동
- 9-target generator, Devflow production integration, M5 이후 authoring/maintenance/migration
- Publish/release와 public `latest`

## M5 선행 gate — renderer-only 최소 제품 경계

### 구현된 경계

- Canonical Verify target을 `record-only`로 전환하고 public runtime을 `check | initialize --project | record --exchange`로 닫았다. Generated tree에는 observer, packet, fallback, `prepare.mjs`가 없으며 `prepare` 호출은 `ARGUMENT_INVALID`다.
- Initializer는 declared input/output의 현재 raw basis와 package/target/project/receipt identity만 nonce exchange에 저장한다. Domain config, answer contract, answer scratch, input/output과 exact record command locator를 반환하되 작업 선택·observed facts·semantic decision·fallback state를 계산하거나 저장하지 않는다.
- `src/runtime/exchange.mjs`가 answer scratch와 staged exchange의 단일 owner이며 `src/runtime/record.mjs`가 두 mode의 CAS, lock, renderer spawn, managed-region 보존, staged apply와 reread authority 단일 owner다. Prepare-record는 명시적 M4 evidence fixture에서 decision hash를 추가하는 호환 경로로만 재현한다.
- 의미 기준, 완료 조건과 response-loss exact one-retry 규칙의 prose owner는 Verify target entry다. Config는 card/command, answer schema는 closed semantic return shape를 각각 소유한다.

### Proven

- 전체 machine suite 38/38 pass: deterministic standalone build, artifact integrity/source currentness 분리, mode별 runtime materialization, closed target/exchange/answer와 path/root containment, APPLIED/APPLIED_ALREADY, invalid answer, input stale, output conflict, lock, malformed marker, renderer failure/non-UTF8, 다른 card/marker 밖 bytes 보존, exchange transplant, response-loss용 idempotent retry, post-write reread mismatch의 fail-closed 동작.
- 표준 global copy installer가 tree `cf9ad62da45c925f12c63142dcf45d7603a1c591b020379c3739af6909c829cf`를 Codex와 Claude Code에 설치했고 양쪽 target runtime이 `ARTIFACT_INTACT`를 반환했다. `CODEX_HOME`은 변경하지 않았고 기존 global `skill-rails`는 설치 전후 63개 파일과 같은 task-local raw path+content hash였다.
- 동일 normal fixture의 fresh context에서 Codex 0.148.0과 Claude Code 2.1.270이 모두 installed entry → initialize → 반환된 declared inputs/config → 정확한 verification operation → closed answer → record를 수행했다. 두 결과 모두 `pass`, canonical `APPLIED`, post-write reread `observed`였고 기존 human prefix가 보존됐다.

### 비용과 좁은 판정

- 선언된 초기 read surface는 entry 2,051 + inputs 597 + domain config 174 + answer contract 1,800 + scratch 101 = 4,723 bytes(4 bytes/token 가정 1,181)다. Packet/observer/decision/fallback materialization과 호출은 0이다.
- Codex: 121,139ms, tool calls 13, input 234,580/cached 206,976/output 3,063/reasoning 1,285 tokens, exact USD unknown.
- Claude Code: 63,408ms, API 42,961ms, tool calls 5, input 132/cache-create 18,960/cache-read 173,383/output 1,892/thinking 228 tokens, USD 0.51947175.
- M4 normal prepare-record treatment보다 두 host의 tool call과 Codex input token, Claude 비용·시간은 줄었지만 Codex wall time은 늘었다. 두 host가 prepare 장치를 재현하지 않고 안전 record를 완료했다는 점은 renderer-only 최소 경계와 Framework 실험 진입을 지지한다. 한 seed의 시점 간 비교이므로 prose 대비 또는 일반 비용 우위는 주장하지 않는다.

### Failed/unproven/out-of-scope

- 이번 gate에서 새 host 실패는 없었다. M4의 prepare, fallback과 최초 실패 receipts는 삭제하거나 현재 성공으로 덮어쓰지 않았다.
- Fresh 행동은 normal 1 fixture × 2 host만 proven이다. Machine test의 recovery scene은 fresh AI 행동 증거가 아니며 다른 scene/model/version, 통계적 일반화, standard host hook/config의 인과 분리는 unproven이다.
- Response-loss one-retry는 canonical entry에 있고 APPLIED_ALREADY 기계 경로가 검증됐지만 이번 normal fresh host에 loss를 주입하지 않았다.
- Framework materialization과 L0 예비 실행은 시작됐지만 lane 비교·semantic/using-AI 판정은 닫히지 않았다. Product target과 adoption gate, Devflow 9-target/production integration, publish/release/public `latest`도 unproven 또는 out-of-scope다.

### Evidence receipts

- `evals/m5/results/renderer-only-boundary-gate-2026-09-13.json`
- `evals/m5/results/raw/codex-record-only-normal-captured.json`
- `evals/m5/results/raw/claude-record-only-normal-captured.json`
- 선택의 원인·대안·제거 조건: `docs/plan/implementation-evolution-plan_ko.md` E-019

## M5 Framework pre-gate — 중단·격리

### 관찰과 보존

- Framework whole original과 의미 요약을 만들지 않는 deterministic heading index는 canonical authoring source graph에서 generated `skills/skill-rails/references/`로 materialize된다. Build/currentness는 전달만 확인하며 Framework가 AI 행동이나 결과를 개선했다는 증거가 아니다.
- 첫 v1 예비 receipt는 L0 entry 오염, 불완전한 host 비용 집계와 harness/fixture 오류 때문에 lane gate에서 제외했다. 원본과 raw transcript는 `evals/m5/results/framework/`에 보존하고 `v1-classification.json`이 분류를 소유한다.
- Revision 2의 bounded Codex receipt는 fixture self-test가 protocol 부재로 실패해 `v2/fixture-classification.json`에서 superseded로 분류했다. Receipt와 raw는 덮어쓰지 않았다.
- Revision 3 matrix는 사용자 지시로 중단했다. 중단 전에 완료된 L0 product·bounded·recovery × Codex·Claude Code 6개 receipt는 모두 `validity=valid`, host exit 0과 `deliveryPass=true`를 기록한다. 시작만 된 L1 product 두 cell은 receipt가 없어 결과가 아니다.

### 판정

- **Proven**: 여섯 completed L0 격리 workspace에서 고정된 delivery 검사가 통과했고 receipt/raw가 남았다. Matrix 프로세스는 Ctrl-C로 종료되어 exit code 1이었으며 이후 새 cell을 실행하지 않았다. 평가 경로 격리 뒤 product owner targeted test는 23/23, authoring build와 분리한 integrity/currentness check는 통과했고, coherent 감축 종료의 default `npm test`는 한 번 실행해 27/27 pass였다.
- **Unproven**: L0/L1/L2 상대 품질·안전·비용, Framework의 실제 효과, heading index의 round-trip 절감, semantic acceptance, unfamiliar using-AI effect와 Product adoption. 여섯 L0 cell만으로 어느 lane도 선택하지 않는다.
- **격리**: Framework protocol, harness, receipt·분류 schema와 harness 자기검사는 `evals/m5/framework/`가 소유한다. 실행하지 않은 artifact-review schema와 review protocol은 제거했다. M4 prepare/fallback 재현 helper와 test는 `evals/m4/`에 두고 기본 `tests/*.test.mjs`에서 제외했다. 기존 M4 receipt와 fixture는 보존한다.
- **재개 경계**: L1/L2 bounded Codex 각 1회의 단독 screening도 동결된 lane 선택 조건을 판정하지 못해 실행하지 않는다. D-11의 L1 entry를 provisional·`unproven`으로 유지하고 비교 관찰은 실제 Product adoption gate의 fresh author/consumer 실행과 한 번에 합친다. 새 protocol/schema revision, 18-cell 재개와 대량 blinded/using-AI 검증은 사용자 확인 전 수행하지 않는다. Fresh two-host·semantic·using-AI 검증은 해당 adoption 또는 release gate에서 한 번만 수행한다.

### Evidence

- `evals/m5/results/framework/v1-classification.json`
- `evals/m5/results/framework/v2/fixture-classification.json`
- `evals/m5/results/framework/v2/l0-*-r3-seed1.json` 및 대응 `raw/`
- 결정·대안·제거 조건: `docs/plan/implementation-evolution-plan_ko.md` E-020, E-021

## M5 Product adoption gate — 단일 author→consumer 관찰 통과

### Candidate와 author evidence

- Fresh Codex author 1회가 `natural-language-pilot-product-next`를 manifest 선언, prose target descriptor, canonical entry의 3-file 최소 Product target으로 추가했다. Observer, packet, prepare, fallback, renderer, answer contract, durable semantic state와 core/schema 변경은 추가하지 않았다.
- 실제 fixture는 `fixtures/product-v1/project/pilot/product-request.md` 하나이며 기존 `pilot/brief.md`는 없다. Entry는 request 원문 보존, HTTPS-only boundary, storage location·retention period·import support의 `unknown`, no-invent와 exclusive-create/no-overwrite를 단일 prose owner로 둔다.
- Owner-targeted `tests/build.test.mjs`는 11/11 pass했다. Standalone Product tree는 `6b8aff91c9fcc86d6ec6a822c03fa8bc8af8987261be0715bcadbc244b93fe17`이고 artifact integrity와 source currentness는 true였다. Gate 종료의 default `npm test`는 한 번 실행해 28/28 pass했다. 이는 delivery와 deterministic build만 proven이다.

### Fresh Claude consumer와 effect reread

- 동일 tree와 input을 넣은 isolated project에서 task는 `Write the product brief for this project from pilot/product-request.md.`였다. 첫 interactive launch는 workspace trust prompt에서 멈춰 Orca가 `agent_prompt_stalled`, stage `dispatch_input`으로 종료했고 output은 없었다. 이 실패 receipt는 보존한다.
- 사용자가 계속 진행을 명시한 뒤 `claude --help`에서 `--print`의 trust-dialog skip과 Claude 고유 `bypassPermissions` mode를 확인했다. 동일 input hash와 installed tree를 다시 확인하고 fresh Claude Code 2.1.270/Fable high를 정확히 한 번 실행했다. Codex YOLO option이나 수동 UI 입력은 사용하지 않았다.
- Host는 installed skill을 발견해 entry와 request를 읽고 no-clobber create로 `pilot/brief.md` 하나를 생성했다. Coordinator reread의 output은 555 bytes, SHA-256 `c034188c8fb0de1a74d388ab7279dfb30325e782514df65e7eaa3212c1919e80`이며 request paragraph verbatim, HTTPS-only boundary, 세 unknown과 no-added-scope acceptance를 만족했다.
- 이 run은 tool call 3, entry+input read 2,249 bytes, wall 29,368ms, API 15,546ms, USD 0.402299였다. 무관한 startup hook 본문을 제외한 host event는 `evals/m5/results/raw/claude-product-adoption-captured.json`에 보존했다.

### 판정

- **Proven**: Fresh Codex author가 prose-only candidate를 만들고 targeted build/currentness를 통과했다. 사용자 재개 후 한 fresh Claude unfamiliar consumer가 installed entry를 따라 brief를 만들었고 fixed acceptance와 실제 reread effect를 만족했다.
- **Failed**: 최초 interactive Claude launch의 task delivery. 후속 성공이 이 실행을 삭제하거나 성공으로 바꾸지 않는다.
- **Unproven**: 반복성, 다른 fixture/model/version, interactive Claude behavior, Framework lane 상대 효과, prose-vs-renderer 반복 비용, shared-source differential currentness와 downstream stage adoption.
- Product prose-only는 이 pilot의 한 관찰 범위에서 채택한다. 이 승리를 다른 stage에 복사하지 않고 다음 M5 의존인 maintainer/source-graph 확인으로 돌아간다.

### Evidence

- `evals/m5/results/product-adoption-gate-2026-09-14.json`
- `evals/m5/results/raw/claude-product-adoption-captured.json`
- 결정·대안·재개 조건: `docs/plan/implementation-evolution-plan_ko.md` E-022

## M5 maintainer/source-graph gate — 부분 실패

- Fresh Codex maintainer는 exact Product `inspect`에서 package owner, 빈 imports/consumers, generated `SKILL.md`, 빈 mechanisms/I-O와 semantic-edge gap을 확인했고 package focus에서 두 실제 target을 찾았다.
- 그러나 requirement/check/effect owner를 찾는 과정에서 279-match 전역 검색, `.codegraph/` probe 실패 뒤 불필요한 CodeGraph 호출, shell command 결합이 발생했다. 최종 report도 PowerShell parse error에서 멈춰 626초에 dispatch를 종료했고 일곱 질문의 bounded completion은 실패했다.
- 실제 wrong owner/consumer 수정은 발생하지 않았고 기존 entry·test·receipt owner로 관계를 복구할 수 있어 colocated edge schema와 human projection gate는 열지 않았다.
- Verify safe-record의 CAS, output lock, post-write reread authority 옆에 D-14 test pointer가 없었던 것은 실제 넓은 검색과 연결됐다. Owning `src/runtime/record.mjs` 세 위치에 기존 targeted test 이름만 가리키는 한 문장 pointer를 추가했고 `tests/record.test.mjs` 13/13 pass를 확인했다.
- **Proven**: graph가 현재 선언 관계와 gap을 과장 없이 반환함, D-14 pointer 부재와 owning-code 최소 수정 가능성. **Failed**: fresh maintainer의 bounded 일곱 질문 완료와 command discipline. **Unproven**: 새 pointer의 실제 비용 절감, semantic edge·human projection의 필요성.
- Evidence: `evals/m5/results/maintainer-source-graph-gate-2026-09-14.json`, 결정·재개 조건은 E-023.

## M5 Direct adoption gate — 단일 author→consumer 관찰 통과

- Fresh Codex author 1회가 `natural-language-pilot-direct-next`를 manifest 선언, prose target descriptor, canonical entry의 3-file 최소 target으로 추가하고 Product 결과와 byte-identical한 555-byte `pilot/brief.md` fixture를 두었다. Review에서 표시 이름을 쓴 card identity 결함을 consumer 설치 전에 exact id `bookmark-storage`로 좁혔다.
- Standalone Direct tree `7182f869abb896dfc6ed160f7cd5c94687289cf793bd4542a8f030f74f0b2606`은 source-current이고 artifact-intact였다. Observer, packet, prepare, fallback, renderer, answer contract, durable semantic state와 core/schema 변경은 추가하지 않았다.
- 처음 준비한 predictable temp path가 semantic task 전에 다른 작업자 경로와 충돌했다. 그 root와 추가된 `.claude` subtree는 더 읽거나 수정·삭제하지 않았다. `mkdtemp`로 만든 새 root가 빈 상태이고 현재 사용자 소유임을 확인한 뒤 reviewed tree와 fixed fixture만 배치했으므로 semantic retry는 0이다.
- Fresh Claude Code 2.1.270/Fable high consumer 1회는 installed skill을 발견하고 output 부재를 먼저 확인해 brief를 읽은 뒤 noclobber exclusive create를 수행했다. Coordinator reread에서 `pilot/plan.md`는 395 bytes, SHA-256 `46ae192293d9c07a790e0052d66c6c5d825d2c2a87375514495c6f983005da29`였고 정확히 한 `bookmark-storage` card, one-user/stable-id/retrieve-same-HTTPS/null-unknown 행동, exact phrase, HTTPS-only boundary, 세 unknown과 no-added-scope를 만족했다.
- 이 run은 tool call 3, entry+input read 2,504 bytes, wall 26,733ms, API 14,438ms, USD 0.3978415였고 subagent와 permission denial은 없었다. Run 뒤 installed tree도 같은 hash로 artifact-intact/source-current였다.
- **Proven**: 이 pilot의 한 fresh author→consumer 관찰에서 prose-only Direct가 delivery, bounded behavior와 실제 reread effect를 만족했다. **Failed**: 없음. **Unproven**: 반복성, pre-existing-plan fresh no-write 장면, 다른 fixture/model/version, prose-vs-renderer 반복 비용, Work·Verify·Resume adoption.
- Evidence: `evals/m5/results/direct-adoption-gate-2026-09-14.json`, relevant host events는 `evals/m5/results/raw/claude-direct-adoption-captured.json`, 결정·재검토 조건은 E-024.

## M5 Work adoption gate — bounded 실사용 관찰 통과

- Prose-only Work entry 하나가 brief·plan·package·test의 실제 읽기, process-local `Map` source의 no-clobber 생성, exact `npm test -- bookmark-storage`, source reread와 progress 생성·reread를 소유한다. Production storage 위치·보존 기간·import는 unknown이며 observer, packet, prepare, fallback, renderer, schema, durable semantic state를 추가하지 않았다.
- Current standalone tree `3d9022408aa74d95a642a2be032964ab765fe76ad347a22b26a3cb50179824de`는 Codex와 Claude용 설치에서 artifact-intact/source-current였다. Fresh Codex Sol medium 주 관찰과 Claude Opus medium 비교 관찰은 같은 input hashes에서 installed skill을 발견하고 source/test/progress 흐름을 완료했다. Coordinator 재읽기에서 입력은 유지되고 source와 progress만 생겼으며 두 progress 모두 exact card·command·non-production boundary와 세 unknown을 보존했다.
- Fable high로 먼저 수행한 routine consumer 성공은 사용자의 model-allocation 교정에 따라 예비·misallocated evidence로만 보존하고 채택 baseline으로 쓰지 않는다. Fresh author의 shell discipline 위반과 Sol consumer의 instruction-path/quoting 실패도 성공으로 덮지 않는다.
- **Proven**: 이름 붙인 두 medium host의 한 관찰에서 practical Work behavior와 reread effect. **Failed**: author command discipline, Sol setup command 세 건, Fable routine 소비 배치. **Unproven**: pre-existing source/progress, concurrent writer race, 반복성, 다른 fixture/model/version, Verify·Resume adoption.
- Evidence: `evals/m5/results/work-adoption-gate-2026-09-14.json`, raw는 `evals/m5/results/raw/*work-adoption-captured.json`, 결정·재검토 조건은 E-026.

## M5 Verify adoption gate — provenance 실패 보존 뒤 current-tree 단일 관찰 통과

- Accepted Codex Work 산출물을 두 fresh root에 같은 hashes로 두고 current Verify tree `25798e8a916d8b0062427c3d38f100198e94cb2bda8e90f79d5bd1bfde21763a`를 project-local 설치했다.
- Codex Sol medium과 Claude Opus medium은 모두 project-local 사본이 아니라 같은 identity의 기존 user-level tree `cf9ad62da45c925f12c63142dcf45d7603a1c591b020379c3739af6909c829cf`를 선택했다. 이 tree는 artifact-intact지만 current source에 대해 source-current=false다.
- 두 host 모두 initialize→declared inputs/config→exact test 1/1 pass→closed answer→record를 완료하고 `APPLIED`와 file-reread observed effect를 냈다. Coordinator가 Codex report SHA-256 `8d448fb0885aad0adbb1d736c8263ff70e406e6f8604793b120377f0e609abd6`와 Claude report `74219e60151dfe7d31247b722a057b50a27a42c61bbfcb210641711f44668bae`를 재읽었다.
- 실행 entry/runtime/config/contract/renderer는 current tree와 byte-identical하고 차이는 generated metadata, package receipt와 test-pointer comments뿐이지만, 이는 current bytes의 delivery를 대신 증명하지 않으므로 최초 두 관찰만으로는 adoption을 올리지 않았다.
- 사용자 승인 뒤 별도 alpha `natural-language-pilot-verify-next`만 표준 global copy installer로 Codex·Claude Code 정상 위치에 current tree로 갱신했다. 두 경로가 artifact-intact/source-current였고 기존 `skill-rails`의 63-file path/hash 목록은 설치 전후 같았다. `CODEX_HOME`은 바꾸지 않았다.
- 정확히 한 fresh Codex Sol medium run이 current installed tree를 선택하고 accepted Work root에서 initialize→declared reads→exact test 1/1 pass→closed answer→record를 완료했다. `APPLIED`가 반환한 SHA-256 `7c6e3ce666036a04f2c3042dab44b979e630af4e46f30f1813d8d6f1c9d5d844`를 coordinator가 재읽었고 pass·세 unknown·입력 hash 불변과 post-run source-current를 확인했다.
- **Proven**: 현재 tree의 Codex 단일 installed-skill 행동과 reread effect. **Failed**: 최초 두 run의 stale identity 선택, Codex run들의 shell discipline과 current-tree run의 PowerShell parse 실패 두 건. **Unproven**: Claude current-tree behavior, 다른 fixture/model/version, recovery scene, 반복성, Resume adoption. Verify는 추가 반복하지 않는다.
- Evidence: `evals/m5/results/verify-adoption-gate-2026-09-14.json`, raw는 `evals/m5/results/raw/*verify-adoption-captured.json`과 `codex-sol-verify-current-tree-captured.json`, 결정 경계는 E-027.

## 현재 설치와 유지보수 시간

- 현재 record-only Verify pilot target tree: `25798e8a916d8b0062427c3d38f100198e94cb2bda8e90f79d5bd1bfde21763a`
- Verify official installer reported hash: `d0b559698c7e08a0ab872293308f36435fbac11868ad45f4f29850682dcd30ef`
- 마지막 packet 수정 시각부터 정상 global target 설치 mtime까지의 관찰 상한은 약 384.4초다. 중간 분석·receipt 작성 시간을 포함한 coordinator elapsed upper bound이며 순수 build/install benchmark가 아니다.
- 기존 전역 `skill-rails`는 최초와 같은 63개 파일, 같은 established raw-content tree SHA-256 `0deda16754f505fd3eb1df61a26b20ec5a329d75af8f700f5c67238aaae1184a`다. 이번 installer 전후에도 63개 파일과 별도 task-local raw path+content hash `367dc53fad3c5b35e23dbbe5fab294663f31072778891ec6b93165efe1b588ea`가 동일했다.

## M5 Resume adoption gate — 두 medium host의 read-only 관찰 통과

- Prose-only Resume target은 `pilot/brief.md`, `pilot/plan.md`, `pilot/progress.md`, `pilot/verification.md`만 현재 state source로 읽는다. 대화, source, test, runtime 또는 별도 state를 읽거나 project file을 쓰지 않으며 Product/Direct/Work/Verify/maintain 중 한 next action과 남은 unknown을 보고한다.
- Standalone tree `5c9ec7a14982b97559b8613be2c7058fc2db8d14dedbef6d0f72b54d7be5ae9f`는 Codex·Claude Code 정상 설치 위치에서 artifact-intact/source-current였다. 기존 user-level `skill-rails`의 63-file path/hash 목록은 설치 전후 같았고 `CODEX_HOME`은 바꾸지 않았다.
- Accepted Product→Direct→Work→Verify chain의 같은 artifact bytes에서 fresh Codex Sol medium과 Claude Opus medium이 installed Resume skill을 발견했다. 둘 다 정확히 네 artifact를 읽고 verified non-production 위치, next action `maintain`, storage location·retention period·import support의 unknown과 네 근거 경로를 보고했다. Coordinator의 전체 project path/hash 재읽기는 두 run 전후 byte-identical이어서 project write가 없었다.
- **Proven**: 이름 붙인 두 host의 이 complete-chain 한 관찰에서 installed-skill read-only behavior와 no-effect reread. **Failed**: Codex의 shell command 결합과 PowerShell batch-read parse failure 한 건. **Unproven**: missing·failed·unproven·conflicting·stale artifacts, 반복성, 다른 fixture/model/version, unguided recovery 대비 비용 절감.
- Evidence: `evals/m5/results/resume-adoption-gate-2026-09-14.json`, raw는 `evals/m5/results/raw/*resume-adoption-captured.json`, 결정·재검토 조건은 E-028.

## M5 종료 종합 — 구현 완료, 행동·비용 일반화는 제한

- 실제 Product와 Verify target을 각각 build한 뒤 Verify canonical entry만 바꾼 owner-targeted 검사에서 Product는 source-current를 유지하고 Verify만 stale이 됐다. 현재 둘 이상 target이 import하는 common purpose module은 없으므로 common-module consumer 전파는 `unproven`이며 이를 위해 dummy target이나 사용하지 않는 import를 만들지 않았다.
- Canonical authoring target은 tree `7e0c986256f01853fdf9a11848970aa305b920941b322342ef4182a5109fc531`로 rebuild했고 artifact-intact/source-current다. 다섯 pilot target도 모두 standalone build와 artifact-intact/source-current를 통과했다: Direct `7182f869...`, Product `6b8aff91...`, Resume `5c9ec7a1...`, Verify `25798e8a...`, Work `3d902240...`.
- Coherent M5 종료 시 default `npm test`를 정확히 한 번 실행해 29/29 pass했다. 이는 delivery, closed contracts와 deterministic safety를 증명하며 fresh behavior/effect를 대신하지 않는다.
- **Proven**: record-only safe boundary의 machine contract, 각 Product·Direct·Work·Verify·Resume gate에 적힌 좁은 fresh 관찰, 실제 Verify-only differential currentness. **Failed**: E-023 maintainer의 bounded 일곱 질문 완료, 기록된 host command/process failures와 최초 Verify stale identity 선택. **Unproven**: Framework lane 상대 효과와 비용 우위, common shared-module 전파, full fresh maintain traversal과 pointer 효용, stage별 반복성과 미관찰 recovery 장면, Devflow/다른 skill 일반화.
- 사용자 교정으로 중단한 18-cell matrix, 추가 verifier와 maintainer 재실행은 재개하지 않았다. 따라서 M5 구현은 이 증거 경계로 종료하되 동결 계획의 미관찰 행동·비용 주장을 완료로 과장하지 않는다. M6는 실제 67KB/148KB source pressure와 실제 consumer 역산 실패 여부에서 시작하며 자동 진입하지 않는다.

## M6 첫 단위 — 실제 Resume whole-module pressure

- Devflow Git object `fa05d8269cf8dda8035f2a48aaa95b6aef7641be`의 historical Resume entry, 67,205-byte common principles와 세 predicate source를 byte-identical하게 pressure package에 보존했다. 다섯 source 합계는 153,302B이며 synthetic padding이 아니다. Measurement-only active entry를 포함한 fixed initial read는 154,345B다.
- 한 `devflow-resume-pressure-next` prose target만 whole-module materialize했다. Generated tree `42e9b038127475b675179419ae021eba836c8bd4abbaccc9c4344d932396363e`는 standalone이고 Codex·Claude project-local 설치에서 실행 전후 artifact-intact/source-current였다. Historical path 문자열은 inert evidence 안에만 있고 active entry의 read dependency는 모두 local `references/`다.
- Initial build는 114.674ms, unchanged currentness check는 105.8857ms, 동일 source rebuild는 125.9657ms였고 rebuild tree hash는 같았다. 이 첫 단위만 놓고 보면 changed-source cohort나 redeploy 비용은 아직 측정하지 않았다. 이후 세-target changed-common 관찰은 아래 M6 순서 2에서 분리해 기록한다.
- Fresh Claude Opus medium은 다섯 source text를 tool cutoff 없이 읽고 no-write를 지켰다. Host usage는 input 100, cache-create 68,458, cache-read 173,877, output 1,718, 44,893ms, USD 0.8160395였지만 system·discovery·반복 cache가 섞여 source-only token 비용은 `unproven`이다.
- Fresh Codex Sol medium은 installed skill을 찾았지만 `ReadAllBytes` 결과를 text로 model context에 넣지 않고 byte count만 출력했다. Filesystem 153,302B read는 사실이나 semantic read가 아니므로 Codex full-context behavior는 failed다. PowerShell에 없는 hash API 호출 오류도 보존하며 retry나 wrapper를 추가하지 않았다.
- **Proven**: 실제 대형 source의 byte-identical whole-module delivery, deterministic standalone build/currentness, Claude 한 full-text read와 no-write, 좁은 machine 비용. **Failed**: Codex model-context read와 그 hash command. **이 첫 단위에서 Unproven**: context/품질 우위, exact source-only tokens, changed-source cohort, 두 번째 target, inverse impact, 9-target·production integration. Changed-common cohort는 이후 E-030의 세-target 관찰에서 좁게 닫힌다.
- Evidence: `evals/m6/results/resume-whole-module-pressure-2026-09-14.json`, 선택·재검토 조건은 E-029.

## M6 순서 2 — 세 target common/specific boundary pressure

- Historical Product·Work entry와 planning evidence를 Git object `fa05d8269cf8dda8035f2a48aaa95b6aef7641be`에서 byte-identical하게 같은 measurement package에 추가했다. Product는 common+planning, Work는 common+state, 기존 Resume는 common+state+verification+baseline을 materialize한다. 이 source는 pressure evidence일 뿐 architecture baseline·fallback·runtime·live import·answer key가 아니다.
- `inspect`는 `commonPrinciples`의 Product/Resume/Work 세 consumer, `statePredicates`의 Resume/Work 두 consumer, `planningEvidence`의 Product 한 consumer를 정확히 반환했다. 수동 source→consumer tracing 실패가 없으므로 inverse impact는 열지 않았다.
- 세 target build는 이 머신에서 146.6147ms, unchanged rebuild는 161.4289ms였고 Product tree `421ecf23...`, Resume `42e9b038...`, Work `12bfb4a6...` hash는 두 build에서 같았다. 모두 standalone artifact-intact/source-current였고 installed Product·Work tree도 host 실행 전후 같은 상태였다.
- Fixed initial read는 Product 86,154B, Work 99,916B, Resume 154,345B다. Fresh Codex Sol medium과 Claude Opus medium은 Product brief와 Work source/test/progress의 자연어 의미 작업을 target별 한 번씩 완료했고 coordinator reread에서 입력 hash 불변과 실제 output bytes를 확인했다.
- Codex input usage는 Product 473,029, Work 1,175,256 tokens였다. Claude의 cache-create/read 합계는 Product 233,489, Work 453,384 tokens였다. 이는 system·discovery·cache·tool 대화를 포함해 source-only 비용으로 귀속할 수 없다. Work Codex는 combined read truncation, malformed local path와 두 failed chunk command 뒤 같은 run 안에서 full read를 완료했다. 첫 Resume Codex 실패는 재시도하지 않았다.
- Canonical source를 바꾸지 않은 임시 복사본에서 common module에 newline 한 byte를 추가하자 기존 Product·Resume·Work tree 모두 artifact-intact를 유지하면서 source-stale이 됐다. 기존 build 한 번은 214.8074ms였고 새 세 tree 모두 artifact-intact/source-current가 됐다. 이는 세 consumer의 changed-common currentness 전파와 이 머신의 rebuild 비용만 증명한다.
- 실제 retained Fable 5.1 high audit `run_4816c4afff3e / task_7fb63040ace3 / dispatch ctx_d0c35bc1240c`의 read-only 결론과 Codex 판단은 whole-module delivery와 historical source granularity의 비용을 분리했다. Byte-identical historical prose의 전달 자체는 실패가 아니며, 현재 fixed read에서는 frozen minimal-read 조건이 충족되지 않았다. Prose 대비 총비용은 host 수치 오염 때문에 `unproven`이다. 네 번째 target은 common fixed read를 줄이지 못하고 actual tracing failure도 없어 inverse impact와 함께 열지 않는다.
- **Proven**: 세 실제 target의 one-owner common/specific graph, deterministic delivery/currentness, changed-common의 세 consumer 모두에 대한 stale 전파와 재build 복구, 네 단일 host run의 named behavior/effect. **Failed**: 이 historical granularity가 minimal-read 조건을 충족한다는 주장과 Work Codex의 값싼 안정 read. **Unproven**: 한두 target만 소비하는 module의 selective-stale 동작, source-only token 비용, unchanged prose 대비 총비용 우위, greenfield의 더 작은 source boundary, 반복성, 네 번째/9-target·production behavior.
- Frozen M6 채택 조건 중 independent delivery와 common 변경의 one-owner/all-consumer stale 검출은 통과했지만 minimal read는 미충족이고 전체 rebuild/redeploy를 포함한 산문 대비 총비용 우위는 `unproven`이다. Gate 전체는 통과하지 않아 현재 사용자 sequencing에 따라 순서 3~5와 M7을 시작하지 않는다. 이는 M7의 frozen dependency 실패가 아니다. M7은 core가 Devflow 용어를 갖지 않는다는 별도 의존을 가진다.
- Evidence: `evals/m6/results/three-target-common-specific-pressure-2026-09-14.json`, 선택·재검토 조건은 E-030.

## M7 — 비-Devflow domain의 bounded core generalization

- 진입 검사에서 `src/core`, `src/runtime`, `contracts`의 `stage`는 atomic build/exchange/record의 임시 filesystem staging 변수뿐이었고 `brief`와 `verification`은 없었다. 다만 `src/runtime/prepare.mjs`가 domain answer contract와 무관하게 `cardId`를 포함한 Verify-shaped field 목록을 packet에 고정해 안내하여 최초 dependency는 실패했다.
- 가장 작은 extraction으로 그 field 목록을 제거하고 domain-owned answer contract를 정확히 따르도록 한 문장만 mode-neutral하게 좁혔다. 새 schema·state·protocol은 만들지 않았고 historical prepare-record targeted test는 6/6 통과했다. 이후 core의 `cardId|card|brief|verification` 검색 결과는 0건이다.
- 실제 비-Devflow 예시는 museum-label editorial review 하나다. `evals/m7/editorial-review/`의 source graph는 observer, renderer, domain answer contract, 세 input과 한 output을 선언하고, standalone build는 tree SHA-256 `7e055de100a80aa20b968ce6979493f431cbfca7a830fd3e4ebae8a3a748ebea`로 artifact-intact/source-current였다.
- Coordinator-run Node 관찰에서 prepare는 domain fact 네 개와 `PREPARED`를 반환했고 generated packet에는 `cardId`가 없었다. Invalid answer는 `ANSWER_INVALID`와 no-write, valid answer는 `APPLIED`와 authoritative reread hash `3f4f0ec12c4c8572acbb091bdf7f12a18f9986ce58b2e0c25744957ed88929e5`, human prefix 보존을 보였으며 같은 exact record 재호출은 `APPLIED_ALREADY`였다.
- **Proven**: 한 비-Devflow domain에서 canonical source graph, observer, renderer, domain-owned answer contract와 generic runtime error를 기존 core/build/runtime으로 standalone 전달하고 machine-level apply/reread/idempotency까지 재사용했다. **Failed evidence retained**: 최초 core packet의 `cardId` 결합. **Unproven**: fresh AI discovery·semantic answer·editorial quality, 다른 domain·host·scene, prepare/fallback production adoption과 범용 behavior/effect.
- 상세 증거는 `evals/m7/results/editorial-review-generalization-2026-09-14.json`, 선택과 재검토 조건은 E-031이 소유한다. Full `npm test`, fresh host, install은 이 bounded gate에서 실행하지 않았으며 M8은 fresh audit와 사용자 승인 전에는 열지 않는다.

## M8 전 완결성 감사와 portable authoring 보정 — release-test 진입 가능, cutover 미준비

현재 alpha를 이름만 바꿔 production으로 승계할 수는 없다. 완결성 감사에서 확인한 portable authoring 결손은 optional prose capability `embeddedCoreTooling: "authoring-cli-v1"` 하나로 보정했다. Generated authoring skill은 이제 canonical CLI closure를 포함해 arbitrary project에서 repository·global runtime·network 없이 build/check/inspect/overview를 실행할 수 있지만, 이는 기계 delivery evidence이며 정상 설치 뒤 fresh authoring 행동과 종단 효과는 아직 `unproven`이다. 다음 scorecard의 `부분`은 구조 일부나 한 bounded observation이 있다는 뜻이며 전체 제품 claim 통과를 뜻하지 않는다.

| 요구 흐름 | 현재 evidence | 판정 | release 전 남은 것 |
| --- | --- | --- | --- |
| Authoring | M5 fresh author가 repository 안에서 Product target 하나를 저작했고, canonical `SKILL.source.md`가 목적·owner·prose/record-only 선택·검증 경계를 안내한다. Generated authoring skill은 고정 embedded CLI를 전달한다. | 부분 | 별도 project의 기계 실행은 통과했지만 정상 설치된 fresh AI의 authoring 품질과 종단 효과는 release test에서 확인해야 한다. |
| Deterministic build/currentness | M1 closed schema/build/receipt, M5 29/29 coherent suite, authoring target double-build와 artifact/source check가 있다. | proven(기계) | 최종 candidate에서 한 번의 coherent suite와 generated diff 검토가 필요하다. |
| Standalone install | M5의 개별 pilot target은 standard installer와 isolated host에서 current tree를 사용했다. Embedded CLI는 생성된 skill subtree 안에서 별도 source project를 build했고 sibling/global core나 network를 참조하지 않았다. | 부분 | Production identity의 authoring skill과 새 target을 같은 정상 설치 흐름에서 아직 증명하지 못했다. |
| Fresh use/effect | Product·Direct·Work·Verify·Resume는 각자 bounded fresh observation과 coordinator reread를 가졌다. | 부분 | 다른 fixture·반복·host breadth는 unproven이며 stage 승리를 일반화하지 않는다. Release에서는 한 실제 capability의 종단 흐름만 다시 본다. |
| Maintain/recovery | Exact inspect와 safe record recovery는 기계 evidence가 있고 Resume는 한 complete-chain fixture에서 통과했다. Fresh maintainer 일곱 질문은 넓은 검색과 command failure로 부분 실패했다. | 부분/failed retained | On-demand overview의 실제 human benefit, fresh maintainer의 bounded owner 수정과 stale/recovery 한 장면이 필요하다. |
| Framework navigation | Whole original과 heading index의 deterministic materialization/currentness는 proven이다. L0 6개 delivery 외 L1/L2 상대 품질·비용과 index 왕복 절감은 검증되지 않았다. | unproven(pre-gate) | Release task가 고위험 판단을 실제 요구할 때 §0/§0.1 self-routing과 read bytes를 한 번 관찰하며 별도 matrix를 만들지 않는다. |
| Exact source-graph inspect | Package/module/target/consumer/artifact/mechanism/I-O의 exact current view와 M6 three-target 관계는 기계적으로 통과했다. Undeclared requirement/check/external boundary는 gap으로 남긴다. | proven(선언 graph) | 자연어 의미·effect를 graph가 증명한다고 승격하지 않는다. 실제 tracing failure 전 inverse impact를 열지 않는다. |
| Human comprehension | 반복된 전체 구조 질문과 M5 maintainer 부분 실패가 D-13 수요를 열었다. `overview --source`는 현재 graph/build plan에서 한 non-authoritative Markdown view를 on demand로 계산한다. | delivery proven, effect unproven | 실제 사람이 관계를 더 빨리 이해하는지는 release audit에서 한 번 확인한다. 저장 문서·README·AI router로 복제하지 않는다. |

### D-13 projection evidence

- `src/core/human-overview.mjs` 하나가 package identity, entry description, module→consumer, target mode/source/import/mechanism/I-O, generated artifact와 대표 flow만 current graph에서 계산한다. Build artifact 목록은 별도로 재서술하지 않고 canonical `planTargetBuild`를 재사용한다.
- 출력은 stdout뿐이며 `generated/non-authoritative`, generator version, `sourceGraphSha256`, 표시 관계만의 `projectionInputSha256`, `current-at-generation`, source path check와 stale warning을 가진다. Generated skill, Framework heading index, AI runtime/router에는 들어가지 않는다.
- Authoring graph의 현재 `sourceGraphSha256`는 `0e416421fb0cce673a3d2fe7073f379fb483edaec257d37735fb1a57e7ecbdd6`, `projectionInputSha256`는 `6e20401ef6bd8a8fb5faca0442345b6b2fa81e7f5e19d687c3391e03451ff1e7`이다. Projection에 표시하지 않는 entry body 변경은 전자만 바꾸고 후자를 유지하는 기존 선택적 currentness 계약은 변하지 않았다.
- Targeted `tests/inspect.test.mjs`는 3/3 통과했다. Current authoring target은 tree SHA-256 `baea9a37b0b2c3c1983791a593bb418308414405ad83ffdeb8abe795e8dda88c`로 artifact-intact/source-current다. 이는 deterministic projection과 package delivery만 증명하며 human comprehension effect는 `unproven`이다.

### Bounded embedded authoring CLI evidence

- Prose target schema에는 optional `embeddedCoreTooling`이 추가됐고 허용값은 `authoring-cli-v1` 하나다. Non-prose mode와 다른 값은 closed schema에서 거부한다. 선언은 현재 authoring target 하나뿐이며 build는 targetId/packageId가 아니라 이 필드만 본다.
- `src/core/build.mjs`의 고정 목록은 `package.json`, `src/core` 10개, `src/runtime` 9개, `contracts` 7개를 상대 layout 그대로 `scripts/skill-rails-cli/`에 materialize한다. 구현 전 측정치는 27 files/98,878 bytes였고 owner/schema 변경을 포함한 현재 canonical payload는 27 files/100,392 bytes, sorted path·byte·hash row manifest SHA-256은 `b136454baa79874738521a96fc2824fac8a0a8a48fb074ac3bd8f3da8990a0c3`다. 모든 파일은 기존 receipt의 source/artifact hash와 tree hash에 들어간다.
- `tests/build.test.mjs` targeted 13/13은 exact closure와 receipt hash, unknown value와 non-prose rejection, generated skill-local CLI의 별도 project inspect/overview/double-build/check를 검증했다. Default `npm test`는 이 coherent 단위에서 한 번 실행해 31/31 pass했다. 이는 delivery, deterministic safety와 source currentness만 증명하며 fresh AI behavior, 정상 installer effect와 prose 대비 총비용은 증명하지 않는다.

### 정확한 release-test 계획

1. Portable authoring delivery는 E-033의 bounded embedded CLI로 선택했다. 두 번째 값·consumer·closure 또는 domain executable 수요가 나타나면 구현을 확장하지 않고 사용자 결정으로 되돌린다.
2. 현재 candidate의 canonical source와 generated target은 exact closure·receipt, isolated double-build/check와 coherent default suite를 통과했다. Release candidate가 고정되면 배포 전 generated diff와 source currentness를 한 번 다시 확인한다.
3. M0 capsule을 새 temporary root에서 inventory 257/257와 content hash로 복원 검사하고 active build/test/runtime가 archive를 traverse하지 않는지 확인한다. POSIX mode를 검증하지 못하면 계속 `unproven`으로 둔다.
4. 승인된 production identity의 exact commit/tree를 standard installer로 중립 Codex·Claude project에 project-local 설치하고 기존 global `skill-rails`와 `CODEX_HOME` 불변을 확인한다.
5. 같은 작은 비-Devflow capability로 fresh author가 목적·owner를 정하고 source를 작성해 deterministic build한다. 별도 unfamiliar consumer가 standalone target을 실제 사용하고, maintainer가 exact inspect와 on-demand overview로 한 bounded owner 변경을 한 뒤 rebuild/currentness와 stale 또는 recovery 한 장면을 닫는다.
6. Transcript, read bytes, tool calls, wall time, build/rebuild cost와 actual reread effect를 receipt에 기록한다. Structural pass는 behavior/effect로 승격하지 않고 prose-relative total cost가 여전히 불명확하면 `unproven`으로 둔다.
7. 위 결과를 fresh audit로 검토한 뒤에만 identity/`latest`/release cutover를 한 번 결정한다. Publish, 기존 global 교체와 archive 삭제는 각각 별도 승인·실행 경계로 유지한다.

현재 readiness 판정은 **portable delivery의 기계 경계는 닫혔고 release test를 설계할 증거는 충분하지만 production cutover는 준비되지 않음**이다. D-13 선택은 E-032가, embedded CLI의 선택·hard exit는 E-033이 소유한다.

## M8 pre-release end-to-end — produced-skill acceptance 통과, cutover 미실행

- 별도 일반 Git project에서 `npx skills@latest add <local-current-repository>`를 사용해 current `skill-rails-next`를 Codex와 Claude의 project-local 표준 위치에 설치했다. 두 설치는 generated tree `baea9a37b0b2c3c1983791a593bb418308414405ad83ffdeb8abe795e8dda88c`와 같고 artifact-intact/source-current였다. Remote publish, 수동 copy, global overwrite와 `CODEX_HOME` 변경은 없었다.
- Fresh Codex Sol medium은 installed entry와 embedded CLI로 두 prose target, 한 genuine shared module인 `community-workshop-communications` package를 만들었다. 두 독립 build는 accessibility `239badd...`, announcement `f908bb79...`로 각각 동일했고 inspect/overview/artifact/currentness가 통과했다. Observer, renderer, answer contract, state, 새 schema나 runtime은 추가하지 않았다.
- Shared owner `modules/fidelity-and-audience-safety.md`를 한 번 바꾸자 두 real consumer가 모두 `artifactIntact=true`, `sourceCurrent=false`가 되었고 두 affected target만 재빌드해 announcement `4aaeae42...`, accessibility `a7a4d72a...`로 current를 복구했다. Normal installer 재설치 후 Codex·Claude 위치 모두 같은 artifact hash를 가졌다.
- Fresh Claude Code 2.1.270/Opus medium bypass 1회는 두 installed target을 발견해 `outputs/announcement.md` 570B와 `outputs/accessibility-review.md` 921B를 만들고 input과 두 output을 reread했다. Coordinator reread는 두 UTF-8 effect와 factual restrictions, confirmed/unconfirmed 분리를 확인했다. Host wall time은 41,990ms, tool call은 11, file read는 always 6,081B와 completion reread 1,986B였다.
- Produced announcement target은 8 files/19,103B이며 domain prose 2,667B, standalone executable 12,206B, metadata/receipt 4,230B다. Accessibility target은 8 files/19,395B이며 domain prose 2,919B, executable 12,206B, metadata/receipt 4,270B다. Executable은 artifact check용 설치 payload이고 fresh using AI는 이를 읽지 않았다. 쓰기 전 필요한 실제 파일은 두 entry, 두 materialized shared-module copy, current input의 5개뿐이었고 Skill Rails 내부 호출은 0회였다. 두 target을 한 요청에서 함께 사용해 shared artifact 1,534B를 두 번 읽은 overhead는 있었지만, 이는 별도 owner가 아니라 독립 설치성을 위한 bounded generated copy이며 이 한 장면만으로 target 결합을 도입하지 않는다.
- 동결 concept §§2.7~2.10, 4.2~5.4, 10, 12, 13, 15, 19, 22에 대조하면 현재 output은 legacy 답안·중복 owner·semantic state·내부 workflow vocabulary를 들이지 않았고, AI meaning과 deterministic integrity/currentness를 분리했으며, 작은 비-Devflow consumer의 실제 behavior/effect만 주장한다. Standalone copy의 12,206B executable은 AI context가 아니며 한 owner 변경과 artifact/currentness 확인이라는 제거 비용이 명확하다. Framework는 authoring/audit reference로만 쓰였고 using target runtime이 아니며 그 인과적 효용은 계속 unproven이다.
- **Proven**: 이 한 project에서 정상 local-source installer, installed authoring entry와 embedded CLI, two-target deterministic build, one canonical common owner와 standalone artifact copy, two-consumer stale 전파와 affected-only recovery, unfamiliar Claude behavior와 실제 reread effect. **Output-side failed**: 없음. **Non-blocking authoring-process concern**: Codex input 468,994 tokens, unsupported CLI-help probe와 shell command discipline. **Unproven**: Framework navigation의 순이익, exact author tool-call/wall telemetry, authoring-process token attribution, 반복성·다른 도메인·public identity와 production cutover.
- Codex author raw stream을 durable file로 capture하지 않아 exact tool-call 수와 wall time은 재실행 없이 복원할 수 없다. 이 telemetry gap은 반복 실행이나 새 harness로 덮지 않는다. 높은 authoring input usage가 generated target의 크기·read path·경직성·semantic effect를 악화한 인과는 관찰되지 않았으므로 output acceptance와 혼동하지 않는다. 상세 evidence는 `evals/m8/results/pre-release-end-to-end-2026-09-14.json`, 결정과 재검토 조건은 E-034가 소유한다.

현재 판정은 **produced-skill pre-release acceptance 통과, release operations 미실행**이다. 남은 M8은 current candidate의 bounded final audit, coherent release commit/remote candidate 확인, 공식 `nanomia-ai/skill-rails` installer 검증과 identity/`latest`/global 교체/archive 각각의 승인뿐이며 author telemetry를 위해 이 flow를 반복하지 않는다.

## M8 final candidate audit — release candidate 통과

- Post-consumer input `inputs/workshop.md`는 495B, SHA-256 `e7de157a8fa01d370b86a3ff2a3c7fdd6b510f8da3179f2528eeccbef52d93c5`로 pre-consumer receipt와 같았다. Claude session `7a56f789-3067-4197-8b5b-d8febd72d735`는 `--no-session-persistence`로 실행되어 exact project session directory에 durable raw transcript가 없다. 따라서 host가 반환한 run metadata와 coordinator가 재읽은 output bytes/hash만 evidence이며 raw session authority는 주장하지 않는다.
- Canonical production identity는 private metadata `@nanomia/skill-rails@1.0.0`, target/entry `skill-rails`로 좁혔다. Closed schema/state의 `skill-rails-next` namespace와 historical pilot identity는 protocol/evidence이므로 이름 승계와 함께 바꾸지 않았다.
- Rebuilt generated authoring target `cab9710da8105611dbb56e8d5e4b8ca4c1721378feec1a30f646ed96690b4fc7`은 artifact-intact/source-current다. `npm pack --dry-run --json`은 39 entries, packed 63,826B/unpacked 227,085B이고 payload는 README, package metadata와 standalone generated skill만 포함하며 legacy/evals/tests/source repository root를 포함하지 않았다.
- Official public delivery는 npm registry package가 아니라 public GitHub repository `nanomia-ai/skill-rails`를 읽는 `npx skills@latest` 경로다. `@nanomia/skill-rails`와 alpha package는 registry에 없으므로 `npm publish`나 dist-tag를 발명하지 않고 root package는 private로 유지한다.
- Release-proportional `npm run verify`는 31/31 pass했다. 이는 candidate delivery·safety·source currentness만 증명하며 M8의 prior fresh behavior/effect 범위를 넓히지 않는다. Force/history rewrite, README 변경과 archive 삭제는 계속 승인 밖이다.

현재 판정은 **production candidate audit 통과, remote push와 공식 installer cutover 실행 전**이다. 상세 값은 `evals/m8/results/pre-release-end-to-end-2026-09-14.json`의 `finalCandidateAudit`이 소유한다.

## M8 production cutover — repository release와 설치 완료

- Coherent accumulated M5~M8 candidate commit `e321879dc3b1fbadf3677eb1eb06abb7d0f46551`(tree `f6bcf7479a8af9f11b9a4a57a31b0a8fb3113295`)을 기존 `origin/main`에 force 없이 `0369324..e321879` fast-forward했고 `git ls-remote`로 같은 remote head를 확인했다.
- 공식 delivery는 `skills@1.5.26`이 public `nanomia-ai/skill-rails` repository를 읽는 경로다. Installer resolved skill hash는 `9f8619d23436036ad31ebc069d4f5cf47a797b9e7fb9b9b011268448fda0d685`였고 npm package publish/dist-tag 작업은 없었다. Installer security summary는 Gen safe, Socket 1 alert, Snyk low였으며 이번 출력에는 alert 상세가 없었으므로 그 원인을 추정하지 않는다.
- 승인된 production 교체 전 두 host의 기존 `skill-rails`는 각각 63 files/1,028,325B였고, 교체 뒤 Codex `~/.agents/skills/skill-rails`와 Claude `~/.claude/skills/skill-rails`는 각각 36 files/201,705B, task-local path+content SHA-256 `52e4070a56545ba552a6cd9cf4e4ef2b7b23a1619012b8eeabbb11581f98c921`로 같았다. 두 skill-local CLI integrity check는 target `skill-rails`, tree `cab9710...`, artifact-intact를 반환했다. Installer는 이 skill 하나만 선택했고 post-install global list에는 기존 unrelated skill 7개가 남아 있다.
- 별도 일반 project `D:/Projects/Private/nanomia/skill-rails-production-smoke-20260914-e321879`의 Codex·Claude project-local 표준 위치에도 같은 36-file tree를 설치했다. Fresh Codex Sol medium은 `.agents/skills/skill-rails`, fresh Claude Opus medium bypass는 `.claude/skills/skill-rails`를 각각 발견해 skill-local CLI integrity check를 통과했다. 이 smoke는 discovery와 artifact check만 증명하며 M8 prior authoring/use/effect 범위를 넓히지 않는다.
- Codex smoke는 문서에 없는 `--help`를 두 번 시도한 뒤 entry의 문장과 CLI source에서 정확한 `check --out`을 찾아 통과했고 168,545 input tokens를 보고했다. 이는 authoring entry의 command-discovery 마찰과 host fixed-context concern이며 generated target 품질이나 이전 실제 effect를 실패로 바꾸지 않는다. 같은 실패가 실제 저작·복구를 막는 반복 evidence가 생길 때만 기존 CLI/entry owner의 최소 개선을 검토한다.
- `CODEX_HOME`은 `C:/Users/joinj/AppData/Roaming/orca/codex-runtime-home/home` 그대로였고 README, 두 동결 계획과 legacy capsule은 바꾸거나 삭제하지 않았다. Exact values와 좁은 claim은 M8 receipt의 `productionCutover`가 소유한다.

현재 판정은 **M8 production repository cutover와 정상 두-host 설치 완료**다. Broad host/domain repeatability, Framework의 인과적 이익, authoring-process 비용 효율, POSIX capsule mode 복원은 계속 `unproven`이다.

## Post-cutover practical closure — CLI 복구와 stale Resume 한 장면 통과

- 반복 관찰된 command-discovery 마찰을 기존 owner인 `src/core/cli.mjs`에서만 좁혔다. No-args, `help`, `--help`는 모두 exit 0과 동일한 짧은 synopsis를 내고 build/check/inspect/overview의 최소 호출형과 기존 argument error의 `nextAction` 경로를 알린다. Canonical authoring entry는 command 목록을 복제하지 않고 이 synopsis로 복구하는 방법만 소유한다.
- 기존 generated-authoring 별도-project test에 세 entrypoint의 실제 embedded copy 실행을 추가했고 targeted `node --test tests/build.test.mjs`는 13/13 pass했다. Canonical rebuild tree `978eb4f64d60eade4cd51e7aff058d88f7ccd6d3078b3b79164bb45f1f2dee16`은 artifact-intact/source-current다. 새 help schema, parser layer, tooling 값이나 runtime은 없다.
- 별도 일반 project의 prose-only `release-recovery-resume` target은 세 item과 네 state file만 읽도록 저작했고 generated tree `96741e5fab42993d37de0c05537789bcf2f6902a330e319193a829cf2358250c`로 두 독립 build가 같았다. Fresh Codex Sol medium 1회는 installed target을 골라 C1 auth-write pass/approval을 C2에 대해 stale/incomplete로 낮추고, C2와 독립인 operator-runbook 완료를 보존하고, test 미실행 retry-after를 pending/unsupported로 유지한 뒤 C2 auth-write test 실행 하나만 next action으로 반환했다.
- 이 consumer의 실제 domain read surface는 generated entry 1,664B와 state 네 파일 1,651B, 합계 3,315B였다. Worker 환경상 Orca/RTK 지침도 읽었지만 Skill Rails implementation internals는 읽지 않았다. 네 state file의 전후 SHA-256와 Git status는 동일해 project write가 없었다. Host가 total wall/read telemetry를 노출하지 않았으므로 여섯 exec wall time 외 값은 `unproven`으로 둔다.
- 이번 owner 변경의 실제 consumer는 production authoring target 하나뿐이므로 새 shared-currentness 장면을 만들지 않았다. M8의 genuine two-consumer owner-change evidence는 그대로 유효하지만 새 breadth로 올리지 않는다. `docs/authoring-lessons_ko.md`의 부재는 E-004의 의도된 active-tree 제거와 일치해 별도 manual을 만들지 않았다.
- 구현과 behavior evidence가 고정된 뒤 `npm run verify`를 정확히 한 번 실행해 31/31 pass했다. 이는 전체 repository의 구조·deterministic safety·currentness를 확인하지만 fresh recovery effect는 위 단일 관찰만 소유한다.
- **Proven**: shipped generated route의 no-args/help 복구, 이 한 stale/unsupported recovery scene의 unfamiliar behavior와 no-write effect. **Failed**: 없음. **Unproven**: 반복성, 다른 Devflow recovery·host·model, host-total 비용, Framework/index 인과와 shared-currentness 추가 폭. 상세 receipt는 `evals/m8/results/practical-closure-2026-09-14.json`이 소유한다.

현재 판정은 **한정된 실제 Devflow 적용을 즉시 시작할 수 있음**이다. 이 판정은 실패한 Devflow의 role renderer·`DISPATCH`·`project-state` observer·P2 spec을 Skill Rails 요구로 승계하지 않는다. 그 형식 아래의 실제 필요는 짧은 standalone entry, 한 shared owner, 현재 artifact에서의 AI 판단, 그리고 한 deterministic output에만 쓰는 record-only가 소유한다. 첫 실제 적용도 prose-first·한 owner·현재 근거 우선 경계를 유지하고, 그 결과를 broad recovery나 Framework 우위로 승격하지 않는다.

## Post-release real-use vertical slice — 두 host의 실질 개발·검증 effect 통과

- Public `origin/main`의 `ff25f7b`를 정상 `npx skills@latest add nanomia-ai/skill-rails --skill skill-rails --agent codex claude-code --copy -y`로 일반 별도 project `D:/Projects/Private/nanomia/rollout-lens`에 설치했다. 두 host의 authoring tree는 `978eb4f...`로 artifact-intact였고 `CODEX_HOME`은 바꾸지 않았다.
- Installed authoring entry와 CLI로 rollout 정책 변경을 위한 prose-only Plan·Work·Verify target 세 개를 저작했다. `rollout-policy` 한 source만 Work와 Verify가 import하고 두 generated copy의 SHA-256은 `52cdbc81...`로 같다. Exact inspect는 이 owner와 두 consumer만 반환했으며 double-build, source-current, artifact-intact와 양 host 설치 hash가 모두 일치했다. Observer, renderer, record/prepare, packet, fallback, durable state, 새 schema나 domain executable은 만들지 않았다.
- Fresh Codex Sol medium YOLO는 project-local Plan·Work skill을 찾아 plan, `src/evaluate.mjs`, 기존 test와 progress를 만들거나 수정했고 effect를 reread했다. Coordinator와 후계 maintainer의 독립 실행은 10/10을 확인했다. Fresh Claude Opus medium bypass는 같은 policy copy를 쓰는 Verify skill로 독립 decision-table test와 verification·recovery 문서를 만들고 reread했으며 source defect가 없어 production source를 바꾸지 않았다. Coordinator와 후계 maintainer의 최종 실행은 47/47, 약 0.19초였다.
- Generated entry는 Plan 1,229B, Work 1,559B, Verify 2,070B였고 Work·Verify의 조건부 shared reference는 각각 2,074B였다. 보고된 실제 file read를 현재/baseline bytes로 합산하면 Codex domain read는 28,863B, Claude는 35,075B이며 Git diff output과 환경 instruction은 포함하지 않는다. Codex host wall은 4분 18초, Claude는 2분 11초였다. Claude tool call은 17회, Codex는 transcript 47 entries에서 최대 23 round trip까지만 알 수 있고 exact split과 두 host token totals는 `unproven`이다.
- Codex의 Windows command recovery 세 건과 불필요한 두 번째 test 실행, Claude의 shell quoting 실패와 즉시 제거된 zero-byte stray file을 숨기지 않는다. Claude의 5,576B table 한 파일은 일부 기존 case와 겹치지만 allow-over-segment, exact bucket boundary와 validation-before-precedence의 다른 경로를 한 fast domain test에서 확인했다. 새 harness·schema·기계가 없고 결과를 줄이거나 다시 실행해도 adoption 결정이 바뀌지 않으므로 `mixed_not_blocking`으로 닫는다.
- **Proven**: 이 project에서 public final-byte authoring delivery, 세 standalone target, 한 shared owner와 두 consumer, Codex의 실질 plan·code·test·progress effect, Claude의 실질 test·verification·recovery effect, 양측·coordinator·후계 maintainer reread와 clean final commit. **Failed**: 없음. **Unproven**: unguided control 대비 인과적 비용·품질 우위, 반복성·통계적 host 안정성, token totals, 이 project에서 새 shared-owner edit의 stale/rebuild effect. 마지막 항목은 M8 기존 two-consumer receipt의 좁은 evidence를 반복하지 않는다.

상세 receipt는 `evals/m8/results/post-release-real-use-vertical-slice-2026-09-14.json`이 소유한다. 현재 판정은 **실제 Devflow adoption을 prose-first·한 owner·현재 artifact 우선으로 시작해도 알려진 Skill Rails redesign blocker가 없음**이다. 이는 broad Devflow 성공, Framework 우위나 비용 절감을 증명하지 않으며 첫 실제 두 target에서 큰 always-read shared module 또는 실제 multi-output/lost-update 필요가 생기면 기존 재개 조건으로 되돌린다.

## v1.0.0 문서·명칭 closure — 현재 역할과 역사 좌표 분리

- 선택형 판단 원문의 현재 역할에 맞춰 source path를 `docs/guide/ai-skill-evolution-method_ko.md`, authoring module id를 `skillEvolutionMethod`로 바꿨다. Generated target의 reference와 semantic-free heading index도 canonical build를 통해 같은 이름으로 바뀌었으며 generated 파일을 직접 수정하지 않았다.
- 현재 generated tree는 `e26b637ad076a66971cda8a18405262fc70d3320d9d590dcd3c4cd3fde17fcc7`, 36 files/202,763B이고 artifact-intact/source-current다. Authoring build와 repository boundary targeted test는 15/15 통과했다.
- 과거 M5 Framework protocol과 결과는 당시 이름의 evidence로 유지한다. Source path를 직접 여는 historical harness와 현재 authoring sentence anchor만 새 canonical 위치에 맞췄고 harness 자기검사 5/5가 통과했다. 새 lane, receipt, schema 또는 fresh-agent 실행은 만들지 않았다.
- 변경이 고정된 뒤 default `npm run verify`는 31/31 통과했고 별도 CLI check도 같은 tree를 artifact-intact/source-current로 확인했다. 이는 명칭·routing·deterministic delivery 회귀만 확인하며 기존 fresh behavior와 effect 범위를 넓히지 않는다.
- `AGENTS.md`가 동결 plan, Evolution ledger, current product, evidence, status, version review와 선택형 진화 방법의 수명주기를 한 maintainer route에서 구분한다. `docs/reviews/v1.0.0_ko.md`는 목적 대비 합격선과 확신의 범위를 owner 문서에 연결하는 완료 판단 기록이며 구현·증거 정본을 복제하지 않는다.
- 두 동결 plan이 가진 이전 guide 상대 링크는 frozen bytes를 수정하지 않고, 이전 path의 짧은 비정본 안내가 현재 `ai-skill-evolution-method_ko.md` 정본 하나로 연결한다. 이 안내는 authoring source graph나 generated npm payload에 포함되지 않는다.
- 비추적 empty `.agents/skills/`와 `.tmp/`는 파일 0개와 exact repository-local path를 확인한 뒤 제거했다. 이는 installed skill이나 legacy evidence 삭제가 아니다.
- Generated receipt의 기존 `packageId`, `packageVersion`, `coreVersion`, `targetId`, `treeSha256`를 source-side `check`와 installed `scripts/run.mjs check`가 함께 반환하도록 했다. 새 version 파일, module별 version, remote-latest 추정이나 registry dependency는 추가하지 않았다. Targeted build test 13/13은 source check와 standalone copied target 양쪽의 `natural-language-pilot@0.0.1`, core `1.0.0` 자기 식별을 확인했다.

이 closure는 기존 행동·effect·비용 evidence를 넓히지 않는다. 특히 진화 방법의 인과적 이익과 broad host repeatability는 계속 `unproven`이다. Root와 authoring package version은 새 architecture의 첫 안정 계약인 `1.0.0`을 유지한다. 이 검사 시점에 아직 수행하지 않았던 commit, push, Git tag와 host 재설치의 후속 결과는 다음 절이 소유하고, 명칭 결정과 재검토 조건은 E-036이 소유한다.

## v1.0.0 release closure — repository tag와 두 host 재설치 완료

- Release commit `213245ec9f711027431869e907d2d246d2cf41c6`을 `origin/main`에 non-force fast-forward했고 annotated tag object `ed9f931ae2a09da67e7ccc6704c2227abc6c7d9a`의 peeled commit이 release commit과 같음을 local과 `git ls-remote`에서 확인했다.
- 공식 전달 경로는 npm package publish가 아니라 README의 `npx skills@latest add nanomia-ai/skill-rails` repository install이다. `skills@1.5.26`으로 global scope에서 `skill-rails` 하나와 Codex·Claude Code를 명시해 설치했으며 installer skill hash는 `ec0d5e4c465c37bc359ff03ceef99a79bb3250fdb963b1e867179be39e6023f3`다.
- Codex의 `~/.agents/skills/skill-rails`는 installed directory이고 Claude의 `~/.claude/skills/skill-rails`는 그 exact directory를 가리키는 junction이다. 양쪽 view는 36 files/202,763B, receipt file SHA-256 `f3af08ec5587568bfe83684fbd0fa6ea4a603fe71c2d089aea86f204f4846344`로 같고 installed `check`가 `skill-rails-authoring@1.0.0`, core `1.0.0`, target `skill-rails`, tree `e26b637ad076a66971cda8a18405262fc70d3320d9d590dcd3c4cd3fde17fcc7`, `ARTIFACT_INTACT`를 반환했다.
- `CODEX_HOME`은 기존 `C:/Users/joinj/AppData/Roaming/orca/codex-runtime-home/home`에서 바꾸지 않았다. Installer assessment는 Gen safe, Socket 1 alert, Snyk low였고 출력에 alert 원인 상세가 없으므로 해석하지 않는다. 설치 전 discovery probe 하나는 installer가 `--list`와 `--json` 결합을 지원하지 않아 실패했지만, 지원되는 `--list`는 public repository에서 active skill 하나만 찾았고 실제 install과 두 runtime check는 성공했다.
- 최종 source tree의 `npm run verify`는 31/31, 보존된 historical M5 harness 자기검사는 5/5 통과했다. `npm pack --dry-run --json`은 39 entries, packed 64,052B/unpacked 228,143B이며 설치 payload에는 README, package metadata와 generated `skills/skill-rails/`만 있고 legacy, evals, fixtures, authoring source와 repository tests는 없다.

이 release closure가 새로 proven으로 만드는 것은 exact public commit/tag 전달, 두 이름 붙인 host의 같은 installed bytes와 version 자기 식별뿐이다. Fresh Devflow 저작·장기 update·remote latest 판정과 다른 host/model 반복성은 이 설치 smoke만으로 proven으로 올리지 않는다.

## v1.0.1 candidate — entry와 module 분할 계약 명료화

- 사용자의 실제 사용 전 질문에서 현재 source graph가 entry와 shared/target module을 분리할 수 있지만, canonical authoring entry가 “언제 분리하고 언제 함께 둘지”를 직접 닫지 않아 cold author가 길이나 주제만으로 분할하거나 optional module의 read condition을 생략할 여지가 확인됐다. 이는 새 tree 기능의 부재가 아니라 기존 whole-file module 경계의 전달 결함이다.
- Canonical step 4는 entry를 모든 분기를 해석하는 데 필요한 핵심 배경·의도, 목적·사용 trigger·운영 경계, 직접 둔 공통 규칙 또는 그 shared owner를 향한 unconditional pointer, 현재 입력, 완료 evidence와 각 optional module의 정확한 read condition을 함께 두는 최소 완전 always-read contract로 정의한다. Read condition은 해당 module을 열기 전에 현재 작업과 선언된 입력으로 판정할 수 있어야 한다. 실제 작업이 의미 손실 없이 module을 건너뛸 수 있고 절감 읽기가 탐색·재읽기 비용보다 클 때만 whole-file module로 옮기며, 함께 판단해야 할 의미는 나누지 않는다. 여러 target의 같은 규칙은 module owner 하나가 소유하고 각 consumer entry가 실제 read condition을 밝힌다.
- 같은 bounded review에서 step 3의 생성 대상 목록에 빠졌던 `imported modules`를 추가했고, renderer/core가 맡는 안전 작업을 `mechanically decidable safety checks`로 한정해 semantic safety와 permission judgment를 domain source·AI·user에 남겼다. 의미가 불투명했던 `colocated edge`는 inspect에 relation이 없으면 gap을 명시하고 관찰된 유지보수 실패가 필요성을 보일 때 canonical owner에만 relation을 추가한다는 평문으로 바꿨다.
- 초기 Codex 계열 읽기 전용 교차 검토는 imported module 누락과 `safety work`의 의미적 오해 위험을 찾았다. 별도 Claude Fable 5 읽기 전용 반증 검토는 전체 판정을 PASS, known defect 0건으로 두면서 공통 규칙을 entry에 직접 반복할지 shared owner를 가리킬지 한 구절이 모호하다는 비차단 note를 냈고, 그 한 구절만 `common rules or unconditional pointers to their shared owners`로 좁혔다. 사용자 재검토 뒤 같은 Fable 세션으로 entry 전체를 다시 반증한 결과도 PASS였으며, 명시되지 않은 운영 경계만 비차단 위험으로 보고했다. Coordinator는 사용자가 함께 요구한 핵심 배경·의도와 module-open 이전 read-condition 판정 가능성을 같은 문장에 최소 추가했다. 다수결·전면 재작성·guide 재편·새 schema/router/test harness는 열지 않았다.
- Targeted `tests/build.test.mjs` 13/13과 최종 문구 exact bytes의 기본 `npm run verify` 31/31은 generated entry에 always-read contract, safe-skip, together-meaning과 mechanically-decidable safety anchor가 전달되고 기존 standalone/build/currentness 계약이 유지됨을 확인했다. Canonical generated target은 36 files/203,518B, tree `1268cac2b5532d8f5a8d191d2734e4cb921e3a5135ddc7d4827ebdc94ce3aae1`이며 source-side check는 source-current를, generated target의 standalone check는 `skill-rails-authoring@1.0.1`, core `1.0.1`, artifact-intact를 반환했다.

이 검사는 문구 전달과 기존 기계 계약의 회귀만 proven으로 만든다. 새로운 cold AI가 실제 Devflow에서 더 잘 분할하는 행동 효과, token 절감과 여러 domain 반복성은 `unproven`이며, 이를 닫기 위한 synthetic matrix는 만들지 않는다. 첫 실제 Devflow target에서 always-read 누락, 읽지 않아도 되는 module의 매번 로드, 함께 판단해야 할 의미의 분리 중 하나가 관찰될 때 해당 owner와 문구를 다시 검토한다.

## v1.0.1 release closure — repository tag와 두 host 재설치 완료

- 첫 candidate commit `abd838f2a705142a8bfbba7a76674b3c02da8c15` 뒤 최종 context-preservation 교정 commit `c4cbaa540663862211ab7690fd359e2dce309ee3`을 `origin/main`에 non-force fast-forward했다. Annotated tag object `9cd418c8e865494695e2c68d5aa37fa918872ca2`의 `v1.0.1` peeled commit은 최종 release commit과 같음을 local과 `git ls-remote`에서 확인했다.
- README의 공식 `npx skills@latest add nanomia-ai/skill-rails` repository 경로를 사용했다. `skills@1.5.26`으로 global scope에서 `skill-rails` 하나와 Codex·Claude Code를 명시해 설치했으며 installer skill hash는 `ee294f57f977baa4947d3bb5a620eed4592034a44d819060e57008c8ee17b836`다.
- Codex의 `~/.agents/skills/skill-rails`는 installed directory이고 Claude의 `~/.claude/skills/skill-rails`는 그 exact directory를 가리키는 junction이다. 두 host의 installed `check`는 `skill-rails-authoring@1.0.1`, core `1.0.1`, target `skill-rails`, tree `1268cac2b5532d8f5a8d191d2734e4cb921e3a5135ddc7d4827ebdc94ce3aae1`, artifact-intact를 반환했다. `CODEX_HOME`은 변경하지 않았다.
- Installer assessment는 Gen safe, Socket 1 alert, Snyk low였고 출력에 alert 원인 상세가 없으므로 추가 해석하지 않는다. `npm pack --dry-run --json`은 39 entries, packed 64,343B/unpacked 228,898B이며 payload는 README, package metadata와 generated `skills/skill-rails/`로 제한된다.
- 최종 source의 `npm run verify`는 31/31 통과했고 generated target은 36 files/203,518B, artifact-intact/source-current다. 설치 뒤 repository working tree도 clean이었다.

이 closure가 새로 proven으로 만드는 것은 exact public commit/tag 전달과 두 이름 붙인 host의 같은 installed v1.0.1 bytes다. 문구의 실제 cold-AI 행동 개선, 일반 산문 대비 token 절감과 첫 Devflow 적용 결과는 계속 `unproven`이며 `docs/reviews/v1.0.1_ko.md`의 재개 조건으로만 연다.

## v1.0.2 release — 기존 구조 선언과 새 semantic relation의 입장 조건 분리

- v1.0.1 전체 prompt 재감사에서 canonical step 5의 `observed maintenance failure` 조건이 두 종류를 함께 제한하는 충돌을 확인했다. 이미 target이 실제로 사용하는 input, output, import 또는 mechanism의 누락 선언은 처음부터 고쳐야 하지만, requirement/check/external-boundary 같은 새 semantic relation은 D-12대로 실제 유지보수 실패가 필요성을 보이기 전에는 추가하면 안 된다. Prose entry의 text reference와 import 누락을 current validator가 대조하지 않으므로 전자는 build/check를 통과하는 dead pointer가 될 수 있다.
- Coordinator는 처음에 사용자 요구·외부 제약·관찰 실패를 관계 추가 근거로 함께 열거하는 안을 검토했다. 기존 Claude Fable 5 세션과 첫 왕복에서 이 표현은 semantic edge 추론 허가로 넓어질 수 있다는 반론에 동의하고, existing structural declaration과 new semantic relation을 직접 구분하는 한 문장으로 좁혔다. 두 번째 왕복에서 Fable은 `actual target input, output, import, or mechanism that step 3 requires`라는 최종 문구가 기존 rule owner를 중복하지 않으면서 dead pointer를 닫고 D-12를 보존한다고 PASS했으며, 자신의 첫 대안은 철회했다. 남은 이견은 0건이다.
- Canonical entry만 수정하고 root/authoring package를 `1.0.2` candidate로 올린 뒤 generated target을 rebuild했다. 상세 판단 원문, schema, validator, router, runtime mode, README, 동결 계획과 v1.0.1 review는 바꾸지 않았다. 기존 build test에 generated entry의 structural-declaration과 semantic-relation 구분 두 anchor만 추가했고 새 test file, matrix 또는 fresh-agent run은 만들지 않았다.
- 기본 `npm run verify`는 31/31 통과했다. Generated target은 36 files/203,690B, tree `c67d7e651236713668b225ed7a07fd7a6cee765eb72eadb46be372b2e6fc43bd`이며 source-side check는 `skill-rails-authoring@1.0.2`, core `1.0.2`, artifact-intact/source-current를, standalone check는 같은 package/core/tree와 artifact-intact를 반환했다.
- Release 직전 같은 Claude Fable 5 세션이 canonical entry 39줄과 상세 판단 원문 975줄 전체를 읽고 다시 대조했다(`task_8b84a877a5d3`, dispatch `ctx_bb00d6536dee`). Step 3·4의 기존 변경은 최소·완전 계약을 보존하고, Step 5 교정은 구조 선언 누락과 새 semantic relation의 서로 다른 입장 조건을 일관되게 분리하며, entry와 guide 사이에 실제 다음 행동을 갈라놓는 충돌은 없다고 PASS했다. 구체적 blocker는 0건이었고 style-only 차이는 변경 근거에서 제외했다.

Release commit `e72bc29debae8f04efccadae56ab7fbe01823c95`를 `origin/main`에 non-force fast-forward했고, annotated tag object `f20fa142c668cb548fe514e58f3cc453eafe354b`의 `v1.0.2` peeled commit이 같은 release commit임을 `git ls-remote`로 확인했다. README의 공식 repository 경로를 사용한 `npx skills@latest add nanomia-ai/skill-rails --global --skill skill-rails --agent codex claude-code --yes --json` 설치는 hash `14b9872ba23306a535056ebc8a651a19d990bb8eb6d7f4b4a411037774f65cc8`을 반환했다. Codex의 `~/.agents/skills/skill-rails`와 그 exact directory를 가리키는 Claude Code의 `~/.claude/skills/skill-rails` 모두 package/core `1.0.2`, tree `c67d7e651236713668b225ed7a07fd7a6cee765eb72eadb46be372b2e6fc43bd`, `ARTIFACT_INTACT`를 반환했고 교정된 Step 5 bytes도 양쪽에서 확인했다. `CODEX_HOME`은 변경하지 않았다.

이 evidence는 합의한 문구가 canonical source에서 generated target과 두 이름 붙인 host 설치본까지 동일하게 전달되고 기존 기계 계약이 회귀하지 않았다는 것만 proven으로 만든다. Cold author가 새 target에서 누락 import를 실제로 보완하고 관찰 없는 semantic edge는 만들지 않는 행동과 실제 비용 효과는 `unproven`이다.

## v1.0.3 release candidate — prompt/runtime 최소 교정

- 전체 AI-facing surface 재감사에서 당시 v1.0.2 PASS는 canonical Entry와 guide만 읽은 좁은 판단이었음이 확인됐다. 현재 Entry에는 중요한 의미 결과를 후속 판단의 전제나 최종 결론으로 채택하기 전에 실제 의존한 현재 canonical owner를 다시 맞춰 보는 행동이 없었고, standalone에서 해소할 수 없는 `named receipts` 지시가 있었다. Record-only runtime은 공개하지 않는 `prepare`를 일부 `nextAction`에서 권했고, `OUTPUT_BUSY`는 active writer와 orphan lock을 구분할 사실이나 사람의 결정 경로 없이 대기만 지시했다. Verify pilot Entry는 `<target-root>`를 정의하지 않고 `state: absent` 입력도 읽으라고 해석될 수 있었으며, maintenance snapshot은 과거 Entry+guide PASS를 전체 prompt 감사처럼 요약했다.
- Canonical authoring Entry에는 step 4를 늘리지 않고 consequential semantic result가 후속 전제 또는 최종 수용에 쓰일 때만 실제 의존한 current owner bytes를 다시 읽는 한 문장을 추가했다. 방금 같은 bytes를 읽은 경우는 제외하며 abstract state, checklist, reconstructed-purpose 비교와 guide 복제는 만들지 않았다. Dead receipt pointer는 included `.skill-rails-build.json`이 delivery evidence only라는 해소 가능한 경계로 바꿨다.
- Runtime 변경은 `src/runtime/record.mjs` 하나로 제한했다. Mode 확인 전 exchange path·JSON/schema·identity 실패는 installed target의 `SKILL.md`가 문서화한 exchange-creation command로 되돌리고, 확인 뒤 basis stale·input stale·output conflict는 `record-only`의 `initialize`와 `prepare-record`의 `prepare`를 선택한다. 기존 lock과 `owner.json`을 새 상태 없이 읽어 `lock`, `ownerPath`, parse 가능한 `recordedOwner`만 error details에 싣고, missing/malformed owner는 `null`로 둔다. 활성 여부와 제거는 사람의 확인·명시 결정이며 TTL, stale 자동판정과 자동 break는 추가하지 않았다. `common.mjs`, `errors.mjs`, renderer 복구, schema와 runner는 바꾸지 않았다.
- Verify source Entry의 두 문장만 target root와 present-input read를 명료화했고 Done 의미는 유지했다. Maintenance snapshot은 과거 Fable PASS를 당시 canonical Entry 39줄과 guide 975줄 범위로 정확히 좁혔다. 동결 계획, guide, README, historical/eval evidence, legacy, Resume와 generated 파일의 수동 편집은 없었다.
- Root·authoring package를 `1.0.3`으로 맞춘 공식 `node src/core/cli.mjs build --source authoring-package.json --target skill-rails --out skills/skill-rails`는 generated tree `73c06de2b57b07d70fa139d3efd2d9c8a19733a481c0f52c71b8577d670cf30c`를 만들었다. Version bump 뒤 첫 `npm run verify`는 기존 build test의 core `1.0.2` 고정 기대값 두 곳에서만 실패했고, 그 두 assertion을 `1.0.3`으로 좁혀 고친 재실행은 31/31 통과했다. Source-side check는 package/core `1.0.3`, `ARTIFACT_INTACT`, source-current를, standalone check는 같은 identity와 tree, `ARTIFACT_INTACT`를 반환했으며 source와 generated `record.mjs` bytes도 같다. 이는 canonical 문구의 generated 전달, record-only stale/conflict의 `initialize` 안내, active-lock owner details와 기존 구조·안전 회귀 부재만 증명한다.

Cold Codex·Claude가 재정박 문장을 실제로 필요한 두 시점에만 적용하는지, orphan lock의 missing/malformed owner와 사람 복구 효과, Verify 문구의 fresh behavior와 설치 전달, prepare-record recovery 반복성은 `unproven`이다. 이 중 실제 다른 행동이나 막힌 복구가 관찰될 때만 해당 owner를 다시 열며 새 validator, schema, checklist, harness나 matrix로 대신하지 않는다. Root와 authoring package는 `1.0.3` release candidate이며 release·설치는 아직 수행하지 않았다.
