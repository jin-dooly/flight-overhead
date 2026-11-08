import { defineConfig } from 'vitest/config'

// 테스트 전용 설정. Vitest 3은 자체 Vite 7을 쓰는데, vite.config.ts의 React 플러그인은 Vite 8용이라
// 그 설정을 읽지 않게 따로 둠. 지금 테스트는 React 없이 순수 함수만 다룸
export default defineConfig({
  test: {
    include: ['test/**/*.test.ts'],
  },
})
