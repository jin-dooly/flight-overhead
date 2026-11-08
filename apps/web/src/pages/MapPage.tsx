import 'leaflet/dist/leaflet.css';
import type { Map as LeafletMap } from 'leaflet';
import { useMemo, useRef, type RefObject } from 'react';
import { MapContainer, TileLayer } from 'react-leaflet';
import { AircraftLayer } from '../components/map/AircraftLayer';
import { LocationSync, ZoomLimit } from '../components/map/MapViewSync';
import { MyLocationLayer } from '../components/map/MyLocationLayer';
import { DEFAULT_LOCATION, RADIUS_KM } from '../config';
import { sortByDistance } from '../lib/geo/distance';
import { useFlightsStore } from '../store/flights';
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
        <ZoomLimit />
        <MyLocationLayer radiusKm={RADIUS_KM} />
        <NearbyAircraftLayer />
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

const selectAircraft = (hex: string) =>
  useFlightsStore.setState({ selectedHex: hex });

/**
 * 받은 스냅샷에서 내 위치 기준 반경 20km 안 비행기만 골라 지도에 그림.
 * 서버는 격자 중심 기준 약 31km를 보내 주므로, 내 정확한 위치 기준으로 다시 자름
 * (정확한 위치는 서버에 보내지 않으므로 이 계산은 브라우저에서만 할 수 있음)
 */
const NearbyAircraftLayer = () => {
  const snapshot = useFlightsStore((s) => s.snapshot);
  const lat = useLocationStore((s) => s.lat);
  const lon = useLocationStore((s) => s.lon);

  // 셀렉터 안에서 filter하면 매번 새 배열이 나와 무한히 다시 그리게 되므로,
  // 스냅샷과 위치만 꺼내고 계산은 useMemo에서 함. 둘 중 하나가 바뀔 때만 다시 계산
  const nearby = useMemo(
    () =>
      sortByDistance(snapshot?.aircraft ?? [], { lat, lon })
        .filter((r) => r.distanceKm <= RADIUS_KM)
        .map((r) => r.item),
    [snapshot, lat, lon]
  );

  return <AircraftLayer aircraft={nearby} onSelect={selectAircraft} />;
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
