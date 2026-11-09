import { isFollowableHex } from '@flight/shared';
import { useFlightsStore } from '../../store/flights';
import { startFollow } from '../../store/follow';
import { TargetIcon } from '../mapUi/icons';

/**
 * 카드의 "따라가기" 버튼.
 * - 서버와 연결이 끊긴 동안에는 누를 수 없음 (목업 MapReconnecting: 회색 버튼)
 * - TIS-B 임시 ID(`~`로 시작)처럼 기체 ID로 조회할 수 없는 비행기는 버튼을 보여 주지 않음
 */
export const FollowButton = ({ hex }: { hex: string }) => {
  const offline = useFlightsStore((s) => s.connection !== 'live');
  const aircraft = useFlightsStore((s) => s.snapshot?.aircraft.find((a) => a.hex === hex));
  if (!isFollowableHex(hex)) return null;

  return (
    <button
      type="button"
      className="button is-follow-start"
      disabled={offline || !aircraft}
      onClick={() => aircraft && startFollow(aircraft)}
    >
      <TargetIcon color={offline ? '#4A5260' : '#FFFFFF'} />
      따라가기
    </button>
  );
};
