import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { fileURLToPath, URL } from 'node:url';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@poker/shared': fileURLToPath(new URL('../shared/src/index.ts', import.meta.url)),
    },
  },
  server: {
    host: true,
    port: 5173,
    proxy: {
      // Forward Socket.IO traffic (including the websocket upgrade) to the game server.
      '/socket.io': { target: 'http://localhost:3001', ws: true },
    },
    fs: {
      // Allow Vite to read the sibling `shared/` workspace from source.
      allow: [fileURLToPath(new URL('..', import.meta.url))],
    },
  },
});
