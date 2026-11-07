# 아침 보고서 (11월 8일 밤 작업)

작성: Claude Code · 2026-11-08 새벽

오늘 밤 목표였던 **프로젝트 세팅과 서버 완성**은 끝났습니다. 완료 기준 6개를 모두 확인했고, 테스트 58개(shared 18, server 40)와 루트 타입 체크가 통과합니다. 원격 저장소 생성, push, 배포는 하지 않았습니다.

## 1. 완료한 작업과 커밋 목록

| 커밋 | 내용 |
| --- | --- |
| `701b0bd` | chore: 모노레포 세팅, 기획서와 작업 규칙 추가 (pnpm workspace + Turborepo, `CLAUDE.md`) |
| `eb5114d` | feat(shared): 공통 타입, 격자 함수, 토픽 이름과 파싱 추가 |
| `cb6ab70` | feat(server): adsb.lol, adsb.fi 어댑터와 응답 정규화 추가 |
| `a5a8c05` | feat(server): 예비 소스 전환과 폴링 백오프 추가 |
| `1c2eb94` | feat(server): Aedes 1.2.0 브로커, /mqtt WebSocket 연결, 발행/구독 권한 규칙 추가 |
| `1a3934a` | feat(server): 격자별 폴러, retained 스냅샷 발행, 상태 토픽 추가 |
| `bfced22` | feat(server): Express /health, 환경 변수, 서버 시작 스크립트 추가 |
| `5c8a20b` | chore: GitHub Actions CI 추가 (설치, 타입 체크, 테스트) |
| `a50fd74` | chore(web): Vite + React + TS 기본 세팅, 지도/실시간 의존성 설치, shared import 확인 |
| (마지막 커밋) | docs: 구독 스크립트, README, HANDOFF 추가 |

**완료 기준 확인**

- [x] `pnpm install`, `pnpm test`, `pnpm type-check`가 루트에서 모두 통과
- [x] 서버 실행 후 `/health`가 `{"status":"ok","activeGrids":0,"source":"ok"}`로 응답
- [x] 구독 스크립트로 `flights/37.5/127.1`을 구독하면 스냅샷을 받음 (60초 동안 10개, 아래 6번)
- [x] 클라이언트가 발행하면 거절되고 연결이 끊김 (`apps/server/test/broker.test.ts`에서 실제 Aedes + WebSocket으로 확인, 다른 구독자에게 메시지가 가지 않음)
- [x] 프론트엔드 개발 서버가 placeholder 화면으로 실행됨 (`<title>내 머리 위 비행기</title>`, shared 모듈 로드 확인)
- [x] `docs/HANDOFF.md` 작성

**파일 구조 (기획서 2번과 같고, 몇 개 추가)**

```
apps/server/src/
  sources/   adsbLol.ts, adsbFi.ts, index.ts(예비 전환)
             + normalize.ts(공통 정규화), http.ts(타임아웃 + User-Agent), types.ts(어댑터 형태)
  broker.ts  Aedes 생성, /mqtt WebSocket 연결, 권한 규칙
  poller.ts  격자별 구독 수 추적, 폴링 시작/중지, 백오프, 요청 분산
  + backoff.ts   다음 폴링 간격 계산 (순수 함수)
  + realtime.ts  브로커 이벤트 ↔ 폴러 연결, retained 발행
  + app.ts       Express 앱과 서버 조립 (테스트에서 가짜 조회 함수를 넣기 위해 index.ts와 분리)
  config.ts, index.ts
apps/server/test/  sources, fallback, broker, poller, app, config 테스트 + 응답 샘플 fixtures
apps/server/scripts/sub.ts
```

## 2. 완료하지 못한 작업과 이유

- 없음. 범위 밖으로 정한 프론트엔드 화면, 지도, 구독 로직, 배포, push는 하지 않았습니다.
- 다만 **실제 비행기가 있는 응답으로는 정규화를 확인하지 못했습니다.** 실제 API 확인 시각(새벽 3시 23분)에 송파구 반경 15해리 안에 비행기가 0대였습니다. 테스트는 readsb 형식으로 만든 샘플로 했습니다. "확인 필요" 1번을 보세요.

## 3. 내린 결정 (작은 결정)

**저장소와 도구**

