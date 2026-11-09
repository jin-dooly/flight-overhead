/**
 * 위치 권한 안내에 쓰는 사용 환경. 기기와 브라우저마다 권한을 켜는 곳이 달라서 나눔
 * - kakao: 카카오톡 안에서 연 브라우저
 * - inapp: 그 밖의 앱 안 브라우저 (인스타그램, 페이스북, 라인, 네이버 앱 등)
 * - ios-safari, ios-chrome: 아이폰·아이패드
 * - android: 안드로이드 브라우저
 * - desktop: PC
 */
export type BrowserEnv = 'kakao' | 'inapp' | 'ios-safari' | 'ios-chrome' | 'android' | 'desktop';

/**
 * User-Agent로 사용 환경을 추측함. 안내 문구를 고르는 데만 쓰고, 기능을 막는 데는 쓰지 않음
 * (User-Agent는 바뀔 수 있어서 틀려도 안내 순서만 달라지게)
 */
export const detectBrowserEnv = (userAgent: string, maxTouchPoints = 0): BrowserEnv => {
  const ua = userAgent;
  if (/KAKAOTALK/i.test(ua)) return 'kakao';
  if (/Instagram|FBAN|FBAV|Line\/|NAVER\(inapp|DaumApps|everytimeApp/i.test(ua)) return 'inapp';
  // 아이패드는 데스크톱 Safari처럼 "Macintosh"로 오지만 터치가 됨
  const ios = /iPhone|iPad|iPod/.test(ua) || (/Macintosh/.test(ua) && maxTouchPoints > 1);
  if (ios) return /CriOS/.test(ua) ? 'ios-chrome' : 'ios-safari';
  if (/Android/i.test(ua)) return 'android';
  return 'desktop';
};
