import { defineConfig } from "@playwright/test";
import nextEnv from "@next/env";
nextEnv.loadEnvConfig(process.cwd(), true);

export default defineConfig({
  testDir: "./tests/kadik",
  timeout: 60000,
  expect: { timeout: 10000 },
  workers: 1,
  retries: 0,
  reporter: [["list"], ["html", { outputFolder: "test-results/kadik/report", open: "never" }]],
  outputDir: "test-results/kadik/artifacts",
  use: { baseURL: "http://localhost:3901", channel: "chrome", screenshot: "only-on-failure", trace: "retain-on-failure" },
  projects: [
    { name: "desktop", use: { viewport: { width: 1440, height: 900 } } },
    { name: "mobile", use: { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true } },
  ],
});
