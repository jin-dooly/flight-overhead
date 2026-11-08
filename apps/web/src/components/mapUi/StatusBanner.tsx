import { DEFAULT_LOCATION } from '../../config';
import { formatAgo } from '../../lib/format';
import type { DataStatus } from '../../lib/mapStatus';
import { useLocationStore } from '../../store/location';
import { ClockIcon, PinIcon, PinOffIcon, WifiOffIcon } from './icons';

/**
 * 상단 칩 아래 안내 띠. 여러 상황이 겹치면 사용자가 가장 먼저 알아야 할 것 하나만 보여 줌.
 * 순서: 연결 끊김 > 데이터 지연 > 위치 확인 중 > 기본 위치로 보는 중
 * (연결이 끊기면 데이터 지연도 같이 생기므로, 원인인 연결 끊김을 먼저 알림)
 */
export const StatusBanner = ({
  status,
  snapshotAgeMs,
}: {
  status: DataStatus;
  snapshotAgeMs: number | null;
}) => {
  const locationStatus = useLocationStore((s) => s.status);
  const requestLocation = useLocationStore((s) => s.requestLocation);

  if (status === 'reconnecting') {
    return (
      <div role="status" className="banner is-dark">
        <WifiOffIcon color="#F5C26B" />
        <div className="banner-text">
          <span className="banner-title">서버와 연결이 끊겼어요</span>
          <span className="banner-desc">
            다시 연결하는 중이에요. 마지막 위치를 흐리게 보여 드려요.
          </span>
        </div>
      </div>
    );
  }

  if (status === 'delayed') {
    return (
      <div role="status" className="banner is-warn">
        <ClockIcon size={18} strokeWidth={2} color="#8A5300" />
        <div className="banner-text">
          <span className="banner-title">
            데이터가 {snapshotAgeMs === null ? '조금' : formatAgo(snapshotAgeMs)} 기준이에요
          </span>
          <span className="banner-desc">
            위치 데이터 소스가 응답하지 않아 다시 시도하는 중이에요. 비행기 위치는 예상 경로로 보여
            드려요.
          </span>
        </div>
      </div>
    );
  }

  if (locationStatus === 'pending') {
    return (
      <div role="status" className="banner is-neutral">
        <PinIcon size={18} color="#1A54E6" />
        <div className="banner-text">
          <span className="banner-title">내 위치를 확인하는 중이에요</span>
          <span className="banner-desc">위치 권한을 허용하면 내 머리 위 비행기를 보여 드려요.</span>
        </div>
      </div>
    );
  }

  if (locationStatus === 'denied' || locationStatus === 'unavailable') {
    return (
      <div role="status" className="banner is-warn has-action">
        <PinOffIcon color="#8A5300" />
        <div className="banner-text">
          <span className="banner-title">기본 위치로 보는 중</span>
          <span className="banner-desc">
            {locationStatus === 'denied'
              ? `위치 권한이 없어서 ${DEFAULT_LOCATION.label} 기준으로 보여 드려요`
              : `위치를 찾지 못해서 ${DEFAULT_LOCATION.label} 기준으로 보여 드려요`}
          </span>
        </div>
        <button type="button" className="banner-action" onClick={requestLocation}>
          다시 시도
        </button>
      </div>
    );
  }

  return null;
};
