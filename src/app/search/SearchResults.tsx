"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo } from "react";
import { SearchBox } from "@/components/SearchBox";
import { searchOccupations } from "@/lib/search";
import type { Occupation } from "@/lib/types";

/** 검색은 브라우저에서 수행합니다(정적 데모 빌드와 서버 배포 모두 동일하게 동작). */
export function SearchResults({ occupations }: { occupations: Occupation[] }) {
  const q = useSearchParams().get("q") ?? "";
  const router = useRouter();
  const { match, candidates } = useMemo(() => searchOccupations(q, occupations), [q, occupations]);

  useEffect(() => {
    if (match) router.replace(`/jobs/${match.slug}`);
  }, [match, router]);

  if (match) return <p className="text-muted">‘{match.name_ko}’ 결과로 이동하는 중…</p>;

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <SearchBox defaultValue={q} />
      {candidates.length > 0 ? (
        <section>
          <h1 className="mb-3 text-lg font-semibold">이 중에 찾는 직업이 있나요?</h1>
          <ul className="space-y-2">
            {candidates.map((o) => (
              <li key={o.slug}>
                <Link href={`/jobs/${o.slug}`} className="text-brand underline-offset-2 hover:underline">
                  {o.name_ko}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : (
        <section className="space-y-2">
          <h1 className="text-lg font-semibold">{q ? `‘${q}’에 맞는 직업을 찾지 못했어요.` : "검색어를 입력해 주세요."}</h1>
          <p className="text-sm text-muted">
            지금은 16개 직업만 준비되어 있어요.{" "}
            <Link href="/" className="text-brand underline">
              첫 화면
            </Link>
            에서 직업 목록을 확인해 주세요.
          </p>
        </section>
      )}
    </div>
  );
}
