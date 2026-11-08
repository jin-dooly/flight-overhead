import type { Aircraft } from '@flight/shared';
import { bearingDeg } from './geo/bearing';
import { distanceKm, type LatLon } from './geo/distance';

const FT_TO_M = 0.3048;

/** 하늘에서 비행기가 보이는 방향. azimuth = 방위각(0 = 북), elevation = 올려다보는 각도(0 = 지평선, 90 = 머리 위) */
export type SkyDirection = { azimuthDeg: number; elevationDeg: number; distanceKm: number };

/**
 * 나에게서 비행기가 보이는 방향 (기획서: 좌우 = 방위각, 위아래 = 고도와 거리로 계산한 올려다보는 각도).
 * 고도는 기압 고도(해수면 기준)를 쓰고 내 높이는 0으로 봄. 지구가 둥근 효과(30km에서 약 70m)는 무시함.
 * 고도를 모르면 null (화면에 놓을 위치를 정할 수 없음)
 */
export const skyDirection = (me: LatLon, aircraft: Aircraft): SkyDirection | null => {
  if (aircraft.altFt === undefined) return null;
  const groundKm = distanceKm(me, aircraft);
  const heightKm = Math.max(0, aircraft.altFt * FT_TO_M) / 1000;
  return {
    azimuthDeg: bearingDeg(me, aircraft),
    elevationDeg: (Math.atan2(heightKm, groundKm) * 180) / Math.PI,
    distanceKm: Math.hypot(groundKm, heightKm),
  };
};

/** 두 방향의 차이를 -180~180으로. 북쪽(0도)을 사이에 두고 350도와 10도는 20도 차이 */
export const angleDiff = (a: number, b: number): number => ((((a - b) % 360) + 540) % 360) - 180;

export type SkyView = {
  /** 폰이 향하는 방위각 */
  headingDeg: number;
  /** 폰이 올려다보는 각도 (화면 가운데가 이 높이) */
  pitchDeg: number;
  width: number;
  /** 화면 가운데(조준 원)의 y 좌표 */
  centerY: number;
  /** 1도가 몇 px인지. 목업은 폭 390px에 약 90도 (4.33px/도) */
  pxPerDeg: number;
};

/** 하늘 방향을 화면 좌표로. 화면 밖이면 visible false */
export const projectToScreen = (dir: { azimuthDeg: number; elevationDeg: number }, view: SkyView) => {
  const x = view.width / 2 + angleDiff(dir.azimuthDeg, view.headingDeg) * view.pxPerDeg;
  const y = view.centerY - (dir.elevationDeg - view.pitchDeg) * view.pxPerDeg;
  return { x, y, visible: x >= -20 && x <= view.width + 20 };
};

/**
 * 조준 원 안에서 가운데에 가장 가까운 비행기 (목업: "조준한 비행기").
 * 원 밖이면 null
 */
export const pickLocked = <T extends { x: number; y: number }>(
  points: readonly T[],
  center: { x: number; y: number },
  radiusPx: number
): T | null => {
  let best: T | null = null;
  let bestDist = radiusPx;
  for (const p of points) {
    const d = Math.hypot(p.x - center.x, p.y - center.y);
    if (d <= bestDist) {
      best = p;
      bestDist = d;
    }
  }
  return best;
};
