import type { FollowedAircraft } from '@flight/shared';
import { useState, type ReactNode } from 'react';
import { useNow } from '../../hooks/useNow';
import { deriveFollowPhase, formatDuration, type FollowPhase } from '../../lib/follow';
import {
  formatAgo,
  formatAltitude,
  formatDistanceKm,
  formatSpeed,
  formatTrack,
} from '../../lib/format';
import { bearingDeg } from '../../lib/geo/bearing';
import { distanceKm } from '../../lib/geo/distance';
import { predictPosition } from '../../lib/geo/interpolate';
import { useFlightsStore } from '../../store/flights';
import { useFollowStore } from '../../store/follow';
import { useLocationStore } from '../../store/location';
import { ArrowIcon, PlaneIcon, TargetIcon, WifiOffIcon } from '../mapUi/icons';

/** 따라가기 화면에 필요한 값을 1초마다 다시 계산 */
const useFollowView = () => {
  const now = useNow(1000);
  const clockOffsetMs = useFlightsStore((s) => s.clockOffsetMs);
  const follow = useFollowStore();
  const myLat = useLocationStore((s) => s.lat);
  const myLon = useLocationStore((s) => s.lon);
  const serverNowMs = now - clockOffsetMs;
  const phase = deriveFollowPhase({
    last: follow.last,
    landedAt: follow.landedAt,
    startedAt: follow.startedAt,
    nowMs: serverNowMs,
  });
  const position = follow.last ? predictPosition(follow.last, serverNowMs) : null;
  const me = { lat: myLat, lon: myLon };
  return {
    ...follow,
    phase,
    serverNowMs,
    clockOffsetMs,
    // 비행기에서 나까지 거리와 방향 ("내 위치 ↗ 148 km")
    fromMeKm: position ? distanceKm(me, position) : null,
    toMeDeg: position ? bearingDeg(position, me) : 0,
  };
};

type View = ReturnType<typeof useFollowView>;

const nameOf = (last: FollowedAircraft | null, hex: string | null) =>
  last?.callsign ?? hex?.toUpperCase() ?? '';

/**
 * 따라가기 중 지도 위 UI (상단 띠 + 하단 카드). 1초마다 다시 그려지는 범위를 이 컴포넌트로 한정함
 */
export const FollowOverlay = ({
  placement,
  onExit,
}: {
  /** top: 상단 띠, sheet: 카드. 데스크톱과 폰에서 카드 위치가 달라서 따로 그림 */
  placement: 'top' | 'sheet';
  /** 따라가기를 끝내고 지도를 내 위치로 되돌림 */
  onExit: () => void;
}) => {
  const view = useFollowView();
  return placement === 'top' ? (
    <FollowTop view={view} onExit={onExit} />
  ) : (
    <FollowSheet view={view} onExit={onExit} />
  );
};

const FollowTop = ({ view, onExit }: { view: View; onExit: () => void }) => {
  const name = nameOf(view.last, view.hex);
  const pill: Record<FollowPhase, { className: string; text: string }> = {
    waiting: { className: 'follow-pill', text: '따라가는 중' },
    active: { className: 'follow-pill', text: '따라가는 중' },
    lost: { className: 'follow-pill is-warn', text: '신호 기다리는 중' },
    landed: { className: 'follow-pill is-done', text: '착륙, 따라가기 끝' },
  };
  const { className, text } = view.rejected
    ? { className: 'follow-pill is-warn', text: '따라가기를 시작하지 못했어요' }
    : pill[view.phase];

  return (
    <>
      <div className="follow-bar">
        <div className={className} role="status">
          {!view.rejected && view.phase !== 'landed' && (
            <TargetIcon size={16} color={view.phase === 'lost' ? '#8A5300' : '#FFFFFF'} />
          )}
          <span>
            {!view.rejected && <span className="mono">{name}</span>} {text}
          </span>
        </div>
        <div className="chip-spacer" />
        {view.phase !== 'landed' && (
          <button type="button" className="follow-end" onClick={onExit}>
            끝내기
          </button>
        )}
      </div>
      {view.fromMeKm !== null && !view.rejected && (
        <div className="follow-distance" aria-label={`내 위치까지 ${formatDistanceKm(view.fromMeKm)} km`}>
          <ArrowIcon deg={view.toMeDeg} color="#4A5260" />내 위치 {formatDistanceKm(view.fromMeKm)} km
        </div>
      )}
    </>
  );
};

