# Skill Rails 유지보수 상태와 다음 세션 진입점

문서 상태: 교체형 작업 snapshot

최종 갱신: 2026-08-31 KST

이 문서는 새 세션이 “마지막으로 어디까지 끝났고 어디서 이어야 하는가”를 빠르게 복구하기 위한 시작점이다. 제품의 안정적인 목적과 설계는 [제품·설계 정본](skill-rails_ko.md), 정확한 구현·증거·P2 version-5 호환 변경은 [구현·검증 기록](implementation-verification_ko.md), 큰 전환의 인과와 재사용할 저작·운영 교훈은 [저작 경험 계승](authoring-lessons_ko.md)이 소유한다. 일상 chronology는 Git과 Orca 실행 기록에 맡기고 이 파일에는 현재 truth만 둔다.

---

## 0. 현재 완료 지점: v0.1.6 공식 배포와 설치 evidence

v0.1.4까지의 root `SKILL.md` 방식은 creator 기능을 빠뜨리지는 않았지만, `npx skills@latest`가 repository 전체와 fixture의 중첩 skill까지 설치 scope로 복사하게 했다. Package 0.1.5 후보는 설치 가능한 정본을 공식 관례인 `skills/skill-rails/`로 옮겼다. Repository-only `docs/`, `tests/`, `evals/`, `fixtures/`는 GitHub source에 그대로 남고 설치 payload에서는 제외된다.

제품 commit `1560bc3c3738fda85bbdd745836f7abbaebe3c2b`은 `npm run verify`의 vendor check, self lint, repository test 62/62와 frozen G0.5 eval을 통과했다. Local source와 GitHub source 설치가 각각 skill 하나만 발견했고, 설치본은 61 files, `SKILL.md` 1개, repository-only file 0개였다. Local install은 source 대비 missing/extra/raw difference 0, global install은 path missing/extra 0과 newline-normalized content difference 0이었으며 둘 다 설치본 P1 생성과 lint를 통과했다.

배포 뒤 Devflow 포팅 피드백을 제품 경계와 대조한 결과 구현 차단이나 P2 core 결함은 없었고, 여러 standalone skill이 repository 규약을 공유할 때 cold author가 소유 경계를 첫 저작 경로에서 찾기 어려운 안내 공백을 확인했다. Source candidate의 첫 교정은 설치 진입점에서 profile을 skill별로 고르고 shared domain input·helper를 재사용하되, P2 behavior와 judgment는 각각 `spec.mjs`와 `body.md`가 계속 배타 소유한다고 명시한다. `ARTIFACTS` path 선언은 존재·내용·freshness·evidence authority를 증명하지 않는다.

이어 Devflow가 제기한 L14 guard 증거 문제를 최신 후보에서 재현해 현재 P2 제품 결함으로 확인했다. Live, simulate, scenario expectation, L5가 observation source를 서로 다르게 전처리해 missing input이 fixture에서만 predicate를 실행하고 coverage를 얻을 수 있었다. 두 번째 교정은 한 observation preparation owner로 collector/`s`/`judged`/`decided`를 통합했고, raw `"UNKNOWN"`의 version-5 예약 의미와 evaluator event-only coverage를 보존하면서 이 false proof를 닫았다. Fable xhigh 설계 반증과 Sol xhigh 기술 검토, 구현 후 두 최종 read-only audit는 현재 수정이 새 grammar 없이 원인을 닫는 최소 일관 교정이라고 PASS했다. 이 두 교정을 package source version `0.1.6`의 patch 경계로 묶었다.

## 1. 저장소 기준선

- branch: `main`
- Package version: 0.1.6. 이 경계는 related-skill authoring correction `90afd43`, P2 observation evidence correction `f269f29`, version boundary `5e2c300`을 포함한다.
- 현재 공식 배포는 `v0.1.6` annotated tag와 GitHub Release가 이 snapshot을 포함한 release commit을 가리키는 형태다.
- `v0.1.5`의 설치 product bytes와 global receipt는 역사적 증거로 유지한다. `v0.1.6`은 공식 GitHub source를 사용한 global 설치와 설치본 실행 evidence까지 별도로 확보했다.
- P2 runtime/validator는 observation input parity bug fix로 `0.2.1`/`0.3.1`이 됐다. Schema, Decision 위치, effect authority, coverage token과 `SPEC.version = "5"` 호환 경계는 바뀌지 않았다.
- 전역 canonical `v0.1.6` install은 `C:\Users\joinj\.agents\skills\skill-rails`이고 Claude Code junction도 이 경로를 가리킨다. Codex와 Gemini CLI는 같은 universal package를 사용한다.

---

## 2. 완료된 제품 변경

- `skills/skill-rails/` 하나가 설치 가능한 package와 skill-user routing을 소유한다.
- Root에는 maintainer 문서·test·eval·fixture와 frozen G0.5 harness만 남긴다.
- G0.5 scorer와 lint의 봉인된 바이트 및 protocol fingerprint는 유지하고, repository-only re-export bridge로 이동한 canonical runtime에 연결한다.
- Package scripts, tests, maintainer routing, 사람용 README source link와 제품 설계 문서가 새 소유 경계를 가리킨다.
- 설치 package 안의 중첩 fixture skill과 repository-only 파일을 금지하는 회귀 검사를 추가했다.
- P2 live/simulate/scenario/L5가 한 observation preparation owner를 사용하고, 누락값은 predicate·coverage 전에 `UNKNOWN`으로 막힌다.
- `fixture.s`/`judged`/`decided` source lane, explicit presence, object-valued observation, version-5 raw `"UNKNOWN"` 예약어를 validator와 회귀 증거로 고정했다.

---

## 3. 현재 증거

