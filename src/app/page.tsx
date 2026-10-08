import { OccupationChips } from "@/components/OccupationChips";
import { SearchBox } from "@/components/SearchBox";
import { publicData } from "@/lib/data";

export const dynamic = "force-dynamic";

export default async function HomePage({ searchParams }: { searchParams: Promise<{ withdrawn?: string }> }) {
  const { withdrawn } = await searchParams;
  const occupations = await (await publicData()).listOccupations();
  return (
    <div className="mx-auto max-w-2xl space-y-8 pt-6">
      {withdrawn && (
        <p role="status" className="rounded-xl bg-brand-soft p-4 text-sm">
          동의를 철회했어요. 기여자 정보와 경로가 모두 삭제되었습니다.
        </p>
      )}
      <section className="space-y-3">
        <h1 className="text-3xl font-bold leading-tight tracking-tight">
          무엇이 되고 싶나요?
        </h1>
        <p className="text-muted">
          장래희망을 검색하면, 현직 종사자들이 지나온 학교·학원·시험·첫 소속을 모아 경로 그래프로 보여드려요.
        </p>
        <SearchBox />
      </section>
      <OccupationChips occupations={occupations} />
    </div>
  );
}
