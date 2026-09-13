# Skill Rails 유지보수 상태

문서 상태: 교체형 현재 snapshot

최종 갱신: 2026-09-14 KST — M8 produced-skill pre-release acceptance 통과, cutover 미실행

## 현재 위치

- 사용자 계획 checkpoint commit: `9d35b75` (`docs: checkpoint greenfield Skill Rails plan`)
- M0~M4 구현 checkpoint commit: `eb08ff3` (`feat: checkpoint greenfield Skill Rails through M4`). M5~M7 변경은 coordinator 검토 전 uncommitted worktree다.
- 기존 v0.4.3 implementation 257개 파일은 `legacy/archive/v0.4.3/legacy-source.tar`에 보존했다. Capsule SHA-256은 `c79dcf45dc9ab520aa100e19ecf6ef95102d1a423c89c5090cadd40293db31fc`다.
- `inventory.json`이 원경로·Git/working hash·mode를, `restore-receipt.json`이 Windows temporary-root 복원 257/257와 mismatch 0을 소유한다. POSIX mode 복원은 `unproven`이다.
- Root package는 private metadata `@nanomia/skill-rails@1.0.0`, Node 범위는 `>=24 <25`이고 외부 runtime dependency는 없다. 공식 공개 전달은 npm registry package가 아니라 `nanomia-ai/skill-rails` repository의 `npx skills@latest` 경로다.
- Canonical authoring source는 `authoring/skill-rails/`, generated tracked skill은 `skills/skill-rails/`이다. 현재 repository discovery에 active skill은 production candidate `skill-rails` 하나뿐이다.
- Natural-language pilot의 현재 record-only Verify 설치 target tree SHA-256은 `25798e8a916d8b0062427c3d38f100198e94cb2bda8e90f79d5bd1bfde21763a`다. 표준 installer로 Codex·Claude Code에 설치했고 두 runtime `check`는 `ARTIFACT_INTACT`다.
- Production cutover 직전 기존 전역 `skill-rails`는 두 host 위치에서 각각 63 files/1,028,325B, raw path+content hash `367dc53f...`로 불변이다. Pilot target `natural-language-pilot-verify-next`와 project-local alpha evidence는 별도 이름으로 보존하며 production source로 사용하지 않는다.
- Coherent M5 종료의 default `npm test`는 29/29였고 bounded embedded authoring CLI 단위 종료의 현재 default `npm test`는 31/31 pass다. M4/M5 historical evaluation test는 기본 discovery 밖에 보존한다. 구조 검사는 fresh AI 행동이나 실제 effect를 대신 증명하지 않는다.

## milestone 상태

