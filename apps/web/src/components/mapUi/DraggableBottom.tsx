import {
  useLayoutEffect,
  useRef,
  useState,
  type PointerEvent,
  type ReactNode,
} from 'react';

/** 손가락을 이만큼 움직이기 전까지는 끌기가 아니라 탭으로 봄 */
const TAP_SLOP_PX = 6;
/** 접었을 때 기체 ID 줄 아래로 남겨 둘 여백 */
const PEEK_MARGIN_PX = 14;
/** 카드 맨 위에서 이 높이 안을 탭하면 접기/펴기 (손잡이가 4px로 얇아서 넉넉히 잡음) */
const TAP_TOGGLE_ZONE_PX = 44;

/**
 * 폰에서 하단 카드를 잡고 내렸다 올리는 기능.
 * 카드를 끌면(버튼 제외) 카드와 그 위 버튼 줄(내 위치 버튼, 출처)이 같이 내려감.
 * 끝까지 내리면 편명과 "기체 ID" 줄까지만 보임. 카드 맨 위(손잡이 근처)를 탭하면 접기/펴기.
 *
 * 위치는 매 손가락 움직임마다 바뀌므로 React state 대신 DOM transform을 직접 고침
 * (지도 마커와 같은 이유). 접힘 여부만 state로 둠
 */
export const DraggableBottom = ({ children }: { children: ReactNode }) => {
  const ref = useRef<HTMLDivElement>(null);
  const [collapsed, setCollapsed] = useState(false);
  const drag = useRef<{
    startY: number;
    startOffset: number;
    offset: number;
    moved: boolean;
    /** 카드 맨 위쪽을 눌렀는지. 그곳을 탭하면 접기/펴기 */
    nearTop: boolean;
  } | null>(null);

  /** 끝까지 내렸을 때 내려가는 거리 = 카드 높이 - (기체 ID 줄 아래 끝 + 여백). 상세 카드가 아니면 0 */
  const maxOffset = () => {
    const sheet = ref.current?.querySelector<HTMLElement>('.sheet');
    const main = sheet?.querySelector<HTMLElement>('.sheet-main');
    if (!sheet || !main) return 0;
    return Math.max(
      0,
      sheet.offsetHeight - (main.offsetTop + main.offsetHeight + PEEK_MARGIN_PX)
    );
  };

  const apply = (offset: number, animate: boolean) => {
    const el = ref.current;
    if (!el) return;
    el.style.transition = animate ? 'transform 0.25s ease-out' : 'none';
    el.style.transform = offset > 0 ? `translateY(${offset}px)` : '';
  };

  // 카드 내용이 바뀌면(다른 비행기, 빈 상태) 접힌 높이도 다시 맞춤
  useLayoutEffect(() => {
    if (drag.current) return;
    apply(collapsed ? maxOffset() : 0, true);
  });
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new ResizeObserver(() => {
      if (!drag.current) apply(collapsed ? maxOffset() : 0, false);
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, [collapsed]);

  const onPointerDown = (e: PointerEvent<HTMLDivElement>) => {
    const target = e.target as HTMLElement;
    // 버튼은 그대로 누를 수 있게 하고, 카드 안 나머지 부분은 어디를 잡아도 끌 수 있게 함
    if (target.closest('button, a')) return;
    const sheet = target.closest<HTMLElement>('.sheet');
    if (!sheet) return;
    const startOffset = collapsed ? maxOffset() : 0;
    drag.current = {
      startY: e.clientY,
      startOffset,
      offset: startOffset,
      moved: false,
      nearTop:
        e.clientY - sheet.getBoundingClientRect().top < TAP_TOGGLE_ZONE_PX,
    };
    // 이 래퍼는 지도 클릭을 통과시키려고 pointer-events: none이라, 실제로 누른 카드 요소에 붙잡아 둠
    target.setPointerCapture(e.pointerId);
  };

  const onPointerMove = (e: PointerEvent<HTMLDivElement>) => {
    const d = drag.current;
    if (!d) return;
    const dy = e.clientY - d.startY;
    if (!d.moved && Math.abs(dy) < TAP_SLOP_PX) return;
    d.moved = true;
    d.offset = Math.min(maxOffset(), Math.max(0, d.startOffset + dy));
    apply(d.offset, false);
  };

  const onPointerUp = () => {
    const d = drag.current;
    drag.current = null;
    if (!d) return;
    const max = maxOffset();
    // 끌었으면 절반을 넘겼는지로 정함. 끌지 않고 카드 맨 위를 탭했으면 접기/펴기, 그 밖의 탭은 무시
    if (!d.moved && !d.nearTop) return;
    const next = d.moved ? d.offset > max / 2 : !collapsed;
    if (next === collapsed) apply(next ? max : 0, true);
    setCollapsed(next);
  };

  return (
    <div
      ref={ref}
      className="map-bottom"
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
    >
      {children}
    </div>
  );
};
