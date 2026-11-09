import type { SourceStatus } from '@flight/shared';
import { nextPollDelay } from './backoff';

/**
 * 외부 API 요청 시작 사이에 최소 간격을 두는 예약표.
 * 격자 폴러와 따라가기 폴러가 같은 외부 API(adsb.lol)를 부르므로, 둘이 이 예약표 하나를 같이 씀.
 *
 * 마지막 시각 하나가 아니라 예약 목록과 비교하는 이유: 한 토픽이 백오프로 60초 뒤를 예약해도
 * 그 사이에 시작하려는 다른 토픽의 요청이 밀리지 않게 하려고.
 */
export class RequestSpacer {
  private readonly reserved = new Set<number>();

  constructor(
    private readonly gapMs: number,
    private readonly now: () => number = Date.now
  ) {}

  /** `desired` 이후에서 다른 예약과 `gapMs` 이상 떨어진 가장 이른 시각을 예약하고 돌려줌 */
  reserve(desired: number): number {
    const now = this.now();
    const gap = this.gapMs;
    for (const t of this.reserved) {
      if (t < now - gap) this.reserved.delete(t);
    }
    const sorted = [...this.reserved].sort((a, b) => a - b);
    let candidate = desired;
    for (const t of sorted) {
      if (t <= candidate - gap) continue;
      if (t >= candidate + gap) break;
      candidate = t + gap;
    }
    this.reserved.add(candidate);
    return candidate;
  }

  release(at: number): void {
    this.reserved.delete(at);
  }

  /** 다음 빈자리까지 기다림. 외부 요청을 보내기 직전에 부름 */
  async wait(): Promise<void> {
    const now = this.now();
    const at = this.reserve(now);
    if (at > now) await new Promise((resolve) => setTimeout(resolve, at - now));
  }
}

/**
 * 외부 요청 함수를 감싸서, 부를 때마다 예약표의 빈자리를 기다린 뒤 요청하게 함.
 *
 * 예전에는 폴러의 토픽마다(격자마다) 예약표에 줄을 섰는데, 지역 통째 조회로 바꾼 뒤에는 대부분의 격자가
 * 외부 요청 없이 지역 결과를 다시 쓰기만 함. 그런데도 1.1초씩 줄을 서서, 보는 격자가 늘수록
 * 지도와 따라가기 갱신이 모두 밀렸음(2026-11-09 발견). 이제 실제로 외부에 나가는 요청만 줄을 섬
 */
export const spaced =
  <A extends unknown[], R>(spacer: RequestSpacer, request: (...args: A) => Promise<R>) =>
  async (...args: A): Promise<R> => {
    await spacer.wait();
    return request(...args);
  };

/** 한 번 조회한 결과. payload가 null이면 예비 소스까지 실패한 것 */
export type PollResult<P> =
  | { status: 'ok' | 'fallback'; payload: P }
  | { status: 'degraded'; payload: null; errors: string[] };

export type TopicPollerOptions<K, P> = {
  /** 이 폴러가 맡는 토픽이면 조회에 쓸 값(격자 좌표, 기체 ID)을, 아니면 null */
  parseTopic: (topic: string) => K | null;
  fetch: (key: K) => Promise<PollResult<P>>;
  /** 토픽에 retained로 발행 */
  publish: (topic: string, payload: P) => void;
  /** 소스 상태가 바뀔 때만 호출됨 (없으면 상태를 알리지 않음) */
  onStatusChange?: (status: SourceStatus) => void;
  intervalMs: number;
  maxIntervalMs: number;
  /** 토픽 폴링 시작을 서로 띄울 예약표. null이면 띄우지 않음(외부 요청 쪽에서 간격을 지킬 때) */
  spacer: RequestSpacer | null;
  /**
   * 한 클라이언트가 동시에 구독할 수 있는 이 폴러의 토픽 수. 넘으면 가장 오래된 구독을 폴링 대상에서 뺌.
   * 따라가기는 1 (기획서: 연결 하나당 따라가기 1개)
   */
  maxTopicsPerClient?: number;
  /** 로그에 쓰는 이름 (예: "격자", "따라가기") */
  label?: string;
  log?: (message: string) => void;
};

type TopicState<K> = {
  topic: string;
  key: K;
  timer: ReturnType<typeof setTimeout> | null;
  /** 예약해 둔 요청 시작 시각. 중지할 때 예약을 풀기 위해 보관 */
  reservedAt: number | null;
  failures: number;
  stopped: boolean;
};

/**
 * 토픽별 구독자를 세고, 구독자가 있는 토픽만 주기적으로 조회해서 발행함.
 * 격자 폴러(`flights/{lat}/{lon}`)와 따라가기 폴러(`aircraft/{hex}`)가 이 동작을 같이 씀.
 *
 * 구독자 수는 "토픽 → 숫자"가 아니라 "클라이언트 → 구독 토픽 목록"으로 관리함.
 * 같은 토픽을 두 번 구독하거나, 구독한 적 없는 토픽을 해제하거나,
 * 해제 없이 연결이 끊겨도 숫자가 어긋나지 않게 하기 위해서임.
 */
export class TopicPoller<K, P> {
  /** 클라이언트별 구독 토픽. 순서가 있어야 "가장 오래된 구독"을 알 수 있어서 배열 */
  private readonly subsByClient = new Map<unknown, string[]>();
  private readonly subscriberCount = new Map<string, number>();
  private readonly topics = new Map<string, TopicState<K>>();
  private currentStatus: SourceStatus | null = null;

  constructor(private readonly opts: TopicPollerOptions<K, P>) {}

