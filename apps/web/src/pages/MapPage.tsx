import 'leaflet/dist/leaflet.css';
import '../components/mapUi/mapUi.css';
import type { Map as LeafletMap } from 'leaflet';
import { useEffect, useMemo, useRef, type ReactNode } from 'react';
import { MapContainer, TileLayer } from 'react-leaflet';
import { AircraftLayer } from '../components/map/AircraftLayer';
import { LocationSync, ZoomLimit } from '../components/map/MapViewSync';
import { MyLocationLayer } from '../components/map/MyLocationLayer';
import { AircraftSheet } from '../components/mapUi/AircraftSheet';
import { Attribution, MapControls } from '../components/mapUi/MapControls';
import { StatusBanner } from '../components/mapUi/StatusBanner';
import { TopBar } from '../components/mapUi/TopBar';
import { MAX_VIEW_RADIUS_KM } from '../config';
import { useDataStatus, useNearby } from '../hooks/useMapData';
import { useMediaQuery } from '../hooks/useMediaQuery';
import { boundsAround } from '../lib/geo/distance';
import { useFlightsStore } from '../store/flights';
import { useLocationStore } from '../store/location';

const MAP_ZOOM = 10; // 폰 세로 화면에서 반경 20km 원이 화면 너비에 맞는 정도 (목업 Main)

const selectAircraft = (hex: string) => useFlightsStore.setState({ selectedHex: hex });

export const MapPage = ({
  onOpenSky,
  sheetActions,
}: {
  onOpenSky: () => void;
  /** 카드 버튼 줄에 붙일 추가 버튼 (따라가기) */
  sheetActions?: (hex: string) => ReactNode;
}) => {
  // MapContainer의 center는 처음 한 번만 쓰임. 이후 이동은 LocationSync가 맡음
  const initialCenter = useLocationStore.getState();
  const mapRef = useRef<LeafletMap | null>(null);
  const connection = useFlightsStore((s) => s.connection);
  const nearby = useNearby();
  const isDesktop = useMediaQuery('(min-width: 768px)');

  // 고른 비행기가 반경 밖으로 나가거나 사라지면 선택을 풀어서, 다시 들어와도 갑자기 선택되지 않게 함
  const selectedHex = useFlightsStore((s) => s.selectedHex);
  useEffect(() => {
    if (selectedHex && !nearby.inside.some((r) => r.item.hex === selectedHex)) {
      useFlightsStore.setState({ selectedHex: null });
    }
  }, [selectedHex, nearby.inside]);

  // 반경 안이 비어 있으면 가장 가까운 비행기 하나를 흐리게 같이 그려서 "어디쯤 있는지" 보여 줌 (목업 MapEmpty)
  const shown = useMemo(() => {
    const inside = nearby.inside.map((r) => r.item);
    return inside.length === 0 && nearby.nearestOutside
      ? [nearby.nearestOutside.item]
      : inside;
  }, [nearby.inside, nearby.nearestOutside]);
  const outsideHex =
    nearby.inside.length === 0 ? (nearby.nearestOutside?.item.hex ?? null) : null;

  const onWiden = () => {
    useFlightsStore.setState({ radiusKm: MAX_VIEW_RADIUS_KM });
    const { lat, lon } = useLocationStore.getState();
    mapRef.current?.flyToBounds(boundsAround({ lat, lon }, MAX_VIEW_RADIUS_KM), {
      duration: 1,
    });
  };

  const sheet = (
    <SheetWithStatus
      nearby={nearby}
      onWiden={onWiden}
      onOpenSky={onOpenSky}
      sheetActions={sheetActions}
    />
  );

  return (
    <div className={`map-root${connection === 'reconnecting' ? ' is-offline' : ''}`}>
      <MapContainer
        ref={mapRef}
        center={[initialCenter.lat, initialCenter.lon]}
        zoom={MAP_ZOOM}
        zoomControl={false} // 목업 모양의 버튼을 직접 그림 (MapControls)
        attributionControl={false} // 출처는 카드에 가리지 않는 자리에 직접 표시 (Attribution)
      >
        <TileLayer url="https://tile.openstreetmap.org/{z}/{x}/{y}.png" />
        <LocationSync />
        <ZoomLimit />
        <MyLocationLayer radiusKm={nearby.radiusKm} />
        <AircraftLayer
          aircraft={shown}
          onSelect={selectAircraft}
          highlightHex={nearby.card?.target.item.hex ?? null}
          outsideHex={outsideHex}
        />
      </MapContainer>

      {/* 지도 위 UI는 MapContainer 밖에 둠. 안에 두면 버튼 클릭이 지도 끌기, 더블클릭 확대로 새어 나감 */}
      <div className="map-ui">
        <div className="map-top">
          <TopAndBanner
            count={nearby.hasSnapshot ? nearby.inside.length : null}
            radiusKm={nearby.radiusKm}
          />
          {isDesktop && sheet}
        </div>
        <div className="map-bottom">
          <div className="map-bottom-row">
            <Attribution />
            <MapControls mapRef={mapRef} zoom={MAP_ZOOM} />
          </div>
          {!isDesktop && sheet}
        </div>
      </div>
    </div>
  );
};

// 1초마다 다시 그려지는 부분(상태, "N초 전")을 작은 컴포넌트로 나눠서 지도 전체가 다시 그려지지 않게 함
const TopAndBanner = ({ count, radiusKm }: { count: number | null; radiusKm: number }) => {
  const { status, snapshotAgeMs } = useDataStatus();
  return (
    <>
      <TopBar status={status} count={count} radiusKm={radiusKm} />
      <StatusBanner status={status} snapshotAgeMs={snapshotAgeMs} />
    </>
  );
};

const SheetWithStatus = ({
  nearby,
  onWiden,
  onOpenSky,
  sheetActions,
}: {
  nearby: ReturnType<typeof useNearby>;
  onWiden: () => void;
  onOpenSky: () => void;
  sheetActions?: (hex: string) => ReactNode;
}) => {
  const { status, serverNowMs } = useDataStatus();
  return (
    <AircraftSheet
      status={status}
      serverNowMs={serverNowMs}
      hasSnapshot={nearby.hasSnapshot}
      card={nearby.card}
      nearestOutside={nearby.nearestOutside}
      radiusKm={nearby.radiusKm}
      onWiden={onWiden}
      onOpenSky={onOpenSky}
      extraActions={nearby.card ? sheetActions?.(nearby.card.target.item.hex) : undefined}
    />
  );
};
