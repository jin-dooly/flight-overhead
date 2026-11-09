import { useEffect } from 'react';
import { Polyline, useMap } from 'react-leaflet';
import { useFollowStore } from '../../store/follow';

/** 따라가는 동안 멀리까지 볼 수 있게 푸는 최소 줌. 평소에는 "반경 30km가 보일 때까지"로 묶여 있음 */
const FOLLOW_MIN_ZOOM = 5;

/**
 * 따라가기 중 지도 조작 방식 (기획서 따라가기 설계: 지도 끌기를 끄고, 확대·축소는 비행기 중심으로만).
 * 지도 중심은 AircraftLayer가 매 프레임 비행기 위치로 옮기므로, 사용자가 끌면 서로 싸우게 됨.
 * 그래서 끌기를 끄고, 휠·두 손가락·더블클릭 확대를 손가락 위치가 아니라 화면 가운데 기준으로 바꿈.
 * 컴포넌트가 사라지면(따라가기 끝) 원래대로 되돌림
 */
export const FollowMapMode = () => {
  const map = useMap();

  useEffect(() => {
    const prevMinZoom = map.getMinZoom();
    map.dragging.disable();
    map.keyboard.disable();
    map.setMinZoom(FOLLOW_MIN_ZOOM);
    setZoomAround(map, 'center');
    return () => {
      map.dragging.enable();
      map.keyboard.enable();
      setZoomAround(map, true);
      map.setMinZoom(prevMinZoom);
    };
  }, [map]);

  return null;
};

/** Leaflet은 확대 기준을 옵션으로 읽으므로, 옵션을 바꾼 뒤 핸들러를 껐다 켜야 반영됨 */
const setZoomAround = (map: ReturnType<typeof useMap>, around: boolean | 'center') => {
  for (const name of ['scrollWheelZoom', 'touchZoom', 'doubleClickZoom'] as const) {
    (map.options as Record<string, unknown>)[name] = around;
    const handler = map[name];
    handler.disable();
    handler.enable();
  }
};

/** 따라가는 동안 지나온 경로 (목업: 파란 점선) */
export const FollowTrail = () => {
  const trail = useFollowStore((s) => s.trail);
  if (trail.length < 2) return null;
  return (
    <Polyline
      positions={trail.map((p) => [p.lat, p.lon] as [number, number])}
      interactive={false}
      pathOptions={{
        color: '#1A54E6',
        weight: 3,
        opacity: 0.7,
        dashArray: '1 7',
        lineCap: 'round',
      }}
    />
  );
};
