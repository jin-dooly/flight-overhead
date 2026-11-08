import { useEffect, useState } from 'react';

/**
 * intervalMs마다 다시 그리게 하고 그 시각(Date.now())을 돌려줌.
 * 카드의 "N초 전 기준"과 나와의 거리처럼 1초 단위로 바뀌면 충분한 값에 씀.
 * 지도 마커처럼 매 프레임 바뀌는 값에는 쓰지 않음 (그건 AircraftLayer가 React 밖에서 처리)
 */
export function useNow(intervalMs = 1000) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);
  return now;
}
