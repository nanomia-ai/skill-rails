# Skill Rails 제품·architecture 경계

문서 상태: 현재 채택된 안정 경계 (v2.0.0)

## 목적

Skill Rails는 AI가 사용할 독립적인 skill을 canonical source package에서 저작·빌드하고, 그 skill을 쓰는 AI가 읽고 해석하고 옮겨 적고 복구해야 하는 총부담을 줄이는 기반이다. 같은 입력이면 같은 답이 나오는 관찰·계산·형식·검사·안전 기록은 선언한 도구가 맡고, 목적·예외·충분성·의미 선택은 AI와 사용자가 맡는다.

성공은 내부 구조나 검사 수가 아니라 산문 기준안과 같거나 더 나은 과업 성공·안전을 유지하면서 context, 왕복, 형식 오류, stale 적용 또는 여러 정본의 유지 비용을 실제로 줄인 결과다.

## 원문과 빌드

- 저작 source와 generated target은 분리한다. 사람이 generated target을 직접 고치지 않는다.
- Source package는 manifest(`schemaVersion: 2`, `modules`, `tools`, `targets`)와 target descriptor(`entry`, `imports`, `references`, `tools`, 선택 `record`, 선택 `headingIndex`, 저작 target 전용 `embeddedCoreTooling`)로 이루어진다. mode는 없다. v1 원문은 전환 안내와 함께 거부한다.
- 공유 산문은 module로 한 번 선언하고 build가 소비 target마다 whole-file로 복사한다. target 하나만 읽고 소유하는 조건부 Markdown은 target-owned reference다(E-041).
- 도구는 package root 안의 파일 또는 폴더이며, build가 바이트 그대로 `scripts/<id>.<ext>` 또는 `scripts/<id>/…`로 전달한다. 공유 도구도 module처럼 한 번 선언하고 복사한다(E-042).
- `record`는 Skill Rails가 소유한 코어 도구다. AI의 의미 답을 선언된 텍스트 파일 하나의 managed region에 basis 재확인·lock·멱등 재시도·reread로 기록한다. 그 밖의 쓰기 안전은 작성자 도구가 소유한다.
- Generated target은 `SKILL.md`, `references/`, 선언한 도구, (record 시) record runtime·config·contract, (저작 target) 내장 CLI, 그리고 receipt만 가진다. 이 중 아무것도 선언하지 않은 target에는 실행 파일이 없다.
- Target package는 standalone이며 저작 repository, sibling skill, global runtime과 legacy archive를 실행 시 참조하지 않는다. `npx skills`가 스킬 폴더 단위로 설치하므로 스킬 상위 공유 폴더는 두지 않는다.

## Core 책임

- Core는 manifest/schema, 경로 격리, deterministic build, receipt/currentness, inspect/overview, record runtime과 공통 오류를 소유한다.
- Receipt의 artifacts는 실제 전달 파일, sources는 currentness 입력이다. `check --out`은 receipt만으로 설치본의 artifact-intact를, `--source`를 함께 주면 source-current를 따로 답한다. 산문 설치본 자체의 무결성 실행 코드는 v2.0.0에서 내려놓았다(E-042 D1).
- Effect credit은 실제 관찰 권한을 넘지 않는다. 파일 write는 reread digest가 맞을 때만 `observed`다.
- 기본 상태는 artifact-derived다. 대화나 run scratch를 durable semantic truth로 만들지 않는다.
- 사람의 전체 구조 질문에는 `overview --source`가 current graph에서 계산한 non-authoritative view 하나만 사용한다. 저장 정본, generated skill 또는 AI runtime의 입력이 아니다.
- AI는 의미를 판단하고 host tool을 선택한다. Core는 자유 산문의 진실성이나 AI 준수를 보장하지 않는다. 도구 검사 통과는 그 도구가 검사한 것만 증명한다.
- `prepare-record`, observer, packet, fallback은 제품에 없다. M1~M4 재현은 tag `v1.3.7`에서 별도 root로 하며, 고유 결과는 `evals/*/results/`에 남는다.

## 저작 스킬

- Canonical source는 `authoring/skill-rails/`와 repository root의 `authoring-package.json`, 선택형 판단 원문은 `docs/guide/ai-skill-evolution-method_ko.md`(유지보수자와 저작 스킬이 함께 쓰는 단일 정본), generated tracked skill은 `skills/skill-rails/`다.
- 저작 스킬은 고정 CLI closure(`embeddedCoreTooling: "authoring-cli-v1"`)를 `scripts/skill-rails-cli/`로 실어 sibling 없이 author→build→check→inspect를 한다.
- 저작 흐름은 SOURCE ⇄ REVIEW → ROUTE → BUILD → TEST다. REVIEW는 다른 AI의 판단·행동을 바꾸는 변경을 결론 전에 그 스킬을 쓸 AI처럼 읽고 저작 기준으로 다시 대조한다. 빌드·시험·전달은 사용자가 요청할 때만 시작한다.
- 테스트 전용 pilot domain과 fixture는 `tests/fixtures/`에 있다.

## 배포와 권한

- Repository/package identity는 `nanomia-ai/skill-rails`와 private metadata `@nanomia/skill-rails`, generated skill identity는 `skill-rails`다. Public delivery는 repository-based `npx skills@latest` 경로이며 npm registry에 발행하지 않는다.
- 실제 host 검증은 generated package가 준비된 뒤 표준 installer 경로에서 수행한다. 설치 도구가 건너뛰거나 바꾸는 파일이 있으므로 도구를 싣는 target은 설치본 `check`와 도구 실행으로 route를 확인한다.
- Release, push, 전역 설치 교체, published identity와 `latest` cutover는 사용자의 명시 승인 범위에서만 수행한다. Force push/history rewrite, README 변경과 legacy archive 삭제는 승인되지 않았다.

정확한 구현 계약과 milestone은 동결 상세 계획이, 구현 중 차이는 Evolution 문서가 소유한다.
