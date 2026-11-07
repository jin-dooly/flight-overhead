# 내 머리 위 비행기 (flight-overhead)

내 위치 상공(반경 20km)을 지나는 비행기를 지도 위에 실시간으로 보여주는 웹 서비스입니다. 기획 의도와 범위는 [`docs/PLAN.md`](docs/PLAN.md)에 있습니다.

> 현재 상태: 서버 완성, 프론트엔드는 기본 세팅만 되어 있습니다.

## 구조

```
apps/server     Express + Aedes 1.2.0(내장 MQTT 브로커) + ws
apps/web        Vite + React + TypeScript (지도는 react-leaflet)
packages/shared 공통 타입(Aircraft, Snapshot), 토픽 이름, 격자 함수
```

서버가 공개 ADS-B API(메인 adsb.lol, 예비 adsb.fi)를 격자별로 5초마다 조회하고, 그 격자를 구독한 브라우저들에게 MQTT over WebSocket으로 한 번에 발행합니다. 브라우저는 위치를 0.1도 격자로 반올림한 토픽만 구독하므로 정확한 위치는 서버에도 외부 API에도 전달되지 않습니다.

| 토픽 | 내용 |
| --- | --- |
| `flights/{lat}/{lon}` (예: `flights/37.5/127.1`) | 격자의 `Snapshot` JSON, retained |
| `status/source` | `ok` / `fallback` / `degraded`, retained |

- 구독자가 있는 격자만 폴링하고, 마지막 구독자가 떠나면 멈춥니다.
- adsb.lol이 실패하면 같은 요청을 adsb.fi로 재시도하고, 둘 다 실패하면 간격을 10초, 20초, 40초, 60초로 늘립니다.
- 브라우저 연결은 구독만 할 수 있고, 발행하면 연결이 끊깁니다.

## 실행

Node 20.12 이상, pnpm 10이 필요합니다.

```bash
pnpm install
pnpm test          # 전체 단위 테스트 (외부 API는 모두 모킹)
pnpm type-check    # 전체 타입 체크
```

서버 (`http://localhost:4000/health`, MQTT는 `ws://localhost:4000/mqtt`):

```bash
pnpm --filter @flight/server dev
```

동작 확인용 구독 스크립트 (서버를 띄운 상태에서, 60초 뒤 종료. 실제 API를 호출하므로 반복 실행하지 마세요):

```bash
pnpm --filter @flight/server sub
```

프론트엔드 (`http://localhost:5173`):

```bash
pnpm --filter @flight/web dev
```

환경 변수는 [`apps/server/.env.example`](apps/server/.env.example)을 참고하세요. `apps/server/.env`를 만들면 서버 시작 시 읽습니다.

## 데이터 출처

- 지도: © OpenStreetMap contributors
- 비행기 위치: [adsb.lol](https://adsb.lol), [adsb.fi](https://adsb.fi) (비상업 용도)
