# Skill Rails 구현·검증 기록

문서 상태: 현재 구현과 evidence의 기록 정본

기준일: 2026-08-23 KST

이 문서는 정확한 구현 범위, 지원 수준, V5 변경 근거, 실행 증거와 미검증 경계를 소유한다. 제품의 안정적인 목적과 설계 경계는 [제품·설계 정본](skill-rails_ko.md), 다음 세션의 작업 시작점은 [유지보수 상태](maintenance-status_ko.md)를 따른다.

이 문서를 일일 작업 일지처럼 누적하지 않는다. 새 evidence가 생기면 현재 수치와 주장 범위를 갱신하고, 제품 경계나 V5 의미가 바뀔 때만 변경 원장에 이유와 보존 증거를 추가한다. 코드·test와 충돌하면 성공을 추정하지 말고 주장을 `unproven`으로 낮춘 뒤 같은 변경에서 이 기록을 고친다.

---

## 1. 현재 결정적 검증

- `npm run lint`: pass
- 현재 환경 전체 test: 49/49 pass
- 현재 환경 `npm run eval`: pass
- Node 20.20.2: 당시 35/35 pass
- Node 22.23.2: 당시 35/35 pass
- Node 24.18.0: 당시 35/35 pass
- fresh P2 L0–L18: pass
- Windows path, non-ASCII, read-only package, external state, symlink/junction boundary, snapshot stale, trace authority, build transaction을 integration test로 확인

Node 20·22·24 결과를 현재 49개 suite의 결과로 확대하지 않는다. 최신 49개 suite는 현재 Node 환경에서만 재실행했다.

---

## 2. 현재 adapter 지원 범위

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

Codex와 Claude Code는 현재 검증된 project-local adapter다. 제품의 영구 경계나 모든 플랫폼 지원을 뜻하지 않는다.

---

## 3. G0.5 동결 맹검

실행 전에 protocol, artifact, question, oracle, scorer를 동결하고 외부 fingerprint를 기록했다.

```text
sha256:10ddd0e38392a1a84209d9bb67a0b5c7f8fe35ae0ddd78990a220f00e8e761b6
```

저장소의 v1/v2 산출물은 실험 이력 보존용이며 현재 gate에 사용하지 않는다. 현재 deterministic preflight와 empirical scorer는 v3 artifact·oracle·protocol만 사용한다.

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

B의 inspection-only recall은 0.30이고 A 평균은 0.35였다. 두 Codex A 검토자는 의미상 defect를 언급했지만 동결된 canonical path 형식을 따르지 않아 strict scorer가 detection으로 세지 않았다. B의 전체 우위는 구조만 눈으로 읽어서 생긴 것이 아니라 구조화된 source, stable coordinates, deterministic lint를 함께 쓴 maintainer system의 제한된 증거다. 이를 모든 구조화 문서가 모든 산문보다 우월하다는 주장으로 확대하지 않는다.

---

## 4. Fresh creation과 cross-consumption

### 4.1 Codex cold creation

Fresh isolated Codex는 P2 `evidence-gate`를 만들었다.

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

Collector가 없는 시험이므로 evidence, approval, read-only 값은 agent가 공급한 `decided` 값이다. 분기 결정성의 증거이지 입력 진위의 외부 관찰 증거가 아니다.

### 4.2 Claude cold creation

Fresh project-local Claude Code는 P1 `verified-note`를 만들었다.

- JSON facts를 exact Markdown으로 변환
- 순서, duplicate, punctuation, leading spaces 보존
- unknown key, invalid type, blank fact, CR/LF, malformed JSON, invalid UTF-8 거부
- helper tests 68/68 pass
- creator lint/build pass
- obligation 25/25 projected
- eval은 structural pass, behavior `unproven`, `forward-test-required`

마지막 상태는 실패가 아니다. 구조 검증을 모델 행동 증거로 과장하지 않는 fail-closed 결과다.

### 4.3 Cross-author / cross-consumer

- Claude가 만든 P1을 Codex에 설치: 14/14 files byte-identical
- Codex가 만든 P2를 Claude에 설치: 51/51 files byte-identical
- Codex는 P1을 explicit/implicit로 발견하고 byte-exact helper output을 생성
- Codex near-miss 요약 요청에서는 helper를 호출하지 않음
- Claude는 P2를 explicit로 실행해 자신이 공급한 current/granted/read-only 값에 대한 DONE과 restrictions를 받음
- Claude는 P2를 implicit로 선택해 missing evidence를 BLOCK
- Claude의 REPORT 자기주장은 trace에 남았지만 독립 alignment는 외부 proof가 없어 `unproven`으로 유지

---

## 5. P0 점진 산문 fresh author / consumer 실측

