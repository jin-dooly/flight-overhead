import type { Snapshot, SourceStatus } from '@flight/shared';
import { create } from 'zustand';

/**
 * 브라우저와 서버 사이의 MQTT 연결 상태 (상단 칩의 "실시간 / 재연결 중")
 * - connecting: 앱을 열고 첫 연결을 기다리는 중
 * - live: 연결됨
 * - reconnecting: 끊겨서 다시 연결하는 중
 */
export type ConnectionStatus = 'connecting' | 'live' | 'reconnecting';

type FlightsState = {
  connection: ConnectionStatus;
  /** 서버가 외부 데이터 소스에서 잘 받아 오고 있는지 (`status/source` 토픽) */
  sourceStatus: SourceStatus | null;
  /** 지금 구독 중인 격자 토픽. 격자를 바꾼 직후 이전 격자에서 늦게 온 메시지를 거르는 데 씀 */
  topic: string | null;
  /** 마지막으로 받은 격자 스냅샷. 약 6초마다 바뀜 */
  snapshot: Snapshot | null;
  /**
   * 브라우저 시계 - 서버 시계(ms). 비행기 위치 시각(seenAt)은 서버 시계 기준이라,
   * 사용자 기기 시계가 틀려도 예측 위치가 어긋나지 않게 이 차이를 빼서 계산함
   */
  clockOffsetMs: number;
  /** 사용자가 고른 비행기. 없으면 카드에 가장 가까운 비행기를 보여 줌 */
  selectedHex: string | null;
};

// 매 프레임 바뀌는 값(마커 위치)은 여기 넣지 않음. 스냅샷이 올 때만 바뀌는 값만 둠
export const useFlightsStore = create<FlightsState>(() => ({
  connection: 'connecting',
  sourceStatus: null,
  topic: null,
  snapshot: null,
  clockOffsetMs: 0,
  selectedHex: null,
}));
