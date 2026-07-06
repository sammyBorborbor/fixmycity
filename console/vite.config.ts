import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// Desktop operations console — no PWA plugin (citizen app only).
export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: { port: 5174 },
})
