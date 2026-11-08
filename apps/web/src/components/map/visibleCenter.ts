import L, { type Map as LeafletMap } from 'leaflet';

/**
 * 폰에서는 하단 카드가 지도 아래쪽을 가리므로, 지도 중심을 카드 높이의 절반만큼 아래로 옮겨서
 * 내 위치가 "카드 위로 보이는 영역"의 가운데에 오게 함. 데스크톱은 카드가 왼쪽 패널이라 그대로.
 * 카드 높이는 내용에 따라 달라져서 그때그때 DOM에서 잼
 */
export const visibleCenter = (
  map: LeafletMap,
  lat: number,
  lon: number,
  zoom: number
): L.LatLng => {
  const target = L.latLng(lat, lon);
  if (window.matchMedia('(min-width: 768px)').matches) return target;
  const sheet = document.querySelector<HTMLElement>('.map-bottom .sheet');
  const inset = sheet?.offsetHeight ?? 0;
  if (inset === 0) return target;
  const point = map.project(target, zoom).add([0, inset / 2]);
  return map.unproject(point, zoom);
};
