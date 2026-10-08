import { OccupationChips } from "@/components/OccupationChips";
import { SearchBox } from "@/components/SearchBox";
import { WithdrawnBanner } from "@/components/WithdrawnBanner";
import { publicData } from "@/lib/data";

// 집계는 자주 바뀌지 않으므로 60초마다 다시 만듭니다(정적 데모 빌드에서는 빌드 시점 값).
export const revalidate = 60;

export default async function HomePage() {
  const occupations = await (await publicData()).listOccupations();
  return (
    <div className="mx-auto max-w-2xl space-y-8 pt-6">
      <WithdrawnBanner />
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
