// MQTT 브로커 주소. 배포(HTTPS)에서는 브라우저가 ws://를 막기 때문에
// Vercel 환경 변수 VITE_MQTT_URL에 wss://<서버>/mqtt를 넣어야 함.
// Vite는 빌드할 때 이 값을 코드에 넣으므로, 값을 바꾸면 다시 배포해야 함.
export const MQTT_URL: string =
  import.meta.env.VITE_MQTT_URL?.trim() || 'ws://localhost:4000/mqtt';

// 위치 권한이 없거나 위치를 못 얻었을 때 쓰는 기본 위치.
// 인천공항은 낮에도 밤에도 비행기가 가장 많이 지나는 곳이라,
// 권한을 거절한 사람도 빈 지도가 아니라 움직이는 비행기를 보게 됨
export const DEFAULT_LOCATION = {
  lat: 37.4602,
  lon: 126.4407,
  label: '인천공항',
} as const;
