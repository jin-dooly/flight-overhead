import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { ErrorBoundary } from './components/ErrorBoundary'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {/* 화면 오류가 나도 빈 화면 대신 안내와 새로고침을 보여 줌 */}
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>,
)
