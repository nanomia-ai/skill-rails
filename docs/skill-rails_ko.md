# Skill Rails 통합 기획·구현·검증 문서

문서 상태: 구현 기준 정본

기준일: 2026-08-23 KST

핵심 범위: 에이전트에 종속되지 않는 스킬 작성·유지보수·검증 구조

현재 검증된 adapter: Codex와 Claude Code

제품 상태: 구현·독립 검수·프로젝트 로컬 실측을 완료한 초기 공개 버전

이 문서는 Skill Rails를 처음 보는 사람과 AI가 별도 대화 기록 없이도 다음을 이해하도록 만든 유일한 프로젝트 문서다.

- 왜 이 제품이 필요한가
- 무엇을 만들었고 무엇을 만들지 않았는가
- V5의 핵심을 어떻게 보존했는가
- AI가 이 제작 스킬로 스킬을 만드는 방법
- 생성된 스킬이 실행될 때 무엇이 일어나는가
- 현재 어떤 주장이 검증됐고 무엇이 아직 검증되지 않았는가
- 다음 수정자가 어떤 불변조건을 지켜야 하는가

과거 기획서·검토 브리프·중간 보고서는 이 문서로 통합한다. 역사적 초안과 현재 코드가 충돌하면 현재 코드와 이 문서의 V5 변경 원장을 함께 확인한다. 둘이 다시 충돌하면 동작을 추정하지 말고 검증을 중단한 뒤 변경 원장을 먼저 고친다.

---

## 1. 한 문장 결론

Skill Rails는 복잡한 스킬의 기계적으로 판정 가능한 조건·순서·형식·증거 요구를 검증 가능한 코드 구조로 옮기고, 사람이나 모델의 판단이 필요한 의미만 짧은 문서로 남겨, AI가 스킬을 만들고 유지보수하고 실행할 때 생기는 드리프트를 줄이는 **단일 스킬 제작 스킬**이다.

Skill Rails 자체도 하나의 스킬이며, 한 번의 제작 결과도 하나의 독립 스킬이다. 여러 스킬을 단계별로 호출하거나 다음 스킬로 넘기는 체이닝 시스템이 아니다.

---

## 2. 출발점과 해결 과제

### 2.1 실제 출발점

복잡한 개발 스킬을 산문 중심으로 약 20일 동안 점진적으로 보수하면서 다음 악순환이 관찰됐다.

1. 예외와 보완 규칙을 문장으로 추가한다.
2. 문서가 길어지고 같은 의미가 여러 위치에 흩어진다.
3. AI가 일부 문장을 다르게 해석하거나 긴 세션에서 누락한다.
4. 한 실패를 고치기 위해 더 많은 설명을 추가한다.
5. 추가 설명이 다시 중복·모순·오독 가능성을 만든다.

문제는 단순히 산문을 잘 쓰지 못했다는 것이 아니다. 행동 규칙과 유지보수 단위가 모두 자연어 문장이라는 표현 구조 자체가 병목이었다.

### 2.2 행동 드리프트

긴 `SKILL.md`는 읽는 순간의 모델·질문·대화 길이에 따라 다른 working set을 만든다. 특히 문서 후반의 의무, 예외, 완료 증명, 순서가 누락되기 쉽다. 세션이 길어지거나 압축된 뒤에는 이미 읽었던 규칙도 현재 문맥에 남아 있다는 보장이 없다.

### 2.3 유지보수 드리프트

산문은 안정적인 주소가 없다. “세 번째 단락의 이 문장”을 수정하면 다른 단락의 같은 의미가 남을 수 있고, 문장 하나가 조건·예외·순서·이유를 동시에 소유할 수 있다. AI는 줄 diff를 볼 수 있지만 행동 의미가 어떻게 변했는지는 자동으로 알기 어렵다.

### 2.4 검증 불가능성

산문만으로는 다음을 기계적으로 답하기 어렵다.

- 모든 분기가 닫혔는가
- UNKNOWN을 false처럼 처리했는가
- 금지된 효과가 계획에 포함됐는가
- 정확한 형식과 수량이 보존됐는가
- 완료 주장을 뒷받침하는 증거가 있는가
- 모델이 규칙을 따랐다는 주장이 실제 관찰인지 자기보고인지

### 2.5 컨텍스트 비효율

현재 단계에 필요한 것은 보통 전체 스킬이 아니라 다음의 작은 묶음이다.

- 현재 snapshot의 사실
- 적용된 guard와 stage
- 선택된 row와 ordered effects
- 현재 판단에 필요한 body section
- 정확한 template
- 완료에 필요한 proof

전체 산문을 매번 다시 읽히면 토큰을 더 쓰면서도 중요한 의무가 희석된다.

### 2.6 AI 작성 난이도

최종 사용자는 사람이지만 실제 작성·마이그레이션·유지보수의 많은 부분을 AI가 수행한다. 따라서 구조는 사람에게만 보기 좋아서는 부족하다. 아무 배경 지식이 없는 AI가 다음을 안정적으로 할 수 있어야 한다.

- 의미를 잃지 않고 의무를 원자화한다.
- 가장 작은 충분 구조를 선택한다.
- 기계 판단과 인간·모델 판단을 구분한다.
- 정본과 생성물을 혼동하지 않는다.
- 검증 실패를 편법으로 없애지 않는다.

---

## 3. 목표와 비목표

### 3.1 목표

1. 복잡한 스킬의 행동 정본을 하나로 만든다.
2. 기계적으로 판정 가능한 부분은 실행·검증 가능한 구조로 옮긴다.
3. 판단이 필요한 부분은 짧고 주소 가능한 body section으로 제한한다.
4. 현재 단계에 필요한 context만 모델에 제공한다.
5. 유지보수 변경을 stable ID와 의미 단위로 추적한다.
6. 증거가 없을 때 성공을 추론하지 않는다.
7. Codex와 Claude Code에서 같은 단일 스킬 패키지를 사용한다.
8. 단순한 스킬에는 복잡한 runtime을 강요하지 않는다.

### 3.2 비목표

- 여러 스킬을 조합하거나 순차 호출하는 orchestration
- cross-skill router 또는 marketplace
- 전역 installer나 package registry
- 범용 agent runtime 대체
- 모델의 모든 tool call을 가로채는 sandbox
- hook 기반 강제 집행
- 임의 JavaScript 전체를 신뢰하는 실행기
- 구조 검증만으로 작업 결과의 품질을 보증하는 것
- 모든 종류의 스킬을 P2로 만드는 것

### 3.3 성공을 나누는 세 축

성공은 하나의 숫자가 아니다.

1. **제작 스킬 사용성**: 처음 온 AI가 Skill Rails를 이용해 올바른 구조를 만들 수 있는가.
2. **생성 스킬 사용성**: 처음 온 AI가 생성된 스킬을 발견하고 올바르게 사용할 수 있는가.
3. **작업 결과 품질**: 생성 스킬을 쓴 결과가 baseline보다 실제로 나은가.

세 축은 별도로 검증한다. 한 AI가 만들고, 사용하고, 자기 결과를 채점한 기록만으로 세 축을 모두 통과했다고 주장하지 않는다.

---

## 4. 행위자 모델

### 4.1 사람 소유자

사람은 목적, 제품 경계, 고위험 판단, 승인, 의미 변경을 소유한다. 사람은 모든 코드를 직접 작성할 필요는 없지만 다음을 승인해야 한다.

