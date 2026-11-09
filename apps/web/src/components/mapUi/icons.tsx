import type { CSSProperties, ReactNode } from 'react';

// 목업에서 쓴 아이콘(선 아이콘, 24×24). 장식용이라 모두 aria-hidden
type IconProps = { size?: number; color?: string; strokeWidth?: number };

const Svg = ({
  size = 18,
  color = 'currentColor',
  strokeWidth = 2,
  children,
  style,
}: IconProps & { children: ReactNode; style?: CSSProperties }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke={color}
    strokeWidth={strokeWidth}
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
    style={style}
  >
    {children}
  </svg>
);

export const PinIcon = (p: IconProps) => (
  <Svg size={16} {...p}>
    <path d="M12 21s-7-6.2-7-11.5A7 7 0 0 1 19 9.5C19 14.8 12 21 12 21z" />
    <circle cx="12" cy="9.5" r="2.5" />
  </Svg>
);

export const PinOffIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M12 21s-7-6.2-7-11.5A7 7 0 0 1 19 9.5C19 14.8 12 21 12 21z" />
    <path d="M4 4l16 16" />
  </Svg>
);

export const RefreshIcon = (p: IconProps) => (
  <Svg size={14} strokeWidth={2.4} {...p}>
    <path d="M20 12a8 8 0 1 1-2.3-5.7" />
    <path d="M20 4v5h-5" />
  </Svg>
);

export const ClockIcon = (p: IconProps) => (
  <Svg size={14} strokeWidth={2.4} {...p}>
    <circle cx="12" cy="12" r="9" />
    <path d="M12 7v5l3 2" />
  </Svg>
);

export const WifiOffIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M2 8.8a15 15 0 0 1 4.2-2.7M10.7 5.1A15 15 0 0 1 22 8.8M5 12.5a10 10 0 0 1 3.2-2M15.8 10.5A10 10 0 0 1 19 12.5M8.5 16a5 5 0 0 1 7 0" />
    <path d="M3 3l18 18" />
  </Svg>
);

export const LocateIcon = (p: IconProps) => (
  <Svg size={22} color="#1A54E6" {...p}>
    <circle cx="12" cy="12" r="7" />
    <circle cx="12" cy="12" r="2.5" fill="#1A54E6" />
    <path d="M12 2v3M12 19v3M2 12h3M19 12h3" />
  </Svg>
);

export const PlusIcon = (p: IconProps) => (
  <Svg strokeWidth={2.2} {...p}>
    <path d="M12 5v14M5 12h14" />
  </Svg>
);

export const MinusIcon = (p: IconProps) => (
  <Svg strokeWidth={2.2} {...p}>
    <path d="M5 12h14" />
  </Svg>
);

export const CloseIcon = (p: IconProps) => (
  <Svg strokeWidth={2.2} color="#4A5260" {...p}>
    <path d="M6 6l12 12M18 6L6 18" />
  </Svg>
);

export const ArrowIcon = ({ deg, ...p }: IconProps & { deg: number }) => (
  <Svg size={14} strokeWidth={2.4} style={{ transform: `rotate(${deg}deg)` }} {...p}>
    <path d="M12 20V4M6 10l6-6 6 6" />
  </Svg>
);

export const SkyIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M3 20l7-7M14 4l6 6-4 1-3 3-2-2 3-3z" />
  </Svg>
);

export const TargetIcon = (p: IconProps) => (
  <Svg strokeWidth={2.2} {...p}>
    <circle cx="12" cy="12" r="8" />
    <circle cx="12" cy="12" r="3" fill="currentColor" />
  </Svg>
);

export const WidenIcon = (p: IconProps) => (
  <Svg {...p}>
    <circle cx="12" cy="12" r="4" />
    <path d="M12 3a9 9 0 1 1-9 9" />
    <path d="M3 5v4h4" />
  </Svg>
);

export const PlaneIcon = ({ size = 24, color = '#4A5260' }: IconProps) => (
  <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true">
    <path
      d="M12 2c.8 0 1.3.7 1.3 1.6V9l7.7 4.6v2l-7.7-2.3v4.9l2.2 1.7V21L12 20.2 8.5 21v-1.1l2.2-1.7v-4.9L3 15.6v-2L10.7 9V3.6C10.7 2.7 11.2 2 12 2z"
      fill={color}
    />
  </svg>
);

export const HelpIcon = (p: IconProps) => (
  <Svg size={20} color="#C9CED6" {...p}>
    <circle cx="12" cy="12" r="9" />
    <path d="M9.5 9.5a2.5 2.5 0 0 1 4.9.7c0 1.7-2.4 2.1-2.4 3.6" />
    <circle cx="12" cy="17" r="0.6" fill="currentColor" />
  </Svg>
);
