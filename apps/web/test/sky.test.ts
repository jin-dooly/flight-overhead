import type { Aircraft } from '@flight/shared';
import { describe, expect, it } from 'vitest';
import { angleDiff, pickLocked, projectToScreen, skyDirection } from '../src/lib/sky';

const me = { lat: 37.5, lon: 127 };
// 위도 0.09도 ≈ 10km 북쪽
const north10km = (altFt?: number): Aircraft => ({
  hex: 'a',
  lat: 37.5 + 0.0899,
  lon: 127,
  altFt,
  seenAt: 0,
});

describe('skyDirection', () => {
  it('10km 북쪽, 고도 10km(32,808ft)면 방위 0도, 올려다보는 각도 45도', () => {
    const d = skyDirection(me, north10km(32_808));
    expect(d?.azimuthDeg).toBeCloseTo(0, 3);
    expect(d?.elevationDeg).toBeCloseTo(45, 0);
    expect(d?.distanceKm).toBeCloseTo(Math.SQRT2 * 10, 0);
  });

  it('목업 값과 비슷한지: 5.9km 떨어진 8,000ft(2,440m) 비행기는 약 22도', () => {
    const a: Aircraft = { hex: 'b', lat: 37.5 + 0.053, lon: 127, altFt: 8000, seenAt: 0 };
    expect(skyDirection(me, a)?.elevationDeg).toBeCloseTo(22.5, 0);
  });

  it('고도를 모르면 null, 음수 고도(지면 근처)는 0으로', () => {
    expect(skyDirection(me, north10km(undefined))).toBeNull();
    expect(skyDirection(me, north10km(-50))?.elevationDeg).toBe(0);
  });
});

describe('angleDiff', () => {
  it('북쪽을 사이에 둔 차이는 짧은 쪽', () => {
    expect(angleDiff(10, 350)).toBe(20);
    expect(angleDiff(350, 10)).toBe(-20);
    expect(angleDiff(180, 0)).toBe(-180);
    expect(angleDiff(90, 45)).toBe(45);
  });
});

describe('projectToScreen', () => {
  const view = { headingDeg: 36, pitchDeg: 22, width: 390, centerY: 380, pxPerDeg: 4.33 };

  it('폰이 향한 방향과 각도에 있는 비행기는 화면 가운데', () => {
    const p = projectToScreen({ azimuthDeg: 36, elevationDeg: 22 }, view);
    expect(p.x).toBeCloseTo(195, 6);
    expect(p.y).toBeCloseTo(380, 6);
    expect(p.visible).toBe(true);
  });

  it('오른쪽(동쪽)으로 10도면 43px 오른쪽, 10도 더 높으면 43px 위', () => {
    const p = projectToScreen({ azimuthDeg: 46, elevationDeg: 32 }, view);
    expect(p.x).toBeCloseTo(195 + 43.3, 6);
    expect(p.y).toBeCloseTo(380 - 43.3, 6);
  });

  it('지평선(0도)은 목업처럼 가운데보다 약 95px 아래', () => {
    expect(projectToScreen({ azimuthDeg: 36, elevationDeg: 0 }, view).y).toBeCloseTo(475, 0);
  });

  it('등 뒤에 있으면 화면 밖', () => {
    expect(projectToScreen({ azimuthDeg: 216, elevationDeg: 22 }, view).visible).toBe(false);
  });
});

describe('pickLocked', () => {
  it('조준 원 안에서 가운데에 가장 가까운 것', () => {
    const points = [
      { id: 'far', x: 260, y: 380 },
      { id: 'near', x: 200, y: 385 },
      { id: 'mid', x: 215, y: 370 },
    ];
    expect(pickLocked(points, { x: 195, y: 380 }, 44)?.id).toBe('near');
  });

  it('원 밖이면 null', () => {
    expect(pickLocked([{ x: 300, y: 380 }], { x: 195, y: 380 }, 44)).toBeNull();
  });
});
