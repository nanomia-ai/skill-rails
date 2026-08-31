# Skill Rails 유지보수 상태와 다음 세션 진입점

문서 상태: 교체형 작업 snapshot

최종 갱신: 2026-08-31 KST

이 문서는 새 세션이 “마지막으로 어디까지 끝났고 어디서 이어야 하는가”를 빠르게 복구하기 위한 시작점이다. 제품의 안정적인 목적과 설계는 [제품·설계 정본](skill-rails_ko.md), 정확한 구현·증거·P2 version-5 호환 변경은 [구현·검증 기록](implementation-verification_ko.md), 큰 전환의 인과와 재사용할 저작·운영 교훈은 [저작 경험 계승](authoring-lessons_ko.md)이 소유한다. 일상 chronology는 Git과 Orca 실행 기록에 맡기고 이 파일에는 현재 truth만 둔다.

---

## 0. 현재 완료 지점: v0.1.7 공식 배포와 v0.1.8 release-prep candidate

v0.1.4까지의 root `SKILL.md` 방식은 creator 기능을 빠뜨리지는 않았지만, `npx skills@latest`가 repository 전체와 fixture의 중첩 skill까지 설치 scope로 복사하게 했다. Package 0.1.5 후보는 설치 가능한 정본을 공식 관례인 `skills/skill-rails/`로 옮겼다. Repository-only `docs/`, `tests/`, `evals/`, `fixtures/`는 GitHub source에 그대로 남고 설치 payload에서는 제외된다.

제품 commit `1560bc3c3738fda85bbdd745836f7abbaebe3c2b`은 `npm run verify`의 vendor check, self lint, repository test 62/62와 frozen G0.5 eval을 통과했다. Local source와 GitHub source 설치가 각각 skill 하나만 발견했고, 설치본은 61 files, `SKILL.md` 1개, repository-only file 0개였다. Local install은 source 대비 missing/extra/raw difference 0, global install은 path missing/extra 0과 newline-normalized content difference 0이었으며 둘 다 설치본 P1 생성과 lint를 통과했다.

배포 뒤 Devflow 포팅 피드백을 제품 경계와 대조한 결과 구현 차단이나 P2 core 결함은 없었고, 여러 standalone skill이 repository 규약을 공유할 때 cold author가 소유 경계를 첫 저작 경로에서 찾기 어려운 안내 공백을 확인했다. Source candidate의 첫 교정은 설치 진입점에서 profile을 skill별로 고르고 shared domain input·helper를 재사용하되, P2 behavior와 judgment는 각각 `spec.mjs`와 `body.md`가 계속 배타 소유한다고 명시한다. `ARTIFACTS` path 선언은 존재·내용·freshness·evidence authority를 증명하지 않는다.

이어 Devflow가 제기한 L14 guard 증거 문제를 최신 후보에서 재현해 현재 P2 제품 결함으로 확인했다. Live, simulate, scenario expectation, L5가 observation source를 서로 다르게 전처리해 missing input이 fixture에서만 predicate를 실행하고 coverage를 얻을 수 있었다. 두 번째 교정은 한 observation preparation owner로 collector/`s`/`judged`/`decided`를 통합했고, raw `"UNKNOWN"`의 version-5 예약 의미와 evaluator event-only coverage를 보존하면서 이 false proof를 닫았다. Fable xhigh 설계 반증과 Sol xhigh 기술 검토, 구현 후 두 최종 read-only audit는 현재 수정이 새 grammar 없이 원인을 닫는 최소 일관 교정이라고 PASS했다. 이 두 교정을 package source version `0.1.6`의 patch 경계로 묶었다.

후속 Devflow 실측은 current task가 이미 선택한 exact file을 public P2 stage에 전달할 typed input이 없다는 경계를 드러냈다. 보존 checkpoint `d03050f`의 optional `targetPath`/`--target`, containment, collector·snapshot 전달, trace·resume 연속성과 read-block guard의 `pending_reads`/`guard-pending:` evidence를 released `f269f29` observation owner 위에 합성했다. 두 true semantic conflict는 released v0.1.6 쪽으로 판정해 raw `"UNKNOWN"`은 모든 lane에서 예약 sentinel로 유지하고, fixture materialization과 L5 `checkReads`는 `observations.mjs`가 계속 소유한다. 새 byte 계보는 runtime `0.3.1`, validator `0.4.1`, kernel `6`이며 package source candidate는 `0.1.7`이다.

