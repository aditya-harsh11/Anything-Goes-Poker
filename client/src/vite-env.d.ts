/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Optional explicit Socket.IO server URL (for split client/server deploys). */
  readonly VITE_SERVER_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

interface Window {
  /** Loaded async by the GoatCounter <script> tag in index.html; may not be ready yet. */
  goatcounter?: {
    count: (opts?: { path?: string; title?: string; referrer?: string; event?: boolean }) => void;
  };
}
