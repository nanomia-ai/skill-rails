# Skill Rails 유지보수 상태와 다음 세션 진입점

문서 상태: 교체형 작업 snapshot

최종 갱신: 2026-08-30 KST

이 문서는 새 세션이 “마지막으로 어디까지 끝났고 어디서 이어야 하는가”를 빠르게 복구하기 위한 시작점이다. 제품의 안정적인 목적과 설계는 [제품·설계 정본](skill-rails_ko.md), 정확한 구현·증거·P2 version-5 호환 변경은 [구현·검증 기록](implementation-verification_ko.md), 큰 전환의 인과와 재사용할 저작·운영 교훈은 [저작 경험 계승](authoring-lessons_ko.md)이 소유한다. 일상 chronology는 Git과 Orca 실행 기록에 맡기고 이 파일에는 현재 truth만 둔다.

---

## 0. 현재 완료 지점: v0.1.5 공식 Agent Skills 설치 경계 후보

v0.1.4까지의 root `SKILL.md` 방식은 creator 기능을 빠뜨리지는 않았지만, `npx skills@latest`가 repository 전체와 fixture의 중첩 skill까지 설치 scope로 복사하게 했다. Package 0.1.5 후보는 설치 가능한 정본을 공식 관례인 `skills/skill-rails/`로 옮겼다. Repository-only `docs/`, `tests/`, `evals/`, `fixtures/`는 GitHub source에 그대로 남고 설치 payload에서는 제외된다.

현재 local candidate는 `npm run verify`의 vendor check, self lint, repository test 62/62와 frozen G0.5 eval을 통과했다. 별도 임시 Git project에서 `npx skills@latest add <local-repository> --skill skill-rails --agent codex claude-code gemini-cli -y`를 실행했으며, installer는 skill 하나만 발견했다. 설치본은 61 files, `SKILL.md` 1개, repository-only file 0개, source 대비 missing/extra/different 0이었고 설치본으로 만든 P1 package도 lint pass했다.

## 1. 저장소 기준선

- branch: `main`
- `HEAD`와 `origin/main`: `f0a5ce152896d57ba744a01ff5b76c7c7bbc7a83`, package version 0.1.4.
- Package 0.1.5 설치 경계 변경은 아직 dirty local candidate이며 push 전이다.
- P2 runtime 의미, schema, Decision byte, effect authority와 `SPEC.version = "5"` 호환 경계는 바뀌지 않았다.
- Annotated tag와 별도 public release는 만들지 않았다.

---

## 2. 완료된 제품 변경

- `skills/skill-rails/` 하나가 설치 가능한 package와 skill-user routing을 소유한다.
- Root에는 maintainer 문서·test·eval·fixture와 frozen G0.5 harness만 남긴다.
- G0.5 scorer와 lint의 봉인된 바이트 및 protocol fingerprint는 유지하고, repository-only re-export bridge로 이동한 canonical runtime에 연결한다.
- Package scripts, tests, maintainer routing, 사람용 README source link와 제품 설계 문서가 새 소유 경계를 가리킨다.
- 설치 package 안의 중첩 fixture skill과 repository-only 파일을 금지하는 회귀 검사를 추가했다.

---

## 3. 현재 증거

- Targeted authoring·integration·runtime: 51/51 pass.
- Frozen G0.5 targeted: 2/2 pass.
- `npm run verify`: vendor check, self lint, repository test 62/62, frozen G0.5 eval pass.
- Markdown local link scan: 47 files, 56 local links, missing 0.
- Local official-installer smoke: 1 skill discovered; installed 61 files; `SKILL.md` 1; forbidden repository-only file 0; source/install missing·extra·different 0; installed creator P1 generation과 lint pass.
- 구조·배치·creator 실행을 fresh agent의 장기 행동 증거로 승격하지 않는다.

---

## 4. 여전히 `UNPROVEN`인 범위

- Push 뒤 GitHub remote source에서 같은 61-file 경계가 재현되는지와 global destination fingerprint
- Fresh consumer가 recovery guard와 saved-Decision 재사용 조건을 실제로 올바르게 해석하는 행동
- 생성 P0/P1 skill의 반복 trigger precision, 첫 산출물 유용성과 long-session/compaction 회복
- 여러 모델·host에서의 통계적 trigger precision과 대형 Devflow 계열 부하
- Linux/macOS POSIX symlink 분기와 capture 뒤 out-of-band writer의 package 보존
- Claude personal/project 동명판을 함께 유지하면서 project가 이기는 행동은 host precedence상 지원되지 않는다. 다른 host의 same-name precedence도 `UNPROVEN`이다.

---

## 5. 정확한 다음 단계

1. 검증된 v0.1.5 구조 변경을 commit하고 `origin/main`에 push한다.
2. 사용자 명령과 같은 GitHub source를 지원 대상 host로만 global 설치하고 61-file fingerprint, 단일 `SKILL.md`, creator 실행을 다시 확인한다.
3. Global receipt로 이 snapshot과 구현·검증 기록을 갱신해 evidence-only commit을 push한다. Tag·별도 release는 사용자 요청 없이는 만들지 않는다.
