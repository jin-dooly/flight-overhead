import type { Aircraft } from '@flight/shared';
import L from 'leaflet';
import { useEffect, useRef } from 'react';
import { useMap } from 'react-leaflet';
import type { LatLon } from '../../lib/geo/distance';
import {
  applyCorrection,
  CONVERGE_MS,
  predictPosition,
  startCorrection,
  type Correction,
} from '../../lib/geo/interpolate';
import { useFlightsStore } from '../../store/flights';
import { createAircraftIcon, setCallsign, setRotation } from './aircraftIcon';

/** 마커 하나에 대해 기억하는 것 */
type Entry = {
  marker: L.Marker;
  /** 가장 최근에 받은 데이터. 매 프레임 이걸로 위치를 예측함 */
  aircraft: Aircraft;
  /** 새 데이터가 왔을 때의 위치 차이. 1초 동안 줄여 가다가 끝나면 null */
  correction: Correction | null;
  /** 마지막으로 화면에 그린 위치. 다음 데이터가 오면 여기서부터 수렴을 시작함 */
  shown: LatLon;
};

/** 지금 시각을 서버 시계 기준으로. seenAt이 서버 시각이라 같은 기준으로 맞춤 */
const serverNow = () => Date.now() - useFlightsStore.getState().clockOffsetMs;

/**
 * 비행기 마커를 Leaflet으로 직접 관리함. React 화면에는 아무것도 그리지 않음(return null).
 * - 데이터가 올 때(약 6초마다): 마커 추가/삭제, 수렴 시작
 * - 매 프레임(초당 약 60번): 예측 위치로 마커를 옮김
 * 매 프레임 움직임을 React state로 하면 초당 60번 다시 그리게 되므로, 위치는 React를 거치지 않음
 */
export function AircraftLayer({
  aircraft,
  onSelect,
}: {
  aircraft: Aircraft[];
  onSelect: (hex: string) => void;
}) {
  const map = useMap();
  const entries = useRef(new Map<string, Entry>());
  const onSelectRef = useRef(onSelect);

  // 마커 클릭 핸들러는 마커를 만들 때 한 번만 붙이므로, 클릭 순간에 최신 onSelect를 꺼내 쓰게 함.
  // 렌더링 중에 ref를 바꾸지 않도록 effect 안에서 갱신
  useEffect(() => {
    onSelectRef.current = onSelect;
  });

  // 새 데이터가 오면: 있던 마커는 새 경로로 수렴 시작, 새 비행기는 마커 생성, 사라진 비행기는 제거
  useEffect(() => {
    const now = serverNow();
    const seen = new Set<string>();

    for (const a of aircraft) {
      seen.add(a.hex);
      const predicted = predictPosition(a, now);
      const entry = entries.current.get(a.hex);

      if (entry) {
        // 순간이동 대신, 지금 화면 위치에서 새 예측 위치로 1초 동안 옮겨 감
        entry.correction = startCorrection(entry.shown, predicted, now);
        if (entry.aircraft.callsign !== a.callsign) {
          setCallsign(entry.marker, a.callsign);
        }
        entry.aircraft = a;
        setRotation(entry.marker, a.trackDeg);
        continue;
      }

      const marker = L.marker([predicted.lat, predicted.lon], {
        icon: createAircraftIcon(a.callsign),
      }).addTo(map);
      marker.on('click', () => onSelectRef.current(a.hex));
      setRotation(marker, a.trackDeg);
      entries.current.set(a.hex, {
        marker,
        aircraft: a,
        correction: null,
        shown: predicted,
      });
    }

    for (const [hex, entry] of entries.current) {
      if (!seen.has(hex)) {
        entry.marker.remove();
        entries.current.delete(hex);
      }
    }
  }, [aircraft, map]);

  // 매 프레임 예측 위치로 마커를 옮기는 루프. 컴포넌트가 있는 동안 한 번만 시작함
  useEffect(() => {
    // 확대·축소 애니메이션 중에 위치를 바꾸면 Leaflet이 계산하던 화면 좌표와 어긋나 마커가 튐.
    // 애니메이션이 끝날 때까지 잠깐 멈췄다가 다시 움직임
    let zooming = false;
    const onZoomStart = () => (zooming = true);
    const onZoomEnd = () => (zooming = false);
    map.on('zoomstart', onZoomStart);
    map.on('zoomend', onZoomEnd);

    let frameId = 0;
    const frame = () => {
      if (!zooming) {
        const now = serverNow();
        for (const entry of entries.current.values()) {
          const predicted = predictPosition(entry.aircraft, now);
          const pos = applyCorrection(predicted, entry.correction, now);
          if (entry.correction && now - entry.correction.startedAt >= CONVERGE_MS) {
            entry.correction = null; // 수렴이 끝났으면 더 계산하지 않음
          }
          entry.marker.setLatLng([pos.lat, pos.lon]);
          entry.shown = pos;
        }
      }
      frameId = requestAnimationFrame(frame);
    };
    // requestAnimationFrame은 브라우저가 다음 화면을 그리기 직전에 불러 줌.
    // 탭이 백그라운드면 브라우저가 알아서 멈추므로 배터리를 쓰지 않음
    frameId = requestAnimationFrame(frame);

    return () => {
      cancelAnimationFrame(frameId);
      map.off('zoomstart', onZoomStart);
      map.off('zoomend', onZoomEnd);
    };
  }, [map]);

  // 언마운트 시 마커 정리. 개발 모드의 StrictMode는 effect를 두 번 실행하므로 이 정리가 꼭 필요
  useEffect(() => {
    const current = entries.current;
    return () => {
      current.forEach((e) => e.marker.remove());
      current.clear();
    };
  }, []);

  return null;
}
