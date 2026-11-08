import type { Aircraft } from '@flight/shared';
import { describe, expect, it } from 'vitest';
import { pickCardTarget, splitByRadius } from '../src/lib/nearby';

const center = { lat: 37.5, lon: 127 };
// 위도 0.1도 ≈ 11.1km
const plane = (hex: string, dLat: number): Aircraft => ({
  hex,
  lat: 37.5 + dLat,
  lon: 127,
  seenAt: 0,
});
const a5 = plane('a5', 0.045); // 약 5km
const a15 = plane('a15', 0.135); // 약 15km
const a25 = plane('a25', 0.225); // 약 25km
const a35 = plane('a35', 0.315); // 약 35km

describe('splitByRadius', () => {
  it('반경 안은 가까운 순, 밖에서는 가장 가까운 하나', () => {
    const { inside, nearestOutside } = splitByRadius([a25, a15, a35, a5], center, 20);
    expect(inside.map((r) => r.item.hex)).toEqual(['a5', 'a15']);
    expect(nearestOutside?.item.hex).toBe('a25');
  });

  it('반경을 30km로 넓히면 25km 비행기도 안으로', () => {
    const { inside, nearestOutside } = splitByRadius([a25, a35], center, 30);
    expect(inside.map((r) => r.item.hex)).toEqual(['a25']);
    expect(nearestOutside?.item.hex).toBe('a35');
  });

  it('비행기가 없으면 둘 다 비어 있음', () => {
    expect(splitByRadius([], center, 20)).toEqual({ inside: [], nearestOutside: null });
  });
});

describe('pickCardTarget', () => {
  const { inside } = splitByRadius([a5, a15], center, 20);

  it('고른 비행기가 없으면 가장 가까운 비행기', () => {
    expect(pickCardTarget(inside, null)).toMatchObject({
      kind: 'nearest',
      target: { item: { hex: 'a5' } },
    });
  });

  it('고른 비행기가 반경 안에 있으면 그 비행기', () => {
    expect(pickCardTarget(inside, 'a15')).toMatchObject({
      kind: 'selected',
      target: { item: { hex: 'a15' } },
    });
  });

  it('고른 비행기가 반경 밖으로 나갔으면 가장 가까운 비행기로 돌아감', () => {
    expect(pickCardTarget(inside, 'a35')).toMatchObject({
      kind: 'nearest',
      target: { item: { hex: 'a5' } },
    });
  });

  it('반경 안에 아무도 없으면 null', () => {
    expect(pickCardTarget([], 'a5')).toBeNull();
  });
});
