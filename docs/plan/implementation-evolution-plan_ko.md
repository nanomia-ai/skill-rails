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

## E-019 — 선언상 record-only와 실제 prepare 종속 runtime의 불일치

상태: **M5 renderer-only 최소 경계 채택 및 작은 gate 통과**

### 실제 문제와 evidence

M4 직후 `contracts/target.schema.json`은 `record-only` target을 closed shape로 허용했지만 `src/core/build.mjs`는 모든 non-prose target에 같은 `scripts/run.mjs`를 배포했다. 그 public runtime은 `prepare`를 노출했고, `record-only` build에는 `prepare.mjs`가 없었다. 동시에 `src/runtime/record.mjs`는 prepare만 만드는 `decision.json`과 `decisionSha256`을 무조건 요구했다. 따라서 schema가 허용한 record-only는 존재하지 않는 command를 광고하고 어떤 정상 answer도 기록할 수 없는 미완성 mode였다. M4의 prepare-record 코드와 receipts는 이 차이를 발견하게 한 비교 evidence이지 채택된 production baseline이 아니다.

### 영향받는 결정·계약·milestone

- D-02의 “structure와 judgment 분리”, D-04의 최소 상태 좌표, D-05의 prepare/record 분리, D-06의 effect authority, D-11의 renderer-only 전환 조건에 영향을 준다.
- Target schema, generated public command, exchange shape, answer scratch, record identity/CAS 계약과 M5의 첫 선행 gate가 직접 영향 범위다.
- M1~M4 prepare-record receipts와 최초 실패 receipt는 삭제·성공 덮어쓰기를 하지 않는다. Framework L0/L1/L2와 Product target은 이 경계가 닫힌 뒤의 다음 작업으로 남긴다.

### 보존 목적

AI가 현재 declared input과 domain-owned command·의미 기준을 읽어 판단하고, 기계는 closed answer 형식과 raw input/output basis, target/project/receipt identity, lock, deterministic renderer, staged replace, managed-region 밖 bytes와 다른 card 보존, post-write reread authority만 맡는다. Observer가 작업을 고르거나 eight-block packet이 산문을 재포장하거나 decision hash가 semantic state를 고정하거나 fallback이 별도 제품 경로가 되는 일을 피한다.

### 검토한 대안

1. 기존 prepare를 `initialize`로 이름만 바꾸기: observer, packet, decision, fallback 비용과 M4의 실패 원인을 그대로 재현하므로 기각했다.
2. AI가 exchange와 output을 직접 만들거나 renderer를 직접 호출하기: full-basis CAS, lock, marker 밖 byte 보존과 reread authority를 우회하므로 기각했다.
3. Answer 본문 또는 verdict를 durable exchange state에 복제하기: answer contract와 의미 owner가 둘이 되고 stale semantic state가 생기므로 기각했다.
4. 별도 record 구현을 복제하기: 두 mode의 안전 계약이 drift하므로 기각했다.

### 가장 단순한 선택

`record-only` target의 public surface를 `check | initialize --project | record --exchange`로 한정한다. Initializer는 manifest의 declared inputs/output을 현재 project에서 raw basis로 읽고, domain answer contract에서 최소 answer scratch를 만들며, input/output·domain config·answer contract·answer·exact record command locator를 한 JSON으로 반환한다. Exchange에는 mode와 package/target/project/receipt/output identity 및 raw input/output basis만 저장하고 semantic verdict·관찰 사실·작업 선택·fallback state는 저장하지 않는다.

Domain-owned 의미 기준, 완료 조건, response-loss 때 exact record command를 한 번만 재시도하는 규칙의 단일 prose owner는 target `entry.md`다. Domain config는 실행할 program/args/cwd와 card identity를, answer schema는 closed semantic answer shape를 소유한다. `src/runtime/exchange.mjs`가 두 mode의 basis/scratch/staged exchange 생성 단일 owner가 되고, `src/runtime/record.mjs`가 기존 CAS·lock·renderer·staged apply·reread 단일 owner로 남는다. Prepare-record만 decision hash/file을 추가 검증하며, 단일 historical fixture owner `fixtures/verify-v1/prepare-record-{target.json,entry.md}`에서 M4 evidence 경로를 계속 재현한다.

### 검증 결과

- Machine: 전체 `npm test` 38/38 pass. Standalone record-only tree에 observer, packet, fallback, `prepare.mjs`가 없고 `prepare` command는 `ARGUMENT_INVALID`다. 정상 APPLIED/APPLIED_ALREADY와 invalid answer, input stale, output conflict, lock, malformed marker, renderer failure/non-UTF8, other-card preservation, exchange/root transplant, response-loss용 idempotent retry, post-write reread mismatch가 no-silent-loss로 검증됐다. 이 층은 delivery와 deterministic safety만 증명한다.
- Install: 표준 `skills@latest` global copy installer가 같은 tree `cf9ad62da45c925f12c63142dcf45d7603a1c591b020379c3739af6909c829cf`를 Codex·Claude Code에 설치했고 둘의 runtime check가 `ARTIFACT_INTACT`였다. `CODEX_HOME`은 바꾸지 않았고 기존 global `skill-rails`는 설치 전후 63개 파일과 동일 task-local raw path+content hash를 유지했다.
- Fresh behavior/effect: 동일 normal fixture에서 Codex 0.148.0과 Claude Code 2.1.270이 initialize → declared reads/config → command → answer → record를 실행해 각각 canonical `APPLIED`와 reread-observed effect를 냈다. Observer/packet/decision/fallback/prepare 사용은 0이다. 상세 bytes, tool calls, wall time, 비용과 unknown은 `evals/m5/results/renderer-only-boundary-gate-2026-09-13.json` 및 raw capture가 소유한다.
- 좁은 판정: 두 host 모두 prepare를 재현하지 않고 안전 기록에 성공했으므로 Framework 실험으로 진행할 최소 경계는 지지된다. M4 normal treatment보다 tool call은 줄고 Claude 비용·시간과 Codex input token은 줄었지만 Codex wall time은 늘었다. 따라서 prose 대비 또는 일반 비용 우위, 다른 scene·model·version의 행동은 주장하지 않는다.

### 제거·재검토 조건

Initializer가 작업 선택, observer fact, packet heading, semantic decision hash, fallback routing을 요구하기 시작하거나 declared read surface보다 비싼 두 번째 prose canon이 되면 제거·축소한다. Safe record를 위해 durable semantic state, auto-merge, multi-output transaction, remote effect adapter 또는 권한 확대가 필요해지면 구현을 덧대지 않고 사용자에게 제품 경계 결정을 회부한다. Framework L0/L1/L2나 후속 Product target에서 locator만으로 반복적인 whole-load·역산 실패가 실제로 관찰될 때만 최소 projection/edge를 별도 gate로 검토한다.

## E-020 — Framework lane 기준안 오염과 비용 receipt의 비비교성

상태: **M5 실험 전제 교정 채택 — v1 예비 실행 보존, v2 비교 재시작**

### 실제 문제와 evidence

Framework whole original과 heading index를 처음 materialize하면서 저작 entry에 “목적부터 시작하고, prose/renderer/core 대안을 비교하고, owner를 나누고, evidence가 없으면 unproven으로 둔다”는 여섯 단계 요약을 함께 넣었다. L0 harness는 Framework 문장 하나만 교체했기 때문에 이 사람이 관리하는 판단 요약을 그대로 읽었다. 따라서 Framework 노출만 달라야 하는 D-11과 M5 §2의 기준안을 오염했고 L0와 L1의 차이를 인위적으로 줄였다. 첫 v1 receipt들은 또 Claude의 `cache_creation_input_tokens`와 `cache_read_input_tokens`를 누락했고, lane 필수 Framework bytes를 fixed read에 넣지 않았으며, L2가 사용하지 않는 index 크기를 유지 비용으로 계산했다. CLI 인자 실패 두 건과 `tests/` 미복사 두 건도 AI 결과인 `machine-fail`처럼 기록됐다.

### 영향받는 결정·계약·milestone

- D-11의 whole-original 단일 의미 owner, L0/L1/L2 노출 차이, heading index 제거 조건
- M5 §2~§5의 동일 operational contract, fresh cell 유효성, 비용 receipt와 lexicographic gate
- 검증 증거 층위에서 delivery, 의미 acceptance, fresh behavior와 reread effect를 분리하는 계약
- 생성된 authoring target의 entry/currentness 및 M5 status owner

v1 raw transcript와 receipt는 실패·예비 evidence로 그대로 보존하고, 후속 v2 lane 결과나 Product adoption evidence로 승격하지 않는다.

### 보존 목적과 검토한 대안

보존 목적은 세 lane이 동일한 source/build 안전 계약과 raw task를 받고 Framework 노출 한 문장만 다르게 하며, host가 실제로 읽은 bytes와 실행 결과를 누락 없이 기록하는 것이다. 여섯 단계를 L0에만 남기는 안은 기준안을 계속 오염시키고, L1/L2에만 남기는 안은 whole original 옆에 drift 가능한 두 번째 의미 owner를 만든다. v1 receipt를 성공 또는 새 수치로 덮어쓰는 안은 최초 harness 실패를 지우므로 기각했다. Transcript를 완전히 의미 해석하는 새 parser나 review UI를 만드는 안도 평가 장치를 제품보다 키우므로 기각했다.

### 가장 단순한 선택

Canonical `SKILL.source.md`에서 판단 절차 요약을 제거하고 domain meaning의 canonical owner, 실제 consume 관계의 명시, fail-closed build, deterministic build/currentness와 evidence 한계만 operational contract로 남긴다. Generated target은 canonical build로 다시 만든다. v1 schema와 모든 v1 receipt는 별도 protocol evidence로 유지하고, v2는 고정 fixture 사전조건, exact host identity, raw usage, host별 token scope, transcript에서 관찰된 read bytes, repository-original leak, index consultation과 lane build/currentness를 closed receipt로 기록한다. Semantic acceptance와 unfamiliar using-AI effect는 lane label과 Framework read report를 가린 별도 fresh receipt가 소유하며 machine harness가 값을 대신 채우지 않는다. Seed 2는 두 host의 delivery/semantic acceptance가 엇갈리거나 해당 cell을 뒤집었을 때 lexicographic lane 결과가 바뀌는 경우에만 연다.

### 독립 반증, 검증과 재검토 조건

