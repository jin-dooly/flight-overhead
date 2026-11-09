import { describe, expect, it } from 'vitest';
import { detectBrowserEnv } from '../src/lib/device';

const IPHONE_SAFARI =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.1 Mobile/15E148 Safari/604.1';
const IPHONE_CHROME =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/130.0.0.0 Mobile/15E148 Safari/604.1';
const IPHONE_KAKAO =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 KAKAOTALK 10.9.0';
const ANDROID_INSTAGRAM =
  'Mozilla/5.0 (Linux; Android 14; SM-S918N) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Mobile Safari/537.36 Instagram 350.0.0';
const ANDROID_CHROME =
  'Mozilla/5.0 (Linux; Android 14; SM-S918N) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Mobile Safari/537.36';
const IPAD_DESKTOP_MODE =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.1 Safari/605.1.15';
const WINDOWS_CHROME =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36';

describe('detectBrowserEnv', () => {
  it('앱 안 브라우저가 기기보다 우선', () => {
    expect(detectBrowserEnv(IPHONE_KAKAO)).toBe('kakao');
    expect(detectBrowserEnv(ANDROID_INSTAGRAM)).toBe('inapp');
  });

  it('아이폰 Safari와 Chrome을 구분', () => {
    expect(detectBrowserEnv(IPHONE_SAFARI)).toBe('ios-safari');
    expect(detectBrowserEnv(IPHONE_CHROME)).toBe('ios-chrome');
  });

  it('맥처럼 보이지만 터치가 되면 아이패드', () => {
    expect(detectBrowserEnv(IPAD_DESKTOP_MODE, 5)).toBe('ios-safari');
    expect(detectBrowserEnv(IPAD_DESKTOP_MODE, 0)).toBe('desktop');
  });

  it('안드로이드, PC', () => {
    expect(detectBrowserEnv(ANDROID_CHROME)).toBe('android');
    expect(detectBrowserEnv(WINDOWS_CHROME)).toBe('desktop');
  });
});
