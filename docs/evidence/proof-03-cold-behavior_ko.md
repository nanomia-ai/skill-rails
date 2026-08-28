# 증거 카드 03 — 선행 후보 package의 냉시작 행동

문서 상태: 역사적 증거 카드. 현재 release proof가 아니다.

기준일: 2026-08-28 KST

## 무엇이 관찰되었는가

evidence-credit vertical의 **선행 후보(predecessor candidate) package**에 대해, 작성 대화를 보지 못한 격리된 fresh agent 실행에서 냉시작 행동이 관찰되었다.

- negative: 해당 skill을 써서는 안 되는 요청에서 skill을 선택하지 않았고, 증거가 없는 상태에서 완료를 주장하지 않고 fail-closed로 멈췄다.
- positive: 대상 요청에서 skill을 선택하고 진입 절차를 따라 그 시점 설계가 의도한 Decision에 도달했다.

## 왜 최종 package의 증거가 아닌가

그때 실행된 bytes는 **은퇴한 continuation 설계**였다. 그 설계는 runtime 측 재관찰과 continuation binding receipt를 전제했고, cold model이 실제로 읽는 표면(`body.md`, stage reference)도 그 mechanism을 설명하고 있었다.

최종 package는 다른 것으로 교체되었다.

- credit 조건이 declared-column binding 표로 옮겨졌다.
- 재관찰은 runtime 기능이 아니라 agent 재진입(`reentry: rejudge`)이다.
- continuation receipt, singleton recorded-JSON 상관, 합성 runtime-state fixture는 제거되었다.
- cold model이 읽는 AI-facing 문장이 같은 전환에서 다시 쓰였다.

즉 관찰 대상이었던 bytes와 지시문이 더 이상 존재하지 않는다. 구조 검증이 통과했다는 사실은 산문 drift를 보지 못하므로, 이전 실행을 최종 bytes의 대리 증거로 쓸 수 없다.

## 이 카드가 credit하는 것과 하지 않는 것

| 항목 | 판정 |
| --- | --- |
| 작성·유지보수 workflow가 fresh agent 소비까지 이어진다는 workflow 증거 | 관찰됨(선행 후보 bytes 기준) |
| 최종 declared-column package의 trigger 선택 | `UNPROVEN` |
| 최종 package의 지시 준수와 출력 품질 | `UNPROVEN` |
| 최종 package의 near-miss 비-trigger | `UNPROVEN` |

## 다음 증거

최종 package에 대한 냉시작 판정은 배포 이후의 별도 fresh-agent test에서만 나온다. 그 결과가 기록되기 전까지 이 카드를 지원 주장 표에서 `verified`로 승격하지 않는다. 현재 상태와 다음 단계는 [유지보수 상태](../maintenance-status_ko.md), 정확한 검증 범위는 [구현·검증 기록](../implementation-verification_ko.md)이 소유한다.