Released `v0.1.7` 위에서 두 실사용 흐름이 같은 원인의 서로 다른 증상을 드러냈다. 공개 `path` domain 정규식이 내부 공백을 포함한 정당한 project-relative 선택(`cards/task two.md`)을 관찰 단계에서부터 거부했고, 생성 loader의 `record --type artifact_verified ... --artifact <path>` 예시는 값을 quote하지 않아 그런 경로가 shell에서 한 token으로 살아남지 못했다. Mechanics fix commit `4cd6289`는 `scripts/runtime/domains.mjs`의 `PATH_VALUE`가 선행/후행 공백·CR·LF·`;`·단독 `.`/`./`·`..` traversal은 그대로 거부하면서 내부 U+0020 하나만 허용하도록 넓혔고, `scripts/lib/generator.mjs`의 loader 예시를 `--artifact "<path>"`로 quote했다. `SPEC.version = "5"`, `KERNEL_VERSION = "6"`, Decision/Trace schema, 14 closed exports, effect authority는 바뀌지 않았고 runtime/validator는 `0.3.2`/`0.4.2`로 patch 상승했다. Package source version은 npm의 표준 version 절차로 이 chore commit에서 `0.1.8`로 올렸다. 이 candidate는 fix와 이 chore commit으로 candidate branch에 committed release-prep 상태이며, tag, push, GitHub Release, 전역 설치, fresh-agent 검증은 아직 거치지 않았다. Release-boundary `npm run verify`는 다음 docs 경계 commit에서 정확히 한 번 실행한 결과를 기록할 예정이며, 아직 이 chore commit의 성공 claim이 아니다.

## 1. 저장소 기준선

- branch: `jmp-develop/phase4-p2-v018-integration`
- 공식 배포 package version: `0.1.7`. Mechanics union commit은 `d03050f` checkpoint와 released observation correction `f269f29`의 S1/S2 판정을 기록한다.
- GitHub workflow run `33343504702`가 success로 완료됐고 `v0.1.7` GitHub Release가 published 상태다. 공식 GitHub source의 전역 canonical install도 Codex·Claude Code·Gemini CLI 대상으로 성공했다.
- Candidate branch에 committed된 0.1.8 source candidate는 package version `0.1.8`이다. Interior-space path domain 확장과 quoted 생성 `--artifact` 예시를 담고 있으며 아직 tag, push, release, 설치 중 어느 것도 거치지 않았다.
- `v0.1.7` 공식 배포의 P2 runtime/validator는 union byte 계보로 `0.3.1`/`0.4.1`이다. `0.1.8` source candidate는 domain·loader patch로 `0.3.2`/`0.4.2`를 기록한다. `0.3.0`/`0.4.0`은 landed downstream projection에 쓰인 소진 번호라 재사용하지 않았다.
- `SPEC.version = "5"`, `KERNEL_VERSION = "6"`, Decision/Trace schema, closed exports, effect authority와 host permission 경계는 두 candidate 모두에서 바뀌지 않았다.

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
- (0.1.8 후보, 미배포) 공개 `path` domain이 내부 U+0020 공백 하나를 허용하도록 넓어졌고, 생성 loader의 `--artifact <path>` 예시가 `--artifact "<path>"`로 quote됐다.

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
- v0.1.7 release 경계의 focused reconciled integration regression 4/4, runtime+integration 42/42, self lint가 pass했다. Canonical pilot은 worktree builder로 재생성되어 build ID `sha256:d2855deb87b5b1b4cbcba467975cbfcc87c7661e7072ffc6478e13b85f49ca1c`, runtime/validator `0.3.1`/`0.4.1`, L0–L18, mutation 20/20, scenario 10/10·50회 불일치 0, format 256/256을 기록했고 embedded lint와 real-state e2e 2/2도 pass했다.
- Release-boundary staged tree에서 `npm run verify`를 정확히 한 번 실행해 vendor check, self lint, repository test 70/70과 frozen G0.5 eval이 모두 pass했다.
- Release 뒤 `npx skills@latest add nanomia-ai/skill-rails --global --skill skill-rails --agent codex claude-code gemini-cli --yes`가 성공했다. Release source와 installed canonical package의 `git diff --no-index --ignore-cr-at-eol`은 exit 0, 설치본 `scripts/lint.mjs --self`는 pass였고 설치본 fingerprint는 runtime `0.3.1`, validator `0.4.1`, kernel `6`이다.

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
- v0.1.7 설치본 creator의 새 package 생성·실행과 downstream Devflow 아홉 package의 uniform rebuild는 `UNPROVEN`이다.
- 0.1.8 source candidate(interior-space path domain, quoted `--artifact`)는 tag, push, GitHub Release, 전역 설치, fresh-agent 소비 중 어느 것도 거치지 않았다.

---

## 5. 정확한 다음 단계

1. v0.1.7 release와 global installation receipt는 완료됐다. 이 evidence를 위해 tag·push·publish·global install이나 full verify를 반복하지 않는다.
2. `0.1.8` candidate는 fix와 이 chore commit으로 candidate branch에 committed release-prep 상태다. 다음 docs 경계 commit에서 release-boundary verify를 기록한다. Owner가 명시적으로 지시하기 전에는 tag, push, publish, global install을 하지 않는다.
3. 다음 별도 작업은 Devflow 아홉 P2 package를 installed v0.1.7 builder로 한 commit에서 rebuild하는 것이다. 0.1.8이 공식 배포된 뒤에는 그 builder로 다시 정렬한다.
4. 현재 docs-only/release-prep 작업에서는 repository 밖 Devflow/JGNote/sample을 수정하지 않는다.
