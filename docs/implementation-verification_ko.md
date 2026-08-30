# Skill Rails 구현·검증 기록

문서 상태: 현재 구현과 evidence의 기록 정본

기준일: 2026-08-31 KST

이 문서는 정확한 구현 범위, 지원 수준, P2 version-5 호환 변경 근거, 실행 증거와 미검증 경계를 소유한다. 제품의 안정적인 목적과 설계 경계는 [제품·설계 정본](skill-rails_ko.md), 다음 세션의 작업 시작점은 [유지보수 상태](maintenance-status_ko.md)를 따른다. 여기서 version 5는 `SPEC.version` 호환 계보이며 package release version이 아니다.

이 문서를 일일 작업 일지처럼 누적하지 않는다. 새 evidence가 생기면 현재 수치와 주장 범위를 갱신하고, 제품 경계나 P2 호환 의미가 바뀔 때만 변경 원장에 이유와 보존 증거를 추가한다. 그러나 새 실행이 있다는 이유만으로 고유 receipt를 삭제하지 않는다. 같은 claim, bytes, host, scope, authority를 실제로 포괄할 때만 이전 receipt를 대체하고, 그렇지 않으면 본문이나 정확한 durable artifact·Git commit 링크로 보존한다. 코드·test와 충돌하면 성공을 추정하지 말고 주장을 `unproven`으로 낮춘 뒤 같은 변경에서 이 기록을 고친다.

---

## 0. 2026-08-29 실사용 교차검수 후 보정

네 모델의 실제 사용 기록을 원시 증거로 다시 검토하고, Claude Fable max 설계 도전과 Codex Sol xhigh 기술·계약 검토를 서로 독립적으로 받은 뒤 다음의 좁은 보정을 적용했다.

- P1 helper 안내는 “첫 사용 전”이라는 시간 기준 대신, `scripts/run.mjs`가 `SR_P1_SCAFFOLD`를 내보내는지라는 관찰 가능한 상태를 기준으로 중단한다.
- P0/P1 intent 배열을 유지보수할 때 source 좌표와 text가 정확히 같은 atom은 이미 작성한 disposition·target·evidence를 보존하고, 새로 생기거나 편집된 atom은 그 신용을 상속하지 않는다.
- `agents/openai.yaml`의 `short_description`은 canonical description을 공백 정규화해 보존한다. 현재 공식 Codex skill metadata 문서에서 임의의 80자 제한은 확인되지 않았으며, 기존 절단은 네 실사용 lane 모두에서 단어 중간을 잘랐다. 이 변경이 모델별 trigger 품질을 높이는지는 별도 fresh evidence가 없으므로 `UNPROVEN`이다.
- 결정적 구조를 안전하게 추론하지 못한 migration atom은 judgment로 단정하지 않고 `ambiguous/review-required`로 남긴다. 정규식 어휘를 늘리거나 자동 판정 권한을 넓히지 않았다.
- fresh downstream의 next action은 현재 시점의 명령문이 아니라 상태가 바뀐 뒤에도 맞는 condition -> action으로 기록한다.
- 설명 전체를 adapter가 보존하면서 드러난 lint 공백도 함께 닫았다. Intent-backed simple skill의 portable description은 `SKILL.md`에 남아 있어야 하며, adapter에 같은 문자열이 있다는 이유로 그 삭제를 통과시키지 않는다.

회귀 증거는 profile 9/9, 선택된 integration 2/2, 선택된 authoring 2/2가 통과했다. Canonical pilot은 공식 `--repair-generated --repeats 50` 경로로 다시 만들었고 build ID는 `sha256:6e2ed86affa4e9ea65b50d787be390eee344b8e07f5fb972d661dd94cab62e54`, L0-L18 pass, mutation 20/20, scenario 10/10·50회·불일치 0, format 1/1·round trip 256/256이다. 이어서 `npm run verify`가 vendor check, self lint, repository test 61/61, frozen G0.5 eval을 모두 통과했다.

P2 `SPEC.version = "5"`, Decision·Trace schema, runtime effect authority, host permission 경계는 바꾸지 않았다. 실제 cross-model trigger 개선, 장기 session/compaction, E005에서 관찰된 checkout byte drift의 harness 재현은 여전히 `UNPROVEN`이며 이번 product patch의 성공으로 승격하지 않는다.

### 0.1 v0.1.3 공식 설치와 동일 이름 scope 충돌

`v0.1.3` release commit `bfb83dd431d95432f1e60269f9ef2078c36c265a`를 `origin/main`과 annotated tag에 배포한 뒤, frozen scenario HEAD `58555267162d64c9688b26a5019b41ad4191f483`의 기존 clean·inactive worktree 두 개에서 `npx skills@latest add nanomia-ai/skill-rails`를 그대로 실행했다. 당시 `latest`는 `skills` 1.5.23이었다. Codex와 실제 Claude Code process는 각각 agent를 자동 감지했고 project-local 설치를 exit 0으로 끝냈다.

두 설치본은 package version 0.1.3, 248 files, missing 0, extras 0, `skills-lock.json` computed hash `54efe9d4fc26a003d89c12bacde005bbf7a068fe0abf17d0eb88790fad50f1ad`로 같았다. Git blob raw hash와 다른 94개 파일은 모두 CRLF를 LF로 바꾸면 release commit blob과 일치했고, 그 밖의 content difference는 0이었다. 이는 현재 Windows checkout projection이지 Skill Rails body rewrite나 기능 결함이 아니다.

Fresh Codex는 project-local `.agents/skills/skill-rails/SKILL.md`와 그 reference를 읽고 P1 `ready-file-verifier`를 만들었다. Pass, wrong-content, missing fixture와 fast/default/full lint가 통과했고 scaffold와 open obligation은 0이었다. Eval은 별도 fresh consumer가 없으므로 의도대로 `forward-test-required`와 behavior `unproven`을 유지했다.

첫 fresh Claude는 project-local v0.1.3을 목록에서 발견했지만 `Skill("skill-rails")`가 사용자 personal `C:\Users\joinj\.claude\skills\skill-rails`의 v0.1.2를 열었다. Claude Code 공식 precedence가 enterprise > personal > project이므로 이는 clean project install 실패가 아니라 실제 사용 환경에서 재현 가능한 same-name scope collision이다. Claude Code에 연결된 personal 동명판만 제거한 뒤 새 Claude session은 project-local `.claude/skills/skill-rails/SKILL.md` junction과 같은 worktree의 `.agents/skills/skill-rails/SKILL.md`를 사용했고, 같은 P1 생성·세 fixture·lint를 통과했다. 따라서 clean project-local 설치와 기능은 `verified`, personal/project 동명 공존에서 project copy 선택은 `unsupported-by-host-precedence`, 다른 host의 동일 precedence는 `UNPROVEN`이다. Core runtime이나 profile code는 바꾸지 않았고, 이 관찰은 설치된 skill의 운영 절차를 늘리지 않고 host·환경 evidence로만 보존한다.

### 0.2 v0.1.4 문서 소유권과 installed-skill routing 경계

`references/`를 설치된 AI가 실제 저작·유지보수·평가 중 조건부로 읽는 operational material로 한정했다. Maintainer·배포자용 `references/platform-adapters.md`는 삭제했고, 안정적인 portable-core·adapter 설계는 [제품·설계 정본](skill-rails_ko.md), 버전·host별 support evidence는 이 문서가 계속 소유한다. Root `SKILL.md`의 platform reference route와 public README의 링크도 함께 제거했다.

README 작성 가이드는 내용 변경 없이 `references/readme-authoring.md`에서 `docs/readme-authoring.md`로 옮겼다. 사용자가 README 작업에 직접 제공할 human-authoring material이므로 `SKILL.md`, `AGENTS.md`, `CLAUDE.md`, authoring workflow와 public README의 자동 route를 모두 제거했다. 회귀 검사는 새 문서의 존재, 두 예전 reference의 부재, 여섯 entry surface의 무연결 상태를 확인한다.

변경 뒤 targeted authoring test 14/14와 repository Markdown local link 49-file scan이 통과했다. 이어 실행한 `npm run verify`는 vendor check, self lint, repository test 61/61, frozen G0.5 eval을 모두 통과했다. 이 변경은 creator runtime, profile selection, generated package shape, P2 version-5 contract와 host adapter projection을 바꾸지 않는다.

### 0.3 v0.1.5 공식 설치 경계

`npx skills@latest` 1.5.23은 root와 `skills/` 아래의 skill directory를 발견하고 선택된 directory 전체를 복사하지만, repository별 include/exclude manifest는 제공하지 않는다. Root `SKILL.md`를 설치 경계로 둔 v0.1.4는 기능 파일을 빠뜨린 것이 아니라 repository 전체 247개 파일과 fixture의 중첩 `SKILL.md`까지 설치 scope에 노출했다. 따라서 이는 fixture 기능 결함이나 host 행동 문제가 아니라 package boundary 제품 결함으로 분류했다.

설치 가능한 creator 정본을 `skills/skill-rails/` 아래로 이동하고 repository-only `docs/`, `tests/`, `evals/`, `fixtures/`는 public GitHub source에 그대로 남겼다. 새 package에는 discoverable `SKILL.md`가 정확히 하나뿐이다. Maintainer 전용 G0.5 scorer와 lint는 기존 frozen hash를 바꾸지 않고, repository-only re-export bridge가 이동한 canonical runtime을 연결한다. 동결 protocol·과거 여덟 review receipt·P2 `SPEC.version = "5"` 행동 계약은 수정하지 않았다.

Local candidate에서 `npx skills@latest add <local-repository> --skill skill-rails --agent codex claude-code gemini-cli -y`를 새 임시 Git project에서 실행했다. Installer는 skill 하나만 발견했고 canonical `.agents/skills/skill-rails`에는 61 files, `SKILL.md` 1개, repository-only directory의 file 0개가 있었다. `skills/skill-rails/` source와 설치본의 tree 비교는 missing 0, extra 0, byte difference 0이었고, 설치본 `init.mjs`로 P1 package를 생성한 뒤 설치본 `lint.mjs`가 pass했다.

