import type { FitBoundsOptions, LatLngExpression, Map as LeafletMap, ZoomPanOptions } from 'leaflet';
import type { LatLon } from '../../lib/geo/distance';

/** 테스트에서 가짜 지도를 넣을 수 있게 필요한 함수만 받음 (leaflet을 불러오면 브라우저가 필요해짐) */
type MovableMap = Pick<LeafletMap, 'getSize' | 'getZoom' | 'flyTo' | 'flyToBounds' | 'setView'>;

/**
 * 지도 영역의 너비나 높이가 0인지.
 * Leaflet 1.9.4의 flyTo는 애니메이션 곡선을 지도 크기(max(너비, 높이))로 계산해서, 크기가 0이면
 * 0으로 나누어 좌표가 NaN이 되고 "Invalid LatLng object: (NaN, NaN)" 오류를 던짐(2026-11-14 확인).
 * 이 오류가 React effect 안에서 나면 앱 전체가 오류 화면으로 바뀜.
 * 창 크기를 바꾸는 도중이나 화면이 잠깐 숨겨졌을 때 크기가 0일 수 있음
 */
const hasNoArea = (map: MovableMap): boolean => {
  const size = map.getSize();
  return !(size.x > 0 && size.y > 0);
};

/** flyTo와 같지만, 지도 크기가 0이면 애니메이션 없이 바로 옮김(보이지 않으니 애니메이션도 의미 없음) */
export const flyToSafe = (
  map: MovableMap,
  center: LatLngExpression,
  zoom: number,
  options?: ZoomPanOptions
): void => {
  if (hasNoArea(map)) map.setView(center, zoom, { animate: false });
  else map.flyTo(center, zoom, options);
};

/**
 * flyToBounds와 같지만, 지도 크기가 0이면 범위에 맞는 줌을 계산할 수 없으므로 줌은 그대로 두고 가운데만 맞춤
 */
export const flyToBoundsSafe = (
  map: MovableMap,
  bounds: [[number, number], [number, number]],
  options?: FitBoundsOptions
): void => {
  if (hasNoArea(map)) {
    const center: LatLon = {
      lat: (bounds[0][0] + bounds[1][0]) / 2,
      lon: (bounds[0][1] + bounds[1][1]) / 2,
    };
    map.setView([center.lat, center.lon], map.getZoom(), { animate: false });
  } else {
    map.flyToBounds(bounds, options);
  }
};
