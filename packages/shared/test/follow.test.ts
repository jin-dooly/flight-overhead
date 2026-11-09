import { describe, expect, it } from 'vitest';
import { followTopic, isFollowableHex, parseFollowTopic } from '../src';

describe('followTopic / parseFollowTopic', () => {
  it('기체 ID로 토픽을 만들고 다시 꺼냄 (대문자는 소문자로)', () => {
    expect(followTopic('71C9A3')).toBe('aircraft/71c9a3');
    expect(parseFollowTopic('aircraft/71c9a3')).toBe('71c9a3');
  });

  it('형식이 틀리면 null (와일드카드, 대문자, 길이, TIS-B 임시 ID)', () => {
    for (const topic of [
      'aircraft/+',
      'aircraft/#',
      'aircraft/71C9A3',
      'aircraft/71c9a',
      'aircraft/71c9a3/x',
      'aircraft/~71c9a3',
      'flights/37.5/127.1',
      'aircraft/',
    ]) {
      expect(parseFollowTopic(topic)).toBeNull();
    }
  });

  it('isFollowableHex', () => {
    expect(isFollowableHex('71be05')).toBe(true);
    expect(isFollowableHex('71BE05')).toBe(true);
    expect(isFollowableHex('~71be05')).toBe(false);
  });
});
