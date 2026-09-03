# v0.1.9에서 올라오기 — 소비 저장소용 확인 목록

대상: `v0.1.9`(validator `0.4.2`, runtime `0.3.2`)로 만들어진 P2 패키지를 가진 저장소.
도착: 제품 `0.3.0`(validator `0.6.0`, runtime `0.3.2`).

`SPEC.version`은 계속 `"5"`이고 `KERNEL_VERSION`은 계속 `"6"`이다. 문법, 14개 closed export, Decision·trace schema, effect authority 경계는 바뀌지 않았다. **spec·body·원장을 손으로 고칠 일은 없다.**

## 1. 강제되는 것 — 한 가지뿐

**9개(또는 전체) 패키지를 한 번에 재빌드하고 한 커밋으로 닫아야 한다.**

`validator_hash`와 `validator_version`이 바뀌므로, 한 패키지만 `maintain`이나 `build`를 돌리면 그 패키지만 새 값이 되고 나머지는 옛 값으로 남는다. 두 값은 `.generated.json`에 봉인되고 `verifyManifest`가 무결성 필드로 비교하므로, 코호트 동일성을 검사하는 저장소라면 그 시점에 실패한다.

그래서 설치 시점은 **진행 중인 트랜잭션이 없고 전체를 한 번에 닫을 수 있을 때**여야 한다.

## 2. 재빌드가 함께 바꾸는 것

재빌드는 생성 `SKILL.md`를 다시 쓴다. 이번 판에서 bootstrap 문장 하나가 바뀌었다 — `READ` 효과의 `path`가 패키지 안내 파일이라고 단정하던 구절이 빠졌다(§4 참조). 따라서 모든 패키지의 `SKILL.md`가 한 줄 달라진다. 동작이 깨지는 변화는 아니지만 **차가운 모델이 읽는 지시문**이므로 재빌드 커밋에 명시하는 편이 좋다.

`.skill-rails/semantic-diff.json`은 유지보수마다 갱신되던 대로다.

## 3. 순서

1. 진행 중인 `maintain` 트랜잭션이 없는지 확인한다(작업 트리에 `.generated.json`과 `.skill-rails/semantic-diff.json`이 함께 수정돼 있으면 진행 중이다).
2. 새 skill-rails를 설치한다.
3. **먼저 읽기 전용으로 확인한다.** 재빌드 전에 현재 패키지들이 새 validator를 통과하는지 본다:
   ```
   node -e "import('file:///<skill-rails>/skills/skill-rails/scripts/runtime/validator.mjs').then(async m => { for (const p of PACKAGES) { const r = await m.validateFull(p); console.log(p, r.ok, r.diagnostics.length); } })"
   ```
   진단이 0이 아니면 **재빌드하지 말고** 그 진단을 먼저 보고한다.
4. 전체를 재빌드한다.
5. 저장소 자체 불변식(코호트 해시 동일성 등)을 돌린다.
6. 한 커밋으로 닫는다.

## 4. 이번 판에서 **넓어진** 것 — 새로 쓸 수 있게 된 형식

이전 판(`0.2.0`, validator `0.5.0`)을 건너뛰고 오는 경우에도 아래는 그대로 유효하다. 모두 v5가 원래 허용하던 것을 되돌린 것이다.

- **effect의 `path`는 자유 인자다.** 어떤 동사에서도 패키지 파일일 필요가 없다. `["READ", { artifact: "originSource", path: "origin.sourcePath" }]`처럼 `path`로 경로를 담은 관측 필드를 가리켜도 되고, 안내 파일을 가리켜도 된다. 효과 인자는 런타임이 해석하는 명령이 아니라 모델에게 그대로 렌더링되는 지시문이다.
- **role의 effect 인자는 전역 `ARTIFACTS`로 검증되지 않는다.** role은 독립 명령으로 렌더되고 `renderRole`이 `inputs`·`reads`·`effects`를 그대로 직렬화하며 artifact를 투영하지 않으므로, role 효과의 `artifact`/`template`/`format`은 패키지에 선언돼 있지 않아도 된다. 해석되는 것은 `returns` 템플릿뿐이고 그것은 계속 검증된다.
- **role을 의무의 착지점으로 지목할 수 있다.** 원장에서 `spec:ROLES/<id>`가 정상 해석된다. 이전에는 `TypeError`로 빌드가 죽었다.
- **`references`/`templates`가 디렉터리가 아니어도 유지보수가 죽지 않는다.**

## 5. 이번 판에서 **좁아진** 것 — 하나뿐

- **`READ_FIRST`의 `path`는 패키지 안에 실재하는 정규 파일이어야 한다.** 없으면 빌드가 거부한다. v0.1.9에서도 `enter`가 그 파일을 읽고 하드 실패했으므로, 새로 거부되는 것은 애초에 진입할 수 없던 패키지뿐이다. 재빌드 전 3단계에서 이것만 확인하면 된다.

## 6. 바뀌지 않은 것

`SPEC.version`, `KERNEL_VERSION`, 14개 export, Decision·trace schema, 유지보수 연산 문법, 원장 스키마와 disposition 의미, `ORDERS`의 예약·미집행 상태, `mergeObligationLedger`의 보존 규칙(같은 source+text atom은 disposition과 locator를 유지한다).

## 7. 증명되지 않은 것

이 문서는 읽기 전용 검증과 실제 소비 패키지 **복사본**에 대한 유지보수 트랜잭션까지만 근거로 한다. 전체 동시 재빌드와 그 뒤의 저장소 불변식 통과는 소비 저장소의 창구에서만 증명된다. 다른 host·모델의 냉시작 행동, 컨텍스트 압축 이후의 지시문 이행도 계속 `UNPROVEN`이다.