제품 commit `1560bc3c3738fda85bbdd745836f7abbaebe3c2b`을 `origin/main`에 push한 뒤 `npx skills@latest add nanomia-ai/skill-rails --global --skill skill-rails --agent codex claude-code gemini-cli --yes`를 실행했다. GitHub source에서도 하나의 skill만 발견했고 전역 canonical package는 61 files, `SKILL.md` 1개, repository-only file 0개, source와 path missing/extra 0이었다. Windows checkout과 설치본의 raw SHA-256 차이 42개는 모두 CRLF/LF projection이었고 newline 정규화 뒤 content difference는 0이었다. 전역 self lint, 설치본 P1 생성과 그 package lint가 통과했으며 Claude junction은 같은 canonical package를 가리켰다. 설치 직후 CLI의 cached security summary에는 Socket 1 alert가 보였지만, 갱신된 skills.sh skill page에서 Gen Agent Trust Hub·Socket·Snyk는 모두 Pass로 확인됐다.

Targeted authoring·integration·runtime test 51/51이 먼저 통과했다. 첫 full verify에서 유일한 실패는 이동에 맞춰 frozen G0.5 scorer 자체를 수정했기 때문에 자기 hash seal과 충돌한 harness 문제였다. Frozen scorer bytes를 복원하고 repository-only bridge를 사용한 뒤 G0.5 targeted 2/2와 `npm run verify`의 vendor check, self lint, repository test 62/62, frozen G0.5 eval이 모두 통과했다. 이 변경이 fresh agent의 장기 trigger 품질을 높인다는 주장은 여전히 `UNPROVEN`이며 설치 경계 성공으로 승격하지 않는다.

### 0.4 v0.1.6 release 경계

Package source version `0.1.6`은 related-skill authoring correction `90afd43`과 P2 observation evidence correction `f269f29`를 하나의 patch 경계로 식별한다. 첫 교정은 여러 standalone skill이 shared domain input·helper를 재사용할 수 있다는 안내를 더하되 각 skill의 profile과 P2 `spec.mjs`/`body.md` 배타 소유를 보존한다. 두 번째 교정은 observation preparation을 한 owner로 통합해 missing, `null`, object-valued input, source lane, raw `"UNKNOWN"`, live/simulate/scenario/L5 parity와 evaluator-event-only coverage를 같은 의미로 고정한다.

유사 결함 범위는 collector·`fixture.s`·`judged`·`decided`의 네 입력 lane, live/simulate/scenario expectation/L5의 네 소비 경로, missing/explicit `null`/object/wrong-lane/reserved sentinel과 guard coverage credit까지 훑었다. Targeted runtime·integration 39/39, frozen G0.5 2/2, repository test 67/67과 full `npm run verify`가 통과했고 canonical pilot은 build ID `sha256:1a901e5e01b8680dcfc76140681a170aaf8a22750826bfc04c95ae0238b45736`, L0-L18, mutation 20/20, scenario 10/10·50회 불일치 0, format round trip 256/256을 기록했다. Fable xhigh와 Sol xhigh의 독립 설계·기술 검토 및 구현 후 최종 audit도 MUST-fix 없이 PASS했다.

이 patch는 새 grammar, Decision/Trace schema, effect authority, coverage token 또는 `SPEC.version = "5"` 의미를 바꾸지 않는다. 저장소 밖 version-5 package가 문서화되지 않은 raw UNKNOWN 내부 표현이나 잘못된 fixture source lane에 의존하는지는 `UNPROVEN`이며, exact raw `"UNKNOWN"`을 known application data로 지원하는 일은 별도 versioned product boundary다. 이 문서를 포함한 release commit을 `main`, annotated `v0.1.6` tag와 GitHub Release의 동일 경계로 배포했다.

Release 뒤 `skills` 1.5.23의 공식 GitHub-source 명령 `npx skills@latest add nanomia-ai/skill-rails --global --skill skill-rails --agent codex claude-code gemini-cli --yes`를 실행했다. Installer는 discoverable skill 하나를 설치했고 source와 canonical global package는 각각 62 files, `SKILL.md` 1개였다. Directory diff는 path 차이 0, CRLF를 제외한 content 차이 0이었고 installed package self lint와 설치본 creator의 임시 P0 생성·full lint가 pass했다. Canonical package는 Codex·Gemini CLI가 공유하고 Claude Code junction이 같은 경로를 가리킨다. Installer security summary의 Socket 1 alert는 외부 scanner 상태로 별도 보존하며, 기능 evidence로 이를 무시하거나 상세 원인 확인 없이 제품 finding으로 확대하지 않는다.

### 0.5 v0.1.7 release candidate 경계

Package source version `0.1.7`은 released `v0.1.6` 설치 evidence commit `e3caa49` 위에서 보존 checkpoint `d03050f`를 `git cherry-pick -n`으로 합성한 새 계보다. Mechanics commit `c739bff`는 checkpoint의 public `targetPath`/`--target`, lexical·realpath containment, collector·snapshot 전달, traced `decision_emitted.data.targetPath`와 CLI resume 연속성, read-block `pending_reads`와 `guard-pending:` evidence를 유지한다. 동시에 released observation correction `f269f29`가 소유한 두 semantic ruling을 보존한다. S1은 exact raw `"UNKNOWN"`을 every-lane version-5 reserved sentinel로 유지하고, S2는 `observations.mjs`의 fixture preparation과 L5 `checkReads`를 단일 owner로 유지한다. Checkpoint의 literal-UNKNOWN-known 해석, `normalizeFixtureObservations`, `fixtureState`는 union에 들어오지 않았다.

서로 다른 landed byte에 이미 쓰인 `0.3.0`/`0.4.0`은 재사용하지 않고 union runtime은 `0.3.1`, validator는 `0.4.1`, kernel은 `6`으로 기록했다. Package version은 `0.1.7`이다. `SPEC.version = "5"`, Decision/Trace schema, 14 closed exports, effect authority와 host permission 경계는 바뀌지 않았다. 이는 released `v0.1.6`을 다시 쓰거나 tag를 이동하는 일이 아니라 별도 release candidate다.

Focused reconciled integration regression 4/4, runtime+integration 42/42와 self lint가 pass했다. Canonical pilot은 worktree builder의 `--repeats 50`으로 재생성되어 build ID `sha256:d2855deb87b5b1b4cbcba467975cbfcc87c7661e7072ffc6478e13b85f49ca1c`, runtime/validator `0.3.1`/`0.4.1`, L0–L18, mutation 20/20, scenario 10/10·50회 불일치 0, format 256/256을 기록했고 embedded lint와 real-state e2e 2/2도 pass했다. 이 문서를 포함한 staged release-boundary tree에서 `npm run verify`를 한 번 실행해 vendor check, self lint, repository test 70/70과 frozen G0.5 eval이 모두 pass했다. Tag·push·publish·global install은 실행하지 않았고 installation evidence도 주장하지 않는다. Fresh-agent target/resume 소비, downstream Devflow 아홉 package rebuild, non-Windows symlink branch는 `UNPROVEN`이다.

## 1. 현재 결정적 검증

Package 0.1.5의 설치 product bytes는 `1560bc3c3738fda85bbdd745836f7abbaebe3c2b`에서 `origin/main`에 들어갔고 위 0.3절의 full verify, local installer와 GitHub-source global installer smoke를 통과했다. `v0.1.5` annotated tag와 GitHub Release는 이 receipt를 포함한 evidence commit을 기준으로 배포한다. P2 behavior contract는 바뀌지 않았으며 이 release의 새 주장은 distribution boundary에 한정된다.

`d74d783`은 저작 과정의 검사 시점을 논리 수렴과 살아 있는 가설에 맞추고, 생성된 P0/P1에는 비수렴에서 한 발 물러설 짧은 recovery guard를, P2에는 현재 Decision이 연 domain work 안에서만 판단하도록 하는 guard를 투영했다. 저장된 P2 stage result는 현재 task·설치 skill·project의 current Decision임을 명시하고 package와 covered project state가 변하지 않았음을 확인할 때만 재사용한다. 대화 기억, 발견한 파일, 불확실한 상태에서는 새 stage를 실행한다. Runtime, schema, Decision byte와 P2 behavior source는 바꾸지 않았다.

현재 local delta는 generic P2 loader와 operational reference를 실제 runtime contract에 맞춘다. `artifact_verified`는 current Decision의 matching `proof.reference`를 `--data`로 전달하고, route terminal은 `ROUTE:<target-id>`, alignment verdict는 실제 closed vocabulary로 표기한다. 유지보수 reference는 `--diagnose --query`와 operation별 최소 JSON shape를 제공하고, installer version은 2026-08-23 실측 snapshot으로 한정한다. Targeted generated-loader regression 1/1이 pass했고 canonical pilot은 공식 repair-generated 경로로 rebuild되어 L0–L18, mutation 20/20, scenario 10/10, 50회 반복 불일치 0, format round trip 256/256, build ID `sha256:71fe532518672eff1cc0fd1e8c2992544ca91f679f06152c08f421f91493f4c1`을 기록했다. 이는 현재 guidance의 생성·구조·결정성 증거다. Fresh consumer가 새 generic proof 문장을 실제로 따라가는 행동은 아직 `UNPROVEN`이다.

직전 `126be238574e8fb1f34caa64e241fc93e5a079dd` exact-format 기준선의 targeted runtime test는 14/14 pass했다. 당시 canonical pilot은 mutation 20/20, scenario 10/10, 50회 불일치 0, format 256/256, build ID `sha256:932d2462f413afd8c40d58a68e40f0efa4bbcd65c8b0c47a4ee16b855ea53003`, manifest content 15 + generated 37 = 52, embedded lint pass, real-state e2e 2/2를 기록했다. 당시 full `npm run verify`도 vendor pass, lint pass, repository test 60/60 pass, eval clean control valid, fixture probe 10 total / 3 divergences, seeded defects 5/5 검출, required run 8/8 충족, empirical gate pass였다. 이 receipt는 현재 후보 bytes의 full-verify 결과가 아니다.

`126be23` push 뒤 공식 installer로 만든 project-local 설치본은 Git과 같은 249개 path를 가졌고 root self-lint와 생성 pilot L0–L18이 pass했다. Windows checkout은 일반 text 파일의 line ending을 바꿀 수 있으므로 249개 전체를 byte-identical이라고 주장하지 않는다. 대신 package-root `* -text`가 보호하는 생성 pilot 54개 파일은 Git blob과 54/54 byte-identical이었고, 설치본 stage는 owning WRITE의 `format_example`과 같은 `Decision.format.example`을 출력했다.

