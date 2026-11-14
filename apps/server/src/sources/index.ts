import type { FollowSnapshot, Snapshot, SourceName } from '@flight/shared';
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

export type SourceOrderOptions = {
  /**
   * true면 부를 때마다 먼저 시도할 소스를 바꿈(첫 번째 → 두 번째 → 첫 번째 …).
   * false면 항상 첫 번째 소스부터(메인/예비)
   */
  alternate?: boolean;
};

/**
 * 이번에 시도할 소스 순서를 돌려주는 함수를 만듦.
 * 번갈아 부르기에서도 먼저 시도한 소스가 실패하면 같은 요청을 다른 소스로 재시도하는 건 그대로임
 */
const createSourceOrder = <S>(first: S, second: S, alternate: boolean) => {
  let calls = 0;
  return (): [S, S] => {
    const swap = alternate && calls % 2 === 1;
    calls += 1;
    return swap ? [second, first] : [first, second];
  };
};

type Attempt<R> =
  | { ok: true; value: R; source: SourceName; status: 'ok' | 'fallback' }
  | { ok: false; errors: string[] };

/** 정한 순서로 시도. 먼저 시도한 소스가 성공하면 ok, 다른 소스로 성공하면 fallback */
const tryInOrder = async <S extends { name: SourceName }, R>(
  order: [S, S],
  call: (source: S) => Promise<R>
): Promise<Attempt<R>> => {
  const errors: string[] = [];
  for (const [index, source] of order.entries()) {
    try {
      const value = await call(source);
      return { ok: true, value, source: source.name, status: index === 0 ? 'ok' : 'fallback' };
    } catch (err) {
      errors.push(`${source.name}: ${errorMessage(err)}`);
    }
  }
  return { ok: false, errors };
};

/**
 * 첫 소스를 먼저 부르고, 실패하면 같은 요청을 다른 소스로 재시도.
 * 한 소스가 일시적으로 막혀도 사용자 화면이 끊기지 않게 하는 것이 목적이라,
 * 다음 요청은 다시 정해진 순서대로 시도함(막혔던 소스가 회복되면 바로 `ok`로 돌아옴).
 */
export const createFallbackFetcher = (
  primary: AircraftSource,
  fallback: AircraftSource,
  now: () => number = Date.now,
  { alternate = false }: SourceOrderOptions = {}
): SnapshotFetcher => {
  const nextOrder = createSourceOrder(primary, fallback, alternate);
  return async (lat, lon, radiusNm) => {
    const attempt = await tryInOrder(nextOrder(), (s) => s.fetchAircraft(lat, lon, radiusNm));
    if (!attempt.ok) return { status: 'degraded', snapshot: null, errors: attempt.errors };
    return {
      status: attempt.status,
      snapshot: { aircraft: attempt.value, source: attempt.source, fetchedAt: now() },
    };
  };
};

// adsb.lol과 adsb.fi를 번갈아 부름 (2026-11-14 사용자 결정).
// adsb.lol만 메인으로 5초마다 부르니 1분에 앞의 3~4번만 성공하고 나머지는 429였음(Render 로그).
// 번갈아 부르면 소스마다 요청이 절반(1분에 6번)이 됨. 한쪽이 실패하면 같은 요청을 다른 쪽으로 다시 부르는 건 그대로.
// 이전 결정(2026-11-09, adsb.lol 메인): adsb.fi는 응답이 약 1초 늦고 시각이 초 단위라 따라가기가 어색해 보였음.
// 번갈아 부르면 이 차이가 섞여 들어오지만, 429로 adsb.fi에 넘어가던 지금도 이미 섞이고 있었음
const ALTERNATE: SourceOrderOptions = { alternate: true };

export const createDefaultFetcher = (opts: SourceOptions): SnapshotFetcher =>
  createFallbackFetcher(createAdsbLolSource(opts), createAdsbFiSource(opts), Date.now, ALTERNATE);

export type FollowFetcher = (hex: string) => Promise<PollResult<FollowSnapshot>>;

/**
 * 따라가기용 예비 전환. 격자와 같은 규칙: 먼저 시도한 소스 실패(네트워크, 타임아웃, 2xx 아님, 형식 오류) 시 다른 소스.
 * 응답은 왔지만 그 기체가 없으면 실패가 아니라 `aircraft: null`(신호 끊김)로 발행함
 */
export const createFallbackHexFetcher = (
  primary: HexSource,
  fallback: HexSource,
  now: () => number = Date.now,
  { alternate = false }: SourceOrderOptions = {}
): FollowFetcher => {
  const nextOrder = createSourceOrder(primary, fallback, alternate);
  return async (hex) => {
    const attempt = await tryInOrder(nextOrder(), (s) => s.fetchByHex(hex));
    if (!attempt.ok) return { status: 'degraded', payload: null, errors: attempt.errors };
    return {
      status: attempt.status,
      payload: { hex, aircraft: attempt.value, source: attempt.source, fetchedAt: now() },
    };
  };
};

export const createDefaultFollowFetcher = (opts: SourceOptions): FollowFetcher =>
  createFallbackHexFetcher(createAdsbLolSource(opts), createAdsbFiSource(opts), Date.now, ALTERNATE);

const errorMessage = (err: unknown): string =>
  err instanceof Error ? err.message : String(err);
