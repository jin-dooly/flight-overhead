import { fetchJson } from './http';
import { normalizeHexResponse, normalizeResponse } from './normalize';
import type { AircraftSource, HexSource, SourceOptions } from './types';

export const ADSB_LOL_BASE = 'https://api.adsb.lol/v2';

/** 비행기 목록 키는 `ac`. 예전에는 메인 소스였고, 지금은 adsb.fi와 번갈아 부름(sources/index.ts) */
export const createAdsbLolSource = (
  opts: SourceOptions
): AircraftSource & HexSource => {
  // 키 없이 부르면 IP 기준으로 제한을 셈. Render 무료 서버는 바깥 IP를 다른 서비스와 같이 쓸 수 있어서
  // 키를 붙여 우리 요청만 따로 세게 함(2026-11-14 결정). 키 값은 로그에 남기지 않음
  const request = {
    ...opts,
    headers: opts.adsbLolApiKey ? { 'x-api-key': opts.adsbLolApiKey } : undefined,
  };
  return {
    name: 'adsb.lol',
    async fetchAircraft(lat, lon, radiusNm) {
      const url = `${ADSB_LOL_BASE}/lat/${lat}/lon/${lon}/dist/${radiusNm}`;
      const body = await fetchJson(url, request);
      return normalizeResponse(body, 'ac', (opts.now ?? Date.now)());
    },
    async fetchByHex(hex) {
      const body = await fetchJson(`${ADSB_LOL_BASE}/hex/${hex}`, request);
      return normalizeHexResponse(body, hex, (opts.now ?? Date.now)());
    },
  };
};
