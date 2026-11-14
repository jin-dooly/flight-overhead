import type { Snapshot, SourceStatus } from '@flight/shared';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { GridPoller } from '../src/poller';
import type { FetchResult } from '../src/sources';

const TOPIC_A = 'flights/37.5/127.1';
const TOPIC_B = 'flights/37.4/126.4';

const okResult = (status: 'ok' | 'fallback' = 'ok'): FetchResult => ({
  status,
  snapshot: {
    aircraft: [],
    source: status === 'ok' ? 'adsb.lol' : 'adsb.fi',
    fetchedAt: Date.now(),
  },
});
const degraded: FetchResult = {
  status: 'degraded',
  snapshot: null,
  errors: ['adsb.lol: x', 'adsb.fi: y'],
};

const setup = (
  fetchImpl: (
    lat: number,
    lon: number,
    radiusNm: number
  ) => Promise<FetchResult> = async () => okResult()
) => {
  const fetchSnapshot = vi.fn(fetchImpl);
  const published: { topic: string; snapshot: Snapshot; at: number }[] = [];
  const statuses: SourceStatus[] = [];
  const poller = new GridPoller({
    fetchSnapshot,
    publishSnapshot: (topic, snapshot) =>
      published.push({ topic, snapshot, at: Date.now() }),
    onStatusChange: (s) => statuses.push(s),
    intervalMs: 5000,
    maxIntervalMs: 60_000,
    radiusNm: 15,
    minRequestGapMs: 250,
    now: () => Date.now(),
  });
  return { poller, fetchSnapshot, published, statuses };
};

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(1_000_000);
});

afterEach(() => {
  vi.useRealTimers();
});

describe('GridPoller 구독 수 추적', () => {
  it('첫 구독 시 즉시 1회 조회하고 이후 5초 간격으로 조회한다', async () => {
    const { poller, fetchSnapshot, published } = setup();
    const client = {};

    poller.subscribe(client, TOPIC_A);
    expect(poller.activeGrids).toBe(1);

    await vi.advanceTimersByTimeAsync(0);
    expect(fetchSnapshot).toHaveBeenCalledTimes(1);
    expect(fetchSnapshot).toHaveBeenCalledWith(37.5, 127.1, 15);
    expect(published).toHaveLength(1);
    expect(published[0].topic).toBe(TOPIC_A);

    await vi.advanceTimersByTimeAsync(5000);
    expect(fetchSnapshot).toHaveBeenCalledTimes(2);
    await vi.advanceTimersByTimeAsync(5000);
    expect(fetchSnapshot).toHaveBeenCalledTimes(3);
  });

  it('같은 격자를 여러 클라이언트가 구독해도 폴링은 하나다', async () => {
    const { poller, fetchSnapshot } = setup();
    poller.subscribe('c1', TOPIC_A);
    poller.subscribe('c2', TOPIC_A);
    poller.subscribe('c2', TOPIC_A); // 중복 구독

    await vi.advanceTimersByTimeAsync(5000);
    expect(poller.activeGrids).toBe(1);
    expect(fetchSnapshot).toHaveBeenCalledTimes(2);
  });

  it('마지막 구독자가 해제하면 폴링을 멈춘다', async () => {
    const { poller, fetchSnapshot } = setup();
    poller.subscribe('c1', TOPIC_A);
    poller.subscribe('c2', TOPIC_A);
    await vi.advanceTimersByTimeAsync(0);

    poller.unsubscribe('c1', TOPIC_A);
    expect(poller.activeGrids).toBe(1);

    poller.unsubscribe('c2', TOPIC_A);
    expect(poller.activeGrids).toBe(0);

    await vi.advanceTimersByTimeAsync(60_000);
    expect(fetchSnapshot).toHaveBeenCalledTimes(1);
  });

  it('구독한 적 없는 토픽 해제나 중복 해제로 수가 어긋나지 않는다', async () => {
    const { poller } = setup();
    poller.subscribe('c1', TOPIC_A);
    poller.subscribe('c2', TOPIC_A);

    poller.unsubscribe('c3', TOPIC_A);
    poller.unsubscribe('c1', TOPIC_A);
    poller.unsubscribe('c1', TOPIC_A);
    expect(poller.activeGrids).toBe(1);
  });

  it('클라이언트 연결이 끊기면 그 클라이언트의 구독을 모두 정리한다', async () => {
    const { poller } = setup();
    poller.subscribe('c1', TOPIC_A);
    poller.subscribe('c1', TOPIC_B);
    poller.subscribe('c2', TOPIC_B);
    expect(poller.activeGrids).toBe(2);

    poller.removeClient('c1');
    expect(poller.activeGrids).toBe(1);
    poller.removeClient('c2');
    expect(poller.activeGrids).toBe(0);
  });

  it('마지막 구독자가 떠날 때만 그 격자의 스냅샷 지우기를 부른다', async () => {
    const cleared: string[] = [];
    const poller = new GridPoller({
      fetchSnapshot: async () => okResult(),
      publishSnapshot: () => {},
      onStatusChange: () => {},
      clearSnapshot: (topic) => cleared.push(topic),
      intervalMs: 5000,
      maxIntervalMs: 60_000,
      radiusNm: 15,
      spacer: null,
    });
    poller.subscribe('c1', TOPIC_A);
    poller.subscribe('c2', TOPIC_A);
    poller.subscribe('c1', TOPIC_B);
    await vi.advanceTimersByTimeAsync(0);

    poller.unsubscribe('c1', TOPIC_A);
    expect(cleared).toEqual([]); // c2가 아직 보고 있음
    poller.removeClient('c1');
    expect(cleared).toEqual([TOPIC_B]);
    poller.unsubscribe('c2', TOPIC_A);
    expect(cleared).toEqual([TOPIC_B, TOPIC_A]);
  });

  it('상태 토픽 같은 격자 아닌 토픽은 폴링을 시작하지 않는다', () => {
    const { poller } = setup();
    poller.subscribe('c1', 'status/source');
    expect(poller.activeGrids).toBe(0);
  });

  it('조회 중에 구독이 모두 해제되면 결과를 발행하지 않는다', async () => {
    let resolve!: (r: FetchResult) => void;
    const { poller, published } = setup(
      () => new Promise<FetchResult>((r) => (resolve = r))
    );
    poller.subscribe('c1', TOPIC_A);
    await vi.advanceTimersByTimeAsync(0);

    poller.unsubscribe('c1', TOPIC_A);
    resolve(okResult());
    await vi.advanceTimersByTimeAsync(0);

    expect(published).toHaveLength(0);
  });
});

