import type { Map as LeafletMap } from 'leaflet';
import type { RefObject } from 'react';
import { useLocationStore } from '../../store/location';
import { visibleCenter } from '../map/visibleCenter';
import { LocateIcon, MinusIcon, PlusIcon } from './icons';

/**
 * 오른쪽 아래 버튼들. 확대·축소 버튼은 데스크톱에서만 보임(폰은 두 손가락으로 확대, CSS에서 숨김).
 * Leaflet 기본 확대 버튼 대신 직접 만든 이유: 목업 모양에 맞추고, 내 위치 버튼과 한 줄로 묶으려고
 */
export const MapControls = ({ mapRef, zoom }: { mapRef: RefObject<LeafletMap | null>; zoom: number }) => {
  const onLocate = () => {
    const { status, lat, lon, requestLocation } = useLocationStore.getState();
    const map = mapRef.current;
    if (status === 'granted' && map) map.flyTo(visibleCenter(map, lat, lon, zoom), zoom);
    requestLocation(); // 그 사이 이동했을 수 있으니 위치도 다시 확인
  };

  return (
    <div className="map-controls">
      <div className="zoom-buttons interactive">
        <button type="button" aria-label="확대" onClick={() => mapRef.current?.zoomIn()}>
          <PlusIcon />
        </button>
        <hr />
        <button type="button" aria-label="축소" onClick={() => mapRef.current?.zoomOut()}>
          <MinusIcon />
        </button>
      </div>
      <button type="button" className="round-button" aria-label="내 위치로 보기" onClick={onLocate}>
        <LocateIcon />
      </button>
    </div>
  );
};

export const Attribution = () => (
  <div className="attribution">
    ©{' '}
    <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">
      OpenStreetMap
    </a>{' '}
    · 데이터 adsb.lol / adsb.fi
  </div>
);
