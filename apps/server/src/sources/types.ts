import type { Aircraft, FollowedAircraft, SourceName } from '@flight/shared';

/** 데이터 소스 어댑터. 소스를 바꾸거나 추가할 때 이 형태만 맞추면 됨 */
export type AircraftSource = {
  name: SourceName;
  fetchAircraft: (
    lat: number,
    lon: number,
    radiusNm: number
  ) => Promise<Aircraft[]>;
};

/** 기체 ID로 한 대를 조회하는 어댑터 (따라가기). 응답에 없으면 null */
export type HexSource = {
  name: SourceName;
  fetchByHex: (hex: string) => Promise<FollowedAircraft | null>;
};

export type SourceOptions = {
  userAgent: string;
  timeoutMs: number;
  /** adsb.lol API 키. 있으면 adsb.lol 요청에만 `x-api-key`로 붙임(adsb.fi에는 보내지 않음) */
  adsbLolApiKey?: string;
  /** 테스트에서 가짜 fetch를 넣기 위한 주입점 */
  fetchImpl?: typeof fetch;
  now?: () => number;
};
