# Skill Rails greenfield 구현 변화 기록

문서 상태: 구현 중 갱신하는 가변 기록

이 문서는 동결된 최초 기획과 상세 개발 계획을 수정하지 않는다. 실제 구현에서 관찰한 차이, 영향을 받는 결정·계약·milestone, 보존할 목적, 선택과 검증을 기록한다.

## E-001 — Verify control fixture의 실행물이 존재하지 않음

상태: **대체 제안 — M0/M1에서 materialize한 뒤 검증**

### 실제 문제와 evidence

`../devflow/tests/natural-language-pilot`에는 7개의 untracked 산문 파일만 있다. 계획이 이름 붙인 `bookmark-storage` project, `package.json`, test와 실행 가능한 `npm test -- bookmark-storage`는 존재하지 않는다. 직접 control 원천은 `principles/SKILL.md` 5,474 bytes와 `verify/SKILL.md` 2,241 bytes이며 SHA-256은 각각 `289434088a87a314bcb3b442ed6cd410069b5c6defd2cd1eec9fc59b463ece13`, `6c92edadfef4ee261fc5adc5fb791c4b2ce90c8027c6434c4d2ad6daf85865e8`이다. 구조를 찾았다는 사실은 command 실행이나 AI 행동 증거가 아니다.

### 영향받는 결정·계약·milestone

- 상세 계획 D-08, §9.2~§9.7
- M0의 control fixture hash·prompt·permission 고정
- M1~M4의 fixture, control/treatment 비교와 evidence receipt

### 보존할 목적

- 기존 Devflow 구조를 새 architecture의 기준선이나 fallback으로 쓰지 않는다.
- control과 treatment는 같은 raw prompt, project bytes, permission과 성공 기준을 사용한다.
- 실행하지 않은 command와 fresh-agent 행동은 `unproven`으로 남긴다.

### 검토한 대안과 선택

1. Sibling 산문을 그대로 runtime fixture로 사용: 실행 project와 test가 없어 기각한다.
2. 현재 저장소의 legacy test를 대용: 새 가설과 무관한 과거 architecture를 기준선으로 만들므로 기각한다.
3. **선택**: sibling 산문은 의미 provenance로만 기록하고, standard-library-only 최소 project와 deterministic success/failure test를 새 fixture에서 만든다. raw Verify prompt, stdout/stderr capture, 기대 test id와 exit code를 fixture receipt가 한 번만 소유한다.

### 검증과 재검토 조건

현재 실행 evidence는 `unproven`이다. 고정 argv가 network 또는 broad legacy suite 없이 deterministic하게 실행되지 않거나 control baseline이 principles/verify 의미를 보존하지 못하면 구현을 멈추고 대안을 다시 연다.

## E-002 — M0 discovery 완료 조건이 M1 generated target에 의존함

상태: **대체 제안 — milestone 폐쇄 순서 조정**

### 실제 문제와 evidence

상세 계획은 M0 active tree에서 `skills/skill-rails/SKILL.md` 하나를 발견하도록 요구하지만, 그 alpha generated package와 currentness 계약은 M1이 만든다. M0에서 수동 placeholder를 만들면 generated owner와 build 계약을 우회한다.

### 영향받는 결정·계약·milestone

- D-10, §4 root discovery contract
- M0 완료 조건과 M1 deterministic build

### 보존할 목적

- active legacy와 새 package를 두 current truth로 운영하지 않는다.
- generated target을 사람이 직접 만들거나 고치지 않는다.
- 새 package는 final path에 있고 legacy를 import·호출·fallback으로 사용하지 않는다.

### 검토한 대안과 선택

1. M0 placeholder `SKILL.md`: generated ownership을 거짓으로 만들므로 기각한다.
2. legacy skill을 M1까지 fallback으로 유지: 두 정본과 discovery 오염 때문에 기각한다.
3. **선택**: M0-B가 legacy를 제거하고 final root를 정리한 뒤 M1의 첫 deterministic build가 `skills/skill-rails`을 생성한다. M0의 active-one-skill와 실제 install/discovery 하위 gate는 그 build 직후 닫고, 그 전 순간은 성공으로 주장하지 않는다.

