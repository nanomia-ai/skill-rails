# Skill Rails 유지보수 상태와 다음 세션 진입점

문서 상태: 교체형 작업 snapshot

최종 갱신: 2026-08-30 KST

이 문서는 새 세션이 “마지막으로 어디까지 끝났고 어디서 이어야 하는가”를 빠르게 복구하기 위한 시작점이다. 제품의 안정적인 목적과 설계는 [제품·설계 정본](skill-rails_ko.md), 정확한 구현·증거·P2 version-5 호환 변경은 [구현·검증 기록](implementation-verification_ko.md), 큰 전환의 인과와 재사용할 저작·운영 교훈은 [저작 경험 계승](authoring-lessons_ko.md)이 소유한다. 일상 chronology는 Git과 Orca 실행 기록에 맡기고 이 파일에는 현재 truth만 둔다.

---

## 0. 현재 완료 지점: v0.1.4 문서 경계 정리와 공식 설치 검증

실사용 교훈의 좁은 product correction은 commit `0205a0b`에, release metadata는 `bfb83dd`에 반영했다. Package version 0.1.3과 annotated tag `v0.1.3`을 `origin/main`에 push했고, release candidate의 `npm run verify`는 vendor check, self lint, repository test 61/61, frozen G0.5 eval을 통과했다.

배포 뒤 기존 clean·inactive worktree 두 개에서 `npx skills@latest add nanomia-ai/skill-rails`를 그대로 실행했다. Codex와 실제 Claude Code process의 project-local 설치는 version 0.1.3, 248 files, missing/extras 0으로 일치했고, Windows에서 Git blob과 달랐던 94개 파일은 모두 CRLF projection뿐이었다. Fresh Codex는 project-local entry로 P1 생성과 세 fixture·lint를 통과했다. Claude는 사용자 personal v0.1.2가 project v0.1.3보다 우선하는 공식 same-name precedence를 재현했으며, personal Claude Code 연결을 제거한 뒤 새 session이 project-local v0.1.3을 사용해 같은 bounded smoke를 통과했다.

Core product defect는 발견되지 않았다. Local `main`의 package version 0.1.4는 설치된 AI가 읽는 operational reference와 사람·maintainer 문서를 다시 분리한다. Maintainer 전용이던 platform adapter reference와 그 skill-user route를 제거하고, README 작성 가이드는 `docs/`로 옮기되 모든 자동 route를 해제했다. Targeted authoring test 14/14, Markdown local link 49-file scan과 `npm run verify`의 vendor check·self lint·repository test 61/61·frozen G0.5 eval이 통과했다. 정확한 설치 receipt와 변경 증거, 남은 `UNPROVEN`은 [구현·검증 기록](implementation-verification_ko.md) 0.1–0.2절이 소유한다.

## 1. 저장소 기준선

- branch: `main`
- 현재 배포 기준: `bfb83dd431d95432f1e60269f9ef2078c36c265a`, annotated tag `v0.1.3`, package version 0.1.3.
- `origin/main`과 release tag는 위 v0.1.3 commit에 있다. Local `main`의 현재 `HEAD`는 검증된 문서 소유권 정리와 package 0.1.4 metadata를 포함하며 아직 push·tag·public release하지 않았다.
- P2 runtime·schema·Decision byte·effect authority는 v0.1.3에서 바뀌지 않았다.
- Local package version은 0.1.4다. Push, tag와 public release는 이 검증된 local commit과 별도로 승인된 배포 단계다.

---

## 2. 완료된 제품 변경

`d74d783`은 저작과 생성 skill의 비수렴 복구를 다음 경계로 정리한다.

- 작은 편집마다 검사를 강제하지 않는다. 의미 있는 변경 묶음 또는 살아 있는 가설을 반증할 때 fast lint를 사용하고, 설계와 authored behavior가 논리적으로 수렴한 뒤 full lint와 P2 build를 실행한다.
- P0/P1 생성물은 작은 수정·예외만 늘고 사용자 결과가 가까워지지 않을 때 결과와 접근을 다시 보게 하되, 의미·정확 형식·비가역 경계·완료 증거는 계속 지킨다.
- P2 생성물은 현재 Decision이 연 domain work 안에서만 판단한다. Decision, evidence, loader step을 우회하지 않는다.
- 저장된 P2 stage result는 현재 task가 이 설치 skill과 project의 current Decision으로 명시되고 package와 covered project state가 생성 뒤 변하지 않았음을 확인할 때만 재사용한다. 대화 기억, 발견한 파일, 불확실한 상태에서는 새 stage를 실행한다.
- 이 변경은 authoring/loader guidance correction이다. Runtime, schema, Decision byte, P2 behavior source는 바꾸지 않았다.

현재 local 정합화는 이미 존재하는 runtime을 cold AI가 공개 문서만으로 정확히 호출하게 한다. Generic P2 loader·계약·평가 vocabulary·유지보수 workflow·설치기 snapshot을 실제 구현과 맞췄으며, 정확한 변경과 증거는 [구현·검증 기록](implementation-verification_ko.md) 6.11–6.12가 소유한다. 활성 경로가 없던 `kernel-v6.md`와 구 `v5-contract.md` filename shim은 제거하고 P2 계약은 `p2-contract.md` 하나가 소유한다. 사용자는 구 V5 경로 호환이 필요 없다고 명시했다.

---

## 3. 현재 증거

- v0.1.3 release candidate full verify와 기존 targeted/canonical evidence는 [구현·검증 기록](implementation-verification_ko.md) 0절, 1절, 6.11–6.12가 소유한다.
- 통제 exact-byte 네 모델 suite는 narrow fixture와 bounded extension을 수행했지만 Opus/Sonnet의 첫 heading 해석 drift, Sol/Orca lifecycle incident, stale global precedence를 product defect로 승격하지 않았다.
- 공식 latest install은 Codex와 Claude 양쪽에서 clean project placement를 통과했다. Fresh Codex는 local entry 사용을, fresh Claude는 personal collision 제거 뒤 local entry 사용을 실제 authoring receipt로 증명했다.
- 구조, 배치, 생성자 자기 fixture를 별도 fresh consumer 행동 증거로 승격하지 않는다.

---

## 4. 여전히 `UNPROVEN`인 범위

- Fresh consumer가 새 recovery guard와 saved-Decision 재사용 조건을 실제로 올바르게 해석하는 행동
- Fresh P2 consumer의 skipped-judgment branch, tampered-Decision rejection과 harness-trusted public effect observation
- 생성 P0/P1 skill의 반복 trigger precision, 첫 산출물 유용성과 long-session/compaction 회복
- 여러 모델·host에서의 통계적 trigger precision과 대형 Devflow 계열 부하
- Linux/macOS POSIX symlink 분기와 capture 뒤 out-of-band writer의 package 보존
- Claude personal/project 동명판을 함께 유지하면서 project가 이기는 행동은 host precedence상 지원되지 않는다. 다른 host의 same-name precedence는 `UNPROVEN`이다.
- 생성된 `ready-file-verifier`를 별도 fresh consumer가 암시적으로 호출하는 forward test
- human/maintainer 문서와 installed-skill routing 경계 정리는 local commit에서 검증됐으며 public patch release가 남음

---

## 5. 정확한 다음 단계

1. Orca test worktree는 dirty bytes와 active terminal이 없음을 확인한 정확한 대상부터 제거한다.
2. Push, tag와 public release는 별도 배포 단계로 남긴다. Runtime regression이나 네 모델 suite를 이유 없이 반복하지 않는다.
