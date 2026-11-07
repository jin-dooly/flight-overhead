import {
  parseSnapshotTopic,
  type Snapshot,
  type SourceStatus,
} from '@flight/shared';
import { nextPollDelay } from './backoff';
import type { SnapshotFetcher } from './sources';

export type PollerOptions = {
  fetchSnapshot: SnapshotFetcher;
  /** 격자 토픽에 retained로 발행 */
  publishSnapshot: (topic: string, snapshot: Snapshot) => void;
  /** 소스 상태가 바뀔 때만 호출됨 */
  onStatusChange: (status: SourceStatus) => void;
  intervalMs: number;
  maxIntervalMs: number;
  radiusNm: number;
  /** 서로 다른 격자의 요청 시작 사이 최소 간격 */
  minRequestGapMs?: number;
  now?: () => number;
  log?: (message: string) => void;
};

type GridState = {
  topic: string;
  lat: number;
  lon: number;
  timer: ReturnType<typeof setTimeout> | null;
  /** 예약해 둔 요청 시작 시각. 중지할 때 예약을 풀기 위해 보관 */
  reservedAt: number | null;
  failures: number;
  stopped: boolean;
};

/**
 * 격자 토픽별 구독자를 세고, 구독자가 있는 격자만 폴링함.
 *
 * 구독자 수는 "토픽 → 숫자"가 아니라 "클라이언트 → 구독 토픽 집합"으로 관리함.
 * 같은 토픽을 두 번 구독하거나, 구독한 적 없는 토픽을 해제하거나,
 * 해제 없이 연결이 끊겨도 숫자가 어긋나지 않게 하기 위해서임.
 */
export class GridPoller {
  private readonly subsByClient = new Map<unknown, Set<string>>();
  private readonly subscriberCount = new Map<string, number>();
  private readonly grids = new Map<string, GridState>();
  private currentStatus: SourceStatus | null = null;
  private readonly reservedStarts = new Set<number>();
  private readonly opts: Required<Omit<PollerOptions, 'log'>> &
    Pick<PollerOptions, 'log'>;

  constructor(opts: PollerOptions) {
    this.opts = { minRequestGapMs: 250, now: Date.now, ...opts };
  }

  get activeGrids(): number {
    return this.grids.size;
  }

  /** 아직 한 번도 조회하지 않았으면 `ok`로 봄 */
  get status(): SourceStatus {
    return this.currentStatus ?? 'ok';
  }

  /** 격자 토픽이 아니면(상태 토픽 등) 무시 */
  subscribe(client: unknown, topic: string): void {
    if (!parseSnapshotTopic(topic)) return;
    let topics = this.subsByClient.get(client);
    if (!topics) {
      topics = new Set();
      this.subsByClient.set(client, topics);
    }
    if (topics.has(topic)) return;
    topics.add(topic);
    const count = (this.subscriberCount.get(topic) ?? 0) + 1;
    this.subscriberCount.set(topic, count);
    if (count === 1) this.startGrid(topic);
  }

  unsubscribe(client: unknown, topic: string): void {
    const topics = this.subsByClient.get(client);
    if (!topics?.delete(topic)) return;
    if (topics.size === 0) this.subsByClient.delete(client);
    this.decrement(topic);
  }

  /** 연결 종료 시 그 클라이언트의 구독을 모두 정리 */
  removeClient(client: unknown): void {
    const topics = this.subsByClient.get(client);
    if (!topics) return;
    this.subsByClient.delete(client);
    for (const topic of topics) this.decrement(topic);
  }

  stopAll(): void {
    for (const topic of [...this.grids.keys()]) this.stopGrid(topic);
    this.subsByClient.clear();
    this.subscriberCount.clear();
  }

  private decrement(topic: string): void {
    const count = (this.subscriberCount.get(topic) ?? 0) - 1;
    if (count > 0) {
      this.subscriberCount.set(topic, count);
      return;
    }
    this.subscriberCount.delete(topic);
    this.stopGrid(topic);
  }

