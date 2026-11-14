import type { Snapshot } from '@flight/shared';
import mqtt, { type MqttClient } from 'mqtt';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  startServer,
  type HealthResponse,
  type RunningServer,
} from '../src/app';
import { loadConfig } from '../src/config';
import type { FetchResult } from '../src/sources';

// 서버 전체(Express + Aedes + 폴러)를 띄우되 외부 API 대신 가짜 조회 함수를 씀
describe('서버 통합', () => {
  let running: RunningServer | null = null;
  const clients: MqttClient[] = [];

  afterEach(async () => {
    for (const c of clients.splice(0)) c.end(true);
    await running?.close();
    running = null;
  });

  const start = async (fetchSnapshot: () => Promise<FetchResult>) => {
    running = await startServer(
      { ...loadConfig({}), port: 0 },
      { fetchSnapshot, host: '127.0.0.1' }
    );
    return running;
  };

  const connect = async (port: number) => {
    const client = mqtt.connect(`ws://127.0.0.1:${port}/mqtt`, {
      reconnectPeriod: 0,
    });
    clients.push(client);
    await new Promise<void>((resolve, reject) => {
      client.once('connect', () => resolve());
      client.once('error', reject);
    });
    return client;
  };

  const health = async (port: number): Promise<HealthResponse> =>
    (await fetch(`http://127.0.0.1:${port}/health`)).json() as Promise<HealthResponse>;

  const waitFor = async (check: () => boolean | Promise<boolean>) => {
    for (let i = 0; i < 50; i++) {
      if (await check()) return;
      await new Promise((r) => setTimeout(r, 20));
    }
    throw new Error('조건을 기다리다 시간 초과');
  };

  it('/health가 활성 격자 수와 소스 상태를 알려준다', async () => {
    const { port } = await start(async () => ({
      status: 'ok',
      snapshot: { aircraft: [], source: 'adsb.lol', fetchedAt: 1 },
    }));
    expect(await health(port)).toEqual({
      status: 'ok',
      activeGrids: 0,
      activeFollows: 0,
      source: 'ok',
    });
  });

  it('격자를 구독하면 폴링이 시작되고 스냅샷과 상태를 받으며, 연결을 끊으면 멈춘다', async () => {
    const snapshot: Snapshot = {
      aircraft: [{ hex: 'abc', lat: 37.51, lon: 127.09, seenAt: 1 }],
      source: 'adsb.fi',
      fetchedAt: 2,
    };
    const fetchSnapshot = vi.fn(
      async (): Promise<FetchResult> => ({ status: 'fallback', snapshot })
    );
    const { port } = await start(fetchSnapshot);

    const client = await connect(port);
    const messages = new Map<string, string>();
    client.on('message', (topic, payload) =>
      messages.set(topic, payload.toString())
    );
    await client.subscribeAsync(['flights/37.5/127.1', 'status/source']);

    await waitFor(() => messages.size === 2);
    // 한반도 안 격자는 지역 통째 조회 결과에서 자기 반경 안 비행기만 받음.
    // fetchedAt은 보내는 시각으로 바뀜(브라우저 시계 보정용)
    const received = JSON.parse(messages.get('flights/37.5/127.1')!) as Snapshot;
    expect(received.aircraft).toEqual(snapshot.aircraft);
    expect(received.source).toBe('adsb.fi');
    expect(messages.get('status/source')).toBe('fallback');
    expect(fetchSnapshot).toHaveBeenCalledWith(36.5, 127.5, 250);
    expect(await health(port)).toEqual({
      status: 'ok',
      activeGrids: 1,
      activeFollows: 0,
      source: 'fallback',
    });

    client.end(true);
    await waitFor(async () => (await health(port)).activeGrids === 0);
  });

  it('구독을 해제하면 폴링이 멈춘다', async () => {
    const { port } = await start(async () => ({
      status: 'ok',
      snapshot: { aircraft: [], source: 'adsb.lol', fetchedAt: 1 },
    }));
    const client = await connect(port);
    await client.subscribeAsync('flights/37.5/127.1');
    await waitFor(async () => (await health(port)).activeGrids === 1);

    await client.unsubscribeAsync('flights/37.5/127.1');
    await waitFor(async () => (await health(port)).activeGrids === 0);
  });

  it('폴링을 멈춘 격자의 retained 스냅샷은 지워져서, 다시 구독해도 오래된 스냅샷을 받지 않는다', async () => {
    const { port } = await start(async () => ({
      status: 'ok',
      snapshot: { aircraft: [], source: 'adsb.lol', fetchedAt: 1 },
    }));

    const first = await connect(port);
    const firstMessages: string[] = [];
    first.on('message', (_t, payload) => firstMessages.push(payload.toString()));
    await first.subscribeAsync('flights/37.5/127.1');
    await waitFor(() => firstMessages.length === 1);
    first.end(true);
    await waitFor(async () => (await health(port)).activeGrids === 0);

    const second = await connect(port);
    // 다시 구독하면 폴링이 새로 시작돼 새 스냅샷이 오므로, 브로커가 저장해 둔 retained로 온 것만 셈
    const retained: string[] = [];
    let fresh = 0;
    second.on('message', (_t, payload, packet) => {
      if (packet.retain) retained.push(payload.toString());
      else fresh += 1;
    });
    await second.subscribeAsync('flights/37.5/127.1');
    await waitFor(() => fresh >= 1);
    expect(retained).toEqual([]);
  });
});
