# Skill Rails 유지보수 상태와 다음 세션 진입점

문서 상태: 교체형 작업 snapshot

최종 갱신: 2026-08-23 KST

이 문서는 새 세션이 “마지막으로 어디까지 끝났고 어디서 이어야 하는가”를 빠르게 복구하기 위한 시작점이다. 제품 계약은 [제품·설계 정본](skill-rails_ko.md), 정확한 수치·지원 주장·V5 변경 근거는 [구현·검증 기록](implementation-verification_ko.md)이 소유한다.

이 파일을 일지처럼 계속 덧붙이지 않는다. 의미 있는 유지보수 milestone이 끝날 때 현재 상태로 교체한다. 과거 세션의 상세 chronology는 Git과 Orca 실행 기록에 맡긴다.

---

## 1. 저장소 기준선

- branch: `main`
- 시작 기준 commit: `9691f107bc08ac7657bca3bc6160f0d2aa3159eb`
- 시작 시 `origin/main`과 동기화된 clean 상태 확인
- 현재 milestone은 아직 commit·push·publish하지 않은 working-tree 변경
- 최초 구현 기획과 통합 문서는 Git commit `4929b5b`에서 복구 가능

다른 프로젝트, 특히 `D:/Projects/Private/nanomia/nanomia-skills/devflow/`, 는 이 작업 범위 밖이며 read-only다.

---

## 2. 마지막 완료 milestone

목적은 큰 P0/P1 판단형 skill에서도 profile을 올리지 않고 현재 요청에 필요한 산문만 점진적으로 읽게 하는 것이었다.

완료된 구현:

- `intent.judgment_points`가 기존 문자열과 `{ id, when, points }` conditional topic을 함께 지원
- 조건부 topic이 있을 때만 작은 guidance index와 stable topic file 생성
- universal boundary, exact format, stop rule, P1 helper gate는 항상 읽는 `SKILL.md`에 유지
- profile 선택과 prose routing을 독립 축으로 유지
- intent, profile decision, obligation ledger, index, topic, adapter, `SKILL.md`의 projection과 ownership을 fail-closed 검증
- P0/P1 intent-only maintenance를 atomic하게 수행하면서 authored helper와 비소유 파일 보존
- strict UTF-8, path containment, symlink/junction, orphan, duplicate, escaping, CRLF 경계를 검증
- P2/V5, migration, portable core와 adapter 경계는 변경하지 않음

설계·코드 판단은 Claude Opus xhigh와 Codex Sol xhigh의 독립 감사를 거쳤고, 마지막 Opus xhigh 재검토는 blocking finding 없이 PASS했다. Medium 모델은 fresh 실제 사용 피시험자에만 사용했다.

---

## 3. 마지막 검증

- 현재 working tree에서 전체 `npm run verify`가 통과했다.
- xhigh 설계·코드 감사와 fresh medium-model author/consumer 실측을 완료했다.
- 정확한 test 수, G0.5 수치, 모델별 실행 범위와 한계는 [구현·검증 기록](implementation-verification_ko.md)이 단독으로 소유한다.

이 fresh 소비 결과는 positive single-match 한 사례다. 더 넓은 행동 주장을 만들지 않는다.

---

## 4. 이번 maintenance 종료 상태

- Conditional guidance 구현, P0/P1 maintenance, ownership guard와 regression test 완료
- 제품 설계, 구현·검증 기록, 유지보수 snapshot의 문서 소유권 분리 완료
- 최초 xhigh 문서 감사의 blocking 2개와 high 6개를 보정하고 좁은 xhigh 재검토 PASS
- 두 번째 검토의 경미한 문구 차이 3개까지 실제 코드와 정합
- local link, README 한국어·영어 주장 동등성, `git diff --check` 확인
- 임시 실측 경계 `.skill-rails/test-runs/progressive-consumer-20260823` 제거 완료

현재 blocking finding과 필수 구현 작업은 없다. Working tree는 사용자가 요청한 변경을 포함한 uncommitted 상태이며 commit·push·publish는 수행하지 않았다.

---

## 5. 다음에 선택할 수 있는 검증

현재 blocking implementation finding은 없다. 다음 단계는 새 기능 구현보다 아직 일반화하지 않은 범위를 선택적으로 실측하는 것이다.

가치가 높은 순서:

1. P0/P1 conditional guidance의 multi-match, no-match, near-miss 소비
2. topic 수가 많은 실제 대형 skill의 routing recall과 고정 context 비용
3. 장기 session/compaction 뒤 핵심 경계 복구
4. 최신 전체 suite의 Node 20/22/24 재실행
5. Linux/macOS filesystem과 project-local adapter 확인
6. 실제 대형 기존 skill migration

증거가 필요하지 않은 항목을 관성적으로 실행하지 않는다. 사용자가 다음 목표를 정하면 그 주장에 필요한 최소 fresh 시험만 고른다.

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
