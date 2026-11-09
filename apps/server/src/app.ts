import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { parseFollowTopic, type SourceStatus } from '@flight/shared';
import express from 'express';
import { attachMqttWebSocket, createBroker } from './broker';
import type { Config } from './config';
import {
  connectFollowPollerToBroker,
  connectPollerToBroker,
  type FollowPoller,
} from './realtime';
import {
  createDefaultFetcher,
  createDefaultFollowFetcher,
  type FollowFetcher,
  type SnapshotFetcher,
} from './sources';
import { createRegionalFetcher } from './sources/regional';
import { RequestSpacer, spaced } from './topicPoller';

export type HealthResponse = {
  status: 'ok';
  activeGrids: number;
  activeFollows: number;
  source: SourceStatus;
};

export type StartOptions = {
  /** 테스트에서 외부 API 대신 가짜 조회 함수를 넣기 위한 주입점 */
  fetchSnapshot?: SnapshotFetcher;
  fetchFollow?: FollowFetcher;
  host?: string;
  log?: (message: string) => void;
};

export type RunningServer = {
  server: Server;
  port: number;
  close: () => Promise<void>;
};

export const startServer = async (
  config: Config,
  { fetchSnapshot, fetchFollow, host, log }: StartOptions = {}
): Promise<RunningServer> => {
  // 따라가기 폴러는 브로커를 만든 뒤에 생기므로, 구독 검사에서는 나중에 채워지는 변수를 봄
  let followPoller: FollowPoller | null = null;
  const broker = await createBroker({
    // 서버 전체 따라가기 수가 상한이면 "새 기체" 따라가기만 거절. 이미 누가 따라가는 기체는 추가 비용이 없어서 허용
    allowSubscribe: (topic) =>
      parseFollowTopic(topic) === null ||
      followPoller === null ||
      followPoller.isActive(topic) ||
      followPoller.activeCount < config.maxFollows,
  });
  const sourceOptions = {
    userAgent: config.userAgent,
    timeoutMs: config.requestTimeoutMs,
  };
  // 외부 API 요청 사이 간격 예약표 하나를 격자와 따라가기가 같이 씀.
  // 간격 1.1초: 예비 adsb.fi의 "1초에 1번" 제한을 넘지 않게. 메인 adsb.lol의 호출 제한에도 여유를 줌.
  // 실제로 외부에 나가는 요청(지역 조회, 한반도 밖 격자 조회, 따라가기 조회)만 줄을 세우고,
  // 지역 결과를 다시 쓰기만 하는 격자 폴링은 줄을 서지 않음(폴러에는 spacer: null)
  const spacer = new RequestSpacer(config.minRequestGapMs);
  const areaFetcher = spaced(spacer, fetchSnapshot ?? createDefaultFetcher(sourceOptions));
  const poller = connectPollerToBroker(broker, {
    // 지역(한반도) 안 격자는 지역 통째 조회 결과를 나눠 씀. 결과는 격자 폴링 간격보다 조금 짧게 재사용
    fetchSnapshot: createRegionalFetcher({
      region: config.region,
      fetchArea: areaFetcher,
      ttlMs: Math.max(1000, config.pollIntervalMs - 500),
    }),
    intervalMs: config.pollIntervalMs,
    maxIntervalMs: config.maxPollIntervalMs,
    radiusNm: config.radiusNm,
    spacer: null,
    log,
  });
  followPoller = connectFollowPollerToBroker(broker, {
    fetchFollow: spaced(spacer, fetchFollow ?? createDefaultFollowFetcher(sourceOptions)),
    intervalMs: config.followIntervalMs,
    maxIntervalMs: config.maxPollIntervalMs,
    spacer: null,
    log,
  });
  const follows = followPoller;

  const app = express();
  app.disable('x-powered-by');
  app.get('/health', (_req, res) => {
    const body: HealthResponse = {
      status: 'ok',
      activeGrids: poller.activeGrids,
      activeFollows: follows.activeCount,
      source: poller.status,
    };
    res.json(body);
  });

  const server = createServer(app);
  const ws = attachMqttWebSocket(server, broker);

  await new Promise<void>((resolve, reject) => {
    server.once('error', reject);
    server.listen(config.port, host, () => {
      server.off('error', reject);
      resolve();
    });
  });

  const close = async () => {
    poller.stopAll();
    follows.stopAll();
    await ws.close();
    await new Promise<void>((r) => broker.close(() => r()));
    await new Promise<void>((r) => server.close(() => r()));
  };

  return { server, port: (server.address() as AddressInfo).port, close };
};
