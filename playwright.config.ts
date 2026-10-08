import { defineConfig, devices } from "@playwright/test";

// E2E는 로컬 Postgres(scripts/db/local_reset.sh로 준비)의 집계 뷰를 anon 권한으로 읽습니다.
const PORT = Number(process.env.E2E_PORT ?? 3200);
const DATABASE_URL = process.env.DATABASE_URL ?? "postgres://postgres:postgres@localhost:5432/becomap";

export default defineConfig({
  testDir: "e2e",
  timeout: 60_000,
  use: { baseURL: `http://localhost:${PORT}`, ...devices["Pixel 7"] },
  webServer: {
    command: `npx next dev -p ${PORT}`,
    url: `http://localhost:${PORT}/robots.txt`,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
    env: { DATA_BACKEND: "postgres", DATABASE_URL },
  },
});
