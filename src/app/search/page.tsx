import { Suspense } from "react";
import { publicData } from "@/lib/data";
import { SearchResults } from "./SearchResults";

export const revalidate = 60;

export default async function SearchPage() {
  const occupations = await (await publicData()).listOccupations();
  return (
    <Suspense fallback={<p className="text-muted">검색 중…</p>}>
      <SearchResults occupations={occupations} />
    </Suspense>
  );
}
