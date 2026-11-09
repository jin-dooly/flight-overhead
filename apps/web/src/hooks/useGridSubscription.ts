import { snapshotTopic, toGrid } from '@flight/shared';
import { useEffect } from 'react';
import { useFlightsStore } from '../store/flights';
import { useLocationStore } from '../store/location';
import { getMqttClient } from '../lib/mqtt';

/**
 * 지금 위치의 격자 토픽을 구독함. 위치가 다른 격자로 바뀌면 이전 격자를 구독 해제하고 새 격자를 구독함.
 * 서버는 구독자가 있는 격자만 폴링하므로, 해제를 빠뜨리면 아무도 안 보는 격자를 계속 폴링하게 됨.
 */
export const useGridSubscription = () => {
  // 정확한 좌표가 아니라 토픽 문자열(0.1도 격자)을 기준으로 삼음.
  // 같은 격자 안에서 조금 움직이면 문자열이 같아서 다시 구독하지 않음
  const topic = useLocationStore((s) => {
    if (s.status === 'pending') return null; // 위치를 기다리는 동안은 기본 위치 격자를 구독하지 않음
    const grid = toGrid(s.lat, s.lon);
    return snapshotTopic(grid.lat, grid.lon);
  });

  useEffect(() => {
    if (!topic) return;
    // 이전 격자의 비행기가 새 위치에 잠깐 보이지 않게 스냅샷을 비움
    useFlightsStore.setState({ topic, snapshot: null });
    const client = getMqttClient();
    if (!client) return; // 연결을 만들지 못함 (lib/mqtt.ts)
    client.subscribe(topic);
    return () => {
      client.unsubscribe(topic);
    };
  }, [topic]);
};
