import type { Snapshot } from '@flight/shared';
import { createAdsbFiSource } from './adsbFi';
import { createAdsbLolSource } from './adsbLol';
import type { AircraftSource, SourceOptions } from './types';

export type { AircraftSource, SourceOptions } from './types';
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

export const createDefaultFetcher = (opts: SourceOptions): SnapshotFetcher =>
  createFallbackFetcher(createAdsbLolSource(opts), createAdsbFiSource(opts));

const errorMessage = (err: unknown): string =>
  err instanceof Error ? err.message : String(err);
