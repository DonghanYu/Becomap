import type { NextConfig } from "next";

const nextConfig: NextConfig = {
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
