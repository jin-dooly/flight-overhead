import type { SnapshotFetcher } from './index';

export type Region = { lat: number; lon: number; radiusNm: number };

const EARTH_RADIUS_NM = 3440.065;
const toRad = (deg: number) => (deg * Math.PI) / 180;

/** 두 지점 사이 거리(해리). 하버사인 */
export const distanceNm = (
  a: { lat: number; lon: number },
  b: { lat: number; lon: number }
): number => {
  const dLat = toRad(b.lat - a.lat);
  const dLon = toRad(b.lon - a.lon);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLon / 2) ** 2;
  return 2 * EARTH_RADIUS_NM * Math.asin(Math.sqrt(Math.min(1, h)));
};

/**
 * 지역 통째 조회 (2026-11-09 사용자 결정).
 *
 * 예전에는 격자마다 외부 API를 불러서, 보는 사람이 많아질수록(격자가 늘수록) 요청이 늘어 호출 제한(429)에 걸렸음.
 * 이제 지역(한반도) 전체를 한 번 조회해 두고, 각 격자는 그 결과에서 자기 반경 안 비행기만 골라 발행함.
 * 그래서 외부 요청 수는 격자 수와 상관없이 "지역 조회 주기마다 1번"이 됨.
 *
 * - 격자 반경 전체가 지역 안에 들어오는 격자만 지역 결과를 씀. 지역 밖(해외 등) 격자는 예전처럼 직접 조회
 * - 같은 순간 여러 격자가 물어도 실제 요청은 하나만 나가고 결과를 나눠 씀(single-flight)
 * - 결과는 `ttlMs` 동안 다시 씀. 실패 결과도 같은 시간 동안 다시 써서, 실패할 때 격자 수만큼 재시도가 몰리지 않게 함
 */
export const createRegionalFetcher = ({
  region,
  fetchArea,
  ttlMs,
  now = Date.now,
}: {
  region: Region;
  /** 실제 외부 조회 (예비 전환 포함) */
  fetchArea: SnapshotFetcher;
  ttlMs: number;
  now?: () => number;
}): SnapshotFetcher => {
  let cached: { at: number; result: Awaited<ReturnType<SnapshotFetcher>> } | null = null;
  let inFlight: ReturnType<SnapshotFetcher> | null = null;

  const regional = async () => {
    if (cached && now() - cached.at < ttlMs) return cached.result;
    if (!inFlight) {
      inFlight = fetchArea(region.lat, region.lon, region.radiusNm)
        .then((result) => {
          cached = { at: now(), result };
          return result;
        })
        .finally(() => {
          inFlight = null;
        });
    }
    return inFlight;
  };

  return async (lat, lon, radiusNm) => {
    const inside = distanceNm(region, { lat, lon }) + radiusNm <= region.radiusNm;
    if (!inside) return fetchArea(lat, lon, radiusNm);

    const result = await regional();
    if (!result.snapshot) return result;
    return {
      status: result.status,
      snapshot: {
        aircraft: result.snapshot.aircraft.filter(
          (a) => distanceNm({ lat, lon }, a) <= radiusNm
        ),
        source: result.snapshot.source,
        // 브라우저는 스냅샷을 받은 순간을 fetchedAt으로 보고 시계 차이를 계산함.
        // 지역 결과를 몇 초 뒤에 다시 쓰는 경우에도 차이가 틀어지지 않게 "보내는 지금" 시각을 넣음.
        // 비행기 위치 시각(seenAt)은 조회 때 계산한 값 그대로라 예측은 정확함
        fetchedAt: now(),
      },
    };
  };
};
