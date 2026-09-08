# Skill Rails 유지보수 상태와 다음 세션 진입점

문서 상태: 교체형 작업 snapshot

최종 갱신: 2026-09-09 KST (`v0.3.2` 위 maintenance context와 P2 입력 재진입 교정 구현·전체 검증·교차 검토 완료, 실사용 검증 직전·원격 미반영)

이 문서는 새 세션이 “마지막으로 어디까지 끝났고 어디서 이어야 하는가”를 빠르게 복구하기 위한 시작점이다. 제품의 안정적인 목적과 설계는 [제품·설계 정본](skill-rails_ko.md), 정확한 구현·증거·P2 version-5 호환 변경은 [구현·검증 기록](implementation-verification_ko.md), 큰 전환의 인과와 재사용할 저작·운영 교훈은 [저작 경험 계승](authoring-lessons_ko.md)이 소유한다. 일상 chronology는 Git과 Orca 실행 기록에 맡기고 이 파일에는 현재 truth만 둔다.

---

## 0. 현재 위치: `v0.3.2` 릴리스 위 유지보수 컨텍스트와 입력 대기 BLOCK 교정 완료

v0.1.4까지의 root `SKILL.md` 방식은 creator 기능을 빠뜨리지는 않았지만, `npx skills@latest`가 repository 전체와 fixture의 중첩 skill까지 설치 scope로 복사하게 했다. Package 0.1.5 후보는 설치 가능한 정본을 공식 관례인 `skills/skill-rails/`로 옮겼다. Repository-only `docs/`, `tests/`, `evals/`, `fixtures/`는 GitHub source에 그대로 남고 설치 payload에서는 제외된다.

제품 commit `1560bc3c3738fda85bbdd745836f7abbaebe3c2b`은 `npm run verify`의 vendor check, self lint, repository test 62/62와 frozen G0.5 eval을 통과했다. Local source와 GitHub source 설치가 각각 skill 하나만 발견했고, 설치본은 61 files, `SKILL.md` 1개, repository-only file 0개였다. Local install은 source 대비 missing/extra/raw difference 0, global install은 path missing/extra 0과 newline-normalized content difference 0이었으며 둘 다 설치본 P1 생성과 lint를 통과했다.

배포 뒤 Devflow 포팅 피드백을 제품 경계와 대조한 결과 구현 차단이나 P2 core 결함은 없었고, 여러 standalone skill이 repository 규약을 공유할 때 cold author가 소유 경계를 첫 저작 경로에서 찾기 어려운 안내 공백을 확인했다. Source candidate의 첫 교정은 설치 진입점에서 profile을 skill별로 고르고 shared domain input·helper를 재사용하되, P2 behavior와 judgment는 각각 `spec.mjs`와 `body.md`가 계속 배타 소유한다고 명시한다. `ARTIFACTS` path 선언은 존재·내용·freshness·evidence authority를 증명하지 않는다.

이어 Devflow가 제기한 L14 guard 증거 문제를 최신 후보에서 재현해 현재 P2 제품 결함으로 확인했다. Live, simulate, scenario expectation, L5가 observation source를 서로 다르게 전처리해 missing input이 fixture에서만 predicate를 실행하고 coverage를 얻을 수 있었다. 두 번째 교정은 한 observation preparation owner로 collector/`s`/`judged`/`decided`를 통합했고, raw `"UNKNOWN"`의 version-5 예약 의미와 evaluator event-only coverage를 보존하면서 이 false proof를 닫았다. Fable xhigh 설계 반증과 Sol xhigh 기술 검토, 구현 후 두 최종 read-only audit는 현재 수정이 새 grammar 없이 원인을 닫는 최소 일관 교정이라고 PASS했다. 이 두 교정을 package source version `0.1.6`의 patch 경계로 묶었다.

