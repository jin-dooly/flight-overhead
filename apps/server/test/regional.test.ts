import type { Aircraft } from '@flight/shared';
import { describe, expect, it, vi } from 'vitest';
import type { FetchResult } from '../src/sources';
import { createRegionalFetcher, distanceNm } from '../src/sources/regional';

const region = { lat: 36.5, lon: 127.5, radiusNm: 250 };
const plane = (hex: string, lat: number, lon: number): Aircraft => ({ hex, lat, lon, seenAt: 1 });
// 서울 격자(37.5, 127.0) 근처 하나, 부산 격자(35.2, 129.1) 근처 하나
const seoulPlane = plane('seoul', 37.55, 127.0);
const busanPlane = plane('busan', 35.2, 129.05);

const setup = (result?: FetchResult) => {
  let time = 1_000;
  const fetchArea = vi.fn(
    async (): Promise<FetchResult> =>
      result ?? {
        status: 'ok',
        snapshot: { aircraft: [seoulPlane, busanPlane], source: 'adsb.fi', fetchedAt: time },
      }
  );
  const fetcher = createRegionalFetcher({ region, fetchArea, ttlMs: 4500, now: () => time });
  return { fetcher, fetchArea, advance: (ms: number) => (time += ms), at: () => time };
};

describe('distanceNm', () => {
  it('위도 1도는 60해리', () => {
    expect(distanceNm({ lat: 37, lon: 127 }, { lat: 38, lon: 127 })).toBeCloseTo(60, 0);
  });
});

describe('지역 통째 조회', () => {
  it('여러 격자가 물어도 외부 요청은 한 번이고, 격자마다 자기 반경 안 비행기만 받음', async () => {
    const { fetcher, fetchArea } = setup();
    const [seoul, busan] = await Promise.all([fetcher(37.5, 127.0, 17), fetcher(35.2, 129.1, 17)]);
    expect(fetchArea).toHaveBeenCalledTimes(1);
    expect(fetchArea).toHaveBeenCalledWith(36.5, 127.5, 250);
    expect(seoul.snapshot?.aircraft.map((a) => a.hex)).toEqual(['seoul']);
    expect(busan.snapshot?.aircraft.map((a) => a.hex)).toEqual(['busan']);
  });

  it('재사용 시간이 지나면 다시 조회하고, fetchedAt은 보내는 시각', async () => {
    const { fetcher, fetchArea, advance, at } = setup();
    await fetcher(37.5, 127.0, 17);
    advance(3000);
    const again = await fetcher(37.5, 127.0, 17);
    expect(fetchArea).toHaveBeenCalledTimes(1);
    expect(again.snapshot?.fetchedAt).toBe(at());
    advance(2000);
    await fetcher(37.5, 127.0, 17);
    expect(fetchArea).toHaveBeenCalledTimes(2);
  });

  it('지역 밖 격자(도쿄)는 예전처럼 그 격자를 직접 조회', async () => {
    const { fetcher, fetchArea } = setup();
    await fetcher(35.7, 139.8, 17);
    expect(fetchArea).toHaveBeenCalledWith(35.7, 139.8, 17);
  });

  it('지역 조회가 실패하면 그 실패를 그대로 돌려주고, 재사용 시간 동안 다시 부르지 않음', async () => {
    const { fetcher, fetchArea } = setup({ status: 'degraded', snapshot: null, errors: ['x'] });
    const first = await fetcher(37.5, 127.0, 17);
    await fetcher(35.2, 129.1, 17);
    expect(first.status).toBe('degraded');
    expect(fetchArea).toHaveBeenCalledTimes(1);
  });
});
