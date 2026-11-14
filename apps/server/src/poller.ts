import {
  parseSnapshotTopic,
  type Snapshot,
  type SourceStatus,
} from '@flight/shared';
import type { SnapshotFetcher } from './sources';
import { RequestSpacer, TopicPoller } from './topicPoller';

export type PollerOptions = {
  fetchSnapshot: SnapshotFetcher;
  /** 격자 토픽에 retained로 발행 */
  publishSnapshot: (topic: string, snapshot: Snapshot) => void;
  /** 소스 상태가 바뀔 때만 호출됨 */
  onStatusChange: (status: SourceStatus) => void;
  /** 격자 폴링을 멈춘 직후 호출됨. 그 격자의 retained 스냅샷을 지우는 데 씀 */
  clearSnapshot?: (topic: string) => void;
  intervalMs: number;
  maxIntervalMs: number;
  radiusNm: number;
  /** 서로 다른 토픽의 요청 시작 사이 최소 간격 (spacer를 넘기지 않을 때만 씀) */
  minRequestGapMs?: number;
  /**
   * 격자 폴링 시작을 서로 띄울 예약표. 넘기지 않으면 minRequestGapMs 간격의 새 예약표,
   * null이면 띄우지 않음(서버에서는 외부 요청 함수 쪽에서 간격을 지키므로 null)
   */
  spacer?: RequestSpacer | null;
  now?: () => number;
  log?: (message: string) => void;
};

/**
 * 격자 토픽(`flights/{lat}/{lon}`)용 폴러.
 * 구독 수 추적, 폴링 시작/중지, 백오프, 요청 분산은 TopicPoller가 하고,
 * 여기서는 "격자 토픽을 좌표로 바꾸고, 그 좌표 반경을 조회한다"만 정함.
 */
export class GridPoller {
  private readonly inner: TopicPoller<{ lat: number; lon: number }, Snapshot>;

  constructor(opts: PollerOptions) {
    this.inner = new TopicPoller({
      parseTopic: parseSnapshotTopic,
      fetch: async ({ lat, lon }) => {
        const result = await opts.fetchSnapshot(lat, lon, opts.radiusNm);
        return result.snapshot
          ? { status: result.status, payload: result.snapshot }
          : { status: 'degraded', payload: null, errors: result.errors };
      },
      publish: opts.publishSnapshot,
      onStatusChange: opts.onStatusChange,
      onStop: opts.clearSnapshot,
      intervalMs: opts.intervalMs,
      maxIntervalMs: opts.maxIntervalMs,
      spacer:
        opts.spacer === undefined
          ? new RequestSpacer(opts.minRequestGapMs ?? 250, opts.now)
          : opts.spacer,
      label: '격자',
      log: opts.log,
    });
  }

  get activeGrids(): number {
    return this.inner.activeCount;
  }

  /** 아직 한 번도 조회하지 않았으면 `ok`로 봄 */
  get status(): SourceStatus {
    return this.inner.status;
  }

  /** 격자 토픽이 아니면(상태 토픽 등) 무시 */
  subscribe(client: unknown, topic: string): void {
    this.inner.subscribe(client, topic);
  }

  unsubscribe(client: unknown, topic: string): void {
    this.inner.unsubscribe(client, topic);
  }

  /** 연결 종료 시 그 클라이언트의 구독을 모두 정리 */
  removeClient(client: unknown): void {
    this.inner.removeClient(client);
  }

  stopAll(): void {
    this.inner.stopAll();
  }
}
