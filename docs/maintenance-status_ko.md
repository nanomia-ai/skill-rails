# Skill Rails 유지보수 상태

문서 상태: 교체형 현재 snapshot. 버전별 경과는 Git, 결정은 `docs/plan/implementation-evolution-plan_ko.md`, 증거는 `docs/implementation-verification_ko.md`가 소유한다.

최종 갱신: 2026-10-17 KST — v2.0.1 방법 문서 재작성·runtime 이름 정리 release

## 현재 위치

- Root와 authoring package version은 `2.0.1`, Node 범위는 `>=24 <25`, 외부 runtime dependency는 없다. 마지막 공개 버전은 `v2.0.1`이며 공식 경로는 `nanomia-ai/skill-rails` repository의 `npx skills@latest`다. npm registry publish는 하지 않았다.
- v2.0.0은 기계적 분리를 mode가 아니라 선언한 도구로 표현한다(E-042). 원문 형식은 `schemaVersion: 2`이고 v1 원문은 전환 안내와 함께 거부한다. 산문 target 산출물은 `SKILL.md`·`references/`·선언한 도구·receipt뿐이며, record runtime은 `record`를 선언한 target에만 있다. `prepare-record`·observer·packet·fallback은 제품에서 제거됐고 재현은 tag `v1.3.7`에서 한다.
- 저작 스킬은 "Decide what a tool should own", "Split the work", "Review before you conclude"를 entry에, 도구 설계·연결·record 작성을 `references/tools.md`, 새 package 시작을 `references/new-package.md`에 둔다.
- Canonical authoring source는 `authoring-package.json`과 `authoring/skill-rails/`, 선택형 판단 원문은 `docs/guide/ai-skill-evolution-method_ko.md`, generated tracked skill은 `skills/skill-rails/`다. 테스트 전용 pilot과 fixture는 `tests/fixtures/`, 역사 결과는 `evals/*/results/`, legacy capsule은 `legacy/archive/v0.4.3/`에 있다.
- 기본 `npm test`는 38개 중 37 pass, 1 skip(호스트 symlink 권한)이다. 구조 검사는 fresh AI 행동이나 실제 effect를 대신 증명하지 않는다. 실제 installer·Claude Code·Codex로 한 bounded 실사용 관찰은 `docs/implementation-verification_ko.md` v2.0.0 절에 있다.

## 정확한 다음 진입

1. v2.0.1은 방법 문서를 처음 읽는 AI 기준으로 재작성·압축하고 runtime 이름 `skill-rails-next`를 `skill-rails`로 바꿨다. v2.0.0의 record로 쓴 구역 표시는 새 버전이 알아보지 못한다(증거: `docs/implementation-verification_ko.md` 방법 원문 재구성 절). 다음 결정은 실사용에서 관찰된 장면이 생길 때 그 owner를 연다.
2. Devflow의 v2 원문 전환(manifest·target `schemaVersion: 2`, `mode` 삭제)과 재빌드는 별도 저장소의 별도 승인이다. 도구 채택은 Devflow 자체 규칙에 따라 그 뒤에 판단한다.
3. 추가 synthetic flow, matrix, schema, harness를 열지 않는다. 두 번째 record 출력이나 다중 파일 안전 기록의 실제 필요, 도구 증식 신호, 설치 route의 도구 손실이 관찰되면 E-042의 재검토 조건으로 돌아간다.
4. Force/history rewrite, README 변경과 archive 삭제는 계속 금지한다. README는 v2.0.0 이전 서술(record-only, 스크립트 예시)을 담고 있어 갱신 여부를 사용자에게 묻는다.

## 아직 unproven

- 반복성, 도구 채택의 산문 대비 총비용·품질 효과, 대화형 Codex의 질문 뒤 정지, 고친 description의 선택 효과
- 진화 방법 원문의 탐색 이득, 넓은 host 행동, 저작 과정 효율 — 이전 버전에서 이어진 `unproven`
- POSIX capsule mode restoration
