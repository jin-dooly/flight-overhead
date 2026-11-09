import type { LatLon } from './distance';

const toRad = (deg: number) => (deg * Math.PI) / 180;
const toDeg = (rad: number) => (rad * 180) / Math.PI;

/**
 * from에서 to를 바라보는 방위각(0 = 북, 90 = 동, 시계 방향, 0~360).
 * 따라가기의 "내 위치 ↗ 148km" 화살표와, 하늘 모드에서 비행기를 좌우로 배치할 때 씀.
 * 대권(지구 표면의 최단 경로) 출발 방향 공식이라, 멀리 떨어져 있어도 맞음
 */
export const bearingDeg = (from: LatLon, to: LatLon): number => {
  const φ1 = toRad(from.lat);
  const φ2 = toRad(to.lat);
  const Δλ = toRad(to.lon - from.lon);
  const y = Math.sin(Δλ) * Math.cos(φ2);
  const x = Math.cos(φ1) * Math.sin(φ2) - Math.sin(φ1) * Math.cos(φ2) * Math.cos(Δλ);
  return (toDeg(Math.atan2(y, x)) + 360) % 360;
};
