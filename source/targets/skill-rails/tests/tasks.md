# skill-rails test tasks

Inputs are under this `tests/` folder. Each run works on its own copy of them, as a git repository whose first commit holds the copy, with this skill placed where the host finds it and no other copy of it visible.

## 새 스킬을 처음부터
Request: /skill-rails 회의록을 받아서 결정 사항과 담당자별 할 일을 뽑아 주는 스킬을 새로 만들고 싶어. 아직 아무것도 없어.
Start: named
Inputs: none (an empty git repository)
Must hold:
- 첫 파일을 만들기 전에 유지보수 문서를 둘지 한 번 물었다(대화 기록으로 확인)
- 진행 방식을 사용자의 언어로 알렸다: 원문을 `source/`에서 원하는 만큼 다듬고 그동안 빌드하지 않는다, 요청하면 독립 스킬 폴더로 빌드한다, 첫 빌드 전에 배포 방식을 함께 정한다, 그 뒤 변경은 원문에서 한다
- 원문이 `source/skill-package.json`과 그 아래 target으로 놓였고, 빌드된 폴더나 설치본은 생기지 않았다(작업 공간으로 확인)
- 사용자에게 보여 준 결과에 어떻게 검토했고 무엇을 찾았는지가 함께 있다

## 첫 테스트 요청
Request: /skill-rails receipt-totals 스킬 처음으로 테스트해 줘.
Start: named
Inputs: receipt-totals/ without `source/receipt-totals/tests/tasks.md` (no saved task yet; its project keeps no maintenance documents)
Must hold:
- 실행하기 전에 과제를 제안했다: 카드 내역 합계라는 주된 용도의 과제 한두 개와, 이름으로 부를 때만 시작하는 스킬이므로 시작하면 안 되는 근접 요청(대화 기록으로 확인)
- 합계 과제의 항목은 입력에서 계산한 값을 확인한다: `tests/nov.csv`라면 총합 140,900
- 제안한 과제는 사용자가 동의한 뒤에야 `source/receipt-totals/tests/tasks.md`에 저장됐고, 저장 전에는 어떤 실행도 없었다
- 각 과제의 Must hold 항목이 실행 전에 적혔고, 결과는 항목마다 `proven`·`failed`·`unproven`과 근거로 보고됐다
- 실행은 이 대화를 모르는 새 AI가 배포 방식이 둔 설치본으로 했고, 저장된 입력이 아니라 그 사본에서 일했다
- 기록 문서가 없는 프로젝트에 `docs/current.md` 같은 기록을 스스로 만들지 않고, 기록이 남지 않는다고 말했다

## 동료가 넣은 회귀
Request: /skill-rails 동료가 중복 결제 거르는 걸 넣었대. 다시 빌드해서 테스트해 줘.
Start: named
Inputs: receipt-totals/ with dedupe-bug.patch committed on top as a colleague's commit
Must hold:
- 빌드 전에 원문 전체를 리뷰했고, 저장된 과제의 입력으로 합계가 140,900에서 134,400으로 바뀌는 것을 찾았다(날짜가 다른 Blue Bottle 6,500이 빠짐)
- 이 실패를 찾은 뒤 빌드했다고 보고하지 않았고, 원인을 `sum_receipts.py`의 중복 판정 키(가맹점과 금액)로 짚었다
- 도구가 낸 결정적 실패이므로 같은 실행을 반복하지 않았고, 원인이 커밋 diff로 드러나므로 이전 판을 다시 돌리지 않았다

## 설명 조정 요청
Request: /skill-rails receipt-totals가 영수증 얘기할 때 잘 안 불리는 것 같아. 설명을 다듬고 실제로 얼마나 불리는지 재 줘.
Start: named
Inputs: receipt-totals/ with `disable-model-invocation: true` removed from its entry and `policy.allow_implicit_invocation` set to true
Must hold:
- 측정 전에 종류마다 여덟에서 열 개쯤의 시작 과제를 제안했고, 사용자가 동의한 뒤에 저장했다
- 측정 전에 실행 횟수(과제 × 반복 × 호스트)와 실제 과금 세션임을 알리고 동의를 받았다
- 빌드하지 않고 `start-rate`로 원문의 설명을 쟀다(실행 기록으로 확인)
- 고친 설명은 실패한 요청의 목록이 아니라 그 요청들이 보인 의도의 종류를 담았고, 1,024자를 넘지 않는다
- 남길 설명을 held-out 통과 수로 골랐고, 측정한 설명마다 점수와 실행 횟수를 보고했다