### 검증과 재검토 조건

M1 build 전 active discovery 0은 일시적 전환 상태이며 완료 evidence가 아니다. M1 뒤 default/full-depth discovery가 각각 정확히 하나가 아니면 전환을 완료로 판정하지 않는다.

## E-003 — 실제 host 검증은 표준 설치 환경을 사용함

상태: **사용자 대체 결정**

### 실제 문제와 evidence

M0-A에서 installer의 격리 destination은 `CODEX_HOME` 하나로 제어되지 않고 Windows `os.homedir()`와 여러 host 경로에 나뉨을 확인했다. 사용자는 실제 AI 행동을 임시 `CODEX_HOME`에서 시험하지 않고, 새 skill을 정상 설치 가능한 상태로 만든 뒤 표준 installer·표준 host 환경에서 시험하도록 결정했다.

### 영향받는 결정·계약·milestone

- §2.1과 D-10의 isolated-home alpha install 가정
- M0 installer probe, M1 standalone 설치, M4 fresh-host 행동 시험

### 보존할 목적

- 기존 전역 `skill-rails`를 덮어쓰지 않는다.
- alpha identity는 `skill-rails-next`로 분리한다.
- publish, `latest` 승계와 기존 production identity 교체는 여전히 별도 사용자 승인 사항이다.
- 구조 검사는 실제 Codex·Claude 행동 증거로 승격하지 않는다.

### 선택

순수 path·CAS·renderer 기계 검사는 repository 내부 disposable root를 사용할 수 있다. 실제 host discovery와 fresh 행동 시험은 generated `skill-rails-next`를 표준 installer 경로에 정상 설치한 뒤 수행하며 `CODEX_HOME`을 바꾸지 않는다. 설치 전 기존 `skill-rails`의 path·hash를 기록하고 설치 뒤 불변을 확인한다.

### 검증과 재검토 조건

실제 표준 설치는 generated package가 준비될 때까지 `unproven`이다. Installer가 `skill-rails-next`를 별도 경로에 두지 않거나 기존 설치를 바꾸려 하면 즉시 중단한다.

## E-004 — clean-slate 범위를 transient와 legacy maintainer 자료까지 넓힘

상태: **사용자 대체 결정**

### 실제 문제와 evidence

사용자는 새 프로젝트를 깨끗한 상태에서 시작하기 위해 `.npm-cache/`, `.skill-rails/`, `.tmp/`, `node_modules/`를 완전히 삭제하고, 과거 실패 서술과 기존 제품 저작 지침도 active docs에서 제거하도록 결정했다. `docs/authoring-lessons_ko.md`와 `docs/readme-authoring.md`는 새 architecture의 현재 guide가 아니다.

### 영향받는 결정·계약·milestone

- §4.1의 retain/transient 후보 분류
- M0 capsule member와 active removal 목록
- 새 maintainer routing과 future authoring guidance

### 보존할 목적

- 두 동결 계획과 Universal Framework는 원경로·현재 bytes로 보존한다.
- README 두 파일은 checkpoint에 보존하며 이번 구현에서 갱신하지 않는다.
- `docs/assets/**`는 README가 소비하므로 유지한다.
- tracked legacy는 capsule과 Git으로 복원 가능하게 하고 transient는 source evidence로 가장하지 않는다.

### 선택과 검증

Tracked `docs/authoring-lessons_ko.md`와 `docs/readme-authoring.md`는 capsule에 포함한 뒤 active tree에서 제거한다. 네 transient root는 capsule 없이 삭제한다. 삭제 전 resolved absolute path가 repository 안인지 확인한다. 새 문서와 지침은 동결 목적·Framework·새 source/evidence에서 다시 만든다.

## E-005 — Windows working bytes와 Git base bytes가 다름

상태: **계승 — M0 receipt 정밀화**