  get activeCount(): number {
    return this.topics.size;
  }

  isActive(topic: string): boolean {
    return this.topics.has(topic);
  }

  /** 아직 한 번도 조회하지 않았으면 `ok`로 봄 */
  get status(): SourceStatus {
    return this.currentStatus ?? 'ok';
  }

  /** 이 폴러가 맡지 않는 토픽이면 무시 */
  subscribe(client: unknown, topic: string): void {
    if (this.opts.parseTopic(topic) === null) return;
    let list = this.subsByClient.get(client);
    if (!list) {
      list = [];
      this.subsByClient.set(client, list);
    }
    if (list.includes(topic)) return;
    list.push(topic);
    this.increment(topic);

    // 한 클라이언트가 상한보다 많이 구독하면 가장 오래된 구독부터 폴링 대상에서 뺌.
    // 브로커 구독은 남아 있어도 서버 조회 비용은 늘지 않음
    const max = this.opts.maxTopicsPerClient;
    while (max !== undefined && list.length > max) {
      const oldest = list.shift();
      if (oldest !== undefined) this.decrement(oldest);
    }
  }

  unsubscribe(client: unknown, topic: string): void {
    const list = this.subsByClient.get(client);
    const index = list?.indexOf(topic) ?? -1;
    if (!list || index < 0) return;
    list.splice(index, 1);
    if (list.length === 0) this.subsByClient.delete(client);
    this.decrement(topic);
  }

  /** 연결 종료 시 그 클라이언트의 구독을 모두 정리 */
  removeClient(client: unknown): void {
    const list = this.subsByClient.get(client);
    if (!list) return;
    this.subsByClient.delete(client);
    for (const topic of list) this.decrement(topic);
  }

  stopAll(): void {
    for (const topic of [...this.topics.keys()]) this.stop(topic);
    this.subsByClient.clear();
    this.subscriberCount.clear();
  }

  private increment(topic: string): void {
    const count = (this.subscriberCount.get(topic) ?? 0) + 1;
    this.subscriberCount.set(topic, count);
    if (count === 1) this.start(topic);
  }

  private decrement(topic: string): void {
    const count = (this.subscriberCount.get(topic) ?? 0) - 1;
    if (count > 0) {
      this.subscriberCount.set(topic, count);
      return;
    }
    this.subscriberCount.delete(topic);
    this.stop(topic);
  }

  private start(topic: string): void {
    const key = this.opts.parseTopic(topic);
    if (key === null || this.topics.has(topic)) return;
    const state: TopicState<K> = {
      topic,
      key,
      timer: null,
      reservedAt: null,
      failures: 0,
      stopped: false,
    };
    this.topics.set(topic, state);
    this.log(`폴링 시작 ${topic} (활성 ${this.topics.size})`);
    // 즉시 1회 조회. 다만 다른 토픽과 요청 시작이 겹치지 않도록 슬롯을 받아서 시작
    this.schedule(state, 0);
  }

  private stop(topic: string): void {
    const state = this.topics.get(topic);
    if (!state) return;
    state.stopped = true;
    if (state.timer) {
      clearTimeout(state.timer);
      if (state.reservedAt !== null) this.opts.spacer?.release(state.reservedAt);
    }
    this.topics.delete(topic);
    this.log(`폴링 중지 ${topic} (활성 ${this.topics.size})`);
  }

  /**
   * `delayMs` 뒤에 조회하되, 다른 요청과 시작 시각이 겹치면 뒤로 조금 밀림.
   * 각 토픽은 자기 조회가 끝난 시점 기준으로 다음 조회를 예약하므로,
   * 한 번 흩어진 시작 시각은 계속 흩어진 채로 유지됨.
   */
  private schedule(state: TopicState<K>, delayMs: number): void {
    const now = Date.now();
    const startAt = this.opts.spacer ? this.opts.spacer.reserve(now + delayMs) : now + delayMs;
    state.timer = setTimeout(() => {
      // 시작한 요청의 예약은 지우지 않음. 직후에 시작하려는 다른 토픽도 간격을 지키게 하려고
      // 잠시 남겨 두고, 지난 예약은 RequestSpacer가 정리함
      state.reservedAt = null;
      void this.poll(state);
    }, startAt - now);
    state.reservedAt = this.opts.spacer ? startAt : null;
  }

  private async poll(state: TopicState<K>): Promise<void> {
    state.timer = null;
    if (state.stopped) return;

    const result: PollResult<P> = await this.opts
      .fetch(state.key)
      .catch((err: unknown) => ({
        status: 'degraded' as const,
        payload: null,
        errors: [String(err)],
      }));

    // 조회 중에 마지막 구독자가 떠났으면 발행하지 않음
    if (state.stopped) return;

    this.setStatus(result.status);
    if (result.payload !== null) {
      state.failures = 0;
      this.opts.publish(state.topic, result.payload);
    } else {
      // 예비 소스까지 실패했을 때만 실패로 셈. 예비 소스 성공은 정상 간격 유지
      state.failures += 1;
      const errors = result.status === 'degraded' ? result.errors : [];
      this.log(`조회 실패 ${state.topic} (${state.failures}회 연속): ${errors.join(', ')}`);
    }

    const delay = nextPollDelay(state.failures, this.opts.intervalMs, this.opts.maxIntervalMs);
    this.schedule(state, delay);
  }

  private setStatus(status: SourceStatus): void {
    if (status === this.currentStatus) return;
    this.currentStatus = status;
    this.opts.onStatusChange?.(status);
  }

  private log(message: string): void {
    this.opts.log?.(this.opts.label ? `[${this.opts.label}] ${message}` : message);
  }
}
