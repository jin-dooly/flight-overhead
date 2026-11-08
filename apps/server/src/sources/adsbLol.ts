import { fetchJson } from './http';
import { normalizeHexResponse, normalizeResponse } from './normalize';
import type { AircraftSource, HexSource, SourceOptions } from './types';

export const ADSB_LOL_BASE = 'https://api.adsb.lol/v2';

/** 메인 소스. 비행기 목록 키는 `ac` */
export const createAdsbLolSource = (
  opts: SourceOptions
): AircraftSource & HexSource => ({
  name: 'adsb.lol',
  async fetchAircraft(lat, lon, radiusNm) {
    const url = `${ADSB_LOL_BASE}/lat/${lat}/lon/${lon}/dist/${radiusNm}`;
    const body = await fetchJson(url, opts);
    return normalizeResponse(body, 'ac', (opts.now ?? Date.now)());
  },
  async fetchByHex(hex) {
    const body = await fetchJson(`${ADSB_LOL_BASE}/hex/${hex}`, opts);
    return normalizeHexResponse(body, hex, (opts.now ?? Date.now)());
  },
});
