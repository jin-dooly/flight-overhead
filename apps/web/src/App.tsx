import { useEffect } from 'react';
import { useFollowSubscription } from './hooks/useFollowSubscription';
import { useGridSubscription } from './hooks/useGridSubscription';
import { goBackOr, useMode } from './hooks/useMode';
import { MapPage } from './pages/MapPage';
import { SkyPage } from './pages/SkyPage';
import { useLocationStore } from './store/location';

// App은 어떤 모드를 보여 줄지만 정함. 지도는 MapPage 안에만 있어서
// 하늘 모드에서는 지도가 아예 그려지지 않음.
// 두 모드가 같이 쓰는 위치와 MQTT 데이터는 스토어에 둠.
function App() {
  const [mode, setMode] = useMode();
  const requestLocation = useLocationStore((s) => s.requestLocation);

  // "내 머리 위"가 핵심이라 처음 들어오자마자 내 위치를 요청함
  useEffect(() => {
    requestLocation();
  }, [requestLocation]);

  // 위치 격자를 구독함. 모드와 상관없이 App에서 부르므로 하늘 모드에서도 데이터가 계속 들어옴
  useGridSubscription();
  // 따라가는 기체 토픽도 App에서 구독해서, 하늘 모드에 다녀와도 따라가기가 이어지게 함
  useFollowSubscription();

  return (
    <main>
      {mode === 'sky' ? (
        <SkyPage onBack={() => goBackOr(() => setMode('map'))} />
      ) : (
        <MapPage onOpenSky={() => setMode('sky')} />
      )}
    </main>
  );
}

export default App;