- 프로젝트 폴더명은 기획서 2번 구조대로 `flight-overhead`. 기존 `portfolio-project` 폴더는 이 세션이 쓰고 있어 이름을 바꿀 수 없어서, 새 폴더를 만들고 `docs/PLAN.md`를 복사했습니다 (확인 필요 2번).
- 패키지 이름은 `@flight/shared`, `@flight/server`, `@flight/web`.
- shared는 빌드 없이 TS 소스를 바로 export (`main`/`exports`가 `src/index.ts`). Vite, tsx, Vitest가 모두 TS를 직접 읽으므로 빌드 순서 문제가 없음.
- 서버는 빌드 없이 `tsx`로 실행 (`dev`는 `tsx watch`). 배포 방식은 호스팅이 정해지면 다시 결정.
- 전체 ESM(`"type": "module"`), TypeScript 5.9로 통일. Vite 템플릿이 TypeScript 7을 넣었지만 서버, shared와 맞추려고 5.9로 내리고 `strict: true`를 명시.
- 버전: Aedes 1.2.0(고정), Express 5, ws 8, mqtt.js 5, Vitest 3, Vite 8, React 19, react-leaflet 5, leaflet 1.9, zustand 5.
- `engines.node`는 `>=20.12` (`process.loadEnvFile`로 `.env`를 읽으려고). 로컬은 Node 22.23.
- pnpm 10이 esbuild 설치 스크립트를 막아서 `pnpm-workspace.yaml`의 `onlyBuiltDependencies`에 esbuild만 허용.
- `.gitattributes`로 줄바꿈을 LF로 통일.
- CI는 오목 프로젝트와 같은 액션 버전(checkout v7, pnpm/action-setup v6, setup-node v7)과 Node 22. 브랜치는 `main` push와 PR.
- Prettier 설정은 오목 프로젝트 것을 그대로 복사 (세미콜론, 작은따옴표). web은 Vite 템플릿 스타일(세미콜론 없음)이 남아 있음.

**shared**

- `snapshotTopic`은 내부에서 한 번 더 반올림하고, `-0.0`은 `0.0`으로 정리.
- `parseSnapshotTopic`은 소수점 한 자리 형식만 허용하고 `snapshotTopic`으로 다시 만든 값과 같을 때만 통과. 그래서 `+`, `#` 와일드카드, `37.50`, `-0.0` 같은 표기는 모두 거절됨 (같은 격자에 토픽이 여러 개 생기는 것을 막음).
- `SourceName = 'adsb.lol' | 'adsb.fi'` 타입을 추가로 export.

**서버**

- 정규화: `hex`가 없거나 빈 항목도 버림 (마커 key라서). 숫자가 아닌 `alt_baro`/`gs`/`track`은 필드를 비움. adsb.fi의 `~`로 시작하는 TIS-B hex는 그대로 둠.
- 응답에 목록 키(`ac`/`aircraft`)가 배열로 없으면 실패로 보고 예비 전환.
- 예비 전환은 매 요청마다 메인부터 다시 시도 (메인이 회복되면 바로 `ok`로 돌아옴).
- 백오프는 "둘 다 실패(degraded)"일 때만 실패로 셈. 5 → 10 → 20 → 40 → 60초(최대). 예비 소스 성공은 정상 간격 유지.
- 다음 폴링은 이전 조회가 **끝난 시점** 기준으로 예약 (요청이 겹치지 않게). 그래서 실제 간격은 5초 + 응답 시간, 실측 약 6.2초 (확인 필요 3번).
- 요청 분산: 서로 다른 격자의 요청 시작 사이에 최소 250ms 간격. 예약 시각 목록과 비교하므로 한 격자의 60초 백오프 예약이 다른 격자를 밀어내지 않음.
- 구독 수는 "클라이언트 객체 → 구독 토픽 집합"으로 관리. 중복 구독, 구독한 적 없는 토픽 해제, 해제 없는 연결 종료, 같은 clientId 재접속에서도 수가 어긋나지 않음.
- 조회 중에 마지막 구독자가 떠나면 결과를 발행하지 않음.
- 허용되지 않은 토픽 구독은 연결을 끊지 않고 SUBACK 128로 거절 (Aedes 문서의 "negate" 방식). 발행은 Will 메시지 포함 전부 거절하고, Aedes 기본 동작대로 연결을 끊음.
- WebSocket은 `/mqtt` 경로만 업그레이드하고, 프레임 최대 64KB. Aedes `drainTimeout`은 문서 권장 범위 안의 30초.
- 상태 토픽 값은 문자열 그대로(`ok`), 스냅샷은 JSON. 둘 다 QoS 0, retained.
- `status/source`는 서버 전체에 하나라서 "가장 최근 조회 결과"를 뜻함. 첫 조회 전에는 발행하지 않고 `/health`는 `ok`로 보고.
- `.env.example`의 `USER_AGENT` 기본값은 `flight-overhead/0.1`. 타임아웃 5초와 최대 간격 60초는 확정값이라 환경 변수로 열지 않음.
- 로그에는 격자 토픽(0.1도 단위)만 남기고 정확한 위치나 클라이언트 정보는 남기지 않음.

