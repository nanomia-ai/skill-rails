# Skill Rails 제품·설계 정본

문서 상태: 현재 제품 목적과 안정적인 설계 경계의 정본

기준일: 2026-08-29 KST

핵심 범위: 에이전트에 종속되지 않는 스킬 작성·유지보수·검증 구조

이 문서는 Skill Rails를 처음 보는 사람과 AI가 별도 대화 기록 없이도 다음을 이해하도록 만든 제품·설계 문서다.

- 왜 이 제품이 필요한가
- 무엇을 만들었고 무엇을 만들지 않았는가
- AI가 이 제작 스킬로 스킬을 만드는 방법
- 생성된 스킬이 실행될 때 무엇이 일어나는가
- 어떤 불변조건과 판단 경계를 지켜야 하는가

정확한 구현 범위, 검증 수치, adapter 지원, P2 version-5 호환 변경 원장은 [구현·검증 기록](implementation-verification_ko.md)이 소유한다. 여기서 version 5는 현재 `SPEC.version` 계보의 호환 기준선이며 package release version이나 별도 제품 세대를 뜻하지 않는다. 다음 세션의 마지막 작업 위치와 이어서 할 일은 [유지보수 상태](maintenance-status_ko.md)가 소유한다. 최초 구현 당시의 통합 기획 원문은 Git commit `4929b5b`에 보존하며 평상시 AI 진입 경로에는 넣지 않는다.

이 문서에는 작업 chronology나 매 실행 수치를 누적하지 않는다. 현재 코드와 설계가 충돌하면 동작을 추정하지 말고 검증을 중단한 뒤 정본 또는 구현을 같은 변경에서 정합시킨다.

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
7. File-based host마다 행동 정본을 복제하지 않고 같은 단일 스킬 패키지를 사용한다.
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
- P2 version-5 호환 계약의 핵심 변경

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
22. 현재 또는 이후의 모든 adapter는 동일 portable core를 공유한다.
23. P2 version-5 호환 계약의 핵심을 삭제·축소·변경하면 [구현·검증 기록](implementation-verification_ko.md)의 변경 원장에 이유와 동등성 검사를 먼저 기록한다.

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
   └─ P2: version-5-compatible spec + body + collector + fixture + embedded runtime
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
| P2 | 상태 의존 행동 또는 비가역 경계가 있거나, exact format이 상태 의존 행동과 결합됨 | version-5-compatible `spec.mjs` + body + collectors + fixtures + self-contained runtime | 구조·결정·trace를 강하게 검증, tool-call 강제는 하지 않음 |

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

### 7.4 P0/P1 조건부 판단 산문의 점진 읽기

Profile과 문서 로딩 방식은 서로 다른 축이다. 판단 산문이 길다는 이유로 P0를 P1이나 P2로 올리지 않는다. 대신 모든 호출에 필요한 판단은 `judgment_points`의 문자열로 남겨 `SKILL.md`에 두고, 특정 상황에서만 필요한 하나의 일관된 판단 주제는 `{ id, when, points }`로 기록할 수 있다.

조건부 주제가 하나라도 있으면 생성기는 다음 구조를 만든다.

```text
SKILL.md
  └─ references/guidance-index.md
       ├─ when A → references/guidance/<stable-id-a>.md
       └─ when B → references/guidance/<stable-id-b>.md
```

소비 AI에는 먼저 작은 index를 읽고 현재 요청에 맞는 주제만 열도록 지시한다. `id`는 kebab-case stable ID, `when`은 한 줄 조건, `points`는 원문 의무 배열이다. Index는 조건만 소유하고 주제 파일은 판단 산문만 소유한다. 같은 상세 산문을 `SKILL.md`나 index에 복제하지 않는다.

이 기능은 P2 runtime의 축소판이 아니다. 조건 매칭은 여전히 모델 판단이며 host 권한을 강제하지 않는다. 비가역 경계, 상태 의존 의무, exact format, P1 helper의 fail-closed 정지는 선택적 문서 뒤로 보내지 않고 항상 읽는 `SKILL.md`에 남긴다. 독립된 `when`을 말할 수 없는 산문은 길이만 보고 기계적으로 분할하지 않는다.

