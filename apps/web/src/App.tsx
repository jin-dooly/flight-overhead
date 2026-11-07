import { snapshotTopic, toGrid, type Snapshot } from '@flight/shared'

// 기본 위치(송파구)의 격자 토픽. 지도와 구독 로직은 다음 단계에서 구현
const DEFAULT_GRID = toGrid(37.5145, 127.1059)
const DEFAULT_TOPIC = snapshotTopic(DEFAULT_GRID.lat, DEFAULT_GRID.lon)

// shared 타입 import가 타입 체크를 통과하는지 확인하기 위한 빈 스냅샷
const emptySnapshot: Snapshot = { aircraft: [], source: 'adsb.lol', fetchedAt: 0 }

function App() {
  return (
    <main>
      <p>
        내 머리 위 비행기 · 준비 중 ({DEFAULT_TOPIC}, {emptySnapshot.aircraft.length}대)
      </p>
    </main>
  )
}

export default App