- **M0 완료**: 동결 정본 보호, inventory, 사용자 변경 분리, legacy capsule, 복원 rehearsal, clean-slate final-path 전환.
- **M1 완료**: closed source/target/receipt schema, containment·collision·canonicalization, deterministic standalone build, integrity/currentness, exact inspect.
- **M2 완료**: `PreparedWorkV1`, nonce exchange, fixture observer, eight-block packet, unknown/fallback 분리. Codex와 Claude Code가 fresh context에서 fallback을 미리 읽지 않고 prepare를 먼저 실행한 장면이 있다.
- **M3 완료**: semantic answer validation, core-owned renderer spawn, input/output CAS, lock, staged apply, reread authority, idempotent retry와 fault injection.
- **M4 완료**: paired normal control/treatment와 unknown, command failure, input stale, output conflict, other-card 보존, response-loss retry, prepare-failure fallback을 fresh context로 실행했다. 결과는 `renderer-only`다.
- **M5 완료 — Framework는 unproven/pre-gate**: record-only 선행 gate 뒤 Framework whole original과 deterministic heading index를 generated authoring skill에 materialize했다. 첫 v1 예비 실행은 기준안 오염과 비용·fixture 오류 때문에 gate evidence가 아니며, revision 3 matrix는 사용자의 검증 증식 중단 결정에 따라 L0 6개 complete cell 뒤 즉시 중단했다. 완료 receipt/raw와 protocol은 보존하되 L0/L1/L2 우위, semantic acceptance와 unfamiliar using-AI 효과를 주장하지 않는다. 평가 harness/schema는 `evals/m5/framework/`, M4 prepare/fallback 재현 helper/test는 `evals/m4/`로 격리했다.
- **M5 Product pilot adoption 통과**: fresh Codex author 1회는 prose-only 3-file Product target과 실제 fixture를 추가했고 targeted build 11/11, standalone integrity/currentness를 통과했다. 최초 interactive Claude launch의 workspace trust 전달 실패는 보존한다. 사용자 재개 뒤 help로 확인한 Claude 고유 bypass permissions/print mode에서 동일 bytes/input의 fresh unfamiliar consumer 1회가 installed skill을 발견하고 no-clobber brief를 생성했으며 coordinator reread acceptance/effect가 통과했다. 이 한 관찰은 Product에만 적용하고 다른 stage나 Framework lane에 복사하지 않는다.
- **M5 maintainer/source-graph 부분 실패**: fresh Codex maintainer는 Product/package inspect 관계와 semantic-edge gap을 찾았지만 넓은 검색·shell 결합 뒤 report parse error로 bounded 일곱 질문을 완료하지 못했다. Wrong-owner 수정 evidence가 없어 schema/projection을 열지 않았고 재실행도 하지 않았다. 실제로 없던 safe-record D-14 pointer 세 개만 owning code에 보강했으며 record targeted test 13/13이 통과했다. Pointer의 fresh 비용 절감은 `unproven`이다.
- **M5 Direct pilot adoption 통과**: fresh Codex author 1회가 prose-only Direct target과 Product 결과를 그대로 쓰는 fixed fixture를 추가했다. Review에서 capability 표시 이름을 exact id로 사용한 결함을 consumer 설치 전에 canonical entry의 `bookmark-storage`로 좁혔다. 원자적으로 만든 격리 root의 fresh Claude Code/Fable consumer 1회가 installed skill을 발견하고 plan 부재를 확인한 뒤 no-clobber로 정확히 한 card를 생성했으며, coordinator reread에서 395 bytes와 acceptance를 확인했다. 이 관찰은 Direct에만 적용하고 Work·Verify·Resume에 복사하지 않는다.
- **M5 Work pilot adoption 통과**: prose-only Work target은 실제 brief·plan·package·test를 읽어 process-local `Map` source를 no-clobber로 만들고 exact test 뒤 progress를 기록한다. Fresh Codex Sol medium 주 관찰과 Claude Opus medium 비교 관찰 모두 installed skill 행동과 reread effect를 완료했으며 input bytes를 보존했다. Routine consumer에 쓴 Fable high 성공은 사용자 model-allocation 교정에 따라 예비 evidence로만 남기고, author command discipline과 Sol setup command 실패는 별도로 보존한다. Pre-existing output과 concurrent writer 장면은 `unproven`이다.
- **M5 Verify adoption 통과**: 최초 두 fresh root에서는 같은 이름의 기존 user-level tree가 project-local current tree를 가려 current delivery를 증명하지 못한 실패를 보존했다. 사용자 승인으로 별도 alpha Verify만 표준 installer에서 current tree `25798e8a916d8b0062427c3d38f100198e94cb2bda8e90f79d5bd1bfde21763a`로 갱신했고 기존 `skill-rails`는 불변이었다. 정확히 한 fresh Codex Sol medium이 current tree를 선택해 accepted Work root에서 `APPLIED`와 coordinator-reread effect를 냈으므로 이 한 관찰 범위에서 Verify를 채택한다. Claude current-tree와 recovery/반복성은 `unproven`이다.
- **M5 Resume adoption 통과**: prose-only Resume는 brief·plan·progress·verification 네 artifact만 state source로 읽는다. 같은 complete-chain fixture의 fresh Codex Sol medium과 Claude Opus medium이 installed skill을 발견해 verified non-production 위치, `maintain`, 세 unknown과 네 근거 경로를 보고했고 coordinator의 전체 path/hash 재읽기는 project no-write를 확인했다. Missing·failed·stale artifact와 반복 비용은 `unproven`이다.
- **M5 종료 경계**: 실제 Product/Verify differential currentness에서 Verify-only 변경은 Product를 current로 유지하고 Verify만 stale로 만들었다. 실제 common-module consumer가 없어 그 전파는 `unproven`으로 남겼고 dummy/import를 추가하지 않았다. Fresh maintainer의 bounded 탐색은 부분 실패로 보존했으며 재실행하지 않았다. Canonical authoring target과 다섯 pilot target은 모두 artifact-intact/source-current이고 default suite 29/29가 통과했다.
- **M6 종료 — adoption gate 불통과**: 첫 Resume whole-module pressure 뒤 가장 다른 historical Product·Work target을 같은 byte-identical evidence package에 추가했다. `inspect`는 common의 세 consumer, state의 Resume/Work, planning의 Product를 정확히 반환했고 세 standalone target은 146.6147ms build와 161.4289ms unchanged rebuild에서 같은 hash로 artifact-intact/source-current였다. Product 86,154B, Work 99,916B, Resume 154,345B의 fixed read에서 fresh Codex Sol medium과 Claude Opus medium은 Product·Work 의미 effect를 각각 한 번 완료했다. 임시 common 1-byte 변경은 기존 세 target을 모두 artifact-intact/source-stale로 만들었고 214.8074ms rebuild 뒤 모두 current로 복구됐다. 독립 delivery와 all-consumer changed-common 전파는 통과했지만 selective-stale은 `unproven`이고, 이 historical granularity는 minimal-read 조건을 충족하지 못했으며 unchanged prose 대비 총비용도 `unproven`이다. 따라서 frozen adoption 조건 전체는 통과하지 않았고 순서 3~5, 네 번째 target과 inverse impact는 열지 않는다. M7 미진입은 현재 사용자 sequencing 결정이며 frozen M7 dependency 실패가 아니다.

