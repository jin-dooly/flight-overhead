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
    // pushState: 방문 기록에 남겨서 뒤로가기로 돌아올 수 있게 함
    window.history.pushState(null, '', url);
    setModeState(next);
  }, []);

  return [mode, setMode] as const;
}
