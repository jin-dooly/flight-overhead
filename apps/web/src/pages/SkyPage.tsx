// 하늘 모드 자리. 센서 권한 요청과 비행기 배치는 따라가기 다음에 구현 (목업 08, 09 화면)
export const SkyPage = ({ onBack }: { onBack: () => void }) => {
  return (
    <div style={{ padding: 16 }}>
      <button type="button" onClick={onBack} style={{ height: 44, padding: '0 16px' }}>
        지도로 돌아가기
      </button>
      <p>하늘 모드는 준비 중이에요.</p>
    </div>
  );
};
