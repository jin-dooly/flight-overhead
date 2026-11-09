import { lazy, Suspense, useEffect } from 'react';
import { useFollowSubscription } from './hooks/useFollowSubscription';
import { useGridSubscription } from './hooks/useGridSubscription';
import { goBackOr, useMode } from './hooks/useMode';
import { MapPage } from './pages/MapPage';
import { useLocationStore } from './store/location';

// 하늘 모드는 들어갈 때 따로 받아 옴(코드 분할). 처음 지도 화면에는 필요 없어서 첫 화면에 받는 JS를 줄이려고 나눔
const SkyPage = lazy(() => import('./pages/SkyPage').then((m) => ({ default: m.SkyPage })));

/** 첫 화면이 다 뜬 뒤 이만큼 지나서, 나눠 둔 화면(하늘 모드, 따라가기)을 미리 받아 둠 */
const PREFETCH_DELAY_MS = 3_000;

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

  // 나눠 둔 화면을 미리 받아 둠. 첫 화면을 받는 데는 끼어들지 않으면서, 나중에 버튼을 누르면 기다림 없이 뜨게.
  // 같은 import()를 다시 부르면 브라우저가 이미 받은 파일을 다시 씀
  useEffect(() => {
    const timer = setTimeout(() => {
      void import('./pages/SkyPage');
      void import('./components/follow/FollowOverlay');
      void import('./components/map/FollowMapMode');
    }, PREFETCH_DELAY_MS);
    return () => clearTimeout(timer);
  }, []);

  // 위치 격자를 구독함. 모드와 상관없이 App에서 부르므로 하늘 모드에서도 데이터가 계속 들어옴
  useGridSubscription();
  // 따라가는 기체 토픽도 App에서 구독해서, 하늘 모드에 다녀와도 따라가기가 이어지게 함
  useFollowSubscription();

  return (
    <main>
      {mode === 'sky' ? (
        <Suspense fallback={<div className="sky-loading">하늘 모드를 여는 중이에요</div>}>
          <SkyPage onBack={() => goBackOr(() => setMode('map'))} />
        </Suspense>
      ) : (
        <MapPage onOpenSky={() => setMode('sky')} />
      )}
    </main>
  );
}

export default App;