M0-A에서 tracked 261개 중 50개가 base/working raw hash 차이를 보였고, 48개는 `core.autocrlf=true`에 따른 EOL 차이였다. Git clean은 raw-byte 동일성 증거가 아니다. Capsule inventory는 Git object와 base raw SHA-256, working raw SHA-256을 모두 기록하고 working bytes를 tar에 담는다. 현재 모든 tracked mode는 `100644`이고 symlink는 0이지만 Windows 복원만으로 POSIX mode 보존을 범용 proven으로 올리지 않는다.

## E-006 — v1 flat module manifest에는 cycle edge가 없음

상태: **계승 명확화 — 새 grammar를 추가하지 않음**

상세 계획 §5.1의 source manifest는 module ID를 file path에 직접 대응시키고 target이 module ID 목록을 import한다. Module이 다른 module을 import하는 field는 없으므로 §5.2의 module cycle은 v1 입력에서 표현할 수 없다. Cycle 검사를 만족시키려고 계획에 없는 dependency field를 추가하면 source 계약과 core 문법을 증거 없이 넓히게 된다.

M1은 module·target ID의 case-fold 충돌, target import의 중복과 존재하지 않는 module을 거부한다. Module dependency cycle은 closed flat shape에서 구조적으로 불가능하다고 기록하며 별도 graph field를 만들지 않는다. 실제 두 module 사이의 dependency가 필요하고 flat target imports로는 올바른 build/currentness를 표현하지 못한 사례가 생길 때만 최소 edge와 cycle 검사를 다시 연다.

## E-007 — M2 packet의 정적 의미 블록에 canonical owner가 없음

상태: **대체 제안 채택 — `prepare-record`에 path field 하나 추가**

### 실제 문제와 evidence

상세 계획 D-09와 §6.1은 target이 `Purpose`, 현재 행동 하나, `Judgment`, 필요한 읽기와 완료 조건을 정적으로 선언한다고 확정한다. 그러나 §5.1의 closed `target.json`과 domain config 예시에는 이 내용을 소유하는 field가 없다. `imports[0]`을 purpose로 간주하거나 entry/module 산문을 core가 해석하면 “이름이나 문장을 보고 추론하지 않는다”는 계약과 단일 owner를 위반한다.

### 영향과 보존할 목적

- 영향: target schema, build materialization, `PreparedWorkV1`, M2 packet test
- 보존: domain이 의미를 소유하고 core는 path·shape·membership만 검사하며 문자열 의미로 분기하지 않는다.
- 보존: generated `SKILL.md`는 작은 진입 표면이고 fallback을 미리 노출하지 않는다.

### 검토한 대안과 선택

`domainConfig` 확장은 core가 domain schema의 두 번째 owner가 되어 기각했다. entry frontmatter는 진입 표면을 키우고, prose heading parser와 positional first import는 숨은 추론이라 기각했다. `prepare-record` target에 `packet`이라는 target-directory-relative path 하나를 추가하고, domain-owned `packet.json`을 core-owned closed shape schema로 검사한다. 최소 shape는 `schemaVersion`, `purposeModule`, `action`, `judgment.question`, `judgment.criteria`, `reads[{path,reason}]`, `doneWhen`이다. owner path는 그 파일 자체이므로 별도 `judgment.owner`를 두지 않는다. `purposeModule`은 target imports의 실제 member여야 하고 read path는 선언 input 또는 materialized artifact여야 한다.

### 독립 반증, 검증과 재검토 조건

Claude Fable 5.1 high read-only 검증을 같은 세션에서 두 차례 수행했고, Universal Framework §2, §4.4~4.6, §7.2, §7.5, §9.2, §10으로 대안을 재대조했다. zero-widening 대안은 모두 domain 의미를 core에 넣거나 숨은 추론을 만들었다. 구현 후 unknown field, 잘못된 module/read path와 deterministic decision hash로 검증한다. 두 target에서 같은 judgment의 중복 비용이 실제로 커지거나 `packet.json`이 control 산문보다 총비용을 낮추지 못하면 M4/M5 gate에서 축소·제거한다.

## E-008 — managed-region 보존을 검사할 core frame binding이 없음

