import { useEffect, useMemo, useRef, useState, type PointerEvent } from 'react';
import { useDataStatus, useNearby } from '../../hooks/useMapData';
import { compassName, formatAgo, formatAltitude, formatDistanceKm, formatSpeed } from '../../lib/format';
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

/**
 * 하늘 화면 (목업 SkyMain).
 * - 위: 지금 향한 방향(북동 36°)과 나침반 띠
 * - 가운데: 올려다보는 각도 눈금, 지평선, 조준 원, 비행기
 * - 아래: 조준한 비행기 카드
 *
 * 지금은 UI 단계라 방향(heading)과 각도(pitch)를 폰 센서 대신 화면을 끌어서 바꿈.
 * 센서를 연결할 때는 이 두 값만 deviceorientation 이벤트에서 받도록 바꾸면 됨
 */
export const SkyView = ({
  onBack,
  onShowOnMap,
}: {
  onBack: () => void;
  onShowOnMap: (hex: string) => void;
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
    if ((e.target as HTMLElement).closest('.sky-card, .sky-header')) return;
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
        화면을 끌어서 둘러보세요 · 센서를 연결하면 폰 방향을 따라가요
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