Fresh Luna Max consumer는 이와 byte-identical한 생성 pilot을 `SKILL.md`, `references/canon.md`, `references/verify.md`, Decision/guide만 읽고 사용했다. Source inspection 없이 owning WRITE의 `format_example`을 찾아 verifier를 실행하고 같은 run에 재진입해 `stage=evidence`, `row=matching-pass`, `status=DONE`에 도달했으며 최종 lane report도 만들었다. Acquire alignment는 agent claim 때문에 `partial`, 최종 REPORT 뒤 alignment도 `agent-claim-only` 때문에 `unproven`으로 남았다. 이는 자기주장을 강한 effect 관찰로 승격하지 않는 의도된 경계다. Fresh skipped-judgment와 tampered Decision은 실행하지 않아 전체 경험적 판정은 `PARTIAL`이다.

당시 최초 full verify의 migration semantic-unit와 G0.5 scorer 실패는 제품 행동 결함이 아니라 checkout에서 raw-byte 입력이 CRLF로 바뀐 portability defect였고, 다섯 pattern의 raw-byte checkout protection으로 닫혔다. 이와 별도로 은퇴한 continuation 설계의 냉시작 행동은 [역사적 증거 카드 03](evidence/proof-03-cold-behavior_ko.md)에 보존한다. 그 카드의 bytes를 현재 package 성공으로 승격하지 않는다.

`b277a4c` (`chore: release v0.1.2`) 기준선에서 마지막으로 관찰한 값은 다음과 같다. 이 값들을 현재 tree의 결과로 인용하지 않는다.

- `npm run vendor:check`: 당시 pass
- `npm run lint`: 당시 pass
- 당시 환경 전체 test: 49/49 pass
- 당시 환경 `npm run eval`: pass
- Node 20.20.2 / 22.23.2 / 24.18.0: 각각 당시 35/35 pass
- fresh P2 L0–L18: 당시 pass
- Windows path, non-ASCII, read-only package, external state, symlink/junction boundary, snapshot stale, trace authority, build transaction을 integration test로 확인

Node 20·22·24 결과를 그때의 49개 suite 결과로 확대하지 않는다. 이번 delta에 대해 실제로 관찰한 bounded test와 pilot receipt는 6절이 소유하며, 현재 tree의 fresh full-verify 수치는 위 receipt로 별도 기록한다.

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
| same-name personal/project precedence | project-local selected in current smoke; broad rule unproven | personal overrides project by host contract; current collision and cleanup verified |
| absolute/skill-relative script invocation | verified | verified |
| read-only package + external state | verified-local | verified-local |
| long-session compaction recovery | unproven | unproven |
| hook 기반 effect interception | unsupported | unsupported |

Codex와 Claude Code는 현재 검증된 project-local adapter다. 제품의 영구 경계나 모든 플랫폼 지원을 뜻하지 않는다.

### 2.1 범용 installer와 package-local dependency smoke

2026-08-23 KST에 Node 24.18.0과 `skills` 1.5.23으로 저장소의 clone-shaped 복제본을 검사했다. 복제본에는 `node_modules`가 없었다.

- Root `SKILL.md`에서 정확히 한 개의 `skill-rails`를 발견
- `--copy`로 Codex, Claude Code, Cursor, OpenCode를 선택해 설치 명령 성공
- `.agents/skills/skill-rails`와 `.claude/skills/skill-rails`의 186개 파일 tree fingerprint 일치
- 설치 package에 `node_modules` 없음
- 설치된 creator에서 parser-backed migration을 실행해 12개 semantic atom 생성
- Atom kind가 frontmatter, heading, paragraph, nested list item, GFM row, reference definition, fenced code를 기존 fixture와 같은 순서로 보존
- 생성된 P2 package의 L0–L18 full lint pass

이 결과는 Windows에서 installer가 root package를 발견·복사하고, 별도 `npm ci` 없이 설치된 creator의 migration과 P2 build가 동작한다는 구조·실행 증거다. Commit `9e28cbf`를 `origin/main`에 배포한 뒤 별도 임시 project에서 `npx skills@1.5.23 add nanomia-ai/skill-rails`도 실행했다. GitHub 원격 source를 clone해 Codex, Claude Code, Cursor target 설치에 성공했고, `.agents`와 `.claude` tree fingerprint가 일치했으며, 설치본의 migration 12 atom kind/order와 생성 P2 L0–L18을 다시 확인했다. Cursor·OpenCode에서 fresh AI가 trigger하고 skill root를 해석해 실제 산출물을 만드는 행동 증거는 아니다.

별도의 Claude Opus xhigh read-only audit는 기존 external-import migration과 vendored-import migration의 전체 `inspectProseSkill()` JSON을 5개 corpus(12/726/331/3/1693 atoms)에서 비교했고 모두 동일했다. Bundle은 upstream `markdown-it` 14.3.0 standalone distribution과 byte-identical이고 runtime `require`/`import`가 없음을 확인했다. Audit가 발견한 Windows `core.autocrlf` checkout byte drift는 `scripts/**/vendor/** -text`로 고정했다. 이 규칙은 creator의 Markdown parser와 기존 P2 Acorn vendor를 함께 보호한다.

설치 payload는 186 files, 1,313,275 bytes였다. Root `SKILL.md`가 package boundary이므로 repository test와 설계 기록도 함께 복사된다. 이 파일들은 자동 prompt loading 경로가 아니어서 context 동작을 바꾸지 않지만, nested distribution layout보다 설치 byte 수가 크다. 이를 줄이는 repository relocation은 이번 설치 hotfix에 포함하지 않았다.

`skills` 1.5.23 자체는 Node 22.20 이상을 요구한다. Skill Rails runtime 계약은 Node 20 이상이므로, Node 20 사용자는 manual project-local clone으로 같은 package를 설치할 수 있다.

2026-08-30 KST의 v0.1.3 post-release smoke는 위 0.1절의 exact command와 clean worktree evidence를 추가했다. 성공한 installer message나 `skills list`는 배치만 증명하고 host가 실제로 어느 scope를 연 것은 증명하지 않는다. Claude retest에서 stale personal link를 제거한 것은 product 설치 절차를 추가하려는 조치가 아니라 project-local copy를 실제로 읽는지 변수를 분리하기 위한 환경 정리였다. Codex는 이번 fresh smoke에서 project-local entry를 사용했지만 이 한 관찰을 모든 host의 precedence 규칙이나 사용자 preflight로 일반화하지 않는다.

2026-08-30 KST의 v0.1.5 global smoke는 root repository가 아니라 `skills/skill-rails/` 하나만 설치하는 현재 distribution boundary를 검증했다. Codex와 Gemini CLI는 universal `.agents` canonical package를 사용하고 Claude Code는 같은 package를 가리키는 junction을 사용했다. 이는 세 target의 배치와 설치본 creator 실행 증거이며, 각 host의 fresh AI trigger·장기 session 행동을 새로 검증한 것은 아니다.

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

배포된 `0b70194`의 declared-column P2를 대상으로 한 후속 fresh-consumer composition은 `PARTIAL`이다.

- 독립 Sol은 `.selection-proof` artifact path를 찾기 위해 coordinator 답변이 필요했다.
- Fresh Fable과 Luna는 둘 다 작업을 완료했지만, 정확한 observable artifact path/grammar가 mandatory consumption set에 없어서 generated package source를 검사했다.
- 따라서 trigger와 completion은 관찰됐지만, `SKILL.md`, `enter`/`READ_FIRST`, 현재 Decision, 선택 body 또는 template만으로 닫힌 소비 경로는 관찰되지 않았다.
- Fable의 다른 alignment reason은 현재 증거상 runtime defect가 아니다. Record/alignment event는 exact Decision에 묶이며 reinvocation으로 새 Decision이 생기면 이전 Decision의 evidence가 자동 승계되지 않는다. 이전 effect 수행을 새 Decision에 claim하면 `claimed-unplanned-effect`가 되는 것이 현재 contract와 일치한다.

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

## 6. 배포된 typed-artifact·declared-column 증거와 consumer-closure correction

### 6.1 이번 delta의 정확한 범위

배포 기준 commit `0b70194`는 `5ea44c2` 위에서 generated P2 package의 raw-byte checkout portability를 닫는다. 그 배포 delta의 owning source는 `scripts/lib/generator.mjs`, `scripts/lib/build-core.mjs`, `scripts/runtime/manifest.mjs`, `tests/integration.test.mjs`, `references/authoring-workflow.md`였고, canonical rebuild가 pilot package-root `.gitattributes`, embedded runtime·schema, `.generated.json`을 갱신했다.

배포 후 fresh consumer가 같은 artifact path discoverability gap을 세 번 드러냈다. Current/HEAD 비교와 repository-wide targeted query로 확인한 실제 source 종류는 collector/judged/decided이며, collector 이름은 generic `state|git|knowledge|journal.*` 또는 local `<skill>/<source>.<field>`다. Canonical pilot의 13 collector observation은 다섯 static project path와 한 selected-file dynamic path를 읽지만, G0 fixture의 seven collector observation처럼 file이 아닌 source도 존재한다. 따라서 모든 observation에 단일 artifact를 강제하거나 `artifact:null` escape를 두는 설계는 채택하지 않았다.

현재 local correction의 단일 path 정본은 기존 `ARTIFACTS`다. `writer`는 skill/declared role 외에 `external.*`와 `project.*` actor를 허용하고, `readers`는 기존 stage/role/project/external에 `guard.<id>`를 더한다. Evaluator는 선택된 `stage.<id>`와 실제 guard `guard.<id>` reader의 교집합을 `{id,path,writer,template}`로 정렬해 required `Decision.stage_artifacts`에 싣고 guide도 같은 값을 투영한다. Authoring card/workflow는 collector와 e2e host가 같은 registry path를 재사용하게 하며 card나 collector source를 소비 surface로 credit하지 않는다. Generated loader는 current Decision의 body, `stage_artifacts`, ordered effects만 따르고 대체 path를 collector/authoring file에서 추론하지 않으며 exact-Decision evidence binding도 명시한다.

