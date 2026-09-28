import { defineConfig } from '@playwright/test'

const apiUrl = 'http://127.0.0.1:3001'
const webUrl = 'http://localhost:5173'

export default defineConfig({
  testDir: './frontend/e2e',
  fullyParallel: true,
  reporter: 'list',
  use: {
    baseURL: webUrl,
    browserName: 'chromium',
    headless: true,
  },
  webServer: [
    {
      command: 'npm run dev --workspace @tarken/api -- --host 127.0.0.1 --port 3001',
      url: `${apiUrl}/api/health`,
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
    },
    {
      command: 'npm run dev --workspace @tarken/web',
      url: webUrl,
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
    },
  ],
})