const FollowSheet = ({ view, onExit }: { view: View; onExit: () => void }) => {
  // "계속 기다리기"를 누르면 끊김 안내 대신 평소 카드를 보여 줌 (신호가 다시 오면 자연스럽게 이어짐)
  const [waitingSince, setWaitingSince] = useState<number | null>(null);

  if (view.rejected) return <RejectedSheet onExit={onExit} />;
  if (view.phase === 'landed') return <LandedSheet view={view} onExit={onExit} />;
  if (view.phase === 'lost' && waitingSince === null) {
    return (
      <LostSheet view={view} onExit={onExit} onWait={() => setWaitingSince(view.serverNowMs)} />
    );
  }
  return <ActiveSheet view={view} />;
};

const ActiveSheet = ({ view }: { view: View }) => {
  const a = view.last;
  const name = nameOf(a, view.hex);
  const late = view.phase === 'lost';
  const track = formatTrack(a?.trackDeg);
  const alt = formatAltitude(a?.altFt);
  const speed = formatSpeed(a?.speedKt);

  return (
    <section aria-label="따라가는 비행기 정보" className="sheet">
      <div className="sheet-handle" />
      <div className="sheet-head">
        <span className="sheet-kind is-following">
          <span className="live-dot" />
          따라가는 중 · {formatDuration(view.serverNowMs - view.startedAt)}째
        </span>
        <span className={`sheet-ago${late ? ' is-warn' : ''}`}>
          {a ? `${formatAgo(view.serverNowMs - a.seenAt)} 기준` : '위치 받는 중'}
        </span>
      </div>
      <div className="sheet-main">
        <div className="sheet-id">
          <span className="callsign">{name}</span>
          <span className="caption">
            기체 ID {view.hex?.toUpperCase()} · 함께 이동 {formatDistanceKm(view.traveledKm)} km
          </span>
        </div>
        <div className="sheet-distance">
          <span className="distance">
            {view.fromMeKm === null ? '-' : formatDistanceKm(view.fromMeKm)}
            <small>km</small>
          </span>
          <span className="caption">나에게서</span>
        </div>
      </div>
      <div className="stats">
        <Stat label="고도" main={alt?.main} sub={alt?.sub} />
        <Stat label="속도" main={speed?.main} sub={speed?.sub} />
        <Stat
          label="방향"
          main={track?.main}
          sub={track?.sub}
          icon={track ? <ArrowIcon deg={a?.trackDeg ?? 0} color="#14181F" /> : null}
        />
      </div>
      <p className="sheet-note">따라가는 동안에는 지도를 확대·축소만 할 수 있어요</p>
    </section>
  );
};

const Stat = ({
  label,
  main,
  sub,
  icon,
}: {
  label: string;
  main?: string;
  sub?: string;
  icon?: ReactNode;
}) => (
  <div className="stat">
    <span className="stat-label">{label}</span>
    <span className="stat-value">
      {main ?? '-'}
      {icon}
    </span>
    {/* 값이 없을 때만 "정보 없음". 착륙 카드처럼 아래 줄이 없는 값은 비워 둠 */}
    {(sub || !main) && <span className="stat-sub">{sub ?? '정보 없음'}</span>}
  </div>
);

