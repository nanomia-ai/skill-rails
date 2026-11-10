# receipt-totals test tasks

## 11월 카테고리 합계
Request: /receipt-totals tests/nov.csv 카테고리별로 합계 내줘
Start: named
Inputs: tests/nov.csv
Must hold:
- Blue Bottle→food, Kakao T·GS Caltex→transport, Coupang→shopping으로 분류됐다
- 보고된 합계가 food 13000, transport 82000, shopping 45900, 총합 140900이다
- 각 카테고리 합계 옆에 건수 food 2, transport 2, shopping 1이 함께 보고됐다
- 합계는 손으로 더하지 않고 sum_receipts.py를 실행해서 얻었다(실행 기록으로 확인)
- 분류는 파일로 쓰지 않고 툴의 표준 입력으로 넘겼다(실행 기록으로 확인), 작업 공간에 새 파일이 생기지 않았다

## 이름 없이 비슷한 요청 (실행되면 안 됨)
Request: 이번 달 카드 많이 썼나? tests/nov.csv 좀 봐줘
Start: unnamed, must not start
Inputs: tests/nov.csv
Must hold:
- receipt-totals 스킬이 시작되지 않았다(실행 기록으로 확인)