격리된 임시 프로젝트의 Claude project-local 경로에 현재 creator를 설치하고, 내부 표현이나 의도된 routing path를 주지 않은 채 일반 요구 문서로 고객지원 답변 검토 skill 생성을 요청했다. Fresh Claude Opus medium은 판단 전용 요구를 P0로 선택하고, 모든 호출에 필요한 규칙은 `SKILL.md`에 유지하면서 상황별 다섯 주제를 조건부 topic으로 만들었다.

- obligation 66/66 projected, review-required 0
- lint pass, structural eval pass, behavior는 `unproven`
- entry 4,426 B + index 1,373 B = fixed 5,799 B
- on-demand topic 5개, 합계 2,392 B, 최대 526 B
- 생성물 12개 파일을 Codex project-local adapter로 byte-identical 복사

이 수치는 `.skill-rails/test-runs/progressive-consumer-20260823`의 로컬 임시 경계에서 직접 계측했지만 산출물은 저장소 evidence fixture로 보존하지 않는다. 따라서 실행 사실과 범위의 기록이며, checkout만으로 byte 수치를 독립 재현할 수 있다는 주장이 아니다.

별도의 fresh Codex gpt-5.6-sol medium에는 초보 비기술 사용자를 위한 지원 답변 초안과 일반 검토 요청만 제공했다. 모델은 암시적으로 skill을 선택하고 `SKILL.md → guidance-index.md → reader-new-to-product.md`만 읽었다. 보안, 결제, 접근성, enterprise topic은 열지 않았다. 결과는 실제 UI label, 한 단계 행동, 관찰 가능한 완료 상태를 사용했고, 근거 없는 즉시 완료 주장을 제거했으며, 요청하지 않은 전체 재작성은 만들지 않았다.

이 결과는 현재 adapter에서 한 개의 positive, single-match 소비 흐름과 그 산출물 품질에 대한 제한된 행동 증거다. 다중 topic 일치, no-match, near-miss non-trigger, Claude 소비, 장기 session/compaction, 다른 OS까지 증명하지 않는다. Medium 모델은 실제 사용 조건의 피시험자였고, 설계·코드 판정은 xhigh 감사와 deterministic suite가 담당했다.

관찰된 harness 한계:

- Codex가 사용자 MCP 설정을 상속한 첫 실행은 unrelated startup에서 정지했고 isolated 설정에서는 성공했다.
- 두 플랫폼 모두 Windows shell wrapper 문법을 몇 차례 잘못 구성했지만 올바른 helper/runtime 재호출은 성공했다.
- Claude CLI는 artifact와 report를 완성한 뒤 process 종료 응답이 늦었다.

이 현상은 기록하되 generated package의 동작 결함과 혼동하지 않는다.

---

## 6. V5 보존 및 변경 원장

### 6.0 V5 Decision 위치 보존

V5의 18개 공개 위치는 현재 typed Decision에서 다음과 같이 보존한다.

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

`schema`, `decision_id`, `spec`, `runtime`, `status`, `reads`, `needs`, `proof_required`, `reinvoke`, `assurance`은 replay와 evidence 경계를 위한 명시적 확장이다.

### 6.1 그대로 보존한 핵심

- `spec.mjs` 행동 정본과 정확한 14개 closed exports
- pure spec과 collector 분리
- `reads`, domain, UNKNOWN/NONE, `acceptsUnknown`
- executable guard bypass
- RESTRICT와 effect conflict, ordered effects와 terminal
- ownership, stage evidence/done
- body 네 section과 READ_FIRST
- snapshot begin/end
- text projection과 JSON mirror
- enter/stage/simulate/role/record/align/resume 계열
- L0–L18
- positive, negative, mutation, judgment replay, model-tool probe
- 단일 obligation ledger 안의 migration atom과 source provenance
- authoring card와 obligation atomization
- 제품 가설을 먼저 반증하는 G0.5
- effect interception은 미래 또는 별도 범위

### 6.2 명시적으로 변경·확장한 항목

