# Skill Rails 제품·architecture 경계

문서 상태: 현재 채택된 안정 경계

## 목적

Skill Rails는 AI가 사용할 독립적인 target skill을 저작하고, 현재 작업에서 AI가 읽고 해석하고 옮겨 적고 복구해야 하는 총부담을 줄이는 기반이다. 기계가 확실히 계산할 수 있는 관찰·분기·반복·형식·현재성은 코드가 맡고, 목적·예외·충분성·의미 선택은 AI와 사용자가 맡는다.

성공은 내부 구조나 검사 수가 아니라 산문 기준안과 같거나 더 나은 과업 성공·안전을 유지하면서 context, 왕복, 형식 오류, stale 적용 또는 여러 정본의 유지 비용을 실제로 줄인 결과다.

## 안정 경계

- 저작 source와 generated target은 분리한다. 사람이 generated target을 직접 고치지 않는다.
- Target package는 standalone이며 저작 repository, sibling skill, global runtime과 legacy archive를 실행 시 참조하지 않는다.
- Core는 manifest/schema, 경로 격리, deterministic build, receipt/currentness와 공통 오류를 소유한다. M5 선행 gate는 record-only initializer와 mode-neutral exchange, 공통 safe record의 CAS·원자적 적용을 구현했다. M1~M4 prepare-record는 재현 evidence로만 남고 다음 architecture의 채택 기준선이 아니다.
- Domain package는 목적, 판단 기준, import graph, observer, renderer, 선언 input/output과 완료 의미를 소유한다.
- M7에서 prepare packet의 Verify-shaped field 열거를 제거해 answer field의 단일 owner를 domain contract로 되돌렸고, 한 비-Devflow editorial-review package가 기존 source graph·observer·renderer·공통 runtime을 machine level로 재사용했다. 이는 fresh AI 품질이나 prepare의 production 채택 증거가 아니다.
- AI는 의미를 판단하고 host tool을 선택한다. Core는 자유 산문의 진실성이나 AI 준수를 보장하지 않는다.
- Effect credit은 실제 관찰 권한을 넘지 않는다. 파일 write는 reread digest가 맞을 때만 `observed`다.
- 기본 상태는 artifact-derived다. 대화나 run scratch를 durable semantic truth로 만들지 않는다.
- 사람의 전체 구조 질문에는 source repository의 `overview --source`가 current graph에서 계산한 non-authoritative view 하나만 사용한다. 이 출력은 저장 정본, Framework index, generated skill 또는 AI runtime/router의 입력이 아니다.
- 공유 human source는 build-time whole-module materialization으로 standalone target에 들어간다. Installed target의 remote latest는 receipt가 증명하지 않는다.
- Greenfield schema는 `schemaVersion: 1`이며 legacy V5를 읽지 않는다.
- 첫 수직 흐름은 natural-language pilot Verify이고, 그 결과를 Devflow·9-target·다른 stage의 승리로 자동 승계하지 않는다.

## 배포와 권한

- Production repository/package identity는 `nanomia-ai/skill-rails`와 private metadata `@nanomia/skill-rails@1.0.0`, generated skill identity는 `skill-rails`다. Public delivery는 repository-based `npx skills@latest` 경로이며 이 package를 npm registry에 발행하지 않는다.
- Canonical source는 `authoring/skill-rails/`, generated tracked package는 `skills/skill-rails/`을 사용한다.
- 실제 host 검증은 generated package가 준비된 뒤 표준 installer 경로에서 수행한다. 기존 전역 `skill-rails` 교체 전후에는 unrelated skill과 `CODEX_HOME` 불변을 확인한다.
- Production identity, remote 배포와 기존 전역 설치 교체는 M8의 명시 승인 범위에서만 수행한다. Force push/history rewrite, README 변경과 legacy archive 삭제는 승인되지 않았다.

## M4 이후 채택 경계

- Natural-language pilot의 M4 결과인 `renderer-only` 방향을 M5 선행 gate에서 실제 `record-only` 제품 mode로 materialize했다. Deterministic build, 최소 initializer/exchange와 안전한 renderer/record가 현재 채택 경계이며 prepare와 fallback은 확대하지 않는다.
- Public runtime은 `check | initialize | record`와 일치하고 generated target에는 observer, packet, semantic decision, fallback 또는 prepare runtime이 없다.
- Prepare-record 코드는 재현과 반증을 위한 M1~M4 실험 evidence로 보존하지만 production baseline이나 fallback으로 사용하지 않는다.
- 후속 target은 semantic answer를 현재 record-only initializer/exchange와 공통 safe record 경계에 넣을 수 있을 때만 채택한다. CAS·lock·reread authority와 marker 밖 bytes 보존 목적을 약화하거나 prepare를 되살리지 않는다.
- Framework whole original과 heading index는 materialize됐지만 상대 효과는 `unproven/pre-gate`다. 평가 harness/schema는 product core가 아니라 `evals/m5/framework/`가 소유하며, 완료되지 않은 matrix나 구조 test를 adoption 증거로 쓰지 않는다.
- M5 pilot의 Product·Direct·Work·Resume는 각자 별도 bounded gate를 거친 prose-only target이고 Verify만 record-only다. 한 stage의 관찰을 다른 stage나 Devflow에 복사하지 않으며, Resume는 artifact-derived read-only 해석일 뿐 durable workflow state가 아니다.
- Authoring prose target만 optional `embeddedCoreTooling: "authoring-cli-v1"`을 선언할 수 있다. 이는 target/package identity와 무관하게 고정된 canonical CLI closure를 `scripts/skill-rails-cli/`에 넣고 기존 receipt/tree hash/currentness가 소유하는 단일 capability다. 임의 path·glob·destination·domain executable·두 번째 값이나 consumer는 허용하지 않는다. 한 M8 installed fresh author→build→maintain→unfamiliar-use 관찰만 proven이고 반복성과 넓은 host/domain 효과는 `unproven`이다.
- Fallback 산문만으로 canonical managed record를 안정적으로 만들지 못한 실제 run이 있으므로 현재 fallback을 안전 경로로 안내하지 않는다.
- 이 Verify 결과를 Devflow, 9-target 또는 다른 skill의 승리로 자동 승계하지 않는다.

정확한 구현 계약과 milestone은 동결 상세 계획이, 구현 중 차이는 Evolution 문서가 소유한다.
