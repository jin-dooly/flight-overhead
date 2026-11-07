import type { IncomingMessage, Server } from 'node:http';
import type { Duplex } from 'node:stream';
import { parseSnapshotTopic, STATUS_TOPIC } from '@flight/shared';
import { Aedes, type AedesOptions, type Client } from 'aedes';
import { createWebSocketStream, WebSocketServer } from 'ws';

export const MQTT_PATH = '/mqtt';

/** 브라우저가 구독해도 되는 토픽인지. 와일드카드(+, #)는 파싱에 실패하므로 여기서 걸러짐 */
export const isSubscribableTopic = (topic: string): boolean =>
  topic === STATUS_TOPIC || parseSnapshotTopic(topic) !== null;

/**
 * 클라이언트의 발행은 Will 메시지까지 포함해 전부 거절.
 * 서버 코드가 `broker.publish()`로 직접 발행하는 경로는 이 핸들러를 거치지 않음(Aedes 1.2.0 문서).
 * 에러를 넘기면 Aedes가 해당 클라이언트 연결을 끊음.
 */
export const authorizePublish: NonNullable<AedesOptions['authorizePublish']> = (
  _client,
  _packet,
  callback
) => {
  callback(new Error('클라이언트 발행은 허용하지 않음'));
};

/**
 * 허용된 토픽만 구독. 거절은 연결을 끊지 않고 구독만 무효화(SUBACK 128)해서,
 * 잘못된 토픽 하나 때문에 나머지 구독까지 끊기지 않게 함.
 */
export const authorizeSubscribe: NonNullable<
  AedesOptions['authorizeSubscribe']
> = (_client, subscription, callback) => {
  callback(null, isSubscribableTopic(subscription.topic) ? subscription : null);
};

export const createBroker = (): Promise<Aedes> =>
  Aedes.createBroker({
    authorizePublish,
    authorizeSubscribe,
    // 응답 없는 클라이언트 하나가 전체 전송을 막지 않도록 문서 권장 범위(10~60초)의 값을 씀
    drainTimeout: 30_000,
  });

/**
 * Express와 같은 HTTP 서버의 `/mqtt` 경로로 들어오는 WebSocket 업그레이드를 Aedes에 연결.
 * 다른 경로의 업그레이드 요청은 소켓을 닫음.
 */
export const attachMqttWebSocket = (server: Server, broker: Aedes) => {
  const wss = new WebSocketServer({
    noServer: true,
    // 브라우저는 구독만 하므로 큰 프레임을 받을 이유가 없음
    maxPayload: 64 * 1024,
  });

  wss.on('connection', (socket, req: IncomingMessage) => {
    const stream = createWebSocketStream(socket);
    // 스트림 오류(비정상 종료 등)가 프로세스를 죽이지 않게 흡수. 정리는 Aedes가 함
    stream.on('error', () => {});
    broker.handle(stream, req);
  });

  const onUpgrade = (req: IncomingMessage, socket: Duplex, head: Buffer) => {
    const { pathname } = new URL(req.url ?? '/', 'http://localhost');
    if (pathname !== MQTT_PATH) {
      socket.destroy();
      return;
    }
    wss.handleUpgrade(req, socket, head, (ws) => {
      wss.emit('connection', ws, req);
    });
  };
  server.on('upgrade', onUpgrade);

  return {
    wss,
    close: () =>
      new Promise<void>((resolve) => {
        server.off('upgrade', onUpgrade);
        for (const ws of wss.clients) ws.terminate();
        wss.close(() => resolve());
      }),
  };
};

export type { Aedes, Client };
