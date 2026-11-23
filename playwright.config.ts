import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "e2e",
  workers: 2,
  timeout: 60000,
  use: {
    baseURL: "http://127.0.0.1:4196",
    viewport: { width: 1440, height: 900 },
    trace: "retain-on-failure",
  },
  webServer: {
    command: "npm run preview -- --host 127.0.0.1 --port 4196 --strictPort",
    url: "http://127.0.0.1:4196",
    reuseExistingServer: false,
  },
});
