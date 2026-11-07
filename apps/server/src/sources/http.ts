/**
 * 타임아웃과 User-Agent를 적용한 JSON GET.
 * 네트워크 오류, 타임아웃, 2xx가 아닌 응답, JSON 파싱 실패는 모두 throw → 예비 전환 조건이 됨.
 */
export const fetchJson = async (
  url: string,
  {
    userAgent,
    timeoutMs,
    fetchImpl = fetch,
  }: { userAgent: string; timeoutMs: number; fetchImpl?: typeof fetch }
): Promise<unknown> => {
  const res = await fetchImpl(url, {
    headers: { 'User-Agent': userAgent, Accept: 'application/json' },
    signal: AbortSignal.timeout(timeoutMs),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
};
