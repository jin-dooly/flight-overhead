import type { Aircraft } from '@flight/shared';
import { sortByDistance, type LatLon } from './geo/distance';

export type WithDistance = { item: Aircraft; distanceKm: number };

/**
 * 스냅샷을 내 위치 기준 반경 안/밖으로 나눔.
 * - inside: 반경 안 비행기, 가까운 순 (지도에 그리고, 카드 기본값은 첫 번째)
 * - nearestOutside: 반경 안에 아무도 없을 때 "가장 가까운 비행기는 ○○, 21.8km"에 쓸 비행기
 */
export const splitByRadius = (
  aircraft: readonly Aircraft[],
  center: LatLon,
  radiusKm: number
): { inside: WithDistance[]; nearestOutside: WithDistance | null } => {
  const sorted = sortByDistance(aircraft, center);
  const inside = sorted.filter((r) => r.distanceKm <= radiusKm);
  const nearestOutside = sorted.find((r) => r.distanceKm > radiusKm) ?? null;
  return { inside, nearestOutside };
};

/**
 * 카드에 보여 줄 비행기. 사용자가 고른 비행기가 반경 안에 있으면 그 비행기, 아니면 가장 가까운 비행기.
 * 고른 비행기가 반경을 벗어나거나 사라지면 자연스럽게 가장 가까운 비행기로 돌아감
 */
export const pickCardTarget = (
  inside: readonly WithDistance[],
  selectedHex: string | null
): { target: WithDistance; kind: 'selected' | 'nearest' } | null => {
  const selected = selectedHex
    ? inside.find((r) => r.item.hex === selectedHex)
    : undefined;
  if (selected) return { target: selected, kind: 'selected' };
  return inside[0] ? { target: inside[0], kind: 'nearest' } : null;
};
