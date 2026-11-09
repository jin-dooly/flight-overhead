import { distanceKm, type LatLon } from './geo/distance';

export type Airport = { iata: string; name: string; city: string; lat: number; lon: number };

/**
 * 따라가기 착륙 화면에서 "어디에 내렸는지" 보여 주려고 앱에 넣은 공항 목록.
 * 외부 역지오코딩 서비스에 좌표를 보내지 않으려고 직접 가지고 있음.
 * 국내 공항 전부와, 한국에서 자주 오가는 가까운 나라의 큰 공항만 넣었음(좌표는 공항 기준점, 오차 1km 안팎)
 */
export const AIRPORTS: Airport[] = [
  // 국내
  { iata: 'ICN', name: '인천국제공항', city: '인천', lat: 37.4602, lon: 126.4407 },
  { iata: 'GMP', name: '김포국제공항', city: '서울', lat: 37.5583, lon: 126.7906 },
  { iata: 'CJU', name: '제주국제공항', city: '제주', lat: 33.5113, lon: 126.493 },
  { iata: 'PUS', name: '김해국제공항', city: '부산', lat: 35.1795, lon: 128.9382 },
  { iata: 'TAE', name: '대구국제공항', city: '대구', lat: 35.8941, lon: 128.6589 },
  { iata: 'CJJ', name: '청주국제공항', city: '청주', lat: 36.7166, lon: 127.4991 },
  { iata: 'KWJ', name: '광주공항', city: '광주', lat: 35.1264, lon: 126.8089 },
  { iata: 'MWX', name: '무안국제공항', city: '무안', lat: 34.9914, lon: 126.3828 },
  { iata: 'RSU', name: '여수공항', city: '여수', lat: 34.8423, lon: 127.6169 },
  { iata: 'USN', name: '울산공항', city: '울산', lat: 35.5935, lon: 129.3518 },
  { iata: 'KPO', name: '포항경주공항', city: '포항', lat: 35.9879, lon: 129.4204 },
  { iata: 'HIN', name: '사천공항', city: '사천', lat: 35.0886, lon: 128.0703 },
  { iata: 'YNY', name: '양양국제공항', city: '양양', lat: 38.0613, lon: 128.6692 },
  { iata: 'WJU', name: '원주공항', city: '원주', lat: 37.4381, lon: 127.9604 },
  { iata: 'KUV', name: '군산공항', city: '군산', lat: 35.9038, lon: 126.6158 },
  // 일본
  { iata: 'NRT', name: '나리타국제공항', city: '도쿄', lat: 35.772, lon: 140.3929 },
  { iata: 'HND', name: '하네다공항', city: '도쿄', lat: 35.5494, lon: 139.7798 },
  { iata: 'KIX', name: '간사이국제공항', city: '오사카', lat: 34.4347, lon: 135.244 },
  { iata: 'FUK', name: '후쿠오카공항', city: '후쿠오카', lat: 33.5859, lon: 130.451 },
  { iata: 'NGO', name: '주부국제공항', city: '나고야', lat: 34.8584, lon: 136.8054 },
  { iata: 'CTS', name: '신치토세공항', city: '삿포로', lat: 42.7752, lon: 141.6923 },
  { iata: 'OKA', name: '나하공항', city: '오키나와', lat: 26.1958, lon: 127.6459 },
  // 중국, 홍콩, 대만
  { iata: 'PEK', name: '베이징 서우두국제공항', city: '베이징', lat: 40.0801, lon: 116.5846 },
  { iata: 'PKX', name: '베이징 다싱국제공항', city: '베이징', lat: 39.5098, lon: 116.4105 },
  { iata: 'PVG', name: '상하이 푸둥국제공항', city: '상하이', lat: 31.1443, lon: 121.8083 },
  { iata: 'SHA', name: '상하이 훙차오국제공항', city: '상하이', lat: 31.1979, lon: 121.3363 },
  { iata: 'TAO', name: '칭다오 자오둥국제공항', city: '칭다오', lat: 36.3619, lon: 120.0883 },
  { iata: 'CAN', name: '광저우 바이윈국제공항', city: '광저우', lat: 23.3924, lon: 113.2988 },
  { iata: 'HKG', name: '홍콩국제공항', city: '홍콩', lat: 22.308, lon: 113.9185 },
  { iata: 'TPE', name: '타오위안국제공항', city: '타이베이', lat: 25.0797, lon: 121.2342 },
  // 동남아, 러시아
  { iata: 'MNL', name: '니노이 아키노 국제공항', city: '마닐라', lat: 14.5086, lon: 121.0194 },
  { iata: 'BKK', name: '수완나품국제공항', city: '방콕', lat: 13.69, lon: 100.7501 },
  { iata: 'SIN', name: '창이국제공항', city: '싱가포르', lat: 1.3644, lon: 103.9915 },
  { iata: 'DAD', name: '다낭국제공항', city: '다낭', lat: 16.0439, lon: 108.1994 },
  { iata: 'HAN', name: '노이바이국제공항', city: '하노이', lat: 21.2212, lon: 105.8072 },
  { iata: 'SGN', name: '떤선녓국제공항', city: '호찌민', lat: 10.8188, lon: 106.6519 },
  { iata: 'VVO', name: '블라디보스토크국제공항', city: '블라디보스토크', lat: 43.399, lon: 132.148 },
];

