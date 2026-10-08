import { redirect } from "next/navigation";
import { SetupNotice } from "@/components/SetupNotice";
import { requireUser } from "@/lib/auth";
import type { Stage, Visibility } from "@/lib/types";
import { PathEditor, type EditorNode } from "./PathEditor";
import { WithdrawButton } from "./WithdrawButton";

export const dynamic = "force-dynamic";

export default async function MePage() {
  const { supabase, user } = await requireUser("/me");
  if (!supabase || !user) return <SetupNotice />;

  const { data: contributor } = await supabase
    .from("contributors")
    .select("id, consent_version, consented_at, occupations(name_ko)")
    .maybeSingle();
  if (!contributor) redirect("/contribute");

  const [{ data: steps }, { data: nodes }] = await Promise.all([
    supabase.from("path_steps").select("seq, node_id, start_year_bucket, visibility").order("seq"),
    supabase.from("nodes").select("id, stage, label_type, approved").order("label_type"),
  ]);
  const occupationName =
    (contributor.occupations as unknown as { name_ko: string } | null)?.name_ko ?? "선택한 직업";

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold">내 경로</h1>
        <p className="text-sm text-muted">
          {occupationName} · 동의 {contributor.consent_version} ({new Date(contributor.consented_at).toLocaleDateString("ko-KR")})
        </p>
      </div>
      <PathEditor
        nodes={(nodes ?? []).map((n) => ({ ...n, stage: n.stage as Stage })) as EditorNode[]}
        initialSteps={(steps ?? []).map((s) => ({
          node_id: s.node_id as number,
          start_year_bucket: s.start_year_bucket as string | null,
          visibility: s.visibility as Visibility,
        }))}
      />
      <section className="rounded-xl border border-red-200 bg-white p-5">
        <h2 className="font-semibold">동의 철회</h2>
        <p className="mt-1 text-sm text-muted">
          내 기여자 정보와 경로 전체가 즉시 삭제되며 복구할 수 없습니다. 이후 집계에서 바로 빠집니다.
        </p>
        <WithdrawButton />
      </section>
    </div>
  );
}
