/**
 * 동작 확인용 구독 스크립트.
 * 실행 중인 서버(ws://localhost:4000/mqtt)에 붙어 송파구 격자와 상태 토픽을 구독하고,
 * 받은 비행기 수와 소스를 출력함. 기본 60초 뒤 종료.
 *
 *   pnpm --filter @flight/server sub
 *   pnpm --filter @flight/server sub -- --url ws://localhost:4000/mqtt --topic flights/37.5/127.1 --seconds 60
 *
 * 실제 외부 API 호출을 일으키므로 반복 실행하지 않음.
 */
import { STATUS_TOPIC, type Snapshot } from '@flight/shared';
import mqtt from 'mqtt';

const arg = (name: string, fallback: string): string => {
  const index = process.argv.indexOf(`--${name}`);
  return index >= 0 && process.argv[index + 1]
    ? process.argv[index + 1]
    : fallback;
};

const url = arg('url', 'ws://localhost:4000/mqtt');
const topic = arg('topic', 'flights/37.5/127.1');
const seconds = Number(arg('seconds', '60'));

const time = () => new Date().toLocaleTimeString('ko-KR', { hour12: false });
let snapshots = 0;

const client = mqtt.connect(url, { reconnectPeriod: 0, connectTimeout: 5000 });

client.on('connect', async () => {
  console.log(`[${time()}] 연결됨 ${url}`);
  try {
    const granted = await client.subscribeAsync([topic, STATUS_TOPIC]);
    console.log(
      `[${time()}] 구독: ${granted.map((g) => `${g.topic}(qos ${g.qos})`).join(', ')}`
    );
  } catch (err) {
    console.error(`[${time()}] 구독 실패`, err);
    client.end();
  }
});

client.on('message', (t, payload, packet) => {
  if (t === STATUS_TOPIC) {
    console.log(`[${time()}] 상태: ${payload.toString()}`);
    return;
  }
  const snapshot = JSON.parse(payload.toString()) as Snapshot;
  snapshots += 1;
  const ageSec = (Math.max(0, Date.now() - snapshot.fetchedAt) / 1000).toFixed(1);
  const sample = snapshot.aircraft
    .slice(0, 3)
    .map((a) => a.callsign ?? a.hex)
    .join(', ');
  console.log(
    `[${time()}] 스냅샷 #${snapshots}${packet.retain ? ' (retained)' : ''}: ` +
      `${snapshot.aircraft.length}대, 소스 ${snapshot.source}, ${ageSec}초 전 조회` +
      (sample ? `, 예: ${sample}` : '')
  );
});

client.on('error', (err) => {
  // 연결 거부는 AggregateError라 message가 비어 있을 수 있어 code로 판단
  const code = (err as { code?: string }).code;
  if (code === 'ECONNREFUSED' || !client.connected) {
    console.error(
      `[${time()}] ${url}에 연결할 수 없음${code ? ` (${code})` : ''}. ` +
        '이 스크립트는 구독만 하므로, 다른 터미널에서 먼저 서버를 실행하세요: pnpm --filter @flight/server dev'
    );
    client.end(true, () => process.exit(1));
    return;
  }
  console.error(`[${time()}] 오류: ${err.message || code || String(err)}`);
  process.exitCode = 1;
});

setTimeout(() => {
  console.log(`[${time()}] ${seconds}초 경과, 스냅샷 ${snapshots}개 수신. 종료`);
  client.end(true, () => process.exit(snapshots > 0 ? 0 : 1));
}, seconds * 1000);