Consumer-closure owning source는 runtime evaluator·validator·guide·API·constants, Decision schema, scenario checks, generator, authoring workflow/card, canonical pilot spec·collector·fixture·real-state harness·guide, 그리고 proportional test다. Blocking follow-up은 evaluator의 stage iteration state와 alignment의 exact-Decision admission check만 고쳤고 `scripts/runtime/hash.mjs`, P0/P1 generator, Trace schema, observation source 종류, collector 문법, root repository `.gitattributes`는 바꾸지 않았다. `docs/next-core-compass_ko.md`는 이 revision에 없으며 evidence source로 추정하지 않았다.

fresh Windows verify가 드러낸 결함은 행동 구현이 아니라 checkout portability였다. `.gitattributes`에 `fixtures/migration-structures/SKILL.md -text`, `evals/g0_5/** -text`, `evals/g0/thresholds.json -text`, `scripts/lib/g05-score-v3.mjs -text`, `scripts/lib/g05-review-lint.mjs -text`를 추가해 raw-byte 입력을 보호했다. 현재 92개 matched tracked path는 보정 전에 worktree와 index 양쪽에서 사용자·coordinator diff가 없음을 확인한 뒤 각 index blob의 LF byte로만 복원했으며, 보정 후 matched path에는 수정이 남지 않았다.

### 6.2 등록된 replace-artifact 경계

`replace-artifact`는 P2 package의 whole-file 교체를 임의 소스 덮어쓰기로 넓히지 않고 닫힌 registry로 제한한다.

| kind | 허용 경로 | semantic diff source |
| --- | --- | --- |
| `spec` | `spec.mjs` | `behavior_source` |
| `collector` | `collectors/index.mjs` | `observation_source` |
| `reference` | `references/` 아래의 기존 파일 | `context` |

operation과 package profile이 모두 `p2`여야 한다. 적용 전 preflight가 다음을 거부한다.

- 미등록 kind, kind에 등록되지 않은 경로
- 형식이 `sha256:<64 hex>`가 아니거나 현재 파일과 다른 `expected_hash`
- string이 아닌 `content`
- `.generated.json`과 그 `generated_files`에 등록된 생성 경로
- 존재하지 않는 target, 정규 파일이 아닌 target
- 한 transaction 안에서 같은 physical file을 두 번 지정하는 경우
- 백슬래시, 절대 경로, 빈 segment, `.`/`..` segment를 포함하는 비-portable 경로
- target의 canonical physical 철자와 다른 표기(Windows 대소문자 alias 포함)
- 경로 상의 symlink 또는 junction

`replace-spec`는 `spec` kind로 정규화되어 기존 의미와 stale-hash 거부 문구를 그대로 유지한다. body-section, intent-patch, template, resource-creation operation의 의미는 바뀌지 않았다.

### 6.3 원자적 install과 하나의 authorized writer 경계

유지보수는 원본 fingerprint를 먼저 계산하고, stage 복사 직후 stage fingerprint가 같은지 확인하며, operation 적용과 전체 package build를 거친 뒤 build가 canonical artifact를 바꾸지 않았는지 다시 확인한다. install 직전에 root fingerprint를 재확인하고, 원본을 captured backup으로 rename한 다음 그 backup을 시작 fingerprint와 대조한 뒤에야 stage를 설치한다. 실패하면 captured backup을 삭제하지 않고, target·stage·captured_backup 경로와 `installed`, 복구 장애 사유를 오류 메시지에 남긴다.

이 원자성은 **package root를 단독 소유한 하나의 authorized writer**를 전제한다. capture 이후에도 계속 쓰는 out-of-band process를 잠그지 않으며 그 process의 쓰기 보존도 보장하지 않는다. 외부 동시성은 검증된 경계 밖이고, host ownership 증거가 없으면 `UNPROVEN`이지 성공이 아니다. 외부 process에 대한 cross-platform lock은 host 권한이며 AI-facing tool을 실질적으로 복잡하게 만들기 때문에 채택하지 않았다.

semantic diff는 `artifact_receipts`(kind, path, before_hash, after_hash, source), `source_changes`(behavior_source / observation_source / context), `any_changed`를 추가했고 기존 `spec_hash`, `changed`, `groups` 의미는 유지한다.

### 6.4 junction·symlink 폐쇄

- 유지보수 preflight가 경로 상의 symlink·junction target을 적용 전에 거부한다.
- package 복사와 파일 나열이 symlink·junction·비정규 directory entry를 명시적 오류로 거부한다.
- pilot collector는 project root와 선택 경로를 canonical하게 해석한 뒤 containment를 검사하므로, 상위 traversal·symlink·junction 탈출이 hashing 전에 fail-closed된다.

이번 실행은 Windows junction 분기만 관찰했다. 같은 test가 비-Windows host에서 POSIX directory symlink 분기를 선택하지만 그 분기는 이번 실행의 증거가 아니다.

### 6.5 이번 delta의 정확한 bounded test

Typed-artifact delta에서 `tests/authoring.test.mjs`에 추가한 두 test는 아래 경계를 단정한다. 이 test들은 배포 기준선 `0b70194`의 repository test 53/53에 포함되어 pass했고, 현재 correction의 targeted three-file run에서도 회귀 없이 pass했다.

1. `P2 typed-artifact maintenance preflights closed canonical paths and preserves legacy replace-spec`
   - spec·collector·reference 세 kind의 정상 교체가 순서대로 receipt를 남기고 `source_changes`의 세 항목이 모두 참이 된다.
   - 거부 사례(미등록 kind, cross-kind 경로, profile 불일치, stale hash, 생성 경로, 없는 target)마다 tree fingerprint가 그대로임을 확인한다.
   - 비-canonical 경로 철자, Windows 대소문자 alias 중복, symlink/junction entry를 거부한다. link를 만들 수 없는 환경에서는 해당 단정이 진단과 함께 생략된다.
   - captured backup 장애를 인위적으로 만들어 backup이 보존되고 오류가 정확한 backup 경로를 보고하며 점유된 target이 덮이지 않음을 확인한다.
   - transaction의 두 번째 operation이 실패하면 아무것도 설치되지 않는다.
   - legacy `replace-spec`가 여전히 적용되고 stale hash를 여전히 거부한다.
   - 실행 중 root에 동시 쓰기가 일어나면 설치가 중단되고 그 파일이 보존된다.
2. `semantic diff reports direct and branch effect argument changes without changing legacy verb summaries`
   - stage의 default effect plan과 branch effect plan의 인자 변화가 보고되고, 기존 verb 요약(`["RUN", "NEXT"]`)은 그대로 유지된다.

### 6.6 declared-column pilot 증거

`fixtures/next-core-single-skill-pilot/`은 검증자 주장이 기억이나 자기보고로 현재 proof가 되는 것을 막는 P2 pilot이다. pass는 검증자가 돌려준 열이 갓 수집한 사실과 모두 일치할 때만 credit된다: `task`, `snapshot`, selection locator, 선택 byte SHA-256, `continuation`, 기록된 currentness(`current`), verdict(`pass`). 재관찰은 runtime 기능이 아니라 agent 재진입(`reentry: rejudge`)이고, `DECLARATIONS`에는 `complexityBudget`만 있다.

독립 재실행으로 확인한 receipt:

| 항목 | 결과 |
| --- | --- |
| root full lint | L0–L18 pass, 진단 0 |
| formal build (`--repeats 50`) | mutation 20/20, scenario 10/10, 50회 반복 불일치 0, predicate 성능 한도 내, format round trip 256/256 및 CR/LF 거부 |
| 재현 build | 저장소 밖 임시 복제본에서 재build 후 in-repo package와 파일 차이 없음 |
| 내장 lint / real-state e2e | pass / 2/2 pass |
| manifest 선언 hash | content 15 + generated 37 = 52 |
| package 규모 | skill 54 파일, pilot root 5 파일 |

수치는 pilot 보고서가 각 receipt의 재현 명령과 함께 소유한다. 은퇴한 설계(continuation receipt, singleton recorded-JSON 상관, 합성 runtime-state fixture)는 mechanism과 함께 제거했고, 그 흔적은 pilot 보고서의 부록 한 줄로만 남는다.

### 6.7 P2 package byte 소유권과 version-5 호환

Fresh `core.autocrlf=true` clone은 repository verify 52/52를 통과했지만, 기존 pilot package manifest는 checkout newline 변환 뒤 14개 mismatch를 냈고 real-state e2e는 0/2였다. Hash를 정규화하면 raw-byte sealing을 약화하므로 채택하지 않았다. 대신 P2 build가 정확히 `* -text\n`인 package-root `.gitattributes`를 생성하고 manifest `generated_files`에 봉인한다. 기존 비정본 파일은 자동 병합·덮어쓰지 않고 `SR_GENERATED_COLLISION`으로 멈추며, manifest가 소유하지 않은 정본 파일도 명시적 `--repair-generated` rebuild 전에는 ownership을 가져오지 않는다. P0/P1 package shape와 root corpus용 다섯 `-text` pattern은 그대로다.

배포 기준선 `0b70194`의 byte-portability delta는 P2 version-5 Decision 의미를 바꾸지 않았다. 근거는 다음과 같다.

- `scripts/runtime/manifest.mjs`는 생성 파일의 필수 집합에 `.gitattributes`를 추가했지만 hashing, Decision 계산, schema에는 normalization이나 새 의미를 추가하지 않았다. 당시 `schemas/`와 P2 계약 의미는 변경하지 않았다.
- pilot package가 내장한 runtime과 schema는 canonical build input에서 생성되며, 생성 package는 진입점 네 개와 package byte 보존용 `.gitattributes`만 추가한다.
- pilot은 기존 stage `reentry` 값과 기존 표·format 문법만 사용하며 새 runtime mode, 새 declaration, 새 alignment 기대 종류를 추가하지 않는다.
- `replace-artifact`는 authoring/유지보수 도구 표면이고 생성 package의 실행 계약이 아니다.

현재 consumer-closure correction은 별도 version-5 Decision 확장이므로 7절 Decision 변경 원장에 새 행을 추가한다.

### 6.8 `f8f4204` 기준선의 fresh-consumer 판정