후속 Devflow 실측은 current task가 이미 선택한 exact file을 public P2 stage에 전달할 typed input이 없다는 경계를 드러냈다. 보존 checkpoint `d03050f`의 optional `targetPath`/`--target`, containment, collector·snapshot 전달, trace·resume 연속성과 read-block guard의 `pending_reads`/`guard-pending:` evidence를 released `f269f29` observation owner 위에 합성했다. 두 true semantic conflict는 released v0.1.6 쪽으로 판정해 raw `"UNKNOWN"`은 모든 lane에서 예약 sentinel로 유지하고, fixture materialization과 L5 `checkReads`는 `observations.mjs`가 계속 소유한다. 새 byte 계보는 runtime `0.3.1`, validator `0.4.1`, kernel `6`이며 package source candidate는 `0.1.7`이다.

Released `v0.1.7` 위에서 두 실사용 흐름이 같은 원인의 서로 다른 증상을 드러냈다. 공개 `path` domain 정규식이 내부 공백을 포함한 정당한 project-relative 선택(`cards/task two.md`)을 관찰 단계에서부터 거부했고, 생성 loader의 `record --type artifact_verified ... --artifact <path>` 예시는 값을 quote하지 않아 그런 경로가 shell에서 한 token으로 살아남지 못했다. Mechanics fix commit `4cd6289`는 `scripts/runtime/domains.mjs`의 `PATH_VALUE`가 선행/후행 공백·CR·LF·`;`·단독 `.`/`./`·`..` traversal은 그대로 거부하면서 내부 U+0020 하나만 허용하도록 넓혔고, `scripts/lib/generator.mjs`의 loader 예시를 `--artifact "<path>"`로 quote했다. `SPEC.version = "5"`, `KERNEL_VERSION = "6"`, Decision/Trace schema, 14 closed exports, effect authority는 바뀌지 않았고 runtime/validator는 `0.3.2`/`0.4.2`로 patch 상승했다. Package source version은 npm의 표준 version 절차로 `0.1.8`로 올렸다. Release-boundary staged tree에서 `npm run verify`를 정확히 한 번 실행해 vendor check, self lint, repository test 70/70과 frozen G0.5 eval이 모두 pass했다.

Release-prep commit `58c8dc01bbfd70f846c3a41a57ab9fc84050c52a`를 `git merge --ff-only`로 `main`에 fast-forward한 뒤 그 commit을 가리키는 annotated tag `v0.1.8`을 만들고 `git push --atomic origin main v0.1.8`로 `main`과 tag를 함께 push했다. GitHub Release `v0.1.8`을 제목 `v0.1.8`, 본문 `Full Changelog: https://github.com/nanomia-ai/skill-rails/compare/v0.1.7...v0.1.8`로 같은 commit에 publish했다. 그 push가 트리거한 GitHub workflow run `33403838640`(`https://github.com/nanomia-ai/skill-rails/actions/runs/33403838640`)이 success로 완료됐다. Release 뒤 `npx skills@latest add nanomia-ai/skill-rails --global --skill skill-rails --agent codex claude-code gemini-cli --yes`를 정확히 한 번 실행해 Codex·Gemini CLI 전역 canonical package 설치와 Claude Code symlink가 성공했다. `main`의 `skills/skill-rails`와 설치본 `git diff --no-index --ignore-cr-at-eol`은 exit 0(양쪽 62 files)이었고, 설치본 `scripts/lint.mjs --self`는 pass, 설치본 fingerprint는 runtime `0.3.2`, validator `0.4.2`, kernel `6`으로 candidate가 기록한 값과 일치했다. Installer security summary는 Gen Safe, Socket 1 alert, Snyk Low Risk를 표시했다.

