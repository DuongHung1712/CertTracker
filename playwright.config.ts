import { defineConfig, devices } from "@playwright/test";

// Target web server URL for Playwright tests.
// Set PLAYWRIGHT_BASE_URL=http://localhost:3200 when running against a local dev server
// running on port 3200 (to avoid port 3000/3100 collisions with other services).
// When PLAYWRIGHT_BASE_URL is provided, webServer spawn is bypassed, allowing tests to run
// immediately against the already-running server instance.
const baseURL = process.env.PLAYWRIGHT_BASE_URL || "http://localhost:3000";

export default defineConfig({
  testDir: "./e2e",
  // `webServer.command` runs `next dev`, not a production build. Server Actions submitted by
  // several workers at the same moment can hit Next's dev-mode compiler pipeline concurrently and
  // come back as a corrupted RSC response ("An unexpected response was received from the server."),
  // which is a dev-server artifact, not an app bug — each spec passes reliably run alone. Serializing
  // workers avoids that concurrency window; 14 specs still finish in well under a minute.
  workers: 1,
  // `next dev` compiles each route on its first visit. On a 2-core CI runner the first sign-in (the
  // dashboard, with its charts) can take longer than the default 5 s to render, so allow more time there.
  expect: { timeout: process.env.CI ? 15_000 : 5_000 },
  use: { baseURL },
  webServer: process.env.PLAYWRIGHT_BASE_URL
    ? undefined
    : {
        command: "pnpm dev",
        url: `${baseURL}/login`,
        reuseExistingServer: true,
        timeout: 120_000,
      },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
});
