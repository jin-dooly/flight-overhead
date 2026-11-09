import '../components/mapUi/mapUi.css';
import '../components/sky/sky.css';
import { useCallback, useState } from 'react';
import { SkyIntro } from '../components/sky/SkyIntro';
import { SkyUnsupported } from '../components/sky/SkyUnsupported';
import { SkyView, type DragReason } from '../components/sky/SkyView';
import { requestOrientationPermission } from '../hooks/useDeviceOrientation';
import { useFlightsStore } from '../store/flights';

/**
 * 폰처럼 손가락으로 쓰는 기기인지. 데스크톱 브라우저도 DeviceOrientationEvent를 갖고 있어서
 * 센서 유무로는 구분이 안 되므로, 주 입력 장치가 터치(coarse)인지로 판단함
 */
const isPhoneLike = () => window.matchMedia('(pointer: coarse)').matches;

type Step =
  | { kind: 'intro' }
  | { kind: 'unsupported' }
  | { kind: 'view'; mode: 'sensor' }
  | { kind: 'view'; mode: 'drag'; reason: DragReason };

/**
 * 하늘 모드 (기획서 추가 기능 2번)
 * - 폰: 시작 화면 → "센서 켜고 시작하기"에서 권한 요청 → 허용하면 폰 방향을 따라가는 하늘 화면
 * - 권한 거부, 센서 미지원, 나침반 값이 안 옴: 같은 하늘 화면을 끌어서 둘러보기로 (위에 이유와 다시 시도)
 * - 폰이 아니면: "폰에서 열어 주세요", 원하면 끌어서 둘러보는 미리 보기
 */
export const SkyPage = ({ onBack }: { onBack: () => void }) => {
  const [step, setStep] = useState<Step>(() =>
    isPhoneLike() ? { kind: 'intro' } : { kind: 'unsupported' }
  );

  // 아이폰은 사용자가 누른 그 순간에만 권한을 물을 수 있어서, 클릭 처리 안에서 바로 요청함
  const startSensor = useCallback(() => {
    void requestOrientationPermission().then((result) =>
      setStep(
        result === 'granted'
          ? { kind: 'view', mode: 'sensor' }
          : { kind: 'view', mode: 'drag', reason: result }
      )
    );
  }, []);

  // 권한은 받았는데 방향 값이 안 오면(나침반 없는 기기 등) 끌어서 둘러보기로
  const onSensorFail = useCallback(
    () => setStep({ kind: 'view', mode: 'drag', reason: 'no-data' }),
    []
  );

  // 조준한 비행기를 지도에서 선택된 상태로 보여 줌
  const showOnMap = (hex: string) => {
    useFlightsStore.setState({ selectedHex: hex });
    onBack();
  };

  return (
    <div className="sky">
      {step.kind === 'intro' && <SkyIntro onBack={onBack} onStart={startSensor} />}
      {step.kind === 'unsupported' && (
        <SkyUnsupported
          onBack={onBack}
          onPreview={() => setStep({ kind: 'view', mode: 'drag', reason: 'preview' })}
        />
      )}
      {step.kind === 'view' && (
        <SkyView
          mode={step.mode}
          dragReason={step.mode === 'drag' ? step.reason : undefined}
          onBack={onBack}
          onShowOnMap={showOnMap}
          onSensorFail={onSensorFail}
          onRetrySensor={startSensor}
        />
      )}
    </div>
  );
};
