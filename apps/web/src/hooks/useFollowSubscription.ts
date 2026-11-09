import { followTopic } from '@flight/shared';
import { useEffect } from 'react';
import { getMqttClient } from '../lib/mqtt';
import { markFollowRejected, useFollowStore } from '../store/follow';

/**
 * 따라가는 기체의 토픽(`aircraft/{hex}`)을 구독함. 서버는 구독자가 있는 기체만 조회하므로
 * 따라가기를 끝내거나 착륙하면 바로 해제해서 서버 조회를 멈추게 함 (착륙 후 위치는 화면에 그대로 남김)
 */
export const useFollowSubscription = () => {
  const hex = useFollowStore((s) => s.hex);
  const landed = useFollowStore((s) => s.landedAt !== null);
  const rejected = useFollowStore((s) => s.rejected);
  const topic = hex && !landed && !rejected ? followTopic(hex) : null;

  useEffect(() => {
    if (!topic) return;
    const client = getMqttClient();
    client.subscribe(topic, (err, granted) => {
      // 서버 전체 따라가기 수가 상한이면 SUBACK 128로 거절됨 (mqtt.js는 이를 에러로 넘기기도 함)
      if (err || granted?.[0]?.qos === 128) markFollowRejected();
    });
    return () => {
      client.unsubscribe(topic);
    };
  }, [topic]);
};
