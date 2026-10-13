import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: './tests/e2e',
  workers: 1,
  use: { baseURL: 'http://127.0.0.1:4174', browserName: 'chromium', trace: 'retain-on-failure' },
  webServer: [{
    command:'npm run dev:server',
    url:'http://127.0.0.1:2568/health',
    env:{PORT:'2568'},
    reuseExistingServer:false,
  }, {
    command: 'npm run dev -- --host 127.0.0.1 --port 4174 --strictPort',
    url: 'http://127.0.0.1:4174',
    env:{VITE_SERVER_URL:'http://127.0.0.1:2568'},
    reuseExistingServer: false,
  }],
});
