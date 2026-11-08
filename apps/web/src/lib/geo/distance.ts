export type LatLon = { lat: number; lon: number };

/** 지구 평균 반지름(km). 지구는 완전한 구가 아니라서 실제와 최대 0.5% 정도 차이 나지만, 20km 반경 판단에는 충분함 */
const EARTH_RADIUS_KM = 6371;

const toRad = (deg: number) => (deg * Math.PI) / 180;

/**
 * 두 지점 사이의 지표면 거리(km). 하버사인 공식.
 * 위도와 경도를 그냥 피타고라스로 계산하면 경도 1도의 길이가 위도마다 달라서
 * (적도 약 111km, 서울 약 88km) 동서 방향 거리가 크게 틀어짐
 */
export const distanceKm = (a: LatLon, b: LatLon): number => {
  const dLat = toRad(b.lat - a.lat);
  const dLon = toRad(b.lon - a.lon);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLon / 2) ** 2;
  // 부동소수점 오차로 h가 1을 조금 넘으면 asin이 NaN이 되므로 1로 자름
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.sqrt(Math.min(1, h)));
};

/**
 * 기준점에서 가까운 순으로 정렬하고 거리를 같이 붙여 돌려줌. 원래 배열은 바꾸지 않음.
 * 반경 안 비행기(앞에서부터 radius 이하), 가장 가까운 비행기(첫 번째),
 * "반경 안에 없음" 화면의 가장 가까운 거리까지 한 번의 계산으로 모두 얻으려고 정렬까지 함
 */
export const sortByDistance = <T extends LatLon>(
  items: readonly T[],
  center: LatLon
): { item: T; distanceKm: number }[] =>
  items
    .map((item) => ({ item, distanceKm: distanceKm(center, item) }))
    .sort((x, y) => x.distanceKm - y.distanceKm);
