import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { RequestSpacer, spaced, TopicPoller } from '../src/topicPoller';

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(1_000_000);
});
afterEach(() => vi.useRealTimers());

describe('외부 요청 간격 (spaced)', () => {
  it('동시에 부른 요청은 1.1초씩 띄워서 보냄', async () => {
    const started: number[] = [];
    const request = spaced(new RequestSpacer(1100), async (id: string) => {
      started.push(Date.now());
      return id;
    });
    const all = Promise.all([request('a'), request('b'), request('c')]);
    await vi.advanceTimersByTimeAsync(3000);
    expect(await all).toEqual(['a', 'b', 'c']);
    expect(started).toEqual([1_000_000, 1_001_100, 1_002_200]);
  });
});

describe('예약표 없는 폴러', () => {
  it('격자가 여러 개여도 서로 기다리지 않고 바로 조회함 (외부 요청은 fetch 안에서 간격을 지킴)', async () => {
    const fetch = vi.fn(async (key: string) => ({ status: 'ok' as const, payload: key }));
    const poller = new TopicPoller({
      parseTopic: (t) => t,
      fetch,
      publish: () => {},
      intervalMs: 5000,
      maxIntervalMs: 60_000,
      spacer: null,
    });
    for (const t of ['g1', 'g2', 'g3', 'g4', 'g5']) poller.subscribe({}, t);
    await vi.advanceTimersByTimeAsync(1);
    expect(fetch).toHaveBeenCalledTimes(5);
    poller.stopAll();
  });
});
