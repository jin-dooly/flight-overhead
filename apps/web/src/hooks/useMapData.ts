import { useMemo } from 'react';
import { deriveDataStatus } from '../lib/mapStatus';
import { pickCardTarget, splitByRadius } from '../lib/nearby';
import { useFlightsStore } from '../store/flights';
import { useLocationStore } from '../store/location';
import { useNow } from './useNow';

/**
 * 받은 스냅샷을 내 위치 기준으로 나눈 결과와, 카드에 보여 줄 비행기.
 * 스냅샷(약 6초마다), 위치, 반경, 선택이 바뀔 때만 다시 계산함
 */
export function useNearby() {
  const snapshot = useFlightsStore((s) => s.snapshot);
  const radiusKm = useFlightsStore((s) => s.radiusKm);
  const selectedHex = useFlightsStore((s) => s.selectedHex);
  const lat = useLocationStore((s) => s.lat);
  const lon = useLocationStore((s) => s.lon);

  const split = useMemo(
    () => splitByRadius(snapshot?.aircraft ?? [], { lat, lon }, radiusKm),
    [snapshot, lat, lon, radiusKm]
  );
  const card = useMemo(
    () => pickCardTarget(split.inside, selectedHex),
    [split, selectedHex]
  );

  return { ...split, card, hasSnapshot: snapshot !== null, radiusKm };
}

/**
 * 연결 상태와 데이터 신선도를 합친 상태(실시간 / 연결 중 / 재연결 중 / 데이터 지연).
 * "N초 전"을 세야 해서 1초마다 다시 계산함. 이 훅을 쓰는 작은 컴포넌트만 1초마다 다시 그려짐
 */
export function useDataStatus() {
  const now = useNow(1000);
  const connection = useFlightsStore((s) => s.connection);
  const sourceStatus = useFlightsStore((s) => s.sourceStatus);
  const fetchedAt = useFlightsStore((s) => s.snapshot?.fetchedAt ?? null);
  const clockOffsetMs = useFlightsStore((s) => s.clockOffsetMs);

  // 서버 시계 기준 지금 - 스냅샷 시각 = 데이터가 몇 ms 전 것인지
  const snapshotAgeMs = fetchedAt === null ? null : now - clockOffsetMs - fetchedAt;
  const status = deriveDataStatus({ connection, sourceStatus, snapshotAgeMs });
  return { status, snapshotAgeMs, serverNowMs: now - clockOffsetMs };
}
