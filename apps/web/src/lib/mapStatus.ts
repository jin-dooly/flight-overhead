import type { SourceStatus } from '@flight/shared';

/**
 * 상단 칩과 안내에 쓰는 데이터 상태
 * - connecting: 앱을 열고 서버에 처음 붙는 중 (Render 무료 플랜은 첫 접속이 최대 1분 걸림)
 * - live: 실시간
 * - reconnecting: 서버와 연결이 끊겨 다시 붙는 중
 * - delayed: 연결은 됐지만 데이터가 오래됨 (데이터 소스 장애)
 */
export type DataStatus = 'connecting' | 'live' | 'reconnecting' | 'delayed';

/**
 * 스냅샷이 이보다 오래되면 "데이터 지연"으로 봄.
 * 정상일 때 갱신 간격은 약 6초라, 세 번 연속 못 받은 정도(20초)부터 사용자에게 알림
 */
export const DELAY_THRESHOLD_MS = 20_000;

export const deriveDataStatus = ({
  connection,
  sourceStatus,
  snapshotAgeMs,
}: {
  connection: 'connecting' | 'live' | 'reconnecting';
  sourceStatus: SourceStatus | null;
  /** 마지막 스냅샷이 몇 ms 전 데이터인지. 아직 못 받았으면 null */
  snapshotAgeMs: number | null;
}): DataStatus => {
  if (connection !== 'live') return connection;
  // 서버가 "둘 다 실패"라고 알려 줬거나, 서버가 알려 주지 않아도 데이터가 멈췄으면 지연
  if (sourceStatus === 'degraded') return 'delayed';
  if (snapshotAgeMs !== null && snapshotAgeMs > DELAY_THRESHOLD_MS) return 'delayed';
  return 'live';
};
