# 내 머리 위 비행기 (flight-overhead)

내 위치 상공(반경 20km)을 지나는 비행기를 지도 위에 실시간으로 보여주는 웹 서비스입니다. 기획 의도와 범위는 [`docs/PLAN.md`](docs/PLAN.md)에 있습니다.

- 서비스: https://flight-overhead.vercel.app
- 서버: https://flight-overhead.onrender.com/health (Render 무료 플랜이라 한동안 접속이 없으면 잠들어, 첫 접속은 1분 가까이 걸릴 수 있습니다)

## 기능

- 반경 20km 안 비행기를 진행 방향으로 회전한 아이콘과 편명으로 표시하고, 약 6초마다 실시간 갱신
- 갱신 사이에도 속도와 방향으로 위치를 예측해 매 프레임 부드럽게 이동 (새 데이터가 오면 1초 동안 새 경로로 합류)
- 하단 카드: 선택한 비행기(선택 전에는 가장 가까운 비행기)의 편명, 고도, 속도, 방향, 나와의 거리
- 처음 들어오면 내 위치를 요청하고, 권한이 없으면 인천공항 기준으로 보여 줌
- 상태 표시: 실시간 / 연결 중 / 재연결 중(마지막 위치를 흐리게) / 데이터 지연("N초 전 기준")
- 반경 안에 비행기가 없으면 가장 가까운 비행기까지의 거리와 "반경 30km까지 넓히기"
- 데이터 소스 장애 시 adsb.lol → adsb.fi 자동 전환

## 핵심 구현

| 주제 | 어디 | 한 줄 설명 |
| --- | --- | --- |
| 지역 통째 조회 | `apps/server/src/sources/regional.ts` | 한반도를 한 번 조회해 0.1도 격자 토픽마다 나눠 발행. 외부 요청 수가 사용자 수와 상관없음 |
| 예비 전환과 백오프 | `apps/server/src/sources`, `backoff.ts` | 메인 실패 시 예비 소스, 둘 다 실패하면 5→10→20→40→60초 |
| 보간 애니메이션 | `apps/web/src/lib/geo/interpolate.ts`, `components/map/AircraftLayer.tsx` | React state를 거치지 않고 `requestAnimationFrame`에서 Leaflet 마커를 직접 이동 |
| 시계 보정 | `apps/web/src/lib/mqtt.ts` | 스냅샷을 받을 때 "내 시계 - 서버 시계"를 기억해, 기기 시계가 틀려도 예측 위치가 어긋나지 않음 |
| 개인정보 | `apps/web/src/hooks/useGridSubscription.ts` | 정확한 위치는 브라우저 안에서만 쓰고, 서버에는 격자 토픽만 보냄 |

## 구조

```
apps/server     Express + Aedes 1.2.0(내장 MQTT 브로커) + ws
apps/web        Vite + React + TypeScript (지도는 react-leaflet, 상태는 zustand)
packages/shared 공통 타입(Aircraft, Snapshot), 토픽 이름, 격자 함수
```

서버가 공개 ADS-B API(메인 adsb.lol, 예비 adsb.fi)로 한반도 전체를 5초마다 한 번 조회하고, 격자별로 나눠 그 격자를 구독한 브라우저들에게 MQTT over WebSocket으로 발행합니다. 따라가기 기체는 5초마다 기체 ID로 조회합니다. 브라우저는 위치를 0.1도 격자로 반올림한 토픽만 구독하므로 정확한 위치는 서버에도 외부 API에도 전달되지 않습니다.

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