const LostSheet = ({
  view,
  onExit,
  onWait,
}: {
  view: View;
  onExit: () => void;
  onWait: () => void;
}) => {
  const name = nameOf(view.last, view.hex);
  const silentMs = view.serverNowMs - (view.last?.seenAt ?? view.startedAt);
  return (
    <section aria-label="신호 끊김 안내" className="sheet">
      <div className="sheet-handle" />
      <div className="sheet-empty">
        <div className="sheet-empty-icon is-warn">
          <WifiOffIcon size={26} color="#8A5300" strokeWidth={1.8} />
        </div>
        <div>
          <h2>신호가 끊겼어요</h2>
          <p>
            <strong className="mono">{name}</strong>의 위치가{' '}
            {Math.max(0, Math.round(silentMs / 1000))}초째 들어오지 않아요. 수신기가 없는 바다 위나
            산간 지역을 지나는 중일 수 있어요. 신호가 다시 잡히면 이어서 따라가요.
          </p>
        </div>
      </div>
      <div className="sheet-actions">
        <button type="button" className="button is-secondary" onClick={onWait}>
          계속 기다리기
        </button>
        <button type="button" className="button is-dark" onClick={onExit}>
          내 위치로 돌아가기
        </button>
      </div>
    </section>
  );
};

const LandedSheet = ({ view, onExit }: { view: View; onExit: () => void }) => {
  const name = nameOf(view.last, view.hex);
  // 착륙 시각은 서버 시계 기준이라, 내 기기 시계로 바꿔서 보여 줌
  const landedClock = new Date((view.landedAt ?? 0) + view.clockOffsetMs).toLocaleTimeString(
    'ko-KR',
    { hour: '2-digit', minute: '2-digit', hour12: false }
  );
  return (
    <section aria-label="착륙 정보" className="sheet">
      <div className="sheet-handle" />
      <div className="sheet-empty">
        <div className="sheet-empty-icon is-live">
          <LandingIcon />
        </div>
        <div>
          <h2>
            <span className="mono">{name}</span>, 착륙했어요
          </h2>
          <p>{landedClock}에 땅에 닿았어요. 지금 위치는 지도에 그대로 남겨 둘게요.</p>
        </div>
      </div>
      <div className="stats">
        <Stat label="함께한 시간" main={formatDuration((view.landedAt ?? 0) - view.startedAt)} />
        <Stat label="함께 이동" main={`${formatDistanceKm(view.traveledKm)} km`} />
        <Stat
          label="나에게서"
          main={view.fromMeKm === null ? undefined : `${formatDistanceKm(view.fromMeKm)} km`}
        />
      </div>
      <button type="button" className="button is-dark" style={{ flex: 'none' }} onClick={onExit}>
        내 위치로 돌아가기
      </button>
    </section>
  );
};

const RejectedSheet = ({ onExit }: { onExit: () => void }) => (
  <section aria-label="따라가기를 시작하지 못함" className="sheet">
    <div className="sheet-handle" />
    <div className="sheet-empty">
      <div className="sheet-empty-icon is-warn">
        <PlaneIcon color="#8A5300" />
      </div>
      <div>
        <h2>지금은 따라가기를 시작할 수 없어요</h2>
        <p>따라가는 사람이 많아서 서버가 잠시 새 따라가기를 받지 않아요. 조금 뒤에 다시 시도해 주세요.</p>
      </div>
    </div>
    <button type="button" className="button is-dark" style={{ flex: 'none' }} onClick={onExit}>
      내 위치로 돌아가기
    </button>
  </section>
);

const LandingIcon = () => (
  <svg
    width="26"
    height="26"
    viewBox="0 0 24 24"
    fill="none"
    stroke="#12805C"
    strokeWidth="1.8"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <path d="M2 20h20" />
    <path d="M3.5 14.5l2.6-1 3.3 2.4 3.4-1.3-5-6.3 2.3-.9 7.4 4.9 3.3-1.3a1.5 1.5 0 0 1 1.1 2.8L6.4 19z" />
  </svg>
);

