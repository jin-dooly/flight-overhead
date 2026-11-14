import { useEffect } from 'react';
import { useMap } from 'react-leaflet';
import { useLocationStore } from '../../store/location';
import { flyToSafe } from './safeFly';
import { visibleCenter } from './visibleCenter';

/**
 * 스토어의 위치가 바뀌면 지도를 날아가듯 옮김. 처음 내 위치를 얻었을 때도 인천공항에서
 * 내 위치로 이동하는 모습을 보여 줌.
 * flyTo는 거리가 멀수록 오래 걸리므로(인천→부산 약 4초), 최대 2초로 맞춤.
 * 하늘 모드에서 돌아와 다시 마운트될 때는 지도가 이미 그 위치에서 시작해서 움직이지 않음.
 */
export const LocationSync = ({ paused = false }: { paused?: boolean }) => {
  const map = useMap();
  const lat = useLocationStore((s) => s.lat);
  const lon = useLocationStore((s) => s.lon);
  const status = useLocationStore((s) => s.status);

  useEffect(() => {
    // 따라가는 동안에는 내 위치가 바뀌어도 지도를 옮기지 않음 (지도 중심은 비행기가 차지)
    if (status === 'pending' || paused) return;
    const zoom = map.getZoom();
    const target = visibleCenter(map, lat, lon, zoom);

    // 안전장치 (사용자 제보 2026-11-09: 크롬에서 내 위치를 받았는데 지도가 기본 위치에 남음).
    // flyTo 애니메이션이 다른 지도 이동에 밀려 중간에 멈추면 목표에 못 간 채로 끝날 수 있음.
    // 애니메이션이 끝나면(moveend) 실제 중심을 확인해서, 목표에서 벗어나 있으면 바로 맞춤.
    // 그 사이 사용자가 지도를 끌었으면 사용자의 이동을 존중해서 그대로 둠
    let userMoved = false;
    const onDragStart = () => {
      userMoved = true;
    };
    const ensureArrived = () => {
      if (userMoved) return;
      if (map.getCenter().distanceTo(target) > 100) map.setView(target, zoom, { animate: false });
    };
    map.on('dragstart', onDragStart);
    flyToSafe(map, target, zoom, { duration: 2 });
    map.once('moveend', ensureArrived);
    // moveend가 오지 않는 경우(애니메이션이 아예 시작되지 않음)를 위해 애니메이션 시간 뒤에도 한 번 확인
    const timer = setTimeout(ensureArrived, 2500);

    return () => {
      clearTimeout(timer);
      map.off('dragstart', onDragStart);
      map.off('moveend', ensureArrived);
    };
  }, [map, lat, lon, status, paused]);

  return null;
};