- 새 행동 의미
- 기존 의미의 삭제 또는 축소
- 모호한 마이그레이션 atom의 처분
- 비가역적 효과 경계
- V5 핵심 변경

### 4.2 AI 작성자

AI 작성자는 intent를 구조화하고, profile을 선택하고, 정본과 fixture를 작성하고, lint/build/eval을 실행한다. 대화 기억은 작업 상태가 아니다. intent, ledger, fixture, manifest, report를 디스크에 남긴다.

### 4.3 생성 스킬을 사용하는 AI

소비 AI는 전체 정본을 해석하지 않는다. 얇은 loader의 지시에 따라 helper 또는 P2 runtime을 호출하고, 현재 Decision이 제공하는 guide·body·template·proof만 사용한다.

### 4.4 플랫폼 adapter

Codex와 Claude Code의 발견 경로 및 skill-root 표현 차이는 adapter가 담당한다. 행동 정본과 skill body를 플랫폼별로 복제해 따로 유지하지 않는다.

---

## 5. 변경해서는 안 되는 설계 불변조건

1. Skill Rails는 하나의 creator skill이다.
2. 생성 결과도 작업당 하나의 독립 skill package다.
3. `spec.mjs`는 P2 행동의 유일한 정본이다.
4. body 산문은 판단 기준과 이유만 소유한다.
5. template은 정확한 출력 모양만 소유한다.
6. collector는 관찰하고 정규화할 뿐 정책을 결정하지 않는다.
7. observation, judgment, decision을 서로 바꾸어 쓰지 않는다.
8. UNKNOWN은 false가 아니다.
9. 모든 predicate는 실제 read와 선언된 `reads`가 일치해야 한다.
10. guard와 stage는 선언 순서를 보존한다.
11. RESTRICT는 금지 effect를 누적하고 허가를 만들지 않는다.
12. effect plan은 정확히 하나의 terminal로 끝난다.
13. 정확한 수량·순서·형식은 산문이 아니라 구조가 소유한다.
14. 생성 파일은 직접 수정하지 않고 정본에서 재생성한다.
15. 스킬 상태와 trace는 설치 package 밖에 둔다.
16. 증거가 없으면 `unproven`이다.
17. agent 자기보고는 critical proof가 아니다.
18. runtime은 domain effect executor가 아니다.
19. validator 실패 시 산문으로 결정을 복원하지 않는다.
20. 단순한 스킬은 P0/P1로 남겨 P2 복잡성을 피한다.
21. 마이그레이션 원문은 coverage와 별도 삭제 승인 전까지 보존한다.
22. Codex와 Claude Code는 동일 portable core를 공유한다.
23. V5 핵심을 삭제·축소·변경하면 이 문서의 변경 원장에 이유와 동등성 검사를 먼저 기록한다.

---

## 6. 전체 구조

```text
사람의 목적
   │
   ▼
intent brief ── obligation ledger ── authoring card
   │
   ▼
가장 작은 충분 profile 선택: P0 / P1 / P2
   │
   ├─ P0: 짧은 판단 지침
   ├─ P1: 지침 + 결정적 helper/template/test
   └─ P2: V5 spec + body + collector + fixture + embedded runtime
                                             │
                                             ▼
                                  snapshot → Decision → compact guide
                                             │
                                             ▼
                                  effect 뒤 재호출 → trace → alignment
```

Creator repository는 authoring 도구와 P2 runtime 원본을 가진다. P2 build는 검증된 runtime을 생성 스킬 안에 복제한다. 생성 스킬은 creator 저장소나 전역 서비스에 의존하지 않고 독립 실행된다.

---

## 7. P0·P1·P2: 가장 작은 충분 profile

| Profile | 선택 조건 | 생성 구조 | 보장 경계 |
| --- | --- | --- | --- |
| P0 | 판단 중심이며 상태 분기·정확 형식·반복 helper가 없음 | 얇고 명확한 `SKILL.md` 중심 | 산문 품질과 forward model test 필요 |
| P1 | 결정적 변환·검사·template은 필요하지만 state machine은 불필요 | `SKILL.md` + 필요한 script/reference/template/test | helper 동작은 검증 가능, 모델 사용 행동은 별도 증거 필요 |
| P2 | 상태 의존 행동 또는 비가역 경계가 있거나, exact format이 상태 의존 행동과 결합됨 | V5 `spec.mjs` + body + collectors + fixtures + self-contained runtime | 구조·결정·trace를 강하게 검증, tool-call 강제는 하지 않음 |

### 7.1 P2 상승 신호

- 같은 조건·예외가 여러 stage에서 반복된다.
- 완료 전에 증거와 승인을 확인해야 하고 그 결과에 따라 행동이 달라진다.
- ASK, WAIT, BLOCK, ROUTE, DONE의 구분이 중요하다.
- 효과 순서가 바뀌면 안전성이나 의미가 달라진다.
- 출력 byte shape 또는 정해진 수량이 상태 분기와 결합된다.
- 세션 재진입 시 현재 상태를 다시 계산해야 한다.

### 7.2 P2를 선택하면 안 되는 이유

문서가 길다는 이유만으로 P2를 고르지 않는다. 단순 판단 skill을 state machine으로 만들면 작성 비용, validator surface, runtime context, 유지보수 비용만 증가한다. 현재 `auto` 규칙은 `state_dependent_behaviors` 또는 `irreversible_boundaries`가 있으면 P2, `deterministic_helpers`가 있으면 P1, `exact_formats`만 있으면 P1, exact format과 상태 의존 행동이 함께 있으면 P2를 선택한다. `completion_evidence`만으로 profile을 올리지는 않는다. 명시한 profile은 이 자동 선택을 override하며, 선택 신호와 이유는 `.skill-rails/profile-decision.json`에 남긴다.

### 7.3 Creator 자체의 profile

Skill Rails 자체는 P1이다. 사용법은 짧은 `SKILL.md`에 있고, 생성·마이그레이션·유지보수·검증은 결정적 scripts가 담당한다. Creator를 다시 P2 state machine으로 만들지 않는다. 생성 대상보다 creator가 더 경직되고 복잡해지는 재귀 문제를 막기 위한 결정이다.

---

## 8. 정본과 소유권

### 8.1 Creator 정본

- `SKILL.md`: 선택과 authoring 진입 절차
- `references/`: 작업 종류에 따라 읽는 작성·V5·평가·마이그레이션·플랫폼·README 작성 규칙
- `scripts/lib/`: profile, generator, obligation, migration, maintenance, semantic diff, build
- `scripts/runtime/`: P2 validator, evaluator, guide, trace, alignment 원본
- `schemas/`: 공개 Decision과 Trace Event 계약
- `templates/`: creator가 만드는 초기 authoring 자산
- `fixtures/`, `tests/`, `evals/`: 반증과 검증 증거

### 8.2 생성된 P2의 정본

| 자산 | 소유 의미 |
| --- | --- |
| `.skill-rails/intent.json` | 사용자의 목적과 경계 |
| `.skill-rails/obligation-ledger.json` | 원문 의무의 provenance와 projection 상태 |
| `spec.mjs` | 관찰, guard, stage, table, effect, order, format, ownership, proof |
| `body.md` | 판단 기준과 이유 |
| `templates/` | exact output shape |
| `collectors/` | 관찰과 정규화 |
| `fixtures/` | 분기·형식·mutation evidence |

### 8.3 생성물

