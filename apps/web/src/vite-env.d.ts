/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** MQTT over WebSocket 주소. 비워 두면 ws://localhost:4000/mqtt */
  readonly VITE_MQTT_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
