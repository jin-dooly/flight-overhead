import type { FollowSnapshot } from '@flight/shared';
import mqtt, { type MqttClient } from 'mqtt';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { startServer, type HealthResponse, type RunningServer } from '../src/app';
import { loadConfig } from '../src/config';
import { createFallbackHexFetcher, type FollowFetcher, type HexSource } from '../src/sources';
import { createAdsbFiSource } from '../src/sources/adsbFi';
import { createAdsbLolSource } from '../src/sources/adsbLol';
import { normalizeFollowed, normalizeHexResponse } from '../src/sources/normalize';
import { RequestSpacer, TopicPoller } from '../src/topicPoller';

const NOW = 1_762_534_800_000;
const HEX = '71c9a3';

const jsonResponse = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });

// adsb.fi 기체 ID 조회의 실제 응답 형식(2026-11-09 1회 확인: 목록 키가 `ac`)에서 필요한 필드만
const airborne = {
  hex: HEX,
  flight: 'KAL123  ',
  alt_baro: 35000,
  gs: 470,
  track: 182,
  lat: 35.1,
  lon: 128.2,
  seen_pos: 1.5,
};
const onGround = { ...airborne, alt_baro: 'ground', gs: 12 };

describe('따라가기 정규화', () => {
  it('공중 기체는 onGround false', () => {
    expect(normalizeFollowed(airborne, NOW)).toEqual({
      hex: HEX,
      callsign: 'KAL123',
      lat: 35.1,
      lon: 128.2,
      altFt: 35000,
      speedKt: 470,
      trackDeg: 182,
      seenAt: NOW - 1500,
      onGround: false,
    });
  });

  it('지상 기체는 버리지 않고 onGround true, 고도는 비움', () => {
    const a = normalizeFollowed(onGround, NOW);
    expect(a?.onGround).toBe(true);
    expect(a?.altFt).toBeUndefined();
    expect(a?.speedKt).toBe(12);
  });

  it('위치가 없으면 null', () => {
    expect(normalizeFollowed({ hex: HEX }, NOW)).toBeNull();
  });

  it('응답 목록에서 그 기체를 찾음. 목록 키는 ac와 aircraft 둘 다', () => {
    expect(normalizeHexResponse({ ac: [airborne] }, HEX, NOW)?.hex).toBe(HEX);
    expect(normalizeHexResponse({ aircraft: [airborne] }, HEX, NOW)?.hex).toBe(HEX);
  });

  it('목록에 없으면 null(신호 끊김), 목록 자체가 없으면 형식 오류로 throw', () => {
    expect(normalizeHexResponse({ ac: [] }, HEX, NOW)).toBeNull();
    expect(normalizeHexResponse({ ac: [{ ...airborne, hex: 'aaaaaa' }] }, HEX, NOW)).toBeNull();
    expect(() => normalizeHexResponse({ msg: 'x' }, HEX, NOW)).toThrow();
  });
});

describe('기체 ID 조회 어댑터', () => {
  const makeOpts = (fetchImpl: typeof fetch) => ({
    userAgent: 'flight-overhead-test/0.1',
    timeoutMs: 5000,
    fetchImpl,
    now: () => NOW,
  });

  it('adsb.lol은 /v2/hex/{hex}', async () => {
    const fetchImpl = vi.fn(async () => jsonResponse({ ac: [airborne] }));
    const a = await createAdsbLolSource(makeOpts(fetchImpl as typeof fetch)).fetchByHex(HEX);
    expect((fetchImpl.mock.calls[0] as unknown as [string])[0]).toBe(`https://api.adsb.lol/v2/hex/${HEX}`);
    expect(a?.callsign).toBe('KAL123');
  });

  it('adsb.fi는 /api/v2/hex/{hex}', async () => {
    const fetchImpl = vi.fn(async () => jsonResponse({ ac: [airborne] }));
    const a = await createAdsbFiSource(makeOpts(fetchImpl as typeof fetch)).fetchByHex(HEX);
    expect((fetchImpl.mock.calls[0] as unknown as [string])[0]).toBe(`https://opendata.adsb.fi/api/v2/hex/${HEX}`);
    expect(a?.hex).toBe(HEX);
  });
});

describe('따라가기 예비 전환', () => {
  const plane = normalizeFollowed(airborne, NOW);
  const ok = (name: HexSource['name'], result = plane): HexSource => ({
    name,
    fetchByHex: vi.fn(async () => result),
  });
  const failing = (name: HexSource['name']): HexSource => ({
    name,
    fetchByHex: vi.fn(async () => {
      throw new Error('HTTP 429');
    }),
  });

  it('메인 성공이면 ok', async () => {
    const result = await createFallbackHexFetcher(ok('adsb.lol'), ok('adsb.fi'), () => NOW)(HEX);
    expect(result).toEqual({
      status: 'ok',
      payload: { hex: HEX, aircraft: plane, source: 'adsb.lol', fetchedAt: NOW },
    });
  });

  it('메인이 실패하면 예비 소스로 fallback', async () => {
    const fi = ok('adsb.fi');
    const result = await createFallbackHexFetcher(failing('adsb.lol'), fi, () => NOW)(HEX);
    expect(result.status).toBe('fallback');
    expect(fi.fetchByHex).toHaveBeenCalledWith(HEX);
  });

  it('둘 다 실패하면 degraded', async () => {
    const result = await createFallbackHexFetcher(failing('adsb.lol'), failing('adsb.fi'))(HEX);
    expect(result).toMatchObject({ status: 'degraded', payload: null });
  });

  it('응답은 왔는데 기체가 없으면 실패가 아니라 aircraft null로 발행', async () => {
    const result = await createFallbackHexFetcher(ok('adsb.lol', null), ok('adsb.fi'), () => NOW)(HEX);
    expect(result).toMatchObject({ status: 'ok', payload: { aircraft: null } });
  });
});

