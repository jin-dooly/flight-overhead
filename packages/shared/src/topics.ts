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

export const FOLLOW_TOPIC_PREFIX = 'aircraft/';

// ICAO 24비트 주소(16진수 6자리, 소문자). adsb.fi의 `~`로 시작하는 TIS-B 임시 ID는
// 기체 ID 조회 API에서 찾을 수 없으므로 따라가기 대상에서 뺌
const HEX_RE = /^[0-9a-f]{6}$/;

/** 따라가기 토픽 이름. 예: `aircraft/71c9a3`. 대문자로 넘겨도 소문자로 맞춤 */
export const followTopic = (hex: string): string =>
  `${FOLLOW_TOPIC_PREFIX}${hex.trim().toLowerCase()}`;

/** 따라가기 토픽에서 기체 ID를 꺼냄. 형식이 틀리면(와일드카드 포함) null */
export const parseFollowTopic = (topic: string): string | null => {
  if (!topic.startsWith(FOLLOW_TOPIC_PREFIX)) return null;
  const hex = topic.slice(FOLLOW_TOPIC_PREFIX.length);
  return HEX_RE.test(hex) ? hex : null;
};

/** 따라갈 수 있는 기체 ID인지 (화면에서 "따라가기" 버튼을 보여 줄지 정할 때 씀) */
export const isFollowableHex = (hex: string): boolean =>
  HEX_RE.test(hex.trim().toLowerCase());