상태: **계승 명확화 — literal field 없이 최소 grammar 채택**

### 실제 문제와 evidence

상세 계획 D-05와 §6.4는 core가 marker 밖 bytes 보존을 확인하도록 하지만 marker literal은 target/config field에 없다. literal을 core에 Verify 의미로 hard-code하거나 새 marker field를 미리 추가하면 각각 domain leakage 또는 불필요한 문법 확장이다.

### 선택과 소유권

Core는 한 줄 전체가 `<!-- skill-rails-next:<id>:start -->` 또는 대응 end인 frame grammar, 정확히 한 pair, pair id 일치, current/desired의 바깥 bytes 동일성과 bootstrap separator만 검사한다. CRLF로 변환된 marker line은 trailing `\r`을 허용하되 원 bytes를 그대로 보존한다. Core는 `<id>`의 의미나 region 내부를 해석하지 않는다. Domain renderer는 첫 target의 `verify-records` id, card upsert·정렬·escape와 region 내부의 완전성을 소유한다.

### 검증과 재검토 조건

다른 id, 중복·역순·결손 marker, 바깥 bytes 변경, bootstrap, CRLF를 no-write test로 검증한다. 다른 target이 같은 output에 두 번째 region을 실제로 필요로 할 때만 marker id 선언 field와 multi-region 계약을 다시 연다. Region 내부 silent loss는 core가 의미 없이 판정할 수 없으므로 renderer golden test의 한계로 명시하며 effect proven으로 올리지 않는다.

## E-009 — output/input 중복과 idempotent retry가 frozen record 순서와 충돌

상태: **대체 제안 채택 — no-write 판정 순서 정밀화**

### 실제 문제와 evidence

첫 Verify의 `declaredOutput`인 `pilot/verification.md`는 observer가 기존 기록을 읽도록 `declaredInputs`에도 들어 있다. 따라서 모든 input 변경을 먼저 `INPUT_STALE`로 분류하면 §9.5 #7의 `OUTPUT_CONFLICT`가 불가능하다. 또 성공 write 뒤 output basis는 필연적으로 달라지므로 renderer 전 CAS 실패를 내면 §9.5 #14의 응답 유실 후 `APPLIED_ALREADY`에 도달할 수 없다.

### 선택과 보존할 목적

Lock 안에서 모든 basis를 다시 계산하되 stale 집합은 `declaredInputs - {declaredOutput}`로 한다. 이 집합이 바뀌면 renderer 전에 `INPUT_STALE`다. 그 뒤 renderer와 frame 검사를 no-write로 수행하고 desired가 current와 같으면 `APPLIED_ALREADY`와 `effect: none`을 반환한다. desired가 다르면서 output basis도 바뀐 경우에만 `OUTPUT_CONFLICT`다. 따라서 moved output에 자동 merge하거나 foreign bytes 위에 쓰는 경로는 없다.

### 검토한 반례, 검증과 재검토 조건

다른 session이 prefix, 다른 card, 같은 card를 바꾸는 경우를 대조했다. desired가 같으면 이미 그 의미 bytes가 존재하므로 no-write 성공이고, 다르면 항상 conflict다. Renderer가 answer를 무시하고 current를 그대로 반환하는 false success는 domain insertion fixture로, 비결정 renderer는 double-render idempotence fixture로 막는다. Conflict 경로에서도 renderer가 lock 안에서 최대 10초 실행되는 비용을 M3/M4 receipt에 포함한다. 이 비용이나 lock 지연이 산문 baseline보다 지배적으로 크면 prepare/record 확대를 중단한다.

## E-010 — M1 standalone gate가 M2 prepare를 선행 요구함

상태: **계승 명확화 — 하나의 gate를 두 milestone에서 닫음**

M1은 명시적으로 prepare/record를 만들지 않지만 §9.5 #3은 외부로 복사한 target의 prepare까지 요구한다. M1에서 stub을 넣거나 존재하지 않는 module을 static import하면 check조차 실행되지 않고 행동 증거를 가장한다. 따라서 M1 target-local runtime은 `check`와 integrity 의존성만 materialize해 외부 copy에서 entry와 artifact integrity를 검증한다. M2가 실제 observer/prepare를 추가한 뒤 같은 외부 copy에서 #3의 prepare 부분을 다시 닫는다. `prepared-work`와 `observed-facts` contract도 M2부터 machine-bearing target에만 포함한다.

