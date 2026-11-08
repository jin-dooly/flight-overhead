import {
  parseFollowTopic,
  STATUS_TOPIC,
  type FollowSnapshot,
  type Snapshot,
  type SourceStatus,
} from '@flight/shared';
import mqtt, { type MqttClient } from 'mqtt';
import { MQTT_URL } from '../config';
import { useFlightsStore } from '../store/flights';
import { applyFollowSnapshot } from '../store/follow';

const SOURCE_STATUSES: readonly SourceStatus[] = ['ok', 'fallback', 'degraded'];

let client: MqttClient | null = null;

/**
 * 앱 전체에서 MQTT 연결은 하나만 씀. 처음 부를 때 연결하고, 이후에는 같은 연결을 돌려줌.
 * 지도 모드와 하늘 모드를 오가도 연결이 끊겼다 다시 붙지 않게 컴포넌트 밖에 둠.
 */
export const getMqttClient = (): MqttClient => {
  if (client) return client;

  client = mqtt.connect(MQTT_URL, {
    // 끊기면 2초마다 다시 붙음. 다시 붙으면 mqtt.js가 구독 중이던 토픽을 알아서 다시 구독함(resubscribe 기본값)
    reconnectPeriod: 2_000,
    connectTimeout: 10_000,
    // Render 프록시는 연결이 끊겨도 바로 알려 주지 않아서, 30초마다 핑을 보내 끊김을 빨리 알아챔
    keepalive: 30,
  });

  const setConnection = (connection: 'live' | 'reconnecting') =>
    useFlightsStore.setState({ connection });

  client.on('connect', () => {
    setConnection('live');
    client?.subscribe(STATUS_TOPIC);
  });
  client.on('reconnect', () => setConnection('reconnecting'));
  client.on('offline', () => setConnection('reconnecting'));

  client.on('message', (topic, payload) => {
    if (topic === STATUS_TOPIC) {
      const value = payload.toString() as SourceStatus;
      if (SOURCE_STATUSES.includes(value)) {
        useFlightsStore.setState({ sourceStatus: value });
      }
      return;
    }

    if (parseFollowTopic(topic)) {
      const follow = parseFollowSnapshot(payload.toString());
      if (follow) applyFollowSnapshot(follow);
      return;
    }

    // 격자를 바꾼 직후 이전 격자에서 늦게 도착한 메시지는 버림
    if (topic !== useFlightsStore.getState().topic) return;

    const snapshot = parseSnapshot(payload.toString());
    if (!snapshot) return;
    useFlightsStore.setState({
      snapshot,
      // 받은 순간을 서버의 fetchedAt 시각으로 봄. 사용자 기기 시계가 틀려도 이 차이를 빼면 서버 시각이 됨
      clockOffsetMs: Date.now() - snapshot.fetchedAt,
    });
  });

  return client;
};

/** 서버가 보낸 JSON이 깨졌거나 모양이 다르면 null. 화면이 이상한 값으로 그려지지 않게 함 */
const parseSnapshot = (text: string): Snapshot | null => {
  try {
    const data = JSON.parse(text) as Partial<Snapshot>;
    if (!Array.isArray(data.aircraft) || typeof data.fetchedAt !== 'number') {
      return null;
    }
    return data as Snapshot;
  } catch {
    return null;
  }
};

const parseFollowSnapshot = (text: string): FollowSnapshot | null => {
  try {
    const data = JSON.parse(text) as Partial<FollowSnapshot>;
    if (typeof data.hex !== 'string' || data.aircraft === undefined) return null;
    if (data.aircraft !== null && typeof data.aircraft?.lat !== 'number') return null;
    return data as FollowSnapshot;
  } catch {
    return null;
  }
};
