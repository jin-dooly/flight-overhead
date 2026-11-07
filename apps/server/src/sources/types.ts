import type { Aircraft, SourceName } from '@flight/shared';

/** 데이터 소스 어댑터. 소스를 바꾸거나 추가할 때 이 형태만 맞추면 됨 */
export type AircraftSource = {
  name: SourceName;
  fetchAircraft: (
    lat: number,
    lon: number,
    radiusNm: number
  ) => Promise<Aircraft[]>;
};

export type SourceOptions = {
  userAgent: string;
  timeoutMs: number;
  /** 테스트에서 가짜 fetch를 넣기 위한 주입점 */
  fetchImpl?: typeof fetch;
  now?: () => number;
};