같은 Claude Fable high 세션을 Orca의 새 Task/Dispatch로 재사용해 frozen §8.1, D-11/D-12/D-14와 Framework §0/§0.1 기준으로 반증했다. 검토자는 여섯 단계가 operational contract와 판단 요약을 섞은 두 번째 owner이고 v1 비용은 gate에 쓸 수 없다고 판정했으며, canonical entry 교정, 별도 v2 schema, 사전조건, blinded evidence pointer rubric과 기계적인 seed-2 규칙에 동의했다. v2 전체 matrix와 unfamiliar using-AI가 끝나기 전 Framework lane 우위는 `unproven`이다. 첫 v2 revision 2 bounded Codex cell은 task-specific delivery를 통과했지만 격리 tree에 남은 harness 자기검사가 의도적으로 복사하지 않은 protocol을 요구해 전체 test 41/42를 만들었다. Protocol을 fixture에 복사하면 L0에 다른 lane·task가 유출되므로 기각하고, revision 3은 그 자기검사만 제외하며 나머지 fixture test 39/39와 두 host preflight를 통과했다. Revision 2 receipt는 성공이나 실패로 덮지 않고 별도 classification에서 비교 제외한다. Matrix에서 index가 실제 탐색 왕복을 줄이지 못하면 production path에서 제거하고, line 기반 host가 반복 whole-load하는 직접 evidence가 있을 때만 D-11의 projection 또는 line-coordinate 변경을 다시 연다. 이 교정 장치 자체가 prose 기준안보다 비용이 크거나 판단 의미를 저장하기 시작하면 harness를 축소한다.

## E-021 — Framework 검증 계층 증식 중단과 historical 평가 경로 격리

상태: **사용자 교정 채택 — 진행 중 matrix 중단, M5 Framework는 unproven/pre-gate**

### 실제 문제와 evidence

E-020을 구현하면서 하나의 lane 결정을 위해 protocol revision, receipt schema 두 버전, 분류 schema 두 개, 별도 artifact-review schema, review protocol, 34KB가 넘는 harness와 default test까지 생겼다. 이 장치는 실제 Product adoption 전인데도 product core의 `contracts/`, `src/`, 기본 `tests/`에 걸쳐 있었고, 첫 fixture 오류를 고치기 위해 revision이 연속 증가했다. 2026-09-14 사용자는 이를 legacy와 같은 증식 패턴으로 판정하고 진행 중인 revision 3의 18-cell matrix를 즉시 중단하도록 교정했다. 중단 시점에는 L0의 product·bounded·recovery를 Codex와 Claude Code에서 실행한 6개 cell만 complete receipt와 raw transcript를 남겼고, 시작만 된 L1 product 두 cell은 receipt가 없어 결과로 취급하지 않는다.

### 영향받는 결정·계약·milestone

- D-11의 L0/L1/L2 비교, heading index 제거 조건과 M5 §2~§5의 lane 선택은 아직 닫히지 않았다.
- 검증 증거 층위에서 완료된 transcript는 관찰 evidence지만, L0 우위나 Framework 효과, Product adoption을 증명하지 않는다.
- M2~M4의 prepare/fallback 재현은 과거 evidence 경로이며 현재 record-only product의 default build/test 경로가 아니다.
- 평가용 schema와 harness의 소유자는 product core가 아니라 해당 `evals/m5/framework/` 실험 경계다.

### 보존 목적과 검토한 대안

완료된 receipt/raw, 기존 분류 파일, 실행 당시 protocol, M4 fixture와 최초 실패 evidence는 덮어쓰거나 삭제하지 않는다. Matrix를 끝까지 실행하는 안과 blinded review·unfamiliar using-AI 전수 검증을 이어가는 안은 어떤 결과가 나와도 당장 Product adoption을 시작하지 않는다는 사용자 결정과 맞지 않고, 실행·학습·복구 비용이 판별 가치보다 커져 기각했다. 평가 파일을 core에 둔 채 test skip flag나 환경 분기를 추가하는 안도 두 번째 workflow를 만들므로 기각했다. 반대로 prepare-record mode 자체를 지금 core에서 제거하면 동결 D-05와 보존 중인 M1~M4 재현 계약까지 바꾸므로 이번 감축 범위를 넘는다.

### 가장 단순한 선택

진행 중 matrix를 중단하고 완료된 6개 revision 3 L0 receipt/raw와 이전 v1/v2 evidence만 그대로 보존한다. Framework harness, 그 receipt·분류 schema와 자기검사는 `evals/m5/framework/`가 함께 소유하게 옮기고, 실행하지 않은 artifact-review schema와 review protocol은 제거한다. M4 prepare/fallback 재현 helper와 test는 `evals/m4/`로 옮겨 기본 `tests/*.test.mjs` discovery에서 제외한다. Product core에는 실제 build 또는 generated target이 소비하는 contract/runtime만 남긴다. Routine 검증은 변경 owner의 targeted test와 build 후 integrity/currentness로 제한하고, 전체 `npm test`는 coherent milestone 종료에 한 번만 실행한다.

### 검증 결과와 미검증

Matrix 프로세스는 Ctrl-C로 종료되어 exit code 1이었고 이후 새 cell을 시작하지 않았다. Revision 3에서 완료된 6개 L0 receipt는 각자 `validity=valid`, `deliveryPass=true`, host exit 0을 기록하지만 semantic review와 unfamiliar using-AI가 없으므로 Framework lane 효과는 `unproven`이다. 파일 이동의 owner-targeted `build.test.mjs`+`record.test.mjs`는 23/23, authoring build는 tree `7e0c986256f01853fdf9a11848970aa305b920941b322342ef4182a5109fc531`, 분리한 artifact integrity/source currentness는 모두 true였다. 이동한 historical JS는 `node --check`만 수행했고 M4/M5 evidence를 재실행하지 않았다. 감축 단위 종료 시 default `npm test`를 한 번 실행해 27/27 pass를 확인했다. M4 재현 test와 M5 harness test는 evidence를 재현해야 하는 별도 gate에서만 명시 경로로 실행한다.

### 제거·재검토 조건

허용된 L1 bounded Codex 1회와 L2 bounded Codex 1회도 현재는 실행하지 않는다. 한 host·한 task·lane별 1회는 동결 M5 §5의 L1 채택 조건을 판정할 수 없어 지원·반증·혼합 어느 결과에서도 다음 행동이 같기 때문이다. Provisional entry는 별도 효과 주장이 아니라 D-11이 이미 정한 §0+§0.1 self-routing(L1)을 유지하고 `unproven`으로 표시한다. L0를 evidence 부족만으로 새 default로 고르는 것도 동결 결정을 바꾸므로 하지 않는다. Framework 비교는 실제 Product adoption gate의 fresh author/consumer 관찰과 한 번에 합치고, 그 gate가 현재 결정을 바꿀 최소 evidence를 갖출 때만 다시 연다. 18-cell 재개, 새 protocol/schema revision, blinded/using-AI 대량 검증은 사용자 확인 전 금지한다. Fresh two-host·semantic·using-AI 검증은 해당 adoption 또는 release gate에서 한 번만 수행한다. Prepare-record core mode 제거는 default product 소비가 없고 historical reproduction을 별도 capsule로 유지할 수 있다는 근거가 생기는 adoption gate에서 사용자 경계 결정으로 다시 검토한다.

## E-022 — Product prose-only 최소 후보와 소비 host gate

상태: **단일 author→consumer 관찰로 pilot Product 채택 — 최초 전달 실패는 별도 보존**

### 실제 문제와 evidence

M4의 prepare 기각 뒤 M5 Product가 fresh human-editable brief를 만들기 위해 record-only renderer를 쓰면 domain config·answer contract·두 번의 runtime 호출과 managed region을 새로 요구한다. 이는 의미를 판단하는 AI의 부담을 줄이는 증거 없이 renderer-owned state와 복구 비용을 만든다. 반대로 prose-only target은 package manifest의 실제 target 선언, closed target descriptor, 한 entry라는 세 canonical owner만으로 `pilot/product-request.md`를 `pilot/brief.md`로 전달할 수 있다. Fresh Codex author 1회(`task_0bf81da50075`, `ctx_b161ded16b53`)는 이 후보와 실제 fixture를 만들고 targeted build test 11/11, standalone tree `6b8aff91c9fcc86d6ec6a822c03fa8bc8af8987261be0715bcadbc244b93fe17`, integrity와 source currentness를 확인했다.

첫 fresh Claude unfamiliar consumer launch(`task_d9a31baf4c50`, `ctx_634b1dd3f176`)는 Product task를 받기 전에 Claude Code의 workspace trust prompt에서 멈췄다. Orca는 36초 뒤 `agent_prompt_stalled`, stage `dispatch_input`으로 실패 처리했다. 설치된 Product tree와 fixture input hash는 launch 전에 확인됐고 launch 뒤 `pilot/brief.md`는 존재하지 않았다. 이 실패와 no-effect는 성공으로 덮지 않는다.

이후 사용자는 계속 진행 의사를 명시하고, architecture 재검토나 검증 증식 없이 Claude Code의 문서화된 bypass permissions 비대화형 방식이 있을 때만 같은 fixture에서 consumer를 정확히 한 번 새로 열도록 교정했다. `claude --help`는 `--print`가 workspace trust dialog를 건너뛰고 `--permission-mode bypassPermissions`와 `--permission-prompts none`을 지원함을 명시했다. 동일 input hash `8075b9b103f5f468e588c5f29a76042d68de8cf23d2ca9f238fcc13f36ef2b90`, 동일 installed tree를 다시 확인한 뒤 Claude Code 2.1.270/Fable high를 한 번 실행했다. Host는 installed Product skill을 발견하고 entry와 request를 읽어 no-clobber create를 수행했으며, coordinator reread에서 555-byte brief SHA-256 `c034188c8fb0de1a74d388ab7279dfb30325e782514df65e7eaa3212c1919e80`을 확인했다. Request paragraph는 verbatim이고 HTTPS-only boundary와 세 unknown이 명시됐으며 추가 scope는 관찰되지 않았다.

### 영향받는 결정·계약·milestone

- D-11의 provisional §0+§0.1 self-routing은 author가 읽었다는 관찰만 있고 L0/L1/L2 상대 효과는 여전히 `unproven`이다.
- D-12의 “기계가 확실한 계산만 맡고 의미 판단은 AI에 남긴다”는 Product prose 후보에서 유지됐고 한 unfamiliar consumer의 acceptance/effect가 관찰됐다.
- M5 §6의 Product adoption은 이 pilot의 한 author→consumer 관찰 범위에서 닫혔다. 이 승리를 Direct/Work/Verify/Resume에 복사하지 않고 다음 의존인 maintainer/source-graph 확인으로 돌아간다.
- 실제 shared consumer가 없는 module을 만들어 differential currentness를 가장하지 않았으므로 M5 §9의 shared-source consumer 검증도 `unproven`으로 남는다.

### 보존 목적, 검토 대안과 가장 단순한 선택

