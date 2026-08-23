# Skill Rails 유지보수 상태와 다음 세션 진입점

문서 상태: 교체형 작업 snapshot

최종 갱신: 2026-08-23 KST

이 문서는 새 세션이 “마지막으로 어디까지 끝났고 어디서 이어야 하는가”를 빠르게 복구하기 위한 시작점이다. 제품 계약은 [제품·설계 정본](skill-rails_ko.md), 정확한 수치·지원 주장·V5 변경 근거는 [구현·검증 기록](implementation-verification_ko.md)이 소유한다.

이 파일을 일지처럼 계속 덧붙이지 않는다. 의미 있는 유지보수 milestone이 끝날 때 현재 상태로 교체한다. 과거 세션의 상세 chronology는 Git과 Orca 실행 기록에 맡긴다.

---

## 1. 저장소 기준선

- branch: `main`
- 이전 완료 milestone commit: `d9aac0a` (`feat: add progressive guidance for simple skills`)
- 작업 시작 시 `origin/main`은 `9691f107bc08ac7657bca3bc6160f0d2aa3159eb`였고 local `main`은 한 commit 앞섰음
- 현재 milestone은 portable universal installation이며 최종 commit·push·원격 release smoke 전 상태
- 최초 구현 기획과 통합 문서는 Git commit `4929b5b`에서 복구 가능

다른 프로젝트, 특히 `D:/Projects/Private/nanomia/nanomia-skills/devflow/`, 는 이 작업 범위 밖이며 read-only다.

---

## 2. 마지막 완료 milestone

목적은 Node.js가 있는 환경에서 Skill Rails의 기능을 줄이지 않고 한 번의 file-based installer 명령으로 여러 host에 같은 portable creator를 설치할 수 있게 하는 것이다.

완료된 구현:

- `markdown-it` 공식 standalone bundle을 creator package 안에 vendoring하고 bundle에 포함된 dependency notice를 함께 보존
- 고정 sync script와 `vendor:check`가 vendor byte를 소유하며 수동 편집을 거부
- migration이 package-local parser를 사용하되 기존 stock reference rule과 semantic atom 계약을 유지
- portable creator test가 외부 runtime import를 차단한 상태에서 `init`, `migrate`, `maintain`, `lint`, `build`, `eval --skill`을 실행
- `npx skills@latest add nanomia-ai/skill-rails`를 기본 설치 경로로 문서화하고 Node runtime과 installer의 version requirement를 분리
- 다른 file-based host의 구조적 설치 가능성과 Codex·Claude의 fresh 행동 evidence를 분리
- marketplace plugin, hook, platform별 행동 body를 추가하지 않음
- Windows checkout이 vendor byte를 바꾸지 않도록 `scripts/**/vendor/** -text`를 Git 계약으로 고정

P0/P1 profile, conditional guidance, P2 `spec.mjs`, V5 runtime, obligation ledger, generated-package shape는 변경하지 않았다. Root `SKILL.md` package boundary 때문에 installer가 tests와 설계 기록까지 함께 복사하는 186-file payload는 알려진 비차단 비용이다. 이 파일들은 자동 prompt loading 경로가 아니며, 이를 줄이기 위한 nested distribution layout은 별도 repository migration으로 남긴다.

설계 경계는 Claude Opus xhigh read-only audit로 먼저 검토했고, 구현 뒤 fresh Opus xhigh diff audit를 수행했다. 최종 audit는 Windows line-ending 문제 한 건을 blocking으로 찾아냈으며 `.gitattributes`로 보정했다. 그 외 기존 행동 의미, V5, P0/P1, license notice, 문서 주장에는 blocking finding이 없었다.

---

## 3. 마지막 검증

- `npm run verify`: `vendor:check`, lint, 49/49 tests, frozen eval pass
- 외부 runtime dependency를 차단한 portable creator command test pass
- Node 24.18.0 + `skills` 1.5.23의 node_modules-free clone-shaped package 설치 smoke pass
- Codex, Claude Code, Cursor, OpenCode target 선택으로 installer copy 성공
- `.agents`와 `.claude` 설치 tree fingerprint byte-identical
- 설치된 creator의 migration이 12개 semantic atom과 기존 kind/order를 보존
- 설치된 creator가 만든 P2 package의 L0–L18 full lint pass
- 독립 audit가 old-import와 vendored-import migration 결과를 5개 corpus(12/726/331/3/1693 atoms)에서 full JSON 비교해 동일함을 확인
- local Markdown link와 `git diff --check` pass

현재 설치 smoke는 local clone-shaped source를 사용했다. GitHub 원격 배포본을 다시 내려받는 release smoke는 push 뒤 수행해야 하며 아직 성공 증거로 기록하지 않는다. Cursor·OpenCode의 fresh trigger와 실제 task output도 `unproven`이다.

---

## 4. 이번 maintenance 종료 상태

- Portable dependency 구현과 회귀검증 완료
- README 영문·한글, adapter reference, 제품 설계, 구현·검증 기록 정합화 완료
- Root package payload 증가는 의도적으로 수용한 비차단 packaging limitation
- Claude plugin 또는 official marketplace 등록은 구현하지 않음
- 코드 blocking finding 없음
- 최종 commit, push, 원격 release smoke가 남아 있음

---

## 5. 다음에 선택할 수 있는 검증

이번 milestone을 닫기 전에 필요한 마지막 단계:

1. commit과 `origin/main` push
2. 별도 임시 project에서 `npx skills@latest add nanomia-ai/skill-rails` 원격 설치
3. 원격 설치본에 `node_modules`가 없는 상태로 migration과 L0–L18 재실행

그 뒤의 선택적 범위:

1. Cursor·OpenCode 등 추가 host의 fresh trigger, skill-root 해석, 실제 task output
2. Node 20에서 manual clone 설치 smoke와 최신 49개 suite 재실행
3. Linux/macOS installer와 filesystem 경계
4. 186-file root payload가 실제 배포 문제일 때만 nested distribution layout 설계
5. P0/P1 conditional guidance의 multi-match, no-match, near-miss와 장기 compaction
6. 실제 대형 기존 skill migration

증거가 필요하지 않은 항목을 관성적으로 실행하지 않는다. 구조적 설치와 fresh AI 행동을 같은 지원 주장으로 합치지 않는다.

---

## 6. 새 세션 시작 순서

1. `AGENTS.md`와 `CLAUDE.md`를 읽는다.
2. 이 문서에서 마지막 milestone과 남은 작업을 확인한다.
3. `git status`, `git log`, 기준 commit과 실제 diff를 확인한다.
4. 제품 경계를 바꾸는 작업일 때만 `docs/skill-rails_ko.md`를 읽는다.
5. 지원·성공·V5 보존을 주장하거나 검증할 때만 `docs/implementation-verification_ko.md`를 읽는다.
6. 생성·마이그레이션·P2·평가·adapter·README 중 현재 작업에 필요한 `references/`만 읽는다.
7. deterministic 구조, model 행동, output 품질 evidence를 분리한다.
8. blocking finding이 아니면 코드를 추가하지 않고, finding이면 owning abstraction을 먼저 판정한다.

이 문서의 고정 shape는 위 여섯 절이다. 새 항목이 생겨도 일곱 번째 chronology 절을 추가하지 말고 해당 절의 현재 상태를 교체한다.
