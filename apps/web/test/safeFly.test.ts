import { describe, expect, it, vi } from 'vitest';
import { flyToBoundsSafe, flyToSafe } from '../src/components/map/safeFly';

// leaflet은 브라우저가 있어야 불러올 수 있어서, 필요한 함수만 가진 가짜 지도로 확인
const fakeMap = (x: number, y: number) => ({
  getSize: vi.fn(() => ({ x, y })),
  getZoom: vi.fn(() => 11),
  flyTo: vi.fn(),
  flyToBounds: vi.fn(),
  setView: vi.fn(),
});

type FakeMap = ReturnType<typeof fakeMap>;
const asMap = (m: FakeMap) => m as unknown as Parameters<typeof flyToSafe>[0];

describe('flyToSafe', () => {
  it('지도 크기가 있으면 flyTo로 날아감', () => {
    const map = fakeMap(375, 600);
    flyToSafe(asMap(map), [37.5, 126.5], 11, { duration: 2 });
    expect(map.flyTo).toHaveBeenCalledWith([37.5, 126.5], 11, { duration: 2 });
    expect(map.setView).not.toHaveBeenCalled();
  });

  it('너비나 높이가 0이면 flyTo 대신 애니메이션 없이 옮김 (Leaflet flyTo가 NaN 오류를 던지는 경우)', () => {
    for (const [x, y] of [
      [0, 0],
      [0, 600],
      [375, 0],
    ]) {
      const map = fakeMap(x, y);
      flyToSafe(asMap(map), [37.5, 126.5], 11, { duration: 2 });
      expect(map.flyTo).not.toHaveBeenCalled();
      expect(map.setView).toHaveBeenCalledWith([37.5, 126.5], 11, { animate: false });
    }
  });
});

describe('flyToBoundsSafe', () => {
  const bounds: [[number, number], [number, number]] = [
    [37.4, 126.4],
    [37.6, 126.6],
  ];

  it('지도 크기가 있으면 flyToBounds로 날아감', () => {
    const map = fakeMap(375, 600);
    flyToBoundsSafe(asMap(map), bounds, { duration: 1 });
    expect(map.flyToBounds).toHaveBeenCalledWith(bounds, { duration: 1 });
  });

  it('크기가 0이면 줌은 그대로 두고 범위 가운데로만 옮김', () => {
    const map = fakeMap(0, 0);
    flyToBoundsSafe(asMap(map), bounds, { duration: 1 });
    expect(map.flyToBounds).not.toHaveBeenCalled();
    const [center, zoom, options] = map.setView.mock.calls[0];
    expect(center[0]).toBeCloseTo(37.5);
    expect(center[1]).toBeCloseTo(126.5);
    expect(zoom).toBe(11);
    expect(options).toEqual({ animate: false });
  });
});