## E-011 — authoring-side modified와 installed integrity 오류의 actor가 다름

상태: **계승 명확화 — hash 계산은 공유하고 public code를 actor별로 분리**

상세 계획 §5.3은 source를 가진 authoring-side `check/build`의 수동 변경을 `GENERATED_ARTIFACT_MODIFIED`라 하고 §7은 설치 target runtime의 불일치를 `ARTIFACT_INTEGRITY_FAILED`라 한다. Authoring core는 유효 receipt가 있는 tree의 path/hash 차이를 전자로 반환해 merge나 자동 복원을 막는다. Receipt가 없거나 깨졌거나 symlink/non-regular artifact이면 소유된 generated tree라는 근거가 없어 후자를 반환한다. 설치 target의 embedded runtime은 원인 추정 없이 항상 후자를 반환하고 재설치를 안내한다. 두 경우 모두 no-write이며 `artifact-intact`는 false다.

## E-012 — authoring source layout과 target-relative entry가 상위 경로를 요구함

상태: **계승 명확화 — realpath containment를 최종 안전 조건으로 사용**

상세 계획 §4는 authoring entry를 `authoring/skill-rails/SKILL.source.md`, target descriptor를 `authoring/skill-rails/targets/authoring/target.json`에 둔다. §5의 domain 예시는 `entry.md`를 target-relative로 선언하므로 같은 규칙을 적용하면 authoring target은 `../../SKILL.source.md`를 사용해야 한다. 모든 `..` token을 기계적으로 거부하면 동결된 두 경로를 동시에 만족할 수 없다.

Manifest의 module/target path와 runtime declared input/output은 기존처럼 dot segment를 거부한다. Target-local source reference만 상대 해석을 허용하되, 최종 `realpath`가 source package root 안인 경우에만 받는다. Root 밖으로 나가거나 symlink를 통해 이탈하면 `PATH_OUTSIDE_ROOT`다. Receipt에는 parent segment가 아니라 root-relative canonical physical path를 기록한다. 상위 참조가 실제 가독성·이식 문제를 만들면 source layout 또는 별도 root-relative 문법을 다시 검토하되, 동결 문서를 이동하지 않는다.

## E-013 — 배포 runtime의 canonical source 위치

상태: **계승 명확화 — `src/runtime/`을 단일 배포 원천으로 사용**

상세 계획의 예상 tree는 `prepare.mjs`, `record.mjs`, `apply-file.mjs`를 `src/core/` 아래에 나열하지만, 같은 계획은 generated target이 저장소나 sibling 없이 실행되는 target-local runtime을 요구한다. 저작 CLI와 설치 후 runtime을 한 디렉터리에 두면 build-time API와 배포 API의 import 경계가 흐려지고, 반대로 같은 구현을 두 위치에 복제하면 currentness owner가 둘이 된다.

저작·검사·materialization 로직은 `src/core/`, 생성물에 그대로 복사되는 실행 로직은 `src/runtime/`이 한 번만 소유한다. `record.mjs`가 CAS, lock, renderer spawn, staged replace와 reread를 계속 소유하므로 core/domain 책임 경계는 바뀌지 않는다. `apply-file.mjs`라는 얇은 전달 파일은 별도 계약이나 재사용자가 없어 만들지 않았다. Build receipt가 각 runtime source와 생성 artifact hash를 연결하고, standalone copy·fault injection·source-current test가 이 선택을 검증한다. 두 runtime이 독립 배포 또는 독립 versioning을 요구하는 실제 사례가 생기면 package 경계를 다시 연다.

## E-014 — 공식 installer의 list JSON 조합이 도움말과 불일치

상태: **실측 adapter 제약 기록**

