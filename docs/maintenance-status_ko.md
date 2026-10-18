# Skill Rails 유지보수 상태

문서 상태: 교체형 현재 snapshot. 버전별 경과는 Git, 결정은 `docs/plan/implementation-evolution-plan_ko.md`, 증거는 `docs/implementation-verification_ko.md`가 소유한다.

최종 갱신: 2026-10-18 KST — v2.0.8 사용 전 최종 실사용 시험과 리뷰 관문 release

## 현재 위치

- Root와 authoring package version은 `2.0.8`, Node 범위는 `>=24 <25`, 외부 runtime dependency는 없다. 마지막 공개·설치 버전은 `v2.0.8`이며 공식 경로는 `nanomia-ai/skill-rails` repository의 `npx skills@latest`다. npm registry publish는 하지 않았다.
- v2.0.0은 기계적 분리를 mode가 아니라 선언한 도구로 표현한다(E-042). 원문 형식은 `schemaVersion: 2`이고 v1 원문은 전환 안내와 함께 거부한다. 산문 target 산출물은 `SKILL.md`·`references/`·선언한 도구·receipt뿐이며, record runtime은 `record`를 선언한 target에만 있다. `prepare-record`·observer·packet·fallback은 제품에서 제거됐고 재현은 tag `v1.3.7`에서 한다.
- 저작 스킬은 "Decide what a tool should own", "Split the work", "Review before you present or build"를 entry에, 도구 설계·연결·record 작성을 `references/tools.md`, 새 package 시작을 `references/new-package.md`에 둔다.
- Canonical authoring source는 `source/`(manifest `source/skill-package.json`, target `source/targets/skill-rails/`), 선택형 판단 원문은 module `source/modules/skill-evolution-method_ko.md`, generated tracked skill은 `skills/skill-rails/`다. 테스트 전용 pilot과 fixture는 `tests/fixtures/`에 있다. v1 마일스톤 결과(`evals/`)와 v0.4.3 legacy capsule(`legacy/`)은 tag `v2.0.8`의 같은 경로에서 복구한다.
- 기본 `npm test`는 38개 중 37 pass, 1 skip(호스트 symlink 권한)이다. 구조 검사는 fresh AI 행동이나 실제 effect를 대신 증명하지 않는다. 실제 installer·Claude Code·Codex로 한 bounded 실사용 관찰은 `docs/implementation-verification_ko.md` v2.0.0 절에 있다.

## 정확한 다음 진입

1. v2.0.8(E-047): 사용 전 최종 실사용 시험 뒤 REVIEW를 지도의 줄기(보고·빌드 앞 관문)에 놓고 원문만 바꾼 작업의 끝을 그렸다. 보고는 '어떻게 검토했는지'. 남은 위험: Sonnet의 원문 자기 검토가 일관되지 않음(entry를 읽은 실행 4/7), Sonnet 구조 수정 1회 불완전, 스킬 미선택 1회 — verification 문서. v2.0.7(E-046): 맥락 없는 독자 세 차례 전수 읽기로 이 저장소에서만 통하던 말(archived Skill Rails·Devflow 금지, semantic relation, template·frame 등)을 걷어내고, 한 이름의 두 뜻과 실행 경로가 갈리던 곳을 닫았다. 다음은 사용 전 최종 실사용 시험. v2.0.6(E-045): Review는 작성 AI의 자기 검토가 기본이고, 다른 에이전트(서브에이전트·사용자 코디네이터)는 사용자가 요청할 때 더하며, 위험이 크면 보고에서 권한다. 브리핑은 방법 §10(배경·의도는 충분히, 기대 결론·의심 결함은 빼고). 다음은 이 판의 실사용 시험: 빌드 금지 작은 수정에서 자기 검토가 실제로 일어나는지, 요청 없이 다른 에이전트를 띄우지 않는지. v2.0.5(E-044): 격리 실사용 시험(8개 시나리오 + 빌드된 스킬의 사용자 관점 3개)을 거쳤고, Review의 원문 독자 읽기는 빌드·시험 요청과 무관하게 완료 조건이다. 이 집계는 하위 에이전트 호출을 리뷰로 센 기준이었다(E-045가 교정). v2.0.3·v2.0.4(E-043): entry *Write prose*가 흐름이 있는 글은 지도부터 그리고 절이 지도를 따르게 하며, 각 전이(실패한 확인 포함)를 말로 쓰고 배치에만 기대지 않게 하고, 지도가 절의 조건이 금지하는 이동을 지시하지 않게 한다. 블록 모양은 내용이 요구하는 것으로 고른다. Review는 기존 "Hold it to this skill"로 이 기준을 벽으로 쓴다. 실사용 블라인드 비교 근거는 verification 문서. v2.0.2는 뜻을 바꾸는 계획·결과를 내놓기 전 대조를 방법 §0으로 옮겨 계획까지 넓히고 고치지 않은 앞뒤 글과의 충돌·인과를 보게 했으며, entry Review는 지적을 고친 뒤 바뀐 부분이 아니라 entry부터 다시 보게 했다. v2.0.1은 방법 문서를 처음 읽는 AI 기준으로 재작성·압축하고 runtime 이름 `skill-rails-next`를 `skill-rails`로 바꿨다. v2.0.0의 record로 쓴 구역 표시는 새 버전이 알아보지 못한다(증거: `docs/implementation-verification_ko.md` 방법 원문 재구성 절). 다음 결정은 실사용에서 관찰된 장면이 생길 때 그 owner를 연다.
2. Devflow의 v2 원문 전환(manifest·target `schemaVersion: 2`, `mode` 삭제)과 재빌드는 별도 저장소의 별도 승인이다. 도구 채택은 Devflow 자체 규칙에 따라 그 뒤에 판단한다.
3. 추가 synthetic flow, matrix, schema, harness를 열지 않는다. 두 번째 record 출력이나 다중 파일 안전 기록의 실제 필요, 도구 증식 신호, 설치 route의 도구 손실이 관찰되면 E-042의 재검토 조건으로 돌아간다.
4. Force/history rewrite는 계속 금지한다. README는 사용자가 승인한 범위(E-049의 방법 문서 링크 경로)만 바꿨고, 그 밖의 README 변경은 승인되지 않았다. legacy capsule과 v1 결과의 HEAD 삭제는 승인되어 수행했으며(E-049), 복원은 별도 승인이 필요하다. README는 v2.0.0 이전 서술(record-only, 스크립트 예시)을 담고 있어 갱신 여부를 사용자에게 묻는다.

## 아직 unproven

- 반복성, 도구 채택의 산문 대비 총비용·품질 효과, 대화형 Codex의 질문 뒤 정지, 고친 description의 선택 효과
- 진화 방법 원문의 탐색 이득, 넓은 host 행동, 저작 과정 효율 — 이전 버전에서 이어진 `unproven`
- POSIX capsule mode restoration
