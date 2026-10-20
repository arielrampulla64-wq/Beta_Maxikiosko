import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// En desarrollo, todo lo que empiece con /api se redirige al backend (puerto 3001).
export default defineConfig({
  plugins: [react()],
  server: { port: 5173, proxy: { '/api': 'http://localhost:3001' } },
});