v0.1.9는 Devflow 실용성 감사에서 확인된 생성 어댑터의 종단 해석 충돌만 고친다. 기존 문장은 `ASK`·`WAIT`·`BLOCK`을 진단과 같은 선행 정지 조건으로 읽히게 했지만 evaluator는 이들을 효과 배열의 마지막 종단으로 계산한다. 생성기와 P2 contract는 이제 진단·오래된 snapshot만 실행 전에 멈추고, 유효한 Decision의 모든 효과를 배열 순서대로 종단까지 수행한다고 한 해석으로 모인다. Runtime, validator, kernel, Decision/Trace schema와 effect grammar는 그대로다. Commit `63147c2c83533ca9bcb69ff4e4a719217ee4d844`, annotated tag와 GitHub Release `v0.1.9`, atomic push, workflow run `33719014072` success, Codex·Claude Code 전역 설치와 newline-normalized source hash 일치까지 확인했다. Fresh-agent 실사용 행동은 아직 `UNPROVEN`이다.

v0.1.9 다음 판 `v0.2.0`(commit `e7a4f98`, validator `0.5.0`, runtime `0.3.2`, package `0.2.0`)은 2026-09-03T16:25:38Z에 push·tag·GitHub Release까지 published 상태였다. 그 판은 migrate 이식성과 `READ_FIRST.path` 실재 검사를 담았지만 범용성 축소 둘과 유지보수 크래시 하나를 함께 배포했고, 지금 후보가 그것을 되돌리고 고친다(6.20). 내용은 그 축소 둘의 복구, `spec:ROLES/<id>`가 `TypeError`로 빌드를 죽이던 것, `references`/`templates`가 정규 파일일 때 유지보수가 `ENOTDIR`로 죽던 것, 원장 locator의 후행 세그먼트가 조용히 무시돼 오타가 부모로 해석되던 것, 그리고 소비 저장소가 올린 유일한 upstream 요구인 런타임 상태의 관찰 프로젝트 오염이다. 전부 결함 수정이거나 배포된 축소의 복구다. v0.1.9 대비 새 거부는 둘뿐이고(`READ_FIRST.path` 실재, 원장 locator 세그먼트 수) 소비 코퍼스 실측 거부는 0건이다. trace 경계는 강제가 아니라 생성 지시문으로 닫았다(6.22). 후보 fingerprint는 validator `0.6.1`, runtime `0.3.3`, kernel `6`, package version `0.3.0`이다. 후보 tree에서 `npm run verify` 77/77과 소비 저장소 9개 읽기 전용 진단 0건을 확인했다. 이 후보는 `v0.3.0`으로 배포했다 — commit `6d20469`, annotated tag `v0.3.0`, GitHub Release published 2026-09-04T08:33Z, workflow run `33854213718` success. 전역 설치는 `npx skills@latest add nanomia-ai/skill-rails --global --skill skill-rails --agent codex claude-code --yes`로 한 번 실행해 Codex universal과 Claude Code symlink가 성공했고, 설치본과 `skills/skill-rails`의 `git diff --no-index --ignore-cr-at-eol`는 exit 0, 설치본 self lint pass, fingerprint validator `0.6.1`/runtime `0.3.3`/kernel `6`으로 일치했다. 태그를 한 번 다시 만들었다 — 첫 태그가 `package-lock.json`이 `0.2.0`으로 남은 커밋을 가리켜 release workflow의 버전 일치 검사에서 실패했고(run `33853979457`), lock을 고친 `6d20469`로 옮겨 재발행했다. `npm run verify`는 lock 버전을 검사하지 않는다. 각 변경의 근거와 실측은 [구현·검증 기록](implementation-verification_ko.md) 6.20–6.22와 7.-1이 소유한다.

`v0.3.1`은 실패 검사를 제품의 정답지로 만들지 않게 하는 저작 분기 안내, `projected`의 provenance 한계, eval 성공 caveat와 A–D 회귀만 보정한 patch다(6.23). Runtime·validator·generator·schema·생성 package byte는 바뀌지 않았다. Release-boundary commit `c0f366d1703413fa611ec8ba7f96eef93677ca46`, annotated tag와 GitHub Release `v0.3.1`, atomic push, workflow run `33886342982` success를 확인했다. 공식 NPX 설치는 Codex universal package와 Claude Code symlink를 갱신했고 release source와 설치본 diff 0, 설치본 self lint pass를 기록했다.

