import { describe, expect, it } from 'vitest';
import { ALTITUDE_BANDS, altitudeBand, altitudeBandName } from '../src/lib/altitude';

describe('altitudeBand', () => {
  it('고도를 네 구간으로 나눈다 (경계값은 위 구간)', () => {
    expect(altitudeBand(0)).toBe('approach');
    expect(altitudeBand(2_999)).toBe('approach');
    expect(altitudeBand(3_000)).toBe('low');
    expect(altitudeBand(9_999)).toBe('low');
    expect(altitudeBand(10_000)).toBe('mid');
    expect(altitudeBand(24_999)).toBe('mid');
    expect(altitudeBand(25_000)).toBe('cruise');
    expect(altitudeBand(41_000)).toBe('cruise');
  });

  it('기압 탓에 마이너스로 오는 고도도 이착륙 구간', () => {
    expect(altitudeBand(-75)).toBe('approach');
  });

  it('고도가 없거나 숫자가 아니면 null', () => {
    expect(altitudeBand(undefined)).toBeNull();
    expect(altitudeBand(Number.NaN)).toBeNull();
  });

  it('범례는 높은 구간부터, 구간마다 이름이 있다', () => {
    expect(ALTITUDE_BANDS.map((b) => b.band)).toEqual(['cruise', 'mid', 'low', 'approach']);
    expect(altitudeBandName('cruise')).toBe('순항');
    expect(altitudeBandName('approach')).toBe('이착륙');
  });
});
