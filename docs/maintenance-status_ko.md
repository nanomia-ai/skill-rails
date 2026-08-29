# Skill Rails 유지보수 상태와 다음 세션 진입점

문서 상태: 교체형 작업 snapshot

최종 갱신: 2026-08-29 KST

이 문서는 새 세션이 “마지막으로 어디까지 끝났고 어디서 이어야 하는가”를 빠르게 복구하기 위한 시작점이다. 제품의 안정적인 목적과 설계는 [제품·설계 정본](skill-rails_ko.md), 정확한 구현·증거·P2 version-5 호환 변경은 [구현·검증 기록](implementation-verification_ko.md), 큰 전환의 인과와 재사용할 저작·운영 교훈은 [저작 경험 계승](authoring-lessons_ko.md)이 소유한다. 일상 chronology는 Git과 Orca 실행 기록에 맡기고 이 파일에는 현재 truth만 둔다.

---

## 1. 저장소 기준선

- branch: `main`
- 현재 local 제품 구현 기준: local `main`의 `HEAD`. 정확한 hash는 `git rev-parse HEAD`로 확인한다.
- `origin/main`: `cb8e06dabbc81bff41614e1e70791b51c4a697fd`; local `main`이 앞서며 push하지 않았다.
- package version: `0.1.2`; version bump, publish, release는 수행하지 않았다. Fresh-use evidence가 닫힌 뒤 별도 release commit에서 다음 version을 정한다.
- Local `HEAD`에는 후임자 인수인계 전 operational reference·generic P2 loader·문서 라우팅 정리가 포함돼 있다. 제품 runtime·schema·Decision byte를 바꾸는 작업은 아니다.

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

- Targeted profile-generation regression, generic loader regression, repair-generated canonical P2 pilot과 현재 후보 bytes의 full verify가 모두 통과했다. 정확한 count, build ID, 이전 고유 receipt와 역사적 evidence card는 [구현·검증 기록](implementation-verification_ko.md) 1절과 6.11–6.12가 소유한다.
- 공개 `Authoring judgment`는 사용자 결과·근본 문제를 향한 방향 원칙과 네 개의 범용 인과 실패 사례를 분리하고 중복 절차를 덜어냈다. Fable xhigh 감사 기준을 재사용한 최종 Sol xhigh 재감사는 의미 중복·과잉 재기획·표면 패턴 오용을 소폭 보완 후 통과로 판정했다. 이전 fresh Sol xhigh gate는 현재 failure-case bytes를 읽지 않았으므로 fresh-author 행동과 생성 skill 소비자의 recovery guard 행동은 각각 `UNPROVEN`이다.
- 구조, 생성, 결정성 증거를 fresh-agent 행동 증거로 승격하지 않는다.

---

## 4. 여전히 `UNPROVEN`인 범위

- Fresh consumer가 새 recovery guard와 saved-Decision 재사용 조건을 실제로 올바르게 해석하는 행동
- Fresh P2 consumer의 skipped-judgment branch, tampered-Decision rejection과 harness-trusted public effect observation
- 생성 P0/P1 skill의 반복 trigger precision, 첫 산출물 유용성과 long-session/compaction 회복
- 여러 모델·host에서의 최종 실제 사용 검증과 대형 Devflow 계열 부하
- Linux/macOS POSIX symlink 분기와 capture 뒤 out-of-band writer의 package 보존
- 다음 version, publish, release

---

## 5. 정확한 다음 단계

1. 변경 파일, 삭제한 dead path, 남은 `UNPROVEN`을 사용자에게 표로 보고한다. 별도 명시적 권한 전에는 commit, push, version, publish, release를 수행하지 않는다.
2. 사용자 인수인계 지시가 오면 이번 냉간 저작 행동 gate를 통과한 fresh Sol xhigh 후보에게 authority를 이전한다.
3. 인수인계 뒤 clean isolated actual-use lanes에서 아직 증명되지 않은 소비 행동을 검증한다. 기존 deterministic suite를 이유 없이 반복하지 않는다.
