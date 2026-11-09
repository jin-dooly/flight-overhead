import { useCallback, useState } from 'react';
import { DEFAULT_LOCATION } from '../../config';
import { formatAgo } from '../../lib/format';
import type { DataStatus } from '../../lib/mapStatus';
import { useLocationStore } from '../../store/location';
import { ClockIcon, HelpIcon, PinOffIcon, RefreshIcon, WifiOffIcon } from './icons';
import { LocationHelpModal } from './LocationHelpModal';

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
  const [helpOpen, setHelpOpen] = useState(false);
  const closeHelp = useCallback(() => setHelpOpen(false), []);

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

  // 위치를 기다리는 중. 처음 들어왔을 때는 지도 전체를 덮는 안내(LocationPendingOverlay)가 위에 있어서
  // 이 띠는 가려지고, "다시 시도"를 눌렀을 때 보임
  if (locationStatus === 'pending') {
    return (
      <div role="status" className="banner is-dark">
        <span className="spin" style={{ display: 'inline-flex' }}>
          <RefreshIcon size={18} strokeWidth={2} color="#9DB8FF" />
        </span>
        <div className="banner-text">
          <span className="banner-title">내 위치를 확인하는 중이에요</span>
          <span className="banner-desc">허용 창이 뜨면 허용을 눌러 주세요</span>
        </div>
      </div>
    );
  }

  if (locationStatus === 'denied' || locationStatus === 'unavailable') {
    // 검은 배경 (사용자 피드백 2026-11-09: "서버와 연결이 끊겼어요"와 같은 모양으로)
    return (
      <div role="status" className="banner is-dark has-action">
        <PinOffIcon color="#F5C26B" />
        <div className="banner-text">
          <span className="banner-title">기본 위치로 보는 중</span>
          <span className="banner-desc">
            {locationStatus === 'denied'
              ? `위치 권한이 없어서 ${DEFAULT_LOCATION.label} 기준으로 보여 드려요`
              : `위치를 찾지 못해서 ${DEFAULT_LOCATION.label} 기준으로 보여 드려요`}
          </span>
        </div>
        <button
          type="button"
          className="banner-help"
          aria-label="위치 권한을 켜는 방법"
          onClick={() => setHelpOpen(true)}
        >
          <HelpIcon />
        </button>
        <button type="button" className="banner-action" onClick={requestLocation}>
          다시 시도
        </button>
        {helpOpen && <LocationHelpModal onClose={closeHelp} />}
      </div>
    );
  }

  return null;
};