- Targeted authoring·integration·runtime: 51/51 pass.
- Frozen G0.5 targeted: 2/2 pass.
- `npm run verify`: vendor check, self lint, repository test 62/62, frozen G0.5 eval pass.
- Markdown local link scan: 47 files, 53 local links, missing 0.
- Local official-installer smoke: 1 skill discovered; installed 61 files; `SKILL.md` 1; forbidden repository-only file 0; source/install missing·extra·different 0; installed creator P1 generation과 lint pass.
- GitHub-source global smoke: 1 skill discovered; installed 61 files; `SKILL.md` 1; forbidden repository-only file 0; path missing·extra 0; raw 42 differences는 모두 CRLF/LF이며 normalized difference 0; global self lint와 installed creator P1 generation·lint pass.
- skills.sh current skill page: Gen Agent Trust Hub, Socket, Snyk 모두 Pass.
- 구조·배치·creator 실행을 fresh agent의 장기 행동 증거로 승격하지 않는다.
- 미배포 후보의 `npm run verify`: vendor check, self lint, repository test 67/67, frozen G0.5 eval pass.
- Fresh Sonnet high는 관련 skill suite 반례에서 profile-local 선택과 P2 `spec.mjs`/`body.md` 배타 소유를 도출했다. 첫 authority 답변의 file-presence 과장을 public contract에서 교정했고, 별도 Fresh Sonnet high가 `ARTIFACTS` 선언은 path·writer·reader와 stage projection만 성립시키며 존재·내용·freshness는 `UNPROVEN`이라고 정확히 구분했다.
- Fable xhigh의 근본 설계 반증과 Sol xhigh의 기술·호환 검토를 교차했다. Sol이 최초 문구의 P2 합성 모호성을 발견했고 Fable이 재검토 후 기존 PASS를 철회해 같은 결함을 확인했으며, runtime/schema/version-5를 넓히지 않는 문구·회귀 교정으로 닫았다.
- P2 observation 교정의 targeted runtime·integration 39/39가 pass했다. Canonical pilot은 공식 repair-generated 경로에서 build ID `sha256:1a901e5e01b8680dcfc76140681a170aaf8a22750826bfc04c95ae0238b45736`, L0–L18, mutation 20/20, scenario 10/10·50회 불일치 0, format 256/256을 기록했다. Full verify 뒤 Fable/Sol 최종 audit도 MUST-fix 없이 PASS했다.
- Release 뒤 `skills` 1.5.23으로 `npx skills@latest add nanomia-ai/skill-rails --global --skill skill-rails --agent codex claude-code gemini-cli --yes`를 실행했다. Installer는 skill 하나만 발견했고 release package와 설치본은 모두 62 files, `SKILL.md` 1개였다. Path와 CRLF를 제외한 content 차이는 0, installed self lint와 임시 P0 생성·full lint는 pass했고 임시 산출물은 제거했다.
- Installer security summary는 Gen Safe, Socket 1 alert, Snyk Low Risk를 표시했다. 이는 외부 scanner signal이며 설치·실행 실패가 아니지만, 현재 alert의 상세 원인과 최신 재평가 상태는 이번 제품 receipt로 해소하거나 Pass로 승격하지 않는다.

---

## 4. 여전히 `UNPROVEN`인 범위

- Fresh consumer가 recovery guard와 saved-Decision 재사용 조건을 실제로 올바르게 해석하는 행동
- 생성 P0/P1 skill의 반복 trigger precision, 첫 산출물 유용성과 long-session/compaction 회복
- 여러 모델·host에서의 통계적 trigger precision과 대형 Devflow 계열 부하
- Linux/macOS POSIX symlink 분기와 capture 뒤 out-of-band writer의 package 보존
- Claude personal/project 동명판을 함께 유지하면서 project가 이기는 행동은 host precedence상 지원되지 않는다. 다른 host의 same-name precedence도 `UNPROVEN`이다.
- 실제 Devflow 완료물에서 이 안내가 별도 seam audit 비용을 줄이는지, 여러 package의 shared source 변경이 장기간 국소적으로 유지되는지, 다른 model·host가 같은 최소 소비를 선택하는지
- shared source에서 여러 P2 `spec.mjs`/`body.md`로 자동 projection하거나 freshness를 증명하는 workspace mechanism은 구현하지 않았고 `UNPROVEN`이다.
- 저장소 밖 version-5 package가 문서화되지 않은 raw UNKNOWN 내부 표현이나 `fixture.s`의 잘못된 source lane에 의존하는 수량은 `UNPROVEN`이다. Exact raw 문자열 `"UNKNOWN"`을 known application data로 쓰는 것은 version 5에서 지원하지 않으며, 이를 바꾸려면 별도 versioned boundary가 필요하다.

---

## 5. 정확한 다음 단계

1. 진행 중인 Devflow 작업은 현재 coherent edit를 중단하거나 과거 결과를 재해석하지 않는다. 다음 자연스러운 Skill Rails 사용 경계에서 installed `v0.1.6`을 다시 로드하고 이후 저작·유지보수에 새 guidance를 적용한다.
2. Devflow 완료 경계에서 P2 package만 새 runtime으로 정상 rebuild하고 guard fixture가 correct source lane과 evaluator-observed coverage를 사용하는지 확인한다. 올바른 version-5 package는 spec/fixture migration이 필요 없고, 진단 없이 `--repair-generated`를 사용하지 않는다.
3. 새 결함이나 product boundary 변경 없이 비용이 큰 네 모델 suite를 반복하지 않는다. Test worktree 정리는 별도 작업으로 취급하고 dirty bytes와 active writer가 없음을 정확한 대상마다 확인한 뒤 수행한다.
