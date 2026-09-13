# Skill Rails greenfield 구현 준비 개발 계획

문서 상태: **동결됨 — 이후 수정 금지. 변경 관리 규칙은 §17이 소유한다.**

## 0. 문서의 지위와 사용법

이 문서는 `initial-ai-first-skill-system-concept_ko.md`의 고정 목적을 실제 구현 단위와 검증 게이트로 내린 상세 계획이다. 최초 기획은 방향성 정본이며 이 문서는 그 문서를 대체하지 않는다. 최초 기획의 잠정 수단과 다른 선택을 한 곳은 `D-*` 결정으로 드러내고, 근거·기각 대안·재검토 조건을 함께 기록했다.

이 계획의 완료 의미는 다음과 같다.

- 새 구현자는 과거 대화 없이 제품 목적, 책임 경계, 첫 수직 흐름과 단계별 완료 조건을 설명할 수 있다.
- 첫 구현 작업은 제품 경계나 중요 계약을 새로 정하지 않고 시작할 수 있다.
- 아직 실측하지 않은 것은 `미검증`으로 남는다. 계획이 구체적이라는 사실은 채택 증거가 아니다.
- 뒤 단계의 진입은 앞 단계의 증거에 종속된다. 계획에 적혔다는 이유만으로 모든 기계를 구현하지 않는다.

현재 계획의 입력 정본과 참고 자료는 다음과 같다.

| 구분 | 자료 | 지위 |
| --- | --- | --- |
| 고정 목적 | `docs/plan/initial-ai-first-skill-system-concept_ko.md` | 수정하지 않는 최초 방향성 정본 |
| 탐구 방법 | `docs/guide/universal-ai-skill-inquiry-framework.md` | 이번 결정의 불확실성·파급·되돌림 비용에 필요한 부분만 사용 |
| 과거 증거 | 현 Skill Rails 코드와 maintainer 문서 | 실패·비용·반례를 확인하는 자료, architecture 기준선 아님 |
| 작은 장면 | `../devflow/tests/natural-language-pilot` | 첫 반증 실험의 도메인 fixture, 새 제품의 기준선 아님 |
| 큰 장면 | 실제 Devflow | 복잡성·공유 정본·재개 압력 시험 대상, 새 core의 소유자 아님 |

최초 기획 파일은 이 문서를 작성하는 동안 수정하지 않았다. 작성 전 SHA-256은 `D1223770F81CA01FFAA6EC3FDDD081AE9B279AE40E93F9AF2D3FC2AF3599C1EA`였다. 이 값은 내용 동결 확인용 기록이지 새 버전 계약은 아니다.

## 1. 배경, 제품 목적, 성공의 의미

Devflow를 자연어 스킬로 운용하면서 다음 문제가 관찰되었다.

- 공통 산문 67,205바이트 중 46,593바이트, 약 69%가 여러 스킬에 보편적으로 필요했고 나머지는 도메인 판단과 뒤엉켰다. 단순 분리는 수렴하지 않았다.
- 상태가 있는 cold entry가 약 148KB까지 읽는 장면이 있었다.
- 역할 파일 다섯 개가 93.7~97.8% 유사하고 72%가 byte-identical인 복사본이 되었던 이력이 있다.
- 588개 검사를 매번 약 24분 실행하면서 놓친 계약 오류를 독립 논리 검토가 발견한 적이 있다.
- 공통 목적·Why·READ의 반복은 현재 요청, 승인 대기, 실제 소유자를 오히려 가렸다.

이 숫자는 새 설계를 정당화하는 요구사항이 아니다. 산문 복제, 읽기 폭증, 테스트 양과 효과의 불일치가 실제 비용이었다는 증거다. 기존 Skill Rails의 P0/P1/P2, V5 runtime, trace store, generated package 구조도 계승하지 않는다.

새 Skill Rails가 만드는 가치는 “규칙을 더 많이 기계화”하는 것이 아니다. AI가 의미를 판단해야 하는 부분은 자연어로 남기면서, 현재 사실 수집·결정 가능한 분기·반복·형식·현재성 검사를 작고 명시적인 기계 계약으로 넘겨 다음 총비용을 줄이는 것이다.

1. AI가 읽는 바이트와 관련 없는 정보
2. 같은 사실을 다시 찾는 도구 호출과 왕복
3. 형식 오류, stale 적용, 수동 복제에서 생기는 복구 비용
4. 스킬 저자와 유지보수자가 여러 정본을 맞추는 비용
5. host가 보장하지 않은 effect를 보장한다고 오해하는 위험

성공은 산문 기준안과 동일하거나 더 나은 과업 성공·안전을 유지하면서 위 비용 가운데 하나 이상을 반복적으로 제거하는 것이다. 더 복잡한 장치가 이름 붙은 비용을 실측으로 제거하지 못하면 산문을 선택한다.

이 성공은 반드시 두 소비자 경험에서 따로 확인한다. 사람과 저작 AI는 사용자 표현·실패 장면·owner·consumer를 한 정본에서 고치고 영향 범위를 찾을 수 있어야 한다. 생성된 skill을 처음 보는 사용 AI는 standalone package의 작은 entry에서 현재 작업에 필요한 최소 내용만 읽고 실제 행동과 복구를 수행할 수 있어야 한다. 한쪽의 편의를 위해 다른 쪽에 전체 source graph, 장문 Framework 또는 수동 복제 비용을 전가하면 제품 성공이 아니다.

## 2. 고정 경계와 책임 완전성

### 2.1 배포 단위

제품은 두 종류의 독립 배포물을 만든다.

1. **저작 스킬 `skill-rails-next`**: 사람과 AI가 domain source package를 만들고 검사·빌드·평가하도록 안내한다. 저장소의 canonical source는 `authoring/skill-rails/`, 설치·discovery 대상 generated package는 장래 최종 위치인 `skills/skill-rails/`에 둔다.
2. **target skill package**: 특정 목적을 수행하는 독립 설치 단위다. 실행 시 저작 스킬, 저장소의 형제 스킬, host 전역 Skill Rails에 의존하지 않는다.

alpha 기간의 root npm identity는 `@nanomia/skill-rails-next`, version은 `1.0.0-alpha.N`, 저작 스킬 identity는 `skill-rails-next`다. 저장소 안의 source/package **위치는 처음부터 최종 위치**를 쓰되, 설치 시험은 기존 전역 설치물과 다른 isolated agent home에서 exact local path로만 수행한다. 공식 installer가 directory명과 skill identity의 일치를 강제하는지는 M0에서 실측하며, 강제한다면 install adapter가 isolated destination만 `skill-rails-next`로 materialize한다. canonical source나 repository package 위치를 다시 옮기지 않는다. `skill-rails` identity와 `latest` 승계는 채택 게이트 뒤 별도 cutover 결정이다.

### 2.2 소유권 표

| 주체 | 유일하게 소유하는 것 | 소유하지 않는 것 |
| --- | --- | --- |
| Skill Rails core | source/target manifest 문법, 경로 격리, import 해석, deterministic build, receipt와 currentness 검사, prepare/record envelope, schema·basis·CAS·원자적 적용, 공통 오류 코드, 평가 harness | 도메인 규칙 내용, 어느 target이 어느 규칙을 소비하는지, 의미 판단, host 권한 부여 |
| domain package | 공통 규약과 지식의 내용, target 목록과 module import graph, 목적 kernel, deterministic observer와 renderer, 선언 출력 경로, stage별 완료 의미와 fixture | core의 경로·현재성·쓰기 정책, 다른 domain의 내용 |
| source graph query | canonical manifest·source·receipt에 이미 선언된 stable ID, owner, import, consumer, artifact와 기계 경계를 현재 bytes에서 투영 | 자연어 의미의 타당성, 선언되지 않은 관계, 실제 AI 행동이나 effect의 인과 |
| code-near comment/doc comment | 코드만으로 드러나지 않는 한 문장의 이유·불변조건·위험과 그 계약 또는 검사의 pointer | consumer/import/artifact 관계, 정확한 값·순서의 정본, 함수 동작의 반복 설명 |
| generated target | 필요한 module과 runtime의 materialized bytes, 작은 entry, package-local 계약과 receipt | 사람이 고치는 정본, 런타임 형제 target 의존 |
| AI | 자연어 의미 해석, 모호성 판단, 대안 비교, semantic answer 작성, host tool 사용 여부와 복구 선택 | hash/currentness/CAS 계산, renderer 형식, 권한이 없는 effect 보장 |
| deterministic observer | 선언된 파일의 존재·raw hash·명시 형식 필드·기계적으로 판독 가능한 상태 | 자유 산문의 의미, 완료 여부 추측, 사용자 의도 |
| deterministic renderer | 검증된 semantic answer와 기존의 renderer-owned region을 deterministic bytes로 변환 | 의미의 진실성, 출력 경로 선택, 파일 적용 |
| host/adapter | 실제 tool 권한, 승인, 프로세스·파일 API의 결과와 가능한 attestation | domain 의미, Skill Rails가 하지 않은 외부 effect |
| 사람용 설명 projection | 현재 source graph의 전체 그림·catalog·대표 흐름을 사람이 읽기 쉽게 표현 | build·판단·행동 정본, AI runtime 입력, 의미 동등성 증명 |
| 사용자 | 제품 목적·허용 비용·비가역 cutover 및 publish 승인 | 반복 가능한 계산의 수동 수행 |

한 기능의 소유자가 표에 없으면 구현하지 않는다. 동일 판단을 AI와 core가 함께 소유하게 만들지 않는다.

## 3. 확정한 중요 결정

각 결정은 현재 합의, 합의 근거, 기각한 대안이 더 나은 조건, 재개방 신호를 함께 가진다.

### D-01. 의미와 기계 처리는 “내용”이 아니라 판정 가능성으로 나눈다

- **결정**: 목적, 예외의 타당성, 증거의 충분성, 다음 행동의 의미는 AI가 맡는다. 존재·hash·schema·명시 enum·순서·경로 containment·CAS·정해진 템플릿 렌더링은 기계가 맡는다. AI가 만든 판단값을 단지 다음 분기를 계산하려고 AI에게 다시 읽히지 않는다.
- **근거**: 자유 산문에서 완료 의미를 regex로 찾는 것은 의미 판단을 기계에 숨기는 일이다. 반대로 hash와 currentness를 매번 AI가 비교하는 것은 반복 오차를 남긴다.
- **기각**: 전부 산문은 작은 단발 스킬에서는 더 싸다. 완전 DSL/워크플로 엔진은 의미가 이미 폐쇄적으로 정의되고 재실행량이 매우 큰 경우에만 더 낫다.
- **재개방**: observer가 `unknown`을 자주 내어 AI가 같은 기계 사실을 반복 복원하거나, schema가 의미 언어처럼 계속 팽창하면 경계를 다시 자른다.

### D-02. 부분 컴파일은 배포 시점의 준비와 적용을 포함하는 실험 가설이다

- **결정**: source + 현재 workspace의 결정 가능한 사실을 `PreparedWorkV1`으로 만들고, AI는 그 packet과 명시된 최소 자료를 읽어 `SemanticAnswerV1`을 작성한다. `record`가 현재성을 다시 확인하고 renderer를 호출해 제한된 결과를 적용한다.
- **근거**: 최초 기획의 핵심 비교에는 use-time 재개, stale, 충돌, exact format이 포함된다. 저작 시점 생성만으로는 이 가설을 시험할 수 없다.
- **기각**: 저작 시점에만 산문을 생성하는 방식은 runtime cohort 재빌드 비용이 효과보다 클 때 더 낫다.
- **재개방**: 첫 Verify 실험에서 prepare/packet이 산문보다 읽기·왕복·오류 총비용을 줄이지 못하면 prepare를 제거하고 renderer만 남기거나 전부 산문으로 돌아간다. probe 승리는 9-target runtime 내장을 자동 승인하지 않는다.

### D-03. 공유 정본은 whole-module build-time materialization으로 푼다

- **결정**: domain package가 공통 module의 단일 human-maintained source와 target별 import graph를 소유한다. core는 import된 **전체 module**과 필요한 공통 helper를 각 standalone target 안에 복사하고, source hash와 artifact hash receipt를 만든다. 동일 bytes가 여러 결과물에 있는 것은 허용하지만 generated marker가 있는 결과물을 사람이 고치면 build/check가 실패한다.
- **근거**: runtime 형제 참조는 독립 설치와 host path 도달 가능성을 깨뜨린다. 반면 기존 Devflow의 69%/31% 얽힘은 clause/section 단위 의미 slicing이 아직 정당화되지 않았음을 보인다. build-time 복사는 배포 독립성을 유지하면서 human canon을 하나로 만든다.
- **기각 대안**:
  - 저장소 공통 원본의 runtime 상대경로 참조: monorepo와 경로가 보장될 때는 가장 단순하지만 독립 배포에서 깨진다.
  - 중앙 service/동적 fetch: 즉시 현재성은 좋지만 offline, 권한, latency, service failure라는 새 제품 경계를 만든다.
  - clause/section projection: 실제 소비 차이가 안정적으로 측정될 때 context를 더 줄일 수 있으나 지금은 취약한 의미 분할이다.
  - 사람이 9개 복사본을 맞춤: 허용하지 않는다.
- **현재성 한계**: receipt는 “이 artifact가 어떤 source bytes에서 빌드되었는가”와 author workspace에서의 stale 여부만 증명한다. 이미 설치된 target이 원격 최신 정본인지 증명하지 않는다.
- **재개방**: 9-target cohort에서 작은 공통 변경의 rebuild/redeploy 비용이 절감된 authoring 비용보다 크거나, whole module 읽기가 실제 context 병목이면 동적 공유 또는 관찰된 소비 경계 기반 projection을 다시 비교한다.

### D-04. 기본 상태는 artifact-derived이며 durable semantic state를 두지 않는다

- **결정**: v1의 현재 상태는 선언 input/output의 현재 bytes에서 매 prepare마다 재계산한다. run exchange는 삭제 가능한 협업 scratch이며 제품의 진실이나 재개 기준이 아니다. global current, 장기 lock, 자동 merge, 범용 state store는 만들지 않는다.
- **근거**: natural-language pilot의 resume 판단은 네 문서 관찰로 복원 가능하다. 별도 state는 source와 갈라질 두 번째 진실을 만든다.
- **동시성**: 각 exchange는 nonce로 격리한다. `record`는 output별 짧은 exclusive lock을 먼저 얻고 그 안에서 모든 input basis와 output basis를 다시 확인한 뒤 apply와 reread까지 끝낸다. 하나라도 달라지면 쓰지 않고 stale을 반환한다. lock은 판단 상태가 아니라 lost-update를 막는 찰나의 조정 수단이다.
- **기각**: 여러 세션이 artifact에 남길 수 없는 예약·lease·외부 작업을 조정해야 하고 실제 손실 사례가 나오면 좁은 CAS store가 더 낫다.
- **재개방**: artifact만으로 재개하지 못한 실제 사례와 잃어버린 정보가 기록될 때 그 정보만 durable state로 승격한다.

### D-05. renderer는 의미를 만들지 않고 core는 renderer를 직접 호출한다

- **결정**: AI는 schema에 맞는 semantic JSON을 쓴다. core의 `record`가 package-local trusted renderer process를 직접 spawn하고 binary UTF-8 stdout을 받는다. renderer는 output path를 정하지 않으며 bytes만 반환한다. core만 선언 경로에 적용한다.
- **기존 내용 보존**: 첫 Verify renderer는 `verification.md`의 machine-owned region만 해석·재생성한다. region 밖 bytes는 그대로 보존한다. marker가 없으면 manifest가 허용한 `append-managed-region`만 수행하고, marker가 중복·손상되면 fail-closed한다. record는 stable `cardId`별 upsert를 수행하고 다른 card record를 보존한다.
- **근거**: 전체 파일 재생성은 성공 경로에서도 이전 card 기록을 조용히 지울 수 있다. AI가 renderer stdout을 중계하면 결정성 신뢰 사슬과 Windows byte 보존이 끊긴다.
- **한계**: domain renderer는 신뢰 코드이며 Node 권한으로 다른 effect를 낼 수도 있다. v1은 sandbox를 보장하지 않는다. review와 fixture test로 제한한다.
- **재개방**: 여러 renderer가 실제로 권한 오용하거나 제3자 domain package를 실행해야 할 때 subprocess sandbox/별도 권한 host를 평가한다.

