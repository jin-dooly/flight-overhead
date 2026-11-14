import { useState } from 'react';
import { ALTITUDE_BANDS } from '../../lib/altitude';

/**
 * 고도별 아이콘 색 범례 (2026-11-14 결정: 범례 버튼 + 카드의 색 점).
 * 폰에서는 접어 두고 "고도" 버튼을 누르면 펼침. 데스크톱은 화면이 넓어 처음부터 펼쳐 둠.
 *
 * 자리를 바꾸기 쉽게 이 컴포넌트는 자기 위치를 정하지 않음. 놓을 자리는 MapPage에서 한 줄로 정하고,
 * 그 자리에 맞게 아래 두 값만 고르면 됨
 * - opens: 펼친 목록이 버튼 위로('up', 화면 아래쪽에 둘 때) 열릴지, 아래로('down', 위쪽에 둘 때) 열릴지
 * - align: 목록을 버튼의 오른쪽 끝('end', 화면 오른쪽에 둘 때)에 맞출지, 왼쪽 끝('start')에 맞출지
 */
export const AltitudeLegend = ({
  opens = 'up',
  align = 'end',
}: {
  opens?: 'up' | 'down';
  align?: 'start' | 'end';
}) => {
  const [open, setOpen] = useState(() => window.matchMedia('(min-width: 768px)').matches);

  return (
    <div className={`altitude-legend opens-${opens} align-${align}`}>
      {open && (
        <ul className="altitude-legend-panel interactive" id="altitude-legend-list">
          {ALTITUDE_BANDS.map((b) => (
            <li key={b.band}>
              <span className="alt-dot" data-alt={b.band} aria-hidden="true" />
              <span className="altitude-legend-name">{b.name}</span>
              <span className="altitude-legend-range">{b.label}</span>
            </li>
          ))}
          <li>
            <span className="alt-dot" aria-hidden="true" />
            <span className="altitude-legend-name">정보 없음</span>
          </li>
        </ul>
      )}
      <button
        type="button"
        className="altitude-legend-toggle"
        aria-expanded={open}
        aria-controls="altitude-legend-list"
        aria-label="고도 범례"
        title="고도 범례"
        onClick={() => setOpen((v) => !v)}
      >
        {/* 글자 없이 단추처럼 2×2 색 점만 둠. ALTITUDE_BANDS가 높은 순이라 윗줄이 순항·중고도, 아랫줄이 저고도·이착륙 */}
        <span className="altitude-legend-swatches" aria-hidden="true">
          {ALTITUDE_BANDS.map((b) => (
            <span key={b.band} className="alt-dot" data-alt={b.band} />
          ))}
        </span>
      </button>
    </div>
  );
};