이번 경계는 생성된 P0/P1의 소비 산문만 다룬다. 보존 목적의 migration atom은 계속 하나의 obligation ledger에 남으며, 큰 migration ledger를 점진 조회하는 기능을 구현했다고 주장하지 않는다. 다섯 topic 중 하나가 일치하는 fresh 소비 실측은 통과했지만, index 행 수가 매우 많은 실제 대형 skill의 routing recall, 다중 일치, near-miss, 장기 compaction에서의 context 절감은 계속 `unproven`이다.

---

## 8. 정본과 소유권

### 8.1 Creator 정본

설치 가능한 단일 skill package의 경계는 `skills/skill-rails/`다. 이 디렉터리 안에서는 다음 자산이 creator 정본이다.

- `skills/skill-rails/SKILL.md`: 선택과 authoring 진입 절차
- `skills/skill-rails/references/`: 설치된 Skill Rails가 작업 종류에 따라 읽는 작성·P2 계약·평가·마이그레이션 규칙
- `skills/skill-rails/scripts/lib/`: profile, generator, obligation, migration, maintenance, semantic diff, build
- `skills/skill-rails/scripts/runtime/`: P2 validator, evaluator, guide, trace, alignment 원본
- `skills/skill-rails/schemas/`: 공개 Decision과 Trace Event 계약
- `skills/skill-rails/templates/`: creator가 만드는 초기 authoring 자산

Repository root의 `fixtures/`, `tests/`, `evals/`, `docs/`는 공개 source와 반증·검증 증거지만 설치 package에는 속하지 않는다. 따라서 GitHub에서 함께 유지하면서도 skill discovery와 설치 payload에는 노출하지 않는다.

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

- `.gitattributes` (`* -text`와 마지막 newline; P2 package 전체 byte 보존)
- `SKILL.md`
- `agents/openai.yaml`
- `schemas/`
- `scripts/skill-rails/`
- `.generated.json`

`.generated.json`에 기록된 파일을 손으로 고치지 않는다. 정본을 수정하고 build한다. Package-root `.gitattributes`도 manifest가 소유하는 생성물이며 Git newline 변환을 끄므로, manifest가 봉인한 실제 byte가 checkout 설정과 무관하게 보존된다. 기존의 비정본 `.gitattributes`는 자동 병합하거나 덮어쓰지 않고 충돌로 멈추며, 기존 package는 명시적 rebuild와 ownership transfer를 거쳐야 한다. Build는 임시 staging directory에서 전체를 검증한 뒤 manifest를 마지막에 기록하고 원자적으로 교체한다. 실패한 build가 부분 생성물을 남기지 않는다.

---

## 9. P2 행동 모델과 version-5 호환 기준선

P2는 상태·승인·증거·순서·비가역 경계에 따라 다음 행동이 달라질 때만 사용한다. `spec.mjs`가 행동의 유일한 정본이고, body는 판단 기준과 이유만 소유한다. Collector가 관찰한 값, 모델이나 사람의 판단, 사용자의 구조화 결정은 서로 다른 출처이며 증거 권위도 같지 않다.

Guard, stage, table row와 ordered effect를 deterministic하게 계산하되 runtime은 domain 작업이나 host tool call을 대신 실행하지 않는다. `UNKNOWN`을 false로 바꾸거나 agent claim을 verified evidence로 올리지 않으며, unresolved obligation과 `DEFERRED`는 release를 막는다.

정확한 closed exports, observation 값, 평가 순서, body heading, template와 validation 규칙은 [P2 계약](../skills/skill-rails/references/p2-contract.md)이 단독으로 소유한다. 이 제품 문서에는 그 계약을 다시 열거하지 않는다.

---

## 10. Runtime은 왜 존재하는가

Runtime은 AI 대신 일을 수행하는 agent runtime이 아니다. 목적은 **모델이 산문 전체를 읽고 현재 행동을 매번 재해석하지 않도록, 검증된 정본에서 지금 필요한 작은 결정을 계산하고 그 결정의 증거를 보존하는 것**이다.

### 10.1 하는 일

1. `spec.mjs`를 import하기 전에 허용 AST와 source 구조를 검사한다.
2. collector·judged·decided 입력을 하나의 snapshot에 묶는다.
3. guard, stage, table row, ordered effects를 결정적으로 계산한다.
4. 선택된 stage와 멈춘 guard가 읽는 정적 artifact를 `ARTIFACTS.readers`에서 투영해 현재 Decision과 compact guide를 만든다.
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