### D-06. effect 주장은 실제 관찰 권한을 넘지 않는다

- **결정**: public evidence는 `proposed`, `attempted`, `observed`, `host-attested`를 구분한다. 첫 v1 adapter의 domain effect는 선언된 project-relative local file write 하나뿐이며, write 뒤 raw bytes를 다시 읽어 digest가 맞을 때만 `observed`라 한다. 동시성용 project-local lock directory는 별도의 transient coordination write로 표기하고 domain effect로 세지 않는다. command 실행, 메시지 전송, 원격 변경 adapter는 만들지 않는다.
- **AI의 command 결과**: AI가 host tool로 실행했다고 제출한 결과는 `ai-reported`이며 core가 `host-attested`로 승격하지 않는다.
- **근거**: runtime은 AI의 준수, host 승인, 외부 시스템 결과를 통제할 수 없다.
- **재개방**: host가 서명되거나 구조화된 실행 receipt를 주는 adapter가 생길 때 해당 effect에 한해 credit을 늘린다.

### D-07. greenfield contract v1은 legacy V5를 읽지 않는다

- **결정**: 새 source, exchange, answer, receipt는 각각 명시적 `schemaVersion: 1`을 사용하고 알 수 없는 major/필드를 fail-closed한다. generated target은 자신과 맞는 runtime을 내장한다. 제품은 `1.0.0-alpha.N` 계열로 시작하되 acceptance 전 publish하지 않는 것을 기본으로 한다.
- **근거**: 호환 layer는 새 경계 안에 과거 architecture를 되살린다. legacy standalone target은 현재 bytes로 계속 동작할 수 있다.
- **기각**: 조직이 기존 source를 자동 재생성해야 한다는 실제 전환 요구를 선택하면 별도 one-shot importer가 필요할 수 있다. importer도 runtime fallback은 아니다.
- **재개방**: 사용자가 legacy source 자동 변환의 비용을 승인하고 대표 corpus에서 무손실 판정 기준을 제공할 때만 importer를 별도 계획한다.

### D-08. first slice는 Verify이고, 그 승리의 범위를 제한한다

- **결정**: natural-language pilot의 Verify를 가설에 가장 유리한 반증 장면으로 먼저 구현한다. machine observer는 자유 산문 의미를 파싱하지 않는다. 고정 fixture와 명시 target config에서 파일 목록, hash, output, exact test command 같은 사실만 얻고 의미가 필요한 완료 상태는 `unknown` 또는 AI 판단으로 남긴다.
- **근거**: Verify는 명령, evidence, 누적 report, stale/collision, exact format을 한 장면에서 시험한다. 가장 유리한 stage에서조차 지면 기계를 일찍 제거할 수 있다.
- **비승계**: 이 실험은 67KB/148KB 공유 context 경제성, 일반 자유 산문 parser, 9-target materialization 경제성을 증명하지 않는다.
- **기각**: upstream artifact가 전부 자유 산문인 실제 Devflow에서 packet이 의미 있는 축소를 못 하면 Product renderer를 먼저 도입해 machine-readable projection을 생성한 뒤 Verify를 재시험하는 순서가 더 낫다.
- **재개방**: fixture 한정 결과가 actual Devflow에서 재현되지 않거나 packet 전체 비용이 산문 기준안에 근접하면 Verify prepare를 기각한다.

### D-09. 범용 판단 함수 선택기는 v1에 넣지 않는다

- **결정**: 최초 기획 §6.3의 판단 함수가 의도한 “작은 질문과 필요한 기준만 AI에게 전달”은 target이 정적으로 선언한 `Judgment` packet 블록으로 구현한다. 여러 판단 모듈을 등록하고 runtime이 하나를 고르는 범용 primitive는 v1에 넣지 않는다.
- **근거**: 첫 Verify target에는 현재 질문이 하나뿐이다. 선택기가 있어도 줄어드는 읽기나 분기가 없고 새 registry와 routing 계약만 생긴다.
- **기각**: 한 target 안에서 현재 관찰에 따라 서로 다른 판단 질문을 반복 선택해야 하며, target을 나누는 것보다 공통 context가 실제로 더 작다는 증거가 있으면 판단 함수 primitive가 더 낫다.
- **재개방**: 같은 standalone target에서 두 개 이상의 판단 질문을 AI가 매번 잘못 고르는 행동 증거와, deterministic fact만으로 안전하게 선택할 수 있는 경계가 함께 나타날 때 연다.

### D-10. legacy는 실행 가능한 subtree가 아니라 검증 가능한 capsule로 격리하고 새 구현은 최종 경로에서 시작한다

- **해결할 문제**: incubator는 기존 tree를 건드리지 않는 대신 package discovery, installer, test glob, npm payload와 생성 package 경로를 실제 배포와 다르게 만든다. 채택 뒤 같은 구조를 다시 옮기는 두 번째 전환도 남긴다. 반대로 legacy 파일을 그대로 `legacy/` 아래에 두면 재귀 discovery나 broad glob 한 줄이 과거 `SKILL.md`, test, package를 다시 활성화할 수 있다.
- **결정**: 실제 전환 승인 뒤 legacy implementation bytes는 `legacy/archive/v0.4.3/`의 non-executable archive capsule로 보존하고 active tree에서는 제거한다. 새 core, authoring source, domain source, tests와 generated authoring package는 §4의 장래 최종 위치에 처음부터 만든다. archive는 import·test·build·fallback·skill discovery 대상이 아니다.
- **근거**: 과거 root/fixture `SKILL.md`가 installer discovery에 노출된 장면이 있고, final path 조건을 M0부터 검증하는 것이 뒤 cutover 위험을 줄인다. capsule이 Git보다 더 최신인 새 정본이어서가 아니라, 사용자가 요구한 offline 물리 백업과 실행 표면에서 구조적으로 숨기는 기능 때문에 둔다.
- **역할 분리**: Git tag/release가 published identity, history와 후행 실패 대조를 소유한다. capsule은 전환 직전 worktree의 exact 물리 snapshot, 무결성 inventory와 복원 절차만 소유한다. 과거 코드의 비교·검색은 tar를 매번 풀지 않고 tag의 별도 checkout에서 한다.
- **기각 대안**: `incubator/skill-rails-next/`는 M4 기각 시 legacy로 복귀할 제품 전략을 택했거나 final tree를 바꿀 권한이 없을 때 더 낫다. Git tag만 남기고 active legacy를 제거하는 방식은 offline 물리 백업 요구가 철회되면 더 단순하다. 실행 가능한 `legacy/` 복사본은 discovery 위험 때문에 채택하지 않는다.
- **사용자 비용과 이점**: 구현 전 한 번의 inventory·capsule 생성·복원 rehearsal 비용이 생기지만, 이후 개발·설치·테스트가 최종 경로와 같아지고 두 번째 대규모 이동을 없앤다. 실제 파일 이동·삭제와 durable Git checkpoint는 각각 명시적 사용자 승인을 받은 뒤에만 한다.
- **재개방**: capsule에서 복원한 사례가 전혀 없고 유지·용량 비용이 커지거나, 공식 discovery가 archive content를 구조적으로 무시하지 않는다면 Git tag-only 또는 repository 밖 백업을 다시 비교한다.

### D-11. Universal Framework 원문이 routing을 소유하고 읽기 범위는 M5에서 비교한다

- **해결할 문제**: Framework는 독립 checklist 묶음이 아니라 공통 판단 기반 위에 기획·기술 결정·구현·검증·복구·독립 반증이 연결된 원문이다. 전체를 매번 읽히면 context가 커지고, 별도 task taxonomy나 사람이 쓴 요약을 만들면 원문 §0.1의 진입 경로·배경·예시·복귀 경계와 갈라질 수 있다. 실제로 이전 안의 다섯 유형은 원문이 가진 여섯 예시 중 `자연어·행동 계약 저작`을 잃었다.
- **결정**: 사람이 관리하는 의미·routing 정본은 `docs/guide/universal-ai-skill-inquiry-framework.md` 하나다. repository maintainer는 `AGENTS.md`에서 원문의 §0.1을 시작점으로 필요한 절을 직접 읽는다. M0~M4 runtime probe에는 Framework를 target package에 넣지 않는다. M5부터 저작 스킬은 원문 전체를 package-local generated reference로 materialize하고, entry는 먼저 원문 §0의 목적·공통 핵심·§0.1 진입표를 읽으라고만 지시한다. AI는 그 표와 현재 결정의 불확실성·파급·되돌림 비용을 보고 여러 원문 module을 조합하거나 추가로 열 수 있다. 다섯 유형을 비롯한 closed route 목록이나 사람이 관리하는 `work-routes.json`은 만들지 않는다. 저작 package manifest는 repository root의 `authoring-package.json`, source root도 repository root이므로 `docs/guide` 원문은 containment 안의 명시 source이며 `authoring/` 사본이나 path 예외는 없다.
- **기계적 탐색 surface**: M5 build는 원문에서 `sectionId`, heading text/level, parent, source byte range와 raw hash만 계산한 generated heading index를 만들 수 있다. selectable `sectionId`는 numbered H2/H3 heading의 선행 절 번호 문자열 그대로다(예: `0`, `4.1`). 번호 없는 nested heading은 가장 가까운 numbered parent range 안에 남고 별도 selectable ID를 갖지 않으며, 첫 H2 전 문서 서두는 `preamble` synthetic root다. 한 heading의 range는 그 heading byte부터 같은 또는 상위 level의 다음 heading 직전까지다. 이 index는 의미·선행조건·작업 유형을 선언하지 않는다. host의 bounded read가 가능하면 index와 whole original만 사용한다. bounded read가 불가능하거나 부분 lane이 반복해서 whole file을 여는 장면이 관찰될 때만 numbered H2/H3 subtree의 원문 body를 그대로 담은 generated projection을 추가한다. parent/child가 함께 선택되면 포함 byte range를 source order로 한 번만 출력한다. projection은 읽기 최적화이며 whole original을 대체하지 않고, 필요한 cross-reference는 언제든 다른 section 또는 전체 원문으로 확장할 수 있다.
- **generated projection 계약**: projection body는 canonical source의 exact bytes이고, generator가 붙이는 최소 header만 `generated/do not edit`, logical canonical source ID/path와 package-local receipt pointer를 가진다. 구체 hash와 provenance는 receipt 한 곳이 소유한다. heading index·projection을 사람이 수정하지 않으며 source hash/currentness가 다르면 build/check가 fail-closed한다.
- **채택은 가설**: M5는 같은 저작 계약과 raw task에서 `(0) Framework 입력 없음`, `(1) §0 공통 기반 뒤 §0.1에 따른 AI self-routing과 필요한 원문 section`, `(2) 전체 원문 선행 읽기`를 비교한다. 부분 읽기가 신뢰성과 총비용에서 이기지 못하면 부분 routing/index/projection을 축소하거나 제거한다. Framework 통합 자체를 제거하는 결정은 사용자의 확정 경계이므로 실험 결과만으로 자동 수행하지 않고 evidence를 가지고 사용자에게 되돌린다.
- **근거**: routing 의미를 원문 §0.1에 남기면 원문 변경이 곧 경로 변경이고 두 번째 taxonomy가 없다. heading index는 원문 byte에서 매 build 계산되는 navigation data라 의미 정본이 아니며, 원문 materialization·hash·currentness는 D-03을 재사용한다. 저위험 작업의 작은 context와 고위험·반복 실패의 넓은 경계 확인을 모두 허용하면서도 어떤 읽기 방식이 실제로 나은지는 증거 전까지 확정하지 않는다.
- **기각 대안**: Framework를 항상 전부 읽는 방식은 단순하지만 국소 작업 비용을 증명 없이 고정한다. 별도 dependency manifest는 절 간 의미 의존을 다시 해석하는 두 번째 정본이므로 만들지 않는다. 사람이 관리하는 축약본은 drift 때문에 기각한다. 원문 §0.1 self-routing이 반복해서 명시 전제를 누락한 행동 증거가 생길 때만, 원문에 실제로 적힌 의존 문장과 heading을 인용한 anchored selector를 별도 gate로 검토한다.
- **재개방**: 부분 lane이 전체보다 누락·재작업이 많거나 총비용이 낮지 않으면 해당 부분 장치를 제거한다. 반대로 whole-only가 단순 작업에서 반복 비용을 만들면 projection 범위를 넓힌다. M5 실험용 heading index도 실제 탐색 왕복을 줄이지 않으면 실험 뒤 production 경로에서 제거한다.

### D-12. 유지보수 view는 canonical source graph에서 그때 계산하고 의미 edge는 필요가 관찰될 때만 추가한다

- **해결할 문제**: 여러 target에서 AI가 `요구/목적 → owner → source → consumer → artifact → observer·renderer·contract → check·외부 경계`를 수동 역산하면 context와 누락이 늘어난다. 그러나 이 관계를 별도 index 파일에 다시 적으면 새 수동 정본이 된다.
- **결정**: M1은 §5.1이 이미 소유하는 `packageId`, `targetId`, module path, imports, observer, renderer, contract, declared input/output와 build receipt만으로 exact-ID/path `inspect` view를 계산한다. 신규 semantic edge field는 M1에 추가하지 않는다. generated target에는 자기 identity, 실제 imported source/artifact hash와 package-local receipt만 넣고 suite reverse graph는 넣지 않는다.
- **관찰 기반 확장**: M5 fresh author/maintainer가 실제 requirement owner, check 또는 미확인 외부 경계를 찾지 못한 장면을 기록했을 때만 그 관계의 canonical owner에 stable ID를 colocate한다. 요구 본문 heading이 요구를, module metadata가 그 요구를 맡는 관계를, test source metadata가 검증 claim을 각각 한 번만 소유하게 하며 별도 index 문서는 만들지 않는다. exact field/schema는 그 실패 장면과 질의가 요구한 최소 edge만 대상으로 별도 M5 gate에서 닫는다.
- **suite와 target 경계**: source workspace의 suite view가 target→module과 역방향 consumer를 계산한다. 설치된 target은 suite를 모른 채 자기 receipt만으로 integrity와 provenance를 확인한다. runtime 사용 AI는 maintenance view를 읽지 않는다.
- **한계**: query는 선언된 관계와 현재 경로만 보여준다. 자연어 의미가 옳음, AI가 실제로 그 경로를 따름, effect가 발생함을 증명하지 않는다. 누락된 관계는 완전하다고 추정하지 않고 `gap`으로 표시한다.
- **기각 대안**: 여러 수동 index, fuzzy semantic search와 repository-wide causal truth는 기각한다. 한 target에서는 manifest와 receipt 직접 읽기가 더 싸면 view를 생략한다. inverse impact command는 consumer를 눈으로 역산하지 못한 실제 장면에서만 도입하되 Devflow 9-target 전체 편입 전에 닫는다.
- **재개방**: exact-ID/path query가 실제 유지보수 read·누락을 줄이지 못하면 CLI view를 제거한다. 반대로 같은 관계 탐색 실패가 반복되면 별도 index가 아니라 관계의 canonical owner 선언을 가장 작게 늘린다.

### D-13. 사람용 설명은 정본이 아닌 on-demand projection이며 관찰 전에는 생성기를 만들지 않는다

