# Skill Rails Next 유지보수 상태

문서 상태: 교체형 현재 snapshot

최종 갱신: 2026-09-13 KST — M0~M4 완료, renderer-only 판정

## 현재 위치

- 사용자 계획 checkpoint commit: `9d35b75` (`docs: checkpoint greenfield Skill Rails plan`)
- 기존 v0.4.3 implementation 257개 파일은 `legacy/archive/v0.4.3/legacy-source.tar`에 보존했다. Capsule SHA-256은 `c79dcf45dc9ab520aa100e19ecf6ef95102d1a423c89c5090cadd40293db31fc`다.
- `inventory.json`이 원경로·Git/working hash·mode를, `restore-receipt.json`이 Windows temporary-root 복원 257/257와 mismatch 0을 소유한다. POSIX mode 복원은 `unproven`이다.
- Root package는 private `@nanomia/skill-rails-next@1.0.0-alpha.1`, Node 범위는 `>=24 <25`이고 외부 runtime dependency는 없다.
- Canonical authoring source는 `authoring/skill-rails/`, generated tracked skill은 `skills/skill-rails/`이다. 현재 repository discovery에 active skill은 `skill-rails-next` 하나뿐이다.
- Natural-language pilot의 현재 정상 설치 target tree SHA-256은 `2ec356b8f99a81722fa45de07b6c2ba3ffa1f4c3f15f3aa936dedbc8b907848f`다. 표준 installer로 Codex·Claude Code에 설치했고 runtime `check`는 `ARTIFACT_INTACT`다.
- 기존 전역 `skill-rails`는 교체하지 않았다. Alpha authoring skill `skill-rails-next`와 pilot target `natural-language-pilot-verify-next`는 별도 이름으로 공존한다.
- 전체 `npm test`: 34/34 pass. 구조 검사는 fresh AI 행동이나 실제 effect를 대신 증명하지 않는다.

## milestone 상태

- **M0 완료**: 동결 정본 보호, inventory, 사용자 변경 분리, legacy capsule, 복원 rehearsal, clean-slate final-path 전환.
- **M1 완료**: closed source/target/receipt schema, containment·collision·canonicalization, deterministic standalone build, integrity/currentness, exact inspect.
- **M2 완료**: `PreparedWorkV1`, nonce exchange, fixture observer, eight-block packet, unknown/fallback 분리. Codex와 Claude Code가 fresh context에서 fallback을 미리 읽지 않고 prepare를 먼저 실행한 장면이 있다.
- **M3 완료**: semantic answer validation, core-owned renderer spawn, input/output CAS, lock, staged apply, reread authority, idempotent retry와 fault injection.
- **M4 완료**: paired normal control/treatment와 unknown, command failure, input stale, output conflict, other-card 보존, response-loss retry, prepare-failure fallback을 fresh context로 실행했다. 결과는 `renderer-only`다.

## M4 판정

Treatment의 canonical renderer/record는 두 control이 발명한 비호환 marker를 피했고, stale/conflict no-write, 다른 card 보존과 idempotent retry를 실제 장면에서 보였다. 반면 prepare는 두 host의 normal run에서 총 context·비용을 낮췄다고 증명되지 않았고 Claude의 bounded read도 안정적으로 만들지 못했다. Fallback은 treatment runtime 오염 또는 비호환 marker 생성으로 두 번 실패했다.

따라서 다음 milestone에 유지할 후보는 deterministic standalone build와 안전한 renderer/record 원리다. 현재 prepare-record pilot을 production 기준선이나 Devflow fallback으로 확대하지 않는다. 기존 코드와 receipts는 M1~M4 실험 증거로 남긴다.

## 정확한 다음 진입

이번 사용자 요청 범위는 M4까지이므로 자동으로 M5를 시작하지 않는다. 사용자가 M5를 승인하면 다음 순서로 재개한다.

1. `AGENTS.md`와 이 문서를 읽고 `evals/m4/results/gate-decision-2026-09-13.json`을 확인한다.
2. 동결 상세 계획 M5의 의존성을 다시 확인하되, 현재 prepare를 채택된 기준선으로 사용하지 않는다.
3. Renderer-only가 실제로 요구하는 최소 semantic input과 safe record 경계를 새 evolution 항목으로 설계한다. 제품 경계·권한·허용 비용이 달라지면 구현 전에 사용자에게 회부한다.
4. 그 선택을 반영한 뒤에만 Framework materialization과 저작·유지보수 경험을 실험한다.
5. Devflow와 9-target 확대는 M5 gate 이전에 시작하지 않는다.

## 아직 unproven 또는 기각된 범위

- M4 결과의 통계적 일반화와 final tree의 모든 scene×host 조합
- Prepare의 총비용 절감과 Claude bounded-read 효과
- 현재 fallback의 canonical managed-record 작성 능력
- Renderer-only 제품 mode의 구체 contract와 fresh-agent 결과
- M5 이후 Framework projection, authoring AI, maintenance·migration과 Devflow integration
- Publish, release, public `latest`, 기존 전역 `skill-rails` 교체
- POSIX capsule mode restoration

세부 evidence와 실패 원본은 `docs/implementation-verification_ko.md`가 소유하고, 계획과 달라진 선택은 `docs/plan/implementation-evolution-plan_ko.md`가 소유한다.
