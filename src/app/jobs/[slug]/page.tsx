import Link from "next/link";
import { notFound } from "next/navigation";
import { CausalityNotice } from "@/components/CausalityNotice";
import { PathExplorer } from "@/components/PathExplorer";
import { publicData } from "@/lib/data";
import { iGa } from "@/lib/josa";
import { GROUP_LABEL } from "@/lib/stages";

export const dynamic = "force-dynamic";

export default async function JobPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const graph = await (await publicData()).getGraph(slug);
  if (!graph) notFound();
  const { occupation, total, hasSynthetic } = graph;

  return (
    <div className="space-y-5">
      <div className="space-y-1">
        <p className="text-sm text-muted">{GROUP_LABEL[occupation.grp]}</p>
        <h1 className="text-2xl font-bold tracking-tight">
          {occupation.name_ko}
          {iGa(occupation.name_ko)} 되고 싶어요
        </h1>
      </div>

      <CausalityNotice />

      <dl className="flex flex-wrap gap-x-6 gap-y-1 text-sm" aria-label="표본과 데이터 출처">
        <div className="flex gap-1">
          <dt className="text-muted">표본</dt>
          <dd data-testid="sample-size">{total === null ? "공개 기준 미달" : `종사자 ${total}명`}</dd>
        </div>
        <div className="flex gap-1">
          <dt className="text-muted">데이터 출처</dt>
          <dd>
            {hasSynthetic
              ? "합성(가상) 데이터 — 개발용이며 실제 종사자 통계가 아닙니다"
              : "종사자 본인 등록(동의 기반)"}
          </dd>
        </div>
        <div className="flex gap-1">
          <dt className="text-muted">공개 기준</dt>
          <dd>기여자 5명 이상인 마디·흐름만 표시</dd>
        </div>
      </dl>

      {total === null || graph.links.length === 0 ? (
        <p className="rounded-xl border border-line bg-white p-6 text-center text-muted">
          아직 공개할 만큼 경로가 모이지 않았어요. 현직자라면{" "}
          <Link href="/contribute" className="text-brand underline">
            경로를 등록
          </Link>
          해 주세요.
        </p>
      ) : (
        <PathExplorer graph={graph} />
      )}
    </div>
  );
}
