import { describe, expect, it, vi } from 'vitest';
import adsbFiSample from './fixtures/adsbFi.json';
import adsbLolSample from './fixtures/adsbLol.json';
import { createAdsbFiSource } from '../src/sources/adsbFi';
import { createAdsbLolSource } from '../src/sources/adsbLol';
import { normalizeAircraft, normalizeResponse, responseTime } from '../src/sources/normalize';

const NOW = 1_762_534_800_000;

const jsonResponse = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });

const makeOpts = (fetchImpl: typeof fetch) => ({
  userAgent: 'flight-overhead-test/0.1',
  timeoutMs: 5000,
  fetchImpl,
  now: () => NOW,
});

describe('normalizeAircraft', () => {
  it('필드를 공통 모델로 매핑하고 편명 공백을 제거한다', () => {
    const raw = {
      hex: 'abc123',
      flight: ' KAL1 ',
      alt_baro: 1000,
      gs: 200,
      track: 45,
      lat: 1,
      lon: 2,
      seen_pos: 1.5,
    };
    expect(normalizeAircraft(raw, NOW)).toEqual({
      hex: 'abc123',
      callsign: 'KAL1',
      altFt: 1000,
      speedKt: 200,
      trackDeg: 45,
      lat: 1,
      lon: 2,
      seenAt: NOW - 1500,
    });
  });

  it('seen_pos가 없으면 현재 시각을 seenAt으로 쓴다', () => {
    expect(normalizeAircraft({ hex: 'a', lat: 1, lon: 2 }, NOW)?.seenAt).toBe(
      NOW
    );
  });

  it('빈 편명은 callsign을 두지 않는다', () => {
    expect(
      normalizeAircraft({ hex: 'a', flight: '@@@@@@@@', lat: 1, lon: 2 }, NOW)?.callsign
    ).toBeUndefined();
    const a = normalizeAircraft({ hex: 'a', flight: '   ', lat: 1, lon: 2 }, NOW);
    expect(a).not.toBeNull();
    expect(a).not.toHaveProperty('callsign');
  });

  it('지상 기체, 위치 없는 항목, hex 없는 항목을 버린다', () => {
    expect(
      normalizeAircraft({ hex: 'a', lat: 1, lon: 2, alt_baro: 'ground' }, NOW)
    ).toBeNull();
    expect(normalizeAircraft({ hex: 'a', lat: 1 }, NOW)).toBeNull();
    expect(normalizeAircraft({ hex: 'a', lon: 2 }, NOW)).toBeNull();
    expect(normalizeAircraft({ lat: 1, lon: 2 }, NOW)).toBeNull();
    expect(normalizeAircraft(null, NOW)).toBeNull();
  });
});

describe('응답 시각 기준 위치 시각', () => {
  it('seen_pos는 받은 시각이 아니라 응답 시각(now)에서 뺌. ms와 초 단위 둘 다', () => {
    const plane = { hex: 'a', lat: 1, lon: 2, seen_pos: 1.5 };
    // adsb.lol: ms, 응답이 2초 전에 만들어짐
    expect(normalizeResponse({ now: NOW - 2000, ac: [plane] }, 'ac', NOW)[0].seenAt).toBe(NOW - 3500);
    // adsb.fi: 초 단위
    expect(normalizeResponse({ now: (NOW - 2000) / 1000, aircraft: [plane] }, 'aircraft', NOW)[0].seenAt).toBe(
      NOW - 3500
    );
  });

  it('응답 시각이 없거나 1분 넘게 어긋나면 받은 시각', () => {
    expect(responseTime({}, NOW)).toBe(NOW);
    expect(responseTime({ now: NOW - 120_000 }, NOW)).toBe(NOW);
    expect(responseTime({ now: NOW + 30_000 }, NOW)).toBe(NOW + 30_000);
  });
});

describe('선회율', () => {
  it('track_rate가 있으면 trackRateDegS로, 없으면 비움', () => {
    const base = { hex: 'a', lat: 1, lon: 2, track: 90 };
    expect(normalizeAircraft({ ...base, track_rate: -0.94 }, NOW)?.trackRateDegS).toBe(-0.94);
    expect(normalizeAircraft(base, NOW)).not.toHaveProperty('trackRateDegS');
  });
});

describe('고도', () => {
  it('기하 고도(GPS)가 있으면 그 값, 없으면 기압 고도', () => {
    const base = { hex: 'a', lat: 1, lon: 2 };
    // 기압이 높은 날 착륙 중: 기압 고도는 마이너스, 기하 고도는 실제 높이에 가까움
    expect(normalizeAircraft({ ...base, alt_baro: -425, alt_geom: 75 }, NOW)?.altFt).toBe(75);
    expect(normalizeAircraft({ ...base, alt_baro: 8325 }, NOW)?.altFt).toBe(8325);
    expect(normalizeAircraft({ ...base }, NOW)?.altFt).toBeUndefined();
  });
});

