import { isNearGround, NEAR_GROUND_FT } from './altitude';

/** 카드에 보여 줄 값. 큰 글자(main)와 그 아래 원래 단위(sub) */
export type DisplayValue = { main: string; sub: string };

const FT_TO_M = 0.3048;
const KT_TO_KMH = 1.852;

const number = (value: number) => value.toLocaleString('ko-KR');

/**
 * 고도. 항공에서 쓰는 ft는 작게, 익숙한 m를 크게. m는 10m 단위로 반올림.
 * 100ft(30m)보다 낮으면 숫자 대신 "지면 근처" (이착륙 중 마이너스나 0 근처 숫자가 보이지 않게)
 */
export const formatAltitude = (ft?: number): DisplayValue | null => {
  if (ft === undefined) return null;
  if (isNearGround(ft)) return { main: '지면 근처', sub: `${NEAR_GROUND_FT} ft 미만` };
  return {
    main: `${number(Math.round((ft * FT_TO_M) / 10) * 10)} m`,
    sub: `${number(Math.round(ft))} ft`,
  };
};

/** 속도. 노트(kt)를 km/h로 */
export const formatSpeed = (kt?: number): DisplayValue | null =>
  kt === undefined
    ? null
    : {
        main: `${number(Math.round(kt * KT_TO_KMH))} km/h`,
        sub: `${number(Math.round(kt))} kt`,
      };

const COMPASS = ['북', '북동', '동', '남동', '남', '남서', '서', '북서'] as const;

/** 진행 방향을 8방위 이름으로. 0도 = 북, 45도마다 한 칸, 각 방위의 ±22.5도까지 같은 이름 */
export const compassName = (deg: number): (typeof COMPASS)[number] => {
  const normalized = ((deg % 360) + 360) % 360;
  return COMPASS[Math.round(normalized / 45) % 8];
};

export const formatTrack = (deg?: number): DisplayValue | null =>
  deg === undefined
    ? null
    : { main: compassName(deg), sub: `${Math.round(deg) % 360}°` };

/** 거리. 100km 미만은 소수점 한 자리(목업: 5.9, 13.1, 21.8), 그 이상은 정수 */
export const formatDistanceKm = (km: number): string =>
  km < 100 ? (Math.round(km * 10) / 10).toFixed(1) : String(Math.round(km));

/** "3초 전", "2분 전". 시계 오차로 음수가 나오면 0초로 */
export const formatAgo = (ms: number): string => {
  const seconds = Math.max(0, Math.round(ms / 1000));
  if (seconds < 60) return `${seconds}초 전`;
  return `${Math.floor(seconds / 60)}분 전`;
};
