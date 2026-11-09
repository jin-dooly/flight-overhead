import { useEffect, useMemo, useRef, useState, type PointerEvent } from 'react';
import { useDeviceOrientation } from '../../hooks/useDeviceOrientation';
import { useDataStatus, useNearby } from '../../hooks/useMapData';
import { useMediaQuery } from '../../hooks/useMediaQuery';
import { compassName, formatAgo, formatAltitude, formatDistanceKm, formatSpeed } from '../../lib/format';
import { detectBrowserEnv, type BrowserEnv } from '../../lib/device';
import { distanceKm } from '../../lib/geo/distance';
import { predictPosition } from '../../lib/geo/interpolate';
import { angleDiff, pickLocked, projectToScreen, skyDirection } from '../../lib/sky';
import { useLocationStore } from '../../store/location';
import { BackIcon, MapIcon } from './skyIcons';

const HEADER_HEIGHT = 104;
const RETICLE_RADIUS = 44;
/** 화면 폭이 보여 주는 좌우 각도. 목업은 390px에 약 90도 */
const FIELD_OF_VIEW_DEG = 90;
const MAX_PITCH = 85;

const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));

/** 센서를 못 쓰고 끌어서 둘러보는 이유 (안내 띠 문구) */
export type DragReason = 'denied' | 'unsupported' | 'no-data' | 'preview';

/** 화면을 다시 그릴 만큼 방향이 바뀌었는지 (센서 미세 떨림으로 매 프레임 다시 그리지 않게) */
const LOOK_EPSILON_DEG = 0.05;

/**
 * 하늘 화면 (목업 SkyMain).
 * - 위: 지금 향한 방향(북동 36°)과 나침반 띠
 * - 가운데: 올려다보는 각도 눈금, 지평선, 조준 원, 비행기
 * - 아래: 조준한 비행기 카드
 *
 * 방향(heading)과 각도(pitch)를 어디서 받는지는 mode로 정함
 * - sensor: 폰 방향 센서. 센서 값은 ref로 받고 매 프레임 읽어서 화면에 반영
 * - drag: 화면을 끌어서 둘러보기 (센서 권한 거부, 센서 없음, PC 미리 보기)
 */
