import type { Metadata, Viewport } from "next";
import Link from "next/link";
import { DemoBanner } from "@/components/DemoBanner";
import "./globals.css";

export const metadata: Metadata = {
  title: "되고 싶어요. — Becomap",
  description: "장래희망을 검색하면 현직 종사자들이 지나온 경로를 모아 보여줍니다.",
  // 정식 공개 전까지 검색엔진 색인 차단
  robots: { index: false, follow: false, nocache: true, googleBot: { index: false, follow: false } },
};

export const viewport: Viewport = { width: "device-width", initialScale: 1 };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko">
      <body className="min-h-dvh">
        <DemoBanner />
        <header className="border-b border-line bg-white/80 backdrop-blur">
          <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
            <Link href="/" className="text-lg font-bold tracking-tight">
              되고 싶어요<span className="text-accent">.</span>
            </Link>
            <nav className="flex gap-4 text-sm text-muted">
              <Link href="/contribute" className="hover:text-ink">
                종사자 등록
              </Link>
              <Link href="/me" className="hover:text-ink">
                내 정보
              </Link>
            </nav>
          </div>
        </header>
        <main className="mx-auto max-w-5xl px-4 py-6">{children}</main>
        <footer className="mx-auto max-w-5xl px-4 pb-10 pt-4 text-xs text-muted">
          경로 빈도는 인과가 아닙니다. 기여자 5명 미만인 마디와 흐름은 표시하지 않습니다.
        </footer>
      </body>
    </html>
  );
}