describe('adsb.lol 어댑터', () => {
  it('요청 URL과 User-Agent를 지정하고 ac 목록을 정규화한다', async () => {
    const fetchImpl = vi.fn(async () => jsonResponse(adsbLolSample));
    const source = createAdsbLolSource(makeOpts(fetchImpl as typeof fetch));

    const result = await source.fetchAircraft(37.5, 127.1, 15);

    const [url, init] = fetchImpl.mock.calls[0] as unknown as [
      string,
      RequestInit,
    ];
    expect(url).toBe('https://api.adsb.lol/v2/lat/37.5/lon/127.1/dist/15');
    expect((init.headers as Record<string, string>)['User-Agent']).toBe(
      'flight-overhead-test/0.1'
    );
    expect(init.signal).toBeInstanceOf(AbortSignal);

    // 지상 기체(71bb01)와 위치 없는 항목(780abc)은 빠짐
    expect(result.map((a) => a.hex)).toEqual(['71be12', '71c4a0']);
    expect(result[0]).toEqual({
      hex: '71be12',
      callsign: 'KAL1234',
      lat: 37.53,
      lon: 127.12,
      altFt: 8600, // 기하 고도(alt_geom)가 있으면 그 값
      speedKt: 251.4,
      trackDeg: 312.6,
      seenAt: NOW - 400,
    });
    expect(result[1]).not.toHaveProperty('callsign');
    expect(result[1].seenAt).toBe(NOW);
  });

  it('API 키가 있으면 x-api-key로 붙이고, 없으면 붙이지 않는다', async () => {
    const headersOf = (fetchImpl: ReturnType<typeof vi.fn>) =>
      (fetchImpl.mock.calls[0] as unknown as [string, RequestInit])[1]
        .headers as Record<string, string>;

    const withKey = vi.fn(async () => jsonResponse({ ac: [] }));
    await createAdsbLolSource({
      ...makeOpts(withKey as typeof fetch),
      adsbLolApiKey: 'test-key',
    }).fetchByHex('abc123');
    expect(headersOf(withKey)['x-api-key']).toBe('test-key');
    expect(headersOf(withKey)['User-Agent']).toBe('flight-overhead-test/0.1');

    const withoutKey = vi.fn(async () => jsonResponse({ ac: [] }));
    await createAdsbLolSource(makeOpts(withoutKey as typeof fetch)).fetchAircraft(37.5, 127.1, 15);
    expect(headersOf(withoutKey)).not.toHaveProperty('x-api-key');
  });

  it('2xx가 아닌 응답은 실패로 처리한다', async () => {
    const source = createAdsbLolSource(
      makeOpts((async () => jsonResponse({}, 429)) as typeof fetch)
    );
    await expect(source.fetchAircraft(37.5, 127.1, 15)).rejects.toThrow(
      'HTTP 429'
    );
  });

  it('JSON 파싱 실패와 목록 키 누락을 실패로 처리한다', async () => {
    const badJson = createAdsbLolSource(
      makeOpts((async () => new Response('<html>')) as typeof fetch)
    );
    await expect(badJson.fetchAircraft(37.5, 127.1, 15)).rejects.toThrow();

    const wrongKey = createAdsbLolSource(
      makeOpts((async () => jsonResponse({ aircraft: [] })) as typeof fetch)
    );
    await expect(wrongKey.fetchAircraft(37.5, 127.1, 15)).rejects.toThrow(
      '"ac"'
    );
  });

  it('네트워크 오류를 실패로 처리한다', async () => {
    const source = createAdsbLolSource(
      makeOpts((async () => {
        throw new TypeError('fetch failed');
      }) as typeof fetch)
    );
    await expect(source.fetchAircraft(37.5, 127.1, 15)).rejects.toThrow(
      'fetch failed'
    );
  });
});

describe('adsb.fi 어댑터', () => {
  it('요청 URL을 만들고 aircraft 목록을 정규화한다', async () => {
    const fetchImpl = vi.fn(async () => jsonResponse(adsbFiSample));
    const source = createAdsbFiSource(makeOpts(fetchImpl as typeof fetch));

    const result = await source.fetchAircraft(37.5, 127.1, 15);

    const [url] = fetchImpl.mock.calls[0] as unknown as [string];
    expect(url).toBe(
      'https://opendata.adsb.fi/api/v2/lat/37.5/lon/127.1/dist/15'
    );
    expect(result.map((a) => a.hex)).toEqual(['71be12', '~2c1a33']);
    expect(result[0].seenAt).toBe(NOW - 2500);
    expect(result[0].callsign).toBe('KAL1234');
  });

  it('adsb.lol API 키는 adsb.fi에 보내지 않는다', async () => {
    const fetchImpl = vi.fn(async () => jsonResponse(adsbFiSample));
    await createAdsbFiSource({
      ...makeOpts(fetchImpl as typeof fetch),
      adsbLolApiKey: 'test-key',
    }).fetchAircraft(37.5, 127.1, 15);
    const [, init] = fetchImpl.mock.calls[0] as unknown as [string, RequestInit];
    expect(init.headers).not.toHaveProperty('x-api-key');
  });
});