`v0.3.2`는 Skill Rails로 skill을 만들거나 유지보수할 때의 공개 authoring 운영 하네스만 보강한다(구현·검증 기록 6.24). 의도 표현 보존, 답안지가 아닌 문제 공간, 가장 작은 일관된 전체, 원인·owner·consumer 진단, 권장 네 역할과 기존 배정 역할의 보존, 환경별 장기 구현 주체, 모델 배정 확인, 재귀 context 전파와 self-report가 아닌 이해도 확인을 `authoring-workflow.md`에 통합했다. 실질적인 기획 승인 전과 구현 완료 선언 전에는 원래 목적과 관련 Skill Rails 정본을 다시 읽고 각각 전체 기획과 실제 결과를 반증한다. `evaluation.md`는 충분한 원문을 받는 informed counterproof와 선언된 소비 집합만 받는 blind fresh-consumer 검증을 분리한다. Package와 lock version만 `0.3.2`로 올렸고 runtime·validator·generator·schema·manifest·생성 package byte는 바뀌지 않았으므로 기존 package의 migration이나 rebuild는 필요 없다.

Release-boundary commit `632bb1f3d1048f715b426c2cc807a151b48d6763`, annotated tag `v0.3.2`와 `main`을 atomic push했다. Workflow run `34146283656`이 version 일치·전체 검증·GitHub Release 생성을 완료했다. 공식 installer 1.5.24로 Codex universal package와 Claude Code junction을 한 번에 갱신했고, source/install 각 62 files, diff 0, 설치본 self lint pass와 runtime `0.3.3`/validator `0.6.1`/kernel `6` 일치를 확인했다.

현재 원격 미반영 후보는 기존 package의 산문·코드·fixture·manifest·원장을 현재 byte에서 함께 캡처해 사람용 map과 AI용 source-linked causal capsule로 투영한다(구현·검증 기록 6.26). 별도 저장 graph나 수동 인과 정본은 만들지 않고, status·gap·source basis·resume query를 함께 제공해 일부 결과를 전체로 오인하지 않게 한다. Describe는 target code를 실행하지 않으며 P0/P1/P2·unmanaged·invalid package를 read-only로 다룬다. 기존 생성 skill의 정상 실행 경로는 바뀌지 않는다.

같은 후보의 P2 runtime 0.3.4는 Devflow Adopt에서 현실화된 입력 대기 BLOCK의 저장·재진입 공백을 공통 owner에서 닫는다(구현·검증 기록 6.27). `after-input`은 effect-free BLOCK의 non-empty needs가 모두 caller-supplied일 때만 파생되고, traced stage는 UTF-8 결과 파일을 자동 저장하며, `resume/2`는 값 없는 명령을 제시하지 않는다. observed/mixed/terminal BLOCK, duplicate guard, stale·after-effects continuation, evidence authority와 `SPEC.version = "5"`는 보존한다.

## 1. 저장소 기준선

- branch: `main`
- 공식 배포 package version은 `0.3.2`(2026-09-07T17:08:18Z published, 현재 Latest)이고 annotated tag는 commit `632bb1f`를 가리킨다. Release workflow run `34146283656`과 공식 source의 Codex·Claude Code 전역 설치가 성공했다.
- 현재 local `main`은 maintenance-context checkpoint `cea279c`를 포함하고 `origin/main`은 `a4e3c4e`다. 이 snapshot 다음 commit은 P2 입력 재진입 교정만 묶으며, 사용자가 이미 가진 `.gitignore` 변경과 `docs/plan/`은 제외한다. Package와 lock version은 `0.3.2`다.
- 현재 fingerprint는 runtime `0.3.4`, validator `0.6.2`, kernel `6`이다. L16 locator universe는 그대로이고 P2 runtime은 기존 needs에서 `after-input`을 파생한다.
- `SPEC.version = "5"`, Decision/Trace schema, closed exports, effect authority와 host permission 경계는 그대로다.

