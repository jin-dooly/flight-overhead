import { describe, expect, it } from 'vitest';
import { distanceKm, sortByDistance } from '../src/lib/geo/distance';

// 지구 반지름 6371km 기준 위도 1도의 길이 (2πR / 360)
const ONE_DEGREE_KM = (2 * Math.PI * 6371) / 360; // 약 111.19km

const SEOUL = { lat: 37.5665, lon: 126.978 }; // 서울시청
const BUSAN = { lat: 35.1796, lon: 129.0756 }; // 부산시청

describe('distanceKm', () => {
  it('같은 지점은 0km', () => {
    expect(distanceKm(SEOUL, SEOUL)).toBe(0);
  });

  it('위도 1도는 약 111km', () => {
    expect(distanceKm({ lat: 37, lon: 127 }, { lat: 38, lon: 127 })).toBeCloseTo(
      ONE_DEGREE_KM,
      6
    );
  });

  it('경도 1도는 위도가 높을수록 짧아짐 (위도 60도에서 약 절반)', () => {
    const equator = distanceKm({ lat: 0, lon: 0 }, { lat: 0, lon: 1 });
    const lat60 = distanceKm({ lat: 60, lon: 0 }, { lat: 60, lon: 1 });
    expect(equator).toBeCloseTo(ONE_DEGREE_KM, 6);
    expect(lat60).toBeCloseTo(ONE_DEGREE_KM / 2, 0); // 약 55.6km
  });

  it('서울시청에서 부산시청까지 직선거리 약 325km', () => {
    expect(distanceKm(SEOUL, BUSAN)).toBeGreaterThan(320);
    expect(distanceKm(SEOUL, BUSAN)).toBeLessThan(330);
  });

  it('방향을 바꿔도 거리는 같음', () => {
    expect(distanceKm(SEOUL, BUSAN)).toBeCloseTo(distanceKm(BUSAN, SEOUL), 9);
  });

  it('지구 반대편(정반대 지점)도 NaN 없이 반 바퀴(πR)', () => {
    const d = distanceKm({ lat: 0, lon: 0 }, { lat: 0, lon: 180 });
    expect(d).toBeCloseTo(Math.PI * 6371, 6);
  });

  it('날짜변경선을 넘어도 짧은 쪽 거리', () => {
    // 경도 179.9와 -179.9는 0.2도 차이 (359.8도가 아님)
    const d = distanceKm({ lat: 0, lon: 179.9 }, { lat: 0, lon: -179.9 });
    expect(d).toBeCloseTo(ONE_DEGREE_KM * 0.2, 6);
  });
});

describe('sortByDistance', () => {
  const center = { lat: 37.5, lon: 127 };
  const near = { hex: 'near', lat: 37.55, lon: 127 }; // 약 5.6km
  const mid = { hex: 'mid', lat: 37.6, lon: 127 }; // 약 11.1km
  const far = { hex: 'far', lat: 37.8, lon: 127 }; // 약 33.4km

  it('가까운 순으로 정렬하고 거리를 붙임', () => {
    const result = sortByDistance([far, near, mid], center);
    expect(result.map((r) => r.item.hex)).toEqual(['near', 'mid', 'far']);
    expect(result[0].distanceKm).toBeCloseTo(ONE_DEGREE_KM * 0.05, 6);
  });

  it('원래 배열은 바꾸지 않음', () => {
    const input = [far, near, mid];
    sortByDistance(input, center);
    expect(input.map((a) => a.hex)).toEqual(['far', 'near', 'mid']);
  });

  it('빈 배열이면 빈 배열', () => {
    expect(sortByDistance([], center)).toEqual([]);
  });

  it('원래 객체의 다른 필드를 그대로 유지', () => {
    const [first] = sortByDistance([{ ...near, callsign: 'KAL123' }], center);
    expect(first.item.callsign).toBe('KAL123');
  });
});
