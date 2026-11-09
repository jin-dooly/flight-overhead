import type { Aircraft } from '@flight/shared';
import { describe, expect, it } from 'vitest';
import { distanceKm } from '../src/lib/geo/distance';
import {
  applyCorrection,
  CONVERGE_MS,
  MAX_PREDICT_MS,
  LOW_ALTITUDE_PREDICT_MS,
  NEAR_GROUND_PREDICT_MS,
  MAX_TURN_S,
  moveKm,
  predictPosition,
  predictTrack,
  SOFT_STOP_MS,
  softElapsed,
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

  it(`${MAX_PREDICT_MS / 1000}초 뒤에는 서서히 멈추고, 상한 + 2초 거리보다 더 가지 않음`, () => {
    const atLimit = predictPosition(aircraft(), T0 + MAX_PREDICT_MS);
    const later = predictPosition(aircraft(), T0 + MAX_PREDICT_MS * 3);
    const travelled = distanceKm(atLimit, later);
    expect(travelled).toBeGreaterThan(0);
    expect(travelled).toBeLessThanOrEqual(0.1852 * (SOFT_STOP_MS / 1000) + 1e-9); // 360kt = 초당 0.1852km
  });

  it('예측 상한을 따로 주면 그 시간까지 예측함 (따라가기는 3분)', () => {
    const at60 = predictPosition(aircraft(), T0 + 60_000, 180_000);
    const at30 = predictPosition(aircraft(), T0 + 30_000, 180_000);
    expect(at60.lat).toBeGreaterThan(at30.lat);
    // 지도 기본값(30초)은 60초 뒤에도 30초 + 2초 거리 안
    expect(distanceKm(predictPosition(aircraft(), T0 + 60_000), predictPosition(aircraft(), T0 + MAX_PREDICT_MS))).toBeLessThanOrEqual(0.371);
  });

  it('착륙한 비행기(onGround)는 따라가기 예측 시간이 길어도 움직이지 않음', () => {
    const landed = { ...aircraft(), onGround: true };
    expect(predictPosition(landed, T0 + 60_000, 180_000)).toEqual({ lat: 37.5, lon: 127 });
  });

  it('지면 근처(100ft 미만)에서는 3초까지만 예측 (활주 중 감속을 모르니 오래 가면 지나침)', () => {
    const rolling = aircraft({ altFt: 40 });
    expect(
      distanceKm(predictPosition(rolling, T0 + 30_000), predictPosition(rolling, T0 + NEAR_GROUND_PREDICT_MS))
    ).toBeLessThanOrEqual(0.371);
    expect(predictPosition(aircraft({ altFt: 5000 }), T0 + 30_000).lat).toBeGreaterThan(
      predictPosition(rolling, T0 + 30_000).lat
    );
  });

  it('3000ft 아래(접근 중)에서는 따라가기여도 20초 근처에서 멈춤', () => {
    const approach = aircraft({ altFt: 1500 });
    expect(
      distanceKm(
        predictPosition(approach, T0 + 120_000, 180_000),
        predictPosition(approach, T0 + LOW_ALTITUDE_PREDICT_MS, 180_000)
      )
    ).toBeLessThanOrEqual(0.371);
    // 다음 조회(약 12초 뒤)가 올 때까지는 멈추지 않고 계속 감
    const at12 = predictPosition(approach, T0 + 12_000, 180_000);
    const at11 = predictPosition(approach, T0 + 11_000, 180_000);
    expect(distanceKm(at11, at12)).toBeCloseTo(0.1852, 3);
  });

  it('상한에서 갑자기 서지 않고 속도가 이어지다 줄어듦', () => {
    expect(softElapsed(10_000, 10_000)).toBe(10_000);
    // 상한 직후 0.1초는 거의 0.1초만큼 감 (속도가 이어짐)
    expect(softElapsed(10_100, 10_000) - 10_000).toBeGreaterThan(95);
    // 오래 지나도 상한 + 2초를 넘지 않음
    expect(softElapsed(100_000, 10_000)).toBeLessThanOrEqual(10_000 + SOFT_STOP_MS);
    expect(softElapsed(-5, 10_000)).toBe(0);
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

describe('선회 예측 (moveKm)', () => {
  it('선회율이 없거나 아주 작으면 직선과 같음', () => {
    const straight = moveKm(360, 45, undefined, 10);
    expect(moveKm(360, 45, 0.05, 10).north).toBeCloseTo(straight.north, 9);
    expect(straight.north).toBeCloseTo(1.852 * Math.cos(Math.PI / 4), 6);
  });

  it('북쪽으로 가다 초당 3도 오른쪽 선회 30초면 동쪽을 향하고, 반지름 r인 원의 1/4을 돎', () => {
    const v = 0.1852; // 360kt = 초당 0.1852km
    const r = v / ((3 * Math.PI) / 180); // 약 3.537km
    const m = moveKm(360, 0, 3, 30);
    expect(m.north).toBeCloseTo(r, 6);
    expect(m.east).toBeCloseTo(r, 6);
  });

  it('왼쪽 선회(음수)는 서쪽으로 휨', () => {
    expect(moveKm(360, 0, -3, 30).east).toBeLessThan(0);
  });

  it(`선회는 ${MAX_TURN_S}초까지만 이어지고, 그 뒤는 그 방향으로 직진`, () => {
    const at30 = moveKm(360, 0, 3, 30);
    const at40 = moveKm(360, 0, 3, 40);
    expect(at40.north).toBeCloseTo(at30.north, 6); // 30초 뒤에는 동쪽(90도)으로 직진
    expect(at40.east - at30.east).toBeCloseTo(1.852, 6);
  });

  it('선회 중인 비행기는 직선 예측보다 실제 원호에 가까운 곳으로 감', () => {
    const turning = { hex: 'abc123', lat: 37.5, lon: 127, speedKt: 180, trackDeg: 0, trackRateDegS: 3, seenAt: T0 };
    const curved = predictPosition(turning, T0 + 12_000);
    const straight = predictPosition({ ...turning, trackRateDegS: undefined }, T0 + 12_000);
    // 12초, 초당 3도면 36도 돌아서 오른쪽(동쪽)으로 휨. 직선 예측과 수백 m 차이
    expect(curved.lon).toBeGreaterThan(straight.lon);
    expect(distanceKm(curved, straight)).toBeGreaterThan(0.3);
  });
});

describe('predictTrack', () => {
  const base = { hex: 'abc123', lat: 37.5, lon: 127, speedKt: 180, trackDeg: 350, seenAt: T0 };

  it('선회율만큼 돌린 방향 (350도에서 초당 3도로 10초면 20도)', () => {
    expect(predictTrack({ ...base, trackRateDegS: 3 }, T0 + 10_000)).toBeCloseTo(20, 6);
  });

  it('선회율이 없거나 착륙했으면 마지막 방향 그대로', () => {
    expect(predictTrack(base, T0 + 10_000)).toBe(350);
    expect(predictTrack({ ...base, trackRateDegS: 3, onGround: true }, T0 + 10_000)).toBe(350);
  });

  it(`${MAX_TURN_S}초 넘게는 돌리지 않음`, () => {
    expect(predictTrack({ ...base, trackDeg: 0, trackRateDegS: 3 }, T0 + 25_000, 180_000)).toBeCloseTo(75, 6);
    expect(predictTrack({ ...base, trackDeg: 0, trackRateDegS: 3 }, T0 + 60_000, 180_000)).toBeCloseTo(90, 6);
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