**Aedes 1.2.0 확인 내용** (기획서 열린 질문 "Aedes 1.2.0 README에서 브로커 초기화 코드 확인" 완료)

- 설치된 패키지의 `README.md`, `docs/Aedes.md`, `docs/Examples.md`, `docs/MIGRATION.md`, `aedes.d.ts`, `types/*.d.ts`를 읽고 작성.
- 1.x는 default export가 없고 `import { Aedes } from 'aedes'` 후 `await Aedes.createBroker(opts)`로 만듦. WebSocket은 `ws`의 `createWebSocketStream(socket)`을 `aedes.handle(stream, req)`에 넘기는 공식 예제 방식.
- `broker.publish()`는 `authorizePublish`를 거치지 않으므로 서버 내부 발행만 통과함 (문서에 명시).
- 타입 정의는 구독 qos를 0/1/2로만 적지만, `subscribe` 이벤트에는 거절된 구독이 qos 128로 들어옴(문서와 `lib/handlers/subscribe.js`로 확인). 그래서 `realtime.ts`에서 `as number`로 비교함.

**프론트엔드 기본 세팅**

- 템플릿의 데모 파일(App.css, assets, icons.svg, README)은 지우고, 화면은 placeholder 한 줄. `lang="ko"`, 제목은 가칭 "내 머리 위 비행기".
- `App.tsx`에서 `toGrid`, `snapshotTopic`, `Snapshot` 타입을 import해 타입 체크와 Vite 로드를 확인 (일부러 틀린 값을 넣었을 때 타입 오류가 나는 것도 확인).
- 의존성 `react-leaflet`, `leaflet`, `zustand`, `mqtt`와 `@types/leaflet` 설치.

## 4. 확인 필요 (판단이 필요한 것)

1. **실제 비행기가 있는 응답으로 정규화 확인.** 새벽이라 0대였습니다. 낮에 서버를 띄우고 `pnpm --filter @flight/server sub`를 한 번 실행해서 비행기 수와 편명이 나오는지 봐 주세요. 필드 이름이 다르면 `apps/server/src/sources/normalize.ts`만 고치면 됩니다.
2. **기존 폴더 정리.** `C:\Users\user\Dev\Project\portfolio-project`에 원래 `docs/PLAN.md`가 그대로 남아 있습니다 (세션이 폴더를 잡고 있어서 이름을 바꾸거나 지울 수 없었음). 새 폴더에 같은 파일이 있으니, 세션을 닫은 뒤 지워도 됩니다.
3. **폴링 간격의 뜻.** 지금은 "조회가 끝나고 5초 뒤 다음 조회"라 실제로는 약 6초마다 갱신됩니다. 기획서의 "5초 간격"이 정확히 5초마다 시작하는 뜻이라면 바꿔야 하는데, 확정된 결정의 해석이라 그대로 두었습니다. 보간이 있으므로 지금 방식으로도 화면 차이는 거의 없을 것으로 봅니다.
4. **폴링을 멈춘 격자의 retained 스냅샷.** 구독자가 없어져도 마지막 스냅샷은 브로커에 남아, 나중에 다시 구독하면 오래된 스냅샷을 먼저 받고 곧바로 새 스냅샷을 받습니다. 프론트에서 `fetchedAt`으로 "N초 전" 표시를 하면 문제는 없지만, 지우는 쪽을 원하면 알려 주세요.
5. **상태 토픽이 전역 하나.** 격자마다 결과가 다르면(한 격자는 메인 성공, 다른 격자는 예비 사용) 상태가 오갈 수 있습니다. 기획서대로 `status/source` 하나로 두었습니다.
6. **기획서의 열린 질문은 그대로입니다:** 서비스 이름, 서버 호스팅 위치, 5초 폴링이 adsb.lol 제한 안에서 안정적인지(오늘 1분 동안은 문제 없었음).

## 5. 직접 확인하는 방법

```bash
cd C:\Users\user\Dev\Project\flight-overhead
pnpm install
pnpm test         # 예상: @flight/shared 18 passed, @flight/server 40 passed
pnpm type-check   # 예상: Tasks: 3 successful
```