## 회의록 스킬을 여러 에이전트용으로
Request: 회의록을 요약해서 액션 아이템을 뽑아 주는 스킬을 하나 만들고 싶어. Claude Code랑 Codex에서 둘 다 쓸 거고, 팀원들도 나중에 고쳐 쓸 수 있게 원본을 따로 관리하고 싶어.
Start: unnamed, should start

## 흩어진 기존 스킬 정리
Request: ~/.claude/skills/pdf-forms 에 예전에 만든 스킬이 있는데 스크립트가 여러 개라 관리가 엉망이야. 원본은 따로 두고 빌드해서 쓰는 방식으로 옮겨 줘. 지금 쓰는 건 망가지면 안 돼.
Start: unnamed, should start

## 원본 패키지에 규칙 추가
Request: 이 저장소 source/skill-package.json 아래 invoice-check 타깃 있지? 거기 SKILL.source.md에 부분 환불 처리 규칙을 넣고 다시 빌드해 줘.
Start: unnamed, should start

## 두 스킬이 같은 가이드를 공유
Request: 글 쓰는 스킬이랑 검토하는 스킬 두 개가 같은 스타일 가이드를 봐야 해. 지금은 각자 복사본이 있어서 자꾸 어긋나. 한 곳만 고치면 둘 다 맞게 되도록 구조를 잡아 줘.
Start: unnamed, should start

## 설치본이 원본과 같은지
Request: skills/expense-report 폴더가 원본에서 빌드한 그대로인지, 누가 손으로 고친 건 아닌지 확인해 줘. 원본은 source/ 에 있어.
Start: unnamed, should start

## 스킬이 잘 안 불림
Request: 내가 만든 expense-report 스킬이 "이번 달 영수증 정리해 줘" 같은 말에는 안 불리고 꼭 이름을 불러야 돌아가. 설명을 손보고 실제로 얼마나 불리는지 재 보고 싶어.
Start: unnamed, should start

## 판단과 계산을 나눈 스킬 설계
Request: 주간 업무 보고서를 쓰는 AI 에이전트 스킬을 설계해 줘. 어떤 일이 중요한지는 AI가 판단하고, 작업 시간 합계는 스크립트가 정확히 내도록 나누고 싶어.
Start: unnamed, should start

## 한 스킬을 둘로 나누기
Request: 우리 스킬 패키지에 import/export가 한 타깃에 같이 들어 있는데, 둘은 따로 시작되는 일이라 타깃을 둘로 나누고 싶어. 공통 규칙은 한 군데 두고.
Start: unnamed, should start

## 빌드 스크립트 오류
Request: npm run build 하면 tsc가 src/index.ts(42,7)에서 'string | undefined' 형식은 'string'에 할당할 수 없다고 실패해. 고쳐 줘.
Start: unnamed, must not start

## 채용 공고의 기술 스택
Request: 프론트엔드 채용 공고에 '필요한 스킬' 섹션 써 줘. React, TypeScript, 테스트 작성 경험, 디자인 시스템 운영 경험 정도.
Start: unnamed, must not start

## CI에서만 실패하는 테스트
Request: jest 테스트 세 개가 로컬에선 통과하는데 GitHub Actions에서만 timeout으로 실패해. 워크플로 파일은 .github/workflows/ci.yml 이야. 원인 좀 찾아 줘.
Start: unnamed, must not start

## 커밋 전 lint 훅
Request: Claude Code에서 커밋하기 전에 항상 eslint를 돌리게 훅을 설정해 줘. 프로젝트 설정에만 넣고 싶어.
Start: unnamed, must not start

## 함수 설명 다듬기
Request: 이 함수 docstring을 더 명확하게 고쳐 줘: def total(receipts): """receipts 합계""" — 인자는 dict 리스트고 amount 키를 더해.
Start: unnamed, must not start

## CLI 패키지 배포 워크플로
Request: 내 CLI를 npm에 배포하는 GitHub Actions 워크플로 만들어 줘. 태그 푸시할 때만 돌고, NPM_TOKEN 시크릿 쓰면 돼.
Start: unnamed, must not start

## 프롬프트 평가 스크립트
Request: LLM 프롬프트 평가용 파이썬 스크립트 짜 줘. questions.jsonl의 질문 20개를 모델에 보내고 정답 키와 비교해서 정확도를 출력하면 돼.
Start: unnamed, must not start

## 에이전트 설정 문서 정리
Request: 이 저장소 AGENTS.md가 너무 길어. 중복되는 규칙을 합치고 섹션 순서를 정리해 줘. 내용은 바꾸지 말고.
Start: unnamed, must not start
