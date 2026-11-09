import { useEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { DEFAULT_LOCATION } from '../../config';
import { detectBrowserEnv, type BrowserEnv } from '../../lib/device';
import { CloseIcon } from './icons';

/** 환경별 안내. 순서대로 따라 하면 되게 짧은 단계로 */
const GUIDES: Record<BrowserEnv, { title: string; steps: ReactNode[] }> = {
  kakao: {
    title: '카카오톡에서 열었을 때',
    steps: [
      '카카오톡 안의 브라우저는 위치 권한을 묻지 않을 수 있어요.',
      <>
        화면 오른쪽 위(또는 아래)의 <b>⋯ 메뉴</b>에서 <b>다른 브라우저로 열기</b>를 누르세요.
      </>,
      'Safari나 Chrome에서 열리면, 뜨는 창에서 위치를 허용해 주세요.',
    ],
  },
  inapp: {
    title: '다른 앱 안에서 열었을 때 (인스타그램, 네이버 등)',
    steps: [
      '앱 안의 브라우저는 위치 권한을 묻지 않을 수 있어요.',
      <>
        <b>⋯ 메뉴</b>에서 <b>브라우저에서 열기</b>(또는 외부 브라우저로 열기)를 누르세요.
      </>,
      '열린 브라우저에서 위치를 허용해 주세요.',
    ],
  },
  'ios-safari': {
    title: '아이폰 Safari',
    steps: [
      <>
        <b>설정</b> 앱 → <b>개인정보 보호 및 보안</b> → <b>위치 서비스</b>가 켜져 있는지 확인하세요.
      </>,
      <>
        같은 화면 아래쪽 <b>Safari 웹 사이트</b>를 <b>앱을 사용하는 동안</b>으로 바꾸세요.
      </>,
      <>
        Safari로 돌아와 주소창 왼쪽 <b>가가</b> 버튼 → <b>웹 사이트 설정</b> → <b>위치</b>를{' '}
        <b>허용</b>으로 바꾸세요.
      </>,
      '페이지를 새로고침하세요.',
    ],
  },
  'ios-chrome': {
    title: '아이폰 Chrome',
    steps: [
      <>
        <b>설정</b> 앱 → <b>개인정보 보호 및 보안</b> → <b>위치 서비스</b>가 켜져 있는지 확인하세요.
      </>,
      <>
        같은 화면에서 <b>Chrome</b>을 <b>앱을 사용하는 동안</b>으로 바꾸세요.
      </>,
      'Chrome으로 돌아와 페이지를 새로고침하고, 뜨는 창에서 허용하세요.',
    ],
  },
  android: {
    title: '안드로이드',
    steps: [
      <>
        화면 위에서 내려 <b>위치</b>가 켜져 있는지 확인하세요.
      </>,
      <>
        주소창 왼쪽 아이콘(설정 모양 또는 자물쇠) → <b>권한</b> → <b>위치</b>를 허용하세요.
      </>,
      '페이지를 새로고침하세요.',
    ],
  },
  desktop: {
    title: 'PC',
    steps: [
      <>
        주소창 왼쪽 아이콘(설정 모양 또는 자물쇠) → <b>위치</b>를 <b>허용</b>으로 바꾸세요.
      </>,
      <>
        Windows는 <b>설정 → 개인 정보 보호 및 보안 → 위치</b>, Mac은{' '}
        <b>시스템 설정 → 개인정보 보호 및 보안 → 위치 서비스</b>에서 브라우저 위치 사용이 켜져
        있어야 해요.
      </>,
      '페이지를 새로고침하세요.',
    ],
  },
};

const ORDER: BrowserEnv[] = ['kakao', 'inapp', 'ios-safari', 'ios-chrome', 'android', 'desktop'];

/**
 * "위치 권한을 켜는 방법" 모달 (사용자 피드백 2026-11-09).
 * 한 번 거부한 사이트는 브라우저가 다시 묻지 않아서 "다시 시도"를 눌러도 아무 창이 안 뜸.
 * 그래서 지금 쓰는 환경을 추측해 그 방법을 맨 위에 펼쳐 보여 주고, 나머지 환경은 접어 둠
 */
export const LocationHelpModal = ({ onClose }: { onClose: () => void }) => {
  const env = detectBrowserEnv(navigator.userAgent, navigator.maxTouchPoints);
  const others = ORDER.filter((e) => e !== env);
  const [blocked, setBlocked] = useState(false);
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    // 브라우저가 권한 상태를 알려 주면(대부분의 최신 브라우저) "차단됨"일 때 이유를 한 줄 더 보여 줌
    navigator.permissions
      ?.query({ name: 'geolocation' })
      .then((s) => setBlocked(s.state === 'denied'))
      .catch(() => {});
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return createPortal(
    <div className="help-backdrop" onClick={onClose}>
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="location-help-title"
        className="help-dialog"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="help-head">
          <h2 id="location-help-title">위치 권한을 켜는 방법</h2>
          <button ref={closeRef} type="button" className="sheet-close" aria-label="닫기" onClick={onClose}>
            <CloseIcon />
          </button>
        </div>
        <p className="help-lead">
          {blocked
            ? '이 사이트의 위치 권한이 꺼져 있어서, "다시 시도"를 눌러도 허용 창이 뜨지 않아요. 아래 방법으로 켠 뒤 새로고침해 주세요.'
            : '허용 창이 뜨지 않으면 브라우저나 기기 설정에서 위치가 꺼져 있는 경우가 많아요.'}
        </p>

        <Guide env={env} current />
        <p className="help-others">다른 기기나 브라우저라면</p>
        {others.map((e) => (
          <details key={e} className="help-more">
            <summary>{GUIDES[e].title}</summary>
            <Guide env={e} />
          </details>
        ))}

        <p className="help-foot">
          위치를 켜지 않아도 {DEFAULT_LOCATION.label} 기준으로 계속 볼 수 있어요. 위치는 이 기기 안에서만
          쓰고, 서버에는 약 11km 단위로 반올림한 위치만 보내요.
        </p>
      </section>
    </div>,
    document.body
  );
};

const Guide = ({ env, current = false }: { env: BrowserEnv; current?: boolean }) => (
  <div className={current ? 'help-guide is-current' : 'help-guide'}>
    {current && <span className="help-tag">지금 쓰는 환경: {GUIDES[env].title}</span>}
    <ol>
      {GUIDES[env].steps.map((step, i) => (
        <li key={i}>{step}</li>
      ))}
    </ol>
  </div>
);
