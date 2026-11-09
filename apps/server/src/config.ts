export type Config = {
  port: number;
  pollIntervalMs: number;
  radiusNm: number;
  userAgent: string;
  requestTimeoutMs: number;
  maxPollIntervalMs: number;
  /** 서버 전체에서 동시에 폴링하는 따라가기 기체 수 상한 (기획서: 남용 방지) */
  maxFollows: number;
  /** 따라가기 기체 조회 간격(ms) */
  followIntervalMs: number;
  /** 한 번에 통째로 조회하는 지역. 이 안의 격자는 지역 결과를 나눠 씀 */
  region: { lat: number; lon: number; radiusNm: number };
  /** 외부 API 요청 시작 사이 최소 간격(ms). adsb.fi 제한(1초 1번)에 여유를 두고, adsb.lol 호출 제한도 덜 걸리게 */
  minRequestGapMs: number;
};

const positiveNumber = (value: string | undefined, fallback: number): number => {
  if (value === undefined || value.trim() === '') return fallback;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
};

export const loadConfig = (env: NodeJS.ProcessEnv = process.env): Config => ({
  port: positiveNumber(env.PORT, 4000),
  pollIntervalMs: positiveNumber(env.POLL_INTERVAL_MS, 5000),
  // 21해리(약 39km): 내 위치는 격자 중심에서 최대 약 7km 떨어질 수 있어서, 반경 30km로 넓혀도 한쪽 가장자리가
  // 비지 않게 30 + 7 + 여유. 지역 통째 조회 결과에서 고르는 반경이라 늘려도 외부 요청은 늘지 않음 (2026-11-09 사용자 결정)
  radiusNm: positiveNumber(env.RADIUS_NM, 21),
  userAgent: env.USER_AGENT?.trim() || 'flight-overhead/0.1',
  maxFollows: positiveNumber(env.MAX_FOLLOWS, 20),
  // 따라가기 조회 간격: 10초로 늘렸다가 선회 중 예측 오차가 4배쯤 커져서(10초마다 화면이 옆으로 끌림) 5초로 되돌림
  followIntervalMs: positiveNumber(env.FOLLOW_POLL_INTERVAL_MS, 5_000),
  // 한반도 전체(제주, 독도 포함)를 덮는 원. 250해리는 adsb.fi, adsb.lol 좌표 조회의 최대 반경
  region: { lat: 36.5, lon: 127.5, radiusNm: 250 },
  minRequestGapMs: 1100,
  // 아래 두 값은 기획서에서 확정된 값이라 환경 변수로 열지 않음
  requestTimeoutMs: 5000,
  maxPollIntervalMs: 60_000,
});