목적은 request의 원문, HTTPS-only acceptance boundary, storage location·retention period·import support의 `unknown`, 기존 brief no-overwrite를 fresh AI가 최소 읽기로 보존하는 것이다. Record-only renderer, 새 core mechanism, 독립 author script는 각각 불필요한 schema/state, 제품 core 확대, 두 번째 runtime owner를 만들므로 기각했다. Product entry는 observer·packet·prepare·fallback·renderer·durable semantic state 없이 prose-only로 둔다. Renderer-owned Product brief 비용 측정은 동결 M5의 강제 채택이 아니라 후보 gate로 보며, prose run에서 wording/unknown/no-invent/no-overwrite 실패가 실제로 관찰될 때만 다시 연다.

### 검증, 실패 보존과 재검토 조건

상세 receipt는 `evals/m5/results/product-adoption-gate-2026-09-14.json`이 소유한다. Author transcript는 Orca archive source identity와 worker report를, consumer receipt는 trust prompt terminal tail, input/tree hash, zero tool/read와 no-effect reread를 연결한다. Isolated setup 중 잘못 조합한 첫 build form은 `ARGUMENT_INVALID`로 fail-closed했고 documented `--target`+`--out` form으로 launch 전에 바로잡았으며, 비-Git folder 등록 실패 뒤에는 빈 local Git metadata만 만들었다. 이 setup 진단도 receipt에 숨기지 않는다. Gate 종료 시 default `npm test`를 한 번 실행해 28/28 pass를 확인했다.

최초 interactive launch에는 수동 trust 입력을 하지 않았고, 사용자 교정 뒤에는 Codex YOLO가 아니라 Claude 고유의 documented bypass permissions/print mode만 사용했다. 새 protocol/schema/harness/verifier는 만들지 않았고 추가 재시도도 하지 않는다. 성공 run은 tool call 3, entry+input read 2,249 bytes, wall 29,368ms, API 15,546ms, USD 0.402299를 기록했다. 관련 host event는 E-018에 따라 무관한 hook 본문을 제외한 `evals/m5/results/raw/claude-product-adoption-captured.json`에 보존한다.

이 한 관찰은 Product prose-only 후보가 현재 pilot acceptance를 만족하고 downstream M5 의존으로 진행할 근거다. 다른 fixture/model/version, interactive Claude, 반복 비용, Framework lane 효과와 다른 stage 채택은 `unproven`이다. Prose에서 wording/unknown/no-invent/no-overwrite 실패가 실제로 관찰될 때만 renderer 후보를 다시 열며, Product gate 자체는 반복하지 않는다.

## E-023 — Fresh maintainer의 넓은 탐색과 D-14 pointer 누락

상태: **부분 실패 보존 — graph schema는 보류하고 owning code의 최소 pointer만 보강**

### 실제 문제와 evidence

M5 §7의 fresh Codex maintainer(`task_b2cb01338145`, `ctx_6608c5a52638`)에게 Product target부터 source graph 일곱 질문을 읽기 전용으로 답하게 했다. `inspect`는 Product의 package owner, 빈 imports/consumers, generated `SKILL.md`, 빈 mechanisms와 machine I/O, 그리고 `requirement/check/external-boundary semantic edges are not declared in v1` gap을 정확히 반환했다. Package focus도 두 실제 target을 반환했다. 하지만 maintainer는 의미 requirement·check·effect owner를 찾으면서 279-match 전역 검색까지 넓혔고, 존재하지 않는 `.codegraph/` 확인용 복합 PowerShell이 실패한 뒤 CodeGraph를 호출했으며, 여러 독립 shell 명령을 세미콜론으로 묶었다. 충분한 관찰 뒤 최종 report를 PowerShell here-string으로 만들려다 parse error에서 진행하지 못해 626초에 exact dispatch를 종료했고 `worker_done`은 없었다.

### 영향받는 결정·계약·milestone

- D-12와 M5 §7의 일곱 maintenance 질문, bounded source graph, colocated semantic edge 입장 gate
- D-14의 currentness/CAS/output lock/effect authority 위치에 두는 one-line why/risk + stable test pointer
- M5 완료 조건의 fresh maintainer 읽기·wrong-owner·복구 evidence

### 가장 단순한 선택과 대안

Semantic edge schema를 즉시 추가하는 안은 실제 wrong owner/consumer 수정으로 이어진 장면이 없고, Product `entry.md`, 기존 targeted test, build receipt와 verification receipt의 bounded owner read로 관계를 복구할 수 있어 기각했다. 실패한 maintainer를 재실행하는 안도 검증 비용을 늘리므로 기각했다. Human projection은 사람이 반복 역산한 evidence가 없어 열지 않는다.

반면 `src/runtime/record.mjs`의 raw-basis CAS, output lock, post-write reread authority 옆에는 D-14가 필수로 요구하는 stable test pointer가 하나도 없었고 maintainer가 그 검증 경로를 찾으려고 검색을 넓혔다. 새 index나 문서 대신 owning code의 해당 세 위치에 각각 한 문장 comment를 두고 기존 test 이름만 가리켰다. Graph 관계, exact enum, timeout과 분기 순서는 복제하지 않았다.

### 검증과 재검토 조건

`node --test tests/record.test.mjs` 13/13 pass로 owning runtime behavior가 변하지 않았음을 확인했다. Fresh maintainer를 반복하지 않았으므로 새 pointer가 실제 read 왕복을 줄이는지는 `unproven`이다. 상세 evidence는 `evals/m5/results/maintainer-source-graph-gate-2026-09-14.json`이 소유한다. 이후 실제 maintainer가 같은 pointer를 지나치거나 comment가 drift·중복을 만들면 축소한다. 실제 wrong owner/consumer 수정이 생기고 existing prose/import/receipt로 bounded 복구할 수 없을 때만 그 질문 하나의 colocated edge를 다시 검토한다.

후속 설계 감사의 세 stage 제안을 한 번에 구현하면서 manifest에 `direct-next`·`work-next`·`resume-next`와 각 prose target 두 파일을 추가했으나, 이는 Product의 prose 관찰을 다른 stage에 복사해 M5의 target별 adoption gate를 건너뛴 drift였다. 해당 manifest 세 항목과 새 target 여섯 파일만 즉시 되돌렸고 다른 M5 변경은 건드리지 않았다. 이 임시 source로 수행한 build/currentness 결과는 채택 evidence가 아니며, 다음에는 pilot 순서상 Direct 하나만 별도 후보 비교와 단일 fresh author→consumer gate로 연다.

## E-024 — Direct prose-only 최소 후보의 독립 adoption gate

상태: **단일 author→consumer 관찰로 pilot Direct 채택**

### 실제 문제와 evidence

Product brief를 다음 실행 단위로 바꾸는 Direct에서 renderer나 core를 먼저 도입하면, 한 카드의 의미를 판단하는 AI 부담을 줄였다는 실패 증거 없이 config·answer contract·managed state와 복구 경로가 생긴다. 반대로 prose-only 후보는 domain manifest, closed target descriptor, 한 entry만으로 기존 `pilot/brief.md`를 읽어 이전에 없던 `pilot/plan.md`의 한 `bookmark-storage` card를 exclusive create할 수 있다. Fresh Codex author 1회(`task_b6f9bb19104a`, `ctx_e1d0e11a5ef8`)가 후보를 만들었고, review에서 표시 이름을 exact capability id로 사용한 한 결함을 consumer 설치 전에 canonical entry에서 `bookmark-storage`로 좁혔다. Standalone tree `7182f869abb896dfc6ed160f7cd5c94687289cf793bd4542a8f030f74f0b2606`은 source-current이고 artifact-intact였다.

처음 준비한 예측 가능한 temp 경로는 semantic task 시작 전에 다른 작업자 경로와 충돌했다. 사용자의 ownership 교정에 따라 그 경로와 안의 `.claude` subtree를 더 읽거나 수정·삭제하지 않았고, `mkdtemp`가 원자적으로 만든 새 루트가 비어 있고 현재 사용자 소유임을 확인한 뒤 reviewed tree와 SHA-256 `c034188c8fb0de1a74d388ab7279dfb30325e782514df65e7eaa3212c1919e80`인 555-byte fixed fixture만 배치했다. 이 setup failure는 semantic retry가 아니며 별도 검증 체계로 키우지 않는다.

Claude Code 2.1.270/Fable high unfamiliar consumer 1회는 documented print mode와 `bypassPermissions`에서 installed Direct skill을 발견했다. Output 부재를 먼저 확인하고 brief를 읽은 뒤 noclobber exclusive create를 사용했다. Coordinator reread에서 395-byte plan SHA-256 `46ae192293d9c07a790e0052d66c6c5d825d2c2a87375514495c6f983005da29`, 정확히 한 `bookmark-storage` card, 원래 행동·문구·HTTPS-only boundary, 세 unknown, 추가 scope 부재를 확인했다.

### 영향받는 결정·계약·milestone과 가장 단순한 선택

이 관찰은 D-12의 계산/판단 경계와 M5의 target별 adoption 원칙에서 Direct 하나만 다룬다. Product 성공을 복사한 것이 아니며 Work·Verify·Resume의 mode를 결정하지 않는다. 실제 부담을 없애는 owner는 Direct entry 하나이고, observer·packet·prepare·fallback·renderer·durable semantic state를 추가하지 않았다. No-target은 Direct 전달을 제공하지 못하고 renderer/core 후보는 관찰된 prose 실패 없이 학습·운영·복구 비용을 늘리므로 기각했다.

### 검증과 재검토 조건

상세 receipt는 `evals/m5/results/direct-adoption-gate-2026-09-14.json`, 관련 host events는 `evals/m5/results/raw/claude-direct-adoption-captured.json`이 소유한다. Consumer는 tool call 3, entry+input read 2,504 bytes, wall 26,733ms, API 14,438ms, USD 0.3978415였고 subagent와 permission denial은 없었다. 이 한 관찰은 현재 pilot Direct prose-only 후보를 채택하고 다음 stage-specific gate로 진행할 근거일 뿐, 반복성·pre-existing output 장면·다른 model/version과 Work·Verify·Resume는 `unproven`이다. 이후 실제로 card identity, unknown, no-overwrite 또는 stale replacement 요구를 prose가 지키지 못한 장면이 생길 때만 그 실패를 바꾸는 최소 renderer/core 후보를 다시 연다. Direct gate 자체는 반복하지 않는다.

## E-025 — 장기 M5에서 평가 장치의 누적 증식을 제때 차단하지 못함

상태: **집행 결손 확인 — 재진입 경계와 결정별 누적 차단선 채택**

### 실제 문제와 evidence

Universal Framework에는 이미 §0.1의 선택적 읽기, §4.1의 결과별 행동과 가장 싼 충분 관찰, §4.4의 검증 폐쇄 계약, §9.2의 새 장치 입장권, §9.3의 증식 신호, §11 #22의 주장·결정 없는 테스트 금지가 있었다. 따라서 과잉 방지 원칙이 전혀 없었던 것은 아니다. 실제로 E-020의 같은 Claude Fable high 반증 세션은 Framework와 D-11을 다시 대조한 뒤에도 v2 receipt schema, precondition, blinded rubric과 seed-2 규칙을 각각의 국소 오류를 고치는 장치로 승인했다. 그 뒤 fixture self-test 오류를 고치며 revision 3까지 갔고, 한 결정을 위해 protocol revision, 여러 schema, 34KB가 넘는 harness와 18-cell matrix가 누적된 뒤에야 사용자 교정으로 중단됐다.

