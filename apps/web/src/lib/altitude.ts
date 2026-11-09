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
