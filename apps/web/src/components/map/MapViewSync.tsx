import { useEffect } from 'react';
import { useMap } from 'react-leaflet';
import { MAX_VIEW_RADIUS_KM } from '../../config';
import { boundsAround } from '../../lib/geo/distance';
import { useLocationStore } from '../../store/location';
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
    map.flyTo(visibleCenter(map, lat, lon, zoom), zoom, { duration: 2 });
  }, [map, lat, lon, status, paused]);

  return null;
};

/**
 * 반경 30km(서버가 받아 오는 범위)가 화면에 다 들어갈 때까지만 축소할 수 있게 최소 줌을 정함.
 * 그보다 더 축소하면 데이터가 없는 빈 지도만 넓어지기 때문 (기획서 결정 기록 2026-11-08).
 * 화면 크기에 따라 필요한 줌이 달라서(폰 세로 약 9, 데스크톱 약 10) 고정값 대신 계산하고,
 * 창 크기가 바뀌면 다시 계산함
 */
export const ZoomLimit = () => {
  const map = useMap();
  const lat = useLocationStore((s) => s.lat);
  const lon = useLocationStore((s) => s.lon);

  useEffect(() => {
    const update = () => {
      const zoom = map.getBoundsZoom(
        boundsAround({ lat, lon }, MAX_VIEW_RADIUS_KM)
      );
      map.setMinZoom(zoom);
    };
    update();
    map.on('resize', update);
    return () => {
      map.off('resize', update);
    };
  }, [map, lat, lon]);

  return null;
};
