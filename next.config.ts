import type { NextConfig } from "next";

// STATIC_EXPORT=1: GitHub Pages용 읽기 전용 데모(정적 HTML) 빌드 — scripts/build_static.sh에서 사용
const isStatic = process.env.STATIC_EXPORT === "1";
const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

const nextConfig: NextConfig = isStatic
  ? {
      output: "export",
      basePath,
      trailingSlash: true,
      images: { unoptimized: true },
    }
  : {
      // 정식 공개 전까지 모든 응답에 검색엔진 색인 차단 헤더를 붙입니다.
      async headers() {
        return [
          {
            source: "/:path*",
            headers: [{ key: "X-Robots-Tag", value: "noindex, nofollow" }],
          },
        ];
      },
    };

export default nextConfig;
