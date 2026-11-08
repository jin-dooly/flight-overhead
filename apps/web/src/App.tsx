import { useEffect } from 'react';
import { useMode } from './hooks/useMode';
import { MapPage } from './pages/MapPage';
import { SkyPage } from './pages/SkyPage';
import { useLocationStore } from './store/location';

// App은 어떤 모드를 보여 줄지만 정함. 지도는 MapPage 안에만 있어서
// 하늘 모드에서는 지도가 아예 그려지지 않음.
// 두 모드가 같이 쓰는 위치(그리고 나중에 MQTT 연결)는 스토어에 둠.
function App() {
  const [mode, setMode] = useMode();
  const requestLocation = useLocationStore((s) => s.requestLocation);

  // "내 머리 위"가 핵심이라 처음 들어오자마자 내 위치를 요청함
  useEffect(() => {
    requestLocation();
  }, [requestLocation]);

  return (
    <main>
      {mode === 'sky' ? (
        <SkyPage onBack={() => window.history.back()} />
      ) : (
        <MapPage onOpenSky={() => setMode('sky')} />
      )}
    </main>
  );
}

export default App;
