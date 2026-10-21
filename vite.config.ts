import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

/**
 * AWC Ark is served by AWC Connect at /ark (a Vercel rewrite to this project), so
 * members are already signed in: same address, same AWC sign-in. Everything is
 * built under /ark/. In local dev, /api is sent to a running Connect (port 3000).
 */
export default defineConfig({
  base: '/ark/',
  plugins: [react(), tailwindcss()],
  build: { outDir: 'dist/ark', emptyOutDir: true },
  server: {
    proxy: { '/api': { target: process.env.ARK_DEV_CONNECT || 'http://localhost:3000', changeOrigin: true } },
  },
});