- `0b70194`의 full `npm run verify` receipt는 vendor pass, lint pass, repository test 53/53 pass, eval clean control valid, fixture probe 10 total / 3 divergences, seeded defects 5/5 검출, required run 8/8 충족, empirical gate pass다. Exact `.gitattributes` P2-only 생성, manifest sealing, collision 무변경, ownership transfer, rollback·반복 byte 안정성·tamper 거부가 포함된다.
- `0b70194`는 `origin/main`에 push·배포되었고 그 bytes를 대상으로 Sol/Fable/Luna fresh-consumer 실행을 마쳤다. 세 실행은 package trigger와 종료 가능성을 관찰했지만 path discovery workaround가 필요했으므로 composition은 `PARTIAL`이다.
- Sol은 `.selection-proof` path를 coordinator에게 물었고, Fable과 Luna는 완료를 위해 generated package source를 검사했다. Authoring card나 collector에만 있는 정보는 declared consumer consumption set의 일부가 아니므로 이 workaround를 consumer closure 성공으로 credit하지 않는다.
- Fable의 reinvocation 차이는 exact-Decision evidence scope로 설명되지만 final-diff audit는 alignment admission 자체의 별도 결함도 재현했다. 이전 구현은 same `decision_id`만으로 event를 scope하고 supplied Decision과 emitted Decision의 exact equality를 확인하지 않아 obligations를 지운 문서를 `aligned`로 올릴 수 있었다. 현재 `alignDecision`은 supplied Decision self-seal과 같은 ID의 runtime-observed `decision_emitted` document에 대한 stable structural equality를 expectation 계산 전에 요구한다. 실패는 empty expectations와 critical `misaligned` issue로 닫히며, 정확히 bind된 Decision에서 behavior evidence만 빠진 경우는 계속 `unproven`이다.
- `f8f4204` correction은 `ARTIFACTS.readers`를 선택된 stage/guard의 정적 소비 연결로 사용하고 required `Decision.stage_artifacts`와 guide에만 project한다. 별도 path registry, `OBSERVATIONS.artifact`, null escape, semantic path scanner, cross-skill composition은 추가하지 않는다.
- 구조적 falsification은 네 층이다. Synthetic runtime test가 선택되지 않은 stage artifact를 숨기고 active guard artifact만 더하는 exact projection을 확인한다. Pilot integration test는 static consumer dependency 한 개의 `stage.acquire` reader를 제거하면 scenario의 exact `stage_artifacts` expectation이 L14로 실패함을 확인한다. Alignment regression은 `effects`, `proof_required`, `restrict`, `stage_artifacts`, `decision_id`를 각각 변조해 public API와 CLI가 expectations를 만들기 전에 모두 `misaligned`로 닫힘을 확인하고, record의 exact-match 거부와 정상 문서 수락도 함께 보존한다. Stage-coherence regression은 judgment `NEXT` skip 뒤 선택된 stage의 stage·row·effects·record/body·proof·reinvoke·`stage_artifacts`가 모두 같은 두 번째 stage에서 나옴을 확인한다.
- `f8f4204` correction의 targeted receipt는 runtime/authoring/integration 48/48 pass다. 당시 canonical pilot root lint는 L0–L18 pass이고 rebuild는 mutation 20/20, scenario 10/10, 50회 불일치 0, format 256/256, manifest 15 + 37 = 52, real-state e2e 2/2이며 build ID는 `sha256:125adab7ef7a6e172272ada9dc247a8fdd9470c7d99fa649aa13f5b828a5bb11`이었다.
- Decision schema는 `skill-rails/decision/1`에서 `/2`로 올라갔고 validator/runtime version은 각각 0.3.0/0.2.0이다. 기존 P2 generated package는 새 필드를 얻으려면 canonical rebuild가 필요하며, P0/P1 package와 Trace schema에는 migration이 없다.
- Canonical build 뒤 이 변경에 대해 정확히 한 번 실행한 full `npm run verify`는 vendor pass, lint pass, repository test 58/58 pass, eval clean control valid, fixture probe 10 total / 3 divergences, seeded defects 5/5 검출, required run 8/8 충족, empirical gate pass였다. Commit과 `origin/main` 반영은 현재 기준선에서 확인되지만, source inspection 없이 corrected Decision/guide만으로 닫히는 fresh-consumer path discovery는 아직 `UNPROVEN`이다. 여러 static input, non-file observation, stopping guard, skipped judgment stage, dynamic target, Decision tamper와 reinvocation을 한 fresh consumer에서 연결하는 audit 제안 stress scenario도 설계만 존재하고 실행하지 않았다.
- 검증자 정직성, public lane의 harness-trusted effect 관찰, 비-Windows POSIX symlink, long-session/compaction, out-of-band writer 보존도 여전히 `UNPROVEN`이다.

### 6.9 final-gate coverage와 simple-lint correction

설치된 `f8f4204` byte의 두 독립 audit가 서로 다른 authoring gate 모순을 재현했다. P2에서는 L14가 judgment `skip:["NEXT"]` branch fixture를 요구하지만 build가 final Decision만으로 coverage를 재계산해 정직한 claim을 거부했다. P1에서는 universal intent가 이미 `SKILL.md`에 보존되어도 canonical helper target 파일에 같은 영어 문장을 다시 넣어야만 `projected`가 되어, 공개 workflow의 “target은 구현, evidence는 그 check”와 충돌했다.

P2 correction은 `evaluateSpec`의 optional internal observer와 `simulateSkill` 전달 경로를 사용한다. Evaluator가 predicate를 실제로 평가한 흐름에서만 `guard_matched`, `stage_entered`, `branch_selected`, `table_row_selected`를 내고 build-core는 그 event를 기존 coverage token으로 project한다. `coverageFor`의 guard predicate replay와 final-Decision stage/row projection은 제거했다. Valid skipped-NEXT package build pass, missing skip claim의 정확한 L14 fail, `done === true` fixture의 false skip claim 거부, observer 유무에 따른 Decision JSON/hash 완전 동일을 test가 고정한다. Canonical pilot embedded runtime은 정본에서 rebuild했으며 공개 Decision·Trace schema와 runtime/validator version은 바꾸지 않았다.

P0/P1 correction은 Rule V가 이미 소유하는 universal intent atom에만 per-target exact-sentence conjunct를 제거한다. `SKILL.md` 원문 가시성, `intent.description`의 frontmatter equality, routed topic `when`/point의 index·topic text, `file:`/`eval:` locator resolution, generator의 `review-required` 기본값, eval의 `authoring-obligations-required` gate는 그대로다. P1 helper target에 원문을 복제하지 않은 정상 discharge, `SKILL.md` 원문 삭제·topic text 삭제·description mismatch·unresolvable locator 실패, open obligation eval 실패를 targeted test가 확인했다. 이 실행은 deterministic authoring/build evidence일 뿐 fresh author 또는 consumer 행동 evidence가 아니다.

### 6.10 pushed byte의 fresh author·consumer audit

공식 `npx skills@latest add nanomia-ai/skill-rails ... --copy --yes` 경로로 Codex와 Claude의 별도 project-local home에 설치했고, 두 설치본의 249개 파일은 exact `770cd3755d23c17a626822079c47d17b8387b326` Git archive와 path·byte가 모두 같았다.

Fresh Sol xhigh author는 release-note drafter를 P1로 선택하고 AI의 포함·category 판단과 helper의 parsing·validation·exact rendering을 분리했다. 최종 package는 11/11 helper test, full lint, 338-byte held-out equality, `open_obligations: 0`, `behavior.status: unproven`, `release_readiness: forward-test-required`를 기록했다. Helper와 test target은 intent 원문을 복제하지 않고 `file:` locator로 obligation을 닫았다. 첫 test harness가 `os.tmpdir()` 아래 directory 3개를 만든 것은 lane containment 실패이며 제품 성공으로 세지 않는다. 해당 directory는 cleanup 금지 때문에 보존했다.

Fresh Fable Max consumer는 stopping guard, 여러 static artifact, dynamic target descriptor와 live digest, argv verifier channel, agent-only effect claim의 `unproven` 유지, runtime-verified file proof, same-run fact recollection을 관찰했다. 최초 agent는 acquire Decision에 이미 있던 `format.example`을 요약에서 누락한 뒤 22개 임의 serialization을 시도하고 “public grammar가 없다”고 잘못 분류했다. Coordinator가 drift를 중단하고 같은 terminal에 명시된 example 한 가지만 재검증시켰다. Exact example에 live value를 대입하자 `result.verdict: pass`, `unknowns: []`, `status: DONE`, `stage: evidence`, `row: matching-pass`가 나왔다. 따라서 public-guidance product falsification은 철회하고 model/harness extraction 오류로 분류한다.

이 audit에서 fresh skipped-judgment branch, tampered-Decision rejection, evidence-stage REPORT record/align은 실행하지 않았다. 35/35 deterministic regression이 skip leakage와 tamper rejection을 확인하지만 fresh behavior evidence로 승격하지 않는다. Post-push product falsification은 관찰하지 않았고 전체 empirical scope는 `PARTIAL`이다.

### 6.11 적응형 저작 판단과 현재 Decision handoff 명료화

저작 진입점의 `매 편집 후 lint`는 논리 수렴 전 작은 수정마다 검사를 강제해 비수렴을 키울 수 있으므로, 의미 있는 변경 묶음이나 살아 있는 가설을 반증할 때 fast lint를 사용하고 설계 수렴 뒤 full lint·P2 build를 수행하도록 고쳤다. 공개 `Authoring judgment`가 사용자 목적과 실행 계약의 충돌 해결, 실패한 check의 product·fixture·harness·environment 전제 분리, 생성 스킬에 허용되는 짧은 recovery guard의 권한 경계를 소유한다. 상세 한국어 경험 문서는 맥락만 보존하고 생성 패키지에 복제하지 않는다.