Decision은 현재 run의 작고 versioned한 계약이다. Snapshot, guard와 restrict, 현재 stage와 row, ordered effects, 선택된 stage/guard의 정적 `stage_artifacts`, 필요한 format·template·body, proof와 reinvoke 조건을 같은 계산 결과로 묶는다. `ARTIFACTS`가 path·writer·template의 단일 정본이고 `readers`가 `stage.<id>` 또는 `guard.<id>` 소비를 선언하므로, runtime은 현재 분기에 필요한 artifact만 투영한다. Version-5 기준선의 공개 위치는 삭제하지 않고 typed grouping으로 보존하며 replay와 evidence 경계에 필요한 fingerprint와 assurance를 추가한다. 정확한 위치 대응은 [구현·검증 기록](implementation-verification_ko.md)의 P2 호환 원장이 소유한다.

### 11.2 Compact guide

Guide는 Decision의 model-facing projection이다. 모델이 JSON 내부를 다시 해석하거나 전체 body를 열지 않도록 현재 사실·중지 이유·`stage_artifacts`·ordered effects·proof·body section을 짧게 보여준다. JSON과 guide는 같은 계산 결과에서 생성되며 golden test로 동등성을 확인한다.

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

개별 요구사항과 aggregate의 현재 closed vocabulary는 [평가 계약](../skills/skill-rails/references/evaluation.md)이 소유한다. 이 설계의 안정 경계는 증거가 없거나 권위가 부족한 요구사항을 성공으로 승격하지 않는다는 것이다.

성공 문장이 trace에 있어도 요구 proof가 없으면 `unproven`이다. agent가 effect를 수행했다고 기록했지만 외부 관찰이 없으면 그 claim은 보존하되 verified로 바꾸지 않는다.

---

## 12. 검증 경계: L-fast, L-structural, L-full

세 검증 단계는 속도와 evidence 수준을 분리한다. L-fast는 매 import 전에 source를 검사하고 manifest를 권위로 신뢰하지 않는다. L-structural은 빠른 author feedback을 위해 isolated import와 구조 검사를 더한다. L-full은 build에서 fixture, mutation, determinism, format과 manifest evidence까지 확인한다.

Runtime은 validator가 허용한 제한된 ESM만 평가하며 별도 interpreter로 정본 의미를 복제하지 않는다. 정확한 validation contract는 [P2 계약](../skills/skill-rails/references/p2-contract.md), L0–L18의 현재 구현 대응은 [구현·검증 기록](implementation-verification_ko.md)이 소유한다.

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
3. P2는 `templates/authoring-card.md`를 작업 package에 복사해 observation, judgment, owner, artifact, terminal을 채운 뒤 승인된 결정을 spec과 ledger에 투영. File artifact는 `ARTIFACTS` 한 곳에서 path·writer·template을 소유하고 `readers`에 실제 `stage.<id>`/`guard.<id>` 소비자를 선언하며, collector와 e2e host도 이 registry를 재사용한다. 비-file observation에는 의미 없는 null artifact를 만들지 않는다.
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

실제 생성 명령과 작업별 reference 진입은 설치 package의 [`SKILL.md`](../skills/skill-rails/SKILL.md)가 조건부로 안내한다.

P1/P2 output은 안전하게 실패하는 scaffold다. marker, unresolved atom, P2 DEFERRED를 사용자별 의미와 test로 교체하기 전에는 완성품이 아니다.

### 13.5 보수적 마이그레이션

실제 마이그레이션 명령과 절차는 설치 package의 [`SKILL.md`](../skills/skill-rails/SKILL.md)가 조건부로 안내한다.

원본 project를 수정하지 않는다. 승인된 destination에 복사·생성한다. Markdown source는 parser-backed semantic atom(frontmatter metadata, heading/context, paragraph, nested list item, table row, code/HTML block, parser-consumed reference definition)으로 보존하고, Markdown 이외 regular source file은 파일 하나당 하나의 `file-text` 또는 `file-opaque` review atom으로 inventory한다. UTF-8 text는 exact raw text와 byte hash를 남기고, opaque file은 내용을 덤프하지 않고 byte hash·byte count와 preserve/map/dispose 명시 지시만 남긴다. exact format → observation → stage/guard/effect 순으로 옮기며 judgment는 body에 남긴다.

Migration atom은 별도 원장에 쓰지 않고 `.skill-rails/obligation-ledger.json`에 exact source path/span/hash, raw text 또는 opaque instruction, context와 함께 추가한다. 모든 migration atom은 명시적으로 처리할 때까지 `review-required`이므로 P2의 기존 L16 gate가 intent atom과 migration atom을 같은 릴리스 경계에서 검사한다.