- **해결할 문제**: 사람은 전체 목적, 번호가 있는 구성, 관계도와 대표 흐름이 필요하지만 AI maintenance에는 stable ID와 좁은 query가 더 싸다. 두 소비자에게 한 문서를 강요하면 어느 쪽에도 불필요한 정보가 된다.
- **결정**: M0~M4와 단일 target에는 사람용 graph 문서 생성기를 만들지 않는다. 둘 이상의 실제 target에서 사람이 구조·관계 질문을 반복하거나 source graph를 수동 역산한 비용이 관찰되면, 같은 current graph에서 기본 한 개의 on-demand overview를 생성한다. 필요가 입증되기 전에는 파일 수, Mermaid 종류와 문서 분할을 고정하지 않는다.
- **계약**: projection은 제품 목적, target 역할, shared module과 consumer, 주요 input/output·artifact와 대표 흐름만 보여준다. `generated`, `non-authoritative`, `sourceGraphSha256`와 실제 렌더 입력만의 `projectionInputSha256`를 표시하고 AI runtime package와 AI maintenance router에서 제외한다. 사람이 generated 결과를 고쳐 정본으로 만들 수 없다.
- **현재성**: 기본은 커밋하지 않는 on-demand 출력이어서 stale 사본을 남기지 않는다. GitHub 등에서 바로 읽을 실제 필요가 확인되어 commit한다면 target/module/consumer/I-O 또는 projection에 실린 목적 내용이 바뀌어 `projectionInputSha256`가 달라질 때 warning을 낸다. projection에 사용하지 않은 내부 구현 정리나 사소한 문구 변경은 재생성 이유가 아니다. 기본 링크·경로 check와 regeneration diff는 documentation check이며 의미 동등성·행동·effect 또는 core build의 hard gate로 올리지 않는다.
- **기각 대안**: README나 AI index를 사람용 전체 설명과 겸용하지 않는다. 작고 target 하나뿐인 package에서는 직접 manifest를 읽는 방식이 더 낫다.
- **재개방**: 사람이 반복해서 같은 전체 관계를 재구성하거나 잘못된 target을 수정한 장면이 생기면 projection을 도입·분할한다. 생성 문서가 실제로 읽히지 않거나 stale 경고가 상시화되면 다시 on-demand 출력으로 축소한다.

### D-14. 전역 관계는 graph가, 국소 이유와 위험은 code-near comment가 소유한다

- **해결할 문제**: 중앙 문서·graph만 있으면 낯선 maintainer가 위험한 코드에서 불변조건의 이유를 놓칠 수 있고, 반대로 code comment가 owner·consumer·artifact 관계와 정확한 동작을 다시 쓰면 곧 낡은 두 번째 설명 체계가 된다.
- **결정**: source graph와 `inspect`는 전역 owner→source→consumer→artifact→check·외부 경계를 소유한다. 코드 가까운 짧은 comment/doc comment는 코드와 type만으로 알 수 없는 **한 문장의 why/invariant/risk**와 owning contract 또는 검사의 stable pointer만 소유한다. 우선 pointer는 targeted test 이름, 다음은 오류 코드·contract/schema ID, 계획 절 번호는 마지막 수단이다.
- **필수 위치**: public CLI/API가 비직관적 precondition·effect를 가질 때, currentness/CAS/output lock, authority/effect claim, 보존·fail-closed 같은 비직관적 방어 로직에는 위 형식의 주석을 둔다. 함수 이름·입출력·분기 순서, exact enum·timeout·경로 값, consumer/import 목록처럼 코드·schema·graph가 이미 말하는 것은 반복하지 않는다. 모든 함수 주석, comment-density 목표와 comment를 위한 별도 index는 만들지 않는다.
- **변경 규칙**: invariant를 바꾸는 source change는 owning code·targeted test 또는 contract와 해당 comment를 한 change에서 검토한다. comment가 코드와 충돌하면 comment를 새 정본으로 고치지 않고 실제 owner를 먼저 확인한 뒤 이유가 여전히 유효할 때만 갱신하며, 가치 없는 comment는 제거한다. comment는 currentness나 correctness의 증거가 아니다.
- **generated 파일**: 사람이 주석을 따로 관리하지 않는다. generator가 syntax가 허용되는 생성물에 `generated/do not edit`, logical canonical source ID/path와 receipt pointer만 넣는다. hash, consumer 관계, 함수 설명과 불변조건의 재서술은 receipt·source·test가 소유한다. package 사용자가 comment 없이 같은 위험을 오해한 실제 사례가 있을 때만 canonical generator source의 한 문장 why/risk를 추가한다.
- **비용 gate**: M5의 낯선 maintainer가 graph로 owner를 찾고 code-near pointer로 위험과 검증 경로를 복원하는지 관찰한다. 주석이 읽기 왕복·drift를 늘리고 안전한 변경이나 복구를 개선하지 않으면 generated marker와 실제 고위험 위치만 남기고 축소한다.

## 4. greenfield source와 생성물 구조

기존 root 구현을 기준선으로 삼지 않는다. legacy를 capsule로 격리한 뒤 첫 구현부터 다음 최종 source/package 배치를 사용한다. `incubator/`를 만들지 않는다.

```text
package.json                  # @nanomia/skill-rails-next, private alpha
package-lock.json
authoring-package.json        # 저작 스킬 source manifest; source root는 repository root
contracts/
  source-package.schema.json
  target.schema.json
  prepared-work.schema.json
  observed-facts.schema.json
  build-receipt.schema.json
src/core/
  cli.mjs
  validate.mjs
  paths.mjs
  canonicalize.mjs
  build.mjs
  check.mjs
  inspect.mjs
  prepare.mjs
  record.mjs
  apply-file.mjs
  errors.mjs
authoring/skill-rails/         # 사람이 고치는 저작 스킬 source
  SKILL.source.md
  targets/authoring/
    target.json
domains/natural-language-pilot/
  skill-package.json
  modules/
    purpose.md
    verify-baseline.md
  targets/verify/
    target.json
    config.json
    config.schema.json
    entry.md
    observer.mjs
    renderer.mjs
    contracts/
      semantic-answer.verify.schema.json
skills/skill-rails/            # generated·tracked, 유일한 repository skill
fixtures/verify-v1/            # source fixture; discoverable SKILL.md 없음
  project/
    package.json
    test/                       # verificationCommand가 실제 실행되는 최소 deterministic fixture
  control/
  treatment/
tests/
  build.test.mjs
  inspect.test.mjs
  prepare.test.mjs
  record.test.mjs
  shared-source.test.mjs
  experiment-protocol.test.mjs
legacy/archive/v0.4.3/
  README.md                    # 역할과 복원 절차, runtime 지침 아님
  inventory.json              # 원경로·분류·hash·mode·capsule hash
  legacy-source.tar           # 실행·discovery 불가능한 물리 snapshot
  worktree-overlay.patch      # 해당 시점 tracked 변경이 있을 때만
  untracked-overlay.tar       # legacy-owned untracked가 있을 때만
```

`authoring-package.json`도 §5와 같은 source package 계약을 사용하되 manifest directory인 repository root가 source root다. M1에서는 `authoring/skill-rails/`의 최소 source만 선언하고, M5에서 target imports에 `docs/guide/universal-ai-skill-inquiry-framework.md` whole module을 추가한다. routing 의미는 원문 §0.1이 소유하므로 별도 `work-routes.json`은 없다. D-11의 heading index와 조건부 projection은 generated target의 `references/`와 receipt에만 생긴다. 그 밖의 root 파일은 어느 단계에서도 암묵적 입력이 아니다. `skills/skill-rails/`는 여기서 생성되는 설치 surface이므로 사람이 직접 수정하지 않는다. GitHub/local-path skill 설치가 build 선행 없이도 exact reviewed bytes를 가져갈 수 있도록 이 generated package는 **commit 대상**이다. source와 generated diff, receipt currentness가 같은 change에서 검사되어야 한다. 실험용 target은 repository의 다른 `skills/*`에 쓰지 않고 isolated temporary install root에 생성한다.

root `package.json`의 M0 계약은 다음과 같다.

- `name: "@nanomia/skill-rails-next"`, `version: "1.0.0-alpha.1"`, `private: true`, `type: "module"`로 시작한다.
- `files` allowlist는 `skills/skill-rails/**`, `README.md`, `README.ko.md`만 허용한다. `legacy`, `domains`, `fixtures`, `tests`, maintainer docs와 source는 npm payload에 들어가지 않는다.
- `test`는 active `tests` root만 입력으로 받고 archive나 fixture 내부의 broad `*.test.mjs`를 재귀 검색하지 않는다. domain fixture 실행은 active test가 명시적으로 import한다.
- `workspaces`, legacy export, postinstall, publish hook과 runtime fallback을 두지 않는다. M8 승인 전 `private`을 해제하지 않는다.
- repository skill discovery preflight는 active tree에서 `skills/skill-rails/SKILL.md` 하나만 발견되어야 한다. installer별 실제 discovery 결과도 isolated agent home에서 같은 수를 보여야 한다.
- active `src`, `authoring`, `domains`, `tests`, `skills`에서 `legacy/`를 import·spawn·fallback source로 참조하면 검사 실패다. `legacy/archive` 안의 README는 이 금지를 풀 수 없다.

### 4.1 전환 inventory와 분류

“전체 백업”은 저장소 모든 파일을 무차별 이동하는 뜻이 아니다. 전환 직전 `git status --porcelain=v2`, HEAD/tag, tracked file mode와 raw SHA-256, untracked/ignored 분류를 먼저 고정하고 다음 네 범주로 판정한다.

| 범주 | 현재 후보 | 처리 |
| --- | --- | --- |
| 그대로 유지할 정본·기반 | `.git`, 동결 기획, 이 상세 계획, Universal Framework, `docs/authoring-lessons_ko.md`, 사용자 변경이 있는 `README.md`·`README.ko.md`, 필요한 docs assets | 원래 경로 유지. archive 이동 대상이 아니며 사용자 변경을 덮어쓰지 않음 |
| 경로는 유지하되 새 project owner로 갱신 | `AGENTS.md`, `CLAUDE.md`, `docs/maintenance-status_ko.md`, `docs/skill-rails_ko.md`, `docs/implementation-verification_ko.md`, `.gitignore`, `.gitattributes` | 기존 bytes는 capsule에 포함하고 같은 경로의 새 역할로 한 번에 갱신 |
| legacy implementation으로 archive 후 active tree에서 제거·대체 | 기존 `skills/skill-rails/`, `scripts/`, `tests/`, `fixtures/`, `evals/`, root `package.json`·lock, legacy release workflow, legacy 계약만 설명하는 upgrade/evidence docs | capsule·inventory·복원 rehearsal을 통과한 뒤 제거하고 필요한 최종 경로를 새 source로 생성 |
| local transient | `node_modules/`, `.npm-cache/`, `.tmp/`, legacy runtime scratch | source backup 대상 아님. 자동 삭제하지 않고 active build/discovery 입력에서 제외 |

이 표는 현재 inventory에 근거한 후보 분류다. 실행 직전 새 tracked/untracked 변경이 archive·대체 경로와 겹치면 base bytes와 working bytes를 각각 capsule/overlay에 보존하고 `USER_CHANGE_CONFLICT`로 멈춘다. 그 변경을 legacy로 폐기할지 새 source로 이식할지는 자동 추정하지 않는다. 현재 확인된 dirty README 두 파일과 untracked `docs/guide`, `docs/plan`은 첫 범주이므로 이동하지 않는다.

동결 기획·Framework·상세 계획처럼 유일한 untracked 판단 정본은 어떤 이동보다 먼저 durable Git checkpoint로 보호해야 한다. 이번 작업에서는 commit을 하지 않는다. 실제 전환 때도 사용자가 commit을 명시적으로 승인하기 전에는 read-only inventory와 hash 기록까지만 수행하고 archive·이동으로 진행하지 않는다.

### 4.2 capsule 생성, 이동 순서와 rollback

1. inventory를 확정하고 각 path를 위 네 범주 중 하나로 전부 분류한다. 범주 없는 tracked path가 있으면 중단한다.
2. durable Git checkpoint와 v0.4.3 tag/release가 실제로 읽히는지 확인한다.
3. `legacy-source.tar`를 staging에 만들고 원경로, raw hash, mode, Git object/source, retained/replace/archive 분류를 `inventory.json`에 기록한다. tracked diff와 legacy-owned untracked가 있으면 base와 별도로 overlay를 만든다.
4. capsule 자체 hash를 inventory 밖의 M0 receipt에도 기록하고, 새 temporary directory에 복원해 inventory와 byte/mode를 대조한다. live root에 바로 복원하지 않는다.
5. 사용자에게 exact 이동·제거 목록과 복원 receipt를 제시하고 명시 승인을 받은 뒤에만 archive 대상의 active bytes를 제거한다.
6. 같은 coherent transition에서 root allowlist와 §4 최종 skeleton을 만든다. archive 제거만 하고 새 owner를 비워 두거나, 새 source를 먼저 legacy fallback에 연결하지 않는다.
7. root `authoring-package.json`의 source 목록, package payload, test selection, skill discovery, import graph가 legacy를 0건 포함하고 final-path alpha가 isolated home에서 설치되는지 확인한다.

rollback은 Git tag 또는 capsule을 **새 temporary root에** 복원하고 hash를 확인한 뒤, 새 tree를 덮어쓸 별도 사용자 승인으로 수행한다. Git tag는 일반적인 비교·복원을, capsule은 Git 접근 불가 시 물리 복원을 담당한다. capsule과 tag가 다르면 inventory에 명시된 source class를 따르며 조용히 병합하지 않는다.

표준 라이브러리만 쓰는 Node.js ESM을 첫 adapter로 선택한다. 기준 runtime은 구현 시작 시 CI와 host가 공통 지원하는 Node LTS major 하나를 고정하고 `engines.node`와 preflight에서 동일하게 검사한다. 특정 major 번호는 그 시점의 host 실측 없이 이 계획에서 추측하지 않는다.

Node를 선택한 이유는 현 Codex/Claude host와 기존 검증 환경에서 이미 실행 가능하고 standalone target에 interpreter 외 설치를 요구하지 않기 때문이다. Python은 별도 interpreter 가용성이 갈리고, Rust binary는 배포 matrix가 늘어난다. Node 가용성이 실제 target host에서 성립하지 않으면 core 계약은 유지하고 adapter만 다시 고른다.

## 5. source package와 build 계약

### 5.1 최소 source manifest

`domains/natural-language-pilot/skill-package.json`은 package manager manifest와 분리된 domain source manifest다.

```json
{
  "schemaVersion": 1,
  "packageId": "natural-language-pilot",
  "packageVersion": "0.0.1",
  "modules": {
    "purpose": "modules/purpose.md",
    "verifyBaseline": "modules/verify-baseline.md"
  },
  "targets": {
    "verify-next": "targets/verify/target.json"
  }
}
```

`target.json`의 v1 필수 의미는 다음과 같다.

```json
{
  "schemaVersion": 1,
  "targetId": "natural-language-pilot-verify-next",
  "mode": "prepare-record",
  "entry": "entry.md",
  "imports": ["purpose"],
  "fallbackModule": "verifyBaseline",
  "domainConfig": "config.json",
  "domainConfigSchema": "config.schema.json",
  "observer": "observer.mjs",
  "renderer": "renderer.mjs",
  "answerContract": "contracts/semantic-answer.verify.schema.json",
  "declaredInputs": [
    "pilot/brief.md",
    "pilot/plan.md",
    "pilot/progress.md",
    "pilot/verification.md"
  ],
  "declaredOutput": "pilot/verification.md",
  "outputMode": "managed-region",
  "regionBootstrap": "append-managed-region"
}
```

실제 JSON schema가 허용하는 값은 위 필드뿐이다. v1은 unknown field를 거부한다. `mode`는 다음 세 closed shape 중 하나를 고른다.

- `prose`: `schemaVersion`, `targetId`, `mode`, `entry`, `imports`만 필수이며 machine field와 `fallbackModule`을 금지한다.
- `prepare-record`: 위 Verify 예시의 prepare·record field를 모두 요구한다.
- `record-only`: `observer`와 `fallbackModule`을 금지하고 `domainConfig`, `domainConfigSchema`, `renderer`, `answerContract`, `declaredInputs`, `declaredOutput`, `outputMode`, `regionBootstrap`을 모두 요구한다. AI가 entry의 산문 기준으로 answer를 쓰고 record만 사용하므로 M4의 renderer-only 채택을 표현한다.

부분 그룹이나 dummy observer/renderer는 허용하지 않는다. 새 mode가 필요하면 실제 target 반례와 독립 gate로 schema를 다시 연다. `domainConfig`, `domainConfigSchema`와 `answerContract`는 core가 의미를 해석하지 않는 domain-owned file의 **source target-directory-relative** 경로다. core는 이 파일들을 containment·hash·schema 검증·materialization 대상으로 삼는다. `answerContract`는 generated target의 같은 relative path로 복사되며 core가 Verify 의미 schema를 소유하거나 이름으로 찾지 않는다. 검증된 config는 observer/renderer에 전달한다. Verify의 `config.json`은 `config.schema.json`으로 다음 필드를 닫아 둔다.

