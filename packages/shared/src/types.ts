/** 서버가 두 데이터 소스의 응답을 정규화한 공통 기체 모델 */
export type Aircraft = {
  /** 기체 고유 ID(ICAO 24비트 주소), 마커 key */
  hex: string;
  /** 편명. 없을 수 있음 */
  callsign?: string;
  lat: number;
  lon: number;
  /** 고도(ft). 기하 고도(GPS)가 있으면 그 값, 없으면 기압 고도. 지상 기체는 서버에서 제외하므로 공중 기체만 옴 */
  altFt?: number;
  /** 대지 속도(kt) */
  speedKt?: number;
  /** 진행 방향 0~360 */
  trackDeg?: number;
  /** 위치를 받은 시각(ms) */
  seenAt: number;
};

export type SourceName = 'adsb.lol' | 'adsb.fi';

/** `flights/{lat}/{lon}` 토픽에 retained로 발행되는 격자 스냅샷 */
export type Snapshot = {
  aircraft: Aircraft[];
  source: SourceName;
  fetchedAt: number;
};

/** `status/source` 토픽 값. ok = 메인 소스, fallback = 예비 소스, degraded = 둘 다 실패 */
export type SourceStatus = 'ok' | 'fallback' | 'degraded';

/** 따라가기 토픽의 기체. 격자와 달리 지상 기체도 버리지 않고 "착륙했어요"를 보여 주려고 지상 여부를 같이 보냄 */
export type FollowedAircraft = Aircraft & {
  onGround: boolean;
};

/** `aircraft/{hex}` 토픽에 retained로 발행되는 따라가기 스냅샷 */
export type FollowSnapshot = {
  hex: string;
  /** 응답에 그 기체가 없으면(수신 범위 밖, 신호 끊김) null */
  aircraft: FollowedAircraft | null;
  source: SourceName;
  fetchedAt: number;
};
