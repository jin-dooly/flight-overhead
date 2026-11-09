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
import { RequestSpacer } from './topicPoller';

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
  // 격자와 따라가기가 같은 외부 API를 부르므로 요청 간격 예약표를 하나로 같이 씀
  const spacer = new RequestSpacer(250);
  const poller = connectPollerToBroker(broker, {
    fetchSnapshot: fetchSnapshot ?? createDefaultFetcher(sourceOptions),
    intervalMs: config.pollIntervalMs,
    maxIntervalMs: config.maxPollIntervalMs,
    radiusNm: config.radiusNm,
    spacer,
    log,
  });
  followPoller = connectFollowPollerToBroker(broker, {
    fetchFollow: fetchFollow ?? createDefaultFollowFetcher(sourceOptions),
    intervalMs: config.pollIntervalMs,
    maxIntervalMs: config.maxPollIntervalMs,
    spacer,
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
