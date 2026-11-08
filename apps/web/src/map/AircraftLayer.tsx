import type { Aircraft } from '@flight/shared';
import L from 'leaflet';
import { useRef, useEffect } from 'react';
import { useMap } from 'react-leaflet';
import { createAircraftIcon, setRotation } from './aircraftIcon';

export function AircraftLayer({
  aircraft,
  onSelect,
}: {
  aircraft: Aircraft[];
  onSelect: (hex: string) => void;
}) {
  const map = useMap();
  const markers = useRef(new Map<string, L.Marker>());
  const onSelectRef = useRef(onSelect);
  onSelectRef.current = onSelect; // 클릭 핸들러가 항상 최신 함수를 쓰게

  useEffect(() => {
    const seen = new Set<string>();
    for (const a of aircraft) {
      seen.add(a.hex);
      let marker = markers.current.get(a.hex);
      if (!marker) {
        marker = L.marker([a.lat, a.lon], {
          icon: createAircraftIcon(a.callsign),
        }).addTo(map);
        marker.on('click', () => onSelectRef.current(a.hex));
        markers.current.set(a.hex, marker);
      } else {
        marker.setLatLng([a.lat, a.lon]);
      }
      setRotation(marker, a.trackDeg);
    }
    // 목록에서 사라진 비행기 마커 제거
    for (const [hex, marker] of markers.current) {
      if (!seen.has(hex)) {
        marker.remove();
        markers.current.delete(hex);
      }
    }
  }, [aircraft, map]);

  // 언마운트 시 정리. 개발 모드의 StrictMode는 effect를 두 번 실행하므로 이 정리가 꼭 필요
  useEffect(
    () => () => {
      markers.current.forEach((m) => m.remove());
      markers.current.clear();
    },
    []
  );

  return null;
}
