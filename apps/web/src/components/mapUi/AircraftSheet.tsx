import type { ReactNode } from 'react';
import { MAX_VIEW_RADIUS_KM } from '../../config';
import { distanceKm } from '../../lib/geo/distance';
import { predictPosition } from '../../lib/geo/interpolate';
import {
  formatAgo,
  formatAltitude,
  formatDistanceKm,
  formatSpeed,
  formatTrack,
  type DisplayValue,
} from '../../lib/format';
import type { DataStatus } from '../../lib/mapStatus';
import type { WithDistance } from '../../lib/nearby';
import { useFlightsStore } from '../../store/flights';
import { useLocationStore } from '../../store/location';
import { ArrowIcon, ClockIcon, CloseIcon, PlaneIcon, RefreshIcon, SkyIcon, WidenIcon } from './icons';

type Props = {
  status: DataStatus;
  /** 서버 시계 기준 지금(ms). 1초마다 바뀌어서 "N초 전"과 거리가 갱신됨 */
  serverNowMs: number;
  hasSnapshot: boolean;
  card: { target: WithDistance; kind: 'selected' | 'nearest' } | null;
  nearestOutside: WithDistance | null;
  radiusKm: number;
  onWiden: () => void;
  onOpenSky: () => void;
  /** 카드 아래 버튼 줄에 더 붙일 버튼 (따라가기 기능이 씀) */
  extraActions?: ReactNode;
};

/**
 * 하단 카드 (데스크톱에서는 왼쪽 패널).
 * - 반경 안 비행기가 있으면: 선택한 비행기, 없으면 가장 가까운 비행기의 상세 (목업 Main, MapSelected)
 * - 반경 안이 비어 있으면: "지금 머리 위에는 비행기가 없어요" (목업 MapEmpty)
 * - 아직 데이터를 못 받았으면: 받아 오는 중
 */
export const AircraftSheet = (props: Props) => {
  const { status, hasSnapshot, card } = props;
  const locating = useLocationStore((s) => s.status === 'pending');

  // 위치를 다시 찾는 동안(안내 띠의 "다시 시도")에는 기본 위치 기준 값이 틀린 값이 되므로 모두 "-"로 비움
  if (locating && hasSnapshot) return <LocatingSheet />;
  if (!hasSnapshot) return <LoadingSheet status={status} />;
  if (!card) return <EmptySheet {...props} />;
  return <DetailSheet {...props} card={card} />;
};

/** 지금 예상 위치 기준 나와의 거리. 비행기는 계속 움직이므로 스냅샷 때 거리 대신 매초 다시 계산 */
const useLiveDistance = (target: WithDistance, serverNowMs: number) => {
  const lat = useLocationStore((s) => s.lat);
  const lon = useLocationStore((s) => s.lon);
  return distanceKm({ lat, lon }, predictPosition(target.item, serverNowMs));
};

const DetailSheet = ({
  status,
  serverNowMs,
  card,
  onOpenSky,
  extraActions,
}: Props & { card: NonNullable<Props['card']> }) => {
  const { target, kind } = card;
  const a = target.item;
  const distance = useLiveDistance(target, serverNowMs);
  const offline = status === 'reconnecting';
  const late = status === 'delayed' || offline;
  const ago = `${formatAgo(serverNowMs - a.seenAt)} 기준`;
  const hex = a.hex.toUpperCase();
  const track = formatTrack(a.trackDeg);

  return (
    <section
      aria-label={kind === 'selected' ? '선택한 비행기 정보' : '가장 가까운 비행기 정보'}
      className={`sheet${offline ? ' is-dim' : ''}`}
    >
      <div className="sheet-handle" />
      <div className="sheet-head">
        {kind === 'selected' ? (
          <>
            <span className="sheet-kind is-selected">선택한 비행기</span>
            <button
              type="button"
              className="sheet-close"
              aria-label="선택 해제하고 가장 가까운 비행기 보기"
              onClick={() => useFlightsStore.setState({ selectedHex: null })}
            >
              <CloseIcon />
            </button>
          </>
        ) : (
          <>
            <span className="sheet-kind">가장 가까운 비행기</span>
            <span className={`sheet-ago${late ? ' is-warn' : ''}`}>
              {status === 'delayed' && <ClockIcon size={12} />}
              {ago}
            </span>
          </>
        )}
      </div>

      <div className="sheet-main">
        <div className="sheet-id">
          <span className="callsign">{a.callsign ?? hex}</span>
          <span className="caption">
            {a.callsign ? `기체 ID ${hex}` : '편명 정보가 없어요'}
            {kind === 'selected' && (
              <span className={late ? 'sheet-ago is-warn' : undefined}> · {ago}</span>
            )}
          </span>
        </div>
        <div className="sheet-distance">
          <span className="distance">
            {formatDistanceKm(distance)}
            <small>km</small>
          </span>
          <span className="caption">나와의 거리</span>
        </div>
      </div>

      <div className="stats">
        <Stat label="고도" value={formatAltitude(a.altFt)} />
        <Stat label="속도" value={formatSpeed(a.speedKt)} />
        <Stat
          label="방향"
          value={track}
          icon={track && !offline ? <ArrowIcon deg={a.trackDeg ?? 0} color="#14181F" /> : null}
        />
      </div>

      <div className="sheet-actions">
        {extraActions}
        <button type="button" className="button is-secondary" onClick={onOpenSky}>
          <SkyIcon color="#14181F" />
          하늘 모드
        </button>
      </div>
    </section>
  );
};

