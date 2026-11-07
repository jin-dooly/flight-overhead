import { fetchJson } from './http';
import { normalizeResponse } from './normalize';
import type { AircraftSource, SourceOptions } from './types';

export const ADSB_FI_BASE = 'https://opendata.adsb.fi/api/v2';

/** 예비 소스. 비행기 목록 키는 `aircraft` */
export const createAdsbFiSource = (opts: SourceOptions): AircraftSource => ({
  name: 'adsb.fi',
  async fetchAircraft(lat, lon, radiusNm) {
    const url = `${ADSB_FI_BASE}/lat/${lat}/lon/${lon}/dist/${radiusNm}`;
    const body = await fetchJson(url, opts);
    return normalizeResponse(body, 'aircraft', (opts.now ?? Date.now)());
  },
});
