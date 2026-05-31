import react from '@vitejs/plugin-react';
import {defineConfig} from 'vite';

// React SPA. The API base URL is read from VITE_API_URL at build time (see
// src/lib/api.ts); in dev it defaults to the local backend.
export default defineConfig({
  plugins: [react()],
  server: {port: 5173},
  preview: {port: 8080},
});