이 evidence는 장기 컨텍스트 증가가 단독 원인이었다는 인과까지 증명하지 않는다. 그러나 이는 실행자의 일탈만이 아니라 동결 M5 검증 설계와 후속 E-020 교정 모두가 같은 결정을 위한 평가 장치의 누적 비용을 제때 멈추지 못한 기획 실패다. 두 집행 결손도 확인한다. 첫째, 당시 `AGENTS.md`의 maintainer entry는 최초 진입만 규정하고 handoff·resume·context compaction 뒤 현재 milestone과 문서 소유권을 다시 읽는 경계를 두지 않았다. 둘째, Framework의 입장권은 장치를 하나씩 정당화할 수 있었지만, 아직 제품 결정을 바꾸지 못한 같은 평가 gate에서 장치가 거듭 개정·분화되는 누적 비용을 조기에 중단시키는 저장소 차원의 기준이 없었다. E-021은 사후 감축과 격리를 정확히 기록했지만 다음 장기 실행을 선제적으로 멈추는 집행 규칙은 아니었다.

### 영향받는 결정·계약·milestone

- M5의 남은 Work·Verify·Resume adoption과 이후 M6~M8에서 평가용 protocol/schema/harness/matrix/agent path를 여는 방식
- handoff, resume와 context compaction 뒤 `docs/maintenance-status_ko.md`의 exact next 및 문서별 소유권을 복구하는 방식
- D-11의 Framework 사용 방식과 D-12의 가장 작은 충분 구조 원칙. Framework의 의미 원문이나 동결 D-11 자체는 바꾸지 않는다.
- 동결된 두 계획, 제품 runtime/schema, 기본 test discovery와 public README는 이번 교정의 변경 대상이 아니다.

### 보존 목적과 검토한 대안

보존 목적은 장기 작업에서도 사용자의 현재 목적, 비용 경계, 한 번에 하나인 결정과 `unproven` 경계를 다시 확보하면서, 국소 구현마다 전체 문서와 회고 양식을 반복하는 새 의식을 만들지 않는 것이다.

1. Universal Framework에 더 많은 과잉 방지 절·양식·점수표를 추가하는 안은 현재 원칙이 이미 충분하고 새 원문과 읽기 비용만 늘리므로 기각했다.
2. 15분 또는 고정 token 간격으로 전체 문서를 다시 읽는 안은 결정 경계와 무관하고 긴 국소 작업일수록 비용을 늘리므로 기본 규칙으로 삼지 않는다.
3. 매 milestone 전환마다 Framework 여러 절을 강제 재독하고 다섯 줄을 다시 쓰는 안은 정상적인 국소 작업에도 발동해 §4.1이 금지하는 의식이 될 수 있어 기각했다.
4. 최초 진입 때 읽은 대화 맥락만 신뢰하는 안은 handoff와 compaction 뒤 current owner·next action이 오래된 기억으로 대체될 수 있어 기각했다.

### 가장 단순한 선택

`AGENTS.md`가 두 집행 규칙을 소유한다. Handoff, resume 또는 context compaction/reconstruction 뒤에는 파일 원문에서 `AGENTS.md`와 Maintainer entry 1~3을 다시 실행한다. Coordinator는 갱신된 현재 milestone, 걸린 결정 하나, evidence 경계와 exact next만 계속 작업하는 worker에게 전달한다. 전체 Framework를 다시 싣거나 별도 재동기화 문서·schema·receipt를 만들지 않는다.

또한 어떤 평가 gate가 제품 결정을 한 번도 바꾸기 전에, 같은 결정을 위한 evaluator-only protocol, schema, harness, matrix, agent path 또는 검증 workflow가 두 번째 revision이나 추가 경로를 요구하면 이름이 달라도 하나의 누적 증식 신호로 본다. 그 확장을 중단하고 이 문서에 실제 drift를 기록한 뒤 사용자에게 비용·범위 결정을 되돌린다. 추가 검증을 만들어 `unproven`을 억지로 제거하는 대신 필요한 경우 그대로 남긴다. 이 차단선은 기존 owner 안의 통상적인 제품 코드 수정과 그 owner-targeted test에는 적용하지 않는다.

### 독립 반증과 검증 결과

기존 Claude Fable 5.1 high 세션을 새 Orca task로 재사용해 읽기 전용 반증을 수행했다. 검토자는 단순 재독만으로는 E-020 때처럼 각 수정이 다시 개별 정당화될 수 있고, 고정 시간 재독은 국소 작업에 ritual cost를 만든다고 지적했다. 대신 같은 결정을 위한 평가 장치의 두 번째 누적 revision을 차단하고 handoff·compaction 뒤 maintainer entry를 다시 여는 최소 교정에 동의했다. 반증 당시 세션 context는 약 28%여서 기존 이해를 재사용하는 사용자 조건 안이었다.

이 변경은 문서 집행 계약이며 아직 이후 장기 gate에서 drift를 실제로 막았다는 행동 증거는 `unproven`이다. 다음 두 adoption/release gate에서 차단선이 사소한 fixture 교정에만 발동해 실제 증식을 막지 못하면 false-positive 비용으로 보고 제거하거나 좁힌다. 반대로 장치 이름만 바꾸어 같은 결정의 평가 경로가 다시 늘어나면 filename이 아니라 결정 단위로 세는 현재 문구가 실제로 작동했는지 확인하고, 실패했다면 그 관찰을 근거로만 더 강한 admission 경계를 검토한다.

## E-026 — Work prose-only 최소 후보와 실사용 model allocation 교정

상태: **Codex Sol medium 주 관찰과 Claude Opus medium 비교 관찰로 pilot Work 채택**

### 실제 문제와 evidence

Work는 기존 brief·plan·package·test를 읽어 실제 source를 no-clobber로 만들고 정상 test 뒤 progress를 기록해야 한다. No-target은 이 부담을 해결하지 못하고 renderer/core는 source 의미와 host effect까지 소유하지 못하면서 상태·복구 비용을 늘린다. 따라서 한 entry가 process-local `Map` 구현, exact command, source/progress의 no-clobber와 production storage 세 unknown만 닫는 prose 후보를 만들었다. Fresh author는 후보와 fixture를 만들었지만 shell 결합 금지를 반복 위반했다. 이후 사용자 교정에 따라 routine consumer에 Fable high를 쓴 최초 성공 관찰은 모델 배치가 잘못된 예비 evidence로만 보존하고, 같은 reviewed tree·input의 Codex Sol medium 주 관찰과 Claude Opus medium 비교 관찰을 한 번씩 수행했다.

두 실사용 host 모두 installed entry를 발견하고 네 입력을 읽어 dependency-free in-process `Map` source를 만들었으며, `npm test -- bookmark-storage` 1/1 pass 뒤 source를 재읽고 progress를 생성·재읽었다. Coordinator 재읽기에서 입력 hash는 유지되고 source와 progress만 생겼으며 exact card, command, non-production boundary와 세 unknown이 보존됐다. Codex는 잘못된 RTK 경로 1회와 PowerShell quoting 실패 2회 뒤 정상 흐름을 완료했고 add-only file change 전 부재를 확인했다. Claude는 `wx` exclusive create를 사용했다.

### 영향·보존 목적과 선택

D-12와 M5의 Work별 adoption에만 적용하며 Verify·Resume로 승리를 복사하지 않는다. 보존 목적은 production DB를 흉내 내지 않고 실제 project root에서 읽기→구현→test→reread→progress의 사용자 부담을 가장 작은 owner로 줄이는 것이다. Storage 위치·보존 기간·import는 계속 unknown이고 source effect는 일반 host 권한이다. 새 schema, state, renderer, protocol, harness는 추가하지 않았다.

### 검증과 재검토 조건

상세 receipt는 `evals/m5/results/work-adoption-gate-2026-09-14.json`, 세 host raw 관찰은 `evals/m5/results/raw/*work-adoption-captured.json`이 소유한다. Current Work tree `3d9022408aa74d95a642a2be032964ab765fe76ad347a22b26a3cb50179824de`는 두 설치에서 artifact-intact/source-current였다. 동시 writer를 주입하지 않았으므로 Codex file change의 OS 수준 원자성과 pre-existing progress/source 장면은 `unproven`이다. 실제 no-clobber 손실이나 반복 recovery 실패가 관찰될 때만 기존 entry owner를 먼저 좁히고, 새 기계는 E-025 경계를 통과할 때만 검토한다.

## E-027 — Verify에서 같은 이름의 user 설치가 project-local current tree를 가림

상태: **최초 provenance 실패 보존, 사용자 승인 1회로 current Verify 채택**

### 실제 문제와 evidence

Accepted Codex Work 산출물을 byte-identical하게 둔 두 fresh root에 current Verify tree `25798e8a916d8b0062427c3d38f100198e94cb2bda8e90f79d5bd1bfde21763a`를 각각 project-local 설치했다. 그러나 Codex와 Claude Code 모두 같은 identity의 기존 user-level path를 선택했다. 선택된 tree는 artifact-intact지만 source-current=false인 `cf9ad62da45c925f12c63142dcf45d7603a1c591b020379c3739af6909c829cf`였다. 두 host는 initialize→declared reads→exact test→closed answer→record를 완료하고 `APPLIED`와 reread-observed effect를 냈지만, 이는 current tree의 전달·행동 증거가 아니다.

두 tree의 executable entry, runtime behavior, domain config, answer contract와 renderer는 byte-identical하다. Current tree 차이는 generated target의 `headingIndex:null`, expanded package source receipt와 `record.mjs`의 D-14 test-pointer comments다. 따라서 행동 위험은 좁지만 exact current delivery가 관찰됐다고 추론해 승격하지 않는다.

### 영향·대안과 가장 단순한 선택

영향은 M5 Verify adoption과 이후 Resume 진입이다. User install을 덮어쓰거나 옮기는 안은 외부 설치 상태를 변경한다. 새 identity나 discovery wrapper는 제품 identity·검증 경로를 늘린다. 같은 gate를 다른 경로로 즉시 반복하는 안은 E-025의 decision-level proliferation 차단선에 걸린다. 따라서 현재 두 결과와 실제 output bytes를 보존하고 Verify를 `unproven`으로 닫은 뒤, 딱 한 추가 current-tree 실행을 허용할지와 어떤 정상 host discovery 조건을 쓸지 사용자에게 되돌린다. Resume는 열지 않는다.

