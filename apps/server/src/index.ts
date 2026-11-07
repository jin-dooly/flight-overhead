import { startServer } from './app';
import { loadConfig } from './config';
import { MQTT_PATH } from './broker';

const log = (message: string) =>
  console.log(`[${new Date().toISOString()}] ${message}`);

// apps/server/.env가 있으면 읽음(없으면 무시). Node 20.12 이상의 내장 기능이라 의존성을 추가하지 않음
try {
  process.loadEnvFile?.();
} catch {
  // .env 파일이 없는 경우
}

const config = loadConfig();
const running = await startServer(config, { log });

log(
  `서버 시작: http://localhost:${running.port}/health, MQTT ws://localhost:${running.port}${MQTT_PATH}`
);
log(
  `폴링 ${config.pollIntervalMs}ms, 반경 ${config.radiusNm}nm, User-Agent "${config.userAgent}"`
);

let shuttingDown = false;
const shutdown = (signal: string) => {
  if (shuttingDown) return;
  shuttingDown = true;
  log(`${signal} 수신, 종료 중`);
  // 연결이 남아 있어도 5초 안에는 끝나도록 함
  setTimeout(() => process.exit(1), 5000).unref();
  running.close().then(() => process.exit(0));
};
process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
