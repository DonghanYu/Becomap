import { defineConfig, devices } from "@playwright/test";

// GitHub Pages용 정적 데모(out-static/) 확인: scripts/build_static.sh 실행 후 사용
export default defineConfig({
  testDir: "e2e-static",
  timeout: 60_000,
  use: { baseURL: "http://localhost:4300/Becomap/", ...devices["Pixel 7"] },
  webServer: {
    command: "node scripts/serve_static.mjs out-static",
    url: "http://localhost:4300/Becomap/",
    reuseExistingServer: !process.env.CI,
  },
});