export const SkyView = ({
  mode,
  dragReason,
  onBack,
  onShowOnMap,
  onSensorFail,
  onRetrySensor,
}: {
  mode: 'sensor' | 'drag';
  dragReason?: DragReason;
  onBack: () => void;
  onShowOnMap: (hex: string) => void;
  /** 센서 권한은 받았는데 방향 값이 안 올 때 */
  onSensorFail: () => void;
  /** 끌어서 둘러보기 중 "다시 시도" (클릭 안에서 권한을 다시 요청) */
  onRetrySensor: () => void;
}) => {
  const rootRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ width: 390, height: 844 });
  const { status, serverNowMs } = useDataStatus();
  const { inside } = useNearby();
  const myLat = useLocationStore((s) => s.lat);
  const myLon = useLocationStore((s) => s.lon);
  const me = useMemo(() => ({ lat: myLat, lon: myLon }), [myLat, myLon]);

  useEffect(() => {
    const el = rootRef.current;
    if (!el) return;
    const observer = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect;
      setSize({ width, height });
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  // 처음에는 가장 가까운 비행기 쪽을 바라보게 해서, 들어오자마자 비행기 하나가 조준 원에 들어오게 함
  const [look, setLook] = useState(() => {
    const first = inside[0] ? skyDirection(me, inside[0].item) : null;
    return first
      ? { heading: first.azimuthDeg, pitch: clamp(first.elevationDeg, 5, 60) }
      : { heading: 0, pitch: 20 };
  });

  // 센서 모드: 센서 값은 ref에 계속 쌓이고, 매 프레임 읽어서 눈에 띄게 바뀌었을 때만 화면을 다시 그림
  const sensor = useDeviceOrientation(mode === 'sensor');
  useEffect(() => {
    if (mode !== 'sensor') return;
    let frame = 0;
    const tick = () => {
      const next = sensor.lookRef.current;
      if (next) {
        setLook((l) =>
          Math.abs(angleDiff(next.heading, l.heading)) < LOOK_EPSILON_DEG &&
          Math.abs(next.pitch - l.pitch) < LOOK_EPSILON_DEG
            ? l
            : next
        );
      }
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [mode, sensor.lookRef]);
  useEffect(() => {
    if (mode === 'sensor' && sensor.status === 'no-data') onSensorFail();
  }, [mode, sensor.status, onSensorFail]);

  // 가로로 돌리면 "세로로 들어 주세요" (사용자 결정 2026-11-09: 가로 보정 대신 안내)
  const landscape = useMediaQuery('(orientation: landscape)');

  const pxPerDeg = size.width / FIELD_OF_VIEW_DEG;
  const centerY = Math.round(size.height * 0.45);
  const view = { headingDeg: look.heading, pitchDeg: look.pitch, width: size.width, centerY, pxPerDeg };
  const horizonY = centerY + look.pitch * pxPerDeg;

  // 비행기는 1초마다 예상 위치로 다시 계산 (하늘에서는 천천히 움직여 보여서 매 프레임일 필요가 없음)
  const planes = inside
    .map(({ item }) => {
      const pos = { ...item, ...predictPosition(item, serverNowMs) };
      const dir = skyDirection(me, pos);
      if (!dir) return null;
      const p = projectToScreen(dir, view);
      return p.visible ? { ...p, item, dir, groundKm: distanceKm(me, pos) } : null;
    })
    .filter((p): p is NonNullable<typeof p> => p !== null);
  const locked = pickLocked(planes, { x: size.width / 2, y: centerY }, RETICLE_RADIUS);

  // 끌어서 둘러보기: 왼쪽으로 끌면 오른쪽(동쪽)을 보게 되고, 아래로 끌면 위를 보게 됨
  const drag = useRef<{ x: number; y: number } | null>(null);
  const onPointerDown = (e: PointerEvent) => {
    if (mode !== 'drag') return;
    if ((e.target as HTMLElement).closest('.sky-card, .sky-header, .sky-notice')) return;
    drag.current = { x: e.clientX, y: e.clientY };
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  };
  const onPointerMove = (e: PointerEvent) => {
    if (!drag.current) return;
    const dx = e.clientX - drag.current.x;
    const dy = e.clientY - drag.current.y;
    drag.current = { x: e.clientX, y: e.clientY };
    setLook((l) => ({
      heading: (l.heading - dx / pxPerDeg + 360) % 360,
      pitch: clamp(l.pitch + dy / pxPerDeg, 0, MAX_PITCH),
    }));
  };
  const onPointerUp = () => {
    drag.current = null;
  };

  return (
    <div
      ref={rootRef}
      className="sky-view"
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
    >
      {/* 올려다보는 각도 눈금 (10도마다) */}
      {[10, 20, 30, 40, 50, 60, 70, 80].map((elev) => {
        const y = horizonY - elev * pxPerDeg;
        if (y < HEADER_HEIGHT + 10 || y > size.height) return null;
        return (
          <div key={elev} className="sky-elev-line" style={{ top: y }}>
            <span className="sky-elev-label">{elev}°</span>
          </div>
        );
      })}

      <div className="sky-ground" style={{ top: horizonY }}>
        <span>지평선</span>
      </div>

      <div className="sky-reticle" style={{ left: size.width / 2, top: centerY }}>
        <i />
        <i />
        <i />
        <i />
      </div>

      {planes.map((p) => {
        const isLocked = p === locked;
        const iconSize = isLocked ? 34 : 22;
        const name = p.item.callsign ?? p.item.hex.toUpperCase();
        return (
          <div
            key={p.item.hex}
            className={`sky-plane${isLocked ? ' is-locked' : ''}`}
            style={{ left: p.x - iconSize / 2, top: p.y - iconSize / 2 }}
          >
            <div
              className="sky-plane-icon"
              style={{ transform: `rotate(${angleDiff(p.item.trackDeg ?? 0, look.heading)}deg)` }}
            >
              <PlaneSvg size={iconSize} />
            </div>
            <span
              className="sky-plane-label"
              style={isLocked ? { left: iconSize + 24, top: -42 } : { left: iconSize - 4, top: iconSize - 4 }}
            >
              {name} · {formatDistanceKm(p.groundKm)}km
            </span>
          </div>
        );
      })}

      <p className="sky-tip" style={{ top: horizonY + 35 }}>
        {mode === 'sensor'
          ? '대략적인 방향이에요. 폰을 천천히 돌려 보세요'
          : '화면을 끌어서 둘러보세요'}
      </p>

      <header className="sky-header">
        <div className="sky-header-row">
          <button type="button" className="sky-back" onClick={onBack}>
            <BackIcon />
            지도
          </button>
          <span className="sky-heading">
            {compassName(look.heading)} <span className="mono">{Math.round(look.heading) % 360}°</span>
          </span>
          <span className={`sky-status${status === 'live' ? '' : ' is-warn'}`}>
            <span className="sky-status-dot" />
            {status === 'live' ? '실시간' : status === 'delayed' ? '데이터 지연' : '연결 중'}
          </span>
        </div>
        <Compass heading={look.heading} width={size.width} pxPerDeg={pxPerDeg} />
      </header>

      {mode === 'drag' && dragReason && dragReason !== 'preview' && (
        <DragNotice reason={dragReason} onRetry={onRetrySensor} />
      )}

      {mode === 'sensor' && landscape && (
        <div className="sky-landscape" role="status">
          <RotateIcon />
          <strong>폰을 세로로 들어 주세요</strong>
          <p>하늘 모드는 세로 화면에서 방향을 맞춰요</p>
        </div>
      )}

      <section aria-label="조준한 비행기" className="sky-card">
        {locked ? (
          <LockedCard
            plane={locked}
            ago={formatAgo(serverNowMs - locked.item.seenAt)}
            onShowOnMap={() => onShowOnMap(locked.item.hex)}
          />
        ) : (
          <>
            <div className="sky-card-head">
              <span>조준한 비행기 없음</span>
              <span className="mono">하늘에 {planes.length}대</span>
            </div>
            <p className="sky-card-empty">
              {inside.length === 0
                ? '지금 머리 위에는 비행기가 없어요. 지도에서 가장 가까운 비행기를 확인해 보세요.'
                : '가운데 원에 비행기를 맞추면 정보를 보여 드려요.'}
            </p>
          </>
        )}
      </section>
    </div>
  );
};

const Compass = ({ heading, width, pxPerDeg }: { heading: number; width: number; pxPerDeg: number }) => {
  const half = width / 2 / pxPerDeg;
  const ticks: { deg: number; x: number }[] = [];
  for (let d = Math.floor((heading - half) / 5) * 5; d <= heading + half; d += 5) {
    ticks.push({ deg: ((d % 360) + 360) % 360, x: width / 2 + (d - heading) * pxPerDeg });
  }
  return (
    <div className="sky-compass" aria-hidden="true">
      {ticks.map(({ deg, x }) => {
        const major = deg % 45 === 0;
        return (
          <div key={x}>
            <div
              className="sky-tick"
              style={{
                left: x,
                height: major ? 16 : deg % 10 === 0 ? 10 : 6,
                background: major ? '#C9D2E3' : '#5A6A8A',
              }}
            />
            {major && (
              <div className="sky-compass-label" style={{ left: x }}>
                {compassName(deg)}
              </div>
            )}
          </div>
        );
      })}
      <div className="sky-pointer" style={{ left: width / 2 }} />
    </div>
  );
};

type Plane = {
  item: { hex: string; callsign?: string; altFt?: number; speedKt?: number };
  dir: { elevationDeg: number };
  groundKm: number;
};

const LockedCard = ({ plane, ago, onShowOnMap }: { plane: Plane; ago: string; onShowOnMap: () => void }) => {
  const hex = plane.item.hex.toUpperCase();
  return (
    <>
      <div className="sky-card-head">
        <span>조준한 비행기</span>
        <span className="mono">{ago} 기준</span>
      </div>
      <div className="sky-card-main">
        <div className="sheet-id">
          <span className="callsign">{plane.item.callsign ?? hex}</span>
          <span className="caption">기체 ID {hex}</span>
        </div>
        <div className="sheet-distance">
          <span className="distance">
            {formatDistanceKm(plane.groundKm)}
            <small>km</small>
          </span>
          <span className="caption">나와의 거리</span>
        </div>
      </div>
      <div className="sky-stats">
        <div className="sky-stat">
          <span>고도</span>
          <span>{formatAltitude(plane.item.altFt)?.main ?? '-'}</span>
        </div>
        <div className="sky-stat">
          <span>올려다볼 각도</span>
          <span>{Math.round(plane.dir.elevationDeg)}°</span>
        </div>
        <div className="sky-stat">
          <span>속도</span>
          <span>{formatSpeed(plane.item.speedKt)?.main ?? '-'}</span>
        </div>
      </div>
      <button type="button" className="sky-map-button" onClick={onShowOnMap}>
        <MapIcon />
        지도에서 보기
      </button>
    </>
  );
};

const PlaneSvg = ({ size }: { size: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true">
    <path
      d="M12 2c.8 0 1.3.7 1.3 1.6V9l7.7 4.6v2l-7.7-2.3v4.9l2.2 1.7V21L12 20.2 8.5 21v-1.1l2.2-1.7v-4.9L3 15.6v-2L10.7 9V3.6C10.7 2.7 11.2 2 12 2z"
      fill="currentColor"
    />
  </svg>
);

/** 센서 권한을 다시 켜는 방법. 기기와 브라우저마다 달라서 지금 환경에 맞는 문장을 고름 */
const DENIED_HOW: Record<BrowserEnv, string> = {
  kakao: '카카오톡 ⋯ 메뉴의 "다른 브라우저로 열기"로 Safari나 Chrome에서 열어 주세요.',
  inapp: '⋯ 메뉴의 "브라우저에서 열기"로 Safari나 Chrome에서 열어 주세요.',
  'ios-safari': 'Safari를 완전히 닫았다가 다시 열고, 다시 시도를 눌러 허용해 주세요.',
  'ios-chrome': 'Chrome을 완전히 닫았다가 다시 열고, 다시 시도를 눌러 허용해 주세요.',
  android: '주소창 왼쪽 아이콘 → 권한(또는 사이트 설정) → 동작 센서를 허용한 뒤 다시 시도를 눌러 주세요.',
  desktop: '폰에서 열면 폰 방향을 따라가요.',
};

/** 센서를 못 쓸 때 위쪽 안내 (사용자 결정 2026-11-09: 거부하면 끌어서 둘러보기로) */
const noticeText = (
  reason: Exclude<DragReason, 'preview'>,
  env: BrowserEnv
): { title: string; desc: string } => {
  if (reason === 'denied') {
    return { title: '센서 권한이 없어서 화면을 끌어서 둘러봐요', desc: DENIED_HOW[env] };
  }
  if (reason === 'unsupported') {
    return {
      title: '이 브라우저는 방향 센서를 지원하지 않아요',
      desc: '화면을 끌어서 둘러볼 수 있어요. Safari나 Chrome에서 열면 폰 방향을 따라가요.',
    };
  }
  return {
    title: '나침반 값을 받지 못해서 화면을 끌어서 둘러봐요',
    desc: '폰을 8자 모양으로 몇 번 돌리면 나침반이 맞춰질 수 있어요. 그 뒤 다시 시도를 눌러 주세요.',
  };
};

const DragNotice = ({ reason, onRetry }: { reason: Exclude<DragReason, 'preview'>; onRetry: () => void }) => {
  const text = noticeText(reason, detectBrowserEnv(navigator.userAgent, navigator.maxTouchPoints));
  return (
  <div className="sky-notice" role="status">
    <div>
      <strong>{text.title}</strong>
      <p>{text.desc}</p>
    </div>
    {reason !== 'unsupported' && (
      <button type="button" onClick={onRetry}>
        다시 시도
      </button>
    )}
  </div>
  );
};

const RotateIcon = () => (
  <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#9DB8FF" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <rect x="7" y="2" width="10" height="20" rx="2.5" />
    <path d="M11 18h2" />
  </svg>
);
