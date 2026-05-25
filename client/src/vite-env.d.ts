/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Optional explicit Socket.IO server URL (for split client/server deploys). */
  readonly VITE_SERVER_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
