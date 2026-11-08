import { useSyncExternalStore } from 'react';

/** CSS 미디어 쿼리가 맞는지. 창 크기가 바뀌면 다시 그림 (데스크톱에서 카드를 왼쪽 패널로 옮길 때 씀) */
export function useMediaQuery(query: string) {
  return useSyncExternalStore(
    (onChange) => {
      const mql = window.matchMedia(query);
      mql.addEventListener('change', onChange);
      return () => mql.removeEventListener('change', onChange);
    },
    () => window.matchMedia(query).matches
  );
}
