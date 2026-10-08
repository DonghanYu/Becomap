import type { MetadataRoute } from "next";

// 정식 공개 전까지 모든 크롤러 차단
export default function robots(): MetadataRoute.Robots {
  return { rules: [{ userAgent: "*", disallow: "/" }] };
}