다음은 build가 만든다.

- `SKILL.md`
- `agents/openai.yaml`
- `schemas/`
- `scripts/skill-rails/`
- `.generated.json`

`.generated.json`에 기록된 파일을 손으로 고치지 않는다. 정본을 수정하고 build한다. build는 임시 staging directory에서 전체를 검증한 뒤 manifest를 마지막에 기록하고 원자적으로 교체한다. 실패한 build가 부분 생성물을 남기지 않는다.

---

## 9. V5 행동 모델

### 9.1 닫힌 14개 export

모든 P2 `spec.mjs`는 비어 있더라도 다음 이름을 정확히 export한다.

```text
SPEC
OBSERVATIONS
FORMATS
TEMPLATES
ORDERS
OWNERSHIP
GUARDS
STAGES
TABLES
ARTIFACTS
ROLES
READ_FIRST
DECLARATIONS
DEFERRED
```

누락 export, 추가 export, 동적 export, 허용되지 않은 외부 module import는 거부한다. 생성 package의 고정된 local DSL import와 local helper만 허용된 AST 부분집합·비순환 call graph 안에서 사용할 수 있다.

### 9.2 관찰 값

- `KNOWN(value)`: domain-valid 값을 신뢰 가능한 방법으로 관찰했다.
- `NONE`: 부재를 적극적으로 관찰했다.
- `UNKNOWN(reason)`: 신뢰할 수 있게 관찰하지 못했다.

UNKNOWN은 false나 NONE이 아니다. predicate가 UNKNOWN을 받을 수 있으려면 해당 field를 `acceptsUnknown`에 명시해야 한다. 그렇지 않으면 현재 흐름을 멈춘다.

### 9.3 세 가지 값 출처

- **OBSERVE**: collector가 외부 상태를 관찰한다.
- **JUDGE**: 모델 또는 사람이 body 기준으로 판단한다.
- **DECISION**: 사용자가 선택했거나 이미 승인된 구조화 결정을 받는다.

각 observation은 정확히 한 source class를 가진다. judged와 decided 값은 agent 또는 사용자가 공급한 주장·판단이며 collector 관찰과 동일하지 않다. 필요하면 값 뒤에 `@sha256:<snapshot>`을 붙여 현재 snapshot에 선택적으로 결속한다. 결속된 값은 snapshot이 바뀌면 `SR_INPUT_STALE`로 거부하고, 결속하지 않은 값은 현재 호출의 입력으로만 취급한다.

### 9.4 Guard

Guard는 배열 순서대로 평가한다.

- `ASK`, `BLOCK`, `ROUTE`는 현재 run을 끝낸다.
- `RESTRICT`는 금지 effect verb를 누적하고 계속한다.
- bypass는 collector가 관찰한 durable evidence만 사용할 수 있다.
- 모델이 “승인받았다”고 말한 값만으로 guard를 우회할 수 없다.

### 9.5 Stage

Stage는 선언 순서대로 보며 `done`이 true가 아닌 첫 stage를 선택한다. 각 stage는 `record` 또는 `reentry` 중 정확히 하나를 소유한다. Collector 값에 의존하는 `done`은 관찰된 값으로, judged/decided 값에 의존하는 `done`은 공급된 주장·판단으로 평가된다. 따라서 assertion만으로 완료를 건너뛰면 안 되는 규칙은 collector 또는 별도 proof를 설계해야 한다. ASK, WAIT, approval receipt는 기억만으로 생략하지 않는다.

### 9.6 Table과 row

복잡한 분기는 stable table ID와 row ID를 가진다. row에는 읽는 값, 조건, 효과가 명시된다. overlap, 빠진 default, 닫히지 않은 reference, fixture 없는 branch를 validator가 거부한다.

### 9.7 Effect

Effect plan은 순서를 보존하며 다음 terminal 중 정확히 하나로 끝난다.

```text
NEXT | ASK | WAIT | ROUTE | BLOCK | DONE
```

RESTRICT와 충돌하는 effect는 Decision을 내기 전에 차단한다. runtime은 effect 계획을 계산하지만 WRITE나 DISPATCH를 대신 실행하지 않는다.

### 9.8 Body

Body의 level-two heading은 다음 네 종류뿐이다.

```text
guard: <id>
stage: <id>
role: <id>
why: <id>
```

Stage section은 `Judgment:`와 `Why:`를 가진다. body에는 procedure, branch condition, effect order, exact count, template shape, ownership path를 중복하지 않는다. body의 목적은 새로운 상황에서 모델이 판단할 기준과 이유를 제공하는 것이다.

### 9.9 Format과 template

정확한 형식은 구조가 소유한다. placeholder는 `line`, `block`, `list`, `generated`와 같은 type을 가지며, fixture와 round-trip 검사로 shape를 확인한다. 모델이 prose example을 보고 형식을 재구성하게 하지 않는다.

### 9.10 DEFERRED

기계화해야 하지만 collector·fixture·owner·제거 조건이 아직 없는 의무는 `DEFERRED`에 남긴다. DEFERRED는 TODO를 숨기는 장소가 아니라 release를 막는 명시적 gate다. obligation atom이 `review-required`인 동안 최종 P2 DEFERRED를 지우지 않는다.

---

## 10. Runtime은 왜 존재하는가

Runtime은 AI 대신 일을 수행하는 agent runtime이 아니다. 목적은 **모델이 산문 전체를 읽고 현재 행동을 매번 재해석하지 않도록, 검증된 정본에서 지금 필요한 작은 결정을 계산하고 그 결정의 증거를 보존하는 것**이다.

### 10.1 하는 일

1. `spec.mjs`를 import하기 전에 허용 AST와 source 구조를 검사한다.
2. collector·judged·decided 입력을 하나의 snapshot에 묶는다.
3. guard, stage, table row, ordered effects를 결정적으로 계산한다.
4. 현재 Decision과 compact guide를 만든다.
5. 필요한 body section과 template만 전달한다.
6. runtime 관찰, agent claim, artifact evidence를 서로 다른 권위로 trace에 기록한다.
7. 요구된 proof와 실제 evidence를 비교해 alignment를 계산한다.

### 10.2 하지 않는 일

- 모델의 tool call 가로채기
- 파일 쓰기나 외부 메시지 전송 같은 domain effect 실행
- agent claim을 verified evidence로 승격
- 빠진 증거를 성공으로 추론
- validation 실패 후 body에서 임의 결정 복원
- 다른 skill 호출 또는 설치

### 10.3 실행 흐름

```text
enter
  └─ kernel + READ_FIRST + spec/runtime fingerprint + enter-hash

stage
  ├─ 시작 snapshot
  ├─ collectors
  ├─ judged/decided binding
  ├─ 종료 snapshot 비교
  ├─ guard / stage / row / effect 계산
  ├─ Decision + guide + 필요한 body/template
  └─ trace

agent가 계획된 effect를 처리
  └─ evidence 또는 claim 기록

stage 재호출
  └─ 새 상태에서 다시 계산; NEXT를 대화 기억으로 이어 가지 않음

align
  └─ proof requirement와 trace authority 비교
```

### 10.4 Enter-hash와 재진입

현재 context가 `enter-hash`를 본 적이 없으면 `enter`를 다시 실행한다. 이 규칙은 compaction 뒤 최소 kernel과 READ_FIRST를 복구하는 portable fallback이다. 플랫폼 hook이 없더라도 사용할 수 있지만, 모델이 호출하지 않으면 강제되지 않는다.

