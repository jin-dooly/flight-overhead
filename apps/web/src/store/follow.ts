import type { Aircraft, FollowedAircraft, FollowSnapshot } from '@flight/shared';
import { create } from 'zustand';
import { distanceKm, type LatLon } from '../lib/geo/distance';
import { serverNow } from './flights';

/** 지나온 경로에 점을 더하는 최소 이동 거리. 너무 촘촘하면 선이 무거워지고, 제자리 떨림이 그려짐 */
const TRAIL_MIN_STEP_KM = 0.05;
/**
 * 한 번에 이보다 많이 움직였으면 이어진 경로로 보지 않음 (이동 거리에 더하지 않고 경로를 새로 시작).
 * 정상이면 6초 사이 2km 안팎, 60초 백오프 뒤에도 20km 정도라 넉넉하게 잡음.
 * 잘못된 위치(가끔 오는 튀는 값)가 "함께 이동"을 수천 km로 만드는 것을 막음
 */
const TRAIL_MAX_STEP_KM = 100;

type FollowState = {
  /** 따라가는 기체 ID. null이면 따라가기 중이 아님 */
  hex: string | null;
  /** 시작한 시각(서버 시계). "12분째"와 첫 위치를 기다리는 시간에 씀 */
  startedAt: number;
  /** 마지막으로 받은 위치 */
  last: FollowedAircraft | null;
  /** 따라가는 동안 받은 위치들 (지도에 점선으로) */
  trail: LatLon[];
  /** 따라가는 동안 비행기가 움직인 거리 (카드의 "함께 이동") */
  traveledKm: number;
  /** 착륙을 처음 확인한 위치 시각. 한 번 정해지면 바뀌지 않음 */
  landedAt: number | null;
  /** 서버가 따라가기를 거절함 (서버 전체 상한) */
  rejected: boolean;
};

const IDLE: FollowState = {
  hex: null,
  startedAt: 0,
  last: null,
  trail: [],
  traveledKm: 0,
  landedAt: null,
  rejected: false,
};

export const useFollowStore = create<FollowState>(() => IDLE);

/**
 * 따라가기 시작. 지도에서 보고 있던 값을 첫 위치로 써서, 서버 응답(최대 몇 초)을 기다리는 동안에도
 * 비행기가 화면에서 사라지지 않게 함
 */
export const startFollow = (aircraft: Aircraft) => {
  useFollowStore.setState({
    ...IDLE,
    hex: aircraft.hex.toLowerCase(),
    startedAt: serverNow(),
    last: { ...aircraft, onGround: false },
    trail: [{ lat: aircraft.lat, lon: aircraft.lon }],
  });
};

export const stopFollow = () => useFollowStore.setState(IDLE);

/** 서버가 따라가기 토픽 구독을 거절했을 때 */
export const markFollowRejected = () => useFollowStore.setState({ rejected: true });

/** `aircraft/{hex}` 메시지를 받으면 마지막 위치, 경로, 이동 거리, 착륙 여부를 갱신 */
export const applyFollowSnapshot = (snapshot: FollowSnapshot) => {
  const state = useFollowStore.getState();
  // 다른 기체로 바꾼 직후 이전 기체 메시지가 늦게 올 수 있음. 착륙한 뒤에는 더 바꾸지 않음
  if (snapshot.hex !== state.hex || state.landedAt !== null) return;
  const a = snapshot.aircraft;
  // 기체가 응답에 없으면(신호 끊김) 마지막 위치를 그대로 둠. 끊김 판단은 seenAt으로 함
  if (!a) return;
  // 같은 위치를 다시 받은 경우(재전송, retained) 무시
  if (state.last && a.seenAt <= state.last.seenAt && !a.onGround) return;

  const prev = state.trail[state.trail.length - 1];
  const step = prev ? distanceKm(prev, a) : 0;
  const point = { lat: a.lat, lon: a.lon };
  const jumped = step > TRAIL_MAX_STEP_KM;
  const moved = !prev || step >= TRAIL_MIN_STEP_KM;
  useFollowStore.setState({
    last: a,
    trail: jumped ? [point] : moved ? [...state.trail, point] : state.trail,
    traveledKm: state.traveledKm + (moved && !jumped ? step : 0),
    landedAt: a.onGround ? a.seenAt : null,
  });
};
