import type { FollowedAircraft } from '@flight/shared';
import { describe, expect, it } from 'vitest';
import { FOLLOW_LOST_MS, deriveFollowPhase, formatDuration } from '../src/lib/follow';
import { bearingDeg } from '../src/lib/geo/bearing';

describe('bearingDeg', () => {
  const c = { lat: 37.5, lon: 127 };

  it('정북, 정동, 정남, 정서', () => {
    expect(bearingDeg(c, { lat: 38, lon: 127 })).toBeCloseTo(0, 6);
    expect(bearingDeg(c, { lat: 37.5, lon: 127.1 })).toBeCloseTo(90, 1);
    expect(bearingDeg(c, { lat: 37, lon: 127 })).toBeCloseTo(180, 6);
    expect(bearingDeg(c, { lat: 37.5, lon: 126.9 })).toBeCloseTo(270, 1);
  });

  it('항상 0~360', () => {
    const b = bearingDeg(c, { lat: 37.6, lon: 126.9 }); // 북서
    expect(b).toBeGreaterThan(270);
    expect(b).toBeLessThan(360);
  });

  it('서울시청 → 부산시청은 남동쪽(남쪽 약 265km, 동쪽 약 185km → 약 144도)', () => {
    const b = bearingDeg({ lat: 37.5665, lon: 126.978 }, { lat: 35.1796, lon: 129.0756 });
    expect(b).toBeGreaterThan(140);
    expect(b).toBeLessThan(148);
  });
});

describe('deriveFollowPhase', () => {
  const T0 = 1_000_000;
  const plane = (seenAt: number): FollowedAircraft => ({
    hex: 'abc123',
    lat: 37.5,
    lon: 127,
    seenAt,
    onGround: false,
  });

  it('첫 위치를 받기 전에는 waiting, 30초가 지나도 안 오면 lost', () => {
    expect(deriveFollowPhase({ last: null, landedAt: null, startedAt: T0, nowMs: T0 + 1000 })).toBe('waiting');
    expect(
      deriveFollowPhase({ last: null, landedAt: null, startedAt: T0, nowMs: T0 + FOLLOW_LOST_MS + 1 })
    ).toBe('lost');
  });

  it('위치가 30초 안이면 active, 넘으면 lost, 다시 오면 active', () => {
    const base = { landedAt: null, startedAt: T0 };
    expect(deriveFollowPhase({ ...base, last: plane(T0), nowMs: T0 + FOLLOW_LOST_MS })).toBe('active');
    expect(deriveFollowPhase({ ...base, last: plane(T0), nowMs: T0 + FOLLOW_LOST_MS + 1 })).toBe('lost');
    expect(deriveFollowPhase({ ...base, last: plane(T0 + 40_000), nowMs: T0 + 41_000 })).toBe('active');
  });

  it('착륙하면 그 뒤로는 계속 landed', () => {
    expect(
      deriveFollowPhase({ last: plane(T0), landedAt: T0, startedAt: T0, nowMs: T0 + 999_999 })
    ).toBe('landed');
  });
});

describe('formatDuration', () => {
  it('분, 시간', () => {
    expect(formatDuration(30_000)).toBe('1분 미만');
    expect(formatDuration(12 * 60_000)).toBe('12분');
    expect(formatDuration(58 * 60_000 + 59_000)).toBe('58분');
    expect(formatDuration(60 * 60_000)).toBe('1시간');
    expect(formatDuration(65 * 60_000)).toBe('1시간 5분');
  });
});