### 10.5 Snapshot과 TOCTOU

관찰 시작과 끝의 fingerprint가 다르면 decision은 stale로 종료한다. collector가 읽는 대상과 snapshot basis가 어긋나지 않는지 검사한다. build와 runtime은 path 정규화, package boundary, symlink/junction, manifest hash를 확인해 다른 파일로 바뀌는 우회를 막는다.

### 10.6 설치 package 밖의 state

Trace와 lock은 skill root 밖에서 호출자가 `--trace-dir`로 명시한 state directory에 기록한다. 자동 state-root 선택은 구현하지 않았다. `stage`는 trace 없이도 계산할 수 있지만, `record`, `align`, `resume`은 외부 trace 위치와 run identity가 필요하다. 설치된 skill은 read-only여도 실행 가능하다. trace append는 원자적 lock directory로 직렬화하며, stale lock과 경로 이탈을 fail-closed로 처리한다.

---

## 11. Decision, guide, trace, alignment

### 11.1 Decision

Decision은 현재 run의 작고 versioned한 계약이다. 핵심 정보는 다음과 같다.

- skill, spec/runtime/validator fingerprints
- snapshot status와 unknowns
- status, guard, bypass, restrict
- stage, row, facts, reads
- judged와 decided echo
- record 또는 reentry
- ordered effects
- format, template, 필요한 body section
- needs, proof requirements, reinvoke condition
- assurance

V5의 18개 공개 위치는 삭제하지 않고 typed grouping으로 보존한다.

| V5 위치 | 현재 Decision |
| --- | --- |
| `skill` | `skill` |
| `snapshot` | `snapshot.{fingerprint,status,unknowns}` |
| `guard` | `guard` |
| `bypassed` | `bypassed[]` |
| `restrict` | `restrict[]` |
| `stage` | `stage` |
| `row` | `row` |
| `facts` | `facts[{field,value}]` |
| `judged` | `judged` |
| `decided` | `decided` |
| `record` | `record` |
| `effects` | `effects[]` |
| `format` | `format.{id,example}` |
| `template` | `template` |
| `templateText` | `template_text` |
| `body` | `body.ref` |
| `bodyHash` | `body.hash` |
| `bodyMarkdown` | `body.markdown` |

`schema`, `decision_id`, `spec`, `runtime`, `status`, `reads`, `needs`, `proof_required`, `reinvoke`, `assurance`은 replay와 증거 경계를 위한 명시적 확장이다.

### 11.2 Compact guide

Guide는 Decision의 model-facing projection이다. 모델이 JSON 내부를 다시 해석하거나 전체 body를 열지 않도록 현재 사실·중지 이유·ordered effects·proof·body section을 짧게 보여준다. JSON과 guide는 같은 계산 결과에서 생성되며 golden test로 동등성을 확인한다.

### 11.3 Trace Event

Trace는 steering과 evidence reference를 기록한다. raw tool output 전체를 무조건 넣지 않는다. 각 event는 schema, run, sequence, timestamp, spec/snapshot/decision fingerprint, source, authority를 가진다.

### 11.4 Evidence authority

| 권위 | 의미 |
| --- | --- |
| `runtime_observed` | runtime이 직접 계산·관찰 |
| `harness_observed` | 신뢰된 adapter/hook이 관찰 |
| `artifact_verified` | artifact와 fingerprint를 재검사 |
| `agent_claimed` | 모델 자기보고; critical proof 불가 |
| `human_confirmed` | 신뢰된 채널이 사람 행동과 scope를 기록한 경우만 사용 |

### 11.5 Alignment

개별 요구사항은 `satisfied`, `violated`, `unproven`, `not_applicable`로 판정한다. aggregate는 `aligned`, `partial`, `unproven`, `misaligned`, `stale`이다.

성공 문장이 trace에 있어도 요구 proof가 없으면 `unproven`이다. agent가 effect를 수행했다고 기록했지만 외부 관찰이 없으면 그 claim은 보존하되 verified로 바꾸지 않는다.

---

## 12. 검증 경계: L-fast, L-structural, L-full

### 12.1 L-fast

매 import 전에 source-first로 실행한다. manifest를 신뢰 근거로 사용하지 않는다.

- positive-list AST
- forbidden syntax와 ambient authority
- import/export closure
- local call graph cycle
- typed comparison
- 실제 state read와 선언 `reads`

### 12.2 L-structural과 L-full

`lint`의 기본 단계인 L-structural은 빠른 작성 피드백을 위해 다음을 검사한다.

- L-fast 전부
- isolated import
- L0–L18 구조 검증

L-full은 `build`에서만 성립한다. L-structural에 다음 실행 증거를 더하고 manifest를 마지막에 생성한다.

- scenario fixture
- mutation suite
- determinism repeat
- format/template checks
- manifest 생성과 전체 의존 fingerprint

Runtime은 build로 확인된 ESM을 같은 process에서 평가한다. 임의 JavaScript를 허용하는 것이 아니라 validator가 허용한 제한된 표현만 실행한다. 별도 interpreter를 만들지 않아 정본과 실행 의미의 이중화를 피한다.

Manifest는 spec, DSL, runtime, validator뿐 아니라 content와 generated-file hash, runtime/validator version, `minimum_node_major=20`을 기록한다. 실행 중인 Node의 정확한 major를 고정하는 계약이 아니라 최소 호환 major를 검증하는 계약이다.

### 12.3 L0–L18 대응

| Level | 차단하는 결함 |
| --- | --- |
| L0 | `spec.mjs`, 정확한 14 export, 검증 전 import |
| L1 | 허용되지 않은 AST/import/mutation/dynamic construct/call cycle |
| L2 | observation source와 collector registry 불일치 |
| L3 | domain과 runtime value 불일치 |
| L4 | predicate 실제 read와 선언 `reads` 불일치 |
| L5 | table row ID/default/exclusive overlap/order 결함 |
| L6 | stage record/reentry/done/needs/reference/terminal/cycle 결함 |
| L7 | body section ID 집합·순서·reference 불일치 |
| L8 | body가 절차·수량·format·ownership 정본을 중복 |
| L9 | stage Judgment/Why와 needs/domain 결함 |
| L10 | artifact writer/readers/template reference closure |
| L11 | template placeholder/type/field/section/byte parity |
| L12 | ownership과 WRITE/role effect 경계 |
| L13 | 선택된 language profile의 body/bootstrap/signature parity |
| L14 | guard/stage/branch/table row fixture coverage |
| L15 | exact format domain, unique terminal, round-trip, CR/LF |
| L16 | declaration consumer와 DEFERRED 완전성 |
| L17 | 각 level을 실제로 죽이는 mutation, survivor 0 |
| L18 | guard bypass가 collector-observed durable evidence만 읽는지 |

---

## 13. Authoring workflow

### 13.1 Intent capture

다음을 디스크에 기록한다.

- 해결할 문제
- positive trigger와 near-miss
- 입력과 출력
- 상태에 따른 행동
- 비가역 경계
- exact format
- 외부 의존성
- 완료 증거
- 모델이나 사람의 판단이 필요한 지점

사용자 질문은 답이 제품 경계나 비가역 행동을 바꿀 때만 한다. 나머지는 합리적 가정을 기록하고 진행한다.

### 13.2 Obligation atomization

