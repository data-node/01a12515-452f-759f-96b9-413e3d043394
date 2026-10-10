import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ command }) => ({
  plugins: [react(), { name: 'notch-csp', transformIndexHtml: () => [{ tag: 'meta', attrs: { 'http-equiv': 'Content-Security-Policy', content: `default-src 'self'; script-src 'self'${command === 'serve' ? " 'unsafe-inline'" : ''}; style-src 'self' 'unsafe-inline'; connect-src 'self' ws://127.0.0.1:5173; img-src 'self' data:; font-src 'self'; object-src 'none'; base-uri 'self'; form-action 'none'` }, injectTo: 'head' }] }],
  base: './', server: { host: '127.0.0.1', port: 5173, strictPort: true },
}));
