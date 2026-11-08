import { useState } from 'react';
import { BackIcon } from './skyIcons';

/**
 * 하늘 모드 시작 화면 (목업 SkyPermission). 무엇을 하는지, 센서를 어디에 쓰는지 먼저 알려 줌.
 * iOS는 사용자가 버튼을 눌러야만 방향 센서 권한을 물을 수 있어서, 이 버튼이 그 역할을 함.
 *
 * 지금은 화면(UI)만 만든 단계라 버튼은 센서 권한을 묻지 않고 하늘 화면으로 넘어감.
 * 센서 연결은 다음 작업 (docs/HANDOFF-SKY.md)
 */
export const SkyIntro = ({ onBack, onStart }: { onBack: () => void; onStart: () => void }) => {
  const [starting, setStarting] = useState(false);
  return (
    <div className="sky-intro">
      <button type="button" className="sky-back" onClick={onBack} style={{ alignSelf: 'flex-start' }}>
        <BackIcon />
        지도로 돌아가기
      </button>

      <div className="sky-intro-body">
        <Illustration />
        <div>
          <h1>폰을 하늘로 들어 보세요</h1>
          <p className="sky-intro-lead">
            폰이 향하는 방향에 있는 비행기를 찾아 드려요. 방향을 알려면 나침반과 기울기 센서를
            써야 해요.
          </p>
        </div>
        <ul className="sky-notes">
          <li>
            <LockIcon />
            <span>센서 값은 화면을 그리는 데만 쓰고, 기기 밖으로 보내지 않아요.</span>
          </li>
          <li>
            <CompassIcon />
            <span>방향은 대략적이에요. 주변에 금속이나 자석이 있으면 어긋날 수 있어요.</span>
          </li>
          <li>
            <AimIcon />
            <span>폰을 세로로 들고 천천히 돌리면서, 가운데 원에 비행기를 맞춰 보세요.</span>
          </li>
        </ul>
      </div>

      <div>
        <button
          type="button"
          className="sky-primary"
          style={{ width: '100%' }}
          disabled={starting}
          onClick={() => {
            setStarting(true);
            onStart();
          }}
        >
          센서 켜고 시작하기
        </button>
        <p className="sky-hint">iPhone에서는 다음에 뜨는 창에서 '허용'을 눌러 주세요</p>
      </div>
    </div>
  );
};

const Illustration = () => (
  <div style={{ alignSelf: 'center', width: 220, height: 200, position: 'relative' }} aria-hidden="true">
    <div
      style={{
        position: 'absolute',
        left: 30,
        top: 10,
        width: 160,
        height: 160,
        borderRadius: '50%',
        border: '1px dashed #3A4A6B',
      }}
    />
    <div
      style={{
        position: 'absolute',
        left: 70,
        top: 50,
        width: 80,
        height: 80,
        borderRadius: '50%',
        border: '1px solid #3A4A6B',
      }}
    />
    <div style={{ position: 'absolute', left: 150, top: 22, color: '#F2F4F8', transform: 'rotate(60deg)' }}>
      <svg width="26" height="26" viewBox="0 0 24 24">
        <path
          d="M12 2c.8 0 1.3.7 1.3 1.6V9l7.7 4.6v2l-7.7-2.3v4.9l2.2 1.7V21L12 20.2 8.5 21v-1.1l2.2-1.7v-4.9L3 15.6v-2L10.7 9V3.6C10.7 2.7 11.2 2 12 2z"
          fill="currentColor"
        />
      </svg>
    </div>
    <div
      style={{
        position: 'absolute',
        left: 86,
        top: 84,
        width: 48,
        height: 84,
        borderRadius: 10,
        border: '2px solid #9DB8FF',
        background: '#13213F',
        transform: 'perspective(200px) rotateX(38deg)',
      }}
    >
      <div
        style={{
          position: 'absolute',
          left: 14,
          bottom: 6,
          width: 16,
          height: 3,
          borderRadius: 2,
          background: '#9DB8FF',
        }}
      />
    </div>
    <svg width="220" height="200" viewBox="0 0 220 200" style={{ position: 'absolute', left: 0, top: 0 }}>
      <path
        d="M58 150 C 40 110, 60 60, 104 46"
        fill="none"
        stroke="#9DB8FF"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeDasharray="3 5"
      />
      <path d="M98 40 L 106 46 L 98 52" fill="none" stroke="#9DB8FF" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  </div>
);

const iconProps = {
  width: 18,
  height: 18,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: '#9DB8FF',
  strokeWidth: 2,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
  'aria-hidden': true,
};

const LockIcon = () => (
  <svg {...iconProps}>
    <rect x="5" y="11" width="14" height="10" rx="2" />
    <path d="M8 11V7a4 4 0 0 1 8 0v4" />
  </svg>
);

const CompassIcon = () => (
  <svg {...iconProps}>
    <circle cx="12" cy="12" r="9" />
    <path d="M15.5 8.5l-2 5-5 2 2-5z" />
  </svg>
);

const AimIcon = () => (
  <svg {...iconProps}>
    <path d="M12 3v3M12 18v3M3 12h3M18 12h3" />
    <circle cx="12" cy="12" r="5" />
  </svg>
);