const Stat = ({
  label,
  value,
  icon,
}: {
  label: string;
  value: DisplayValue | null;
  icon?: ReactNode;
}) => (
  <div className="stat">
    <span className="stat-label">{label}</span>
    <span className="stat-value">
      {value?.main ?? '-'}
      {icon}
    </span>
    <span className="stat-sub">{value?.sub ?? '정보 없음'}</span>
  </div>
);

const EmptySheet = ({ serverNowMs, nearestOutside, radiusKm, onWiden }: Props) => {
  const canWiden = radiusKm < MAX_VIEW_RADIUS_KM && nearestOutside !== null;

  return (
    <section aria-label="비행기 없음" className="sheet">
      <div className="sheet-handle" />
      <div className="sheet-empty">
        <div className="sheet-empty-icon">
          <PlaneIcon />
        </div>
        <div>
          <h2>지금 머리 위에는 비행기가 없어요</h2>
          {nearestOutside ? (
            <NearestText target={nearestOutside} serverNowMs={serverNowMs} />
          ) : (
            <p>근처 약 30km 안에 지나가는 비행기가 없어요.</p>
          )}
        </div>
      </div>
      {canWiden && (
        <button type="button" className="button is-dark" style={{ flex: 'none' }} onClick={onWiden}>
          <WidenIcon color="#FFFFFF" />
          반경 {MAX_VIEW_RADIUS_KM}km까지 넓히기
        </button>
      )}
      <p className="sheet-note">밤이나 새벽에는 지나가는 비행기가 적어요</p>
    </section>
  );
};

const NearestText = ({ target, serverNowMs }: { target: WithDistance; serverNowMs: number }) => {
  const distance = useLiveDistance(target, serverNowMs);
  const name = target.item.callsign ?? target.item.hex.toUpperCase();
  return (
    <p>
      가장 가까운 비행기는 <strong className="mono">{name}</strong>,{' '}
      <strong>{formatDistanceKm(distance)} km</strong> 떨어져 있어요.
    </p>
  );
};

const LoadingSheet = ({ status }: { status: DataStatus }) => {
  const locationStatus = useLocationStore((s) => s.status);
  const desc =
    locationStatus === 'pending'
      ? '내 위치를 확인하고 있어요.'
      : status === 'connecting' || status === 'reconnecting'
        ? '서버에 연결하는 중이에요. 서버가 쉬고 있었다면 처음 접속은 1분 가까이 걸릴 수 있어요.'
        : '잠시만 기다려 주세요.';

  return (
    <section aria-label="비행기 정보를 받는 중" className="sheet" aria-busy="true">
      <div className="sheet-handle" />
      <div className="sheet-empty">
        <div className="sheet-empty-icon">
          <span className="spin" style={{ display: 'inline-flex' }}>
            <RefreshIcon size={20} color="#4A5260" />
          </span>
        </div>
        <div>
          <h2>비행기 정보를 받아 오는 중이에요</h2>
          <p>{desc}</p>
        </div>
      </div>
    </section>
  );
};

/**
 * 내 위치를 다시 찾는 중 (사용자 피드백 2026-11-09).
 * 상세 카드와 같은 모양에 값만 모두 "-"로 비워서, 지금 보이는 값이 아직 내 위치 기준이 아니라는 걸 분명히 함
 */
const LocatingSheet = () => (
  <section aria-label="내 위치를 확인하는 중" className="sheet is-locating" aria-busy="true">
    <div className="sheet-handle" />
    <div className="sheet-head">
      <span className="sheet-kind locating-kind">
        <span className="spin" style={{ display: 'inline-flex' }}>
          <RefreshIcon size={12} color="#1A54E6" />
        </span>
        내 위치를 확인하는 중
      </span>
      <span className="sheet-ago">-</span>
    </div>
    <div className="sheet-main">
      <div className="sheet-id">
        <span className="callsign">-</span>
        <span className="caption">기체 ID -</span>
      </div>
      <div className="sheet-distance">
        <span className="distance">
          -<small>km</small>
        </span>
        <span className="caption">나와의 거리</span>
      </div>
    </div>
    <div className="stats">
      {['고도', '속도', '방향'].map((label) => (
        <div className="stat" key={label}>
          <span className="stat-label">{label}</span>
          <span className="stat-value">-</span>
          <span className="stat-sub">-</span>
        </div>
      ))}
    </div>
  </section>
);
