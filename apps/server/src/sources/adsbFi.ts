import { fetchJson } from './http';
import { normalizeHexResponse, normalizeResponse } from './normalize';
import type { AircraftSource, HexSource, SourceOptions } from './types';

export const ADSB_FI_BASE = 'https://opendata.adsb.fi/api/v2';

/** 예비 소스. 비행기 목록 키는 `aircraft` */
export const createAdsbFiSource = (
  opts: SourceOptions
): AircraftSource & HexSource => ({
  name: 'adsb.fi',
  async fetchAircraft(lat, lon, radiusNm) {
    const url = `${ADSB_FI_BASE}/lat/${lat}/lon/${lon}/dist/${radiusNm}`;
    const body = await fetchJson(url, opts);
    return normalizeResponse(body, 'aircraft', (opts.now ?? Date.now)());
  },
  async fetchByHex(hex) {
    const body = await fetchJson(`${ADSB_FI_BASE}/hex/${hex}`, opts);
    return normalizeHexResponse(body, hex, (opts.now ?? Date.now)());
  },
});