공개 `Authoring judgment`는 사용자 결과와 스킬이 해결할 근본 문제를 설계 기준으로 두고, 반복 작업이 결과를 더 가깝게 만들지 못할 때 현재 구현보다 framing·root cause·owning boundary와 더 단순한 대안을 다시 보게 한다. 방향 원칙과 별도로 네 개의 범용 실패 사례가 행동·잘못된 전제·나쁜 결과의 인과를 보존하며, 표면 유사성이 아니라 같은 원인과 결과가 재현될 때만 적용한다. 새 evidence에 따라 해결 방법을 바꿀 수 있고 긴 문맥에서 필요할 때만 목적을 복기하지만, 정상적인 국소 수정에는 재기획을 요구하지 않는다. 정확 형식, Decision, evidence, 불가역 경계와 단일 정본은 그대로 구속하며 생성 P0/P1·P2 recovery guard는 바꾸지 않았다.

현재 문구는 Fable xhigh의 기존 read-only 설계 감사에서 도출한 evidence-bound 인과 기준을 재사용하고, 최종 failure-case bytes를 기존 Sol xhigh 감사 에이전트가 다시 반증했다. Sol은 방향과 사례의 역할 분리, 네 사례의 인과, 정상 국소 수정의 비과잉 경계를 소폭 보완 후 통과로 판정했다. 이전 fresh Sol xhigh 행동 gate는 현재 failure-case bytes를 읽지 않았으므로 fresh-author 행동은 다시 관찰하기 전까지 `UNPROVEN`이다.

P0/P1 생성물은 작은 수정과 예외가 늘지만 사용자 결과가 가까워지지 않을 때 결과와 접근을 다시 보도록 하되 의미·형식·비가역 경계·완료 증거를 계속 구속한다. P2 생성물은 판단을 현재 Decision이 열어 둔 domain work로 제한하고 Decision·evidence·loader step을 우회하지 못하게 한다. 저장된 stage result는 현재 task가 이 설치 skill과 project의 current Decision으로 명시하고 package와 covered project state가 생성 이후 변하지 않았음을 확인할 때만 소비하며, 발견한 파일·대화 기억·불확실한 상태에서는 반드시 새 stage를 실행한다. 이는 loader guidance correction이며 runtime, schema, Decision byte, P2 behavior source를 바꾸지 않는다.

Targeted profile-generation integration은 P0/P1/P2 projection과 fail-closed stage fallback을 pass했다. Canonical P2 pilot build는 L0–L18, mutation 20/20, scenario 10/10, 50회 반복 불일치 0, format round trip 256/256을 pass했고 build ID는 `sha256:e93fc57d5e748859c3f955184d4d86de9c0d946a620b51dca8d08b4102a2f06e`다. 이 증거는 생성·구조·결정성만 증명한다. Fresh consumer가 recovery guard와 saved-Decision 조건을 실제로 올바르게 해석하는 행동은 `UNPROVEN`이다.

### 6.12 Generic operational guidance 정합화

두 독립 read-only audit가 같은 public-path gap을 확인했다. Runtime은 `artifact_verified` proof를 `data.reference`로 선택하지만 generic generated loader와 P2 계약 예시는 그 값을 전달하지 않았고, pilot 전용 `references/verify.md`와 harness가 별도로 올바른 값을 공급해 누락을 가렸다. Generator와 P2 계약은 current Decision의 matching `proof.reference`를 `--data`로 전달하도록 맞췄다. 같은 audit에서 effect terminal의 plain `ROUTE`를 실제 validator 문법인 `ROUTE:<target-id>`로, evaluation의 존재하지 않는 `not_applicable` verdict를 실제 alignment vocabulary로 고쳤다.

Authoring workflow에는 이미 구현된 P2 `maintain --diagnose --query`와 `update-intent`, `replace-body-section`, `replace-resource`, `replace-artifact`의 최소 change shape를 추가했다. 이는 새 maintenance mechanism이 아니라 cold maintainer가 source/test를 열어 public JSON envelope를 역추론해야 했던 문서 공백을 닫는다. `skills` 1.5.23은 최신 주장 대신 2026-08-23 실측 installer snapshot으로 한정했다.

Generated-loader targeted regression 1/1이 pass했고 canonical pilot은 generated file을 직접 편집하지 않고 repair-generated rebuild로 갱신했다. 결과는 L0–L18, mutation 20/20, scenario 10/10, 50회 반복 불일치 0, format 256/256, build ID `sha256:71fe532518672eff1cc0fd1e8c2992544ca91f679f06152c08f421f91493f4c1`이다. 이어 현재 후보 bytes에서 한 번 실행한 full `npm run verify`는 vendor pass, root lint pass, repository test 60/60 pass, eval clean control valid, fixture probe 10 total / 3 divergences, seeded defects 5/5 검출, required run 8/8 충족, empirical gate pass였다. Runtime, schema, Decision byte, spec behavior source는 바뀌지 않았다. Fresh agent가 이 수정된 generic guidance만으로 proof를 기록하는 행동은 아직 `UNPROVEN`이다.

### 6.13 관련 skill suite의 공유 규칙 소유 경계

Devflow의 실제 포팅 피드백은 구현 차단이나 P2 core 결함이 아니라 첫 저작 진입점의 범위 설명 공백으로 분류했다. Maintainer 설계에는 이미 한 번에 standalone skill 하나를 만든다는 경계가 있었지만 설치된 `SKILL.md`와 저작 workflow만 읽는 cold author는 여러 skill이 한 규약집을 공유할 때 프로필, 기계 규칙, 판단 문서의 소유자를 바로 찾기 어려웠다. 활성 Devflow worktree나 그 결과물은 이 판단과 변경을 위해 열거나 수정하지 않았다.

변경은 한 target skill마다 프로필을 독립 선택한다는 경계와 관련 skill suite의 공유 domain material을 연결하는 방식을 설치 경로에 추가한다. 반복 가능한 공통 domain operation은 repository-owned helper·validator·harness에 둘 수 있고, 공통 domain 지식과 판단 문서는 안정적인 path·heading을 가진 한 정본으로 유지한다. 각 skill은 cold consumer가 반드시 알아야 하는 보편 경계·중지 조건·최소 해석만 mandatory path에 포함하고 나머지는 필요한 때와 이유가 명확한 durable dependency로 연결한다. P0/P1은 기존 `external_dependencies`를 사용하며, generated skill이 다른 skill을 호출하거나 전체 규약집을 기본 로드하게 하지 않는다.

P2에서는 shared file이나 helper가 소비되는 domain input 또는 implementation일 뿐 두 번째 behavior source가 아니다. Observable condition, guard, stage, table, exact format, ordered effect, ownership, completion evidence는 계속 `spec.mjs`가 배타 소유하고, judgment criteria와 그 적용 framing은 `body.md`가 소유한다. 외부 project input/context path는 기존 `ARTIFACTS`의 `project.*`/`external.*` writer와 stage·guard `readers`를 통해 Decision `stage_artifacts`에 선언이 투영될 수 있지만, 이 선언은 path 존재·file contents·freshness·behavior·judgment·evidence authority를 검증하거나 부여하지 않는다. 공유 source에서 여러 P2 package 정본으로 자동 투영하는 기능은 구현되지 않았고 `UNPROVEN`이다.

이는 workspace policy engine, cross-package runtime, 자동 fan-out, shared-source compiler를 추가하지 않는다. Generator, runtime, schema, Decision byte, effect authority, `SPEC.version = "5"`와 P2 self-contained package 경계는 모두 그대로다. 최초 Fable xhigh 설계 반증과 Sol xhigh 기술 검토는 안내-only 최소 변경에 합의했지만, commit 후 교차 재검토에서 Sol이 profile-generic shared-owner 문구와 P2 배타 소유 계약 사이의 합성 모호성을 MUST로 발견했다. Fable은 현재 P2 contract와 validator/evaluator를 다시 대조한 뒤 기존 PASS를 철회하고 이 반증을 좁은 P2 문구 결함으로 확인했다. 최종안은 shared asset의 재사용 이점은 보존하되 P2 정본과 evidence authority를 명시적으로 돌려놓는 것으로 중재했다.

최초 Fresh Claude Sonnet high는 당시 설치 `SKILL.md`와 그 문서가 명시적으로 연결한 `authoring-workflow.md`만 읽고 낯선 세-skill compliance 반례를 풀어 profile-local 선택, repository helper, 필수 경계의 mandatory 배치, 큰 판단의 조건부 소비, cross-skill runtime 금지를 도출했다. 그러나 이 probe는 P2 내부에서 exact behavior와 judgment의 최종 소유자를 충분히 분해해 관찰하지 않았고, 그 뒤 합성 문구가 교정됐으므로 현재 bytes의 fresh-author 행동 증거로 승격하지 않는다. 교정 뒤 새 Fresh Sonnet high는 `spec.mjs`와 `body.md`의 배타 소유, shared file/helper의 input·implementation 한정, cross-skill runtime 금지를 올바르게 도출했지만 `ARTIFACTS` path 선언을 file 존재 증거로 한 단계 과장했다. 따라서 P2 소유 합성 행동은 PASS, artifact presence authority 해석은 FAIL로 분리했고 현재 문구에 존재·내용·freshness 비증명 경계를 추가했다. 마지막 교정 뒤 또 다른 Fresh Sonnet high가 `SKILL.md`와 routed `p2-contract.md`만 읽고, 선언이 project-relative path·writer·reader와 active stage 투영만 성립시키며 path 존재·실제 write·내용 유효성·freshness·stage verification은 별도 observation·digest·verifier·trace 없이는 모두 `UNPROVEN`이라고 답해 이 좁은 authority 해석은 PASS다.

새 회귀 검사는 설치 경로가 이 경계를 계속 노출하는지와 실제 P0 생성물이 `docs/compliance.md#incident-identifiers` 같은 정밀한 shared dependency를 cold-user path에 투영하는지를 확인한다. 최초 새 assertion의 heading 대소문자 불일치는 generator 결함이 아니라 test expectation 오류로 분류해 expectation만 실제 `External Dependencies`에 맞췄다. 현재 후보에서 `npm run verify`는 vendor check, self lint, repository test 64/64, frozen G0.5 clean control, fixture probe 10 total / 3 divergences, seeded defects 5/5, required run 8/8, empirical gate를 모두 통과했다.

여전히 `UNPROVEN`인 것은 실제 여러 package에서 shared rulebook 변경이 장기간 국소적으로 유지되는지, 다른 모델·host도 같은 최소 소비를 선택하는지, section-only 소비가 실제 토큰을 절약하는지, Devflow가 이 안내만으로 별도 seam audit를 줄이는지다. 두 독립 프로젝트에서 반복 fan-out drift가 관찰되기 전에는 workspace compiler나 provenance grammar를 core에 추가하지 않는다.

