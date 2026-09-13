# Skill Rails Next 구현·검증 기록

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
- Repository active generated skill은 `skill-rails-next` 하나이며 legacy import는 0이다.

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
- 현재 pilot target 20개/55,653 bytes, 그중 runtime+contracts 12개/44,554 bytes
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

## 현재 설치와 유지보수 시간

- 정상 pilot target tree: `2ec356b8f99a81722fa45de07b6c2ba3ffa1f4c3f15f3aa936dedbc8b907848f`
- Official installer receipt hash: `29d890d11f57534aeda916a351cc8ba1526608903dafca4e968c6d048d39ba12`
- 마지막 packet 수정 시각부터 정상 global target 설치 mtime까지의 관찰 상한은 약 384.4초다. 중간 분석·receipt 작성 시간을 포함한 coordinator elapsed upper bound이며 순수 build/install benchmark가 아니다.
- 기존 전역 `skill-rails`는 최초와 같은 63개 파일, 같은 raw-content tree SHA-256 `0deda16754f505fd3eb1df61a26b20ec5a329d75af8f700f5c67238aaae1184a`다. Windows 상대 경로 구분자를 포함한 최초 동일 알고리즘으로 최종 handoff 직전에 다시 계산했다.
