// 하늘 모드 자리. MVP에서는 안내만 보여 주고, 센서 권한 요청과 비행기 배치는 따라가기 다음에 구현 (목업 SkyPermission, SkyMain)
export const SkyPage = ({ onBack }: { onBack: () => void }) => {
  return (
    <div
      style={{
        minHeight: '100dvh',
        padding: 24,
        background: 'var(--sky-bg)',
        color: '#FFFFFF',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        gap: 16,
      }}
    >
      <h1 style={{ margin: 0, fontSize: 24, fontWeight: 700 }}>하늘 모드는 준비 중이에요</h1>
      <p style={{ margin: 0, fontSize: 14, lineHeight: 1.6, color: '#C9CED6' }}>
        폰을 하늘로 들면 그 방향의 비행기를 알려 주는 화면이에요. 지금은 지도에서 내 머리 위
        비행기를 볼 수 있어요.
      </p>
      <button
        type="button"
        onClick={onBack}
        style={{
          height: 52,
          border: 'none',
          borderRadius: 14,
          background: '#FFFFFF',
          color: 'var(--text)',
          fontSize: 15,
          fontWeight: 600,
        }}
      >
        지도로 돌아가기
      </button>
    </div>
  );
};