describe('GridPoller 요청 분산', () => {
  it('여러 격자가 동시에 시작해도 요청 시작 시각을 250ms씩 띄운다', async () => {
    const { poller, fetchSnapshot } = setup();
    const starts: number[] = [];
    fetchSnapshot.mockImplementation(async () => {
      starts.push(Date.now());
      return okResult();
    });

    poller.subscribe('c1', 'flights/37.5/127.1');
    poller.subscribe('c2', 'flights/37.4/126.4');
    poller.subscribe('c3', 'flights/35.1/129.0');

    await vi.advanceTimersByTimeAsync(1000);
    expect(starts.map((t) => t - 1_000_000)).toEqual([0, 250, 500]);
  });

  it('한 격자의 긴 백오프 예약이 다른 격자의 요청을 밀어내지 않는다', async () => {
    const { poller, fetchSnapshot } = setup();
    const starts: { lat: number; at: number }[] = [];
    fetchSnapshot.mockImplementation(async (lat: number) => {
      starts.push({ lat, at: Date.now() - 1_000_000 });
      return lat === 37.5 ? degraded : okResult();
    });

    poller.subscribe('c1', TOPIC_A); // 계속 실패 → 10초 뒤 예약
    await vi.advanceTimersByTimeAsync(0);
    poller.subscribe('c2', TOPIC_B); // A의 10초 뒤 예약과 상관없이 250ms 뒤 시작해야 함
    await vi.advanceTimersByTimeAsync(250);

    expect(starts).toEqual([
      { lat: 37.5, at: 0 },
      { lat: 37.4, at: 0 + 250 },
    ]);
  });
});

describe('GridPoller 백오프와 상태', () => {
  it('둘 다 실패하면 10초, 20초, 40초, 60초로 늘리고 성공하면 5초로 돌아온다', async () => {
    const results: FetchResult[] = [
      degraded,
      degraded,
      degraded,
      degraded,
      degraded,
      okResult(),
      okResult(),
    ];
    const { poller, fetchSnapshot } = setup(async () => results.shift()!);
    const at: number[] = [];
    fetchSnapshot.mockImplementation(async () => {
      at.push(Date.now() - 1_000_000);
      return results.shift()!;
    });

    poller.subscribe('c1', TOPIC_A);
    await vi.advanceTimersByTimeAsync(10_000 + 20_000 + 40_000 + 60_000 + 60_000 + 5000);

    const gaps = at.slice(1).map((t, i) => t - at[i]);
    expect(gaps).toEqual([10_000, 20_000, 40_000, 60_000, 60_000, 5000]);
  });

  it('예비 소스 성공은 실패로 세지 않는다', async () => {
    const { poller, fetchSnapshot } = setup(async () => okResult('fallback'));
    poller.subscribe('c1', TOPIC_A);
    await vi.advanceTimersByTimeAsync(10_000);
    expect(fetchSnapshot).toHaveBeenCalledTimes(3);
  });

  it('상태가 바뀔 때만 상태 변경을 알린다', async () => {
    const results: FetchResult[] = [
      okResult(),
      okResult(),
      okResult('fallback'),
      okResult('fallback'),
      degraded,
      okResult(),
    ];
    const { poller, statuses } = setup(async () => results.shift()!);
    expect(poller.status).toBe('ok');

    poller.subscribe('c1', TOPIC_A);
    await vi.advanceTimersByTimeAsync(5000 * 4 + 10_000);

    expect(statuses).toEqual(['ok', 'fallback', 'degraded', 'ok']);
    expect(poller.status).toBe('ok');
  });

  it('조회 함수가 예외를 던져도 degraded로 처리하고 폴링을 이어간다', async () => {
    const { poller, fetchSnapshot, statuses } = setup(async () => {
      throw new Error('boom');
    });
    poller.subscribe('c1', TOPIC_A);
    await vi.advanceTimersByTimeAsync(10_000);
    expect(statuses).toEqual(['degraded']);
    expect(fetchSnapshot).toHaveBeenCalledTimes(2);
  });

  it('stopAll은 모든 폴링을 멈춘다', async () => {
    const { poller, fetchSnapshot } = setup();
    poller.subscribe('c1', TOPIC_A);
    poller.subscribe('c2', TOPIC_B);
    await vi.advanceTimersByTimeAsync(1000);
    poller.stopAll();
    expect(poller.activeGrids).toBe(0);
    await vi.advanceTimersByTimeAsync(60_000);
    expect(fetchSnapshot).toHaveBeenCalledTimes(2);
  });
});