2026-09-13의 `skills@latest`는 도움말에 `--list`와 `--json`을 각각 표시하지만 두 옵션을 함께 주면 `The --json flag cannot be combined with --list.`로 종료했다. 따라서 discovery receipt는 기본·full-depth `--list`의 사람이 읽을 수 있는 출력과 실제 install의 `--json` 출력을 분리해 보존한다. 두 discovery 방식 모두 `skill-rails-next` 하나만 찾았고, 표준 global install은 기존 `skill-rails`를 바꾸지 않은 채 `skill-rails-next`를 Codex와 Claude Code에 설치했다. 향후 installer가 list JSON을 지원하면 parser를 추가하되 현재 출력을 성공 JSON으로 가장하지 않는다.

## E-015 — 성공한 record의 응답 유실 뒤 fresh agent가 재시도하지 않음

상태: **M4 행동 실패 뒤 최소 operational contract 보강**

### 실제 문제와 evidence

`record`는 성공 write 뒤 같은 answer 재시도에 `APPLIED_ALREADY`를 반환하도록 M3에서 검증됐다. 그러나 M4 Codex fresh run에서 evaluator가 실제 `APPLIED` stdout만 유실시키자 agent는 수동 편집을 피했지만 같은 `recordCommand`도 재시도하지 않았다. 출력은 이미 적용되어 있었고 evaluator state가 그 sha256을 관찰했으나 agent는 최종 file effect를 `unproven`으로 남겼다. 원본 실행은 `evals/m4/results/failed-response-loss-codex-2026-09-13.json`과 raw capture에 보존한다.

### 영향받는 결정·계약·milestone

- §9.5 #14의 idempotent retry를 실제로 사용하는 generated entry 행동
- M4의 record 성공 응답 유실 대표 scene과 acceptance
- authoring source 수정부터 target rebuild·정상 재설치까지의 유지보수 비용

### 보존할 목적과 검토한 대안

Core grammar, renderer, CAS 순서와 effect authority는 바꾸지 않는다. 응답이 없을 때 output을 열어 성공을 추정하거나 managed region을 손으로 고치는 대안은 authority와 무손실 계약을 깨므로 기각했다. 무한 재시도도 실행 비용과 반복 effect를 통제하지 못하므로 기각했다. Canonical target entry가 유효 JSON 결과가 없을 때 **정확히 같은 명령을 한 번만** 재시도하도록 하고, 이미 적용된 경우 runtime의 `APPLIED_ALREADY`를 신뢰한다.

### 검증과 재검토 조건

평가 전용 PATH proxy가 첫 record를 실제 실행해 `APPLIED`와 output hash를 별도 state로 보존한 뒤 stdout만 숨긴다. 보강된 entry를 rebuild·공식 installer로 정상 재설치하고 fresh context에서 동일 장면을 다시 실행해 두 번째 호출의 `APPLIED_ALREADY`, no-write, 최종 hash 동일성을 확인한다. 한 번 재시도로도 agent 행동이 수렴하지 않거나 host별 invocation이 크게 갈리면 더 많은 산문을 덧대지 않고 renderer-only 또는 prose 판정 후보로 돌린다.

## E-016 — command failure의 verdict가 동결 행동 장면과 불일치

상태: **동결 계약으로 정정 — 기존 구현 선택 폐기**

### 실제 문제와 evidence

상세 계획 §9.6은 “명령 실패 또는 evidence 부족으로 `unproven`”을 대표 scene으로 고정했다. 하지만 첫 domain packet은 “A command failure is fail”이라고 지시했고, 실패 fixture에서 Claude가 그 지시대로 `fail`을 기록했다. `prepare`도 정상 성공했기 때문에 이 실행은 의도한 fallback 장면도 아니었다. Raw capture와 `evals/m4/results/failed-command-failure-claude-2026-09-13.json`에 두 불일치를 보존한다.

### 영향과 보존할 목적

