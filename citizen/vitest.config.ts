import { defineConfig } from 'vitest/config';

// Separate from vite.config.ts on purpose: the app build wires in the PWA plugin,
// but the unit tests are pure logic (no DOM, no service worker) and run faster
// without it. Mirrors the console app's node test environment.
export default defineConfig({
  test: {
    environment: 'node',
    // dummy Supabase env so importing modules that build a client at load time
    // works without a real .env — pure logic never hits the network.
    env: { VITE_SUPABASE_URL: 'http://localhost:54321', VITE_SUPABASE_ANON_KEY: 'test-anon-key' },
  },
});
