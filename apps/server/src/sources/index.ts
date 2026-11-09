import type { FollowSnapshot, Snapshot } from '@flight/shared';
import type { PollResult } from '../topicPoller';
import { createAdsbFiSource } from './adsbFi';
import { createAdsbLolSource } from './adsbLol';
import type { AircraftSource, HexSource, SourceOptions } from './types';

export type { AircraftSource, HexSource, SourceOptions } from './types';
export { createAdsbFiSource, createAdsbLolSource };

export type FetchResult =
  | { status: 'ok' | 'fallback'; snapshot: Snapshot }
  | { status: 'degraded'; snapshot: null; errors: string[] };

export type SnapshotFetcher = (
  lat: number,
  lon: number,
  radiusNm: number
) => Promise<FetchResult>;

/**
 * 메인 소스를 먼저 부르고, 실패하면 같은 요청을 예비 소스로 재시도.
 * 메인이 일시적으로 막혀도 사용자 화면이 끊기지 않게 하는 것이 목적이라,
 * 다음 요청은 다시 메인부터 시도함(메인이 회복되면 바로 `ok`로 돌아옴).
 */
export const createFallbackFetcher = (
  primary: AircraftSource,
  fallback: AircraftSource,
  now: () => number = Date.now
): SnapshotFetcher => {
  return async (lat, lon, radiusNm) => {
    const errors: string[] = [];
    const sources: [AircraftSource, 'ok' | 'fallback'][] = [
      [primary, 'ok'],
      [fallback, 'fallback'],
    ];
    for (const [source, status] of sources) {
      try {
        const aircraft = await source.fetchAircraft(lat, lon, radiusNm);
        return {
          status,
          snapshot: { aircraft, source: source.name, fetchedAt: now() },
        };
      } catch (err) {
        errors.push(`${source.name}: ${errorMessage(err)}`);
      }
    }
    return { status: 'degraded', snapshot: null, errors };
  };
};

// 메인은 adsb.fi, 예비는 adsb.lol (2026-11-09 사용자 결정).
// adsb.lol은 호출 제한 기준이 공개되지 않았고("부하에 따라 바뀜") 실제로 429가 자주 났음.
// adsb.fi는 "1초에 1번"으로 기준이 분명해서, 요청 간격을 맞추면 막히지 않음
export const createDefaultFetcher = (opts: SourceOptions): SnapshotFetcher =>
  createFallbackFetcher(createAdsbFiSource(opts), createAdsbLolSource(opts));

export type FollowFetcher = (hex: string) => Promise<PollResult<FollowSnapshot>>;

/**
 * 따라가기용 예비 전환. 격자와 같은 규칙: 메인 실패(네트워크, 타임아웃, 2xx 아님, 형식 오류) 시 예비 소스.
 * 응답은 왔지만 그 기체가 없으면 실패가 아니라 `aircraft: null`(신호 끊김)로 발행함
 */
export const createFallbackHexFetcher = (
  primary: HexSource,
  fallback: HexSource,
  now: () => number = Date.now
): FollowFetcher => {
  return async (hex) => {
    const errors: string[] = [];
    const sources: [HexSource, 'ok' | 'fallback'][] = [
      [primary, 'ok'],
      [fallback, 'fallback'],
    ];
    for (const [source, status] of sources) {
      try {
        const aircraft = await source.fetchByHex(hex);
        return {
          status,
          payload: { hex, aircraft, source: source.name, fetchedAt: now() },
        };
      } catch (err) {
        errors.push(`${source.name}: ${errorMessage(err)}`);
      }
    }
    return { status: 'degraded', payload: null, errors };
  };
};

export const createDefaultFollowFetcher = (opts: SourceOptions): FollowFetcher =>
  createFallbackHexFetcher(createAdsbFiSource(opts), createAdsbLolSource(opts));

const errorMessage = (err: unknown): string =>
  err instanceof Error ? err.message : String(err);
