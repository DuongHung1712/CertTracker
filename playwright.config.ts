import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  // `webServer.command` runs `next dev`, not a production build. Server Actions submitted by
  // several workers at the same moment can hit Next's dev-mode compiler pipeline concurrently and
  // come back as a corrupted RSC response ("An unexpected response was received from the server."),
  // which is a dev-server artifact, not an app bug — each spec passes reliably run alone. Serializing
  // workers avoids that concurrency window; 14 specs still finish in well under a minute.
  workers: 1,
  use: { baseURL: "http://localhost:3000" },
  webServer: {
    command: "pnpm dev",
    url: "http://localhost:3000/login",
    reuseExistingServer: true,
    timeout: 120_000,
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
});