다음이면 중단한다.

- consequence가 높은데 confidence가 낮다.
- source atom의 방어 가능한 target이 없다.
- 새 target의 provenance가 없다.
- old/new scenario가 승인 없이 달라진다.

원문 삭제는 coverage, reverse provenance, critical review-required 0, old/new 비교, 별도 승인 후에만 한다.

### 13.6 유지보수

실제 유지보수 명령과 change envelope는 설치 package의 [`SKILL.md`](../skills/skill-rails/SKILL.md)가 조건부로 안내한다.

Intent-backed P0/P1은 `update-intent` operation만 허용한다. 현재 intent에서 생성되는 `SKILL.md`, adapter, guidance index, topic과 실제 파일이 다르면 덮어쓰지 않고 중단한다. Auto-profiled package에서 갱신된 intent가 다른 profile을 선택하면 명시적 재생성을 요구하고, explicit profile 결정은 그대로 고정해 감사 가능하게 남긴다. 정상 유지보수는 intent, ledger, projection, eval case를 원자적으로 갱신하고 별도 소유 helper와 파일은 보존한다. P2는 문장 위치가 아니라 stable ID를 주소로 사용하며, 변경 전후 predicate, stage, row, body, template, owner, fixture, generated artifact의 line diff와 semantic impact report를 함께 본다. whole-file 교체는 등록된 typed artifact(`spec.mjs`, `collectors/index.mjs`, `references/` 아래 기존 파일)에만 현재 hash를 요구하며 허용하고, 원자적 install은 package root를 단독 소유한 하나의 authorized writer를 전제한다. 외부 process의 동시 쓰기에 대한 잠금이나 보존은 제공하지 않으며, 그 경계는 성공이 아니라 `UNPROVEN`이다.

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

P2 runtime은 생성 skill 안에 포함되므로 전역 설치기나 creator 저장소가 없어도 동작한다. P2 parser의 vendored source는 Acorn과 Acorn-walk 공식 배포 파일이며 각 license를 함께 포함한다. Creator의 migration parser도 공식 `markdown-it` standalone 배포물과 그 bundle에 포함된 dependency notice를 package 안에 둔다. 따라서 Node.js가 있으면 설치된 creator의 정상 작업 경로에서 별도 package install이 필요 없다. Vendor artifact는 고정된 sync script와 `vendor:check`가 소유하며 손으로 편집하지 않는다. 그 외 validator, runtime, generator, trace 형식은 이 프로젝트의 독자 구현이다.

---

## 15. Portable 설치와 현재 adapter

### 15.1 공통 package

Portable `SKILL.md`의 `name`과 `description`을 공통 정본으로 사용한다. 플랫폼별로 행동 body를 따로 만들지 않는다.

File-based installer는 이 단일 package를 지원하는 host의 발견 경로에 copy 또는 symlink할 수 있다. Installer는 runtime이나 행동 정본이 아니며 skill body를 변환하지 않는다. Node.js 20 이상은 Skill Rails의 실행 전제다. 현재 `skills` installer 자체가 더 높은 Node 버전을 요구하는 경우에는 manual project-local clone을 사용해도 같은 package가 동작해야 한다.

### 15.2 Skill root

- Codex: available-skill metadata가 제공한 절대 skill path
- Claude Code: `${CLAUDE_SKILL_DIR}`
- 기타 file-based host: host가 발견한 active `SKILL.md`의 directory

Script는 사용자 project의 현재 directory가 아니라 active `SKILL.md`가 있는 directory를 `<skill-root>`로 사용한다. Host가 stable skill location을 제공하지 않으면 cwd에서 추측하지 않고 중단한다.

### 15.3 설치 경계

범용 설치 명령은 `npx skills@latest add nanomia-ai/skill-rails`이며, 정확한 target directory와 copy/symlink 방식은 installer가 소유한다. Manual 설치에서는 host가 정한 project-local discovery directory에 같은 package를 둔다. 설치된 정상 creator 명령은 package-local dependency만 사용하며 `npm ci`를 요구하지 않는다. Repository 자체의 test와 frozen self-evaluation을 실행하는 개발 경로는 dev dependency 설치 뒤 검증한다.

