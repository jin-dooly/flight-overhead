import type { Aircraft } from '@flight/shared';
import { describe, expect, it, vi } from 'vitest';
import { nextPollDelay } from '../src/backoff';
import { createFallbackFetcher, type AircraftSource } from '../src/sources';

const plane: Aircraft = { hex: 'abc', lat: 37.5, lon: 127.1, seenAt: 1 };

const okSource = (name: AircraftSource['name'], list = [plane]) => ({
  name,
  fetchAircraft: vi.fn(async () => list),
});

const failingSource = (name: AircraftSource['name']) => ({
  name,
  fetchAircraft: vi.fn(async (): Promise<Aircraft[]> => {
    throw new Error('HTTP 503');
  }),
});

describe('createFallbackFetcher', () => {
  it('메인 소스가 성공하면 ok이고 예비 소스를 부르지 않는다', async () => {
    const lol = okSource('adsb.lol');
    const fi = okSource('adsb.fi');
    const fetcher = createFallbackFetcher(lol, fi, () => 42);

    const result = await fetcher(37.5, 127.1, 15);

    expect(result).toEqual({
      status: 'ok',
      snapshot: { aircraft: [plane], source: 'adsb.lol', fetchedAt: 42 },
    });
    expect(lol.fetchAircraft).toHaveBeenCalledWith(37.5, 127.1, 15);
    expect(fi.fetchAircraft).not.toHaveBeenCalled();
  });

  it('메인이 실패하면 같은 요청을 예비 소스로 재시도하고 fallback이다', async () => {
    const lol = failingSource('adsb.lol');
    const fi = okSource('adsb.fi');
    const fetcher = createFallbackFetcher(lol, fi, () => 42);

    const result = await fetcher(37.5, 127.1, 15);

    expect(fi.fetchAircraft).toHaveBeenCalledWith(37.5, 127.1, 15);
    expect(result.status).toBe('fallback');
    expect(result.snapshot?.source).toBe('adsb.fi');
  });

  it('둘 다 실패하면 degraded이고 스냅샷이 없다', async () => {
    const fetcher = createFallbackFetcher(
      failingSource('adsb.lol'),
      failingSource('adsb.fi')
    );

    const result = await fetcher(37.5, 127.1, 15);

    expect(result.status).toBe('degraded');
    expect(result.snapshot).toBeNull();
    if (result.status === 'degraded') {
      expect(result.errors).toEqual([
        'adsb.lol: HTTP 503',
        'adsb.fi: HTTP 503',
      ]);
    }
  });

  it('다음 요청은 다시 메인 소스부터 시도한다', async () => {
    const lol = failingSource('adsb.lol');
    const fi = okSource('adsb.fi');
    const fetcher = createFallbackFetcher(lol, fi);

    await fetcher(37.5, 127.1, 15);
    await fetcher(37.5, 127.1, 15);

    expect(lol.fetchAircraft).toHaveBeenCalledTimes(2);
  });
});

describe('nextPollDelay', () => {
  it('실패가 없으면 기본 간격', () => {
    expect(nextPollDelay(0, 5000, 60_000)).toBe(5000);
  });

  it('연속 실패 시 10초, 20초, 40초로 늘리고 60초에서 멈춘다', () => {
    const delays = [1, 2, 3, 4, 5, 100].map((n) =>
      nextPollDelay(n, 5000, 60_000)
    );
    expect(delays).toEqual([10_000, 20_000, 40_000, 60_000, 60_000, 60_000]);
  });
});