원문 의무를 작은 atom으로 분해한다. 각 atom은 원문, source 위치, consequence, target locator, evidence locator, disposition을 가진다. 원문은 수정하지 않는다.

지원 locator:

```text
file:<relative-path>
body:<section-ref>
spec:<GROUP>/<stable-id>
spec:TABLES/<table>/<row>
fixture:<id>
eval:<id>
```

Target과 evidence가 모두 실제로 resolve될 때만 `projected`로 바꾼다.

### 13.3 작성 순서

1. intent와 evaluation cases
2. obligation ledger
3. P2는 `templates/authoring-card.md`를 작업 package에 복사해 observation, judgment, owner, artifact, terminal을 채운 뒤 승인된 결정을 spec과 ledger에 투영
4. terminal 설계
5. observation과 domain
6. guard와 bypass evidence
7. stage, table, effect, order
8. format, template, example
9. 판단 전용 body
10. positive·negative·boundary·mutation fixtures
11. thin loader와 platform metadata
12. lint, build, eval

### 13.4 생성

```text
node <skill-root>/scripts/init.mjs \
  --intent <intent.json> \
  --out <folder> \
  [--profile auto|p0|p1|p2]
```

P1/P2 output은 안전하게 실패하는 scaffold다. marker, unresolved atom, P2 DEFERRED를 사용자별 의미와 test로 교체하기 전에는 완성품이 아니다.

### 13.5 보수적 마이그레이션

```text
node <skill-root>/scripts/migrate.mjs \
  --source <old-skill> \
  --out <folder>
```

원본 project를 수정하지 않는다. 승인된 destination에 복사·생성한다. source의 paragraph, list item, table row를 atomize하고, exact format → observation → stage/guard/effect 순으로 옮긴다. judgment는 body에 남긴다.

Migration atom은 별도 원장에 쓰지 않고 `.skill-rails/obligation-ledger.json`에 원문 span/hash/confidence/rationale와 함께 추가한다. 따라서 P2의 기존 L16 gate가 intent atom과 migration atom을 같은 릴리스 경계에서 검사한다.

다음이면 중단한다.

- consequence가 높은데 confidence가 낮다.
- source atom의 방어 가능한 target이 없다.
- 새 target의 provenance가 없다.
- old/new scenario가 승인 없이 달라진다.

원문 삭제는 coverage, reverse provenance, critical review-required 0, old/new 비교, 별도 승인 후에만 한다.

### 13.6 유지보수

```text
node <skill-root>/scripts/maintain.mjs \
  --skill <folder> \
  --change <change.json>
```

이 명령은 P2 전용이다. P0/P1은 정본을 직접 수정하고 lint와 forward test를 다시 실행한다. P2에서는 문장 위치가 아니라 stable ID를 주소로 사용한다. 변경 전후에 영향받은 predicate, stage, row, body, template, owner, fixture, generated artifact를 확인한다. line diff와 semantic impact report를 모두 본다.

### 13.7 완료 경계

- lint/build pass: 구조적으로 buildable
- deterministic fixture pass: 선언된 기계 의미가 재현됨
- forward model test: AI가 발견·호출·준수했는지에 대한 증거
- task-output comparison: 결과 품질에 대한 증거

앞 단계가 뒤 단계를 자동으로 증명하지 않는다.

---

## 14. 생성 package 구조

### 14.1 P0/P1

```text
<skill>/
├─ SKILL.md
├─ agents/openai.yaml
├─ references/        # 필요할 때만
├─ scripts/           # P1 helper가 있을 때만
├─ templates/         # 필요할 때만
├─ fixtures/          # 필요한 행동 증거
└─ .skill-rails/
   ├─ intent.json
   ├─ profile-decision.json
   └─ obligation-ledger.json
```

### 14.2 P2

```text
<skill>/
├─ SKILL.md                 # 얇은 loader
├─ spec.mjs                 # 행동 정본
├─ body.md                  # 판단과 이유
├─ collectors/
├─ templates/
├─ fixtures/
├─ references/
├─ agents/openai.yaml
├─ schemas/
├─ scripts/skill-rails/     # self-contained runtime
├─ .generated.json
└─ .skill-rails/
   ├─ intent.json
   ├─ profile-decision.json
   └─ obligation-ledger.json
```

P2 runtime은 생성 skill 안에 포함되므로 전역 설치기나 creator 저장소가 없어도 동작한다. Parser의 vendored source는 Acorn과 Acorn-walk 공식 배포 파일이며 각 license를 함께 포함한다. 그 외 validator, runtime, generator, trace 형식은 이 프로젝트의 독자 구현이다.

---

## 15. Codex와 Claude Code 지원

### 15.1 공통 package

Portable `SKILL.md`의 `name`과 `description`을 공통 정본으로 사용한다. 플랫폼별로 행동 body를 따로 만들지 않는다.

### 15.2 Skill root

- Codex: available-skill metadata가 제공한 절대 skill path
- Claude Code: `${CLAUDE_SKILL_DIR}`

Script는 사용자 project의 현재 directory가 아니라 active `SKILL.md`가 있는 directory를 `<skill-root>`로 사용한다.

### 15.3 설치 위치

- Codex project-local: `.agents/skills/<name>`
- Claude Code project-local: `.claude/skills/<name>`

개인·관리형·plugin 배포는 각 플랫폼이 지원할 수 있지만 이 release의 installer 범위는 아니다.

### 15.4 현재 확인된 지원

| 항목 | Codex | Claude Code |
| --- | --- | --- |
| Creator project-local discovery | verified | verified |
| Creator로 실제 skill 생성 | verified | verified |
| 생성 skill의 상대 플랫폼 설치 | verified | verified |
| 생성 skill explicit invocation | verified | verified |
| 생성 skill implicit positive trigger | verified | verified |
| 설치 상태 near-miss non-trigger | verified 1회 | unproven |
| absolute/skill-relative script invocation | verified | verified |
| read-only package + external state | verified-local | verified-local |
| long-session compaction recovery | unproven | unproven |
| hook 기반 effect interception | unsupported | unsupported |

---

## 16. 평가 원칙

### 16.1 깨끗한 forward test

- fresh context
- raw skill, task, input만 제공
- 의도한 fix, 이전 failure, expected answer를 숨김
- no-skill 또는 old-skill baseline
- positive trigger와 near-miss
- held-out state
- transcript, tool order, artifact, evidence를 분리 채점

### 16.2 활성화·준수·강제 분리

- **Activation**: 적절한 요청에서 skill을 선택했는가.
- **Adherence**: 선택한 뒤 결정과 형식을 따랐는가.
- **Enforcement**: 위반을 시스템이 실제로 막았는가.

현재 제품은 activation과 adherence를 개선하고 측정한다. Runtime restriction은 계획 검증이며 enforcement가 아니다.

### 16.3 주장 등급

- `verified`: 현재 artifact 또는 실행을 독립적으로 재확인
- `probabilistic`: 여러 fresh model run의 분포
- `buildable-unverified`: 구조는 맞지만 현재 실행 증거 없음
- `unproven`: 필요한 증거가 없거나 권위가 부족
- `unsupported`: 의도적으로 제공하지 않음

---

## 17. 현재 검증 증거

### 17.1 결정적 repository 검증

- `npm run lint`: pass
- 현재 환경 전체 test: 36/36 pass
- Node 20.20.2: 35/35 pass
- Node 22.23.2: 35/35 pass
- Node 24.18.0: 35/35 pass
- fresh P2 L0–L18: pass
- Windows path, non-ASCII, read-only package, external state, symlink/junction boundary, snapshot stale, trace authority, build transaction을 integration test로 확인

