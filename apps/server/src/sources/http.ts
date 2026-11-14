/**
 * 타임아웃과 User-Agent를 적용한 JSON GET.
 * 네트워크 오류, 타임아웃, 2xx가 아닌 응답, JSON 파싱 실패는 모두 throw → 예비 전환 조건이 됨.
 * `headers`는 소스마다 다른 헤더(예: adsb.lol API 키)를 더할 때 씀
 */
export const fetchJson = async (
  url: string,
  {
    userAgent,
    timeoutMs,
    fetchImpl = fetch,
    headers = {},
  }: {
    userAgent: string;
    timeoutMs: number;
    fetchImpl?: typeof fetch;
    headers?: Record<string, string>;
  }
): Promise<unknown> => {
  const res = await fetchImpl(url, {
    headers: { ...headers, 'User-Agent': userAgent, Accept: 'application/json' },
    signal: AbortSignal.timeout(timeoutMs),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
};
