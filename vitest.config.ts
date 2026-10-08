import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  resolve: { alias: { "@": path.resolve(__dirname, "src") } },
  test: {
    include: ["tests/**/*.test.ts"],
    // DB 통합 테스트는 같은 데이터베이스를 공유하므로 파일 단위로 순차 실행합니다.
    fileParallelism: false,
    testTimeout: 20000,
  },
});
