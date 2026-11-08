import type { Aircraft } from '@flight/shared';
import { describe, expect, it } from 'vitest';
import { distanceKm } from '../src/lib/geo/distance';
import {
  applyCorrection,
  CONVERGE_MS,
  MAX_PREDICT_MS,
  predictPosition,
  startCorrection,
} from '../src/lib/geo/interpolate';

const T0 = 1_700_000_000_000;

// 360kt = 시속 666.72km. 10초면 666.72 × 10 / 3600 = 1.852km
const aircraft = (overrides: Partial<Aircraft> = {}): Aircraft => ({
  hex: 'abc123',
  lat: 37.5,
  lon: 127,
  speedKt: 360,
  trackDeg: 0,
  seenAt: T0,
  ...overrides,
});

describe('predictPosition', () => {
  it('지난 시간이 0이면 마지막 위치 그대로', () => {
    expect(predictPosition(aircraft(), T0)).toEqual({ lat: 37.5, lon: 127 });
  });

  it('북쪽(0도)으로 10초 가면 1.852km 북쪽, 경도는 그대로', () => {
    const p = predictPosition(aircraft(), T0 + 10_000);
    expect(p.lat).toBeGreaterThan(37.5);
    expect(p.lon).toBeCloseTo(127, 9);
    expect(distanceKm({ lat: 37.5, lon: 127 }, p)).toBeCloseTo(1.852, 3);
  });

  it('동쪽(90도)으로 가면 위도는 그대로, 위도가 높아도 거리는 같음', () => {
    for (const lat of [0, 37.5, 60]) {
      const p = predictPosition(aircraft({ lat, trackDeg: 90 }), T0 + 10_000);
      expect(p.lat).toBeCloseTo(lat, 9);
      expect(p.lon).toBeGreaterThan(127);
      expect(distanceKm({ lat, lon: 127 }, p)).toBeCloseTo(1.852, 3);
    }
  });

  it('남서쪽(225도)이면 위도와 경도가 둘 다 줄어듦', () => {
    const p = predictPosition(aircraft({ trackDeg: 225 }), T0 + 10_000);
    expect(p.lat).toBeLessThan(37.5);
    expect(p.lon).toBeLessThan(127);
    expect(distanceKm({ lat: 37.5, lon: 127 }, p)).toBeCloseTo(1.852, 3);
  });

  it('속도나 방향을 모르면 움직이지 않음', () => {
    const at = T0 + 10_000;
    expect(predictPosition(aircraft({ speedKt: undefined }), at)).toEqual({
      lat: 37.5,
      lon: 127,
    });
    expect(predictPosition(aircraft({ trackDeg: undefined }), at)).toEqual({
      lat: 37.5,
      lon: 127,
    });
  });

  it(`${MAX_PREDICT_MS / 1000}초가 지나면 더 나아가지 않음`, () => {
    const atLimit = predictPosition(aircraft(), T0 + MAX_PREDICT_MS);
    const later = predictPosition(aircraft(), T0 + MAX_PREDICT_MS * 3);
    expect(later).toEqual(atLimit);
  });

  it('seenAt이 지금보다 미래(시계 오차)면 뒤로 가지 않고 그대로', () => {
    expect(predictPosition(aircraft(), T0 - 5_000)).toEqual({
      lat: 37.5,
      lon: 127,
    });
  });

  it('날짜변경선을 동쪽으로 넘으면 경도가 -180 쪽으로 이어짐', () => {
    const p = predictPosition(
      aircraft({ lat: 0, lon: 179.999, trackDeg: 90 }),
      T0 + 10_000
    );
    expect(p.lon).toBeLessThan(-179.9);
    expect(p.lon).toBeGreaterThanOrEqual(-180);
  });
});

describe('startCorrection / applyCorrection', () => {
  const shown = { lat: 37.51, lon: 127.02 };
  const predicted = { lat: 37.5, lon: 127 };
  const correction = startCorrection(shown, predicted, T0);

  it('보정이 없으면 예측 위치 그대로', () => {
    expect(applyCorrection(predicted, null, T0)).toEqual(predicted);
  });

  it('시작 순간에는 직전 화면 위치 (순간이동 없음)', () => {
    const p = applyCorrection(predicted, correction, T0);
    expect(p.lat).toBeCloseTo(shown.lat, 9);
    expect(p.lon).toBeCloseTo(shown.lon, 9);
  });

  it('절반 지나면 차이도 절반', () => {
    const p = applyCorrection(predicted, correction, T0 + CONVERGE_MS / 2);
    expect(p.lat).toBeCloseTo(37.505, 9);
    expect(p.lon).toBeCloseTo(127.01, 9);
  });

  it('1초가 지나면 예측 위치에 합류하고, 그 뒤로도 그대로', () => {
    for (const at of [T0 + CONVERGE_MS, T0 + CONVERGE_MS * 5]) {
      const p = applyCorrection(predicted, correction, at);
      expect(p.lat).toBeCloseTo(predicted.lat, 9);
      expect(p.lon).toBeCloseTo(predicted.lon, 9);
    }
  });

  it('보정 중에도 예측 위치가 움직이면 그만큼 따라 움직임', () => {
    const moved = { lat: 37.6, lon: 127 };
    const p = applyCorrection(moved, correction, T0 + CONVERGE_MS / 2);
    expect(p.lat).toBeCloseTo(37.605, 9); // 움직인 예측 위치 + 남은 차이 절반
  });

  it('날짜변경선 양쪽이면 짧은 쪽(0.2도)으로 보정', () => {
    const c = startCorrection({ lat: 0, lon: 179.9 }, { lat: 0, lon: -179.9 }, T0);
    expect(c.dLon).toBeCloseTo(-0.2, 9);
    const half = applyCorrection({ lat: 0, lon: -179.9 }, c, T0 + CONVERGE_MS / 2);
    expect(Math.abs(half.lon)).toBeCloseTo(180, 9); // 가운데 = 날짜변경선 위
  });
});
