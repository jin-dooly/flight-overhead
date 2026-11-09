import { describe, expect, it } from 'vitest';
import { AIRPORTS, arrivalLabel, departureLabel, describePlace } from '../src/lib/airports';

describe('describePlace', () => {
  it('공항 8km 안이면 그 공항 (활주로 끝도 같은 공항)', () => {
    const place = describePlace({ lat: 33.507, lon: 126.47 }); // 제주공항 활주로 서쪽 끝 근처
    expect(place).toMatchObject({ kind: 'airport', airport: { iata: 'CJU' } });
    expect(arrivalLabel(place)).toEqual({ title: '제주국제공항', short: '제주 (CJU)' });
  });

  it('공항에서 떨어져 있으면 가장 가까운 도시 근처/상공', () => {
    const place = describePlace({ lat: 37.6, lon: 126.2 }); // 인천공항 북서쪽 약 27km
    expect(place).toMatchObject({ kind: 'near', airport: { iata: 'ICN' } });
    expect(departureLabel(place)).toBe('인천 상공');
    expect(arrivalLabel(place).title).toBe('인천 근처');
  });

  it('김포와 인천처럼 가까운 공항도 더 가까운 쪽으로', () => {
    expect(describePlace({ lat: 37.558, lon: 126.79 })).toMatchObject({ airport: { iata: 'GMP' } });
  });

  it('목록 공항에서 멀면 알 수 없음', () => {
    const place = describePlace({ lat: 50, lon: 170 });
    expect(place.kind).toBe('unknown');
    expect(arrivalLabel(place).title).toBe('도착 지점');
    expect(departureLabel(place)).toBe('출발 지점');
  });

  it('공항 목록의 IATA 코드는 겹치지 않음', () => {
    const codes = AIRPORTS.map((a) => a.iata);
    expect(new Set(codes).size).toBe(codes.length);
  });
});