### 6.14 L14 관찰 정규화와 guard coverage 신뢰 교정

Devflow가 보고한 “값을 읽지 못한 guard가 테스트된 것으로 보일 수 있다”는 문제를 최신 후보 byte에서 독립 재현했다. Live `stage`는 collector와 `judged`/`decided` 값을 `UNKNOWN`으로 정규화해 predicate 전에 막았지만, `simulate`는 fixture `s`만 정규화한 뒤 `judged`/`decided`를 raw overlay했고 scenario expectation과 L5 exclusive-table 검사는 세 lane을 raw object spread로 합쳤다. 따라서 같은 fixture가 live에서는 predicate 미실행 `BLOCK`인데 simulate/scenario에서는 raw 문자열을 읽어 `guard_matched`를 만들 수 있었다. Build가 실제 evaluator event만 coverage로 인정하는 원칙은 옳았고, 그 event를 만드는 입력 의미가 source lane마다 달랐던 것이 제품 결함이었다.

교정은 새 grammar나 scorer를 추가하지 않고 `observations.mjs` 하나가 presence, snapshot binding, source lane, version-5 `UNKNOWN`, domain, flat/nested state, unknown receipt를 소유하게 했다. Collector는 raw 관찰 adapter, API와 scenario/L5는 같은 preparation owner의 소비자가 됐다. `null`처럼 존재하지만 domain 밖인 값은 누락으로 바뀌지 않고 fail-closed하며, object-valued observation은 중첩 fixture에서도 하나의 값으로 유지된다. `fixture.s`가 `judged`/`decided` source를 대신할 수 없고, L5도 evaluator의 `checkReads`를 통과한 row만 predicate로 평가한다. Runtime은 `0.2.1`, validator는 `0.3.1`로 patch 상승했지만 Decision schema, 14 exports, `SPEC.version = "5"`, effect authority와 coverage token은 그대로다.

Fable xhigh는 장기적으로 raw 문자열과 meta-state를 완전히 분리하는 out-of-band fixture 표현이 더 자연스럽다고 반증했고, Sol xhigh는 이를 version 5에 즉시 넣거나 path/text의 `"UNKNOWN"`을 known data로 바꾸면 기존 fail-closed 실행이 effect-capable로 뒤집힐 수 있다고 지적했다. 중재안은 version-5에서 exact raw `"UNKNOWN"`을 모든 top-level observation domain의 예약 compatibility sentinel로 명문화하고, 새 collector는 branded `UNKNOWN`/`unknown()`을 쓰게 하는 것이다. Domain별로 같은 byte의 의미가 바뀌는 규칙과 새 fixture 문법은 채택하지 않았다. Exact raw 문자열 `"UNKNOWN"`을 known application data로 지원하는 일은 현재 결함 수정이 아니라 별도 versioned product boundary다.

Targeted runtime·integration은 39/39 pass했다. 새 회귀는 `s`/`judged`/`decided`의 missing·raw/tagged UNKNOWN, object observation, `null` presence, wrong-lane fixture를 확인하고, live와 simulate가 같은 missing guard를 effects 없는 `BLOCK + needs`로 계산하는지 검증한다. Known positive fixture만 `guard_matched` credit을 얻고 missing fixture의 false coverage claim은 build suite가 거부한다. Canonical pilot은 generated file을 손으로 고치지 않고 공식 `--repair-generated --repeats 50` 경로로 rebuild했으며 build ID `sha256:1a901e5e01b8680dcfc76140681a170aaf8a22750826bfc04c95ae0238b45736`, L0–L18 pass, mutation 20/20, scenario 10/10·50회 불일치 0, format 256/256을 기록했다. 이어 현재 후보 전체에서 `npm run verify`를 한 번 실행해 vendor check, self lint, repository test 67/67, frozen G0.5 clean control과 seeded defect 5/5, required run 8/8, empirical gate를 모두 통과했다.

현재 `UNPROVEN`은 저장소 밖 version-5 package가 문서화되지 않은 raw sentinel 내부 표현이나 잘못된 fixture source lane에 의존하는 수량이다. 올바른 version-5 package는 rebuild만으로 patch runtime을 받으며 spec/fixture migration이 필요 없다. Literal `"UNKNOWN"` data 지원, out-of-band unknown fixture grammar, Decision schema 변경은 이 수정에 포함하지 않는다.

### 6.15 Caller-selected P2 stage target 공개 계약

Phase-4 실측 R1은 generated Work package가 이미 exact active card를 알고도 public `stageSkill`/CLI가 그 path를 받을 수 없어, collector가 argv나 project card state를 사적으로 다시 해석하거나 runtime을 우회하게 되는 owning-boundary 결함을 드러냈다. Devflow 전용 `cardPath`, judged/decided 오용, first-card 추론, 범용 context bag은 두 번째 truth owner와 숨은 모호성을 만들기 때문에 채택하지 않았다.

Public stage API는 optional string `targetPath`, CLI는 stage 전용 `--target <project-relative-path>` 하나만 추가한다. Runtime은 non-empty portable relative path에서 empty/`.` segment만 제거하고 absolute, backslash, drive-like colon, 모든 `..` segment를 거부한 뒤 lexical·realpath containment를 검사한다. 유효한 값은 같은 normalized string을 observation collector와 custom `snapshotBasis`의 `ctx.targetPath`에 전달한다. Target이 없으면 이 property 자체를 생략해 기존 collector/snapshot context를 보존한다. Target은 judgment나 decided domain value가 아니고 Decision에 새 parallel field로 들어가지 않으며, package의 declared collector가 ordinary observation과 snapshot material로 만들 때만 기존 snapshot→Decision 경로에 참여한다. 존재, regular-file 여부, 내용 유효성, freshness는 계속 collector가 별도 관찰한다. Trace가 켜진 stage는 normalized target이 있을 때만 기존 `decision_emitted.data.targetPath`에 그 값을 붙이고, deferred·stale·일반 Decision emission 모두 같은 projection을 쓴다. CLI `resume`은 마지막 `decision_emitted`의 값을 안전하게 quote한 `--target`으로 `next_command` 끝에 다시 붙인다. Target이 없는 event data와 resume command는 이전 shape 그대로이며, 이는 Decision field나 같은 run-id에서 target 변경을 금지하는 invariant가 아니다.

Canonical generator와 routed P2/authoring guidance는 task나 role이 이미 한 target을 선택한 경우에만 `--target`을 공급하고 그 외 package에서는 생략하도록 갱신했다. Released runtime `0.2.1`에서 target-bearing union runtime `0.3.1`로 올렸고, read-block coverage semantics는 validator `0.3.1`에서 `0.4.1`로 올렸다. P0/P1, `SPEC.version = "5"`, `KERNEL_VERSION = "6"`, Decision/Trace schema, closed exports, effect authority는 바뀌지 않았다. Canonical pilot은 generated file을 손으로 편집하지 않고 `node skills/skill-rails/scripts/build.mjs --skill fixtures/next-core-single-skill-pilot/skill --repeats 50 --json`으로 rebuild했다. Pilot spec·fixture·schema·domain behavior는 그대로이고 build ID는 `sha256:d2855deb87b5b1b4cbcba467975cbfcc87c7661e7072ffc6478e13b85f49ca1c`이다.

Rollback regression은 generic generated P2 package에서 public API와 CLI의 normalized target equality, collector fact delivery, target-aware snapshot fingerprint, target-absent legacy context, absolute·traversal·non-string 거부, Windows junction physical escape 거부를 같은 public surface로 확인한다. 같은 test가 target-bearing normal·deferred emission과 stale regression의 normalized trace data, resume의 quoted 동일 target, target-absent event data의 기존 object shape와 flag 없는 resume command도 확인한다. Focused reconciled regression 4/4, runtime+integration 42/42, self lint, pilot L0–L18·mutation 20/20·scenario 10/10·repeat 50·format 256/256이 pass했다. Fresh-agent target 소비와 resume 실행, 실제 Devflow empirical scenario, non-Windows POSIX symlink branch는 `UNPROVEN`이다.

### 6.16 Read-block guard trace와 coverage token 정직성

Unknown read로 guard가 중단될 때 evaluator는 기존 BLOCK Decision·needs·predicate 의미를 유지하면서 `guard_matched`를 먼저 내보내고 `pending_reads`를 기록한다. `guard_evaluated`는 reads가 해결되고 predicate가 실행된 경우에만 남겨 trace가 실제 실행을 단일 source로 설명한다. 따라서 build의 `coverageFor`는 predicate가 실제 match한 event를 `guard:<id>`, unresolved required read로 BLOCK한 event를 `guard-pending:<id>`로 각각 project하며, L14는 두 token 중 하나를 허용하되 fixture claim과 실제 event의 mode가 어긋나면 full build가 거부한다.

회귀는 omitted와 raw `"UNKNOWN"` decided input이 같은 BLOCK·needs로 수렴하고 `pending_reads`가 있는 observer/trace에서도 Decision이 변하지 않는지 확인한다. Pending token을 actual-match fixture에 붙이거나 actual token을 read-block fixture에 붙이는 양방향 false claim은 거부된다. 이 교정은 fixture materialization의 두 번째 owner를 만들지 않으며 released 6.14절의 observation preparation과 L5 `checkReads`를 그대로 소비한다.

---


## 7. P2 version-5 보존 및 변경 원장

### 7.0 Version-5 Decision 위치 보존

Version-5 기준선의 18개 공개 위치는 현재 typed Decision에서 다음과 같이 보존한다.

| version-5 위치 | 현재 Decision |
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

`schema`, `decision_id`, `spec`, `runtime`, `status`, `reads`, `needs`, `stage_artifacts`, `proof_required`, `reinvoke`, `assurance`은 replay, consumer discovery, evidence 경계를 위한 명시적 확장이다.

### 7.1 그대로 보존한 핵심

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
- record와 alignment evidence의 exact-Decision scope; alignment는 supplied self-seal과 runtime-emitted structural equality를 먼저 요구하고, reinvocation은 같은 run에서도 새 Decision이며 이전 evidence를 자동 승계하지 않음
- 단일 obligation ledger 안의 migration atom과 source provenance
- authoring card와 obligation atomization
- 제품 가설을 먼저 반증하는 G0.5
- effect interception은 미래 또는 별도 범위