```json
{
  "schemaVersion": 1,
  "cardId": "bookmark-storage",
  "verificationCommand": {
    "program": "npm",
    "args": ["test", "--", "bookmark-storage"],
    "cwd": "."
  }
}
```

core는 이 명령을 실행하지 않는다. observer는 구조화된 명령을 fact로 옮기고, AI가 host tool로 실행할지 판단한다. shell 문자열 대신 `program`과 `args`를 나누어 quoting 해석을 domain code에 숨기지 않는다. target이 어떤 module을 소비하는지는 domain package가 결정하며 core가 이름이나 문장을 보고 추론하지 않는다.

### 5.2 build 순서

build는 두 출력 형태만 허용한다.

```text
node src/core/cli.mjs build --source <skill-package.json> --out-root <dist-root>
node src/core/cli.mjs build --source <skill-package.json> --target <target-id> --out <exact-target-directory>
```

첫 형태는 manifest의 모든 target을 `<dist-root>/skills/<targetId>/`에 생성한다. 둘째 형태는 target 하나를 지정한 exact directory에 생성하며 repository authoring source의 `skill-rails-next` target을 `skills/skill-rails/`에 materialize할 때만 active tree에서 사용한다. 두 형태 모두 다음 순서를 고정한다.

1. source와 target schema/version을 검사하고, 각 `domainConfig`를 그 target이 선언한 `domainConfigSchema`로 검사한다.
2. 모든 경로를 source root 기준 realpath로 해석하고 root 밖, symlink escape, absolute path, `..` escape를 거부한다.
3. module id 충돌, target id 충돌, 빠진 import, cycle, case-fold collision을 거부한다.
4. text source는 UTF-8 without BOM과 LF로 canonicalize한다. binary input은 v1에서 허용하지 않는다.
5. target별 필요한 whole module, entry, domain config와 그 schema, observer, renderer, 공통 runtime과 contract만 staging directory에 materialize한다.
6. `SKILL.md` entry를 생성한다. fallback 산문은 control baseline과 같은 canonical source module에서 생성하지만 entry에서 직접 노출하지 않는다.
7. 각 artifact의 canonical source hash와 최종 byte hash를 계산해 `.skill-rails-build.json`을 쓴다.
8. 새 staging tree를 다시 검증하고 성공한 경우에만 선언된 exact target directory를 교체한다. 실패 시 기존 target은 건드리지 않는다. `--out-root`는 target별 교체를 수행하고 한 target 실패를 성공한 것처럼 전체 publish하지 않는다.

같은 canonical source bytes, core version, target config에서 dist bytes와 receipt는 같아야 한다. 생성 시각, absolute source path, random id는 receipt의 deterministic 영역에 넣지 않는다. 진단용 실행 metadata가 필요하면 receipt 밖 로그로 둔다.

### 5.3 build receipt와 currentness

receipt의 최소 필드는 다음과 같다.

```json
{
  "schemaVersion": 1,
  "coreVersion": "1.0.0-alpha.1",
  "packageId": "natural-language-pilot",
  "packageVersion": "0.0.1",
  "targetId": "natural-language-pilot-verify-next",
  "sources": [{"id": "purpose", "path": "modules/purpose.md", "sha256": "..."}],
  "artifacts": [{"path": "references/purpose.md", "sha256": "..."}],
  "imports": ["purpose"],
  "treeSha256": "..."
}
```

`check`는 source와 dist를 함께 받을 때 source freshness, dist 자체만 받을 때 artifact integrity만 판정한다. 둘을 같은 “current”로 표현하지 않는다.

- `source-current`: 현재 author source에서 다시 빌드하면 같은 artifact가 나옴
- `artifact-intact`: 설치 tree가 receipt와 같음
- `remote-latest`: v1이 알 수 없음

generated artifact의 receipt hash가 다르면 사용자 편집을 복원하거나 병합하지 않고 `GENERATED_ARTIFACT_MODIFIED`로 실패한다.

## 6. 부분 컴파일과 AI 최소 작업 인터페이스

### 6.1 prepare의 입력·처리·출력

호출 형태는 다음 하나로 시작한다.

```text
node <target-root>/scripts/run.mjs prepare --project <project-root>
```

성공 시 stdout에는 사람이 읽는 packet 전체가 아니라 작은 locator envelope만 JSON으로 반환한다.

```json
{
  "schemaVersion": 1,
  "status": "PREPARED",
  "packet": "<run-exchange>/packet.md",
  "answer": "<run-exchange>/answer.json",
  "recordCommand": "node <target-root>/scripts/run.mjs record --exchange <run-exchange>"
}
```

exchange의 물리 위치는 public contract가 아니다. 구현은 충돌하지 않는 nonce directory, record 성공 전 answer 생존, 같은 workspace에서 재-prepare 가능, 다른 project로 이식 시 fail-closed라는 성질을 만족해야 한다. 첫 adapter test는 caller가 제공한 임시 root를 사용하고, 실제 CLI 기본 위치는 구현 시 host에서 쓰기 가능성과 crash 복구를 실측해 정한다. exchange는 semantic durable state가 아니며 지워져도 source/artifact에서 다시 만들 수 있다.

`prepare` 처리:

1. target receipt integrity와 contract version을 확인한다.
2. project root realpath와 declared input/output containment를 확인한다.
3. declared input 각각에 대해 `absent` 또는 raw-byte SHA-256 basis를 만든다. CRLF도 변경으로 취급한다.
4. observer를 호출해 명시 형식에서만 deterministic fact를 얻는다. 자유 산문 의미가 필요하거나 형식이 다르면 추측하지 않고 `unknown`을 반환한다.
5. purpose kernel, 현재 facts, AI가 할 한 가지 행동, 읽을 최소 file/ref, semantic answer 요구, 완료 조건, effect 한계, 오류 복구를 `PreparedWorkV1`에 만든다.
6. `decision.json`, `exchange.json`, `packet.md`, 필수 key와 `null`/빈 배열을 가진 `answer.json` skeleton을 격리된 exchange에 쓴다. skeleton은 작성 안내이며 record가 받는 유효 answer가 아니므로 남은 `null`이 있으면 `ANSWER_INVALID`다.

observer 호출 protocol은 고정한다. core가 declared input의 project-relative path, `absent|present`, raw hash, UTF-8 text와 검증된 domain config를 단일 UTF-8 JSON object로 stdin에 보낸다. observer는 10,000ms 안에 closed `ObservedFactsV1` JSON 하나만 stdout에 쓰고 diagnostics는 stderr에 쓴다. 초과하면 child를 종료하고 `PREPARE_FAILED`로 no-write한다. observer가 project filesystem을 직접 걷거나 미선언 파일을 추가로 읽는 것은 v1 계약 밖이다.

core-owned `contracts/observed-facts.schema.json`이 `ObservedFactsV1` 검증의 유일한 schema owner다. 형태는 `{schemaVersion: 1, facts: [{id, value, basisPaths, authority: "machine-observed"}], unknowns: [{id, reasonCode, basisPaths}]}`다. `id`는 한 결과 안에서 유일하고 Unicode code point 오름차순이며, `basisPaths`는 declared input의 project-relative path만 가리킨다. `value`는 canonical JSON value이고 실행 시각·absolute path를 포함하지 않는다. `unknowns`는 prepare 성공 안에 남는 사실이지 통과나 오류가 아니다.

`decision.json`의 semantic hash에는 `schemaVersion`, target id/package version/receipt tree hash, project-relative input·output basis, observed facts와 unknowns, purpose hash, 현재 action, `Judgment` 질문·기준 owner, reads, return contract hash, completion criteria, authority와 fallback eligibility가 들어간다. key는 Unicode code point 순서로 정렬한 canonical JSON, array 순서는 보존한다. `decisionSha256` 자체, nonce, timestamp, absolute project/exchange/target path, locator와 record command는 제외하고 `exchange.json`에 둔다. 따라서 같은 source/workspace bytes에서 동일해야 하는 것은 이 semantic hash이며 envelope/packet footer 전체 bytes가 아니다.

도구는 record 성공 또는 사용자의 명시적 cleanup 전에는 exchange를 자동 삭제하지 않는다. record 성공 뒤에는 receipt를 반환한 다음 삭제할 수 있고, crash 뒤 남은 exchange는 correctness의 정본이 아니지만 answer 복구에 사용할 수 있다.

### 6.2 AI가 실제로 읽고 응답하는 것

generated `SKILL.md`는 다음만 담는다.

1. 한 문장 purpose와 “먼저 prepare”라는 단일 진입 명령
2. 성공 시 `packet.md`만 열라는 지시
3. prepare 실패 시에만 package-local fallback을 열라는 오류별 경로
4. `answer.json`을 채우고 packet의 exact record command를 실행하라는 반환 계약

packet은 다음 여덟 블록만 허용한다.

- `Purpose`: 이 target이 지키는 핵심 1~3문장
- `Observed`: basis가 있는 결정 가능 사실과 명시적 `unknown`
- `Do now`: 한 가지 현재 행동
- `Judgment`: AI가 답할 질문 하나, 판단 기준, 그 기준을 소유하는 exact ref/file
- `Read`: AI 판단에 꼭 필요한 file/ref 목록과 이유
- `Return`: answer schema의 의미 필드
- `Done when`: 성공과 `unproven`의 구분
- `Authority and recovery`: effect credit, stale/fallback/re-prepare, exact record command

내부 compiler dump, 모든 후보, 전체 공통 지식, 사용하지 않는 stage 규칙은 packet에 넣지 않는다. packet + 실제 추가 읽기 + 복구 안내의 합이 control 산문보다 싼지 측정한다.

### 6.3 Verify `SemanticAnswerV1`

첫 schema의 의미 필드는 다음으로 고정한다.

```json
{
  "schemaVersion": 1,
  "cardId": "bookmark-storage",
  "verdict": "pass",
  "summary": "Acceptance 기준을 만족했다.",
  "checks": [
    {
      "name": "targeted-tests",
      "outcome": "pass",
      "evidence": [{"authority": "ai-reported", "reference": "npm test -- ..."}]
    }
  ],
  "unknowns": []
}
```

`verdict`는 `pass|fail|unproven`, check outcome은 `pass|fail|unproven`만 허용한다. 빈 evidence의 `pass`는 schema에서 거부한다. 이 검사는 의미의 진실성을 증명하지 않으며 renderer는 authority label을 그대로 보여준다. AI가 output path, renderer, basis를 answer에 넣어도 unknown field이므로 거부한다.

### 6.4 record의 무손실·현재성 계약

```text
node <target-root>/scripts/run.mjs record --exchange <run-exchange>
```

`record`는 다음 순서 이외의 쓰기를 하지 않는다.

1. exchange schema, target identity, project realpath, answer schema를 검사한다.
2. project 내부 `.skill-rails-next/locks/<sha256(declaredOutput의 UTF-8 manifest 문자열)>.lock` directory를 atomic `mkdir`로 생성해 output-exclusive lock을 얻는다. v1 manifest path는 `/` separator, 중복 separator와 `.` segment 없음, case 보존으로 canonicalize된 문자열이므로 모든 session이 같은 이름을 계산한다. 이미 있으면 기다리거나 깨지 않고 `OUTPUT_BUSY`로 no-write한다. lock metadata에는 project/output/run identity와 진단 전용 hostname, pid, 생성 시각을 쓴다. 이 정보는 자동 파기나 semantic state 판단에 쓰지 않는다.
3. lock 안에서 **모든 declared input basis와 output basis**를 raw bytes로 재계산한다.
4. input 하나라도 바뀌면 `INPUT_STALE`, output만 바뀌면 `OUTPUT_CONFLICT`로 no-write한다.
5. current output bytes, validated answer, static renderer config를 renderer child process에 직접 전달한다. renderer가 10,000ms 안에 끝나지 않으면 child를 종료하고 `RENDER_FAILED`를 반환한다.
6. renderer stdout을 Buffer로 받고 size/UTF-8/managed-region 보존 규칙을 검사한다.
7. desired bytes가 current output과 이미 같으면 `APPLIED_ALREADY` 멱등 성공을 반환한다.
8. target manifest에 고정된 declared output만 root containment 검사 후 sibling staging file과 atomic replace로 쓴다.
9. lock을 유지한 채 파일을 다시 읽어 desired hash와 같을 때 `observed`; 그렇지 않으면 `attempted`와 복구 오류를 반환한다.
10. 모든 종료 경로의 `finally`에서 자신이 얻은 lock만 제거한다. crash가 남긴 lock은 자동 파기하지 않으며 사용자가 active process 부재를 확인한 뒤 명시적 cleanup으로 제거한다.

renderer 호출 protocol도 고정한다. core는 `{schemaVersion, currentOutputBase64, validatedAnswer, domainConfig}` 단일 JSON을 UTF-8 stdin으로 보내고, renderer는 최종 output raw UTF-8 bytes만 stdout에 쓴다. diagnostics는 stderr로 제한한다. AI는 이 process나 stdout을 중계하지 않는다.

renderer는 `<!-- skill-rails-next:verify-records:start -->`와 대응 end marker 사이만 소유한다. marker 밖 prefix/suffix는 byte-for-byte 유지한다. 같은 `cardId`는 하나뿐이고 Unicode code point 기준 `cardId` 오름차순으로 전체 owned region을 다시 만든다. exact Markdown byte template과 reserved character escape는 `renderer.mjs`와 그 golden fixture가 domain 정본이며 AI가 재현하지 않는다. 중복/malformed marker, duplicate card, invalid 기존 owned record는 쓰기 없이 실패한다. 파일이 absent/0 bytes이면 start marker를 첫 byte로 하여 region과 final LF를 생성한다. non-empty 파일에 marker가 없으면 기존 bytes를 그대로 두고, 기존 끝이 LF이면 LF 하나를, 아니면 LF 두 개를 separator로 추가한 뒤 region과 final LF를 붙인다. 생성 region 내부 line ending은 LF다.

record 성공 뒤 응답이 유실되어 재호출된 경우 desired bytes가 같으면 성공으로 끝난다. basis가 바뀌고 desired bytes도 다르면 자동 merge하지 않는다.

## 7. 오류·복구 계약

모든 CLI 결과는 단일 JSON object를 낸다. `PREPARED`, `APPLIED`, `APPLIED_ALREADY`는 exit 0의 성공 상태이고 아래 오류는 non-zero다. 사람 설명은 `message`, AI가 바로 할 수 있는 한 행동은 `nextAction`에 넣는다. stack trace는 기본 출력하지 않는다.

| code | 의미 | write | next action |
| --- | --- | --- | --- |
| `UNSUPPORTED_VERSION` | 알 수 없는 contract major | 없음 | 맞는 target 재빌드/재설치 |
| `ARTIFACT_INTEGRITY_FAILED` | generated target이 receipt와 다름 | 없음 | source에서 재빌드 |
| `PATH_OUTSIDE_ROOT` | input/output/renderer가 허용 root 밖 | 없음 | manifest 수정 |
| `PREPARE_FAILED` | packet을 만들 수 없음 | 없음 | 오류별 fallback 파일 열기; 실험에는 fallback run으로 기록 |
| `ANSWER_INVALID` | semantic answer schema 위반 | 없음 | 같은 exchange answer만 수정 |
| `INPUT_STALE` | 판단 basis가 바뀜 | 없음 | re-prepare하고 판단 재확인 |
| `OUTPUT_CONFLICT` | 다른 session이 output 변경 | 없음 | 현재 output 확인 후 re-prepare |
| `OUTPUT_BUSY` | 다른 record가 같은 output lock 보유 | 없음 | active record 종료 뒤 re-prepare; lock 자동 파기 금지 |
| `RENDER_FAILED` | renderer 비정상·invalid bytes | 없음 | renderer 진단, answer 임의 변환 금지 |
| `MANAGED_REGION_INVALID` | 기존 output의 소유 marker 손상 | 없음 | 사람이 보존 범위를 결정 |
| `APPLY_NOT_OBSERVED` | write 호출 뒤 hash 불일치 | 불명확 | 파일 확인, 성공 주장 금지 |

