import type { Aircraft } from '@flight/shared';
import { isLowAltitude, isNearGround } from '../altitude';
import type { LatLon } from './distance';

/** 위도 1도의 길이(km). 지구 반지름 6371km 기준 */
const KM_PER_DEG_LAT = (2 * Math.PI * 6371) / 360;
const KM_PER_NM = 1.852; // 1노트 = 1해리/시간 = 1.852km/h

/**
 * 마지막 위치를 받은 뒤 이 시간이 지나면 더 예측하지 않고 멈춤.
 * 소스 장애로 새 데이터가 안 오는데 비행기가 계속 날아가면 실제와 점점 멀어지므로.
 * 서버 백오프 최대 간격(60초)의 절반. 순항 속도 450kt면 약 7km
 */
export const MAX_PREDICT_MS = 30_000;

/** 새 데이터가 왔을 때 화면 위치를 새 예측 위치로 옮기는 데 걸리는 시간 (기획서: 1초) */
export const CONVERGE_MS = 1_000;

/** 경도를 -180~180 사이로 맞춤. 날짜변경선을 넘으면 180.1이 -179.9가 되게 */
const wrapLon = (lon: number) => ((((lon + 180) % 360) + 360) % 360) - 180;

/**
 * 지금(atMs) 비행기가 있을 위치를 예측함. 마지막 위치에서 속도 × 지난 시간만큼 진행 방향으로 옮김.
 * - 속도나 방향을 모르면 움직이지 않음
 * - atMs는 서버 시각 기준이어야 함(seenAt이 서버 시각이라서). 브라우저 시계 보정은 부르는 쪽에서 함
 *
 * 지구를 평면으로 보고 계산함. 30초 동안 움직이는 거리(최대 10km 안팎)에서는 구면 공식과 차이가 수 m라서
 * 화면에서 구분되지 않고, 계산이 단순해 매 프레임 수십 대를 돌려도 부담이 없음
 */
/**
 * 지면 근처(이착륙 중)에서는 이 시간까지만 예측함.
 * 착륙 후 활주 중에는 비행기가 계속 느려지는데, 예측은 마지막 속도 그대로 가정해서
 * 오래 예측하면 활주로를 지나쳐 달려가는 것처럼 보였음(사용자 제보 2026-11-09)
 */
export const NEAR_GROUND_PREDICT_MS = 3_000;

/**
 * 저고도(3000ft 아래, 이착륙 접근 중)에서는 이 시간까지만 예측함.
 * 착륙 직전에 위치가 끊기면 예전에는 따라가기 예측 시간(3분)만큼 공항을 지나쳐 계속 날아갔음(사용자 제보 2026-11-09)
 */
export const LOW_ALTITUDE_PREDICT_MS = 10_000;

export const predictPosition = (
  aircraft: Aircraft & { onGround?: boolean },
  atMs: number,
  /** 이 시간까지만 예측하고 멈춤. 지도는 30초, 따라가기는 신호 대기시간(3분)까지 */
  maxPredictMs: number = MAX_PREDICT_MS
): LatLon => {
  const { lat, lon, speedKt, trackDeg, seenAt, altFt, onGround } = aircraft;
  if (speedKt === undefined || trackDeg === undefined) return { lat, lon };
  // 착륙한 비행기(따라가기에서 지상으로 확인됨)는 움직이지 않음. 지상 이동은 느리고 방향이 자주 바뀌어 예측이 맞지 않음
  if (onGround) return { lat, lon };

  // 시계 오차로 seenAt이 미래일 수 있으므로 0 아래로 내려가지 않게 함
  const limitMs = isNearGround(altFt)
    ? Math.min(maxPredictMs, NEAR_GROUND_PREDICT_MS)
    : isLowAltitude(altFt)
      ? Math.min(maxPredictMs, LOW_ALTITUDE_PREDICT_MS)
      : maxPredictMs;
  const elapsedMs = Math.min(Math.max(atMs - seenAt, 0), limitMs);
  const km = speedKt * KM_PER_NM * (elapsedMs / 3_600_000);
  const track = (trackDeg * Math.PI) / 180;

  // 방향 0도 = 북쪽, 90도 = 동쪽. 북쪽 성분은 위도, 동쪽 성분은 경도로
  const dLat = (km * Math.cos(track)) / KM_PER_DEG_LAT;
  // 경도 1도의 길이는 위도가 높을수록 짧아짐(cos(위도)배)
  const dLon =
    (km * Math.sin(track)) / (KM_PER_DEG_LAT * Math.cos((lat * Math.PI) / 180));

  return { lat: lat + dLat, lon: wrapLon(lon + dLon) };
};

/**
 * 새 데이터가 왔을 때 "지금 화면 위치 - 새 예측 위치" 차이를 기억해 둔 것.
 * 이 차이를 1초에 걸쳐 0으로 줄이면, 마커가 순간이동하지 않고 새 경로로 미끄러지듯 합류함
 */
export type Correction = { dLat: number; dLon: number; startedAt: number };

export const startCorrection = (
  shown: LatLon,
  predicted: LatLon,
  nowMs: number
): Correction => ({
  dLat: shown.lat - predicted.lat,
  // 날짜변경선 양쪽(179.9와 -179.9)이면 359.8도가 아니라 -0.2도 차이로
  dLon: wrapLon(shown.lon - predicted.lon),
  startedAt: nowMs,
});

/**
 * 예측 위치에 남은 차이를 더해 화면에 그릴 위치를 구함.
 * 시작할 때는 차이를 전부 더해서(= 직전 화면 위치), 1초 뒤에는 0을 더해서(= 예측 위치) 그림.
 * 그 사이에도 예측 위치 자체는 계속 움직이므로, 마커는 멈추지 않고 진행하면서 오차만 줄어듦
 */
export const applyCorrection = (
  predicted: LatLon,
  correction: Correction | null,
  nowMs: number
): LatLon => {
  if (!correction) return predicted;
  const progress = Math.min(
    Math.max((nowMs - correction.startedAt) / CONVERGE_MS, 0),
    1
  );
  const remain = 1 - progress;
  return {
    lat: predicted.lat + correction.dLat * remain,
    lon: wrapLon(predicted.lon + correction.dLon * remain),
  };
};