공식 Agent Skills 관례에 맞춘 `skills/skill-rails/`가 유일한 설치 경계다. 범용 installer에는 repository별 include/exclude manifest가 없으므로 root에 `SKILL.md`를 두지 않는다. Installer는 선택된 skill directory만 재귀 복사하고, repository root의 maintainer 문서·tests·evals·fixtures는 GitHub에서 계속 공개하되 설치 payload에서는 제외한다. 설치 package 안에는 discoverable `SKILL.md`가 정확히 하나뿐이며, fixture를 숨기기 위한 별도 예외 규칙은 두지 않는다.

Claude plugin, marketplace manifest, hook은 단순 설치를 위해 추가하지 않는다. Managed marketplace는 package 구조, update, submission, 실제 host 검증을 별도로 소유해야 하는 후속 distribution 제품이다.

### 15.4 지원 주장의 소유권

Codex와 Claude Code는 현재 fresh 행동 증거가 있는 project-local adapter지만 제품의 영구 플랫폼 경계는 아니다. 범용 installer가 다른 host directory에 package를 배치했다는 구조 증거와, 그 host의 AI가 trigger·skill-root·task output을 올바르게 처리했다는 행동 증거를 구분한다. 정확히 어떤 흐름을 실행했고 무엇이 아직 `unproven`인지에 대한 최신 표는 [구현·검증 기록](implementation-verification_ko.md)이 소유한다. 새 adapter를 추가해도 portable core를 복제하거나 이 문서의 제품 정체성을 특정 플랫폼으로 바꾸지 않는다.

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

## 17. 검증 기록의 경계

정확한 test 수, Node별 실행 범위, adapter 지원 표, G0.5 결과, fresh creation과 cross-consumption evidence는 [구현·검증 기록](implementation-verification_ko.md)이 소유한다.

이 제품 설계 문서는 evidence를 성공 문구로 복제하지 않고 다음 원칙만 고정한다.

- 구조 검증, model 행동, 산출물 품질을 서로 다른 주장으로 다룬다.
- 과거 작은 suite의 통과를 최신 큰 suite의 결과로 확대하지 않는다.
- 한 개의 fresh positive 사례를 trigger precision이나 장기 context 절감의 일반 증거로 확대하지 않는다.
- 증거가 없거나 현재 artifact로 재확인되지 않으면 `unproven`이다.
- 새로운 지원 주장은 재현 가능한 명령, artifact, transcript 또는 독립 proof와 함께 구현·검증 기록을 갱신해야 한다.

---

## 18. P2 version-5 호환 변경 기록의 경계

P2의 현재 행동 계약은 [P2 계약](../skills/skill-rails/references/p2-contract.md)과 코드가 소유한다. version-5 기준선에서 보존한 의미, 명시적으로 확장한 항목, 의도적으로 제외한 cross-skill capability와 그 검증 근거는 [구현·검증 기록](implementation-verification_ko.md)의 변경 원장이 소유한다.

변경 원장이 요구하는 내용과 evidence 형식은 한 곳에서만 유지한다. 그 기록 없이 P2 호환 계약을 축소하거나 기계 판정 가능한 규칙을 산문으로 되돌리지 않는다.

---

## 19. 채택한 보편적 설계 패턴과 독창성 경계

이 프로젝트는 특정 외부 프로젝트의 문법, source code, CLI, wire format을 복사하지 않았다. 다음은 고신뢰 도구에서 보편적으로 유효한 패턴을 Skill Rails의 목적과 P2 호환 경계에 맞게 독자 구현한 것이다.

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

생성된 P2 runtime에 직접 vendoring하는 제3자 source는 JavaScript AST parsing을 위한 Acorn과 Acorn-walk 배포 파일뿐이며, 원본 license를 그대로 보존한다. Creator repository는 Acorn·Acorn-walk, migration 입력을 구조적으로 나누는 Markdown-it, G0.5 JSON Schema 검증용 Ajv를 dev dependency로 사용한다. Markdown-it은 creator의 migration 경로에서만 실행되며 생성된 skill runtime에는 포함되지 않는다. 이를 제외한 제품 logic은 P2 version-5 호환 기준선과 이 저장소의 설계에 따라 작성했다.

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
| P0/P1의 조건부 산문을 모두 읽음 | 명시적 `{ id, when, points }` topic, 작은 index, orphan·누락·중복 lint | 모델이 올바른 `when`을 실제로 선택하는지는 fresh forward test 필요 |
| Trace 과대 해석 | authority와 alignment | harness가 잘못된 authority를 부여하면 경계 약화 |
| Runtime 복제 stale | runtime hash와 rebuild | 배포 자동 upgrade는 현재 없음 |
| Windows shell 오류 | 절대 path와 quoted command, deterministic helper | agent가 wrapper syntax를 틀릴 수 있음 |