### 사용자 승인 후 검증과 재검토 조건

상세 receipt는 `evals/m5/results/verify-adoption-gate-2026-09-14.json`, host raw 관찰은 `evals/m5/results/raw/*verify-adoption-captured.json`이 소유한다. 최초 Codex output SHA-256은 `8d448fb0885aad0adbb1d736c8263ff70e406e6f8604793b120377f0e609abd6`, Claude output은 `74219e60151dfe7d31247b722a057b50a27a42c61bbfcb210641711f44668bae`이며 coordinator가 재읽었다.

사용자는 별도 alpha `natural-language-pilot-verify-next`만 표준 installer로 갱신하고 fresh Codex Sol medium을 정확히 한 번 실행하는 비용을 승인했다. Installer는 Codex·Claude Code 정상 user 위치에 current tree `25798e8a916d8b0062427c3d38f100198e94cb2bda8e90f79d5bd1bfde21763a`를 설치했고 두 경로가 artifact-intact/source-current였다. 기존 `skill-rails`의 63-file path/hash 목록은 설치 전후 동일했고 `CODEX_HOME`을 바꾸지 않았다. Fresh Codex는 current tree를 선택해 accepted Work root에서 initialize→declared read→exact test 1/1 pass→closed answer→record를 수행했다. `APPLIED` output SHA-256 `7c6e3ce666036a04f2c3042dab44b979e630af4e46f30f1813d8d6f1c9d5d844`와 unknown 보존, 입력 hash 불변을 coordinator가 재읽었다.

이 한 관찰 범위에서 current Verify를 채택한다. Run 안의 shell 결합과 PowerShell parse 실패 두 건은 process failure로 보존하며 제품 record effect를 대신 성공으로 바꾸지 않는다. Claude current-tree 행동, 다른 fixture/model/version, recovery scene과 반복성은 `unproven`이다. Verify는 더 반복하지 않고 다음 별도 stage인 Resume로 간다.

## E-028 — Resume prose-only 채택과 M5의 증거 한계 수렴

상태: **두 medium host의 read-only 관찰로 pilot Resume 채택, M5 구현 종료와 미확인 범위 분리**

### 실제 문제와 evidence

Resume가 해결할 실제 부담은 대화 상태를 저장하는 일이 아니라 현재 brief·plan·progress·verification에서 위치와 다음 한 단계를 다시 찾는 일이다. 별도 state, parser, renderer 또는 recovery protocol을 두면 artifact와 함께 맞춰야 할 두 번째 truth가 생긴다. 따라서 `natural-language-pilot-resume-next`는 네 artifact만 읽고 `Current position`, 근거, Product/Direct/Work/Verify/maintain 중 한 next action, 남은 unknown을 응답하는 prose-only target으로 만들었다. 같은 accepted chain에서 fresh Codex Sol medium과 Claude Opus medium이 installed skill을 발견해 네 파일만 읽었고, verified non-production 위치와 `maintain`, storage location·retention period·import support의 unknown을 보고했다. 실행 전후 전체 project path/hash 목록은 같았다.

### 영향받는 결정·계약·milestone과 가장 단순한 선택

이 관찰은 D-04의 artifact-derived state와 M5 §9의 Resume gate에만 적용한다. Product·Direct·Work·Verify의 채택을 근거로 mode를 복사하지 않았고, no-target은 복구 읽기 부담을 남기며 durable state/core 후보는 동기화·학습·복구 비용을 추가하므로 기각했다. Resume target은 manifest, closed descriptor, entry의 세 source만 가지며 project write나 새 schema·protocol·harness를 만들지 않는다.

Product가 생긴 뒤의 differential currentness는 실제 Product와 Verify를 build한 다음 Verify canonical entry만 바꾸는 owner-targeted 검사로 닫았다. Product는 source-current를 유지하고 Verify만 stale이 됐다. 현재 pilot에는 둘 이상 target이 실제 import하는 common purpose module이 없으므로 그 branch를 증명하려고 module/import를 발명하지 않았고, common-module consumer 전파는 `unproven`으로 남긴다.

### 검증, M5 종료 판정과 재검토 조건

Resume 상세 receipt는 `evals/m5/results/resume-adoption-gate-2026-09-14.json`, raw host 관찰은 `evals/m5/results/raw/codex-sol-resume-adoption-captured.json`과 `evals/m5/results/raw/claude-opus-resume-adoption-captured.json`이 소유한다. Resume standalone tree `5c9ec7a14982b97559b8613be2c7058fc2db8d14dedbef6d0f72b54d7be5ae9f`는 두 정상 설치 위치에서 artifact-intact/source-current였다. Codex의 shell 결합과 PowerShell parse failure 한 건은 실패 evidence로 보존한다. Missing·failed·unproven·conflicting·stale artifact 장면, 반복성, 다른 fixture/model/version과 비용 절감은 `unproven`이다.

M5 종료 build는 실제 다섯 target을 모두 standalone으로 생성해 integrity/currentness를 확인했고 generated authoring target도 tree `7e0c986256f01853fdf9a11848970aa305b920941b322342ef4182a5109fc531`로 source-current였다. Coherent milestone 종료의 default `npm test`는 한 번 실행해 29/29 pass였다. 이는 delivery와 deterministic safety만 증명한다.

사용자 교정으로 중단한 Framework matrix는 재개하지 않았으므로 L0/L1/L2 상대 효과와 D-11 default는 계속 `unproven/pre-gate`다. Fresh maintainer도 E-023의 부분 실패를 반복하지 않았으므로 full maintain traversal과 pointer 비용 절감은 failed/unproven이다. 따라서 M5는 제품 target 구현과 제한된 adoption chain을 종료하지만 동결 계획의 모든 행동·비용 주장을 proven으로 승격하지 않는다. 이후 실제 missing/stale Resume 실패나 shared module consumer가 생기면 기존 entry/import/currentness owner의 targeted evidence로만 다시 열고, 새 평가 장치는 E-025 차단선을 따른다. M6는 이 경계를 인수하되 자동 시작하지 않는다.

## E-029 — M6 첫 whole-module pressure에서 파일 전달과 model-context 읽기가 갈림

상태: **한 Resume pressure target 관찰 완료, architecture 채택과 다음 target은 보류**

### 실제 문제와 evidence

동결 M6의 67KB/148KB 장면을 synthetic padding으로 흉내 내지 않기 위해 Devflow Git object `fa05d8269cf8dda8035f2a48aaa95b6aef7641be`에서 historical Resume entry와 당시 지시된 common principles·세 predicate 원문을 가져왔다. 다섯 source는 Git object와 byte-identical하고 공통 규약은 67,205B, 전체는 153,302B다. 이 source를 현재 Devflow의 설계나 답으로 쓰지 않도록 `evals/m6/devflow-resume-pressure/`의 measurement-only package가 한 prose target에 whole-module로 materialize한다. Active entry는 local reference 다섯 개만 읽고 내부 명령은 실행하지 않게 하며 sibling repository runtime 접근은 없다.

Generated entry를 포함한 fixed read는 154,345B였다. Initial build 114.674ms, unchanged currentness check 105.8857ms, 동일 rebuild 125.9657ms였고 두 build tree는 `42e9b038127475b675179419ae021eba836c8bd4abbaccc9c4344d932396363e`로 같았다. Project-local Codex·Claude 설치는 실행 전후 artifact-intact/source-current였다.

Fresh Claude Opus medium은 다섯 파일의 text를 tool cutoff 없이 받았고 153,302B를 보고했으며 project write는 없었다. 그러나 host usage 100 input, 68,458 cache-create, 173,877 cache-read token에는 system·discovery·반복 cached context가 섞여 source-only token cost로 귀속할 수 없다. Fresh Codex Sol medium은 `ReadAllBytes`로 모든 filesystem bytes를 세고 text를 출력하지 않아 model context에 원문이 들어가지 않았다. 이어진 Windows PowerShell hash API 호출도 지원되지 않아 오류를 냈다. 따라서 filesystem delivery는 관찰됐지만 Codex semantic read와 두 host의 정확한 source-only context cost는 `unproven/failed`다.

### 영향·보존 목적·대안과 선택

영향은 D-03 whole-module materialization과 M6 첫 단계의 context/rebuild 경제성뿐이다. Historical Devflow를 live import, runtime, fallback, compatibility 또는 answer key로 편입하지 않는다. Production `domains/devflow`를 바로 만드는 안은 한 pressure 관찰을 제품 채택으로 올리므로 기각했고, synthetic 148KB fixture나 clause projection은 각각 evidence 위조와 의미 분할 비용을 만들어 기각했다. 평가 schema·harness·matrix도 추가하지 않았다.

가장 단순한 선택은 byte-identical source package 하나, target 하나, 기존 build/check와 fresh medium host 한 쌍뿐이다. Codex 실패를 고치려고 entry revision, reader wrapper, retry 또는 다른 agent path를 만들지 않는다. 이는 whole-module 전달과 context 경제성이 같은 claim이 아님을 드러낸 결과이며, 현재 결과만으로 projection이나 inverse impact를 열지 않는다.

### 검증과 재검토 조건

상세 receipt는 `evals/m6/results/resume-whole-module-pressure-2026-09-14.json`이 소유한다. Proven은 byte-identical materialization, deterministic build/currentness, Claude full-text delivery와 no-write, 이 머신의 좁은 build 비용이다. Failed는 Codex model-context read와 PowerShell hash 시도다. 이 첫 단위에서는 context/품질 우위, changed-source cohort cost, 두 번째 target, manual tracing failure, inverse impact, 9-target·production integration이 `unproven`이었다. Changed-common cohort는 이후 E-030의 세-target 관찰에서 별도로 닫힌다.

다음에는 이 혼합 결과가 있어도 evaluator를 고치는 대신 동결 순서의 가장 다른 두 실제 target이 common/specific 경계를 시험할 최소 source가 되는지 먼저 판단한다. 사용자가 그 다음 단위를 열기 전에는 target을 추가하지 않는다. 실제 source→consumer 수동 역산 실패 전에는 inverse impact를 만들지 않는다.

## E-030 — 세 실제 target의 delivery 경계와 historical granularity의 minimal-read 한계를 분리

상태: **M6 adoption gate 불통과로 종료 — source graph·changed-common 전파 통과, minimal-read 미충족, prose 대비 총비용 unproven**

### 문제와 evidence

Resume 한 target만으로는 67KB common source와 target 전용 source의 consumer 경계를 시험할 수 없었다. 가장 다른 historical Product와 Work를 골라 같은 Git object `fa05d8269cf8dda8035f2a48aaa95b6aef7641be`의 Product entry 10,058B, Work entry 29,634B, planning evidence 7,909B를 byte-identical하게 기존 measurement package에 추가했다. Product는 common+planning, Work는 common+state, Resume는 common+state+verification+baseline을 읽으므로 dummy import 없이 전체 공통, 두 target 공통, target 전용 관계가 생겼다.

