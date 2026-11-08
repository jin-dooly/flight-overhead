import { describe, expect, it } from 'vitest';
import {
  compassName,
  formatAgo,
  formatAltitude,
  formatDistanceKm,
  formatSpeed,
  formatTrack,
} from '../src/lib/format';
import { DELAY_THRESHOLD_MS, deriveDataStatus } from '../src/lib/mapStatus';

describe('formatAltitude', () => {
  it('ft를 10m 단위 m로 바꾸고 원래 ft도 같이 (목업: 8,000 ft → 2,440 m)', () => {
    expect(formatAltitude(8000)).toEqual({ main: '2,440 m', sub: '8,000 ft' });
    expect(formatAltitude(11000)).toEqual({ main: '3,350 m', sub: '11,000 ft' });
  });

  it('값이 없으면 null', () => {
    expect(formatAltitude(undefined)).toBeNull();
  });
});

describe('formatSpeed', () => {
  it('kt를 km/h로 (목업: 250 kt → 463 km/h)', () => {
    expect(formatSpeed(250)).toEqual({ main: '463 km/h', sub: '250 kt' });
    expect(formatSpeed(300)).toEqual({ main: '556 km/h', sub: '300 kt' });
  });

  it('값이 없으면 null', () => {
    expect(formatSpeed(undefined)).toBeNull();
  });
});

describe('compassName / formatTrack', () => {
  it('8방위', () => {
    expect([0, 45, 90, 135, 180, 225, 270, 315].map(compassName)).toEqual([
      '북',
      '북동',
      '동',
      '남동',
      '남',
      '남서',
      '서',
      '북서',
    ]);
  });

  it('경계는 ±22.5도, 360도와 음수도 처리', () => {
    expect(compassName(22)).toBe('북');
    expect(compassName(23)).toBe('북동');
    expect(compassName(359)).toBe('북');
    expect(compassName(360)).toBe('북');
    expect(compassName(-90)).toBe('서');
  });

  it('목업 값: 215° → 남서, 300° → 북서', () => {
    expect(formatTrack(215)).toEqual({ main: '남서', sub: '215°' });
    expect(formatTrack(300)).toEqual({ main: '북서', sub: '300°' });
    expect(formatTrack(undefined)).toBeNull();
  });
});

describe('formatDistanceKm', () => {
  it('100km 미만은 소수점 한 자리, 그 이상은 정수', () => {
    expect(formatDistanceKm(5.94)).toBe('5.9');
    expect(formatDistanceKm(0.04)).toBe('0.0');
    expect(formatDistanceKm(13.1)).toBe('13.1');
    expect(formatDistanceKm(21.8)).toBe('21.8');
    expect(formatDistanceKm(123.4)).toBe('123');
  });
});

describe('formatAgo', () => {
  it('초, 분', () => {
    expect(formatAgo(3_200)).toBe('3초 전');
    expect(formatAgo(45_000)).toBe('45초 전');
    expect(formatAgo(125_000)).toBe('2분 전');
  });

  it('음수(시계 오차)는 0초', () => {
    expect(formatAgo(-2_000)).toBe('0초 전');
  });
});

describe('deriveDataStatus', () => {
  const base = { connection: 'live' as const, sourceStatus: 'ok' as const, snapshotAgeMs: 3_000 };

  it('연결 중이거나 재연결 중이면 그 상태가 우선', () => {
    expect(deriveDataStatus({ ...base, connection: 'connecting' })).toBe('connecting');
    expect(
      deriveDataStatus({ ...base, connection: 'reconnecting', sourceStatus: 'degraded' })
    ).toBe('reconnecting');
  });

  it('정상', () => {
    expect(deriveDataStatus(base)).toBe('live');
    expect(deriveDataStatus({ ...base, sourceStatus: 'fallback' })).toBe('live'); // 예비 소스도 실시간
    expect(deriveDataStatus({ ...base, snapshotAgeMs: null })).toBe('live');
  });

  it('서버가 degraded를 알리거나 스냅샷이 오래되면 지연', () => {
    expect(deriveDataStatus({ ...base, sourceStatus: 'degraded' })).toBe('delayed');
    expect(deriveDataStatus({ ...base, snapshotAgeMs: DELAY_THRESHOLD_MS + 1 })).toBe('delayed');
    expect(deriveDataStatus({ ...base, snapshotAgeMs: DELAY_THRESHOLD_MS })).toBe('live');
  });
});
