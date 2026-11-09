import L, { type Map as LeafletMap } from 'leaflet';

/**
 * 폰에서 하단 카드가 지도 아래쪽을 가리는 높이(px). 데스크톱은 카드가 왼쪽 패널이라 0.
 * 카드를 끌어 내리면(접기) 가리는 높이도 줄어들도록, 카드의 실제 화면 위치(getBoundingClientRect)로 잼.
 * 따라가기 중에는 매 프레임 불리므로 0.1초에 한 번만 DOM에서 잼(레이아웃 계산 비용)
 */
let cachedInset = 0;
let cachedAt = -Infinity;
export const coveredBottomPx = (): number => {
  if (window.matchMedia('(min-width: 768px)').matches) return 0;
  const now = performance.now();
  if (now - cachedAt > 100) {
    const sheet = document.querySelector<HTMLElement>('.map-bottom .sheet');
    cachedInset = sheet ? Math.max(0, window.innerHeight - sheet.getBoundingClientRect().top) : 0;
    cachedAt = now;
  }
  return cachedInset;
};

/**
 * 지도 중심을 카드가 가린 높이의 절반만큼 아래로 옮긴 좌표.
 * 이 좌표를 지도 중심으로 쓰면, (lat, lon)은 "카드 위로 보이는 영역"의 가운데에 옴
 */
export const visibleCenter = (
  map: LeafletMap,
  lat: number,
  lon: number,
  zoom: number
): L.LatLng => {
  const target = L.latLng(lat, lon);
  const inset = coveredBottomPx();
  if (inset === 0) return target;
  const point = map.project(target, zoom).add([0, inset / 2]);
  return map.unproject(point, zoom);
};

/** Leaflet 내부 함수. 공식 타입에는 없어서 필요한 것만 적어 둠 (leaflet 1.9.4 기준) */
type MapInternals = { _rawPanBy: (offset: L.Point) => void };

/**
 * 위경도의 지도 패널 안 좌표(px)를 반올림 없이 구함.
 * Leaflet의 latLngToLayerPoint / latLngToContainerPoint는 안에서 정수로 반올림해서 쓰지 않음
 */
const exactLayerPoint = (map: LeafletMap, lat: number, lon: number) =>
  map.project([lat, lon], map.getZoom()).subtract(map.getPixelOrigin());

/** "이동 끝"(moveend) 이벤트를 보내는 최소 간격. 이 이벤트가 올 때 Leaflet이 필요한 타일을 다시 계산함 */
const MOVEEND_EVERY_MS = 500;
let lastMoveEndAt = -Infinity;

/**
 * 따라가기: 비행기가 보이는 영역 가운데에 딱 붙어 있도록, 매 프레임 지도를 소수점 픽셀 단위로 밀어 줌.
 *
 * 1차(setView): 매 프레임 지도 전체를 다시 배치해서 무겁고 흔들렸음.
 * 2차(panBy): 흔들림은 잡았지만 Leaflet의 panBy는 정수 픽셀로 반올림함. 순항 중인 비행기는 줌 10에서
 *   1초에 2px 정도(한 프레임 0.03px)만 움직여서, 지도가 0.5초 멈췄다 1px 툭 움직이기를 반복해 뚝뚝 끊겨 보였음.
 * 지금(3차): 반올림하지 않는 Leaflet 내부 함수 _rawPanBy로 지도 패널을 소수점 픽셀만큼 옮김.
 *   브라우저는 소수점 이동도 GPU 변환으로 부드럽게 그림.
 *   - 매 프레임 "이동 중"(move)만 보내고, 타일을 다시 계산하게 하는 "이동 끝"(moveend)은 0.5초에 한 번만 보냄
 *   - 밑줄로 시작하는 내부 함수라 Leaflet 버전을 올리면 이 함수가 그대로인지 확인해야 함
 */
export const keepInView = (map: LeafletMap, lat: number, lon: number) => {
  const size = map.getSize();
  const desired = L.point(size.x / 2, (size.y - coveredBottomPx()) / 2);
  // 화면(컨테이너) 좌표 = 패널 안 좌표 + 패널이 밀린 만큼. 둘 다 소수점 그대로 계산
  const panePos = L.DomUtil.getPosition(map.getPane('mapPane')!);
  const delta = exactLayerPoint(map, lat, lon).add(panePos).subtract(desired);
  if (Math.abs(delta.x) < 0.001 && Math.abs(delta.y) < 0.001) return;

  // 따라가기를 막 시작했을 때처럼 화면보다 멀리 옮겨야 하면 한 번에 다시 배치함.
  // Leaflet panBy와 같은 기준: 패널을 너무 멀리 밀면 타일이 엉뚱한 곳에 그려지는 브라우저 문제가 있음
  if (Math.abs(delta.x) > size.x || Math.abs(delta.y) > size.y) {
    const zoom = map.getZoom();
    map.setView(visibleCenter(map, lat, lon, zoom), zoom, { animate: false });
    return;
  }

  (map as unknown as MapInternals)._rawPanBy(delta);
  map.fire('move');
  const now = performance.now();
  if (now - lastMoveEndAt > MOVEEND_EVERY_MS) {
    lastMoveEndAt = now;
    map.fire('moveend');
  }
};

/**
 * 마커를 소수점 픽셀 위치에 놓음. Leaflet의 setLatLng은 마커 위치도 정수 픽셀로 반올림해서,
 * 지도만 부드럽게 움직이면 마커가 0.5px씩 떨림. setLatLng으로 위치(값)를 맞춘 뒤 화면 위치만 덮어씀
 */
export const placeMarkerExactly = (map: LeafletMap, marker: L.Marker, lat: number, lon: number) => {
  const el = marker.getElement();
  if (el) L.DomUtil.setPosition(el, exactLayerPoint(map, lat, lon));
};