기존 `inspect`는 common의 세 consumer, state의 Resume/Work consumer, planning의 Product consumer를 정확히 반환했다. 세 standalone target은 146.6147ms에 build됐고 unchanged rebuild는 161.4289ms였으며 tree hash가 모두 같고 artifact-intact/source-current였다. 따라서 source→consumer tracing 실패는 없었다. 반면 fixed initial read는 Product 86,154B, Work 99,916B, Resume 154,345B였다. Fresh Codex Sol medium과 Claude Opus medium은 Product와 Work의 자연어 의미 작업을 각각 한 번 완료했지만, Codex input은 Product 473,029, Work 1,175,256 tokens였고 Work에서는 combined read truncation과 세 번의 read-command 실패 뒤 같은 run 안에서 chunk read가 필요했다. Claude도 Product cache-create/read 233,489, Work 453,384 tokens를 사용했다. 이 host 수치는 system·discovery·cache·tool 대화를 포함하므로 source-only 비용은 아니다.

### 영향받는 결정·보존 목적과 선택

영향은 D-03 whole-module materialization과 M6 순서 2의 common/specific 압력 판단이다. 한 canonical graph가 source ownership과 deterministic delivery를 유지한다는 목적은 보존한다. 다만 historical prose와 materialized source는 byte-identical하므로 높은 read 비용을 materialization 메커니즘 자체의 실패로 귀속하지 않는다. 이 실제 historical source granularity에서는 minimal-read 조건을 충족하지 못했고 prose 대비 총비용은 host 수치 오염 때문에 `unproven`이다. Historical Devflow는 계속 pressure evidence일 뿐 architecture baseline, fallback, runtime, live import 또는 answer key가 아니다.

대안인 reader wrapper, projection, 새 harness/schema, agent retry는 현재 결정을 위해 새 층과 비용을 만들므로 추가하지 않았다. Product와 Work의 네 host run은 기존 fixture·installer·build/check만 사용했고 coordinator reread에서 input 불변과 Product brief, Work source/progress effect를 확인했다. Work의 duplicate-id replacement와 rejection 차이는 fixed acceptance가 정하지 않았으므로 결함으로 추정하지 않고 `unproven`으로 둔다.

실제 retained Fable 5.1 high audit `run_4816c4afff3e / task_7fb63040ace3 / dispatch ctx_d0c35bc1240c`의 read-only 결론과 Codex 판단을 조율했다. 합의는 (1) byte-identical source delivery를 실패로 부르지 않고, (2) minimal-read 미충족과 prose 대비 총비용 미확인을 분리하며, (3) 네 번째 target은 67KB common fixed read를 줄이지 못하므로 현재 결정을 바꿀 evidence가 아니고, (4) tracing failure가 없는 inverse impact는 시기상조라는 것이다. 더 작은 source/package 경계는 historical evidence를 의미적으로 쪼개 만들어낼 것이 아니라, 이후 greenfield author가 실제로 불필요한 whole module을 반복해서 읽는 장면에서만 다시 여는 authoring 결정이다. 이 조율은 제품 경계나 허용 비용을 바꾸지 않았고 새 machinery를 요구하지 않았다.

### 검증과 재검토 조건

상세 receipt는 `evals/m6/results/three-target-common-specific-pressure-2026-09-14.json`이 소유한다. Canonical source를 건드리지 않은 임시 복사본에서 common module에 newline 한 byte를 추가하자 기존 Product·Resume·Work 세 tree는 모두 artifact-intact를 유지하면서 source-stale이 됐다. 기존 build로 한 번 재생성하는 데 214.8074ms가 걸렸고 세 target 모두 다시 artifact-intact/source-current가 됐다. 이는 changed-common cohort와 이 머신의 rebuild 비용만 증명하며 semantic 품질이나 production redeploy 비용을 증명하지 않는다.

Proven은 세 단계 common/specific consumer 관계, deterministic standalone delivery/currentness, changed-common의 세 consumer 모두에 대한 stale 전파와 복구, 두 medium host의 Product·Work 단일 의미 effect다. Failed는 이 historical granularity가 frozen minimal-read 조건을 만족한다는 주장과 Codex Work의 값싼 안정 read다. 한두 target만 소비하는 module의 selective-stale 동작, source-only token 귀속, unchanged prose 대비 총비용 우위, greenfield의 더 작은 source boundary, 반복성, 네 번째 target과 9-target integration은 `unproven`이다.

실제 source→consumer tracing 실패가 없으므로 inverse impact는 열지 않는다. 네 번째 target은 이미 관찰된 common fixed read를 줄이거나 prose 대비 비용을 밝히지 못하므로 M6 순서 3을 시작하지 않는다. 현재 M7 미진입은 사용자의 sequencing 결정이다. 동결 M7의 의존은 core가 Devflow 용어를 갖지 않는지 확인하는 것이므로 M6 adoption gate 불통과가 M7의 자동 의존 실패를 뜻하지 않는다. 이후 greenfield author가 불필요한 whole module을 반복해서 읽는 장면이 생기면 한 owner·standalone target을 보존하는 더 작은 source boundary를 다시 검토하고, 실제 수동 tracing 실패가 생기면 그 실패를 보존한 채 inverse impact 설계 전에 멈춘다.

## E-031 — M7 진입 검사에서 prepare packet의 `cardId` domain 결합 발견

상태: **최소 core extraction 뒤 M7 machine generalization 통과 — fresh behavior·품질은 unproven**

### 실제 문제와 evidence

동결 M7의 첫 의존은 core가 `card`, `stage`, `brief`, `verification` 의미를 갖지 않는지 확인하는 것이다. `src/core`, `src/runtime`, `contracts`를 대소문자 구분 없이 검사하자 `stage`는 build·exchange·record의 임시 filesystem staging 변수에만 있어 Devflow stage 의미가 아니었고 `brief`와 `verification`은 없었다. 그러나 core-owned `src/runtime/prepare.mjs:22`의 generated packet은 domain answer contract와 무관하게 semantic fields를 `schemaVersion`, `cardId`, `verdict`, `summary`, `checks`, `unknowns`로 고정해 안내한다.

이 결합은 단순한 이름 흔적이 아니다. `contracts/target.schema.json:21-32`에서 observer는 `prepare-record` mode에만 존재하고 `src/core/build.mjs:89-100`도 그 mode에서만 observer와 prepare runtime을 materialize한다. 따라서 observer를 요구하는 새로운 비-Devflow domain은 자신의 answer contract가 달라도 core packet에서 `cardId`와 Verify shape를 읽게 된다. 이를 수용하면 새 domain이 Devflow/Verify 의미를 가장하는 것이고, 제거하려면 core를 수정해야 하므로 M7 dependency는 domain fixture를 만들기 전에 실패했다.

### 영향·보존 목적과 가장 작은 선택지

영향은 M7의 “core 수정 없이 domain package만 추가” 일반화 주장이다. M6의 delivery/currentness와 cost 판정, M5의 historical prepare-record evidence는 바꾸지 않는다. Dependency 실패를 가짜 `cardId` domain으로 우회하지 않고, 사용자의 계속 진행 및 명확한 결함 개선 지시에 따라 먼저 최소 core extraction을 선택했다.

검토한 선택지는 두 개다. **Extract**는 `prepare.mjs`의 Verify-shaped field 열거를 제거하고 이미 domain이 소유하는 `answerContract`만 따르도록 packet 문장을 mode-neutral하게 좁히는 것이다. **Reject**는 prepare-record observer를 generalized core로 보지 않고 M7 일반화 주장을 기각하거나 record-only 범위로 축소하는 것이다. 후자는 observer 재사용을 요구하는 frozen M7과 달라 제품 주장 범위를 바꾸며, 비-Devflow 대상에 가짜 `cardId`를 넣는 안은 결합을 숨긴다. 선택한 Extract는 기존 answer contract owner를 재사용하는 한 문장 변경이라 새 schema·state·protocol을 만들지 않는다.

### 검증과 재개 조건

`src/runtime/prepare.mjs`는 field 목록 대신 “answer contract를 정확히 따르고 field를 추가하지 말라”는 mode-neutral 문장만 출력한다. Existing historical prepare-record targeted test는 6/6 통과했다. 이후 Devflow와 무관한 museum-label editorial review package 하나를 `evals/m7/editorial-review/`에 만들었고 기존 schema와 build/runtime만 사용했다. Exact inspect는 source graph SHA-256 `748398ba4f123e9e9a314ccef76f831df4b50bee323f0480165af149f234dedf`, observer, renderer, domain contract와 선언 I/O를 반환했다. Standalone tree `7e055de100a80aa20b968ce6979493f431cbfca7a830fd3e4ebae8a3a748ebea`는 artifact-intact/source-current였다.

Coordinator-run Node 관찰은 domain observer의 네 fact와 `PREPARED`를 반환했고 packet에 `cardId`가 없으며 answer skeleton은 `documentId/issues/schemaVersion/summary/unknowns/verdict`였다. Invalid skeleton record는 `ANSWER_INVALID`와 no-write를 냈고, valid answer는 `APPLIED`와 reread hash `3f4f0ec1...`, human prefix 보존을 보였으며 동일 exchange 재호출은 `APPLIED_ALREADY`였다. 상세는 `evals/m7/results/editorial-review-generalization-2026-09-14.json`이 소유한다.

따라서 한 비-Devflow domain에서 source graph, observer, renderer와 generic error vocabulary를 core 추가 수정 없이 machine level로 재사용했다는 범위만 proven이다. Initial dependency failure는 failed evidence로 남는다. Fresh AI의 discovery·semantic answer·editorial quality, 다른 domain/host/scene과 prepare/fallback의 production adoption은 `unproven`이다. M4/M5 renderer-only 제품 판정을 뒤집지 않는다. M8은 fresh audit와 사용자 승인에 계속 의존하며 identity/latest/publish/global 교체/archive 삭제는 각각 별도 경계다.

## E-032 — M8 전 완결성 감사에서 on-demand 사람용 view와 portable authoring gap 분리

상태: **D-13 최소 projection 채택 — M8 release-test 진입 가능, production cutover는 미준비**

### 실제 문제와 evidence

M5의 fresh maintainer는 exact graph 관계 일부를 찾았지만 전체 일곱 질문을 bounded하게 끝내지 못했고, 이후 사용자는 여러 target과 milestone의 전체 관계를 반복해서 물었다. 이는 D-13이 요구한 사람용 전체 구조·관계 설명의 실제 수요다. 반면 현재 generated authoring skill은 Framework 원문과 source/build 지침을 전달하지만 `src/core/cli.mjs`와 build core를 포함하지 않는다. 따라서 skill만 임의 프로젝트에 설치한 상태에서 deterministic author→build를 끝낼 수 있다는 주장은 성립하지 않는다.

