import { describe, expect, it } from 'vitest';
import {
  headingOf,
  pitchOf,
  smoothAngle,
  smoothValue,
  type OrientationReading,
} from '../src/lib/orientation';

const reading = (o: Partial<OrientationReading>): OrientationReading => ({
  alpha: 0,
  beta: 90,
  gamma: 0,
  absolute: true,
  ...o,
});

describe('headingOf', () => {
  it('아이폰은 webkitCompassHeading을 그대로', () => {
    expect(headingOf(reading({ absolute: false, webkitCompassHeading: 123.4 }))).toBeCloseTo(123.4, 6);
  });

  it('안드로이드: 폰을 세워 들고(beta 90) alpha 0이면 북쪽, alpha 90이면 서쪽(alpha는 반시계)', () => {
    expect(headingOf(reading({ alpha: 0 }))).toBeCloseTo(0, 6);
    expect(headingOf(reading({ alpha: 90 }))).toBeCloseTo(270, 6);
    expect(headingOf(reading({ alpha: 270 }))).toBeCloseTo(90, 6);
  });

  it('세워 든 채 뒤로 젖혀도(beta 120) 방위는 그대로', () => {
    expect(headingOf(reading({ alpha: 270, beta: 120 }))).toBeCloseTo(90, 6);
  });

  it('북쪽 기준 값이 아니면(absolute false) 방향을 알 수 없음', () => {
    expect(headingOf(reading({ absolute: false }))).toBeNull();
    expect(headingOf(reading({ alpha: null }))).toBeNull();
  });
});

describe('pitchOf', () => {
  it('세워 들면 지평선(0도), 뒤로 45도 젖히면 45도, 화면을 하늘로 눕히면 -90도', () => {
    expect(pitchOf(reading({ beta: 90 }))).toBeCloseTo(0, 6);
    expect(pitchOf(reading({ beta: 135 }))).toBeCloseTo(45, 6);
    expect(pitchOf(reading({ beta: 0 }))).toBeCloseTo(-90, 6);
  });

  it('앞으로 숙이면 땅 쪽(음수)', () => {
    expect(pitchOf(reading({ beta: 60 }))).toBeCloseTo(-30, 6);
  });

  it('값이 없으면 null', () => {
    expect(pitchOf(reading({ beta: null }))).toBeNull();
  });
});

describe('smoothAngle / smoothValue', () => {
  it('북쪽을 사이에 두면 짧은 쪽으로 다가감 (359 → 1은 2도 차이)', () => {
    expect(smoothAngle(359, 1, 0.5)).toBeCloseTo(0, 6);
    expect(smoothAngle(10, 30, 0.25)).toBeCloseTo(15, 6);
  });

  it('일반 값은 k만큼 다가감', () => {
    expect(smoothValue(10, 20, 0.3)).toBeCloseTo(13, 6);
  });
});
