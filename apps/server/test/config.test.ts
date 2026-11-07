import { describe, expect, it } from 'vitest';
import { loadConfig } from '../src/config';

describe('loadConfig', () => {
  it('환경 변수가 없으면 기본값을 쓴다', () => {
    expect(loadConfig({})).toEqual({
      port: 4000,
      pollIntervalMs: 5000,
      radiusNm: 15,
      userAgent: 'flight-overhead/0.1',
      requestTimeoutMs: 5000,
      maxPollIntervalMs: 60_000,
    });
  });

  it('환경 변수를 읽고, 잘못된 숫자는 기본값으로 둔다', () => {
    const config = loadConfig({
      PORT: '8080',
      POLL_INTERVAL_MS: 'abc',
      RADIUS_NM: '-3',
      USER_AGENT: '  my-agent/1.0  ',
    });
    expect(config.port).toBe(8080);
    expect(config.pollIntervalMs).toBe(5000);
    expect(config.radiusNm).toBe(15);
    expect(config.userAgent).toBe('my-agent/1.0');
  });
});