- 영향: domain-owned `packet.json`의 judgment criterion, generated packet bytes, M4 command-failure scene
- 보존: 기계가 실행 실패를 제품 행동 실패로 과장하지 않고 missing evidence를 `unproven`으로 남긴다.
- 보존: `fail` enum은 직접 관찰한 반증처럼 별도 evidence가 acceptance behavior의 불성립을 지지할 때 사용할 수 있다.

### 검토한 대안, 선택과 재검토 조건

Nonzero exit를 항상 `fail`로 두는 해석은 단순하지만 동결된 대표 scene을 조용히 바꾸므로 기각했다. 반대로 모든 부정 evidence를 `unproven`으로 축소하면 `fail` enum의 의미를 없애므로 기각했다. Packet은 command execution failure·미실행·불충분 evidence를 `unproven`으로, 직접적인 acceptance 반증만 `fail`로 구분한다. 수정 target을 rebuild한 command-failure fresh run이 `unproven`과 원인을 기록하는지 확인한다. 실제 소비자에서 test assertion failure와 인프라 실행 실패를 안정적으로 구분할 observed fact가 필요해지면 observer/result schema 확장을 별도 gate로 다시 검토한다.

## E-017 — fallback agent가 treatment renderer를 찾아 비교 lane을 오염

상태: **M4 행동 실패 뒤 한 번의 최소 routing 보강**

### 실제 문제와 evidence

유효하게 build된 observer-failure variant에서 Claude는 `PREPARE_FAILED` 뒤 처음에는 canonical fallback을 열었다. 그러나 marker 형식을 알아내려고 설치 target 전체를 검색하고 renderer·schema·domain config를 읽은 뒤 renderer를 직접 호출해 output을 교체했다. 결과 region은 parseable했고 prefix도 자체 비교했지만, fallback이 treatment 기계를 사용했으므로 control과 같은 source에서 생성된 산문 lane이라는 비교 조건을 잃었고 core record의 CAS·lock·reread authority도 거치지 않았다. `evals/m4/results/failed-contaminated-fallback-claude-2026-09-13.json`이 실행을 보존한다.

### 영향과 보존할 목적

- 영향: generated entry의 fallback routing, M4 fallback 사용률·비용·오염 판정
- 보존: fallback은 treatment 승리에 합산하지 않고 canonical control baseline의 실효성만 측정한다.
- 보존: prepare 실패 뒤 다른 target runtime을 임의로 조합해 별도 비공식 제품 경로를 만들지 않는다.

### 대안, 선택과 중단 조건

Fallback에 renderer 경로와 호출 계약을 추가하면 renderer-only 정식 mode를 우회해 숨은 두 번째 제품 경로가 되므로 기각했다. Target 파일을 물리적으로 제거한 variant는 실제 설치 조건을 왜곡하므로 기각했다. Entry에 fallback 문서와 그 문서가 이름 붙인 project file만 사용하고 다른 target runtime을 탐색·호출하지 말라는 한 문장만 추가한다. Fresh retest에서도 treatment runtime을 사용하거나 새 비공식 marker/쓰기 절차 때문에 무손실 acceptance를 만족하지 못하면 산문을 더 늘리지 않고 fallback을 부적합·미검증으로 확정한다.

## E-018 — 표준 Claude stream이 무관한 사용자 hook 본문을 raw receipt에 포함

상태: **평가 evidence 최소화 — host payload redaction**

표준 host 조건을 유지한 Claude stream에는 실행 도구·결과뿐 아니라 프로젝트와 무관한 사용자 hook 전체 본문과 host init inventory가 포함됐다. 이 bytes는 M4 acceptance·비용·stage 행동을 검증하는 데 필요하지 않고 저장소 안에 복제하면 evidence 최소화와 사용자 변경 보존 목적에 어긋난다.

Harness는 assistant/user tool event, command/result, 모델·비용·rate-limit event를 유지하되 system hook payload와 장황한 init inventory만 이름·결과·redaction 표식으로 바꾼다. 기존 capture에도 같은 deterministic sanitizer를 적용하고 redaction 수와 새 stdout hash를 기록한다. Hook의 세부 내용 자체가 실험 변수가 되는 별도 protocol이 승인될 때만 원문 보존을 다시 검토한다.
