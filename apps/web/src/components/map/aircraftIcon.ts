import L from 'leaflet';

export function createAircraftIcon(callsign?: string) {
  const root = document.createElement('div');
  const rotor = document.createElement('div');
  rotor.className = 'aircraft-rotor';
  rotor.innerHTML =
    '<svg viewBox="0 0 24 24" width="24" height="24"><path d="M12 2l3 8 7 3v2l-7-1-1 5 3 2v1l-5-1-5 1v-1l3-2-1-5-7 1v-2l7-3z" fill="currentColor"/></svg>';
  const label = document.createElement('span');
  label.className = 'aircraft-label';
  label.textContent = callsign ?? ''; // innerHTML이 아니라 textContent
  root.append(rotor, label);
  return L.divIcon({
    html: root,
    className: 'aircraft-marker',
    iconSize: [24, 24],
    iconAnchor: [12, 12],
  });
}

/** 편명이 나중에 생기거나 바뀌면 라벨만 고침. 아이콘을 새로 만들면 DOM이 바뀌어 회전 상태가 사라지므로 */
export function setCallsign(marker: L.Marker, callsign?: string) {
  const label = marker
    .getElement()
    ?.querySelector<HTMLElement>('.aircraft-label');
  if (label) label.textContent = callsign ?? '';
}

export function setRotation(marker: L.Marker, trackDeg?: number) {
  const rotor = marker
    .getElement()
    ?.querySelector<HTMLElement>('.aircraft-rotor');
  if (rotor) rotor.style.transform = `rotate(${trackDeg ?? 0}deg)`;
}