### 17.2 G0.5 동결 맹검

실행 전에 protocol, artifact, question, oracle, scorer를 동결하고 외부 fingerprint를 기록했다.

```text
sha256:10ddd0e38392a1a84209d9bb67a0b5c7f8fe35ae0ddd78990a220f00e8e761b6
```

저장소의 v1/v2 산출물은 실험 이력 보존용이며 어떤 현재 gate에도 사용하지 않는다. 현재 deterministic preflight와 empirical scorer는 모두 v3 artifact·oracle·protocol만 사용한다.

Codex 4회와 Claude 4회를 산문형 A와 구조화·lint 보조형 B로 나눠 같은 5개 seeded defect를 검토했다.

| Metric | 결과 |
| --- | --- |
| B seeded defect recall | 1.00 |
| B − A recall delta | +0.65 |
| B reviewer agreement | 1.00 |
| Agreement delta | +0.875 |
| B state-answer agreement | 1.00 |
| B reproducible ratio | 1.00 |
| Forbidden-effect attempt rate | 0 |
| B critical omissions | 0 |
| Product-hypothesis stop | false |

해석에는 제한이 있다. B의 inspection-only recall은 0.30이고 A 평균은 0.35였다. B의 전체 우위는 구조만 눈으로 읽어서 생긴 것이 아니라 구조화된 source, stable coordinates, deterministic lint를 함께 쓴 maintainer system의 우위다. 또한 두 Codex A 검토자는 의미상 defect를 언급했지만 동결된 canonical path 형식을 따르지 않아 strict scorer가 detection으로 세지 않았다. 이 결과를 “모든 구조화 문서가 모든 산문 읽기보다 우월하다”로 확대하지 않는다.

### 17.3 Codex cold creation

Codex는 fresh isolated 설정에서 P2 `evidence-gate` 한 개를 만들었다.

이 시험 skill에는 collector가 없고 evidence, approval, read-only 세 입력이 모두 `decided`다. 아래 결과는 agent가 공급한 값에 대한 결정적 분기 검증이지, 그 값의 진위를 runtime이 외부에서 관찰했다는 증거가 아니다.

- missing → BLOCK
- stale → WAIT
- current + approval absent → ASK
- current + approval granted → REPORT → DONE
- read-only → WRITE와 DISPATCH restrict
- lint L0–L18 pass
- mutation 20/20 killed
- scenario 7/7 × 200 repeat, mismatch 0
- format golden + 256 round trips + CR/LF rejection
- build/eval/runtime probes pass
- unresolved atom, scaffold, DEFERRED 0

### 17.4 Claude cold creation

Claude Code는 fresh project-local 설치에서 P1 `verified-note` 한 개를 만들었다.

- JSON facts를 exact Markdown으로 변환
- 순서, duplicate, punctuation, leading spaces 보존
- unknown key, invalid type, blank fact, CR/LF, malformed JSON, invalid UTF-8 거부
- helper tests 68/68 pass
- creator lint/build pass
- obligation 25/25 projected
- eval은 의도대로 structural pass, behavior `unproven`, `forward-test-required`

마지막 상태는 실패가 아니다. P1 구조 검증을 모델 행동 증거로 과장하지 않는 fail-closed 결과다.

### 17.5 Cross-author / cross-consumer

- Claude가 만든 P1을 Codex에 설치: 14/14 files byte-identical
- Codex가 만든 P2를 Claude에 설치: 51/51 files byte-identical
- Codex는 P1을 explicit/implicit로 발견하고 byte-exact helper output을 생성
- Codex near-miss 요약 요청에서는 helper를 호출하지 않음
- Claude는 P2를 explicit로 실행해 자신이 공급한 current/granted/read-only 값에 대한 DONE과 restrictions를 받음
- Claude는 P2를 implicit로 선택해 missing evidence를 BLOCK
- Claude의 REPORT 자기주장은 trace에 남았지만 독립 alignment는 외부 proof가 없어 `unproven`으로 유지

### 17.6 관찰된 harness 한계

- Codex가 사용자 MCP 설정을 상속한 첫 실행은 unrelated startup에서 정지했다. isolated 설정에서는 성공했다.
- 두 플랫폼 모두 Windows shell wrapper 문법을 몇 차례 잘못 구성했지만 실제 helper/runtime의 올바른 재호출은 성공했다.
- Claude CLI는 artifact와 report를 완성한 뒤 process 종료 응답이 늦었다.

이 현상은 기록하되 generated package의 동작 결함과 혼동하지 않는다.

---

## 18. V5 보존 및 변경 원장

### 18.1 그대로 보존한 핵심

- `spec.mjs` 행동 정본
- 정확한 14개 closed exports
- pure spec과 collector 분리
- `reads`, domain, UNKNOWN/NONE
- `acceptsUnknown`
- executable guard bypass
- RESTRICT와 effect conflict
- ordered effects와 terminal
- ownership
- stage evidence/done
- body 네 section
- READ_FIRST
- snapshot begin/end
- text projection과 JSON mirror
- enter/stage/simulate/role/record/align/resume 계열
- L0–L18
- positive, negative, mutation, judgment replay, model-tool probe
- 단일 obligation ledger 안의 migration atom과 source provenance
- authoring card와 obligation atomization
- 제품 가설을 먼저 반증하는 G0.5
- effect interception은 미래 또는 별도 범위

### 18.2 명시적으로 변경·확장한 항목

| V5 기준 | 현재 구현 | 이유와 보존 방식 |
| --- | --- | --- |
| cross-skill import/composition surface | 현재 `SPEC.profile="single"`과 `SPEC.imports=[]`만 허용하고 foreign body reference를 거부 | 사용자가 원한 단일-skill 경계를 지키고 activation·handoff drift를 만들지 않음; 현재 runtime에는 cross-skill resolver가 없음 |
| source-first lint, sandbox 아님 | positive-list AST + every-load L-fast + authoring L-structural + build-only L-full + verified same-process ESM | arbitrary code 신뢰를 줄이되 별도 interpreter로 의미를 복제하지 않음 |
| kernel v5 8줄 | kernel v6 8줄 | record/proof, evidence-backed skip, ASK/receipt 예외, enter-hash를 명시; 기존 8개 의미 위치 유지 |
| stage JSON 18 위치 | versioned typed Decision + fingerprint | 18 위치 대응표를 보존하고 stale/replay/proof 정보를 추가 |
| 기본 stage text | 같은 Decision의 compact guide | 모델이 전체 JSON/body를 읽지 않아도 현재 행동을 알게 함 |
| stage evidence 중심 | trace authority + alignment | “해야 함”과 “실제로 했음”을 분리; 증거 없으면 unproven |
| runtime state 위치가 암묵적 | skill root 밖 명시적 state directory | read-only install과 upgrade 안전 |
| repository runtime 공유 | generated P2마다 self-contained runtime | installer 없이 Codex/Claude에 독립 배포; runtime hash로 stale copy 탐지 |
| ko/en body pair 중심 | 기본은 single-language; `body_ko.md`가 함께 있을 때만 parity 검사; 없는 언어를 `--lang`으로 요청하면 fallback하지 않고 L7로 거부 | 범용 skill의 불필요한 이중 body와 잘못된 언어의 조용한 대체를 피함; 별도 pair-profile selector는 아직 없음 |
| context recovery와 interception의 경계가 약함 | enter-hash portable recovery와 effect interception을 분리 | 복구를 enforcement로 과장하지 않음 |
| 기존 gate 묶음 | G0.5를 구현보다 먼저 두고 authoring/runtime/platform/eval gate를 분리 | 가장 위험한 제품 가설을 먼저 중지할 수 있게 함 |
| 복잡 스킬 중심 | P0/P1/P2 최소 충분 profile | V5 복잡 구조를 축소하지 않고 단순 skill의 과설계를 막음 |

