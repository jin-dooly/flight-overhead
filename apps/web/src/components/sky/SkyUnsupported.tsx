import { useState } from 'react';
import { PhoneIcon } from './skyIcons';

/**
 * 폰이 아닌 기기에서 하늘 모드를 열었을 때 (목업 SkyUnsupported).
 * 폰에서 열 주소를 보여 주고, 화면만 미리 보고 싶은 사람(리뷰어 등)을 위해 "끌어서 둘러보기"도 열어 둠
 */
export const SkyUnsupported = ({ onBack, onPreview }: { onBack: () => void; onPreview: () => void }) => {
  const link = `${window.location.origin}/?mode=sky`;
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
    } catch {
      // 클립보드 권한이 없으면 입력칸을 선택해서 직접 복사하게 함
      document.querySelector<HTMLInputElement>('#sky-link')?.select();
    }
  };

  return (
    <div className="sky-unsupported">
      <section role="dialog" aria-labelledby="sky-unsupported-title" className="sky-dialog">
        <div className="sky-dialog-icon">
          <PhoneIcon />
        </div>
        <div>
          <h2 id="sky-unsupported-title">하늘 모드는 폰에서 열어 주세요</h2>
          <p>
            하늘 모드는 폰의 나침반과 기울기 센서로 비행기를 찾아요. 이 기기에서는 센서를 찾지
            못했어요.
          </p>
        </div>
        <div className="sky-link">
          <label htmlFor="sky-link">폰에서 이 주소를 열어 보세요</label>
          <div className="sky-link-row">
            <input id="sky-link" type="text" readOnly value={link} onFocus={(e) => e.target.select()} />
            <button type="button" onClick={copy}>
              {copied ? '복사했어요' : '주소 복사'}
            </button>
          </div>
        </div>
        <button type="button" className="button is-dark" onClick={onBack}>
          지도로 돌아가기
        </button>
        <button type="button" className="sky-preview-link" onClick={onPreview}>
          센서 없이 화면 미리 보기 (끌어서 둘러보기)
        </button>
      </section>
    </div>
  );
};