  private startGrid(topic: string): void {
    const parsed = parseSnapshotTopic(topic);
    if (!parsed || this.grids.has(topic)) return;
    const state: GridState = {
      topic,
      ...parsed,
      timer: null,
      reservedAt: null,
      failures: 0,
      stopped: false,
    };
    this.grids.set(topic, state);
    this.opts.log?.(`폴링 시작 ${topic} (활성 격자 ${this.grids.size})`);
    // 즉시 1회 조회. 다만 다른 격자와 요청 시작이 겹치지 않도록 슬롯을 받아서 시작
    this.schedule(state, 0);
  }

  private stopGrid(topic: string): void {
    const state = this.grids.get(topic);
    if (!state) return;
    state.stopped = true;
    if (state.timer) {
      clearTimeout(state.timer);
      if (state.reservedAt !== null) this.reservedStarts.delete(state.reservedAt);
    }
    this.grids.delete(topic);
    this.opts.log?.(`폴링 중지 ${topic} (활성 격자 ${this.grids.size})`);
  }

  /**
   * `delayMs` 뒤에 조회하되, 다른 격자의 요청과 시작 시각이 겹치면 뒤로 조금 밀림.
   * 격자가 많아도 외부 API에 요청이 한꺼번에 몰리지 않게, 요청 시작 사이에
   * 최소 `minRequestGapMs` 간격을 둠. 각 격자는 자기 조회가 끝난 시점 기준으로
   * 다음 조회를 예약하므로, 한 번 흩어진 시작 시각은 계속 흩어진 채로 유지됨.
   */
  private schedule(state: GridState, delayMs: number): void {
    const now = this.opts.now();
    const startAt = this.reserveSlot(now + delayMs, now);
    state.timer = setTimeout(() => {
      // 시작한 요청의 예약은 지우지 않음. 직후에 시작하려는 다른 격자도 간격을 지키게 하려고
      // 잠시 남겨 두고, 지난 예약은 reserveSlot에서 정리함
      state.reservedAt = null;
      void this.poll(state);
    }, startAt - now);
    state.reservedAt = startAt;
  }

  /**
   * `desired` 이후에서, 이미 예약된 다른 요청 시작 시각과 `minRequestGapMs` 이상
   * 떨어진 가장 이른 시각을 찾아 예약. 한 격자가 백오프로 60초 뒤를 예약해도
   * 그 사이의 다른 격자 요청은 밀리지 않도록, 마지막 시각 하나가 아니라 예약 목록과 비교함.
   */
  private reserveSlot(desired: number, now: number): number {
    const gap = this.opts.minRequestGapMs;
    for (const t of this.reservedStarts) {
      if (t < now - gap) this.reservedStarts.delete(t);
    }
    const reserved = [...this.reservedStarts].sort((a, b) => a - b);
    let candidate = desired;
    for (const t of reserved) {
      if (t <= candidate - gap) continue;
      if (t >= candidate + gap) break;
      candidate = t + gap;
    }
    this.reservedStarts.add(candidate);
    return candidate;
  }

  private async poll(state: GridState): Promise<void> {
    state.timer = null;
    if (state.stopped) return;

    const result = await this.opts
      .fetchSnapshot(state.lat, state.lon, this.opts.radiusNm)
      .catch((err: unknown) => ({
        status: 'degraded' as const,
        snapshot: null,
        errors: [String(err)],
      }));

    // 조회 중에 마지막 구독자가 떠났으면 발행하지 않음
    if (state.stopped) return;

    this.setStatus(result.status);
    if (result.snapshot) {
      state.failures = 0;
      this.opts.publishSnapshot(state.topic, result.snapshot);
    } else {
      // 예비 소스까지 실패했을 때만 실패로 셈. 예비 소스 성공은 정상 간격 유지
      state.failures += 1;
      this.opts.log?.(
        `조회 실패 ${state.topic} (${state.failures}회 연속): ${result.errors.join(', ')}`
      );
    }

    const delay = nextPollDelay(
      state.failures,
      this.opts.intervalMs,
      this.opts.maxIntervalMs
    );
    this.schedule(state, delay);
  }

  private setStatus(status: SourceStatus): void {
    if (status === this.currentStatus) return;
    this.currentStatus = status;
    this.opts.onStatusChange(status);
  }
}
