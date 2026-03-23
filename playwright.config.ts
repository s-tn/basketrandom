import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  timeout: 60000,
  use: {
    baseURL: 'http://localhost:9000',
  },
  webServer: {
    command: 'node server.js',
    port: 9000,
    reuseExistingServer: true,
  },
});
