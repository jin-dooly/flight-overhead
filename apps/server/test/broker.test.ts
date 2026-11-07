import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import mqtt, { type MqttClient } from 'mqtt';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  attachMqttWebSocket,
  createBroker,
  isSubscribableTopic,
  type Aedes,
} from '../src/broker';

describe('isSubscribableTopic', () => {
  it('스냅샷 토픽과 상태 토픽만 허용한다', () => {
    expect(isSubscribableTopic('flights/37.5/127.1')).toBe(true);
    expect(isSubscribableTopic('status/source')).toBe(true);
    expect(isSubscribableTopic('flights/+/+')).toBe(false);
    expect(isSubscribableTopic('#')).toBe(false);
    expect(isSubscribableTopic('$SYS/#')).toBe(false);
    expect(isSubscribableTopic('flights/37.55/127.1')).toBe(false);
  });
});

// 실제 Aedes + WebSocket 위에서 권한 규칙을 확인. 외부 API는 부르지 않음
describe('MQTT 브로커 (WebSocket)', () => {
  let server: Server;
  let broker: Aedes;
  let ws: ReturnType<typeof attachMqttWebSocket>;
  let url: string;
  const clients: MqttClient[] = [];

  beforeEach(async () => {
    broker = await createBroker();
    server = createServer();
    ws = attachMqttWebSocket(server, broker);
    await new Promise<void>((r) => server.listen(0, '127.0.0.1', r));
    url = `ws://127.0.0.1:${(server.address() as AddressInfo).port}/mqtt`;
  });

  afterEach(async () => {
    for (const c of clients.splice(0)) c.end(true);
    await ws.close();
    await new Promise<void>((r) => broker.close(() => r()));
    await new Promise<void>((r) => server.close(() => r()));
  });

  const connect = async () => {
    const client = mqtt.connect(url, { reconnectPeriod: 0 });
    clients.push(client);
    await new Promise<void>((resolve, reject) => {
      client.once('connect', () => resolve());
      client.once('error', reject);
    });
    return client;
  };

  it('/mqtt 경로로 연결되고 허용된 토픽 구독이 승인된다', async () => {
    const client = await connect();
    const granted = await client.subscribeAsync([
      'flights/37.5/127.1',
      'status/source',
    ]);
    expect(granted.map((g) => g.qos)).toEqual([0, 0]);
  });

  it('허용되지 않은 토픽 구독은 128로 거절된다', async () => {
    const client = await connect();
    // mqtt.js 5는 SUBACK 128을 에러로 돌려줌. 에러 안의 packet으로 거절 코드를 확인
    const error = await client
      .subscribeAsync(['flights/#', 'other/topic'])
      .then(() => null, (err: { packet?: { granted?: number[] } }) => err);
    expect(error?.packet?.granted).toEqual([128, 128]);
    // 거절돼도 연결은 유지되어 허용된 토픽은 계속 구독 가능
    expect(client.connected).toBe(true);
    const granted = await client.subscribeAsync('status/source');
    expect(granted[0].qos).toBe(0);
  });

  it('서버가 발행한 retained 스냅샷을 새 구독자가 바로 받는다', async () => {
    await new Promise<void>((resolve, reject) =>
      broker.publish(
        {
          cmd: 'publish',
          topic: 'flights/37.5/127.1',
          payload: Buffer.from('{"aircraft":[]}'),
          qos: 0,
          retain: true,
          dup: false,
        },
        (err) => (err ? reject(err) : resolve())
      )
    );
    const client = await connect();
    const received = new Promise<string>((resolve) =>
      client.on('message', (_topic, payload) => resolve(payload.toString()))
    );
    await client.subscribeAsync('flights/37.5/127.1');
    expect(await received).toBe('{"aircraft":[]}');
  });

  it('클라이언트가 발행하면 메시지가 전달되지 않고 연결이 끊긴다', async () => {
    const listener = await connect();
    await listener.subscribeAsync('flights/37.5/127.1');
    let leaked = false;
    listener.on('message', () => {
      leaked = true;
    });

    const attacker = await connect();
    const closed = new Promise<void>((r) => attacker.once('close', () => r()));
    attacker.publish('flights/37.5/127.1', 'fake');
    await closed;

    // 혹시 늦게 도착하는 메시지가 없는지 잠시 기다림
    await new Promise((r) => setTimeout(r, 100));
    expect(leaked).toBe(false);
  });

  it('다른 경로의 WebSocket 업그레이드는 거절된다', async () => {
    const bad = mqtt.connect(url.replace('/mqtt', '/other'), {
      reconnectPeriod: 0,
      connectTimeout: 2000,
    });
    clients.push(bad);
    await new Promise<void>((resolve) => {
      bad.once('error', () => resolve());
      bad.once('close', () => resolve());
    });
    expect(bad.connected).toBe(false);
  });
});
