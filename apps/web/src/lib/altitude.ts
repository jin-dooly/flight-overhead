/**
 * 이 고도(ft, 약 30m)보다 낮으면 "지면 근처"로 봄.
 * 이착륙 중인 비행기는 고도 값이 0 근처에서 흔들리고(기하 고도가 없는 기체는 기압 탓에 마이너스도 나옴),
 * 몇십 ft 차이는 의미가 없어서 숫자 대신 말로 보여 줌
 */
export const NEAR_GROUND_FT = 100;

export const isNearGround = (altFt?: number): boolean =>
  altFt !== undefined && altFt < NEAR_GROUND_FT;

/**
 * 이 고도(ft)보다 낮으면 이착륙 접근 중으로 봄. 접근 중에는 속도와 방향이 계속 바뀌고,
 * 공항 근처 저고도는 수신기에 잘 안 잡혀 위치가 자주 끊김(2026-11-09 측정: 공항 지상 기체 위치 나이 20~55초)
 */
export const LOW_ALTITUDE_FT = 3000;

export const isLowAltitude = (altFt?: number): boolean =>
  altFt !== undefined && altFt < LOW_ALTITUDE_FT;

/** 지도 아이콘 색을 나누는 고도 구간. 색은 index.css의 `--alt-{구간}` 토큰 */
export type AltitudeBand = 'approach' | 'low' | 'mid' | 'cruise';

/**
 * 고도 구간 (2026-11-14 결정). 높은 구간부터 적어서 범례도 이 순서(위가 높음)로 보여 줌.
 * - 3,000ft: 위의 LOW_ALTITUDE_FT(이착륙 접근 판단)와 같은 경계
 * - 25,000ft: 여객기가 순항에 들어가는 대략의 고도
 * 화면에는 m로 보여 주므로 `label`은 m 기준 어림값(카드의 고도도 m가 큰 글씨)
 */
export const ALTITUDE_BANDS: readonly {
  band: AltitudeBand;
  minFt: number;
  name: string;
  label: string;
}[] = [
  { band: 'cruise', minFt: 25_000, name: '순항', label: '7,600m 이상' },
  { band: 'mid', minFt: 10_000, name: '중고도', label: '3,000~7,600m' },
  { band: 'low', minFt: LOW_ALTITUDE_FT, name: '저고도', label: '900~3,000m' },
  { band: 'approach', minFt: -Infinity, name: '이착륙', label: '900m 미만' },
];

/** 고도 구간. 고도 값이 없으면 null (아이콘은 기본색) */
export const altitudeBand = (altFt?: number): AltitudeBand | null => {
  if (altFt === undefined || !Number.isFinite(altFt)) return null;
  return ALTITUDE_BANDS.find((b) => altFt >= b.minFt)?.band ?? null;
};

export const altitudeBandName = (band: AltitudeBand): string =>
  ALTITUDE_BANDS.find((b) => b.band === band)?.name ?? '';
