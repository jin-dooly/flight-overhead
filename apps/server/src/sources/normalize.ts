import type { Aircraft } from '@flight/shared';

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

  const callsign = typeof item.flight === 'string' ? item.flight.trim() : '';
  const seenPos = num(item.seen_pos);

  const aircraft: Aircraft = {
    hex,
    lat,
    lon,
    seenAt: seenPos !== undefined ? now - seenPos * 1000 : now,
  };
  if (callsign) aircraft.callsign = callsign;
  const altFt = num(item.alt_baro);
  if (altFt !== undefined) aircraft.altFt = altFt;
  const speedKt = num(item.gs);
  if (speedKt !== undefined) aircraft.speedKt = speedKt;
  const trackDeg = num(item.track);
  if (trackDeg !== undefined) aircraft.trackDeg = trackDeg;
  return aircraft;
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
  return list
    .map((raw) => normalizeAircraft(raw, now))
    .filter((a): a is Aircraft => a !== null);
};