fallback 산문은 별도 human source가 아니다. control baseline과 같은 `verify-baseline.md`를 build가 target 내부 숨은 reference로 materialize한다. entry가 먼저 완전한 fallback 내용을 노출하지 않는다. 실험에서 fallback을 탄 run은 treatment 성공으로 세지 않고 별도 operational recovery cohort로 기록한다.

## 8. 저작·생성·사용·유지보수 종단 흐름

### 8.1 저작

저작은 질문지를 전부 채우는 의식이 아니라 사용자와 저작 AI가 작은 target을 함께 만들고 실제 사용 AI에게 건네는 흐름이다.

1. 사용자의 목적, 보존할 중요한 표현, 대표 실패 장면과 금지를 가능한 원문에 가깝게 domain-owned requirement source에 기록한다. 과거 구현의 기능 목록부터 옮기지 않는다.
2. D-11이 채택된 뒤에는 Framework 원문 §0을 먼저 읽고, §0.1의 진입표와 현재 결정의 불확실성·파급·되돌림 비용에 따라 필요한 원문 절을 스스로 선택한다. 한 task label에 고정하지 않고 기획·기술 선택·구현·검증·복구·독립 반증 module을 함께 열 수 있으며, 판단 중 경계를 건너면 추가 절을 연다. 선택은 navigation일 뿐 단계 상태를 저장하거나 질문 순서를 강제하지 않는다.
3. 해결하려는 비용을 이름 붙이고, 최소한 `prose-only`, `domain-specific observer/renderer`, `core generic mechanism`을 비교한다. 핵심 가설을 다르게 시험하는 독립 대안 하나도 둔다.
4. 각 사실과 행동마다 `AI meaning`, `domain observer`, `domain renderer`, `core generic`, `host` 중 canonical owner를 하나 지정한다. 같은 판정을 AI와 기계가 동시에 소유하지 않는다.
5. domain module과 target import graph를 쓰고 실제 consumer와 AI consumption path를 확인한다. 공통 규약의 내용과 어느 target이 소비하는지는 domain package만 결정한다.
6. machine use가 필요 없으면 prose-only target으로 끝낸다. 필요하면 observer가 읽는 선언 input, AI answer contract, renderer-owned output 영역과 실제로 검증할 실패 경계만 적는다.
7. target 하나를 작게 build해 unfamiliar fresh AI가 작은 entry에서 필요한 source만 찾아 실제 task를 수행하는지 관찰한다.
8. 결과가 산문보다 이기면 기계를 채택하고, 일부 비용만 줄이면 renderer-only 등으로 축소하며, 이기지 못하면 제거한다. 같은 실패를 규칙 추가로 두 번 이상 막으려 하면 새 규칙 전에 목적·전제·owner로 돌아간다.

저작 과정의 durable truth는 requirement/domain source, manifest와 evidence receipt다. 대화 chronology, router의 현재 단계, AI의 자기보고를 별도 workflow state로 저장하지 않는다. 장기 재개에 필요한 것은 현재 artifact에서 복원하고, 복원할 수 없는 정보가 실제로 관찰될 때만 D-04를 다시 연다.

### 8.2 생성

1. `validate`로 source graph와 경계를 검사한다.
2. `build`로 standalone target을 staging에 생성한다.
3. 동일 입력 double-build의 tree hash를 비교한다.
4. `check --source ... --target ...`으로 source-current와 artifact-intact를 각각 확인한다.
5. generated diff와 receipt를 사람이 검토한다.

### 8.3 사용

1. host가 작은 `SKILL.md`를 읽는다.
2. prose-only이면 해당 산문으로 바로 수행한다. machine-bearing target이면 prepare를 한 번 실행한다.
3. AI는 packet이 지시한 최소 자료만 더 읽고 host tool을 사용해 의미 판단을 한다.
4. AI는 answer skeleton을 채운다.
5. record가 input/output currentness를 재검사하고 제한된 output을 적용한다.
6. 실패 시 error의 한 next action만 수행한다. stale에서 예전 answer를 억지로 이식하지 않는다.

### 8.4 유지보수

1. generated target이 아니라 domain source 하나를 편집한다.
2. 먼저 §8.5의 exact-ID/path inspect로 owner, imports, generated artifact와 현재 검증 경계를 좁힌다. 한 target에서 manifest 직접 읽기가 더 싸면 query를 생략한다.
3. owning code에 D-14 comment가 있으면 한 문장의 이유·위험과 pointer가 가리키는 test/contract를 확인한다. comment에서 consumer나 exact 동작을 역산하지 않는다.
4. consumer graph는 target manifest imports가 소유한다. consumer 수가 작을 때는 canonical manifest diff를 직접 보여준다.
5. invariant를 바꾸면 code, targeted test/contract와 code-near comment를 함께 검토하고, generated 파일은 직접 고치지 않는다.
6. validate/build/double-build/currentness/targeted behavior test를 실행한다.
7. 영향받은 target만 재생성하고 모두 standalone install test를 한다.
8. consumer를 사람이 역산하지 못한 실제 장면이 생긴 뒤에만 inverse impact view를 제공한다.
9. remote installed target의 최신성은 별도 release/install 정책으로 다루며 receipt가 해결한다고 주장하지 않는다.

### 8.5 AI maintenance view

M1의 최소 query는 다음 한 형태다.

```text
node src/core/cli.mjs inspect --source <skill-package.json> --id <exact-stable-id> --json
node src/core/cli.mjs inspect --source <skill-package.json> --path <exact-relative-path> --json
```

v1은 fuzzy 자연어 검색을 하지 않는다. `id`는 manifest가 이미 소유한 package/module/target ID이고 `path`는 source root 안의 exact relative path다. 결과는 한 JSON object이며 최소한 다음을 가진다.

```json
{
  "schemaVersion": 1,
  "sourceGraphSha256": "...",
  "focus": {"kind": "module", "id": "purpose", "path": "modules/purpose.md"},
  "owner": {"kind": "domain-package", "path": "skill-package.json"},
  "imports": [],
  "consumers": ["natural-language-pilot-verify-next"],
  "artifacts": [{"targetId": "natural-language-pilot-verify-next", "path": "references/purpose.md"}],
  "mechanisms": {"observer": null, "renderer": null, "contract": null},
  "declaredInputs": [],
  "declaredOutput": null,
  "checks": [],
  "externalBoundaries": [],
  "gaps": [],
  "truncated": false
}
```

M1에서는 기존 manifest·receipt로 증명되는 필드만 채우고 나머지는 빈 배열 또는 명시적 `gap`이다. 빈 값을 추론으로 채우지 않는다. `sourceGraphSha256`는 canonical manifest bytes와 그 manifest가 참조한 current source hashes로 계산하며 generated view 자체는 hash 입력이 아니다. 결과는 저장된 index가 아니라 현재 계산값이다.

M5의 실제 유지보수에서 requirement/check/external-boundary 관계를 찾지 못한 장면이 생기면 D-12의 colocated stable edge gate를 연다. gate는 다음을 모두 만족해야 한다.

1. 실패한 실제 질의와 잘못 수정할 수 있었던 consumer가 기록된다.
2. 관계가 artifact에서 안전하게 계산되지 않는다.
3. 새 edge의 canonical owner와 갱신 주체가 하나다.
4. 그 edge를 소비하는 exact query와 stale/path validation이 함께 생긴다.
5. 같은 목적을 prose navigation이나 기존 import로 더 싸게 해결하지 못한다.

실험자가 편한 질문만 골라 schema 확장을 피하지 못하도록 M5 fresh maintenance protocol은 다음 일곱 질문을 모두 실행한다.

1. 이 사용자 요구 또는 제품 목적의 canonical 원문과 owner는 어디인가?
2. 그 요구를 맡는 공통 module 또는 target 전용 source는 무엇인가?
3. 이 module을 실제 import하는 consumer target은 무엇인가?
4. 각 consumer에 materialize된 artifact와 그 source/artifact receipt는 무엇인가?
5. 이 target의 observer, renderer, answer contract와 선언 input/output은 무엇인가?
6. 이 claim을 확인하는 check와 현재 evidence lane은 무엇인가?
7. 실제 effect 또는 외부 사실 중 source graph가 증명하지 못하는 경계와 owner는 무엇인가?

기존 manifest, source text와 receipt를 bounded read로 따라가 답할 수 있으면 새 edge를 만들지 않는다. 답할 수 없거나 전체 tree 수동 탐색이 필요하면 실패 질문, 읽은 bytes, 잘못 고를 수 있었던 owner/consumer를 receipt에 남기고 그 질문 하나에 필요한 최소 colocated edge만 설계한다.

consumer가 눈으로 역산 불가능해진 M6 시점에는 같은 graph의 역방향을 계산하는 `impact --changed <exact-relative-path> --json`을 도입할 수 있다. 출력은 affected target, 경로별 `via` module, regenerated artifact와 targeted check만 담고 `sourceGraphSha256`, `gap`, `truncated`를 유지한다. 이 view가 준비되기 전에는 Devflow 9-target 전체를 편입하지 않는다.

### 8.6 사람 전용 설명 projection

사람용 projection의 소비자는 전체 구조를 검토하는 사람이고 AI runtime이나 유지보수 query가 아니다. 둘 이상의 실제 target에서 사람이 “어느 target이 무엇을 맡고 어떤 공통 module을 쓰는가”를 반복해서 수동 복원한 장면이 있을 때만, current graph에서 기본 한 개의 overview를 on-demand 생성한다.

최초 형식은 그때 관찰된 질문을 가장 작게 답해야 하며, 제품 목적, 번호가 있는 target catalog, shared module과 consumer, 주요 input/output·artifact, 대표 author→build→use→maintain 흐름까지만 후보로 둔다. 관계가 prose보다 명확해지는 경우에만 단순 Mermaid를 쓴다. 문서 수와 장별 형식은 미리 고정하지 않는다.

출력 머리에는 다음을 표시한다.

- `generated/non-authoritative`; 변경은 source graph에서 해야 함
- 생성에 사용한 `sourceGraphSha256`, 실제 렌더 입력만의 `projectionInputSha256`와 generator version
- target/module/consumer/I-O 또는 projection에 포함된 목적 내용이 바뀌어 `projectionInputSha256`가 다르면 stale이라는 `docs check` warning
- broken local link/path 결과

기본은 commit하지 않는 on-demand output이다. GitHub에서 사람이 바로 읽어야 한다는 실제 소비가 확인된 뒤에만 `docs/generated/` 아래 commit을 허용하며, regeneration diff와 link check를 documentation lane에서 실행한다. projection에 쓰지 않은 source의 내부 정리·사소한 문구 변경은 `sourceGraphSha256` provenance가 달라도 stale gate가 아니다. stale 또는 링크 오류는 문서 갱신 신호이지 core build, 의미, fresh-AI 행동이나 effect의 증명이 아니다. root `package.json`의 `files`, generated target과 `SKILL.md` router는 이 문서를 포함하거나 참조하지 않는다.

### 8.7 프로젝트 maintainer의 진입·재개·인계

새 프로젝트의 maintainer 문서는 다음 owner만 유지한다.

| owner | 역할 | 기본 독자/읽는 때 |
| --- | --- | --- |
| `AGENTS.md` | 첫 진입 router, 변경 안전과 문서 owner 경계 | 모든 maintainer가 먼저 읽음 |
| `CLAUDE.md` | `AGENTS.md`를 가리키는 provider adapter | Claude 자동 진입; 규칙 복제 금지 |
| `docs/maintenance-status_ko.md` | 현재 milestone, 남은 unknown, exact next entry의 교체 가능한 snapshot | 새 세션·compaction 뒤 |
| `docs/skill-rails_ko.md` | stable product purpose와 채택된 architecture 경계 | 제품/architecture 변경 때 |
| `docs/implementation-verification_ko.md` | 현재 구현 범위, claim별 evidence와 unproven 경계 | 구현·검증·release 때 |
| `docs/authoring-lessons_ko.md` | 큰 실패의 원인과 다시 열 조건 | 반복 실패·고비용 결정 때만 |
| Universal Framework | 판단 깊이, 탐구·검증·늪 탈출 방식 | AGENTS가 task별 필요한 절로 routing |
| `docs/plan/*` | 동결 목적과 승인된 구현 출발 계획 | 경계 재검토·requirement trace 때 |

완료 chronology를 status나 architecture에 누적하지 않는다. `AGENTS.md`는 위 owner를 다시 요약하지 않고 작업 유형→owner path와 Framework heading만 연결한다. `CLAUDE.md`는 현재처럼 `AGENTS.md`를 읽으라는 얇은 pointer만 가진다. 사람용 generated overview는 이 표의 owner가 아니며 maintainer AI의 기본 읽기 경로에도 없다.

복원 경로는 `AGENTS → maintenance-status → 현재 task owner → exact source/inspect view → implementation evidence`다. 제품 경계가 바뀌는 작업만 stable product/architecture owner를 추가로 읽고, 불확실한 선택·반복 실패·release는 AGENTS가 해당 Framework 절로 보낸다. 장기 세션과 compaction 뒤에도 같은 disk route를 사용하며 과거 대화를 source로 삼지 않는다.

인계 성공은 새 AI가 “이해했다”고 말하는 것으로 판정하지 않는다. 낯선 변경 질문 하나를 주고 requirement 또는 목적의 owner, 실제 source, consumer target, generated artifact, 관련 check와 미확인 외부 경계를 current files/query에서 찾아야 한다. 잘못된 owner를 고르거나 human projection을 정본으로 쓰면 routing 실패이며 maintainer 문서나 query를 가장 작은 범위에서 고친다.

## 9. 첫 수직 흐름: natural-language pilot Verify

### 9.1 실험 질문

“같은 Verify 요청에서 partial prepare + semantic answer + deterministic record가 완전 산문보다 성공·안전을 낮추지 않으면서 읽기, 왕복, stale/format/누적 기록 오류의 총비용을 줄이는가?”

공유 정본의 대규모 경제성은 이 실험 질문에 포함하지 않는다.

### 9.2 고정 입력

구현자는 sibling Devflow를 직접 수정하지 않고 `fixtures/verify-v1`에 semantic-equivalent snapshot을 만든다.

- `pilot/brief.md`: bookmark CLI capability와 acceptance
- `pilot/plan.md`: stable `cardId: bookmark-storage`가 식별 가능한 고정 fixture 계약
- `pilot/progress.md`: 해당 card의 구현 완료 사실과 파일 참조
- `pilot/verification.md`: 사람이 쓴 prefix, 기존 다른 card 한 개의 managed record가 있는 경우와 파일이 없는 경우 두 fixture
- 사용자 prompt: 같은 card를 검증하고 결과를 기록하라
- host permission profile과 허용 tool 목록
- exact test command: target의 `domainConfig`가 구조화된 `verificationCommand`로 선언하며 core는 실행하지 않음
- `fixtures/verify-v1/project`의 최소 구현·test: 정상 fixture에서 위 command가 실제 exit 0을 내고 기대 test id를 출력하며, 실패 fixture는 고정된 non-zero와 evidence 부족을 만든다. control과 treatment는 같은 project bytes를 복사해 사용한다.

fixture adapter가 읽을 수 있는 것은 exact fixture contract뿐이다. arbitrary Devflow prose 지원이라고 이름 붙이지 않는다. fixture bytes가 다르면 의미를 추측하지 않고 unknown/stale로 분류한다.

### 9.3 control과 treatment

| lane | AI가 받는 것 | 사용 기계 |
| --- | --- | --- |
| control | pilot `verify/SKILL.md`와 `principles/SKILL.md`에서 만든 완전 산문 baseline, 같은 project와 prompt | 측정 harness만 사용, prepare/renderer 없음 |
| treatment | 작은 generated entry, prepare packet, packet이 지정한 동일 project file | prepare, answer schema, record, renderer |

fallback bytes는 control source와 같지만 treatment entry에서 선노출하지 않는다. fallback을 탄 run은 treatment 비교에서 분리한다.

### 9.4 예상 생성 파일

