import { Component, type ErrorInfo, type ReactNode } from 'react';

type State = { error: Error | null };

/**
 * 화면을 그리다가 예상 못 한 오류가 나면, 하얀 빈 화면 대신 안내와 새로고침 버튼을 보여 줌.
 * React에서 렌더링 오류를 잡는 방법은 클래스 컴포넌트의 getDerivedStateFromError뿐이라 클래스로 씀.
 * (2026-11-09: Vercel 미리보기에서 연결 오류 하나로 앱 전체가 안 떴던 일이 계기)
 *
 * 이벤트 처리나 비동기 코드의 오류는 여기서 잡히지 않음. 그런 오류는 각 코드에서 처리함(예: lib/mqtt.ts)
 */
export class ErrorBoundary extends Component<{ children: ReactNode }, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    // 원인을 찾을 수 있게 콘솔에만 남김 (외부로 보내지 않음)
    console.error('화면 오류', error, info.componentStack);
  }

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div className="error-screen" role="alert">
        <div className="error-card">
          <h1>문제가 생겼어요</h1>
          <p>화면을 그리는 중에 예상하지 못한 오류가 났어요. 새로고침하면 대부분 다시 보여요.</p>
          <button type="button" onClick={() => window.location.reload()}>
            새로고침
          </button>
          <button
            type="button"
            className="error-secondary"
            onClick={() => {
              // 하늘 모드 등에서 났으면 기본 화면(지도)으로 새로 열기
              window.location.href = window.location.pathname;
            }}
          >
            지도로 처음부터 열기
          </button>
        </div>
      </div>
    );
  }
}