- **M7 bounded machine generalization 통과**: Core vocabulary 검사에서 `stage`는 임시 filesystem staging 의미였고 `brief`·`verification`은 없었지만, `src/runtime/prepare.mjs`가 `cardId`와 Verify-shaped field 목록을 packet에 고정한 최초 dependency 실패를 발견했다. 사용자의 명확한 결함 개선 지시에 따라 목록을 제거하고 기존 domain-owned answer contract만 따르는 한 문장으로 좁혔으며 historical prepare-record targeted test는 6/6 통과했다. 비-Devflow museum-label editorial review package 하나는 canonical inspect, standalone build/check, observer prepare, invalid no-write, valid apply+reread, human prefix 보존과 `APPLIED_ALREADY`를 기존 core/runtime으로 완료했다. 이 한 domain의 machine reuse만 proven이며 fresh AI discovery·semantic answer·editorial quality와 다른 domain/host/scene은 `unproven`이다.
- **M8 전 완결성 감사와 portable authoring 보정 종료**: Canonical authoring entry의 작은 operational flow와 on-demand `overview --source`를 유지하면서 prose target의 optional enum-of-one `embeddedCoreTooling: "authoring-cli-v1"`을 추가했다. Authoring target만 이를 선언하고 generated `scripts/skill-rails-cli/`는 canonical 27-file closure를 기존 receipt/currentness 아래 전달한다. Production identity 재생성 뒤 release suite 31/31과 generated tree `cab9710da8105611dbb56e8d5e4b8ca4c1721378feec1a30f646ed96690b4fc7`의 artifact-intact/source-current가 통과했다.
- **M8 produced-skill pre-release acceptance 통과**: 별도 일반 project에서 정상 `npx skills@latest` local-source flow로 current authoring skill을 두 host 위치에 설치했다. Fresh Codex는 두 prose target과 한 genuine shared module을 저작·double-build했고, shared owner 1회 변경은 두 consumer를 모두 stale로 만든 뒤 affected-only rebuild와 정상 재설치로 current를 복구했다. Fresh Claude Opus medium bypass 1회는 두 installed target을 발견해 570B/921B 실제 effect를 만들고 reread했으며 coordinator도 다시 읽었다. Generated target은 각각 8 files/약 19KB였고 fresh consumer의 실제 pre-write read는 5 files/6,081B, Skill Rails 내부 read/call은 0이었다. 기존 user-level `skill-rails` 두 위치는 각각 63 files/1,028,325B와 기존 task-local hash `367dc53f...`로 불변이고 `CODEX_HOME`도 바꾸지 않았다. Codex author input 468,994 tokens와 누락된 exact author tool/wall telemetry는 generated output 결함과 인과가 관찰되지 않은 secondary DX concern이지 release-blocking output failure가 아니다.