---

## 2. 완료된 제품 변경

- `skills/skill-rails/` 하나가 설치 가능한 package와 skill-user routing을 소유한다.
- Root에는 maintainer 문서·test·eval·fixture와 frozen G0.5 harness만 남긴다.
- G0.5 scorer와 lint의 봉인된 바이트 및 protocol fingerprint는 유지하고, repository-only re-export bridge로 이동한 canonical runtime에 연결한다.
- Package scripts, tests, maintainer routing, 사람용 README source link와 제품 설계 문서가 새 소유 경계를 가리킨다.
- 설치 package 안의 중첩 fixture skill과 repository-only 파일을 금지하는 회귀 검사를 추가했다.
- P2 live/simulate/scenario/L5가 한 observation preparation owner를 사용하고, 누락값은 predicate·coverage 전에 `UNKNOWN`으로 막힌다.
- `fixture.s`/`judged`/`decided` source lane, explicit presence, object-valued observation, version-5 raw `"UNKNOWN"` 예약어를 validator와 회귀 증거로 고정했다.
- Optional public `targetPath`/`--target`을 portable project-relative path로 정규화하고 lexical·realpath containment 뒤 collector와 custom `snapshotBasis`에만 전달한다. Traced `decision_emitted.data.targetPath`와 CLI `resume`은 normalized target을 연속 투영하며 target이 없을 때 기존 shape를 유지한다.
- Unknown read로 guard가 멈출 때 evaluator는 `guard_matched.pending_reads`를 내고 build coverage는 `guard-pending:<id>`로 구분한다. L14는 실제 predicate match와 pending-read block을 각각 대응하는 token으로만 인정한다.
- 공개 `path` domain이 내부 U+0020 공백 하나를 허용하도록 넓어졌고, 생성 loader의 `--artifact <path>` 예시가 `--artifact "<path>"`로 quote됐다(`v0.1.8`).
- 기존 package를 변경하지 않고 현재 원본에서 목적·owner·consumer·evidence·frontier를 재구성하는 `maintain --describe`와 `--query [--json]`, 같은 model의 사람용 `--map` preview를 추가했다. 출력은 `complete-for-declared-scope`만 주장하고 source identity·gap·재진입 명령을 함께 제공한다.
- P2 caller-input BLOCK은 `reinvoke: after-input`을 명시하고 traced stage 결과는 외부 trace directory에 UTF-8로 자동 저장된다. `resume/2`는 실행 가능한 continuation에만 명령을 제공하며 입력 값이나 결정 권한을 발명하지 않는다.

---

## 3. 현재 증거