/**
 * 이 거리 안이면 "그 공항"으로 봄. 활주로 끝이나 유도로뿐 아니라, 착륙 직전 마지막으로 위치를 받은
 * 접근 경로(공항 10km 안팎)에서도 같은 공항으로 잡히게 15km
 */
export const AT_AIRPORT_KM = 15;
/** 이 거리 안이면 "그 도시 근처/상공"으로 말함 */
const NEAR_CITY_KM = 80;

export type Place =
  | { kind: 'airport'; airport: Airport }
  | { kind: 'near'; airport: Airport }
  | { kind: 'unknown' };

/** 가장 가까운 공항과 거리 */
export const nearestAirport = (
  pos: LatLon,
  airports: readonly Airport[] = AIRPORTS
): { airport: Airport; km: number } | null => {
  let best: Airport | null = null;
  let bestKm = Infinity;
  for (const a of airports) {
    const km = distanceKm(pos, a);
    if (km < bestKm) {
      best = a;
      bestKm = km;
    }
  }
  return best ? { airport: best, km: bestKm } : null;
};

/** 가장 가까운 공항을 기준으로 위치를 말로 바꿈 */
export const describePlace = (pos: LatLon, airports: readonly Airport[] = AIRPORTS): Place => {
  const nearest = nearestAirport(pos, airports);
  if (!nearest || nearest.km > NEAR_CITY_KM) return { kind: 'unknown' };
  const { airport: best, km: bestKm } = nearest;
  return bestKm <= AT_AIRPORT_KM ? { kind: 'airport', airport: best } : { kind: 'near', airport: best };
};

/** 도착지 표시: "제주국제공항" / "제주 근처" / "도착 지점" */
export const arrivalLabel = (place: Place): { title: string; short: string } => {
  if (place.kind === 'airport') {
    return { title: place.airport.name, short: `${place.airport.city} (${place.airport.iata})` };
  }
  if (place.kind === 'near') return { title: `${place.airport.city} 근처`, short: `${place.airport.city} 근처` };
  return { title: '도착 지점', short: '도착 지점' };
};

/** 출발지 표시: 따라가기를 시작한 곳. 비행 중에 시작하는 경우가 많아서 "인천 상공"처럼 */
export const departureLabel = (place: Place): string => {
  if (place.kind === 'airport') return `${place.airport.city} (${place.airport.iata})`;
  if (place.kind === 'near') return `${place.airport.city} 상공`;
  return '출발 지점';
};