```text
dist/skills/natural-language-pilot-verify-next/
  SKILL.md
  references/purpose.md
  references/fallback.md
  scripts/run.mjs
  scripts/runtime/*.mjs
  scripts/domain/observer.mjs
  scripts/domain/renderer.mjs
  config/domain.json
  config/domain.schema.json
  contracts/semantic-answer.verify.schema.json
  .skill-rails-build.json
```

prepare run은 exchange 안에 `decision.json`, `exchange.json`, `packet.md`, `answer.json`을 만든다. record가 성공하면 **domain artifact로는** project의 `pilot/verification.md` 하나만 바뀐다. `.skill-rails-next/locks`는 transient coordination 경로이며 빈 부모 directory가 남을 수 있다.

### 9.5 필수 계약 테스트

1. 같은 source를 두 경로에 build해 tree hash가 같다.
2. generated target 하나를 손으로 바꾸면 artifact integrity가 실패한다.
3. dist target을 source repository 밖 temporary install root로 복사해도 prepare가 sibling skill 없이 동작한다.
4. 같은 project bytes의 `decision.json` semantic hash가 같다.
5. 자유 산문 형식이 fixture contract와 다르면 observer가 추측하지 않고 `unknown`을 낸다.
6. prepare 뒤 `plan.md`만 바꾸어도 record가 `INPUT_STALE`로 no-write한다.
7. prepare 뒤 `verification.md`를 다른 session이 바꾸면 `OUTPUT_CONFLICT`로 no-write한다.
8. 두 record를 barrier로 lock 획득 직전까지 동시에 보내면 한 record만 lock을 얻고 다른 하나는 `OUTPUT_BUSY`다. 성공 결과에는 다른 record의 silent loss가 없다.
9. 두 nonce exchange가 서로 answer/basis를 섞지 않는다.
10. 다른 project root로 exchange를 이식하면 fail-closed한다.
11. renderer가 기존 다른 card와 marker 밖 bytes를 보존한다.
12. absent/empty/non-LF-ending output의 bootstrap bytes가 계약과 같다.
13. malformed/duplicate marker와 duplicate card는 no-write한다.
14. 같은 answer를 record 재시도하면 `APPLIED_ALREADY`다.
15. answer가 output path나 unknown field를 넣으면 거부한다.
16. renderer failure와 non-UTF-8 stdout은 no-write한다.
17. write 뒤 reread hash가 다르면 `observed`를 주장하지 않는다.
18. fallback은 control과 같은 canonical source hash에서 생성되며 별도 human canon이 없다.

### 9.6 fresh-agent 행동 실험

최소 두 host adapter(Codex, Claude Code)를 지원하기 전에는 범용 채택을 주장하지 않는다. 각 lane과 대표 scene에 fresh context run을 사용하고 model/version/effort/permission/fixture commit을 기록한다.

대표 scene:

- 정상 Verify와 새 report 생성
- 기존 다른 card 보존과 같은 card update
- 명령 실패 또는 evidence 부족으로 `unproven`
- prepare 이후 input stale
- 두 terminal output conflict
- prepare 실패 후 fallback
- record 성공 응답 유실 후 retry

측정:

- acceptance 성공, 안전 위반, 잘못된 stage/owner 선택
- AI에게 실제 전달된 entry+packet+추가 file의 bytes와 추정 token
- tool 호출 수, 사용자 왕복 수, wall-clock과 machine runtime
- 잘못된 형식, stale write, 기존 기록 손실, recovery 분기
- fallback 사용률과 원인
- author source 수정부터 모든 영향 target 재설치까지 시간

### 9.7 채택·축소·기각 판정

판정은 성공·안전을 먼저 보는 lexicographic gate다.

1. treatment가 control보다 acceptance 성공률 또는 안전을 낮추면 기각한다.
2. silent loss, stale write, 권한 과장 중 하나라도 있으면 비용 이득과 무관하게 기각한다.
3. 위 두 조건을 통과한 뒤에만 총 context, tool/user 왕복, 복구, 유지보수 비용을 비교한다.
4. prepare가 named cost를 줄이고 총비용도 낮추면 prepare+renderer를 채택한다.
5. 형식·무손실 오류만 줄고 packet 비용이 더 크면 renderer/record만 채택하고 prepare를 제거한다.
6. 차이가 없거나 측정 불능이면 산문을 유지하고 더 큰 실제 67KB 장면에서만 한 번 재시험한다.
7. fallback run은 treatment 승리에 합산하지 않는다. 높은 fallback률은 prepare 부적합 증거다.

통계적 일반화를 주장할 sample이 없으면 각 run을 evidence receipt로 공개하고 `미검증`을 유지한다.

## 10. 단계별 구현 작업, 의존성과 완료 조건

다음 단계는 DAG 순서다. `M0 → M1 → M2 → M3 → M4`가 첫 pilot 경로이며, `M5` 이후는 앞 gate 결과에 따라 제거될 수 있다. M1 이후 source에는 D-14를 적용하되 comment 수를 완료 조건으로 세지 않는다. 각 단계 review는 새 public boundary·currentness/CAS/lock·authority/effect·비직관적 방어가 code만으로 드러나지 않을 때 한 문장의 why/risk와 가장 안정된 test/contract pointer가 있는지, 반대로 관계·exact 동작을 중복한 comment가 없는지만 확인한다. M1~M3은 각각 구축·실행·복구 비용을 같은 필드로 기록하지만 불완전한 기계를 산문과 성급히 최종 비교하지 않는다. 다만 acceptance/safety를 이미 위반했거나, 관찰된 비용의 하한이 산문 baseline 총비용을 넘고 뒤 단계가 그 비용을 제거할 수 없다는 **dominance**가 명백하면 다음 기계를 만들지 않고 중단한다. 그 밖의 경제성 판정은 M4가 소유한다.

### M0. 정본 보호, legacy capsule과 final-path 전환

**만들 것**

- **M0-A, read-only**: 기존 release/tag/설치 경로, 현재 tracked/untracked/ignored 파일과 mode/hash의 inventory, §4.1 분류표, exact 이동 목록과 rollback rehearsal 계획
- 동결 기획 requirement ID와 실험 protocol, control fixture hash
- exact Node/host/official installer availability와 final directory/alpha identity discovery receipt
- **M0-B, 승인 뒤 write**: 판단 정본의 durable Git checkpoint, verified `legacy/archive/v0.4.3` capsule, active legacy 제거와 §4 final root package skeleton의 coherent 전환
- root `package.json` identity/`private`/`files`/test path와 repository/installer discovery allowlist 검사

**아직 만들지 않을 것**: greenfield runtime, legacy importer, shared service, publish 설정, 전역 설치 교체, README의 사용자 변경 재작성.

M0-A는 추가 권한 없이 시작할 수 있다. M0-B는 이번 계획 작업에서 수행하지 않으며, commit과 exact 파일 이동·제거 각각에 대한 사용자 승인을 받은 뒤에만 수행한다. 전환 직전 archive/replace 경로에 새 사용자 변경이 있으면 `USER_CHANGE_CONFLICT`로 중단한다.

**완료 조건**

- §4.1의 모든 tracked path가 분류되고 판단 정본은 Git checkpoint로 복구 가능하다.
- capsule을 새 temporary root에 복원한 byte/mode/hash가 inventory와 같고, active tree에는 실행 가능한 legacy `SKILL.md`, test, script, package가 남지 않는다.
- final root package가 legacy code를 import하지 않고 npm dry-run payload, active test selection, repository skill discovery에 legacy가 0건이다.
- 기존 전역 `skill-rails`는 그대로이며 isolated home의 alpha install/discovery와 이름·경로가 충돌하지 않는다. directory/identity 제약의 실제 결과와 adapter 경로가 receipt에 남는다.
- control fixture hash, prompt, permission, 측정 필드가 고정된다.

### M1. source graph와 standalone deterministic build

**의존**: M0.

**만들 것**

- source/target/receipt schema와 validator
- path/collision/cycle/LF canonicalization
- first target에 필요한 whole-module materialization, target-local common runtime, generated marker
- 기존 manifest field에서 계산하는 exact-ID/path `inspect`와 `sourceGraphSha256`; 신규 requirement/check semantic edge 없음
- `authoring/skill-rails` source에서 generated·tracked `skills/skill-rails`을 만드는 currentness/diff 계약
- double-build, currentness, external install-root tests

**아직 만들지 않을 것**: semantic slicing, inverse impact report, 사람용 graph 문서, requirement/check edge schema, prepare/record, Framework materialization, authoring AI interview.

**완료 조건**

- §5 build contract와 §9.5의 double-build, integrity, standalone install, fallback-source 검사가 통과한다.
- target directory를 단독 복사한 뒤 sibling 접근 없이 entry와 integrity check가 동작한다.
- `inspect`가 선언하지 않은 의미 관계를 추측하지 않고 package/target/module/mechanism/artifact 관계만 bounded JSON으로 반환한다.

### M2. Verify prepare와 최소 AI interface

**의존**: M1.

**만들 것**

- `PreparedWorkV1`, exchange, observer interface
- Verify fixture-only observer와 eight-block packet
- unknown/fallback 분리 및 경로 기록

**아직 만들지 않을 것**: 일반 Markdown 의미 parser, command executor, durable state, renderer.

**완료 조건**

- §6.1~6.2와 §9.5의 decision determinism, unknown, nonce 격리, project 이식 거부가 통과한다.
- fresh agent가 entry에서 prepare를 먼저 실행하고 fallback을 미리 읽지 않는다.

### M3. semantic answer, renderer, safe record

**의존**: M2.

**만들 것**

- Verify answer validator
- core-owned renderer spawn, managed-region renderer
- full input/output basis CAS, staged apply, reread observation, idempotent retry

**아직 만들지 않을 것**: auto merge, multiple output transaction, remote/message/command effect adapter, sandbox 보장.

**완료 조건**

- §6.3~6.4, §7과 §9.5의 stale, output lock, 보존, bootstrap, retry, schema, renderer, effect 검사가 통과한다.
- fault injection에서도 marker 밖 bytes와 기존 card가 손실되지 않는다.
- M1~M3의 구현량, generated/runtime bytes, 실행 시간, 오류·복구 비용이 M4와 같은 receipt field로 기록된다. 이 시점에는 경제적 승리를 주장하지 않는다.

### M4. control 대 treatment pilot

**의존**: M3.

**만들 것**

- reproducible evaluation harness와 per-run receipt
- 정상·unknown·stale·collision·retry fresh-agent runs
- 결과별 `채택/renderer-only/산문/미결정` 판정

**아직 만들지 않을 것**: 9-target generator, Devflow production integration.

**완료 조건**

- §9.6의 측정이 누락 없이 있고 §9.7 gate가 기계 확대 여부를 실제로 바꾼다.
- Verify 승리의 비승계 범위가 결과에 표시된다.

### M5. 저작·유지보수 경험과 pilot 종단 흐름 확장

**의존**: M1의 source/build 경계가 채택되고 M4가 prepare·renderer·산문 중 무엇을 유지할지 판정함. runtime 기계가 모두 기각되어도 prose-only standalone build가 가치 있으면 M5는 진행할 수 있다.

**순서**

1. `authoring-package.json`이 Framework whole original을 import해 generated `skills/skill-rails` 안에 materialize하도록 한다. 의미를 갖지 않는 heading index만 원문에서 생성한다. 두 supported host의 bounded read를 먼저 실측하고, 불가능하거나 아래 부분 lane이 반복 whole-load할 때만 D-11의 H2/H3 verbatim projection gate를 연다.
2. Framework의 효과와 읽기 범위를 다음 세 lane으로 비교한다. 세 lane 모두 저작 스킬의 operational contract, raw user task, fixture, 성공 조건과 M4에서 채택된 runtime 경계는 동일하고 Framework 노출만 다르다.
   - **L0 최소 지침/기준안**: 저작 스킬의 필수 operational contract와 raw task만 제공하며 Framework는 읽지 않는다.
   - **L1 부분 self-routing**: 원문 §0의 공통 기반과 §0.1 진입표를 먼저 읽고 AI가 필요한 원문 section을 스스로 선택한다. harness가 정답 section을 미리 골라 주지 않는다. 추가 section 또는 whole original을 열 수 있지만 그 이유와 bytes를 비용으로 기록한다.
   - **L2 전체 원문**: 작업 전에 Framework whole original을 읽는다.
3. 대표 task는 `(a)` 불확실한 기술 선택을 포함한 새 Product target 저작, `(b)` owner와 계약이 이미 있는 target의 bounded local 수정, `(c)` 같은 잘못된 층의 수리가 반복되는 실패 복구 세 가지다. 각 `lane × task × Codex/Claude host`를 격리된 fixture와 fresh context에서 최소 한 번 실행한다. model/version/effort/permission, raw prompt와 성공 기준을 고정하고 lane 순서·이전 산출물·대화가 다음 run에 유출되지 않게 한다. 결정을 바꾸는 차이 또는 혼합 결과가 나온 cell만 두 번째 fresh seed로 재현하며 작은 표본을 통계적 일반화로 부르지 않는다.
4. 각 run은 acceptance와 안전 위반, critical omission, 목적·범위·owner를 다시 맞춘 횟수, 근거 없는 규칙·검사·예외, 재작업, fixed/conditional read bytes, tool 호출, 사용자 왕복, wall-clock과 machine runtime을 기록한다. routing 오류와 fallback, heading index/projection의 build·currentness·유지 비용도 total cost에 포함한다. 저작 결과로 생성된 target은 별도 unfamiliar using AI가 실행하고 그 acceptance·누락·추가 read·복구도 같은 receipt에 연결한다.
5. 판정은 품질·안전 우선의 lexicographic gate다. L1은 L2가 성공한 task에서 실패·안전 저하·critical omission이 없고 L2보다 total cost가 낮으며, L0와 비교해 실제 누락·재작업을 하나 이상 제거할 때만 기본으로 채택한다. L1이 L0와 동등하면 default partial 안내와 불필요한 index/projection을 제거하되 whole original materialization과 명시적 high-risk 참조는 남긴다. L2만 신뢰 가능하면 실제로 우월했던 고위험·복구 범위에서 whole read를 사용한다. task별 결과가 갈리면 관찰된 가장 작은 `L0/L1/L2` 경계만 두고 새 taxonomy manifest를 만들지 않는다. Framework 통합 자체를 축소·제거해야 한다는 결과는 자동 적용하지 않고 evidence와 영향을 사용자 결정으로 올린다.
6. 선택된 가장 단순한 lane으로 fresh author AI가 기존 Verify package에 Product라는 두 번째 실제 target을 추가한다. 사용자 목적·실패 장면에서 시작해 prose-only/observer/renderer/core 후보와 독립 대안을 비교하고 generated diff를 사람이 검토한다. `record-only` 후보를 채택하려면 prepare 없이 AI가 읽을 현재 input/output과 answer scratch를 어떻게 만들고, record가 어느 시점의 full basis를 어떤 exchange 계약으로 고정·재검사하는지 먼저 작은 실행 흐름으로 닫아야 한다. 이 흐름이 prepare를 이름만 바꿔 재현하거나 산문보다 비싸면 `record-only`를 사용하지 않는다.
7. 같은 fresh maintainer가 §8.5의 source graph로 owner/source/consumer/artifact/mechanism을 찾고 D-14의 comment pointer가 고위험 invariant와 targeted evidence를 찾는 비용을 줄이는지 확인한다. requirement/check/external-boundary 관계를 못 찾은 실제 실패가 있을 때만 D-12의 colocated edge gate를 열고, 없으면 schema를 늘리지 않는다. comment가 관계를 중복하거나 실제 안전·복구를 개선하지 않으면 축소한다.
8. Product는 새 brief를 renderer-owned artifact로 생성해 upstream 구조화의 비용을 측정한다. M4에서 runtime prepare가 기각되었다면 Product도 먼저 prose-only 또는 renderer-only 기준안을 사용한다.
9. Resume는 brief/plan/progress/verification artifact-derived 상태와 unknown 경계를, Direct와 Work는 다음 card 선택·진행 기록·stale replacement 반례를 시험한다. 남은 pilot target은 각자 별도 gate 뒤에 추가한다.
10. 둘 이상의 target에서도 사람이 구조를 반복 역산한 증거가 있을 때만 §8.6 사람용 on-demand projection을 만든다. target 수만으로 자동 생성하지 않는다.

