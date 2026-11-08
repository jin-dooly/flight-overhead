import type { Aircraft } from '@flight/shared';

export const MOCK_AIRCRAFT: Aircraft[] = [
  {
    hex: 'mock1',
    callsign: 'KAL123',
    lat: 37.56,
    lon: 127.02,
    altFt: 8000,
    speedKt: 250,
    trackDeg: 300,
    seenAt: Date.now(),
  },
  {
    hex: 'mock2',
    lat: 37.45,
    lon: 127.18,
    altFt: 3000,
    speedKt: 160,
    trackDeg: 45,
    seenAt: Date.now(),
  },
  // 편명 없는 기체, 북쪽(0도), 남쪽(180도)으로 가는 기체도 하나씩 넣어서 회전과 라벨이 맞는지 확인
];
