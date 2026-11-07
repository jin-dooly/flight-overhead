/**
 * 연속 실패 횟수에 따른 다음 폴링 간격.
 * 0회 → base(5초), 1회 → 10초, 2회 → 20초, 3회 → 40초, 이후 max(60초)에서 멈춤.
 * 두 소스가 모두 실패할 때 외부 API를 더 두드리지 않도록 간격을 두 배씩 늘림.
 */
export const nextPollDelay = (
  consecutiveFailures: number,
  baseMs: number,
  maxMs: number
): number => {
  if (consecutiveFailures <= 0) return baseMs;
  // 지수가 너무 커져 Infinity가 되는 것을 막기 위해 30에서 자름
  const exp = Math.min(consecutiveFailures, 30);
  return Math.min(baseMs * 2 ** exp, maxMs);
};
