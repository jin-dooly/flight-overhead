import 'leaflet/dist/leaflet.css';
import type { Map as LeafletMap } from 'leaflet';
import { useEffect, useRef, type RefObject } from 'react';
import {
  Circle,
  CircleMarker,
  MapContainer,
  TileLayer,
  useMap,
} from 'react-leaflet';
import { DEFAULT_LOCATION } from '../config';
import { AircraftLayer } from '../map/AircraftLayer';
import { MOCK_AIRCRAFT } from '../mock/aircraft';
import { useLocationStore } from '../store/location';

const MAP_ZOOM = 10;

export const MapPage = ({ onOpenSky }: { onOpenSky: () => void }) => {
  const status = useLocationStore((s) => s.status);
  const requestLocation = useLocationStore((s) => s.requestLocation);
  // MapContainer의 center는 처음 한 번만 쓰임. 이후 이동은 LocationSync가 맡음
  const initialCenter = useLocationStore.getState();
  const mapRef = useRef<LeafletMap | null>(null);

  return (
    <div style={{ position: 'relative', height: '100dvh' }}>
      <MapContainer
        ref={mapRef}
        center={[initialCenter.lat, initialCenter.lon]}
        zoom={MAP_ZOOM}
        style={{ height: '100%' }}
      >
        <TileLayer
          url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
          attribution="&copy; OpenStreetMap contributors · 데이터 adsb.lol / adsb.fi"
        />
        <LocationSync />
        <MyLocationLayer />
        <AircraftLayer aircraft={MOCK_AIRCRAFT} onSelect={() => {}} />
      </MapContainer>

      {/* 지도 위 버튼은 MapContainer 밖에 둠. 안에 두면 버튼 클릭이 지도 끌기, 더블클릭 확대로 새어 나감 */}
      <LocateButton mapRef={mapRef} />

      {/* 임시 안내와 버튼. 디자인 목업(01, 04)대로 꾸밀 때 위치와 스타일을 바꿈 */}
      {status === 'pending' && (
        <div role="status" style={overlayStyle}>
          내 위치를 확인하는 중이에요
        </div>
      )}
      {(status === 'denied' || status === 'unavailable') && (
        <div role="status" style={overlayStyle}>
          <strong>기본 위치로 보는 중</strong>
          <span>
            {status === 'denied'
              ? `위치 권한이 없어서 ${DEFAULT_LOCATION.label} 기준으로 보여 드려요.`
              : `위치를 찾지 못해서 ${DEFAULT_LOCATION.label} 기준으로 보여 드려요.`}
          </span>
          {status === 'denied' && (
            <span style={{ fontSize: 12 }}>
              다시 시도해도 안 되면 주소창 왼쪽의 아이콘에서 위치를 허용해 주세요.
            </span>
          )}
          <button
            type="button"
            onClick={requestLocation}
            style={{ height: 44, padding: '0 14px', alignSelf: 'flex-start' }}
          >
            다시 시도
          </button>
        </div>
      )}

      <button
        type="button"
        onClick={onOpenSky}
        style={{
          position: 'absolute',
          left: 12,
          bottom: 24,
          zIndex: 1000, // Leaflet 지도 패널(z-index 400대)보다 위에 보이게
          height: 44,
          padding: '0 16px',
        }}
      >
        하늘 모드로 보기
      </button>
    </div>
  );
};

const overlayStyle = {
  position: 'absolute',
  left: 12,
  right: 12,
  top: 12,
  zIndex: 1000,
  padding: 12,
  borderRadius: 12,
  background: '#FFF6E5',
  color: '#6B4100',
  display: 'flex',
  flexDirection: 'column',
  gap: 4,
} as const;

/**
 * 스토어의 위치가 바뀌면 지도를 날아가듯 옮김. 처음 내 위치를 얻었을 때도 인천공항에서
 * 내 위치로 이동하는 모습을 보여 줌.
 * flyTo는 거리가 멀수록 오래 걸리므로(인천→부산 약 4초), 최대 2초로 맞춤.
 * 하늘 모드에서 돌아와 다시 마운트될 때는 지도가 이미 그 위치에서 시작해서 움직이지 않음.
 */
const LocationSync = () => {
  const map = useMap();
  const lat = useLocationStore((s) => s.lat);
  const lon = useLocationStore((s) => s.lon);
  const status = useLocationStore((s) => s.status);

  useEffect(() => {
    if (status === 'pending') return;
    map.flyTo([lat, lon], map.getZoom(), { duration: 2 });
  }, [map, lat, lon, status]);

  return null;
};

/** 내 위치가 있으면 지도를 그리로 옮기고, 없으면 권한을 다시 요청함 */
const LocateButton = ({
  mapRef,
}: {
  mapRef: RefObject<LeafletMap | null>;
}) => {
  const onClick = () => {
    const { status, lat, lon, requestLocation } = useLocationStore.getState();
    if (status === 'granted') mapRef.current?.flyTo([lat, lon], MAP_ZOOM);
    requestLocation(); // 그 사이 이동했을 수 있으니 위치도 다시 확인
  };

  return (
    <button
      type="button"
      aria-label="내 위치로 보기"
      onClick={onClick}
      style={{
        position: 'absolute',
        right: 12,
        bottom: 24,
        zIndex: 1000,
        width: 48,
        height: 48,
        borderRadius: '50%',
      }}
    >
      ◎
    </button>
  );
};

// 위치를 기다리는 동안에는 반경 원과 내 위치 점을 숨김(기본 위치를 내 위치처럼 보이지 않게).
// 기본 위치일 때는 반경 원만 보여 주고, 내 위치 점은 숨김
const MyLocationLayer = () => {
  const status = useLocationStore((s) => s.status);
  const lat = useLocationStore((s) => s.lat);
  const lon = useLocationStore((s) => s.lon);
  if (status === 'pending') return null;
  const center: [number, number] = [lat, lon];

  return (
    <>
      <Circle
        center={center}
        radius={20_000}
        interactive={false}
        pathOptions={{ weight: 1, fillOpacity: 0.03 }}
      />
      <Circle
        center={center}
        radius={10_000}
        interactive={false}
        pathOptions={{ weight: 1, fillOpacity: 0.05 }}
      />
      {status === 'granted' && (
        <CircleMarker
          center={center}
          radius={6}
          pathOptions={{ fillOpacity: 1 }}
        />
      )}
    </>
  );
};