각 target은 별도 adoption gate를 통과한다. 한 stage의 승리를 다른 stage에 복사하지 않는다. prose가 더 싸면 그 stage는 prose-only로 남는다.

Product라는 두 번째 실제 target이 생긴 이 시점에 처음으로 shared-source differential currentness를 검사한다. Product가 import하지 않는 Verify-only module을 바꾸면 Product는 current를 유지하고 Verify만 stale이어야 하며, 공통 purpose module을 바꾸면 실제 consumers 모두 stale이어야 한다. 이 검사를 위해 dummy target을 만들지 않는다.

**완료 조건**: 세 Framework lane의 조건·receipt·판정이 위 계약대로 재현되고, 같은 작은 capability가 저작→build→독립 install→Product→Direct→Work→Verify→Resume→maintain 전체를 지나며 각 artifact owner가 하나뿐이다. fresh author/maintainer가 읽은 Framework 절·bytes, source query와 추가 수동 읽기, 잘못 고른 owner와 복구를 기록한다. 부분 routing, heading index/projection, code-near comment, semantic edge 또는 사람 projection 중 실제 오류·재작업·읽기·왕복 총비용을 줄이지 못한 것은 허용된 경계에서 제거·보류하고, 사용자 소유 경계를 바꾸는 결론은 별도로 회부한다.

### M6. 실제 Devflow 복잡성 pressure test

**의존**: M5.

먼저 67KB 공통 규약과 148KB cold entry를 실제 bytes로 재현하는 한 capability를 선택한다. synthetic padding으로 대체하지 않는다.

1. whole-module imports로 한 target을 materialize해 context와 rebuild 비용 측정
2. 가장 다른 두 target을 추가해 공통/전용 경계 압력 시험
3. 가장 다른 target을 더해 consumer를 눈으로 추적하기 어려운 실제 장면을 만들고, 그때만 inverse `impact` view를 도입한다. `via` module, affected target/artifact/check와 gap을 current graph에서 계산하며 9-target 전체 편입 전에 동작해야 한다.
4. 9 target 전체를 한꺼번에 생성하기 전에 shared change cohort 비용 gate 실행
5. gate 통과 시에만 나머지 target을 순차 편입

9개 target의 동일 generated bytes는 허용되지만 human source와 consumer graph는 domain package 하나에만 있다. runtime에 `../principles` 같은 형제 경로가 남으면 실패다.

**채택 조건**

- 독립 install과 최소 read가 동시에 유지된다.
- 공통 변경의 source 편집은 한 곳이며 build가 stale consumers를 모두 검출한다.
- 전체 rebuild/redeploy 비용을 포함해 수동 복제·context·복구 총비용이 산문보다 낮다.

### M7. 비-Devflow skill 일반화

**의존**: M6에서 core가 Devflow 용어를 갖지 않음이 확인됨.

전혀 다른 도메인의 한 스킬로 source graph, observer, renderer, error vocabulary만 재사용한다. core 수정 없이 domain package만 추가할 수 있어야 한다. core에 `card`, `stage`, `brief`, `verification` 의미가 필요하면 경계 실패로 보고 추출하거나 일반화 주장을 기각한다.

### M8. 채택, 이름 승계와 legacy 정리

**의존**: M7, fresh audit, 사용자 승인.

- M0의 v0.4.3 Git tag/release, capsule과 exact inventory hash가 여전히 복원 가능한지 확인한다.
- alpha는 publish하지 않거나 비-`latest` dist-tag와 별도 이름을 사용한다.
- acceptance 뒤 사용자와 한 번의 cutover 결정으로 npm/skill identity `skill-rails`, `latest`, public README와 release workflow를 승계한다. source/package directory는 M0부터 최종 위치였으므로 다시 이동하지 않는다.
- 기존 전역 설치 교체와 publish는 각각 별도 승인 항목이다. alpha 검증 home을 production home으로 재사용하지 않는다.
- `legacy/archive`는 runtime fallback이 아니며 cutover 때 자동 삭제하지 않는다. archive retention 종료와 물리 삭제가 필요하면 복원 이력·Git 접근성을 제시하고 별도 사용자 승인을 받는다.

## 11. 버전·호환·release 정책

- product SemVer와 각 JSON `schemaVersion`을 분리한다.
- alpha에서 contract 변경은 fixture와 receipt를 함께 갱신하고 unknown version은 거부한다.
- generated target은 build 당시 compatible runtime을 내장하므로 host-global core update에 의해 동작이 바뀌지 않는다.
- alpha의 root npm identity는 `@nanomia/skill-rails-next`, skill identity는 `skill-rails-next`이고 production identity와 분리한다. repository source/package 경로는 identity 승계 때 이동하지 않는다.
- 동일 package id의 install을 같은 agent home에서 덮어쓰지 않는다. 평가에는 isolated home, exact local path 또는 commit/tree hash를 기록한다.
- prerelease publish가 필요해지면 non-latest dist-tag를 명시하고 실제 registry 동작을 dry-run/격리 registry로 확인한다.
- `latest` 전환, 기존 전역 `skill-rails` 교체, `private` 해제와 publish는 각각 비가역 사용자 승인 항목이다. legacy archive 삭제는 release cutover와 묶지 않고 별도 retention 결정으로 남긴다.
- compatibility matrix는 구현된 host adapter×contract version만 적는다. “platform-independent core”와 “모든 platform에서 검증됨”을 혼동하지 않는다.

## 12. 검증 증거의 층위

각 claim은 다음 중 하나의 receipt에 연결한다.

| 층위 | 질문 | 필요한 증거 |
| --- | --- | --- |
| 의미 정합 | frozen 목적과 domain 규칙을 보존했는가 | requirement trace review, 독립 반증 |
| 전달 | 필요한 entry/module/contract가 target에 있는가 | build receipt, standalone tree inspection |
| 행동 | fresh AI가 실제로 prepare/read/respond/record를 따르는가 | fresh-agent transcript와 artifact diff |
| effect | 실제 파일/host 결과가 원하는 상태인가 | reread digest 또는 host attestation |

구조 test만으로 fresh behavior를 증명하거나, AI transcript만으로 host effect를 증명하지 않는다. 각 phase report는 `proven`, `failed`, `unproven`, `out-of-scope`를 명시한다.

## 13. 요구 추적

### 13.1 동결된 최초 기획

| frozen concept 요구 | 이 계획의 결정/계약 | 구현 단계 | 검증 |
| --- | --- | --- | --- |
| §1 제품/target 이중 흐름과 독립 사용 | §2.1, §8 | M1, M5 | standalone install, 종단 흐름 |
| §3 고정 목적과 잠정 수단 구분 | §0, §3 결정 기록 | 전 단계 | gate가 기계 제거를 실제 허용 |
| §4 부분 컴파일 | D-02, §6 | M2~M4 | decision determinism, baseline 비교 |
| §5 자연어/기계 소유 | D-01, §2.2 | M2~M3 | unknown 반례, schema/observer tests |
| §1.4 두 개의 완결된 사용 흐름 | §8.1~8.4 | M1~M5 | 새 target source부터 build·use·maintain까지 fresh run |
| §7 사용 반복과 최소 interface | §6.2, §8.3 | M2~M4 | entry routing, bytes/roundtrip |
| §8 상태 최소화·재개·동시성 | D-04, §6.4 | M3~M5 | full basis stale, two exchange conflict |
| §9 deterministic renderer와 부분 수정 | D-05, §6.4 | M3 | byte repeat, managed-region preservation |
| §10 오류·복구·비용 | §7, §9.6~9.7 | M2~M4 | fault scenes와 total-cost gate |
| §11 host authority | D-06 | M3~M4 | reread digest, claim lint |
| §6 세 종류의 재사용 함수 | D-01, D-05, D-09 | M2~M5 | observer/renderer protocol, 판단 모듈 비채택 gate |
| §12 테스트와 검증 | §9, §12 | M1~M7 | 의미·전달·행동·effect receipt |
| §12.5 테스트 입장과 퇴출 | §9.7, §10 phase gate | 전 단계 | 결과가 다음 기계의 구현·제거를 실제 변경 |
| §13 stage별 기계화 차이 | §10 M5의 stage별 독립 gate | M5 | stage별 prose/prepare/renderer 채택·축소·기각 |
| §17 greenfield와 discovery 격리 | D-07, D-10, §4 | M0, M8 | capsule restore, legacy import/name/latest collision check |
| §18 산문 기준안 비교 | §9 | M4 | control/treatment/fallback 분리 |
| 추가 요구: 공유 정본 하나, 9 target 독립 | D-03, §5, M6 | M1, M5~M6 | source edit 1회, stale consumers, no sibling path |

### 13.2 이번 보강 요구

| 사용자 요구 | 이 계획의 owner | 구현 단계 | 검증 또는 gate |
| --- | --- | --- | --- |
| legacy archive와 final-path greenfield | D-10, §4.1~4.2 | M0 | inventory 전수 분류, temporary restore, payload/test/discovery/import 0건 |
| tracked/untracked 사용자 변경 보존 | §4.1~4.2 | M0 | base/working overlay, `USER_CHANGE_CONFLICT`, 승인 전 no-write |
| 기존 전역 설치와 alpha 공존·이름 승계 | §2.1, §4, §11 | M0, M8 | isolated home official installer receipt, 별도 cutover 승인 |
| 프로젝트 개발 AI의 Framework 사용 | D-11, §8.7 | M0 문서 전환 이후 계속 | AGENTS가 원문 §0.1로 보내고 AI가 필요한 owner 절을 선택하는 낯선 변경 복원 시험 |
| 배포된 저작 스킬 AI의 Framework 사용 | D-11, §8.1 | M5 | Framework 0/부분 self-routing/전체 3-lane의 품질·누락·재작업·총비용 비교 |
| 저작·생성·사용·유지보수의 실용적 종단 흐름 | §8, M5 | M1~M5 | fresh author와 unfamiliar using AI, owner/consumer/effect receipts |
| AI용 skill/suite maintenance view | D-12, §8.5 | M1, M5~M6 | exact 일곱 질문, bounded inspect, 필요 시 impact/colocated edge gate |
| 전역 code 이해와 국소 가독성 분리 | D-12, D-14, §8.4 | M1~M5 | graph로 관계 탐색, why/risk+test/contract pointer로 고위험 invariant 복원; 중복·drift·왕복 관찰 |
| generated 주석의 단일 생성 owner | D-03, D-14, §5 | M1 이후 | generated/do-not-edit+logical source+receipt pointer만 canonical build에서 생성, 수동 편집과 중복 provenance 0건 |
| 사람 전용 설명 projection | D-13, §8.6 | 관찰 뒤, M5 이후 | 반복 탐색 비용이 있을 때만 on-demand 생성; stale/link documentation check |
| maintainer 진입·재개·인계 정본 | §8.7 | M0 이후 owner 문서 갱신 | AGENTS→status→owner→source/evidence의 unfamiliar-case 복원 |
| M1~M3에서 이미 열등하면 중단 | §10 도입부 | M1~M3 | safety/acceptance 또는 제거 불가능한 cost dominance일 때만 조기 중단 |
| Devflow 9-target 전에 영향 탐색 | D-12, M6 | M6, 전체 편입 전 | 실제 수동 역산 실패 뒤 inverse impact가 affected consumer를 누락 없이 반환 |

## 14. 독립 Fable high 반증과 수렴 기록

중요 결정은 Orca Run/Task/Dispatch를 사용해 Claude의 실제 식별자 `claude-fable-5`, effort `high`로 실행한 독립 검증자에게 반증시켰다. 최초 계획의 fresh audit와 closure 뒤, 이번 보강에서는 사용자의 지시에 따라 context 사용량이 낮고 앞선 근거를 이해한 같은 Fable session을 새 Task/Dispatch로 재사용해 이견을 수렴했다. 최종 문서는 다시 fresh-context Fable high가 동결 기획과 상세 계획만 읽어 감사한다. 검증자는 공동 작성자가 아니라 대안·실패 반례·숨은 비용을 찾는 역할만 맡았다.

### 14.1 공유 정본/architecture 반증

검증자가 제기한 가장 강한 반례:

1. 독립 배포 여부와 얼마만큼 projection할지를 한 후보 축으로 섞으면 결론이 과장된다.
2. 69% universal/31% entangled 증거는 clause/section slicing을 지지하지 않는다.
3. build receipt는 설치물이 원격 최신인지 증명하지 않는다.
4. 공통 runtime 내장은 core bugfix마다 N target rebuild/redeploy 비용을 만든다.
5. 5.3KB pilot 공통 산문은 67KB context 경제성을 검증하기에 너무 작다.

수렴:

- 배포 축은 standalone build-time materialization으로 고정했다.
- projection 축은 whole module로 최소화하고 의미 slicing은 보류했다.
- receipt claim을 provenance/source-current/artifact-intact로 제한했다.
- first probe와 9-target cohort gate를 분리했다.
- pilot 승리가 shared-context 경제성으로 승계되지 않는다고 명시했다.

기각 대안이 더 나은 조건과 재검토 신호는 D-03에 남겼다.

### 14.2 첫 수직 흐름/상태/renderer 반증

검증자가 찾은 핵심 반례:

1. Verify report 전체 재생성은 CAS가 성공해도 이전 card 기록을 조용히 지운다.
2. output CAS만 보면 prepare 후 교체된 plan에 낡은 판정을 기록할 수 있다.
3. random exchange locator와 “동일 packet bytes” 주장은 모순되고 동시 run을 섞을 수 있다.
4. answer scratch 수명과 record retry 의미가 없으면 AI 노동 유실과 즉흥 복구가 생긴다.
5. AI가 renderer stdout을 중계하면 신뢰/byte 결정성이 끊긴다.
6. output path를 AI나 renderer가 정하면 경로 주입이 가능하다.
7. treatment entry에 완전 fallback 산문을 노출하면 control과의 비교가 오염되고 두 human canon이 된다.
8. prerelease가 npm `latest` 또는 설치된 동명 `skill-rails`를 포획할 수 있다.

수렴:

- renderer-owned region의 기존 record 보존자를 renderer로 지정했다.
- 모든 input과 output의 raw-byte basis를 record에서 다시 확인한다.
- deterministic claim을 semantic decision으로 좁히고 run exchange를 nonce 격리한다.
- core가 renderer를 직접 spawn하고 manifest의 static output만 적용한다.
- fallback을 같은 source의 generated copy로 만들고 run lane을 분리한다.
- alpha 이름/local path/non-latest와 cutover 승인 gate를 고정했다.
- durable semantic state는 넣지 않되, 실제 artifact로 복구 불가능한 coordination 사례가 나타나면 좁은 state만 재검토한다.

검증자의 최초 “use-time prepare를 보류하라”는 의견은 frozen concept §4/§7/§18과 다시 대조했다. 검증자는 use-time prepare가 없으면 핵심 비교 자체가 불가능하다는 기획자 근거에 합의했다. 단, 이 합의는 probe 하나에 한정되고 cohort runtime 채택은 별도 gate다.

### 14.3 fresh-context 최종 감사와 closure

fresh 감사가 처음 찾은 blocking은 두 가지였다. atomic rename만으로는 두 record가 같은 basis를 통과한 뒤 서로의 card를 덮어쓸 수 있었고, exact verification command를 둘 closed schema 필드가 없었다. 또한 판단 기준, observer/renderer protocol, decision hash 범위, answer skeleton, managed-region bootstrap, shared-source 검사의 실제 consumer 시점 등 11개 비차단 빈칸을 찾았다.

수정 뒤 재감사는 기존 13건이 모두 봉합되었음을 확인하고 lock crash/hang 진단, lock key, domain config schema, `ObservedFactsV1`, 낡은 milestone 참조 등 8개 작은 빈칸을 추가로 제기했다. 이를 다시 수정한 closure 감사의 최종 판정은 다음과 같다.

- 이전 blocking과 non-blocking은 모두 닫혔다.
- 새 blocking, silent loss, 제품 경계 모순은 발견되지 않았다.
- 남은 것은 §15에 공개된 실험 미검증과 M0에서 실측하도록 명시한 Node major/exchange 기본 위치이며, 숨은 구현 결정이 아니다.
- Fable high의 판정은 `IMPLEMENTATION-READY`: 구현자는 이 문서만으로 M0~M4를 새 경계 결정 없이 착수할 수 있다.

