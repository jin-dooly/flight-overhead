import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  build: {
    rolldownOptions: {
      output: {
        // 라이브러리를 우리 코드와 다른 파일로 나눔 (vendor 분리).
        // 파일 이름에는 내용으로 만든 해시가 붙어서, 우리 코드만 고쳐 배포하면 라이브러리 파일 이름은 그대로임.
        // 그러면 다시 방문한 사용자는 브라우저 캐시에 있는 라이브러리를 다시 쓰고, 바뀐 우리 코드만 받음.
        // priority가 높은 그룹부터 모듈을 가져가고, 각 그룹은 가져간 모듈이 쓰는 라이브러리도 같이 데려감
        codeSplitting: {
          groups: [
            // React: 거의 안 바뀌고 어디서나 씀
            { name: 'react', test: /node_modules[\\/](react|react-dom|scheduler)[\\/]/, priority: 30 },
            // 지도: Leaflet과 react-leaflet
            { name: 'map', test: /node_modules[\\/](leaflet|react-leaflet|@react-leaflet)[\\/]/, priority: 20 },
            // 실시간 연결: mqtt.js와 그 아래 라이브러리(브라우저용 Buffer, stream 등)
            { name: 'mqtt', test: /node_modules[\\/]mqtt[\\/]/, priority: 10 },
            // 그 밖의 라이브러리(zustand 등)
            { name: 'vendor', test: /node_modules[\\/]/, priority: 0 },
          ],
        },
      },
    },
  },
})
