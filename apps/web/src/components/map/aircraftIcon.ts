import L from 'leaflet';

// 목업 스타일 가이드의 비행기 실루엣. 위(북쪽)를 보고 있어서 진행 방향 각도를 그대로 회전에 씀
const PLANE_SVG =
  '<svg width="28" height="28" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2c.8 0 1.3.7 1.3 1.6V9l7.7 4.6v2l-7.7-2.3v4.9l2.2 1.7V21L12 20.2 8.5 21v-1.1l2.2-1.7v-4.9L3 15.6v-2L10.7 9V3.6C10.7 2.7 11.2 2 12 2z" fill="currentColor" stroke="#FFFFFF" stroke-width="1.2" stroke-linejoin="round"/></svg>';

/**
 * 마커 모양을 DOM으로 직접 만듦. Leaflet의 divIcon은 React 요소가 아니라 HTML 요소를 받음.
 * 모양(색, 강조 원, 흐림)은 index.css의 `.aircraft-marker` 클래스들이 정함
 */
export function createAircraftIcon(callsign?: string) {
  const root = document.createElement('div');
  const ring = document.createElement('div');
  ring.className = 'aircraft-ring';
  const rotor = document.createElement('div');
  rotor.className = 'aircraft-rotor';
  rotor.innerHTML = PLANE_SVG; // 고정 문자열이라 안전
  const label = document.createElement('span');
  label.className = 'aircraft-label';
  label.textContent = callsign ?? ''; // 외부 데이터라 innerHTML이 아니라 textContent
  root.append(ring, rotor, label);
  return L.divIcon({
    html: root,
    className: 'aircraft-marker',
    iconSize: [28, 28],
    iconAnchor: [14, 14], // 비행기 중심이 실제 좌표에 오게
  });
}

const query = (marker: L.Marker, selector: string) =>
  marker.getElement()?.querySelector<HTMLElement>(selector) ?? null;

/** 편명이 나중에 생기거나 바뀌면 라벨만 고침. 아이콘을 새로 만들면 DOM이 바뀌어 회전 상태가 사라지므로 */
export function setCallsign(marker: L.Marker, callsign?: string) {
  const label = query(marker, '.aircraft-label');
  if (label) label.textContent = callsign ?? '';
}

export function setRotation(marker: L.Marker, trackDeg?: number) {
  const rotor = query(marker, '.aircraft-rotor');
  if (rotor) rotor.style.transform = `rotate(${trackDeg ?? 0}deg)`;
}

/** 강조(`is-highlighted`), 흐림(`is-stale`), 반경 밖(`is-outside`) 같은 상태 클래스를 켜고 끔 */
export function setMarkerClass(marker: L.Marker, name: string, on: boolean) {
  marker.getElement()?.classList.toggle(name, on);
}