### 14.4 이번 보강의 전환·저작·index 반증과 이견 수렴

같은 Fable high 검증자는 먼저 다음 반례를 제기했다.

1. capsule은 Git tag와 두 번째 진실이 될 수 있고 tar 안 코드는 후행 반증에서 검색하기 어렵다.
2. 아직 untracked인 동결 기획·Framework·상세 계획을 보호하지 않고 파일 전환을 시작하면 어느 backup에도 없는 판단 정본을 잃을 수 있다.
3. 배포 저작 스킬에 Framework를 넣는 F1/F2보다 아예 넣지 않는 F0가 관찰 없는 선결정을 줄인다.
4. requirement/check/external-boundary edge를 M1 schema에 미리 넣으면 수동 index가 재탄생한다.
5. 둘째 target이라는 시점만으로 inverse impact와 사람 문서를 만들면 실제 소비 없는 기계가 된다.
6. 별도 M1~M3 경제 gate는 불완전한 기계를 성급히 기각할 수 있다.
7. final-path 안의 root package identity/`files`/test/discovery allowlist와 generated `skills/skill-rails`의 commit 여부가 비어 있었다.

기획자는 다음 강한 근거를 다시 전달했다. 사용자는 Framework를 프로젝트 maintainer뿐 아니라 배포된 Skill Rails로 target을 저작·유지하는 AI도 사용하라고 명시했고, maintenance view가 최종적으로 확인해야 할 관계 연쇄도 명시했다. 반면 이 요구는 모든 기능을 M1에 넣거나 별도 index를 만들라는 뜻이 아니다.

수렴 결과는 다음과 같다.

- capsule은 offline 물리 backup과 discovery-safety만 담당하고, history·published identity·후행 코드 대조는 Git tag가 담당한다. 전환 전 판단 정본의 durable checkpoint와 사용자 승인 gate를 M0에 추가했다.
- F0는 runtime probe인 M0~M4에만 적용한다. M5 authoring flow에서는 F1 whole-module 원문 materialization을 사용하고, host bounded-read 사전 관찰과 fresh author의 실제 읽기 행동을 분리해 측정한다. 둘 중 하나에서 whole-file 병목이 나오면 F2 verbatim section projection을 다시 연다.
- M1은 기존 구조 선언에서 계산 가능한 relation만 보여주고 신규 semantic edge는 0개다. M5 protocol은 사용자가 요구한 일곱 관계 질문을 모두 실행하며, 실패한 질문에 필요한 colocated edge만 추가한다. inverse impact는 수동 consumer 역산 실패 뒤이되 9-target 전체 편입 전까지 구현한다.
- 사람용 설명은 target 수가 아니라 실제 사람의 반복 탐색 비용을 입장 조건으로 삼고 기본은 non-committed on-demand output이다.
- M1~M3은 비용만 기록한다. safety/acceptance 위반 또는 후속 단계가 없앨 수 없는 명백한 cost dominance일 때만 조기 중단하고, 나머지 판정은 M4가 맡는다.
- root package의 exact alpha identity와 allowlist, active test/discovery/no-import 경계, generated authoring package의 tracked 배포 지위를 §4에 고정했다.

검증자는 이 재전달 뒤 위 수렴안 네 묶음에 모두 합의했다. 기각한 F0 영구 유지, 선행 semantic graph, 자동 사람 문서가 더 나아지는 조건과 재개방 신호는 D-11~D-13에 남겼다.

### 14.5 이번 보강 뒤 fresh-context 최종 반증과 폐쇄 재감사

이전 논의가 없는 별도 `claude-fable-5`, effort `high` 검증자에게 동결 기획과 수정된 상세 계획만 제공했다. 최초 감사의 blocking은 0건이었고, 다음 여섯 비차단 빈칸을 찾았다.

1. Framework 원문이 저작 source root 밖에 놓이는 것처럼 읽혀 path containment와 충돌할 수 있었다.
2. `prose`와 renderer-only target의 허용 필드가 closed shape로 완전히 닫히지 않았다.
3. `answerContract`의 해석 root와 domain 소유가 모호했다.
4. `ObservedFactsV1`의 단일 schema owner가 명시되지 않았다.
5. pilot fixture의 verification command가 실제로 실행되고 기대 exit/output을 내는 조건이 부족했다.
6. locator success label, sibling repository path, 새 요구 trace와 사람 projection stale 입력에 작은 정합성 빈칸이 있었다.

계획은 각각 root `authoring-package.json`과 repository-root containment, 세 target mode의 closed shape, target-relative domain contract, core-owned observed-facts schema, 실행 가능한 fixture 계약, 관련 표기·trace·`projectionInputSha256` 규칙으로 보강했다. 같은 fresh 검증자가 수정본 전문을 다시 읽은 closure 재감사에서는 여섯 항목이 모두 닫혔고 새 boundary·두 정본·path escape·M0~M4의 숨은 결정이 없다고 판정했다.

재감사가 남긴 두 경미한 명확화도 소유 절에 반영했다. M0 legacy 0건 검사에는 root `authoring-package.json`의 source 목록을 포함했고, `record-only`가 full basis를 수집·고정하는 실제 절차는 M5 채택 전에 실행 흐름으로 닫도록 했다. 후자는 M0~M4 계약을 막지 않는 의도적 M5 gate다. 최종 Fable high 판정은 **`IMPLEMENTATION-READY`**이며, 동결 기획 SHA-256도 감사와 폐쇄 재감사에서 모두 변하지 않았다.

### 14.6 Framework 조합 읽기와 code-near comment 반증·수렴

같은 retained Fable high 검증자에게 D-11의 다섯 route, 공통 기반+module 조합, M5 비교와 graph/comment 경계를 다시 반증하게 했다. 가장 강한 반례는 현재 다섯 유형이 Framework §0.1의 여섯 예시와 다른 두 번째 routing 정본이고, 특히 `자연어·행동 계약 저작 → §8.1~8.3` 경로를 잃어 해석 시험을 건너뛸 수 있다는 것이었다. 절 사이 dependency를 사람이 별도 manifest에 적는 후보도 원문 의미를 다시 해석한 숨은 정본이 되므로 기각했다.

수렴 결과는 원문 §0.1을 routing 의미의 유일한 owner로 두고, 기계는 heading 계층·byte range·hash만 파생하는 D-11이다. 부분 읽기는 AI가 원문을 보고 스스로 선택하며 필요한 module과 전체 원문으로 확장할 수 있다. bounded read가 실제로 실패할 때만 H2/H3 verbatim projection을 만들고 whole original은 계속 남긴다. 검증자는 이 구조가 별도 의미 graph 없이 연결된 module을 열 수 있고 heading 변경은 재생성/currentness로 드러난다는 데 합의했다.

첫 반증자는 M5 기준안을 공통 핵심만 읽는 것으로 잘못 제안했으나, Framework §12.1 원문을 다시 대조한 뒤 `Framework 입력 0 / 공통 기반+부분 self-routing / 전체 원문`의 세 lane이 맞다고 정정했다. 운영 계약 상수화, lane별 fresh context, 실제 AI self-routing, 두 host와 세 대표 task, 품질·안전 우선 판정을 함께 닫았다. Framework 통합 자체의 제거는 실험이 조용히 결정하지 않고 사용자에게 회부한다.

comment에는 drift 반례가 있었다. lock 동작을 다시 서술한 comment가 code와 갈리면 직전 CAS 방어를 되돌릴 수 있다. 따라서 전역 관계·exact 동작은 graph/code/schema/test에 남기고, comment는 한 문장의 why/risk와 `targeted test > contract/schema ID > 계획 절` 순서의 pointer만 소유하기로 합의했다. generated 파일은 canonical generator가 marker·logical source·receipt pointer만 만들며 사람이 관리하는 comment 사본은 없다.

## 15. 아직 증명되지 않은 전제와 재검토 조건

| 미검증 | 지금의 처리 | 다시 여는 조건 |
| --- | --- | --- |
| packet이 실제 AI context를 줄임 | claim하지 않고 M4 실측 | packet+추가 읽기가 control에 근접/초과 |
| fixture observer가 actual Devflow에도 유효 | fixture-only로 이름 붙임 | 실제 산문에서 unknown 과다 또는 의미 parser 유혹 |
| whole-module materialization이 9 target에서 경제적 | M6 전까지 미검증 | rebuild/redeploy 총비용이 수동 비용 절감 초과 |
| installed target remote latest | scope 밖으로 명시 | release service/registry attestation 요구 발생 |
| trusted renderer가 충분히 안전 | first-party domain만 허용 | third-party renderer/오용 사례 발생 |
| artifact-derived resume가 충분 | durable state 없음 | artifact로 복구 못 한 coordination 정보 관찰 |
| Node가 모든 목표 host에서 가용 | M0 실측 전 major 미고정 | host 하나라도 지원 runtime 부재 |
| managed-region이 일반 문서에 맞음 | Verify output 한정 | 다중 owner/구조 editor가 필요한 실제 사례 |
| Codex와 Claude adapter가 동일 계약을 따름 | 둘 다 behavior test 전 범용 claim 금지 | adapter-specific divergence |
| capsule이 Windows에서도 path/mode/bytes를 무손실 복원 | M0 temporary restore 전 claim 금지 | inventory mismatch, symlink/mode 손실, restore 절차 실패 |
| final `skills/skill-rails` 경로와 `skill-rails-next` identity를 official installer가 분리 | isolated home M0 probe | directory-name 강제 또는 기존 global namespace 포획 |
| Framework 부분 self-routing이 최소 지침·전체 읽기보다 신뢰성과 총비용에서 우월 | M5 세 lane·세 task·두 host에서 미검증으로 비교 | critical omission, 재작업 또는 total cost가 L0/L2보다 열등·동등 |
| derived heading index와 H2/H3 projection이 탐색 비용보다 싸다 | index는 M5 실험, projection은 bounded-read 실패 뒤만 | index가 왕복을 줄이지 않거나 projection build/currentness 비용이 절감 bytes 초과 |
| 기존 manifest 기반 inspect가 maintenance 질문에 충분 | M1은 구조 relation만 제공 | M5 일곱 질문 중 owner/check/boundary 탐색 실패 |
| inverse impact가 필요한 consumer 규모 | M6 전에는 구현하지 않음 | 사람이 실제 consumer를 누락·오선택하거나 수동 역산 비용 반복 |
| 사람용 overview가 source graph 직접 읽기보다 유용 | generator 보류 | 사람의 구조 질문·오수정·반복 탐색 관찰 |
| 새 maintainer 문서 route가 과거 대화 없이 복원 가능 | 자기보고를 증거로 쓰지 않음 | unfamiliar change에서 owner/consumer/evidence/gap 탐색 실패 |
| Framework 통합이 target보다 큰 의식이 아님 | M5 fresh author에서 누락·재작업·읽기·왕복·총시간 측정 | self-route 오선택, whole fallback 반복, authoring overhead가 제거한 오류·재작업 비용 초과 |
| graph+code-near comment 분리가 낯선 maintainer에게 유용 | D-14 최소 형식만 적용하고 M5에서 관찰 | comment가 관계/동작을 중복, pointer drift, 읽기 왕복 증가 또는 안전·복구 개선 없음 |

이 항목들은 첫 구현을 막는 숨은 결정이 아니다. 각각 현재의 보수적 동작과 이후 행동이 이미 정해진 실험 가설이다. 단, M0-B의 commit과 파일 이동·제거는 기술 미결이 아니라 아직 받지 않은 운영 권한이므로 승인 전에는 진행할 수 없다.

## 16. 구현 준비 판정과 첫 작업

이 계획은 **M0-A와, 사용자 승인 뒤 M0-B부터 M4까지의 greenfield Verify 반증 구현에 준비 완료**다. incubator에서 나중에 옮기는 단계는 없고, M0-B 뒤 첫 production source는 곧바로 §4 최종 경로에 생긴다. 구현자가 임의로 정해야 할 archive 역할, active/legacy 경계, root package/discovery contract, source owner, runtime interface, write/currentness, effect claim과 version/cutover는 남겨 두지 않았다.

권장되는 첫 작업은 production code가 아니라 `M0-A — read-only 전환 inventory와 복원 rehearsal 설계 고정`이다.

구체 산출물:

1. HEAD/tag, tracked/untracked/ignored inventory와 raw hash/mode
2. §4.1 네 범주의 exact path ledger와 사용자 변경 충돌 판정
3. archive capsule manifest와 temporary-root restore 절차의 dry specification
4. final root npm identity/`files`/test/discovery/no-import preflight specification
5. actual Node/Codex/Claude/official installer version, isolated home과 permission profile receipt
6. natural-language pilot Verify control fixture의 exact file hash, `verificationCommand`의 fixture 내부 실행 가능성·기대 exit/output과 M1~M4 비용 측정 schema

이번 기획 작업에서는 이 M0-A 산출물도 만들지 않았고 production code, archive, 파일 이동·삭제, 설치, publish를 수행하지 않았다. 다음 구현 turn에서는 먼저 M0-A를 완료해 exact 이동 목록을 사용자에게 제시한다. 그 뒤 commit과 이동·제거 승인을 받으면 M0-B에서 capsule을 실제 생성·복원 검증하고 final root skeleton으로 전환한 다음 M1 build core를 시작한다.

제품과 architecture 관점의 추가 결정 없이 M0~M4를 구현할 수 있다. 남은 사용자 항목은 설계 선택이 아니라 destructive/external action 권한이다. M0-B의 durable commit과 exact legacy 이동·제거, M8의 `latest`/`skill-rails` identity 승계, 기존 전역 설치 교체, `private` 해제·publish와 향후 archive 삭제는 각각 실행 직전 evidence를 제시하고 명시 승인을 받아야 한다.

M5 이후에는 의도적 gate가 남아 있다. M4 결과가 정한 stage별 prose/prepare/renderer 비율, Framework 3-lane의 실제 품질·누락·재작업·context·총비용, bounded read와 조건부 projection, graph+comment의 유지보수 효과, 일곱 maintenance 질문에서 필요한 최소 semantic edge, inverse impact와 사람용 projection의 실제 입장 신호는 구현 전에 관찰해야 한다. 이는 M0~M4의 숨은 계약이 아니라 더 큰 제품을 증거 없이 미리 만드는 것을 막는 퇴출 조건이다.

## 17. 문서 동결과 구현 이후 변경 관리

이 문서는 사용자가 2026-09-13 KST에 구현 출발 계획으로 확정하고 동결했다. 이 절을 반영한 현재 내용이 마지막 승인본이다. 이후 구현·검증·운영에서 새 문제, 더 나은 수단, 잘못된 전제 또는 추가 요구가 발견되어도 **이 파일을 편집·이동·이름 변경·축약·확장·대체하지 않는다.** 오탈자, 링크, 형식 정리처럼 의미가 작아 보이는 수정도 예외로 두지 않는다.

구현 중 변경이 필요하면 먼저 현재 계획을 그대로 기준선으로 보존하고 별도 후속 문서 `docs/plan/implementation-evolution-plan_ko.md`를 새로 만든다. 그 문서는 이 계획을 다시 쓰는 정본이 아니라 다음 항목을 소유하는 가변 기록이다.

- 구현에서 실제로 관찰한 문제와 재현 evidence
- 영향을 받는 이 문서의 `D-*`, 계약, milestone과 requirement
- 계속 보존할 목적·금지·책임 경계
- 현재 계획과 달라지는 선택, 대안, 비용과 결정 권한
- 채택·기각·보류 결과와 다시 여는 조건
- 적용된 source·test·검증 receipt와 아직 `unproven`인 범위

후속 문서는 현재 계획의 문장을 조용히 무효화하지 않는다. 변경 항목마다 `계승`, `대체 제안`, `반증`, `미결정` 중 지위를 표시하고, 제품 목적·허용 비용·권한·비가역 행동이 달라지면 구현자가 단독 결정하지 않고 사용자에게 회부한다. 구현 evidence가 더 나은 수단을 지지하면 후속 문서와 코드가 그 결정을 반영할 수 있지만, 이 동결 문서는 당시 승인된 출발점과 판단 근거로 영구 보존한다.
