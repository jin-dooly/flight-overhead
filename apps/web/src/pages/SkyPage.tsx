import '../components/mapUi/mapUi.css';
import '../components/sky/sky.css';
import { useState } from 'react';
import { SkyIntro } from '../components/sky/SkyIntro';
import { SkyUnsupported } from '../components/sky/SkyUnsupported';
import { SkyView } from '../components/sky/SkyView';
import { useFlightsStore } from '../store/flights';

/**
 * 폰처럼 손가락으로 쓰는 기기인지. 데스크톱 브라우저도 DeviceOrientationEvent를 갖고 있어서
 * 센서 유무로는 구분이 안 되므로, 주 입력 장치가 터치(coarse)인지로 판단함
 */
const isPhoneLike = () => window.matchMedia('(pointer: coarse)').matches;

/**
 * 하늘 모드 (기획서 추가 기능 2번). 지금은 화면(UI)만 있고 센서는 연결하지 않음
 * - 폰: 시작 화면(SkyIntro) → 하늘 화면(SkyView)
 * - 폰이 아니면: "폰에서 열어 주세요"(SkyUnsupported), 원하면 끌어서 둘러보는 미리 보기
 */
export const SkyPage = ({ onBack }: { onBack: () => void }) => {
  const [step, setStep] = useState<'intro' | 'unsupported' | 'view'>(() =>
    isPhoneLike() ? 'intro' : 'unsupported'
  );

  // 조준한 비행기를 지도에서 선택된 상태로 보여 줌
  const showOnMap = (hex: string) => {
    useFlightsStore.setState({ selectedHex: hex });
    onBack();
  };

  return (
    <div className="sky">
      {step === 'intro' && <SkyIntro onBack={onBack} onStart={() => setStep('view')} />}
      {step === 'unsupported' && <SkyUnsupported onBack={onBack} onPreview={() => setStep('view')} />}
      {step === 'view' && <SkyView onBack={onBack} onShowOnMap={showOnMap} />}
    </div>
  );
};
