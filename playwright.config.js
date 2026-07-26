import { defineConfig, devices } from "@playwright/test";

const ci = Boolean(process.env.CI);
const hostedBaseUrl = String(process.env.PLAYWRIGHT_BASE_URL || "").trim();
const localBaseUrl = "http://127.0.0.1:4173";

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  forbidOnly: ci,
  retries: ci ? 1 : 0,
  workers: 1,
  reporter: ci
    ? [["line"], ["html", { outputFolder: "playwright-report", open: "never" }]]
    : [["list"], ["html", { outputFolder: "playwright-report", open: "never" }]],
  use: {
    baseURL: hostedBaseUrl || localBaseUrl,
    viewport: { width: 762, height: 698 },
    actionTimeout: 10_000,
    navigationTimeout: 30_000,
    screenshot: "only-on-failure",
    trace: "retain-on-failure",
    video: "retain-on-failure",
  },
  expect: {
    timeout: 15_000,
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"], viewport: { width: 762, height: 698 } },
    },
    {
      name: "firefox-text",
      testMatch: /(?:cross-browser-text|demo-payment-and-sync)\.spec\.js/,
      use: { ...devices["Desktop Firefox"], viewport: { width: 762, height: 698 } },
    },
    {
      name: "webkit-safari-engine-text",
      testMatch: /(?:cross-browser-text|demo-payment-and-sync)\.spec\.js/,
      use: { ...devices["Desktop Safari"], viewport: { width: 762, height: 698 } },
    },
  ],
  webServer: hostedBaseUrl
    ? undefined
    : {
        command: "node node_modules/vite/bin/vite.js preview --host 127.0.0.1 --port 4173",
        url: localBaseUrl,
        reuseExistingServer: !ci,
        timeout: 60_000,
      },
});
