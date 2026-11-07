import { describe, expect, it } from 'vitest';
import {
  parseSnapshotTopic,
  round1,
  snapshotTopic,
  STATUS_TOPIC,
  toGrid,
} from '../src';

describe('toGrid', () => {
  it('위도와 경도를 소수점 첫째 자리로 반올림한다', () => {
    expect(toGrid(37.5145, 127.1059)).toEqual({ lat: 37.5, lon: 127.1 });
    expect(toGrid(37.55, 127.15)).toEqual({ lat: 37.6, lon: 127.2 });
    expect(toGrid(-33.86, 151.21)).toEqual({ lat: -33.9, lon: 151.2 });
  });

  it('-0을 0으로 정리한다', () => {
    expect(Object.is(round1(-0.04), 0)).toBe(true);
  });
});

describe('snapshotTopic', () => {
  it('항상 소수점 한 자리로 토픽을 만든다', () => {
    expect(snapshotTopic(37.5, 127.1)).toBe('flights/37.5/127.1');
    expect(snapshotTopic(37, 127)).toBe('flights/37.0/127.0');
    expect(snapshotTopic(-0.01, -122.4)).toBe('flights/0.0/-122.4');
  });
});

describe('parseSnapshotTopic', () => {
  it('올바른 토픽을 파싱한다', () => {
    expect(parseSnapshotTopic('flights/37.5/127.1')).toEqual({
      lat: 37.5,
      lon: 127.1,
    });
    expect(parseSnapshotTopic('flights/-33.9/151.2')).toEqual({
      lat: -33.9,
      lon: 151.2,
    });
  });

  it('snapshotTopic과 왕복이 일치한다', () => {
    const topic = snapshotTopic(37.4602, 126.4407);
    const parsed = parseSnapshotTopic(topic);
    expect(parsed).not.toBeNull();
    expect(snapshotTopic(parsed!.lat, parsed!.lon)).toBe(topic);
  });

  it.each([
    'flights/37.5',
    'flights/37.5/127.1/extra',
    'flights/37/127',
    'flights/37.50/127.1',
    'flights/+37.5/127.1',
    'flights/+/+',
    'flights/#',
    'flights/abc/127.1',
    'flights/91.0/127.1',
    'flights/37.5/180.1',
    'flights/-0.0/127.1',
    STATUS_TOPIC,
    '',
  ])('잘못된 토픽 %s 을 거절한다', (topic) => {
    expect(parseSnapshotTopic(topic)).toBeNull();
  });
});
