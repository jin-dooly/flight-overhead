import { angleDiff } from './sky';

const toRad = (deg: number) => (deg * Math.PI) / 180;
const toDeg = (rad: number) => (rad * 180) / Math.PI;

/** deviceorientation 이벤트에서 쓰는 값만 (테스트에서 가짜 값을 넣기 쉽게) */
export type OrientationReading = {
  /** 기기를 눕혔을 때 위쪽 끝이 가리키는 방향을 돌린 각도(0~360). absolute일 때만 북쪽 기준 */
  alpha: number | null;
  /** 앞뒤 기울기(-180~180). 폰을 세워 들면 90 */
  beta: number | null;
  /** 좌우 기울기(-90~90) */
  gamma: number | null;
  /** alpha가 북쪽 기준인지 (안드로이드 deviceorientationabsolute는 true) */
  absolute: boolean;
  /** 아이폰 Safari가 주는 나침반 방향(북쪽 0, 시계 방향). 있으면 이 값을 씀 */
  webkitCompassHeading?: number;
};

/**
 * 폰 뒷면(카메라)이 향하는 방위각(0 = 북, 90 = 동).
 * - 아이폰: webkitCompassHeading을 그대로 씀 (iOS가 자기 센서로 계산한 나침반 값)
 * - 안드로이드: 북쪽 기준 alpha/beta/gamma로 "뒷면 방향 벡터"를 구해 수평 성분의 방향을 계산
 *   (W3C Device Orientation 명세의 compassHeading 예제와 같은 식)
 * 북쪽 기준 값을 못 받으면 null (방향을 알 수 없음)
 */
export const headingOf = (r: OrientationReading): number | null => {
  if (typeof r.webkitCompassHeading === 'number' && !Number.isNaN(r.webkitCompassHeading)) {
    return ((r.webkitCompassHeading % 360) + 360) % 360;
  }
  if (!r.absolute || r.alpha === null || r.beta === null || r.gamma === null) return null;
  const x = toRad(r.beta);
  const y = toRad(r.gamma);
  const z = toRad(r.alpha);
  const cY = Math.cos(y);
  const cZ = Math.cos(z);
  const sX = Math.sin(x);
  const sY = Math.sin(y);
  const sZ = Math.sin(z);
  // 뒷면 방향 벡터의 동쪽(Vx), 북쪽(Vy) 성분
  const vx = -cZ * sY - sZ * sX * cY;
  const vy = -sZ * sY + cZ * sX * cY;
  return ((toDeg(Math.atan2(vx, vy)) % 360) + 360) % 360;
};

/**
 * 폰 뒷면이 올려다보는 각도(0 = 지평선, 90 = 머리 위, 음수 = 땅 쪽).
 * 뒷면 방향 벡터의 위쪽 성분은 -cos(beta)·cos(gamma)라서 그 asin.
 * 폰을 세워 들면(beta 90) 0도, 뒤로 젖히면(beta 135) 45도, 화면이 하늘을 보게 눕히면(beta 0) -90도
 */
export const pitchOf = (r: OrientationReading): number | null => {
  if (r.beta === null || r.gamma === null) return null;
  const up = -Math.cos(toRad(r.beta)) * Math.cos(toRad(r.gamma));
  return toDeg(Math.asin(Math.max(-1, Math.min(1, up))));
};

/**
 * 센서 떨림을 줄이는 지수 평활. 새 값 쪽으로 k만큼만 다가감(0~1, 작을수록 부드럽고 느림).
 * 방위각은 359도 → 1도를 2도 차이로 보도록 angleDiff로 계산
 */
export const smoothAngle = (prev: number, next: number, k: number): number =>
  (((prev + angleDiff(next, prev) * k) % 360) + 360) % 360;

export const smoothValue = (prev: number, next: number, k: number): number => prev + (next - prev) * k;
