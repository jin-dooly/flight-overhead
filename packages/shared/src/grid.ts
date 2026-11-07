/** 소수점 첫째 자리로 반올림. -0은 0으로 정리해 토픽이 `-0.0`이 되지 않게 함 */
export const round1 = (value: number): number => {
  const rounded = Math.round(value * 10) / 10;
  return rounded === 0 ? 0 : rounded;
};

/** 정확한 위치 대신 0.1도 격자(약 11km)만 서버에 알리기 위한 반올림 */
export const toGrid = (lat: number, lon: number) => ({
  lat: round1(lat),
  lon: round1(lon),
});
