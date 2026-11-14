import {
  parseFollowTopic,
  STATUS_TOPIC,
  type FollowSnapshot,
  type Snapshot,
  type SourceStatus,
} from '@flight/shared';
import type { Aedes } from 'aedes';
import { GridPoller, type PollerOptions } from './poller';
import type { FollowFetcher } from './sources';
import { TopicPoller, type RequestSpacer } from './topicPoller';

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
  opts: Omit<PollerOptions, 'publishSnapshot' | 'onStatusChange' | 'clearSnapshot'>
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
    // 아무도 안 보는 격자의 마지막 스냅샷을 남겨 두면, 나중에 다시 구독한 사람이 오래된 비행기를
    // 먼저 보게 되고 브로커 메모리에도 격자 수만큼 쌓임(2026-11-14 결정). 빈 payload의 retained
    // 발행은 MQTT 규칙상 "retained 지우기"이고, Aedes 기본 저장소(aedes-persistence)도 그렇게 처리함.
    // 따라가기 토픽은 지우지 않음: 다른 기체로 바꾼 클라이언트가 이전 토픽을 아직 구독하고 있을 수 있음
    clearSnapshot: (topic) => {
      publishRetained(broker, topic, '').catch((err) =>
        log(`스냅샷 지우기 실패 ${topic}: ${String(err)}`)
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

export type FollowPoller = TopicPoller<string, FollowSnapshot>;

/**
 * 따라가기 토픽(`aircraft/{hex}`) 폴러를 브로커에 연결.
 * 격자 폴러와 같은 동작(구독 수 추적, 백오프, retained 발행)을 쓰고, 다른 점은 셋:
 * - 연결 하나당 따라가기 1개: 다른 기체를 구독하면 이전 기체는 폴링 대상에서 빠짐
 * - 소스 상태(`status/source`)는 알리지 않음. 그 토픽은 격자 조회 결과를 뜻하므로 섞지 않음
 * - 요청 간격 예약표를 격자 폴러와 같이 써서 외부 API에 요청이 몰리지 않게 함
 */
export const connectFollowPollerToBroker = (
  broker: Aedes,
  opts: {
    fetchFollow: FollowFetcher;
    intervalMs: number;
    maxIntervalMs: number;
    spacer: RequestSpacer | null;
    log?: (message: string) => void;
  }
): FollowPoller => {
  const log = opts.log ?? (() => {});
  const poller: FollowPoller = new TopicPoller({
    parseTopic: parseFollowTopic,
    fetch: opts.fetchFollow,
    publish: (topic, snapshot) => {
      publishRetained(broker, topic, JSON.stringify(snapshot)).catch((err) =>
        log(`따라가기 발행 실패 ${topic}: ${String(err)}`)
      );
    },
    intervalMs: opts.intervalMs,
    maxIntervalMs: opts.maxIntervalMs,
    spacer: opts.spacer,
    maxTopicsPerClient: 1,
    label: '따라가기',
    log: opts.log,
  });

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
  broker.on('clientDisconnect', (client) => poller.removeClient(client));

  return poller;
};
