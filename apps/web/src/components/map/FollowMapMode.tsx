import L from 'leaflet';
import { useEffect, type RefObject } from 'react';
import { Polyline, useMap } from 'react-leaflet';
import type { LatLon } from '../../lib/geo/distance';
import { useFollowStore } from '../../store/follow';

/**
 * 따라가기 중 지도 조작 방식 (기획서 따라가기 설계: 지도 끌기를 끄고, 확대·축소는 비행기 중심으로만).
 * 지도 중심은 AircraftLayer가 매 프레임 비행기 위치로 옮기므로, 사용자가 끌면 서로 싸우게 됨.
 * 그래서 끌기를 끄고, 휠·두 손가락·더블클릭 확대를 손가락 위치가 아니라 화면 가운데 기준으로 바꿈.
 * 컴포넌트가 사라지면(따라가기 끝) 원래대로 되돌림
 */
export const FollowMapMode = () => {
  const map = useMap();

  useEffect(() => {
    map.dragging.disable();
    map.keyboard.disable();
    setZoomAround(map, 'center');
    return () => {
      map.dragging.enable();
      map.keyboard.enable();
      setZoomAround(map, true);
    };
  }, [map]);

  return null;
};

/** Leaflet은 확대 기준을 옵션으로 읽으므로, 옵션을 바꾼 뒤 핸들러를 껐다 켜야 반영됨 */
const setZoomAround = (
  map: ReturnType<typeof useMap>,
  around: boolean | 'center'
) => {
  for (const name of [
    'scrollWheelZoom',
    'touchZoom',
    'doubleClickZoom',
  ] as const) {
    (map.options as Record<string, unknown>)[name] = around;
    const handler = map[name];
    handler.disable();
    handler.enable();
  }
};

/** 예측 꼬리를 비행기 위치까지 잇는 함수. AircraftLayer가 매 프레임 부름 */
export type TailUpdater = (pos: LatLon) => void;

const DOTS = {
  weight: 3,
  dashArray: '1 7',
  lineCap: 'round' as const,
  interactive: false,
};

/**
 * 따라가는 동안 지나온 경로 (목업: 점선).
 * - 파란 점선: 서버에서 실제로 받은 위치를 이은 것 (확실한 경로)
 * - 흰 점선: 마지막으로 받은 위치에서 지금 비행기(예측 위치)까지. 매 프레임 늘어나고,
 *   서버에서 새 위치가 오면 그 구간까지는 파란 점선으로 바뀜
 * 흰 점선만 있으면 밝은 지도에서 잘 안 보여서, 아래에 연한 파란 테두리를 한 겹 깔았음
 */
export const FollowTrail = ({
  tailRef,
}: {
  tailRef: RefObject<TailUpdater | null>;
}) => {
  const map = useMap();
  const trail = useFollowStore((s) => s.trail);

  // 예측 구간은 매 프레임 바뀌므로 React 밖에서 Leaflet 선을 직접 고침
  useEffect(() => {
    const line = L.polyline([], {
      ...DOTS,
      color: '#FFFFFF',
      opacity: 1,
    }).addTo(map);
    tailRef.current = (pos) => {
      const points = useFollowStore.getState().trail;
      const last = points[points.length - 1];
      if (!last) return;
      const latlngs: [number, number][] = [
        [last.lat, last.lon],
        [pos.lat, pos.lon],
      ];
      line.setLatLngs(latlngs);
    };
    return () => {
      tailRef.current = null;
      line.remove();
    };
  }, [map, tailRef]);

  if (trail.length < 2) return null;
  return (
    <Polyline
      positions={trail.map((p) => [p.lat, p.lon] as [number, number])}
      pathOptions={{ ...DOTS, color: '#1A54E6', opacity: 0.8 }}
    />
  );
};
