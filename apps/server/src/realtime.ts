import { STATUS_TOPIC, type Snapshot, type SourceStatus } from '@flight/shared';
import type { Aedes } from 'aedes';
import { GridPoller, type PollerOptions } from './poller';

/** 서버 내부에서 브로커로 직접 발행. authorizePublish를 거치지 않음 */
export const publishRetained = (
  broker: Aedes,
  topic: string,
  payload: string
): Promise<void> =>
  new Promise((resolve, reject) =>
    broker.publish(
      {
        cmd: 'publish',
        topic,
        payload: Buffer.from(payload),
        qos: 0,
        // retained: 새 구독자가 다음 폴링까지 기다리지 않고 마지막 값을 바로 받게 함
        retain: true,
        dup: false,
      },
      (err) => (err ? reject(err) : resolve())
    )
  );

/**
 * 브로커의 구독 이벤트를 폴러에 연결하고, 폴러 결과를 retained 메시지로 발행.
 */
export const connectPollerToBroker = (
  broker: Aedes,
  opts: Omit<PollerOptions, 'publishSnapshot' | 'onStatusChange'>
): GridPoller => {
  const log = opts.log ?? (() => {});
  const poller = new GridPoller({
    ...opts,
    publishSnapshot: (topic, snapshot: Snapshot) => {
      publishRetained(broker, topic, JSON.stringify(snapshot)).catch((err) =>
        log(`스냅샷 발행 실패 ${topic}: ${String(err)}`)
      );
    },
    onStatusChange: (status: SourceStatus) => {
      log(`소스 상태 변경: ${status}`);
      publishRetained(broker, STATUS_TOPIC, status).catch((err) =>
        log(`상태 발행 실패: ${String(err)}`)
      );
    },
  });

  // subscribe 이벤트에는 거절된 구독(qos 128)도 들어 있으므로 제외.
  // 타입 정의는 qos를 0|1|2로만 적고 있지만 Aedes 1.2.0 문서와 구현은 128을 넣어 보냄
  broker.on('subscribe', (subscriptions, client) => {
    if (!client) return;
    for (const sub of subscriptions) {
      if ((sub.qos as number) !== 128) poller.subscribe(client, sub.topic);
    }
  });
  broker.on('unsubscribe', (topics, client) => {
    if (!client) return;
    for (const topic of topics) poller.unsubscribe(client, topic);
  });
  // 클라이언트 객체를 key로 써서, 같은 clientId로 재접속해도 이전 연결의 정리가
  // 새 연결의 구독을 지우지 않게 함
  broker.on('clientDisconnect', (client) => poller.removeClient(client));

  return poller;
};