- 현재 maintenance-context 표적 회귀 12/12가 pass했다. P2 causal capsule, finite absence와 unknown, 자연어 match cut, invalid·악성 target 비실행, JSON source span, bounded reverse consumer, P0/P1 projection ownership, AST module edge, CLI mode 배타성·compact JSON·legacy diagnose, map, 기존 L16 locator universe와 정적으로 해석할 수 없는 선언 관계의 fail-closed 차단을 고정한다.
- 현재 전체 `npm run verify`: vendor check, self lint, repository test 92/92, frozen G0.5 eval pass.
- Canonical pilot rebuild: runtime `0.3.4`, validator `0.6.2`, kernel `6`; L0–L18, mutation 20/20, scenario 10/10·50회 불일치 0, format 256/256·CRLF 거부, manifest 15 content + 38 generated = 53, build ID `sha256:4cd825e0e609322e81f618d245fc6fa1bc09a2ef2bd0abf61aec8c973ca9ef3b`.
- 입력 재진입 표적 회귀 44/44가 pass했고, 동일 Fable high 세션의 구현 후 whole-diff 검수는 blocker 0으로 PASS했다. Fable이 남긴 non-blocking risk는 ASK/WAIT의 `reason: terminal` 명명과 결과 파일의 non-atomic write이며, 둘 다 관측된 결함 범위를 넓혀 지금 기계화하지 않는다.
- Devflow의 9개 P2 package는 runtime 0.3.3/validator 0.6.1과 동일 runtime hash를 봉인하며, generated runtime 밖에서 `resume/1` 또는 `next_command`를 파싱하는 소비자는 검색되지 않았다. 기존 package는 그대로 호환되고, 새 runtime 채택 시 cohort 불변식에 따라 9개를 한 변경에서 재빌드한다.
- 두 blind fresh-maintainer가 공개 route와 describe를 발견했다. 같은 agent와 수정·재실행을 반복해 자연어 miss, 과대 fan-out과 truncation을 줄였고, 최종 관찰은 목적·requirement·owner stage·fixture·source basis·gap·resume을 보존했다. 별도 normal-use control은 생성 skill의 runtime route만 사용해 maintenance surface 비개입을 관찰했다. 모두 제한된 `PARTIAL` 행동 증거다.
- Fresh Terra high의 첫 두 미공개 계획 사례는 owner 진단·역할·모델 확인·두 검증 lane을 복원했지만 위임 context와 실제 이해도 확인을 사용자-facing 배정안에서 누락했다. 같은 실패가 두 번 반복되어 이를 `Delegation readiness`와 역할 배정의 완료 조건으로 재배치했고, 세 번째 미공개 사례는 전달 context와 실제 이해 확인 방법까지 스스로 계획했다. 한 모델·한 최종 사례의 `PARTIAL` 행동 증거이며 반복성·실제 위임 성공은 아니다.
- Astra xhigh 구현 전 전제 검수와 Sol xhigh 전체 diff 검수를 사용했다. Sol이 역할 권장성, task/input attribution과 회귀 과잉의 세 blocker를 찾았고, 수정 후 두 차례 후속 검수는 blocker 0과 no-migration compatibility를 판정했다.
- `v0.3.2` release workflow와 공식 NPX 설치가 성공했다. Release source와 canonical 설치본은 각각 62 files, diff 0이고 설치본 self lint가 pass했다. Codex는 universal package를 직접 사용하고 Claude Code는 같은 package를 가리키는 junction을 사용한다.
- 구현 후 fresh Claude Fable xhigh 독립 감사와 교정 후 같은 세션의 closure audit가 모두 PASS했고 남은 MUST/SHOULD는 0건이다. Fresh-author 장기 이행은 행동 증거로 승격하지 않는다.
- Markdown local link scan: 47 files, 53 local links, missing 0.
- Local official-installer smoke: 1 skill discovered; installed 61 files; `SKILL.md` 1; forbidden repository-only file 0; source/install missing·extra·different 0; installed creator P1 generation과 lint pass.
- GitHub-source global smoke: 1 skill discovered; installed 61 files; `SKILL.md` 1; forbidden repository-only file 0; path missing·extra 0; raw 42 differences는 모두 CRLF/LF이며 normalized difference 0; global self lint와 installed creator P1 generation·lint pass.
- skills.sh current skill page: Gen Agent Trust Hub, Socket, Snyk 모두 Pass.
- 구조·배치·creator 실행을 fresh agent의 장기 행동 증거로 승격하지 않는다.
- 6.14 L14 guard 교정 당시 후보의 `npm run verify`: vendor check, self lint, repository test 67/67, frozen G0.5 eval pass. 현재 후보의 값은 §0이 소유한다.
- Fresh Sonnet high는 관련 skill suite 반례에서 profile-local 선택과 P2 `spec.mjs`/`body.md` 배타 소유를 도출했다. 첫 authority 답변의 file-presence 과장을 public contract에서 교정했고, 별도 Fresh Sonnet high가 `ARTIFACTS` 선언은 path·writer·reader와 stage projection만 성립시키며 존재·내용·freshness는 `UNPROVEN`이라고 정확히 구분했다.
- Fable xhigh의 근본 설계 반증과 Sol xhigh의 기술·호환 검토를 교차했다. Sol이 최초 문구의 P2 합성 모호성을 발견했고 Fable이 재검토 후 기존 PASS를 철회해 같은 결함을 확인했으며, runtime/schema/version-5를 넓히지 않는 문구·회귀 교정으로 닫았다.
- P2 observation 교정의 targeted runtime·integration 39/39가 pass했다. Canonical pilot은 공식 repair-generated 경로에서 build ID `sha256:1a901e5e01b8680dcfc76140681a170aaf8a22750826bfc04c95ae0238b45736`, L0–L18, mutation 20/20, scenario 10/10·50회 불일치 0, format 256/256을 기록했다. Full verify 뒤 Fable/Sol 최종 audit도 MUST-fix 없이 PASS했다.
- Release 뒤 `skills` 1.5.23으로 `npx skills@latest add nanomia-ai/skill-rails --global --skill skill-rails --agent codex claude-code gemini-cli --yes`를 실행했다. Installer는 skill 하나만 발견했고 release package와 설치본은 모두 62 files, `SKILL.md` 1개였다. Path와 CRLF를 제외한 content 차이는 0, installed self lint와 임시 P0 생성·full lint는 pass했고 임시 산출물은 제거했다.
- Installer security summary는 Gen Safe, Socket 1 alert, Snyk Low Risk를 표시했다. 이는 외부 scanner signal이며 설치·실행 실패가 아니지만, 현재 alert의 상세 원인과 최신 재평가 상태는 이번 제품 receipt로 해소하거나 Pass로 승격하지 않는다.
- v0.1.7 release 경계의 focused reconciled integration regression 4/4, runtime+integration 42/42, self lint가 pass했다. Canonical pilot은 worktree builder로 재생성되어 build ID `sha256:d2855deb87b5b1b4cbcba467975cbfcc87c7661e7072ffc6478e13b85f49ca1c`, runtime/validator `0.3.1`/`0.4.1`, L0–L18, mutation 20/20, scenario 10/10·50회 불일치 0, format 256/256을 기록했고 embedded lint와 real-state e2e 2/2도 pass했다.
- Release-boundary staged tree에서 `npm run verify`를 정확히 한 번 실행해 vendor check, self lint, repository test 70/70과 frozen G0.5 eval이 모두 pass했다.
- v0.1.9의 `main`/tag/GitHub Release는 commit `63147c2`에 일치하고 workflow run `33719014072`가 success다. 공식 installer는 skill 하나를 Codex canonical package에 설치하고 Claude Code를 같은 경로로 symlink했다. Source와 설치본의 `SKILL.md`, generator, P2 contract는 newline-normalized SHA-256이 모두 일치한다.
- Release 뒤 `npx skills@latest add nanomia-ai/skill-rails --global --skill skill-rails --agent codex claude-code gemini-cli --yes`가 성공했다. Release source와 installed canonical package의 `git diff --no-index --ignore-cr-at-eol`은 exit 0, 설치본 `scripts/lint.mjs --self`는 pass였고 설치본 fingerprint는 runtime `0.3.1`, validator `0.4.1`, kernel `6`이다.
- Targeted seam regression `node --test --test-name-pattern "named, list, object, NONE, and UNKNOWN domains fail closed" tests/runtime.test.mjs`가 1/1 pass했고, `cards/task two.md` selection을 쓰는 public-stage-target 통합 회귀도 함께 확인했다. Canonical pilot rebuild는 root lint L0–L18, mutation 20/20, scenario 10/10·50회 반복 불일치 0, format 256/256, build ID `sha256:c1492ff7217f9fe54f9b15b9012bfcea4f69948f2a2663408dcb2ef232420a01`을 기록했다. 이 release-boundary tree의 `npm run verify`는 vendor check, self lint, repository test 70/70, frozen G0.5 eval을 모두 통과했다. 독립 Sol/Opus/Fable 교차 검토는 MUST-fix 없이 PASS했다.
- `main`/`origin/main`을 `git merge --ff-only`로 `58c8dc0`에 fast-forward하고 annotated tag `v0.1.8`을 만들어 `git push --atomic origin main v0.1.8`로 함께 push했다. GitHub Release `v0.1.8`을 published했고, 트리거된 workflow run `33403838640`이 success로 끝났다. Release 뒤 `npx skills@latest add nanomia-ai/skill-rails --global --skill skill-rails --agent codex claude-code gemini-cli --yes`를 한 번 실행해 Codex·Gemini CLI 전역 설치와 Claude Code symlink가 성공했다. `main`의 `skills/skill-rails`(62 files)와 설치본(62 files)의 `git diff --no-index --ignore-cr-at-eol`은 exit 0, 설치본 `scripts/lint.mjs --self`는 pass, 설치본 fingerprint는 runtime `0.3.2`/validator `0.4.2`/kernel `6`이다.

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
- Fresh agent가 optional `--target`을 올바른 경우에만 공급하고 saved trace에서 resume continuity를 실제로 따르는 행동은 `UNPROVEN`이다.
- v0.1.7/v0.1.8 설치본 creator의 새 package 생성·실행은 `UNPROVEN`이다. Downstream Devflow 아홉 package는 v0.3.0 builder로 재빌드되어 validator `0.6.1`/runtime `0.3.3`을 봉인했다(Devflow commit `2eca653`); 그 fresh-agent 실행 행동은 여전히 `UNPROVEN`이다.
- `v0.1.8`의 변경된 표면(interior-space path domain, quoted `--artifact`)에 대한 fresh-agent 소비 행동은 `UNPROVEN`이다. 이번 release는 tag·push·GitHub Release·전역 설치·설치본 diff/lint/fingerprint 재확인까지 완료했지만 fresh-agent behavior 증거를 새로 만들지 않는다.
- 새 authoring 운영 하네스의 다른 모델·host 반복성, structured orchestration의 실제 역할 분리, recursive delegation 두 번째 hop 이후 의미 보존, supervisor의 실제 교착 탐지·briefing 교정·역할 재배치, long-session/compaction 유지와 실제 skill 품질 향상량은 `UNPROVEN`이다.
- Maintenance-context의 다른 모델·host 반복성, 장기 session·compaction 재진입, 대형 Devflow package에서의 출력 비용과 실제 오수정 감소량, capture 중 외부 write, 모든 의미 관계의 완전성은 `UNPROVEN`이다. `complete-for-declared-scope`와 partial catalog를 전체 package의 의미적 완전성으로 승격하지 않는다.
- 배포된 runtime 0.3.4 bootstrap을 처음 보는 fresh agent가 caller-input BLOCK을 실제로 저장하고 값 없는 retry 없이 재평가하는 행동은 실사용 관찰 전까지 `UNPROVEN`이다.

---

## 5. 정확한 다음 단계

1. 현재 P2 교정을 사용자 소유 `.gitignore`와 `docs/plan/` 없이 별도 commit한다.
2. 그 commit의 `skills/skill-rails`를 로컬 canonical install에 배포한 뒤, Orca CLI의 fresh agent 한 개로 Devflow Adopt의 source-linked context 발견성과 runtime 0.3.4 caller-input 재진입을 bounded 관찰한다.
3. 실사용 결과에 문제가 있으면 즉시 수정하지 말고 product defect, fixture/harness, environment, agent interpretation으로 먼저 분류해 보고하고 멈춘다. 한 fresh run을 여러 모델·host·장기 행동 증거로 승격하지 않는다.
4. 기존 Devflow package는 describe를 위해 migration하거나 rebuild하지 않는다. Runtime 0.3.4를 채택할 때만 9-package cohort를 한 변경에서 재빌드한다.
5. Push·tag·GitHub Release는 별도의 명시적 요청 전에는 수행하지 않는다.
