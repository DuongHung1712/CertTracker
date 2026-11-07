// Counts Supabase Auth `/auth/v1/user` calls per full page load (spec §5.5).
//
//   BASE_URL=http://localhost:3101 EMAIL=... PASSWORD=... [UPSTREAM=http://127.0.0.1:54321] \
//     node scripts/count-auth-calls.mjs
//
// Two counts per page, because a browser cannot see what the Next server sends to Supabase:
//   browser: requests the browser itself makes (Playwright). Always available.
//   server : calls from the Next server (proxy, layout, page, prefetch renders). Needs UPSTREAM: the script then
//            starts a counting reverse proxy on PROXY_PORT (default 54399) that forwards to UPSTREAM, and the app
//            must run with NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:<PROXY_PORT>, set at `pnpm build` time
//            (Next inlines NEXT_PUBLIC_*) as well as at start. Server calls are told apart from browser calls by
//            the missing Origin header. Without UPSTREAM only "browser" is printed (always 0: the browser never
//            calls that endpoint), so this script cannot count server calls against production.
//            UPSTREAM must be local http (127.0.0.1 or localhost): tokens pass through the proxy unencrypted.
// This measurement builds the app pointing at the counting proxy and overwrites `.next`: run a normal
// `pnpm build` afterwards, or a later `pnpm start` sends every Supabase call to a dead port.
// A page view = sign in, then one full load of the path, wait for network idle plus SETTLE_MS so link prefetches
// (production builds only) have fired. Limits: full loads only, not client-side clicks; sidebar links outside the
// viewport may prefetch later; one browser, so the numbers are a rule of thumb, not a load test. Only
// `/auth/v1/user` is counted, not token refreshes (`/auth/v1/token`) or JWKS fetches.
import http from "node:http";
import { chromium } from "@playwright/test";

const { BASE_URL, EMAIL, PASSWORD, UPSTREAM } = process.env;
const PROXY_PORT = Number(process.env.PROXY_PORT ?? 54399);
const SETTLE_MS = Number(process.env.SETTLE_MS ?? 3000);
const PAGES = ["/dashboard", "/records", "/members"];
const AUTH_USER = "/auth/v1/user";

if (!BASE_URL || !EMAIL || !PASSWORD) {
  console.error("Set BASE_URL, EMAIL and PASSWORD.");
  process.exit(1);
}

let serverCalls = 0;
let proxy = null;
if (UPSTREAM) {
  const target = new URL(UPSTREAM);
  if (target.protocol !== "http:" || !["127.0.0.1", "localhost", "[::1]"].includes(target.hostname)) {
    console.error("UPSTREAM must be the local Supabase over http (for example http://127.0.0.1:54321).");
    process.exit(1);
  }
  proxy = http.createServer((req, res) => {
    if (req.url.includes(AUTH_USER) && !req.headers.origin) serverCalls += 1;
    const headers = { ...req.headers };
    delete headers.host; // Node sets Host from the request options
    const upstream = http.request(
      { host: target.hostname, port: target.port, path: req.url, method: req.method, headers },
      (up) => {
        res.writeHead(up.statusCode ?? 502, up.headers);
        up.pipe(res);
      },
    );
    upstream.on("error", (error) => {
      console.error(`Counting proxy: upstream error ${error.code ?? error.name}`);
      if (res.headersSent) res.end();
      else res.writeHead(502).end();
    });
    req.pipe(upstream);
  });
  await new Promise((resolve) => proxy.listen(PROXY_PORT, "127.0.0.1", resolve));
}

const browser = await chromium.launch();
try {
  const page = await browser.newPage();
  let browserCalls = 0;
  let prefetches = 0; // proves link prefetching really ran during the window
  page.on("request", (request) => {
    if (request.url().includes(AUTH_USER)) browserCalls += 1;
    if (request.headers()["next-router-prefetch"]) prefetches += 1;
  });

  await page.goto(`${BASE_URL}/login`);
  await page.getByLabel("Email").fill(EMAIL);
  await page.getByLabel("Password").fill(PASSWORD);
  await page.getByRole("button", { name: /sign in/i }).click();
  await page.waitForURL(/\/dashboard/);
  await page.waitForLoadState("networkidle");

  for (const path of PAGES) {
    browserCalls = 0;
    prefetches = 0;
    serverCalls = 0;
    await page.goto(`${BASE_URL}${path}`);
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(SETTLE_MS);
    console.log(`${path}  prefetches=${prefetches}  browser=${browserCalls}  server=${proxy ? serverCalls : "n/a (no UPSTREAM)"}`);
  }
} finally {
  await browser.close();
  proxy?.close();
}
