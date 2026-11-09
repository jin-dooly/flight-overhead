import { create } from 'zustand';
import { DEFAULT_LOCATION } from '../config';

/**
 * - pending: 위치를 기다리는 중 (권한 창이 떠 있거나 GPS를 찾는 중)
 * - granted: 내 위치를 얻음
 * - denied: 사용자가 권한을 거절함. 브라우저가 다시 묻지 않을 수 있음
 * - unavailable: 권한은 있지만 위치를 못 얻음(시간 초과, 실내 등) 또는 위치 API 미지원
 */
export type LocationStatus = 'pending' | 'granted' | 'denied' | 'unavailable';

type LocationState = {
  status: LocationStatus;
  /** 지도와 구독에 쓰는 위치. 내 위치를 못 얻으면 기본 위치(인천공항) */
  lat: number;
  lon: number;
  /** 내 위치를 요청함. 이미 요청 중이면 아무것도 하지 않음 */
  requestLocation: () => void;
};

// 위치는 지도 모드와 하늘 모드가 같이 쓰므로 페이지 밖(스토어)에 둠.
// 페이지가 다시 마운트돼도 권한 요청이 반복되지 않음.
// 정확한 좌표는 브라우저 안에서만 쓰고, 서버에는 toGrid()로 반올림한 값만 보냄. 로그로도 남기지 않음.
/**
 * 위치 요청이 실패로 끝나도 "확인 중" 상태를 최소 이만큼은 보여 줌.
 * 권한이 꺼져 있으면 브라우저가 묻지도 않고 바로 실패를 돌려줘서, "다시 시도"를 눌러도
 * 아무 일도 없는 것처럼 보였음. 잠깐이라도 확인 중 표시가 지나가야 눌렀다는 게 전달됨
 */
const MIN_PENDING_MS = 800;

export const useLocationStore = create<LocationState>((set, get) => {
  let inFlight = false;

  return {
    status: 'pending',
    lat: DEFAULT_LOCATION.lat,
    lon: DEFAULT_LOCATION.lon,
    requestLocation: () => {
      if (inFlight) return; // StrictMode에서 effect가 두 번 돌아도 요청은 한 번
      if (!('geolocation' in navigator)) {
        set({ status: 'unavailable' });
        return;
      }
      inFlight = true;
      const startedAt = Date.now();
      // 이미 내 위치가 있으면 "다시 찾는 중"으로 바꾸지 않음(화면이 깜빡이지 않게)
      if (get().status !== 'granted') set({ status: 'pending' });
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          inFlight = false;
          set({
            status: 'granted',
            lat: pos.coords.latitude,
            lon: pos.coords.longitude,
          });
        },
        (err) => {
          const status = err.code === err.PERMISSION_DENIED ? 'denied' : 'unavailable';
          const wait = Math.max(0, MIN_PENDING_MS - (Date.now() - startedAt));
          setTimeout(() => {
            inFlight = false;
            // 이전에 얻은 내 위치가 있으면 그대로 두고, 없을 때만 기본 위치로
            if (get().status === 'granted') return;
            set({ status, lat: DEFAULT_LOCATION.lat, lon: DEFAULT_LOCATION.lon });
          }, wait);
        },
        { enableHighAccuracy: false, timeout: 10_000, maximumAge: 60_000 }
      );
    },
  };
});
