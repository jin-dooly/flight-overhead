/** 배포된 서버의 MQTT 주소 */
const DEPLOYED_MQTT_URL = 'wss://flight-overhead.onrender.com/mqtt';

/**
 * MQTT 브로커 주소. Vercel 환경 변수 VITE_MQTT_URL이 있으면 그 값.
 * Vite는 빌드할 때 이 값을 코드에 넣으므로, 값을 바꾸면 다시 배포해야 함.
 *
 * 값이 없을 때:
 * - HTTPS 페이지(배포, Vercel 미리보기)는 배포된 서버로 붙음. 미리보기 환경에 변수를 안 넣으면
 *   폰에서 ws://localhost로 붙으려다 막혀서 화면이 안 떴음(2026-11-09 사용자 제보)
 * - 그 밖(로컬 개발)은 로컬 서버
 */
export const MQTT_URL: string =
  import.meta.env.VITE_MQTT_URL?.trim() ||
  (typeof window !== 'undefined' && window.location.protocol === 'https:'
    ? DEPLOYED_MQTT_URL
    : 'ws://localhost:4000/mqtt');

// 지도에 보여 주는 반경(km). 기획서의 "내 위치 상공 20km". 바깥 원(20km)과 안쪽 원(10km)도 이 값을 씀.
// 서버는 격자 중심에서 17해리(약 31km)를 받아 오므로, 격자 안 어디에 있어도 20km 안 비행기는 다 들어 있음
export const RADIUS_KM = 20;

// 비행기가 없을 때 "반경 넓히기"로 넓히는 반경이자, 지도를 축소할 수 있는 한계(이 반경이 다 보일 때까지)
export const MAX_VIEW_RADIUS_KM = 30;

// 위치 권한이 없거나 위치를 못 얻었을 때 쓰는 기본 위치.
// 인천공항은 낮에도 밤에도 비행기가 가장 많이 지나는 곳이라,
// 권한을 거절한 사람도 빈 지도가 아니라 움직이는 비행기를 보게 됨
export const DEFAULT_LOCATION = {
  lat: 37.4602,
  lon: 126.4407,
  label: '인천공항',
} as const;
