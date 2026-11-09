import type { FollowSnapshot } from '@flight/shared';
import { beforeEach, describe, expect, it } from 'vitest';
import {
  applyFollowSnapshot,
  startFollow,
  stopFollow,
  useFollowStore,
} from '../src/store/follow';

const T0 = 1_000_000;
const HEX = 'abc123';
const snap = (lat: number, seenAt: number, onGround = false): FollowSnapshot => ({
  hex: HEX,
  aircraft: { hex: HEX, lat, lon: 127, seenAt, onGround },
  source: 'adsb.lol',
  fetchedAt: seenAt,
});

beforeEach(() => {
  stopFollow();
  startFollow({ hex: HEX, lat: 37.5, lon: 127, seenAt: T0 });
});

describe('따라가기 스토어', () => {
  it('새 위치를 받으면 경로와 함께 이동한 거리를 늘림', () => {
    applyFollowSnapshot(snap(37.51, T0 + 6000)); // 약 1.1km 북쪽
    const s = useFollowStore.getState();
    expect(s.trail).toHaveLength(2);
    expect(s.traveledKm).toBeCloseTo(1.11, 1);
    expect(s.last?.seenAt).toBe(T0 + 6000);
  });

  it('같은 위치를 다시 받거나(retained) 다른 기체 메시지는 무시', () => {
    applyFollowSnapshot(snap(37.51, T0 + 6000));
    applyFollowSnapshot(snap(37.51, T0 + 6000));
    applyFollowSnapshot({ ...snap(37.6, T0 + 9000), hex: 'ffffff' });
    expect(useFollowStore.getState().trail).toHaveLength(2);
  });

  it('기체가 응답에 없으면(aircraft null) 마지막 위치를 그대로 둠', () => {
    applyFollowSnapshot({ ...snap(37.51, T0 + 6000), aircraft: null });
    expect(useFollowStore.getState().last?.seenAt).toBe(T0);
  });

  it('100km 넘게 튀면 이동 거리에 더하지 않고 경로를 새로 시작', () => {
    applyFollowSnapshot(snap(40, T0 + 6000)); // 약 278km
    const s = useFollowStore.getState();
    expect(s.traveledKm).toBe(0);
    expect(s.trail).toEqual([{ lat: 40, lon: 127 }]);
  });

  it('따라가는 동안 가장 높았던 고도를 기억', () => {
    applyFollowSnapshot({ ...snap(37.51, T0 + 6000), aircraft: { ...snap(37.51, T0 + 6000).aircraft!, altFt: 35000 } });
    applyFollowSnapshot({ ...snap(37.52, T0 + 12_000), aircraft: { ...snap(37.52, T0 + 12_000).aircraft!, altFt: 20000 } });
    expect(useFollowStore.getState().maxAltFt).toBe(35000);
  });

  it('지상으로 바뀌면 착륙 시각을 정하고, 그 뒤 메시지는 무시', () => {
    applyFollowSnapshot(snap(37.51, T0 + 6000, true));
    expect(useFollowStore.getState().landedAt).toBe(T0 + 6000);
    applyFollowSnapshot(snap(37.52, T0 + 12_000, false));
    expect(useFollowStore.getState().last?.lat).toBe(37.51);
  });
});