### 영향받는 결정과 보존 목적

영향은 D-11의 Framework 원문 단일 owner, D-12 exact current graph, D-13 human projection, D-14 국소 pointer와 M8의 release readiness다. 사람에게 현재 package·target·module·consumer·I/O·artifact·대표 flow를 한 번에 보여 주되 새 수동 문서나 AI routing 정본을 만들지 않는 목적을 보존한다. Portable authoring gap은 지침 문장으로 감추거나 기존 global install·sibling repository에 의존시키지 않는다.

### 검토한 대안과 가장 작은 선택

README에 구조도를 추가하거나 generated overview를 commit하는 안은 금지된 surface와 stale 정본을 만든다. 기존 heading index에 source graph 의미를 넣는 안은 AI navigation data와 사람 설명을 섞어 두 번째 index로 만든다. Target별 설명 문서를 늘리는 안도 반복 수요보다 유지 비용이 크다. 선택한 `overview --source <manifest>`는 현재 validated graph와 canonical build plan에서 한 Markdown projection만 계산해 stdout으로 내며 파일을 저장하지 않는다. Header는 `generated/non-authoritative`, generator version, `sourceGraphSha256`, 실제 표시 관계만의 `projectionInputSha256`, generation-time currentness와 source path check를 가진다. AI runtime과 generated target에는 포함하지 않는다.

Canonical `SKILL.source.md`에는 §8.1~§8.4의 authoring→build→fresh use→maintain/recovery 흐름을 작은 operational guidance로 보강했다. Prose를 기본으로 하고 deterministic one-output safety가 실제 부담을 줄일 때만 record-only를 쓰며 prepare/fallback을 새 제품 경로로 채택하지 않는 현재 경계를 명시했다. 동시에 installed authoring target이 build CLI를 싣지 않는다는 사실을 적어 portable authoring을 과장하지 않았다. CLI를 authoring skill에 내장하거나 별도 공식 tool로 배포하는 선택은 새 package/runtime·설치 계약이므로 이 bounded audit에서 결정하지 않는다.

### 검증과 재개 조건

`tests/inspect.test.mjs`의 targeted check는 exact inspect 두 계약과 deterministic overview 한 계약을 3/3 통과했다. Authoring graph overview는 source graph SHA-256 `8a8339780fe8ed851b4e396ba3ddbae02854b018b34a089a0e2e40f71d913cf4`, projection input SHA-256 `59b015cc7e3aa38530bd788cac9150105a03259eaeac5e1b5a3f2d3b11457c99`를 표시했고 path check는 passed였다. Entry 본문처럼 projection에 표시하지 않는 source가 바뀌자 source graph hash만 바뀌고 projection input hash는 유지되어 D-13의 선택적 currentness 목적과 맞았다.

Generator의 deterministic delivery는 proven이지만 실제 사람이 더 빨리 이해하는지, 새 authoring guidance가 fresh AI 저작 품질을 높이는지, standalone installed skill에서 build까지 완결하는지는 `unproven` 또는 현재 gap이다. M8 release test 전에 portable authoring delivery를 embedded CLI로 할지 별도 공식 tool로 할지 결정하고, 선택한 정상 설치 조건의 fresh author→build→standalone install→use→maintain/recovery 한 흐름으로만 검증한다. Overview가 읽히지 않거나 같은 관계를 더 어렵게 만들면 command와 generator를 제거한다.

## E-033 — portable authoring은 enum-of-one embedded canonical CLI로 닫음

상태: **bounded delivery 채택 — fresh installed end-to-end는 unproven**

### 실제 문제와 evidence

E-032에서 generated authoring skill이 지침만 전달하고 build core를 포함하지 않아 ordinary separate project가 sibling repository나 별도 tool 없이 author→build를 끝낼 수 없음을 확인했다. Read-only feasibility proof는 `src/core/cli.mjs`에서 build/check/inspect/overview와 build가 materialize하는 runtime/contracts까지의 static closure가 `package.json` 1개, `src/core` 10개, `src/runtime` 9개, `contracts` 7개임을 확인했다. 구현 전 27 files/98,878 bytes의 byte-identical copy는 network·global CLI·sibling repository 없이 별도 tiny source의 inspect/overview/double-build/check를 완료했다.

### 영향받는 결정·계약과 보존 목적

영향은 standalone authoring deployable, target v1 closed contract, canonical build/receipt/currentness와 M8 release-test 입장 조건이다. 한 번의 정상 skill 설치만으로 별도 project를 저작·생성하게 하되 임의 executable asset 문법, domain plugin, resolver, bundler, 새 runtime state나 두 번째 source owner를 만들지 않는 목적을 보존한다. AI가 tooling source를 읽을 필요는 없으므로 install payload와 AI fixed-read context도 구분한다.

### 검토한 대안과 가장 작은 선택

별도 versioned CLI는 두 번째 설치·version 정합 부담을 만들고 source checkout 요구는 standalone 약속을 깨며, targetId/packageId special case는 선언되지 않은 identity 분기를 만든다. Generic path/glob/destination asset map은 한 consumer 때문에 plugin grammar를 여는 과잉이다. 선택은 prose target에 optional `embeddedCoreTooling`을 두고 허용값을 `authoring-cli-v1` 하나로 닫는 것이다. `src/core/build.mjs`의 단일 static 목록만 27-file closure와 고정 `scripts/skill-rails-cli/` destination을 소유하며 authoring target 하나만 선언한다. Existing receipt의 source/artifact/tree hash와 currentness를 그대로 재사용하고 새 schema file/version이나 install mechanism을 만들지 않는다.

### 검증·비용과 재검토 조건

Owner/schema 변경 뒤 canonical closure는 27 files/100,392 bytes이고 sorted `{path,bytes,sha256}` row manifest SHA-256은 `b136454baa79874738521a96fc2824fac8a0a8a48fb074ac3bd8f3da8990a0c3`다. `tests/build.test.mjs` 13/13은 exact closure와 receipt hashes, unknown value와 non-prose rejection, generated skill-local CLI의 separate-project inspect/overview/double-build/check를 통과했다. Generated authoring tree `baea9a37b0b2c3c1983791a593bb418308414405ad83ffdeb8abe795e8dda88c`는 artifact-intact/source-current였고 coherent default `npm test`는 한 번 실행해 31/31 pass했다. 이는 delivery와 deterministic safety만 proven이며 fresh AI behavior/effect, 정상 installer, prose 대비 총비용은 M8 종단 gate 전까지 `unproven`이다. 두 번째 값·consumer·다른 closure·domain executable 수요가 생기거나 고정 payload가 실제 사용 비용을 악화시키면 구현을 확장하지 않고 사용자에게 제품 범위·비용 결정을 되돌린다.

## E-034 — M8 종단 출력물은 채택하고 authoring-process 비용은 별도 concern으로 분리

상태: **produced-skill pre-release acceptance 통과 — production cutover 작업은 별도 경계**

### 실제 문제와 evidence

정상 `npx skills@latest add <local-current-repository>` 경로는 미공개 current bytes를 project-local Codex·Claude 위치에 설치했고, installed authoring tree는 `baea9a37...`로 artifact-intact/source-current였다. Fresh Codex Sol medium은 그 entry와 skill-local CLI만 사용해 두 prose target과 하나의 실제 공통 module을 저작하고 double-build/check를 통과했다. 공통 owner를 한 번 바꾸자 두 consumer가 모두 artifact-intact/source-stale이 되었고 두 affected target만 재빌드·재설치하자 각각 `4aaeae42...`, `a7a4d72a...`로 current가 복구됐다. Fresh Claude Opus medium bypass 1회는 두 installed target을 발견해 두 output을 만들고 input과 output을 reread했으며 coordinator가 570B/921B effect를 다시 읽었다.

생성된 target 하나는 8 files/약 19KB이고, 그중 실제 domain prose는 announcement 2,667B, accessibility 2,919B다. Standalone integrity check를 위한 executable 12,206B는 설치 payload이지만 using AI의 read path에는 들어오지 않았다. Fresh Claude가 쓰기 전 실제로 읽은 것은 두 entry, 두 target에 materialize된 동일 shared module, 현재 input의 5 files/6,081B였고 완료 확인으로 input과 두 output 3 files/1,986B를 reread했다. Config, receipt, schema, executable과 Skill Rails 내부는 읽거나 호출할 필요가 없었다. 두 target을 함께 쓴 장면에서는 shared artifact 1,534B가 두 번 읽혔지만 이는 한 source owner의 독립 standalone copy이며, 이 작은 overhead를 없애려고 target 간 runtime dependency를 만들 근거는 없다.

작은 두-target 저작에 Codex가 input 468,994 tokens를 보고했고 unsupported CLI `--help` probe와 독립 shell 작업 결합도 있었다. Ephemeral raw JSON을 durable file로 남기지 않아 exact author tool-call 수와 wall time은 재실행 없이 복원할 수 없다. 그러나 이 과정 concern이 generated entry, read surface, shared ownership, standalone currentness 또는 unfamiliar consumer effect를 나쁘게 만든 인과는 관찰되지 않았다. 따라서 이를 숨기지 않되 output acceptance를 실패시키는 release criterion으로 사용하지 않고 secondary authoring DX evidence로 분리한다.

### 영향받는 결정·계약과 보존 목적

영향은 M8의 standalone author→build→install→use→maintain/recovery 수용, Framework navigation 비용, production cutover다. E-033의 enum-of-one이나 source graph/schema를 확장하지 않고, produced-skill quality와 authoring-process efficiency를 분리한다. 의미 판단은 짧은 domain prose와 AI에 남고 currentness·receipt·consumer 전파는 기계가 맡는 경계, 한 책임 한 owner, generated 직접 수정 금지와 기존 global/CODEX_HOME 불변을 보존한다.

### 선택·검증과 재검토 조건

상세 receipt는 `evals/m8/results/pre-release-end-to-end-2026-09-14.json`이 소유한다. 이번 한 관찰에서는 정상 installer, current embedded CLI, 두-target standalone build, common-owner stale 전파, affected-only rebuild, unfamiliar Claude의 실제 effect가 proven이다. Generated standalone copies는 하나의 canonical module hash와 각 receipt에 결합된 artifact이며 편집 owner가 아니다. Observer, renderer, packet, answer contract와 state 없이 fresh consumer가 Skill Rails 내부를 이해하지 않고 두 결과에 도달했으므로 비대·경직·실용성의 output-side 실패는 관찰되지 않았고 produced-skill pre-release acceptance는 통과한다.