### 18.3 V5에서 의도적으로 제외한 capability

단일 skill의 행동 의미를 이루는 핵심은 삭제하지 않았다. 다만 V5 문법에 있던 cross-skill import/composition capability는 현재 구현하지 않았다. 현재 parser와 runtime은 `SPEC.profile="single"`, 빈 imports, 자기 skill의 body reference만 허용하며 foreign reference를 resolve하지 않는다.

이는 조용한 누락이 아니라 사용자가 확정한 제품 경계다. 여러 skill의 activation, handoff, 상태 전달을 추가하면 해결하려던 drift surface가 다시 늘어나기 때문이다. 향후 필요해도 현재 single profile을 몰래 넓히지 말고 별도 profile과 독립 검증으로 설계해야 한다. 단일 spec 내부의 stage, role, table, template, local helper 공유는 제한하지 않는다.

V5 의미를 바꾸는 새 수정은 반드시 이 표에 다음 네 가지를 추가해야 한다.

1. 무엇이 바뀌는가
2. 왜 바꾸는가
3. 기존 의미를 어떻게 보존하거나 의도적으로 버리는가
4. 동등성 또는 rollback을 어떤 test로 확인하는가

---

## 19. 채택한 보편적 설계 패턴과 독창성 경계

이 프로젝트는 특정 외부 프로젝트의 문법, source code, CLI, wire format을 복사하지 않았다. 다음은 고신뢰 도구에서 보편적으로 유효한 패턴을 V5 목적에 맞게 독자 구현한 것이다.

- 얇은 loader와 progressive disclosure
- intent-first authoring
- 가장 작은 충분 자유도 선택
- stable ID와 reference closure
- deterministic Decision envelope
- 필요한 reference/template의 조건부 제공
- trace와 evidence authority
- alignment와 `unproven` 판정
- source provenance와 conservative migration
- clean baseline, blind review, near-miss, held-out evaluation
- atomic build와 generated-file ownership

의도적으로 채택하지 않은 것:

- YAML을 손으로 관리하는 두 번째 행동 정본
- 고정 predicate만 허용하는 별도 대형 DSL
- multi-skill router와 composition
- marketplace·installer·durable executor
- 범용 security boundary
- 외부 runtime 의존

생성된 P2 runtime에 직접 vendoring하는 제3자 source는 JavaScript AST parsing을 위한 Acorn과 Acorn-walk 배포 파일뿐이며, 원본 license를 그대로 보존한다. Creator repository의 개발·평가 환경은 두 parser package와 G0.5 JSON Schema 검증용 Ajv를 dev dependency로 사용한다. 이를 제외한 제품 logic은 V5와 이 저장소의 설계에 따라 작성했다.

---

## 20. 대안 역검증

### 20.1 산문을 더 잘 쓰면 충분한가

단순 P0에는 충분할 수 있다. 그러나 상태·순서·증거·형식이 반복되는 대형 skill에서는 유지보수 주소와 기계 검증이 없다. 출발 문제를 해결하지 못한다.

### 20.2 모든 것을 구조 데이터로 만들면 더 안전한가

Shape와 simple table에는 유리하다. 복잡 predicate는 표현 부족 또는 escape를 만들고, 판단을 억지로 구조화하면 거짓 결정성이 생긴다. 그래서 source는 제한된 ESM, 판단은 body, projection은 JSON schema로 분리했다.

### 20.3 별도 typed interpreter가 더 안전한가

사용자 code를 runtime에서 실행하지 않는 장점이 있지만 source semantics와 interpreter semantics가 두 군데 생긴다. 현재 positive-list + L-fast/L-full로 위험을 통제할 수 있었고, same-process direct evaluation의 결정성과 속도도 threshold를 통과했다. 별도 interpreter는 현재 필요하지 않다.

### 20.4 여러 skill로 나누면 context가 줄지 않는가

일부 줄지만 activation, handoff, 상태 전달이라는 새 probabilistic gate가 생긴다. 목표는 하나의 복잡 skill 내부의 drift를 줄이는 것이다. 따라서 단일 package 안에서 필요한 section만 제공한다.

### 20.5 처음부터 hook으로 막으면 더 강하지 않은가

잘못된 semantics를 강하게 집행할 위험이 있다. 먼저 Decision과 evidence model을 검증하고, interception은 별도 enforcement layer로만 고려한다. 현재 runtime은 그 권한을 주장하지 않는다.

### 20.6 코드가 너무 경직되지 않았는가

코드는 긴 prose를 모두 옮기는 장소가 아니다. 기계 판정 가능한 반복 규칙만 코드로 소유하고, judgment는 body에 남긴다. P0/P1/P2, closed exports, stable IDs, generated/runtime 분리는 책임을 좁히기 위한 경계다. 새 failure 하나마다 special case를 덧붙이지 말고 기존 책임의 누락인지 먼저 판단한다.

---

## 21. 주요 실패 시나리오와 대응

| 실패 | 현재 대응 | 남는 한계 |
| --- | --- | --- |
| AI가 runtime을 호출하지 않음 | 얇은 loader, explicit first action, enter-hash, model probe | hook 전에는 강제 불가 |
| Collector가 값을 못 읽음 | UNKNOWN으로 멈춤 | collector 자체 호출 누락은 activation 문제 |
| 수집 중 project가 바뀜 | begin/end snapshot mismatch → stale | snapshot basis가 너무 좁으면 설계 결함 |
| RESTRICT와 effect 충돌 | Decision 전 BLOCK | 이후 tool call interception은 없음 |
| Agent가 완료했다고 주장 | agent_claimed, proof 없으면 unproven | trusted adapter가 없으면 verified 불가 |
| Installed runtime 변조 | manifest/runtime/spec/validator hash mismatch | 공격자가 정본과 manifest를 모두 rebuild하는 위협은 별도 신뢰 문제 |
| Body가 행동 정본으로 증식 | L8 shadow-canon 검사 | 의미 paraphrase 전부를 자동 탐지할 수는 없음 |
| 마이그레이션 의미 누락 | atom ledger와 reverse provenance | ambiguous atom은 사람/강한 모델 판단 필요 |
| 단순 skill 과설계 | P0/P1 우선, auto reason 기록 | 잘못된 intent가 profile 신호를 왜곡할 수 있음 |
| Trace 과대 해석 | authority와 alignment | harness가 잘못된 authority를 부여하면 경계 약화 |
| Runtime 복제 stale | runtime hash와 rebuild | 배포 자동 upgrade는 현재 없음 |
| Windows shell 오류 | 절대 path와 quoted command, deterministic helper | agent가 wrapper syntax를 틀릴 수 있음 |

---

## 22. 공개 명령

### 22.1 Creator

