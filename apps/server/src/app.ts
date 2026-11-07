import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import type { SourceStatus } from '@flight/shared';
import express from 'express';
import { attachMqttWebSocket, createBroker } from './broker';
import type { Config } from './config';
import { connectPollerToBroker } from './realtime';
import { createDefaultFetcher, type SnapshotFetcher } from './sources';

export type HealthResponse = {
  status: 'ok';
  activeGrids: number;
  source: SourceStatus;
};

export type StartOptions = {
  /** 테스트에서 외부 API 대신 가짜 조회 함수를 넣기 위한 주입점 */
  fetchSnapshot?: SnapshotFetcher;
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
  { fetchSnapshot, host, log }: StartOptions = {}
): Promise<RunningServer> => {
  const broker = await createBroker();
  const poller = connectPollerToBroker(broker, {
    fetchSnapshot:
      fetchSnapshot ??
      createDefaultFetcher({
        userAgent: config.userAgent,
        timeoutMs: config.requestTimeoutMs,
      }),
    intervalMs: config.pollIntervalMs,
    maxIntervalMs: config.maxPollIntervalMs,
    radiusNm: config.radiusNm,
    log,
  });

  const app = express();
  app.disable('x-powered-by');
  app.get('/health', (_req, res) => {
    const body: HealthResponse = {
      status: 'ok',
      activeGrids: poller.activeGrids,
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
    await ws.close();
    await new Promise<void>((r) => broker.close(() => r()));
    await new Promise<void>((r) => server.close(() => r()));
  };

  return { server, port: (server.address() as AddressInfo).port, close };
};
