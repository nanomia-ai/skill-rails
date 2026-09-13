# Skill Rails Next 제품·architecture 경계

문서 상태: 현재 채택된 안정 경계

## 목적

Skill Rails Next는 AI가 사용할 독립적인 target skill을 저작하고, 현재 작업에서 AI가 읽고 해석하고 옮겨 적고 복구해야 하는 총부담을 줄이는 기반이다. 기계가 확실히 계산할 수 있는 관찰·분기·반복·형식·현재성은 코드가 맡고, 목적·예외·충분성·의미 선택은 AI와 사용자가 맡는다.

성공은 내부 구조나 검사 수가 아니라 산문 기준안과 같거나 더 나은 과업 성공·안전을 유지하면서 context, 왕복, 형식 오류, stale 적용 또는 여러 정본의 유지 비용을 실제로 줄인 결과다.

## 안정 경계

- 저작 source와 generated target은 분리한다. 사람이 generated target을 직접 고치지 않는다.
- Target package는 standalone이며 저작 repository, sibling skill, global runtime과 legacy archive를 실행 시 참조하지 않는다.
- Core는 manifest/schema, 경로 격리, deterministic build, receipt/currentness와 공통 오류를 소유한다. M1~M4 pilot에는 prepare/record envelope와 CAS·원자적 적용도 구현돼 있지만, M4는 prepare를 다음 architecture의 채택 기준선으로 선택하지 않았다.
- Domain package는 목적, 판단 기준, import graph, observer, renderer, 선언 input/output과 완료 의미를 소유한다.
- AI는 의미를 판단하고 host tool을 선택한다. Core는 자유 산문의 진실성이나 AI 준수를 보장하지 않는다.
- Effect credit은 실제 관찰 권한을 넘지 않는다. 파일 write는 reread digest가 맞을 때만 `observed`다.
- 기본 상태는 artifact-derived다. 대화나 run scratch를 durable semantic truth로 만들지 않는다.
- 공유 human source는 build-time whole-module materialization으로 standalone target에 들어간다. Installed target의 remote latest는 receipt가 증명하지 않는다.
- Greenfield schema는 `schemaVersion: 1`이며 legacy V5를 읽지 않는다.
- 첫 수직 흐름은 natural-language pilot Verify이고, 그 결과를 Devflow·9-target·다른 stage의 승리로 자동 승계하지 않는다.

## 배포와 권한

- Alpha npm identity는 `@nanomia/skill-rails-next`, skill identity는 `skill-rails-next`다.
- Canonical source는 `authoring/skill-rails/`, generated tracked package는 `skills/skill-rails/`을 사용한다.
- 실제 host 검증은 generated package가 준비된 뒤 표준 installer 경로에서 수행한다. 기존 전역 `skill-rails`를 덮어쓰지 않는다.
- `skill-rails`, `latest`, public publish, 기존 전역 설치 교체와 legacy archive 삭제는 각각 별도 사용자 결정이다.

## M4 이후 채택 경계

- Natural-language pilot의 M4 결과는 `renderer-only`다. Deterministic build와 안전한 renderer/record 원리는 다음 설계 후보로 남고 prepare와 fallback은 확대 대상으로 채택되지 않았다.
- `renderer-only`는 방향 판정이지 아직 완성된 제품 mode가 아니다.
- 현재 prepare-record 코드는 재현과 반증을 위한 실험 evidence로 보존하지만 production baseline이나 fallback으로 사용하지 않는다.
- 다음 구현은 semantic answer가 안전한 renderer/record에 들어가는 최소 경계를 다시 정의해야 한다. 이때 CAS·lock·reread authority와 marker 밖 bytes 보존 목적은 유지한다.
- Fallback 산문만으로 canonical managed record를 안정적으로 만들지 못한 실제 run이 있으므로 현재 fallback을 안전 경로로 안내하지 않는다.
- 이 Verify 결과를 Devflow, 9-target 또는 다른 skill의 승리로 자동 승계하지 않는다.

정확한 구현 계약과 milestone은 동결 상세 계획이, 구현 중 차이는 Evolution 문서가 소유한다.
