import { defineConfig } from "@playwright/test";
const production = process.env.E2E_PRODUCTION === "1";
const port = production ? 3001 : 3000;
const baseURL = `http://127.0.0.1:${port}`;
export default defineConfig({
  testDir: "tests/e2e",
  timeout: 90000,
  use: { baseURL, headless: true, trace: "retain-on-failure" },
  webServer: {
    command: production ? "npm start" : "npm run dev",
    url: baseURL,
    env: {
      PORT: String(port),
      HOSTNAME: "127.0.0.1",
      ...(production ? { APP_ORIGIN: baseURL } : {}),
    },
    reuseExistingServer: !production && !process.env.CI,
    timeout: 120000,
  },
  workers: 1,
});
