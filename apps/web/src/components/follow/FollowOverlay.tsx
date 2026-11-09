import type { FollowedAircraft } from '@flight/shared';
import { useState, type ReactNode } from 'react';
import { useNow } from '../../hooks/useNow';
import { deriveFollowPhase, FOLLOW_LOST_MS, formatDuration, type FollowPhase } from '../../lib/follow';
import {
  formatAgo,
  formatAltitude,
  formatDistanceKm,
  formatSpeed,
  formatTrack,
} from '../../lib/format';
import { bearingDeg } from '../../lib/geo/bearing';
import { arrivalLabel, departureLabel, describePlace } from '../../lib/airports';
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
  const position = follow.last ? predictPosition(follow.last, serverNowMs, FOLLOW_LOST_MS) : null;
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
    landed: { className: 'follow-pill is-done', text: '' },
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
          {!view.rejected && view.phase === 'landed' && <CheckIcon />}
          {view.phase === 'landed' && !view.rejected ? (
            // 착륙: "도착 · 제주국제공항" (목업 A)
            <span>도착 · {view.last ? arrivalLabel(describePlace(view.last)).title : '도착 지점'}</span>
          ) : (
            <span>
              {!view.rejected && <span className="mono">{name}</span>} {text}
            </span>
          )}
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
            <strong className="mono">{name}</strong>의 위치가 {silentText(silentMs)}째 들어오지
            않아요. 수신기가 없는 바다 위나
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

/** 끊긴 시간을 "45초", "3분"처럼 */
const silentText = (ms: number) => {
  const seconds = Math.max(0, Math.round(ms / 1000));
  return seconds < 60 ? `${seconds}초` : `${Math.floor(seconds / 60)}분`;
};

/** 서버 시각을 내 기기 시계의 "14:52"로 */
const clockText = (serverMs: number, clockOffsetMs: number) =>
  new Date(serverMs + clockOffsetMs).toLocaleTimeString('ko-KR', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });

/**
 * 착륙 화면 (사용자 결정 2026-11-09: 목업 A "탑승권 카드").
 * 경고처럼 보이던 예전 화면 대신, 무사히 함께 비행을 마친 느낌을 주려고
 * 출발 → 도착을 탑승권처럼 보여 주고, 함께한 시간, 이동 거리, 최고 고도를 기념처럼 정리함
 */
const LandedSheet = ({ view, onExit }: { view: View; onExit: () => void }) => {
  const name = nameOf(view.last, view.hex);
  const from = view.trail[0];
  const to = view.last;
  const departure = from ? departureLabel(describePlace(from)) : '출발 지점';
  const arrival = to ? arrivalLabel(describePlace(to)) : { title: '도착 지점', short: '도착 지점' };
  const landedAt = view.landedAt ?? view.serverNowMs;
  const maxAlt = formatAltitude(view.maxAltFt ?? undefined);

  return (
    <section aria-label="착륙 정보" className="sheet">
      <div className="sheet-handle" />
      <span className="landed-kicker">
        <CelebrateIcon />
        무사히 도착했어요
      </span>
      <h2 className="landed-title">
        {/* 편명 끝 글자에 따라 "와/과"가 달라져서 조사가 필요 없는 문장으로 씀 */}
        <span className="mono">{name}</span> 비행을 끝까지 함께했어요
      </h2>

      <div className="ticket">
        <div className="ticket-route">
          <div>
            <span className="ticket-label">출발</span>
            <span className="ticket-place">{departure}</span>
            <span className="ticket-time mono">{clockText(view.startedAt, view.clockOffsetMs)}</span>
          </div>
          <PlaneRouteIcon />
          <div className="ticket-to">
            <span className="ticket-label">도착</span>
            <span className="ticket-place">{arrival.short}</span>
            <span className="ticket-time mono">{clockText(landedAt, view.clockOffsetMs)}</span>
          </div>
        </div>
        <div className="ticket-stats">
          <div>
            <span>함께한 시간</span>
            <b>{formatDuration(landedAt - view.startedAt)}</b>
          </div>
          <div>
            <span>함께 이동</span>
            <b>{formatDistanceKm(view.traveledKm)} km</b>
          </div>
          <div>
            <span>최고 고도</span>
            <b>{maxAlt?.main ?? '-'}</b>
          </div>
        </div>
      </div>

      <button type="button" className="button is-primary" style={{ flex: 'none' }} onClick={onExit}>
        내 위치로 돌아가기
      </button>
    </section>
  );
};

const CheckIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#12805C" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <circle cx="12" cy="12" r="9" />
    <path d="M8 12.5l2.5 2.5L16 9.5" />
  </svg>
);

const CelebrateIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M4 20l5-14 9 9z" />
    <path d="M14 4l1 2M19 9l2-1M17 3l-1 3 3-1" />
  </svg>
);

const PlaneRouteIcon = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" aria-hidden="true" style={{ transform: 'rotate(90deg)', flexShrink: 0 }}>
    <path
      d="M12 2c.8 0 1.3.7 1.3 1.6V9l7.7 4.6v2l-7.7-2.3v4.9l2.2 1.7V21L12 20.2 8.5 21v-1.1l2.2-1.7v-4.9L3 15.6v-2L10.7 9V3.6C10.7 2.7 11.2 2 12 2z"
      fill="#1A54E6"
    />
  </svg>
);

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

