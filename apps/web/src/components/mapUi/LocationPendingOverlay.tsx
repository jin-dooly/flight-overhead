import { useCallback, useEffect, useState } from 'react';
import { DEFAULT_LOCATION } from '../../config';
import { useLocationStore } from '../../store/location';
import { LocationHelpModal } from './LocationHelpModal';

/** 덮개가 사라지는 애니메이션 시간. CSS의 transition과 같게 */
const FADE_MS = 300;
/**
 * 기다리는 화면에서 이 시간이 지나도 응답이 없으면 "켜는 방법 보기 / 다시 시도"를 보여 줌.
 * 앱 안 브라우저처럼 허용 창이 아예 안 뜨고 응답도 없는 경우, 버튼이 없으면 덮개에 갇히기 때문
 */
const STUCK_MS = 8_000;

/**
 * 다시 시도는 페이지 새로고침으로 함. 설정 앱이나 브라우저 설정에서 권한을 켜고 돌아왔을 때,
 * 아이폰 Safari 등은 새로고침해야 바뀐 권한을 읽는 경우가 있어서 위치만 다시 요청하는 것보다 확실함
 */
const reload = () => window.location.reload();

/**
 * 처음 들어와서 내 위치를 기다리는 동안 지도 전체를 어둡게 덮는 안내 (사용자 결정 2026-11-09: 목업 B).
 *
 * - 기다리는 중: 안내만 보여 주고 버튼은 없음. 예전에는 여기에 "인천공항으로 보기"가 있었는데,
 *   눌러서 인천공항을 보던 중에 위치가 잡히면 지도가 갑자기 내 위치로 이동해 버려서 뺐음(사용자 피드백)
 * - 권한 거부가 확실할 때(denied): 덮개를 걷지 않고 "위치 권한이 꺼져 있어요"로 바꾸고,
 *   그때만 "켜는 방법 보기"와 "인천공항으로 보기"를 보여 줌
 * - 위치를 받았거나(granted), 권한은 있는데 위치를 못 찾았으면(unavailable): 덮개가 걷힘.
 *   위치를 받았으면 지도가 내 위치로 날아가고(LocationSync), 못 찾았으면 위쪽 안내 띠가 이유를 알려 줌
 */
export const LocationPendingOverlay = () => {
  const status = useLocationStore((s) => s.status);
  // 거부 화면에서 "인천공항으로 보기"를 눌렀는지
  const [dismissed, setDismissed] = useState(false);
  const active = !dismissed && (status === 'pending' || status === 'denied');
  // 흐려지는 애니메이션이 끝나서 완전히 치웠는지.
  // 덮개는 페이지를 처음 열었을 때 한 번만 쓰고, 한 번 치운 뒤에는 다시 보여 주지 않음
  // (나중에 안내 띠의 "다시 시도"로 잠깐 기다리는 상태가 되어도 덮개가 번쩍이지 않게)
  const [gone, setGone] = useState(!active);
  const [helpOpen, setHelpOpen] = useState(false);
  const closeHelp = useCallback(() => setHelpOpen(false), []);
  // 기다린 지 오래됐는지 (STUCK_MS)
  const [stuck, setStuck] = useState(false);
  useEffect(() => {
    if (status !== 'pending') return;
    const timer = setTimeout(() => setStuck(true), STUCK_MS);
    return () => clearTimeout(timer);
  }, [status]);

  // 덮개를 걷을 때는 바로 없애지 않고, 흐려지는 시간이 지난 뒤에 치움
  useEffect(() => {
    if (active) return;
    const timer = setTimeout(() => setGone(true), FADE_MS);
    return () => clearTimeout(timer);
  }, [active]);

  if (gone) return null;
  const denied = status === 'denied';

  return (
    <div className={`pending-overlay${active ? '' : ' is-leaving'}`} role="status" aria-live="polite">
      <div className="pending-center">
        {denied ? (
          <div className="pending-rings is-denied" aria-hidden="true">
            <PinOffIcon />
          </div>
        ) : (
          <div className="pending-rings" aria-hidden="true">
            <span />
            <span />
            <LocateCrossIcon />
          </div>
        )}
        <strong>{denied ? '위치 권한이 꺼져 있어요' : '내 위치를 찾고 있어요'}</strong>
        <p>
          {denied ? (
            <>
              머리 위를 지나는 비행기를 보려면
              <br />
              위치 권한을 켜 주세요
            </>
          ) : (
            <>
              머리 위를 지나는 비행기를 보려면
              <br />
              위치 권한이 필요해요
            </>
          )}
        </p>
      </div>

      <div className="pending-card">
        <p>
          <InfoIcon />
          {denied ? (
            <span>
              허용 창이 뜨지 않았거나 거부를 눌렀어요. 켜지 않으면 {DEFAULT_LOCATION.label} 기준으로
              보여 드려요.
            </span>
          ) : (
            <span>
              허용 창이 뜨면 <b>허용</b>을 눌러 주세요.
              {stuck && ' 창이 안 뜨면 켜는 방법을 확인한 뒤 다시 시도해 주세요.'}
            </span>
          )}
        </p>
        {(denied || stuck) && (
          <div className="pending-actions">
            <button type="button" className="pending-primary" onClick={() => setHelpOpen(true)}>
              켜는 방법 보기
            </button>
            {/* 설정에서 권한을 켜고 돌아온 사람을 위한 버튼 */}
            <button type="button" className="pending-secondary" onClick={reload}>
              <RefreshIcon />
              다시 시도
            </button>
          </div>
        )}
        {denied && (
          <button type="button" className="pending-skip" onClick={() => setDismissed(true)}>
            켜지 않고 {DEFAULT_LOCATION.label} 기준으로 보기
          </button>
        )}
      </div>

      {helpOpen && <LocationHelpModal onClose={closeHelp} />}
    </div>
  );
};

const RefreshIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M20 12a8 8 0 1 1-2.3-5.7" />
    <path d="M20 4v5h-5" />
  </svg>
);

const PinOffIcon = () => (
  <svg
    width="26"
    height="26"
    viewBox="0 0 24 24"
    fill="none"
    stroke="#F5C26B"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M12 21s-7-6.2-7-11.5A7 7 0 0 1 19 9.5C19 14.8 12 21 12 21z" />
    <path d="M4 4l16 16" />
  </svg>
);

const LocateCrossIcon = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#9DB8FF" strokeWidth="2" strokeLinecap="round">
    <circle cx="12" cy="12" r="6" />
    <circle cx="12" cy="12" r="2" fill="#9DB8FF" />
    <path d="M12 2v3M12 19v3M2 12h3M19 12h3" />
  </svg>
);

const InfoIcon = () => (
  <svg
    width="16"
    height="16"
    viewBox="0 0 24 24"
    fill="none"
    stroke="#9DB8FF"
    strokeWidth="2"
    strokeLinecap="round"
    aria-hidden="true"
    style={{ flexShrink: 0, marginTop: 2 }}
  >
    <circle cx="12" cy="12" r="9" />
    <path d="M12 11v5M12 8h.01" />
  </svg>
);
