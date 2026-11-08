import { DEFAULT_LOCATION } from '../../config';
import type { DataStatus } from '../../lib/mapStatus';
import { useLocationStore } from '../../store/location';
import { ClockIcon, PinIcon, RefreshIcon } from './icons';

/**
 * 상단 칩 세 개 (목업 Main): 위치, "반경 20km · N대", 연결 상태.
 * 위치 칩은 동네 이름 대신 "내 위치"를 씀. 동네 이름을 얻으려면 정확한 좌표를 외부 역지오코딩 서비스에
 * 보내야 하는데, 정확한 위치는 브라우저 밖으로 보내지 않는다는 원칙 때문
 */
export const TopBar = ({
  status,
  count,
  radiusKm,
}: {
  status: DataStatus;
  count: number | null;
  radiusKm: number;
}) => {
  const locationStatus = useLocationStore((s) => s.status);
  const place =
    locationStatus === 'pending'
      ? '위치 확인 중'
      : locationStatus === 'granted'
        ? '내 위치'
        : DEFAULT_LOCATION.label;

  return (
    <div className="chips">
      <div className="chip">
        <PinIcon color="#1A54E6" />
        <span>{place}</span>
      </div>
      <div className="chip" aria-label={`반경 ${radiusKm}km 안 비행기 ${count ?? 0}대`}>
        <span className="chip-sub">반경 {radiusKm}km</span>
        <span className="chip-dot-sep">·</span>
        <span>{count === null ? '-' : `${count}대`}</span>
      </div>
      <div className="chip-spacer" />
      <StatusChip status={status} />
    </div>
  );
};

const StatusChip = ({ status }: { status: DataStatus }) => {
  switch (status) {
    case 'live':
      return (
        <div className="chip is-live">
          <span className="live-dot" />
          <span>실시간</span>
        </div>
      );
    case 'reconnecting':
      return (
        <div className="chip is-warn">
          <RefreshIcon />
          <span>재연결 중</span>
        </div>
      );
    case 'delayed':
      return (
        <div className="chip is-warn">
          <ClockIcon />
          <span>데이터 지연</span>
        </div>
      );
    case 'connecting':
      return (
        <div className="chip is-neutral">
          <span className="spin" style={{ display: 'inline-flex' }}>
            <RefreshIcon />
          </span>
          <span>연결 중</span>
        </div>
      );
  }
};