### 7.2 명시적으로 변경·확장한 항목

| version-5 기준 | 현재 구현 | 이유와 보존 방식 |
| --- | --- | --- |
| cross-skill import/composition surface | `SPEC.profile="single"`과 `SPEC.imports=[]`만 허용하고 foreign body reference를 거부 | 단일-skill 경계를 지키고 activation·handoff drift를 만들지 않음 |
| source-first lint, sandbox 아님 | positive-list AST + every-load L-fast + authoring L-structural + build-only L-full + verified same-process ESM | arbitrary code 신뢰를 줄이되 별도 interpreter로 의미를 복제하지 않음 |
| version-5 kernel 8줄의 행동 위치 | versioned Decision과 compact guide에 해당 의미 통합 | record/proof, evidence-backed skip, ASK/receipt 예외, enter-hash를 명시하며 별도 kernel 문서를 행동 정본으로 두지 않음 |
| stage JSON 18 위치 | versioned typed Decision + fingerprint | 18 위치 대응표를 보존하고 stale/replay/proof 정보를 추가 |
| 기본 stage text | 같은 Decision의 compact guide | 전체 JSON/body 대신 현재 행동만 읽게 함 |
| stage evidence 중심 | trace authority + alignment | “해야 함”과 “실제로 했음”을 분리하고 증거가 없으면 `unproven` |
| runtime state 위치가 암묵적 | skill root 밖 명시적 state directory | read-only install과 upgrade 안전 |
| repository runtime 공유 | generated P2마다 self-contained runtime | installer 없이 독립 배포하고 runtime hash로 stale copy 탐지 |
| ko/en body pair 중심 | 기본 single-language, `body_ko.md`가 실제로 있을 때만 parity 검사; 없는 언어를 `--lang`으로 요청하면 fallback하지 않고 L7로 거부 | 불필요한 이중 body와 잘못된 언어의 조용한 대체를 피함; 별도 pair-profile selector는 아직 없음 |
| context recovery와 interception의 경계가 약함 | enter-hash recovery와 effect interception을 분리 | 복구를 enforcement로 과장하지 않음 |
| 기존 gate 묶음 | G0.5, authoring/runtime/platform/eval gate 분리 | 가장 위험한 제품 가설을 먼저 중지 가능 |
| 복잡 skill 중심 | P0/P1/P2 최소 충분 profile | version-5 P2 계약을 축소하지 않고 단순 skill 과설계를 방지 |
| P0/P1 판단 산문이 한 `SKILL.md`에 집중 | profile과 독립적인 conditional guidance index + stable topic files | 큰 판단형 skill을 P2로 올리지 않고 필요한 산문만 읽게 하며 보편 경계·정확 형식·stop rule은 entry에 유지 |
| 선택된 stage/guard의 project artifact path가 Decision에 없음 | `ARTIFACTS.readers`에서 required `Decision.stage_artifacts`와 guide를 계산 | 기존 ARTIFACTS를 path·writer·template의 단일 정본으로 유지하면서 소비 AI가 collector/source inspection 없이 현재 정적 의존성을 찾게 함; non-file observation과 stage 선택 전 동적 입력에는 artifact/null을 강제하지 않음 |
| alignment가 same `decision_id`로 scope하지만 supplied document와 emission의 exact equality를 검사하지 않음 | `alignDecision`이 supplied self-seal과 runtime-observed emission structural equality를 expectation보다 먼저 검사 | exact-Decision이라는 기존 evidence 의미를 실제 admission invariant로 복구하고 다섯 변조 field의 API/CLI regression과 record exact-match regression으로 rollback을 막음 |
| judgment-only `NEXT` skip이 다음 stage에 prior row·plan state를 남길 수 있음 | row·plan·pending needs를 stage iteration-local로 만들고 선택된 bundle만 loop 밖으로 승격 | 선언 stage 순서와 ordered-effect 의미를 보존하며 stage·row·effects·record/body·proof·reinvoke·`stage_artifacts` full-coherence regression으로 확인 |
| L14가 요구하는 skipped judgment branch를 final Decision만으로는 build evidence에 투영할 수 없음 | evaluator-observed internal execution event를 build fixture coverage token으로 투영 | L14를 약화하지 않고 `skip:["NEXT"]`와 다음 stage를 함께 증명하며, predicate replay·fact inference·Decision field 추가를 피함; valid/missing/false-claim/purity regression으로 rollback을 막음 |
| live collection, simulate, scenario expectation, L5가 observation source를 서로 다르게 정규화 | 한 `observations.mjs` preparation owner가 collector/`s`/`judged`/`decided`의 presence·binding·reserved UNKNOWN·domain·flat/nested/unknown receipt를 계산 | 누락값이 predicate를 실행하거나 coverage를 얻는 false proof를 제거하고 version-5 raw sentinel 호환을 보존함; source-lane·live/simulate parity·known/false coverage regression으로 rollback을 막음 |
| public stage 호출자가 task/role이 이미 선택한 exact project file을 전달할 typed input이 없음 | optional API `targetPath` / CLI `--target`을 runtime이 normalized `ctx.targetPath`로 collector와 snapshot basis에 전달하고 traced `decision_emitted.data`에서 resume command로 연속 투영 | judged/decided, argv 재해석, target 추론, parallel Decision field나 package opt-in 없이 기존 observation→snapshot→Decision 경로를 보존함; target-absent context·trace data·resume command와 Decision schema는 그대로이며 API/CLI 정상·거부·physical containment·trace/resume regression으로 rollback을 막음 |
| exact format 예시가 `Decision.format.example`에만 있고 실행 effect와 떨어져 있음 | format을 소유한 effect에 같은 정본 값의 `format_example`을 투영 | spec·fixture를 두 번째 정본으로 복제하지 않고 실제 WRITE 소비 위치에서 정확한 형식을 찾게 함; targeted runtime, canonical build와 installed fresh Luna receipt로 제한 검증 |

### 7.3 의도적으로 제외한 capability

Cross-skill import/composition은 현재 구현하지 않는다. Parser와 runtime은 `SPEC.profile="single"`, 빈 imports, 자기 skill의 body reference만 허용한다. 여러 skill의 activation, handoff, 상태 전달을 추가하면 줄이려던 drift surface가 다시 늘어나기 때문이다. 향후 필요해도 현재 single profile을 몰래 넓히지 말고 별도 profile과 독립 검증으로 설계한다.

P2 version-5 호환 의미를 바꾸는 수정은 이 원장에 다음을 함께 기록한다.

1. 무엇이 바뀌는가
2. 왜 바꾸는가
3. 기존 의미를 어떻게 보존하거나 의도적으로 대체하는가
4. 동등성 또는 rollback을 어떤 test로 확인하는가

### 7.4 L0–L18 구현 대응

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
| L10 | artifact path, skill/role/external/project writer, stage/guard/role/external/project reader, template reference closure |
| L11 | template placeholder/type/field/section/byte parity |
| L12 | ownership과 WRITE/role effect 경계 |
| L13 | 선택된 language profile의 body/bootstrap/signature parity |
| L14 | guard/stage/branch/table row fixture coverage |
| L15 | exact format domain, unique terminal, round-trip, CR/LF |
| L16 | declaration consumer와 DEFERRED 완전성 |
| L17 | 각 level을 실제로 죽이는 mutation, survivor 0 |
| L18 | guard bypass가 collector-observed durable evidence만 읽는지 |

---

## 8. 현재 구현 완료 범위

- Creator thin skill과 조건부 authoring references
- P0/P1/P2 profile selection
- P0/P1 conditional judgment topic의 점진 읽기와 context-surface 계측
- P0/P1 universal intent의 always-loaded visibility와 canonical implementation/evidence locator를 분리한 simple-lint provenance
- intent/ledger scaffold와 P2 authoring-card template
- conservative migration과 비-Markdown inventory
- stable-ID maintenance와 semantic diff
- 등록된 typed `replace-artifact` 유지보수와 원자적 install receipt
- P2 validator L0–L18
- positive-list AST와 two-level validation
- deterministic evaluator와 compact guide
- evaluator-observed execution event에서 fixture coverage를 계산하는 L14 build evidence path
- `ARTIFACTS.readers`에서 선택된 stage/guard의 정적 `stage_artifacts`를 투영하는 Decision schema 2
- supplied Decision self-seal과 runtime-emitted structural equality를 expectation보다 먼저 검사하는 exact-Decision alignment
- caller-selected project-relative file을 collector와 snapshot basis에 전달하고 traced resume에 연속 투영하는 optional public stage `targetPath` / `--target`
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
- declared-column binding으로 검증자 pass를 정확한 selection·snapshot에만 credit하는 P2 pilot
- 배포된 declared-column P2의 Sol/Fable/Luna fresh-consumer completion 경로와, mandatory consumption set 밖의 path discovery 때문에 `PARTIAL`로 제한된 composition
- exact `770cd3755d23c17a626822079c47d17b8387b326`의 Codex·Claude 공식 project-local 설치본 249/249 byte identity
- Fresh Sol xhigh P1 author의 locator-only obligation discharge, 11/11 helper test, held-out exact bytes, `open_obligations: 0`
- Fresh Fable Max P2 consumer의 stopping guard, static/dynamic input, public format example, non-file verifier observation, evidence `matching-pass`; coordinator correction 전 model extraction drift는 제품 evidence에서 제외

---

## 9. 일반화하면 안 되는 주장

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
- 최신 suite의 Node 20/22/24 재실행
- out-of-band writer가 capture 이후에도 쓰는 상황에서의 package 보존
- 비-Windows host의 POSIX symlink 분기
- Fresh consumer가 skipped judgment branch, tampered Decision rejection, evidence REPORT record/align을 한 run에서 끝까지 연결한 chained coherence
- public lane의 harness-trusted effect observation과 verifier truthfulness
- final-gate correction byte를 사용한 fresh P2 skipped-NEXT consumer behavior

이 항목들은 숨은 미완성 code marker가 아니라 별도 empirical scope다. 지원을 주장하려면 해당 범위를 직접 실행한 fresh evidence를 추가한다.
