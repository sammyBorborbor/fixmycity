/// <reference types="vitest/config" />
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// Desktop operations console — no PWA plugin (citizen app only).
export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: { port: 5174 },
  test: {
    environment: 'node',
    // dummy Supabase env so importing the store (which builds a client at module
    // load) works in tests without a real .env — pure logic never hits the network.
    env: { VITE_SUPABASE_URL: 'http://localhost:54321', VITE_SUPABASE_ANON_KEY: 'test-anon-key' },
  },
})
