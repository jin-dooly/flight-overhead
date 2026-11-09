/**
 * 이 고도(ft, 약 30m)보다 낮으면 "지면 근처"로 봄.
 * 이착륙 중인 비행기는 고도 값이 0 근처에서 흔들리고(기하 고도가 없는 기체는 기압 탓에 마이너스도 나옴),
 * 몇십 ft 차이는 의미가 없어서 숫자 대신 말로 보여 줌
 */
export const NEAR_GROUND_FT = 100;

export const isNearGround = (altFt?: number): boolean =>
  altFt !== undefined && altFt < NEAR_GROUND_FT;
