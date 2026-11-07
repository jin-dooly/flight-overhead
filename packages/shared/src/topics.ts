import { round1 } from './grid';

export const STATUS_TOPIC = 'status/source';
export const SNAPSHOT_TOPIC_PREFIX = 'flights/';

/** 격자 좌표로 스냅샷 토픽 이름을 만듦. 예: `flights/37.5/127.1` */
export const snapshotTopic = (lat: number, lon: number): string =>
  `${SNAPSHOT_TOPIC_PREFIX}${round1(lat).toFixed(1)}/${round1(lon).toFixed(1)}`;

// 소수점 첫째 자리까지 정확히 한 자리. `37.50`, `+37.5`, `37`, 와일드카드(+, #)는 모두 거절
const SNAPSHOT_TOPIC_RE = /^flights\/(-?\d{1,3}\.\d)\/(-?\d{1,3}\.\d)$/;

/** 스냅샷 토픽을 격자 좌표로 파싱. 형식이 틀리거나 범위 밖이면 null */
export const parseSnapshotTopic = (
  topic: string
): { lat: number; lon: number } | null => {
  const match = SNAPSHOT_TOPIC_RE.exec(topic);
  if (!match) return null;
  const lat = Number(match[1]);
  const lon = Number(match[2]);
  if (lat < -90 || lat > 90 || lon < -180 || lon > 180) return null;
  // `-0.0`처럼 snapshotTopic이 만들지 않는 표기는 같은 격자의 다른 토픽이 되므로 거절
  if (snapshotTopic(lat, lon) !== topic) return null;
  return { lat, lon };
};