---

## 22. 공개 명령

Creator 명령, 작업 순서와 작업별 operational reference는 설치 package의 [`SKILL.md`](../skills/skill-rails/SKILL.md)가 조건부로 안내한다. Repository 검증 명령은 `package.json`이 소유한다. 사람을 위한 README를 maintainer 진입점이나 검증 정본으로 사용하지 않고, 이 제품 설계 문서에 CLI 목록이나 두 번째 라우팅 표를 복제하지 않는다.

---

## 23. 새 AI의 작업 시작 규칙

Repository 유지보수를 이어받는 새 세션은 `AGENTS.md`, [유지보수 상태](maintenance-status_ko.md)와 실제 git 상태를 먼저 확인한다. Host가 `CLAUDE.md`를 제공하면 그 파일은 `AGENTS.md`로 연결하는 stub일 뿐 별도 정본이 아니다. 이 전체 제품·설계 정본은 제품 경계나 owning abstraction을 판단할 때만 읽고, skill 생성·유지보수 작업은 설치 package의 `skills/skill-rails/SKILL.md`가 제공하는 조건부 라우팅을 따른다.

정확한 새 세션 문서 순서는 `AGENTS.md`가 소유하고, 유지보수 상태 문서는 현재 기준선과 continuation 값만 소유한다. 어느 문서에도 모든 세션의 최근 작업을 누적하지 않는다.

### 23.1 코드 증가 규칙

새 코드는 다음 질문에 모두 답할 수 있을 때만 추가한다.

- 재현된 어떤 failure를 막는가
- 기존 어느 module의 책임인가
- 일반 invariant인가, 한 fixture만 위한 special case인가
- 삭제하거나 단순화할 기존 코드가 있는가
- negative test가 실제로 이 code 없이 실패하는가
- AI 작성자와 소비자 중 누구의 failure를 줄이는가

답이 불명확하면 코드를 추가하지 않는다.

### 23.2 변경 완료 체크리스트

- [ ] 하나의 creator / 하나의 generated skill 경계 유지
- [ ] P2 version-5 호환 정본과 body 판단 경계 유지
- [ ] UNKNOWN·snapshot·evidence fail-closed 유지
- [ ] 현재 context만 제공하는 progressive read 유지
- [ ] P0/P1에 P2 복잡성 누수 없음
- [ ] generated artifact ownership과 atomic build 유지
- [ ] 모든 adapter가 공통 core를 유지하며 현재 검증 범위를 과장하지 않음
- [ ] creator usability와 generated-skill usability 모두 검토
- [ ] 결과 품질 주장을 구조 검증과 혼동하지 않음
- [ ] 외부 project 코드·문법·wire format 복사 없음
- [ ] 전체 회귀검증과 대표 cold path 통과
- [ ] 제품 설계, 구현·검증 evidence, 유지보수 snapshot의 소유권이 섞이지 않음

---

## 24. 최종 기준 문장

Skill Rails의 목적은 코드량을 늘리거나 모든 판단을 기계화하는 것이 아니다. 목적은 **기계가 확실히 지킬 수 있는 것은 기계적 계약으로 만들고, 기계가 확실히 판단할 수 없는 것은 짧고 주소 가능한 판단 기준으로 남기며, 둘 사이의 경계를 증거로 검증하는 것**이다.

좋은 변경은 특정 실패 하나를 가리는 patch가 아니라 다음 전체 결과를 개선한다.

- AI 작성자가 의도를 잃지 않고 skill을 만든다.
- AI 유지보수자가 stable ID와 evidence로 의미를 바꾼다.
- AI 소비자가 P0/P1에서는 일치하는 판단 주제만, P2에서는 현재 Decision만 읽는다.
- 생성된 skill이 검증된 adapter에서 같은 핵심 의미로 동작하고, 미검증 host는 `unproven`으로 남는다.
- 증명되지 않은 성공은 성공으로 보고되지 않는다.

이 기준을 만족하지 못하는 기능 확장, multi-skill 분해, hook 강제, 새 DSL, 문서 증식은 현재 제품의 발전이 아니라 방향 이탈로 간주한다.