```text
node <skill-root>/scripts/init.mjs --intent <intent.json> --out <folder> [--profile auto|p0|p1|p2]
node <skill-root>/scripts/migrate.mjs --source <old-skill> --out <folder>
node <skill-root>/scripts/maintain.mjs --skill <folder> --change <change.json>
node <skill-root>/scripts/lint.mjs --skill <folder> [--full]
node <skill-root>/scripts/build.mjs --skill <folder>
node <skill-root>/scripts/eval.mjs --skill <folder>
```

Repository 자체:

```text
npm run lint
npm test
npm run eval
npm run verify
```

### 22.2 생성 P2 runtime

```text
node <generated-skill>/scripts/skill-rails/run.mjs enter --skill <generated-skill>
node <generated-skill>/scripts/skill-rails/run.mjs stage --skill <generated-skill> --project <project> [--trace-dir <external-state-dir> --run-id <id>] [--judged field=value] [--decided field=value]
node <generated-skill>/scripts/skill-rails/run.mjs simulate --skill <generated-skill> --fixture <fixture>
node <generated-skill>/scripts/skill-rails/run.mjs render --skill <generated-skill>
node <generated-skill>/scripts/skill-rails/run.mjs role --skill <generated-skill> --role <id>
node <generated-skill>/scripts/skill-rails/run.mjs lint --skill <generated-skill> [--fast]
node <generated-skill>/scripts/skill-rails/run.mjs record --skill <generated-skill> --decision <stage-result.json> --type <effect_claimed|proof_recorded|receipt_recorded> [--data <json>]
node <generated-skill>/scripts/skill-rails/run.mjs record --skill <generated-skill> --decision <stage-result.json> --type artifact_verified --artifact <path> --project <project>
node <generated-skill>/scripts/skill-rails/run.mjs align --skill <generated-skill> --decision <stage-result.json> [--trace <trace.jsonl>]
node <generated-skill>/scripts/skill-rails/run.mjs resume --skill <generated-skill> --trace <trace.jsonl> --project <project>
```

지원하지 않는 flag나 입력 source는 추정해서 보완하지 않고 진단과 함께 거부한다.

---

## 23. 현재 완료 상태와 남은 검증 경계

### 23.1 구현 완료

- Creator thin skill과 authoring references
- P0/P1/P2 profile selection
- intent/ledger scaffold와 P2 authoring-card template
- conservative migration
- stable-ID maintenance와 semantic diff
- P2 V5 validator L0–L18
- positive-list AST와 two-level validation
- deterministic evaluator와 compact guide
- Decision/Trace schemas
- trace store, authority, alignment, resume
- transactional deterministic build와 manifest
- self-contained P2 package
- Codex/Claude adapters
- repository tests와 G0.5 scorer

### 23.2 현재 evidence로 완료된 사용성

- Codex와 Claude에서 creator 발견
- 양쪽에서 서로 다른 profile의 실제 skill 생성
- 상대 플랫폼에 byte-identical 설치
- 상대 플랫폼에서 explicit/implicit 사용
- P2 fail-closed decision과 unproven evidence boundary

### 23.3 아직 일반화하면 안 되는 주장

- 30k+ token 또는 실제 compaction 뒤 critical omission 0
- 여러 모델 버전에 대한 통계적 trigger precision
- Claude 설치 상태 near-miss non-trigger
- Linux/macOS filesystem 통합
- global install/plugin/marketplace
- 실제 대형 기존 skill의 포팅 완료
- 생성 skill의 task-output이 모든 baseline보다 우월
- tool-call enforcement

이 항목들은 숨은 미완성 code marker가 아니라 별도 empirical scope다. 지원을 주장하려면 fresh evidence를 추가한다.

---

## 24. 새 AI의 작업 시작 규칙

새 세션은 다음 순서로 시작한다.

1. 이 문서와 root `SKILL.md`를 읽는다.
2. 요청이 생성, 마이그레이션, 유지보수, 진단, 검증 중 무엇인지 분류한다.
3. 해당 작업에 필요한 `references/`만 읽는다.
4. README 생성·수정 요청이면 `references/readme-authoring.md`를 읽고, 사용자 지시를 우선하면서 문제·구체적인 처리 방식·결과가 처음부터 보이게 작성한다.
5. 현재 git 상태를 확인하고 사용자 변경을 보존한다.
6. 다른 project는 read-only로 취급하고 승인된 destination만 수정한다.
7. profile을 길이가 아니라 행동 신호로 선택한다.
8. intent와 obligation을 대화가 아니라 디스크에 기록한다.
9. generated file을 직접 수정하지 않는다.
10. 작은 patch를 누적하기 전에 책임 경계의 근본 결함인지 판단한다.
11. 변경 후 lint, test, eval, fresh representative build를 실행한다.
12. deterministic claim, model behavior claim, output-quality claim을 분리한다.
13. 증거가 없으면 `unproven`이라고 쓴다.
14. V5 변경이면 이 문서의 원장을 먼저 갱신한다.
15. blocking finding만 root cause로 수정하고 같은 검수자에게 재검증한다.

### 24.1 코드 증가 규칙

새 코드는 다음 질문에 모두 답할 수 있을 때만 추가한다.

- 재현된 어떤 failure를 막는가
- 기존 어느 module의 책임인가
- 일반 invariant인가, 한 fixture만 위한 special case인가
- 삭제하거나 단순화할 기존 코드가 있는가
- negative test가 실제로 이 code 없이 실패하는가
- AI 작성자와 소비자 중 누구의 failure를 줄이는가

답이 불명확하면 코드를 추가하지 않는다.

### 24.2 변경 완료 체크리스트

- [ ] 하나의 creator / 하나의 generated skill 경계 유지
- [ ] V5 정본과 body 판단 경계 유지
- [ ] UNKNOWN·snapshot·evidence fail-closed 유지
- [ ] 현재 context만 제공하는 progressive read 유지
- [ ] P0/P1에 P2 복잡성 누수 없음
- [ ] generated artifact ownership과 atomic build 유지
- [ ] Codex와 Claude 공통 core 유지
- [ ] creator usability와 generated-skill usability 모두 검토
- [ ] 결과 품질 주장을 구조 검증과 혼동하지 않음
- [ ] 외부 project 코드·문법·wire format 복사 없음
- [ ] 전체 회귀검증과 대표 cold path 통과
- [ ] 문서의 수치·상태가 현재 evidence와 일치

---

## 25. 최종 기준 문장

Skill Rails의 목적은 코드량을 늘리거나 모든 판단을 기계화하는 것이 아니다. 목적은 **기계가 확실히 지킬 수 있는 것은 기계적 계약으로 만들고, 기계가 확실히 판단할 수 없는 것은 짧고 주소 가능한 판단 기준으로 남기며, 둘 사이의 경계를 증거로 검증하는 것**이다.

좋은 변경은 특정 실패 하나를 가리는 patch가 아니라 다음 전체 결과를 개선한다.

- AI 작성자가 의도를 잃지 않고 skill을 만든다.
- AI 유지보수자가 stable ID와 evidence로 의미를 바꾼다.
- AI 소비자가 전체 산문 대신 현재 Decision만 읽는다.
- 생성된 skill이 Codex와 Claude에서 같은 핵심 의미로 동작한다.
- 증명되지 않은 성공은 성공으로 보고되지 않는다.

이 기준을 만족하지 못하는 기능 확장, multi-skill 분해, hook 강제, 새 DSL, 문서 증식은 현재 제품의 발전이 아니라 방향 이탈로 간주한다.
