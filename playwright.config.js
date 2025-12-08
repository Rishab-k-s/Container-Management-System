import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  timeout: 60 * 1000,
  fullyParallel: false,
  retries: 0,
  workers: 1,
  
  reporter: [
    ['html'],
    ['list'],
  ],
  
  use: {
    baseURL: 'http://localhost:8080',  // Changed from 3000 to 8080
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },

  projects: [
    {
      name: 'chromium',
      use: { 
        ...devices['Desktop Chrome'],
        launchOptions: {
          args: ['--no-sandbox', '--disable-setuid-sandbox']  // Required for VM
        }
      },
    },
  ],
  
  webServer: {  // Add this to auto-start Meteor
    command: 'meteor run --port 8080',
    url: 'http://localhost:8080',
    timeout: 120 * 1000,
    reuseExistingServer: true,
  },
});