## M4 판정

Treatment의 canonical renderer/record는 두 control이 발명한 비호환 marker를 피했고, stale/conflict no-write, 다른 card 보존과 idempotent retry를 실제 장면에서 보였다. 반면 prepare는 두 host의 normal run에서 총 context·비용을 낮췄다고 증명되지 않았고 Claude의 bounded read도 안정적으로 만들지 못했다. Fallback은 treatment runtime 오염 또는 비호환 marker 생성으로 두 번 실패했다.

따라서 다음 milestone에 유지할 후보는 deterministic standalone build와 안전한 renderer/record 원리다. 현재 prepare-record pilot을 production 기준선이나 Devflow fallback으로 확대하지 않는다. 기존 코드와 receipts는 M1~M4 실험 증거로 남긴다.

## 정확한 다음 진입

M5의 renderer-only 선행 gate는 E-019와 `evals/m5/results/renderer-only-boundary-gate-2026-09-13.json`으로 닫혔다. Framework 초기 교정과 중단·격리는 E-020/E-021 및 `evals/m5/results/framework/`가 소유한다.

1. M8 produced-skill acceptance와 종단 evidence는 `docs/implementation-verification_ko.md` 마지막 절, `evals/m8/results/pre-release-end-to-end-2026-09-14.json`, E-034가 소유한다.
2. Bounded final audit는 post-consumer input hash, Claude raw-session authority, tracked generated currentness, package payload와 release suite까지 닫혔다. 다음은 coherent non-force release commit/push와 exact remote candidate 확인이다. Author telemetry를 보충하려고 fresh author를 재실행하거나 harness를 추가하지 않는다.
3. Remote candidate에서 README의 공식 `npx skills@latest add nanomia-ai/skill-rails` 경로와 두 project-local host 설치가 exact candidate를 고르는지 확인한다. 두 번째 tooling 값·consumer·closure, domain executable 또는 generic asset grammar는 열지 않는다.
4. Production identity, remote 배포와 기존 전역 `skill-rails` 교체는 이번 M8 사용자 승인 범위다. Force/history rewrite, README 변경과 archive 삭제는 계속 금지한다.

## 아직 unproven 또는 기각된 범위

- M4 결과의 통계적 일반화와 final tree의 모든 scene×host 조합
- Prepare의 총비용 절감과 Claude bounded-read 효과
- 현재 fallback의 canonical managed-record 작성 능력
- Renderer-only의 recovery scene별 fresh-agent 결과, 통계적 비용 우위와 prose 대비 우위
- Framework L0/L1/L2의 상대 효과, Product·Direct·Work·Verify·Resume 반복과 다른 host 조건, maintainer pointer 효용과 full maintain traversal, migration과 Devflow integration. 완료된 L0 6개 cell과 각 stage의 bounded 관찰은 이 주장을 proven으로 올리지 않는다. 한 M8 two-consumer package의 common shared-module currentness 전파만 좁게 proven이다.
- M6 whole-module의 context·품질·unchanged prose 대비 총비용 우위, exact source-only token attribution, greenfield의 더 작은 source boundary, selective-stale, inverse impact와 9-target integration. 세-target consumer graph와 all-consumer changed-common currentness 전파만 좁게 proven이다.
- M7의 fresh AI discovery·semantic answer·editorial quality, 다른 비-Devflow domain·host·scene, prepare/fallback production adoption. 한 editorial-review domain의 machine-level source graph·observer·renderer·error/result 재사용만 좁게 proven이다.
- 정상 설치된 embedded authoring CLI의 fresh author·unfamiliar use·maintain effect는 한 M8 project에서 관찰됐지만 반복성, authoring-process 비용 효율, 새 operational guidance의 인과적 품질 이득과 on-demand overview의 실제 human comprehension 효과는 unproven이다.
- Remote release와 production installer/global 교체의 실제 결과는 cutover receipt가 생기기 전까지 `unproven`
- POSIX capsule mode restoration

세부 evidence와 실패 원본은 `docs/implementation-verification_ko.md`가 소유하고, 계획과 달라진 선택은 `docs/plan/implementation-evolution-plan_ko.md`가 소유한다.
