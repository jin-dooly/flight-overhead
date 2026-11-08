export type Config = {
  port: number;
  pollIntervalMs: number;
  radiusNm: number;
  userAgent: string;
  requestTimeoutMs: number;
  maxPollIntervalMs: number;
};

const positiveNumber = (value: string | undefined, fallback: number): number => {
  if (value === undefined || value.trim() === '') return fallback;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
};

export const loadConfig = (env: NodeJS.ProcessEnv = process.env): Config => ({
  port: positiveNumber(env.PORT, 4000),
  pollIntervalMs: positiveNumber(env.POLL_INTERVAL_MS, 5000),
  radiusNm: positiveNumber(env.RADIUS_NM, 17),
  userAgent: env.USER_AGENT?.trim() || 'flight-overhead/0.1',
  // 아래 두 값은 기획서에서 확정된 값이라 환경 변수로 열지 않음
  requestTimeoutMs: 5000,
  maxPollIntervalMs: 60_000,
});
