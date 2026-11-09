import type { FollowedAircraft } from '@flight/shared';

/**
 * 마지막 위치를 받은 지 이만큼 지나면 "신호가 끊겼어요" (기획서: 30초 이상 미수신 시 마지막 위치 표시).
 * 보간 예측을 멈추는 시간(MAX_PREDICT_MS)과 같게 둬서, 끊김 안내가 뜨는 순간 마커도 멈춤
 */
export const FOLLOW_LOST_MS = 30_000;

/**
 * 따라가기 화면 상태
 * - waiting: 따라가기를 눌렀는데 아직 서버에서 첫 위치를 못 받음
 * - active: 따라가는 중
 * - lost: 30초 넘게 위치가 안 옴 (마지막 위치를 보여 주고 계속 기다림)
 * - landed: 착륙함 (끝 상태. 이후 데이터가 와도 바뀌지 않음)
 */
export type FollowPhase = 'waiting' | 'active' | 'lost' | 'landed';

export const deriveFollowPhase = ({
  last,
  landedAt,
  startedAt,
  nowMs,
}: {
  /** 마지막으로 받은 위치 (서버에서 못 받았으면 따라가기를 시작할 때 지도에 있던 값) */
  last: FollowedAircraft | null;
  landedAt: number | null;
  startedAt: number;
  /** 서버 시계 기준 지금 */
  nowMs: number;
}): FollowPhase => {
  if (landedAt !== null) return 'landed';
  if (!last) return nowMs - startedAt > FOLLOW_LOST_MS ? 'lost' : 'waiting';
  return nowMs - last.seenAt > FOLLOW_LOST_MS ? 'lost' : 'active';
};

/** 따라간 시간을 "12분째", "1시간 5분" 같은 말로 */
export const formatDuration = (ms: number): string => {
  const minutes = Math.max(0, Math.floor(ms / 60_000));
  if (minutes < 1) return '1분 미만';
  if (minutes < 60) return `${minutes}분`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest === 0 ? `${hours}시간` : `${hours}시간 ${rest}분`;
};
