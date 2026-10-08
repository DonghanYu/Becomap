import Link from "next/link";
import { redirect } from "next/navigation";
import { SearchBox } from "@/components/SearchBox";
import { publicData } from "@/lib/data";
import { searchOccupations } from "@/lib/search";

export const dynamic = "force-dynamic";

export default async function SearchPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const { q = "" } = await searchParams;
  const occupations = await (await publicData()).listOccupations();
  const { match, candidates } = searchOccupations(q, occupations);
  if (match) redirect(`/jobs/${match.slug}`);

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
          <h1 className="text-lg font-semibold">‘{q}’에 맞는 직업을 찾지 못했어요.</h1>
          <p className="text-sm text-muted">
            지금은 16개 직업만 준비되어 있어요. <Link href="/" className="text-brand underline">첫 화면</Link>에서
            직업 목록을 확인해 주세요.
          </p>
        </section>
      )}
    </div>
  );
}
