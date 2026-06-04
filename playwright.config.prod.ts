import { defineConfig, devices } from '@playwright/test';
export default defineConfig({
  testDir: './tests/playwright',
  timeout: 60000,
  use: {
    baseURL: process.env.TEST_BASE_URL || 'https://58168b82.fnb-caffe-container-biy.pages.dev',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },
  projects: [
    { name: 'Desktop Chrome', use: { ...devices['Desktop Chrome'] } },
    { name: 'Mobile Safari', use: { ...devices['iPhone 12'] } },
  ],
});
