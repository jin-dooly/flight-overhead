import type { Aircraft, FollowedAircraft } from '@flight/shared';

const num = (value: unknown): number | undefined =>
  typeof value === 'number' && Number.isFinite(value) ? value : undefined;

/**
 * readsb 형식(adsb.lol, adsb.fi 공통)의 기체 항목 하나를 공통 모델로 바꿈.
 * 위치가 없거나 지상 기체면 null.
 */
export const normalizeAircraft = (
  raw: unknown,
  now: number
): Aircraft | null => {
  if (typeof raw !== 'object' || raw === null) return null;
  const item = raw as Record<string, unknown>;

  const hex = typeof item.hex === 'string' ? item.hex.trim() : '';
  const lat = num(item.lat);
  const lon = num(item.lon);
  if (!hex || lat === undefined || lon === undefined) return null;
  if (item.alt_baro === 'ground') return null;

  const flight = typeof item.flight === 'string' ? item.flight.trim() : '';
  // 편명을 모르는 기체는 "@@@@@@@@"로 오기도 함(ADS-B 편명 칸의 빈 값). 편명 없음으로 처리
  const callsign = /^@+$/.test(flight) ? '' : flight;
  const seenPos = num(item.seen_pos);

  const aircraft: Aircraft = {
    hex,
    lat,
    lon,
    seenAt: seenPos !== undefined ? now - seenPos * 1000 : now,
  };
  if (callsign) aircraft.callsign = callsign;
  // 고도는 기하 고도(GPS, alt_geom)를 먼저 씀 (사용자 결정 2026-11-09).
  // 기압 고도(alt_baro)는 표준 기압(1013.25hPa) 기준이라, 기압이 높은 날에는 실제보다 낮게 나와
  // 이착륙 중인 비행기가 -400ft처럼 마이너스가 됐음. 기하 고도가 없는 기체만 기압 고도를 씀
  const altFt = num(item.alt_geom) ?? num(item.alt_baro);
  if (altFt !== undefined) aircraft.altFt = altFt;
  const speedKt = num(item.gs);
  if (speedKt !== undefined) aircraft.speedKt = speedKt;
  const trackDeg = num(item.track);
  if (trackDeg !== undefined) aircraft.trackDeg = trackDeg;
  return aircraft;
};

/** 응답 시각이 우리 서버 시계와 이보다 크게 다르면, 응답 시각을 믿지 않고 받은 시각을 씀 */
const MAX_CLOCK_SKEW_MS = 60_000;

/**
 * 위치 시각(seenAt)을 계산할 기준 시각.
 * `seen_pos`는 "응답을 만든 시각(now)으로부터 몇 초 전"이라서, 받은 시각이 아니라 응답 시각에서 빼야 맞음.
 * adsb.fi 응답은 만들어진 지 약 2초 뒤에 도착해서(2026-11-09 측정), 받은 시각에서 빼면
 * 위치가 2초 신선한 것으로 잘못 계산되고 예측이 그만큼 뒤처졌음.
 * - adsb.lol은 ms, adsb.fi는 초 단위(정수)로 옴
 * - 응답 시각이 없거나 우리 시계와 1분 넘게 다르면(어느 쪽 시계가 틀림) 받은 시각을 씀
 */
export const responseTime = (body: unknown, receivedAt: number): number => {
  const raw =
    typeof body === 'object' && body !== null
      ? num((body as Record<string, unknown>).now)
      : undefined;
  if (raw === undefined) return receivedAt;
  const ms = raw < 1e12 ? raw * 1000 : raw;
  return Math.abs(ms - receivedAt) > MAX_CLOCK_SKEW_MS ? receivedAt : ms;
};

/** 응답 본문에서 `listKey` 배열을 꺼내 정규화. 배열이 없으면 형식 오류로 보고 throw */
export const normalizeResponse = (
  body: unknown,
  listKey: string,
  now: number
): Aircraft[] => {
  const list =
    typeof body === 'object' && body !== null
      ? (body as Record<string, unknown>)[listKey]
      : undefined;
  if (!Array.isArray(list)) {
    throw new Error(`응답에 "${listKey}" 배열이 없음`);
  }
  const base = responseTime(body, now);
  return list
    .map((raw) => normalizeAircraft(raw, base))
    .filter((a): a is Aircraft => a !== null);
};

/**
 * 따라가기용 정규화. 격자와 달리 지상 기체를 버리지 않고 `onGround: true`로 표시함
 * (기획서 따라가기 설계: 지상 여부를 함께 보내서 "착륙했어요"를 보여 줌)
 */
export const normalizeFollowed = (
  raw: unknown,
  now: number
): FollowedAircraft | null => {
  if (typeof raw !== 'object' || raw === null) return null;
  const item = raw as Record<string, unknown>;
  const onGround = item.alt_baro === 'ground';
  // 지상이면 기압 고도가 "ground" 문자열이고 고도 자체가 의미 없어서, 고도 필드를 빼고 공통 정규화를 씀
  const aircraft = normalizeAircraft(
    onGround ? { ...item, alt_baro: undefined, alt_geom: undefined } : item,
    now
  );
  return aircraft ? { ...aircraft, onGround } : null;
};

/**
 * 기체 ID 조회 응답에서 그 기체를 꺼냄. 응답에 없으면(수신 범위 밖) null.
 * 목록 키는 소스와 API마다 달라서(adsb.fi는 좌표 조회는 `aircraft`, 기체 ID 조회는 `ac`) 둘 다 봄.
 * 목록 자체가 없으면 형식 오류로 보고 throw (예비 전환 조건)
 */
export const normalizeHexResponse = (
  body: unknown,
  hex: string,
  now: number
): FollowedAircraft | null => {
  const record =
    typeof body === 'object' && body !== null ? (body as Record<string, unknown>) : {};
  const list = [record.ac, record.aircraft].find(Array.isArray);
  if (!list) throw new Error('응답에 "ac"나 "aircraft" 배열이 없음');
  const base = responseTime(body, now);
  for (const raw of list) {
    const followed = normalizeFollowed(raw, base);
    if (followed && followed.hex.toLowerCase() === hex) return followed;
  }
  return null;
};
