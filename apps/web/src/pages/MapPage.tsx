import 'leaflet/dist/leaflet.css';
import '../components/mapUi/mapUi.css';
import type { Map as LeafletMap } from 'leaflet';
import { useCallback, useEffect, useMemo, useRef, type ReactNode } from 'react';
import { MapContainer, TileLayer } from 'react-leaflet';
import { FollowButton } from '../components/follow/FollowButton';
import { FollowOverlay } from '../components/follow/FollowOverlay';
import { AircraftLayer } from '../components/map/AircraftLayer';
import { FollowMapMode, FollowTrail, type TailUpdater } from '../components/map/FollowMapMode';
import { LocationSync } from '../components/map/MapViewSync';
import { MyLocationLayer } from '../components/map/MyLocationLayer';
import { AircraftSheet } from '../components/mapUi/AircraftSheet';
import { DraggableBottom } from '../components/mapUi/DraggableBottom';
import { LocationPendingOverlay } from '../components/mapUi/LocationPendingOverlay';
import { Attribution, MapControls } from '../components/mapUi/MapControls';
import { StatusBanner } from '../components/mapUi/StatusBanner';
import { TopBar } from '../components/mapUi/TopBar';
import { MAX_VIEW_RADIUS_KM } from '../config';
import { FOLLOW_LOST_MS } from '../lib/follow';
import { useDataStatus, useNearby } from '../hooks/useMapData';
import { useMediaQuery } from '../hooks/useMediaQuery';
import { boundsAround, type LatLon } from '../lib/geo/distance';
import { visibleCenter } from '../components/map/visibleCenter';
import { useFlightsStore } from '../store/flights';
import { stopFollow, useFollowStore } from '../store/follow';
import { useLocationStore } from '../store/location';

const MAP_ZOOM = 10; // 폰 세로 화면에서 반경 20km 원이 화면 너비에 맞는 정도 (목업 Main)

const selectAircraft = (hex: string) => useFlightsStore.setState({ selectedHex: hex });
const noop = () => {};

// 카드 버튼 줄의 "따라가기" 버튼
const followAction = (hex: string) => <FollowButton hex={hex} />;

export const MapPage = ({
  onOpenSky,
  sheetActions = followAction,
}: {
  onOpenSky: () => void;
  /** 카드 버튼 줄에 붙일 추가 버튼 */
  sheetActions?: (hex: string) => ReactNode;
}) => {
  // MapContainer의 center는 처음 한 번만 쓰임. 이후 이동은 LocationSync가 맡음
  const initialCenter = useLocationStore.getState();
  const mapRef = useRef<LeafletMap | null>(null);
  // 따라가기 예측 꼬리를 매 프레임 비행기까지 잇는 함수 (FollowTrail이 채우고 AircraftLayer가 부름)
  const tailRef = useRef<TailUpdater | null>(null);
  const connection = useFlightsStore((s) => s.connection);
  const nearby = useNearby();
  const isDesktop = useMediaQuery('(min-width: 768px)');
  const followHex = useFollowStore((s) => s.hex);
  const followLast = useFollowStore((s) => s.last);
  const following = followHex !== null;
  const followed = useMemo(() => (followLast ? [followLast] : []), [followLast]);

  const onFollowFrame = useCallback((pos: LatLon) => tailRef.current?.(pos), []);

  // 따라가기를 끝내면 지도를 원래 줌으로 내 위치에 되돌림
  const onExitFollow = () => {
    stopFollow();
    const map = mapRef.current;
    if (!map) return;
    const { lat, lon } = useLocationStore.getState();
    map.flyTo(visibleCenter(map, lat, lon, MAP_ZOOM), MAP_ZOOM, { duration: 1.5 });
  };

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
    <div
      className={`map-root${connection === 'reconnecting' ? ' is-offline' : ''}${following ? ' is-following' : ''}`}
    >
      <MapContainer
        ref={mapRef}
        center={[initialCenter.lat, initialCenter.lon]}
        zoom={MAP_ZOOM}
        zoomControl={false} // 목업 모양의 버튼을 직접 그림 (MapControls)
        attributionControl={false} // 출처는 카드에 가리지 않는 자리에 직접 표시 (Attribution)
      >
        <TileLayer url="https://tile.openstreetmap.org/{z}/{x}/{y}.png" />
        <LocationSync paused={following} />
        <MyLocationLayer radiusKm={nearby.radiusKm} />
        {following ? (
          // 따라가는 동안에는 그 비행기 하나만 그리고, 매 프레임 지도 중심을 그 비행기에 맞춤
          <>
            <FollowMapMode />
            <FollowTrail tailRef={tailRef} />
            <AircraftLayer
              aircraft={followed}
              onSelect={noop}
              highlightHex={followHex}
              followHex={followHex}
              onFollowFrame={onFollowFrame}
              maxPredictMs={FOLLOW_LOST_MS}
            />
          </>
        ) : (
          <>
            <AircraftLayer
              aircraft={shown}
              onSelect={selectAircraft}
              highlightHex={nearby.card?.target.item.hex ?? null}
              outsideHex={outsideHex}
            />
          </>
        )}
      </MapContainer>

      {/* 지도 위 UI는 MapContainer 밖에 둠. 안에 두면 버튼 클릭이 지도 끌기, 더블클릭 확대로 새어 나감 */}
      <div className="map-ui">
        <div className="map-top">
          {following ? (
            <FollowOverlay placement="top" onExit={onExitFollow} />
          ) : (
            <TopAndBanner
              count={nearby.hasSnapshot ? nearby.inside.length : null}
              radiusKm={nearby.radiusKm}
            />
          )}
          {isDesktop && (following ? <FollowOverlay placement="sheet" onExit={onExitFollow} /> : sheet)}
        </div>
        {/* 폰에서는 카드를 끌어서 접을 수 있음. 데스크톱은 카드가 왼쪽 패널이라 버튼 줄만 */}
        <DraggableBottom>
          <div className="map-bottom-row">
            <Attribution />
            <MapControls mapRef={mapRef} zoom={MAP_ZOOM} />
          </div>
          {!isDesktop &&
            (following ? <FollowOverlay placement="sheet" onExit={onExitFollow} /> : sheet)}
        </DraggableBottom>
      </div>

      {/* 처음 위치를 기다리는 동안 지도와 위 UI를 모두 덮음 */}
      <LocationPendingOverlay />
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
