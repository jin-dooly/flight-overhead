import { useEffect, useRef, useState } from 'react';
import { headingOf, pitchOf, smoothAngle, smoothValue, type OrientationReading } from '../lib/orientation';

export type SensorPermission = 'granted' | 'denied' | 'unsupported';

/**
 * 방향 센서 권한 요청. 아이폰(iOS 13+)은 사용자가 버튼을 누른 순간에만 물을 수 있어서,
 * 반드시 클릭 처리 함수 안에서 바로 불러야 함(중간에 다른 await가 끼면 거절될 수 있음).
 * 안드로이드와 PC는 따로 묻지 않아서 바로 granted
 */
export const requestOrientationPermission = async (): Promise<SensorPermission> => {
  if (typeof window === 'undefined' || !('DeviceOrientationEvent' in window)) return 'unsupported';
  const request = (
    window.DeviceOrientationEvent as unknown as { requestPermission?: () => Promise<string> }
  ).requestPermission;
  if (typeof request !== 'function') return 'granted';
  try {
    return (await request()) === 'granted' ? 'granted' : 'denied';
  } catch {
    return 'denied';
  }
};

/** 이 시간 안에 방향(나침반) 값이 한 번도 안 오면 이 기기에서는 쓸 수 없는 것으로 봄 */
const NO_DATA_MS = 3_000;
/** 떨림 줄이기 정도. 센서 값이 올 때마다 새 값 쪽으로 이만큼 다가감 (작을수록 부드럽고 느림) */
const SMOOTHING = 0.2;

export type Look = { heading: number; pitch: number };

/**
 * 폰이 향하는 방향(방위각)과 올려다보는 각도를 계속 읽음.
 * - 센서 이벤트는 초당 수십 번 오는데, 그때마다 React를 다시 그리지 않고 ref에 최신 값만 넣어 둠.
 *   화면은 SkyView가 매 프레임 이 ref를 읽어 그림
 * - 안드로이드 Chrome은 북쪽 기준 이벤트(deviceorientationabsolute)를 따로 보내서 그걸 먼저 씀.
 *   아이폰은 일반 이벤트에 webkitCompassHeading이 들어 있음
 * - 3초 안에 방향 값이 안 오면 status가 'no-data' (나침반 없는 기기 등) → 끌어서 둘러보기로 전환
 */
export function useDeviceOrientation(enabled: boolean) {
  const lookRef = useRef<Look | null>(null);
  const [status, setStatus] = useState<'waiting' | 'ok' | 'no-data'>('waiting');

  useEffect(() => {
    if (!enabled) return;
    let gotAbsolute = false;
    let gotHeading = false;

    const onReading = (r: OrientationReading) => {
      const heading = headingOf(r);
      const pitch = pitchOf(r);
      if (heading === null || pitch === null) return;
      if (!gotHeading) {
        gotHeading = true;
        setStatus('ok');
      }
      const prev = lookRef.current;
      lookRef.current = prev
        ? { heading: smoothAngle(prev.heading, heading, SMOOTHING), pitch: smoothValue(prev.pitch, pitch, SMOOTHING) }
        : { heading, pitch };
    };

    const toReading = (e: DeviceOrientationEvent, absolute: boolean): OrientationReading => ({
      alpha: e.alpha,
      beta: e.beta,
      gamma: e.gamma,
      absolute: absolute || e.absolute,
      webkitCompassHeading: (e as DeviceOrientationEvent & { webkitCompassHeading?: number })
        .webkitCompassHeading,
    });

    const onAbsolute = (e: Event) => {
      gotAbsolute = true;
      onReading(toReading(e as DeviceOrientationEvent, true));
    };
    const onRelative = (e: Event) => {
      // 북쪽 기준 이벤트가 오는 기기에서는 일반 이벤트를 무시(같은 값이 두 번 들어오지 않게)
      if (gotAbsolute) return;
      onReading(toReading(e as DeviceOrientationEvent, false));
    };

    window.addEventListener('deviceorientationabsolute', onAbsolute);
    window.addEventListener('deviceorientation', onRelative);
    const timer = setTimeout(() => {
      if (!gotHeading) setStatus('no-data');
    }, NO_DATA_MS);

    return () => {
      clearTimeout(timer);
      window.removeEventListener('deviceorientationabsolute', onAbsolute);
      window.removeEventListener('deviceorientation', onRelative);
    };
  }, [enabled]);

  return { lookRef, status };
}
