// src/hooks/useMode.ts
import { useCallback, useEffect, useState } from 'react';

export type Mode = 'map' | 'sky';

const readMode = (): Mode =>
  new URLSearchParams(window.location.search).get('mode') === 'sky'
    ? 'sky'
    : 'map';

export function useMode() {
  const [mode, setModeState] = useState<Mode>(readMode);

  // 뒤로가기, 앞으로가기를 누르면 주소에서 모드를 다시 읽음
  useEffect(() => {
    const onPopState = () => setModeState(readMode());
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);

  const setMode = useCallback((next: Mode) => {
    const url = new URL(window.location.href);
    if (next === 'map')
      url.searchParams.delete('mode'); // 기본 화면은 주소를 깔끔하게
    else url.searchParams.set('mode', next);
    // pushState: 방문 기록에 남겨서 뒤로가기로 돌아올 수 있게 함.
    // fromApp 표시는 "앱 안에서 이동한 기록"이라는 뜻. ?mode=sky 링크로 바로 들어온 경우와 구분하려고 남김
    window.history.pushState({ fromApp: true }, '', url);
    setModeState(next);
  }, []);

  return [mode, setMode] as const;
}

/** 앱 안에서 이동해 온 화면이면 브라우저 뒤로가기, 링크로 바로 들어왔으면 지도로 (뒤로가기 하면 사이트를 떠나므로) */
export const goBackOr = (fallback: () => void) => {
  if ((window.history.state as { fromApp?: boolean } | null)?.fromApp) window.history.back();
  else fallback();
};
