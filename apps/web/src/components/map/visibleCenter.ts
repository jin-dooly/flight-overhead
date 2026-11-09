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

/**
 * 따라가기: (lat, lon)이 보이는 영역 가운데에 오도록 지도를 픽셀 단위로 밀어 줌. 매 프레임 부름.
 *
 * 예전에는 매 프레임 `setView`로 중심을 다시 정했는데, setView는 지도 전체를 다시 배치(reset)해서 무겁고,
 * 위경도 → 픽셀 변환의 반올림이 프레임마다 달라 비행기가 가운데에서 1~2px씩 흔들렸음.
 * 지금은 "비행기가 지금 화면 어디에 있는지"를 재서 목표 지점과의 차이만큼만 `panBy`로 옮김.
 * 차이를 직접 재므로 오차가 쌓이지 않고, 지도 패널만 옮기므로 가벼움
 */
export const keepInView = (map: LeafletMap, lat: number, lon: number) => {
  const size = map.getSize();
  const desiredX = size.x / 2;
  const desiredY = (size.y - coveredBottomPx()) / 2;
  const now = map.latLngToContainerPoint([lat, lon]);
  const dx = Math.round(now.x - desiredX);
  const dy = Math.round(now.y - desiredY);
  if (dx === 0 && dy === 0) return;
  map.panBy([dx, dy], { animate: false, noMoveStart: true });
};