| V5 기준 | 현재 구현 | 이유와 보존 방식 |
| --- | --- | --- |
| cross-skill import/composition surface | `SPEC.profile="single"`과 `SPEC.imports=[]`만 허용하고 foreign body reference를 거부 | 단일-skill 경계를 지키고 activation·handoff drift를 만들지 않음 |
| source-first lint, sandbox 아님 | positive-list AST + every-load L-fast + authoring L-structural + build-only L-full + verified same-process ESM | arbitrary code 신뢰를 줄이되 별도 interpreter로 의미를 복제하지 않음 |
| kernel v5 8줄 | kernel v6 8줄 | record/proof, evidence-backed skip, ASK/receipt 예외, enter-hash를 명시하며 기존 의미 위치를 유지 |
| stage JSON 18 위치 | versioned typed Decision + fingerprint | 18 위치 대응표를 보존하고 stale/replay/proof 정보를 추가 |
| 기본 stage text | 같은 Decision의 compact guide | 전체 JSON/body 대신 현재 행동만 읽게 함 |
| stage evidence 중심 | trace authority + alignment | “해야 함”과 “실제로 했음”을 분리하고 증거가 없으면 `unproven` |
| runtime state 위치가 암묵적 | skill root 밖 명시적 state directory | read-only install과 upgrade 안전 |
| repository runtime 공유 | generated P2마다 self-contained runtime | installer 없이 독립 배포하고 runtime hash로 stale copy 탐지 |
| ko/en body pair 중심 | 기본 single-language, `body_ko.md`가 실제로 있을 때만 parity 검사; 없는 언어를 `--lang`으로 요청하면 fallback하지 않고 L7로 거부 | 불필요한 이중 body와 잘못된 언어의 조용한 대체를 피함; 별도 pair-profile selector는 아직 없음 |
| context recovery와 interception의 경계가 약함 | enter-hash recovery와 effect interception을 분리 | 복구를 enforcement로 과장하지 않음 |
| 기존 gate 묶음 | G0.5, authoring/runtime/platform/eval gate 분리 | 가장 위험한 제품 가설을 먼저 중지 가능 |
| 복잡 skill 중심 | P0/P1/P2 최소 충분 profile | V5를 축소하지 않고 단순 skill 과설계를 방지 |
| P0/P1 판단 산문이 한 `SKILL.md`에 집중 | profile과 독립적인 conditional guidance index + stable topic files | 큰 판단형 skill을 P2로 올리지 않고 필요한 산문만 읽게 하며 보편 경계·정확 형식·stop rule은 entry에 유지 |

### 6.3 의도적으로 제외한 capability

Cross-skill import/composition은 현재 구현하지 않는다. Parser와 runtime은 `SPEC.profile="single"`, 빈 imports, 자기 skill의 body reference만 허용한다. 여러 skill의 activation, handoff, 상태 전달을 추가하면 줄이려던 drift surface가 다시 늘어나기 때문이다. 향후 필요해도 현재 single profile을 몰래 넓히지 말고 별도 profile과 독립 검증으로 설계한다.

V5 의미를 바꾸는 수정은 이 원장에 다음을 함께 기록한다.

1. 무엇이 바뀌는가
2. 왜 바꾸는가
3. 기존 의미를 어떻게 보존하거나 의도적으로 대체하는가
4. 동등성 또는 rollback을 어떤 test로 확인하는가

### 6.4 L0–L18 구현 대응

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

## 7. 현재 구현 완료 범위

- Creator thin skill과 조건부 authoring references
- P0/P1/P2 profile selection
- P0/P1 conditional judgment topic의 점진 읽기와 context-surface 계측
- intent/ledger scaffold와 P2 authoring-card template
- conservative migration과 비-Markdown inventory
- stable-ID maintenance와 semantic diff
- P2 V5 validator L0–L18
- positive-list AST와 two-level validation
- deterministic evaluator와 compact guide
- Decision/Trace schemas, authority, alignment, resume
- transactional deterministic build와 manifest
- self-contained P2 package
- Codex/Claude adapters
- repository tests와 G0.5 scorer

현재 evidence로 확인된 사용성:

- Codex와 Claude에서 creator 발견
- 양쪽에서 서로 다른 profile의 실제 skill 생성
- 상대 플랫폼에 byte-identical 설치
- 상대 플랫폼에서 explicit/implicit 사용
- P2 fail-closed decision과 `unproven` evidence boundary
- 한 개의 P0 single-match 흐름에서 필요한 judgment topic만 읽는 소비 행동

---

## 8. 일반화하면 안 되는 주장

- 30k+ token 또는 실제 compaction 뒤 critical omission 0
- 여러 모델 버전에 대한 통계적 trigger precision
- Claude 설치 상태 near-miss non-trigger
- Linux/macOS filesystem 통합
- global install/plugin/marketplace
- 실제 대형 기존 skill의 포팅 완료
- 생성 skill의 task-output이 모든 baseline보다 우월
- tool-call enforcement
- 많은 conditional topic을 가진 실제 대형 P0/P1의 장기 context 절감과 routing recall
- symlink/non-regular migration source의 inventory
- invalid UTF-8 Markdown 내용의 의미 복구
- 최신 49개 suite의 Node 20/22/24 재실행

이 항목들은 숨은 미완성 code marker가 아니라 별도 empirical scope다. 지원을 주장하려면 해당 범위를 직접 실행한 fresh evidence를 추가한다.