서버 실행 (터미널 1):

```bash
pnpm --filter @flight/server dev
```

예상 로그: `서버 시작: http://localhost:4000/health, MQTT ws://localhost:4000/mqtt`

헬스 체크:

```bash
curl http://localhost:4000/health
```

예상: `{"status":"ok","activeGrids":0,"source":"ok"}` (구독자가 있으면 `activeGrids`가 1 이상)

구독 스크립트 (터미널 2, 60초 뒤 자동 종료, 실제 API를 부르므로 반복 실행 금지):

```bash
pnpm --filter @flight/server sub
```

예상: `구독: flights/37.5/127.1(qos 0), status/source(qos 0)` → `상태: ok` → 약 6초마다 `스냅샷 #N: N대, 소스 adsb.lol, ...`. 종료되면 서버 로그에 `폴링 중지 flights/37.5/127.1`.

프론트엔드:

```bash
pnpm --filter @flight/web dev
```

예상: `http://localhost:5173`에 "내 머리 위 비행기 · 준비 중 (flights/37.5/127.1, 0대)" 한 줄.

## 6. 실제 API 확인 결과

- 시각: 2026-11-08 03:22:56 ~ 03:23:56 (KST), 1회만 실행
- 구독: `flights/37.5/127.1`, `status/source` (둘 다 qos 0으로 승인)
- 상태 토픽: `ok` (예비 전환 없음)
- 받은 스냅샷: 60초 동안 10개, 모두 소스 `adsb.lol`, **비행기 0대** (새벽 시간대)
- 응답 시간: 약 1.2초 (첫 조회 기준), 갱신 간격 약 6.2초
- `/health`: 구독 중 `activeGrids: 1`, 구독 종료 후 `activeGrids: 0` (폴링 중지 확인)
- 오류, 차단, 429 응답 없음

## 7. 프론트엔드 작업을 시작할 때 알아야 할 것

**연결 주소**

- 개발: `ws://localhost:4000/mqtt` (Express와 같은 포트, 경로 `/mqtt`)
- 배포 후에는 HTTPS 페이지에서 `wss://<서버 주소>/mqtt`가 필요합니다. `VITE_MQTT_URL` 같은 환경 변수로 빼는 것을 추천합니다(아직 만들지 않음).

**토픽**

- `flights/{lat}/{lon}`: `snapshotTopic(lat, lon)`으로 만드세요. 직접 문자열을 만들면 `37.50`처럼 형식이 달라져 거절될 수 있습니다.
- `status/source`: `STATUS_TOPIC` 상수. 값은 문자열 `ok` / `fallback` / `degraded`.
- 두 토픽 모두 retained라 구독 즉시 마지막 값이 옵니다.
- 위치가 바뀌어 격자가 달라지면 이전 격자 토픽을 `unsubscribe`하고 새 토픽을 구독하세요 (서버는 구독자가 없는 격자의 폴링을 멈춤).
- 허용되지 않은 토픽을 구독하면 mqtt.js 5의 `subscribeAsync`가 에러를 던집니다 (SUBACK 128). 연결은 유지됩니다.
- 클라이언트에서 `publish`하면 서버가 연결을 끊습니다. Will 메시지도 설정하지 마세요.

**shared에서 import할 것** (`import { ... } from '@flight/shared'`)

| 이름 | 용도 |
| --- | --- |
| `Aircraft`, `Snapshot`, `SourceStatus`, `SourceName` | 타입 |
| `toGrid(lat, lon)` | 정확한 위치 → 0.1도 격자. 이 값만 서버로 보냄 |
| `snapshotTopic(lat, lon)` | 격자 → 토픽 이름 |
| `parseSnapshotTopic(topic)` | 토픽 → 격자, 틀리면 null |
| `STATUS_TOPIC` | `'status/source'` |

**데이터 관련**

- 서버는 반경 15해리(약 28km)로 조회하므로, 20km 필터와 가장 가까운 비행기 계산은 클라이언트에서 해야 합니다 (기획서 "클라이언트 처리").
- 지상 기체는 서버에서 이미 빠져 있습니다. `altFt`, `speedKt`, `trackDeg`, `callsign`은 없을 수 있습니다.
- `seenAt`은 위치를 받은 시각, `fetchedAt`은 서버가 조회한 시각(ms)입니다. "데이터 N초 전" 표시는 `fetchedAt` 기준이 맞습니다.
- 메시지 payload는 `Uint8Array`이므로 `JSON.parse(new TextDecoder().decode(payload))`로 읽으면 됩니다.