describe('TopicPoller 클라이언트당 토픽 수 상한', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(1_000_000);
  });
  afterEach(() => vi.useRealTimers());

  it('따라가기 중 다른 기체를 구독하면 이전 기체는 폴링에서 빠짐', async () => {
    const fetch = vi.fn(async (hex: string) => ({
      status: 'ok' as const,
      payload: { hex },
    }));
    const poller = new TopicPoller({
      parseTopic: (t) => (t.startsWith('aircraft/') ? t.slice(9) : null),
      fetch,
      publish: () => {},
      intervalMs: 5000,
      maxIntervalMs: 60_000,
      spacer: new RequestSpacer(250),
      maxTopicsPerClient: 1,
    });
    const client = {};
    poller.subscribe(client, 'aircraft/aaaaaa');
    expect(poller.activeCount).toBe(1);

    poller.subscribe(client, 'aircraft/bbbbbb');
    expect(poller.activeCount).toBe(1);
    expect(poller.isActive('aircraft/aaaaaa')).toBe(false);
    expect(poller.isActive('aircraft/bbbbbb')).toBe(true);

    // 다른 클라이언트가 같은 기체를 따라가면 조회는 하나
    poller.subscribe({}, 'aircraft/bbbbbb');
    expect(poller.activeCount).toBe(1);

    await vi.advanceTimersByTimeAsync(300);
    expect(fetch.mock.calls.map((c) => c[0])).toEqual(['bbbbbb']);
    poller.stopAll();
  });
});

describe('따라가기 서버 통합', () => {
  let running: RunningServer | null = null;
  const clients: MqttClient[] = [];

  afterEach(async () => {
    for (const c of clients.splice(0)) c.end(true);
    await running?.close();
    running = null;
  });

  const fetchFollow: FollowFetcher = async (hex) => ({
    status: 'ok',
    payload: {
      hex,
      aircraft: { ...normalizeFollowed(airborne, NOW)!, hex },
      source: 'adsb.lol',
      fetchedAt: NOW,
    },
  });

  const start = async (maxFollows: number) => {
    running = await startServer(
      { ...loadConfig({}), port: 0, maxFollows },
      {
        fetchSnapshot: async () => ({
          status: 'ok',
          snapshot: { aircraft: [], source: 'adsb.lol', fetchedAt: 1 },
        }),
        fetchFollow,
        host: '127.0.0.1',
      }
    );
    return running.port;
  };

  const connect = async (port: number) => {
    const client = mqtt.connect(`ws://127.0.0.1:${port}/mqtt`, { reconnectPeriod: 0 });
    clients.push(client);
    await new Promise<void>((resolve, reject) => {
      client.once('connect', () => resolve());
      client.once('error', reject);
    });
    return client;
  };

  const health = async (port: number): Promise<HealthResponse> =>
    (await fetch(`http://127.0.0.1:${port}/health`)).json() as Promise<HealthResponse>;

  /** SUBACK에서 받은 qos. 128이면 거절 (mqtt.js는 거절을 에러로 넘기므로 둘 다 처리) */
  const subscribeQos = async (client: MqttClient, topic: string): Promise<number> => {
    try {
      const granted = await client.subscribeAsync(topic);
      return granted[0]?.qos ?? -1;
    } catch (err) {
      const packet = (err as { packet?: { granted?: number[] } }).packet;
      return packet?.granted?.[0] ?? -1;
    }
  };

  it('aircraft/{hex}를 구독하면 따라가기 스냅샷을 받고 /health에 활성 수가 보임', async () => {
    const port = await start(20);
    const client = await connect(port);
    const received = new Promise<FollowSnapshot>((resolve) =>
      client.on('message', (_t, payload) => resolve(JSON.parse(payload.toString())))
    );
    expect(await subscribeQos(client, `aircraft/${HEX}`)).toBe(0);

    const snapshot = await received;
    expect(snapshot.hex).toBe(HEX);
    expect(snapshot.aircraft?.onGround).toBe(false);
    expect((await health(port)).activeFollows).toBe(1);
  });

  it('서버 전체 상한이 차면 새 기체는 거절하지만, 이미 따라가는 기체는 허용', async () => {
    const port = await start(1);
    const first = await connect(port);
    expect(await subscribeQos(first, 'aircraft/aaaaaa')).toBe(0);

    const second = await connect(port);
    expect(await subscribeQos(second, 'aircraft/bbbbbb')).toBe(128);
    expect(await subscribeQos(second, 'aircraft/aaaaaa')).toBe(0);
    expect((await health(port)).activeFollows).toBe(1);
  });

  it('형식이 틀린 따라가기 토픽은 거절', async () => {
    const port = await start(20);
    const client = await connect(port);
    expect(await subscribeQos(client, 'aircraft/#')).toBe(128);
    expect(await subscribeQos(client, 'aircraft/XYZ')).toBe(128);
  });
});