Framework navigation의 순이익, exact author tool/wall telemetry, authoring-process token attribution, 반복성·다른 도메인과 public identity는 unproven이다. 이를 위해 author flow를 반복하거나 telemetry machinery를 추가하지 않는다. 남은 M8은 current candidate의 bounded final audit, coherent release commit과 exact remote candidate 확인, 공식 `nanomia-ai/skill-rails` installer 검증, identity/`latest`/global 교체/archive 각각의 승인뿐이다. 이 task에서는 publish·cutover로 진행하지 않는다.

## E-035 — Production identity는 repository delivery로 승계하고 protocol namespace는 보존

상태: **production repository cutover와 두 host 설치 완료 — broad behavior는 기존 범위 유지**

### 실제 문제와 evidence

M8 produced-skill acceptance 뒤 실제 registry와 installer 경로를 확인하자 `@nanomia/skill-rails`와 alpha package는 npm registry에 존재하지 않았고, 공개 repository `https://github.com/nanomia-ai/skill-rails.git`와 README의 `npx skills@latest add nanomia-ai/skill-rails`가 공식 전달 경로였다. Origin `main`은 remote ahead 0으로 non-force fast-forward가 가능했고 authenticated GitHub identity와 unprotected branch를 확인했다. Generated candidate는 production target/entry `skill-rails`, private metadata `@nanomia/skill-rails@1.0.0`으로 재생성되어 tree `cab9710...`의 artifact-intact/source-current를 통과했다.

### 영향받는 계약과 보존 목적

영향은 M8 identity/latest/release cutover, generated discovery와 package payload다. Repository/skill/package의 public identity만 승계하고 closed schema `$id`, marker, `.skill-rails-next` state path와 historical pilot/receipt의 `skill-rails-next` 문자열은 기존 protocol/evidence owner이므로 이름 정리 대상으로 취급하지 않는다. `private: true`를 유지해 존재하지 않는 npm publication route를 발명하지 않고, standalone generated skill과 기존 receipt/currentness 경계를 보존한다.

### 가장 단순한 선택과 검증·재검토 조건

Canonical owner인 root package metadata, authoring package version, authoring target descriptor와 entry 이름만 production으로 바꾸고 generated target을 rebuild했다. `npm pack --dry-run --json`은 39 entries, 63,826B packed/227,085B unpacked이며 legacy/evals/tests/repository source를 제외했고 release `npm run verify`는 31/31 pass했다. Post-consumer input hash는 기존 receipt와 같았고 Claude raw session은 `--no-session-persistence` 때문에 없으므로 retained CLI metadata와 coordinator-reread effect만 권한으로 남긴다.

Candidate commit `e321879dc3b1fbadf3677eb1eb06abb7d0f46551`은 기존 origin `main`에 force 없이 fast-forward됐고 remote head가 같음을 재확인했다. `skills@1.5.26`의 repository route는 production `skill-rails`와 generated tree `cab9710...`를 골라 Codex·Claude 전역 위치와 별도 일반 project의 두 project-local 위치에 설치했다. 전역 old tree는 승인된 범위에서 63 files/1,028,325B에서 36 files/201,705B production tree로 교체됐고 unrelated skill 이름은 설치 뒤에도 보존됐다. 별도 project의 fresh Codex Sol medium과 Claude Opus medium은 각각 project-local entry를 발견하고 skill-local CLI로 artifact-intact/tree hash를 확인했다. Codex가 문서에 없는 `--help`를 두 번 시도한 마찰과 installer의 상세가 노출되지 않은 Socket alert 1건은 숨기지 않되 이번 integrity smoke 결과를 broad behavior/effect로 확대하지 않는다. `CODEX_HOME`, README, 동결 계획과 legacy capsule은 바꾸지 않았다. 두 번째 tooling 값·consumer·closure나 domain executable 수요가 생기면 이 capability를 넓히지 않고 사용자 결정으로 되돌린다.

## E-036 — v1 종료에서 탐구 문서의 역할명과 장기 문서 수명주기를 분리

상태: **canonical 명칭 정리와 v1.0.0 review 추가 완료 — release 반영은 별도 승인 대기**

### 실제 문제와 evidence

현재 탐구 문서는 단순한 질의 모음이나 모든 AI 스킬에 강제하는 universal framework가 아니라, 기획·구현·검증·복구에서 필요한 절만 선택해 목적 보존, 비례성, 증식 차단과 환류를 판단하는 방법이다. 그러나 repository path `universal-ai-skill-inquiry-framework.md`와 generated module id `universalFrameworkOriginal`은 외부에서 가져온 임시 원본처럼 읽혀 현재 역할을 가렸다. `docs/plan/`에는 두 동결 입력과 35개 구현 결정을 보존한 Evolution ledger가 함께 있어, 파일명만 보고 현재 수정해야 할 plan과 고정된 역사 좌표를 구분하기도 어려웠다. 루트에는 project-local 설치와 scratch가 남긴 empty `.agents/skills/`와 `.tmp/`도 있었지만 두 경로 모두 Git 비추적이고 파일은 0개였다.

### 영향받는 결정·계약과 보존 목적

영향은 D-11의 탐구 원문 owner, authoring source graph, generated reference와 heading index, maintainer 문서 routing, v1 종료 판단이다. 동결된 concept와 상세 계획은 이동·수정하지 않고, established `implementation-evolution-plan_ko.md`도 기존 decision 좌표와 참조 비용 때문에 이름을 유지한다. 새 문서 index나 요약 정본을 만들지 않고 `AGENTS.md`를 유일한 maintainer router로 보존한다. Generated package는 직접 편집하지 않으며 canonical source와 target을 바꾼 뒤 rebuild한다. 과거 M5 Framework receipt와 protocol 명칭은 당시 evidence이므로 재작성하지 않는다.

### 검토한 대안과 선택

기존 이름을 유지하면 변경 비용은 없지만 현재 역할 오해와 `Original` 임시성이 계속 남는다. 동결 plan과 Evolution ledger까지 모두 rename하면 역사 좌표를 바꾸게 되고, 별도 docs index는 maintainer 진입점을 둘로 만든다. 따라서 현재 의미 owner만 `docs/guide/ai-skill-evolution-method_ko.md`, generated module은 `skillEvolutionMethod`로 좁히고, 문서별 수명주기는 `AGENTS.md`에 둔다. 동결 plan의 기존 상대 링크는 수정할 수 없으므로 이전 path에는 현재 정본 하나만 가리키는 짧은 비정본 안내를 보존한다. `docs/reviews/v1.0.0_ko.md`는 현재 owner를 링크하는 완료 버전 판단 기록일 뿐 새 구현·증거 정본이 아니다.

### 검증 결과와 재검토 조건

Canonical rebuild는 generated reference와 index를 새 이름으로 만들었고 tree SHA-256 `beaffa7d4f0b33dbe9a39b3f822058f415809a3168fe7a3ca13cf94c359a7479`, 36 files/202,221B로 artifact-intact/source-current였다. Authoring build와 repository boundary targeted test는 15/15 통과했다. 이름 변경 때문에 실패한 historical M5 harness 자기검사 두 개는 현재 canonical anchor와 source path를 가리키도록 좁혀 5/5 통과했으며 새 harness·schema·평가 run은 만들지 않았다. 최종 default `npm run verify`는 31/31 통과했고 별도 currentness check도 같은 tree를 확인했다. Empty `.agents/`와 `.tmp/`는 exact path 확인 뒤 제거했다.

Release 직전 local-link 감사에서 두 동결 plan의 기존 guide 상대 링크가 rename으로 끊기는 것을 발견했다. 동결 bytes를 바꾸지 않고 이전 path를 현재 정본으로 연결하는 4-line 안내만 복구했으며, 이 파일은 source package import나 generated payload가 아니고 의미 owner도 아니다.

이 변경은 method의 인과적 이익이나 broad AI 행동을 새로 proven으로 올리지 않는다. `1.0.0`은 새 architecture의 첫 안정 계약을 뜻하며 Git tag, commit, push, host 재설치는 별도 승인 전에는 수행하지 않는다. 후속 버전에서 문서 역할이 다시 겹치거나 cold maintainer가 `AGENTS.md`만으로 owner를 고르지 못하는 실제 장면이 생길 때 수명주기를 재검토한다.

## E-037 — 설치 artifact의 package와 builder version은 기존 receipt에서 함께 조회

상태: **v1.0.0 release closure와 두 host 재설치 완료**

### 실제 문제와 evidence

Generated target의 `.skill-rails-build.json`에는 이미 `packageVersion`과 artifact를 만든 `coreVersion`이 있었지만 source-side와 installed runtime의 `check` 결과는 target id와 tree hash만 반환했다. 따라서 사용하는 프로젝트에서 설치 bytes가 어느 skill package와 builder 계약에서 왔는지 확인하려면 내부 receipt를 직접 열어야 했다. 과거처럼 module별 version을 추가하면 한 release의 주 version을 다시 분산시키고, 별도 version file은 receipt와 불일치할 두 번째 정본이 된다.

### 영향받는 계약과 가장 작은 선택

영향은 generated artifact의 자기 식별과 `check` 출력뿐이며 build schema, 설치 방식, remote update 판정과 skill frontmatter를 바꾸지 않는다. Existing build receipt를 계속 단일 owner로 두고 source-side `check`와 세 runtime mode의 installed `check`가 `packageId`, `packageVersion`, `coreVersion`, `targetId`, `treeSha256`를 같은 의미로 반환한다. 공통 installed identity projection은 `src/runtime/integrity.mjs` 하나가 소유하며 세 runner가 이를 재사용한다. Git tag는 repository release 좌표이고 receipt는 실제 설치 bytes의 identity라는 경계를 보존한다.

### 검증과 재검토 조건

Targeted `tests/build.test.mjs` 13/13은 source currentness 검사와 source repository 없이 복사된 standalone target의 package/core version을 확인했다. Canonical rebuild 뒤 production authoring target은 36 files/202,763B, tree `e26b637ad076a66971cda8a18405262fc70d3320d9d590dcd3c4cd3fde17fcc7`로 artifact-intact/source-current이고 source-side와 installed check가 모두 `skill-rails-authoring@1.0.0`, core `1.0.0`을 반환했다. 이는 설치 artifact의 자기 식별만 proven으로 만들며 remote latest, installer가 선택한 Git commit 또는 update availability는 계속 `null`/`unproven`이다. 향후 installer가 검증 가능한 source commit을 artifact에 전달하는 공식 계약을 제공할 때만 remote release identity 확장을 재검토한다.

사용자 승인 뒤 release commit `213245ec9f711027431869e907d2d246d2cf41c6`과 annotated `v1.0.0` tag를 origin에 push하고 `skills@1.5.26`의 normal repository path로 Codex·Claude Code를 재설치했다. 두 host가 보는 36-file bytes, receipt hash와 installed `check` 결과가 같고 `CODEX_HOME`은 불변이다. Exact 설치 영수증과 좁은 claim은 `docs/implementation-verification_ko.md`의 v1.0.0 release closure 절이 소유한다.
