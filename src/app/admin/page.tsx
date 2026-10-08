import { notFound } from "next/navigation";
import { SetupNotice } from "@/components/SetupNotice";
import { requireUser } from "@/lib/auth";
import { outlierFlags, type ReviewStep } from "@/lib/outliers";
import { STAGE_LABEL } from "@/lib/stages";
import type { Stage } from "@/lib/types";
import { approveNode, deleteContributor, markReviewed, mergeNodes } from "./actions";

export const dynamic = "force-dynamic";

interface QueueRow {
  contributor_id: string;
  occupation_name: string;
  created_at: string;
  reviewed_at: string | null;
  steps: ReviewStep[];
}

export default async function AdminPage() {
  const { supabase, user } = await requireUser("/admin");
  if (!supabase || !user) return <SetupNotice />;
  const { data: me } = await supabase.from("admins").select("user_id").maybeSingle();
  if (!me) notFound();

  const [{ data: queue }, { data: pending }, { data: approved }, { data: log }] = await Promise.all([
    supabase.rpc("admin_review_queue", { p_limit: 50 }),
    supabase.rpc("admin_pending_nodes"),
    supabase.from("nodes").select("id, stage, label_type").eq("approved", true).order("label_type"),
    supabase.from("admin_audit_log").select("id, action, detail, created_at").order("id", { ascending: false }).limit(20),
  ]);

  return (
    <div className="space-y-8">
      <h1 className="text-2xl font-bold">관리자</h1>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">신규 경로 검토</h2>
        <p className="text-sm text-muted">실제 기여자(합성 제외)의 경로입니다. 이상치는 표시만 하며 자동 삭제하지 않습니다.</p>
        <ul className="space-y-3">
          {((queue ?? []) as QueueRow[]).map((q) => {
            const flags = outlierFlags(q.steps);
            return (
              <li key={q.contributor_id} className="rounded-xl border border-line bg-white p-4 text-sm">
                <div className="flex flex-wrap items-center gap-2">
                  <strong>{q.occupation_name}</strong>
                  <span className="text-muted">{new Date(q.created_at).toLocaleString("ko-KR")}</span>
                  {q.reviewed_at ? (
                    <span className="rounded bg-brand-soft px-2 text-xs text-brand">검토 완료</span>
                  ) : (
                    <span className="rounded bg-accent-soft px-2 text-xs">검토 대기</span>
                  )}
                  {flags.map((f) => (
                    <span key={f} className="rounded bg-red-100 px-2 text-xs text-red-800">{f}</span>
                  ))}
                </div>
                <ol className="mt-2 list-decimal pl-5">
                  {q.steps.map((s) => (
                    <li key={s.seq}>
                      {s.label_type} <span className="text-muted">({STAGE_LABEL[s.stage]}{s.start_year_bucket ? `, ${s.start_year_bucket}` : ""}{s.approved ? "" : ", 미승인"})</span>
                    </li>
                  ))}
                </ol>
                <div className="mt-3 flex flex-wrap gap-2">
                  <form action={markReviewed}>
                    <input type="hidden" name="contributor_id" value={q.contributor_id} />
                    <button className="rounded border border-line px-3 py-1">검토 완료</button>
                  </form>
                  <form action={deleteContributor} className="flex gap-1">
                    <input type="hidden" name="contributor_id" value={q.contributor_id} />
                    <input name="reason" required placeholder="삭제 사유" className="rounded border border-line px-2" />
                    <button className="rounded border border-red-300 px-3 py-1 text-red-700">삭제</button>
                  </form>
                </div>
              </li>
            );
          })}
          {(queue ?? []).length === 0 && <li className="text-sm text-muted">검토할 경로가 없습니다.</li>}
        </ul>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">마디 승인·라벨 병합</h2>
        <ul className="space-y-2">
          {((pending ?? []) as { id: number; stage: Stage; label_type: string; usage: number }[]).map((n) => (
            <li key={n.id} className="flex flex-wrap items-center gap-2 rounded-xl border border-line bg-white p-3 text-sm">
              <strong>{n.label_type}</strong>
              <span className="text-muted">{STAGE_LABEL[n.stage]} · 사용 {n.usage}명</span>
              <form action={approveNode}>
                <input type="hidden" name="node_id" value={n.id} />
                <button className="rounded border border-line px-3 py-1">승인</button>
              </form>
              <form action={mergeNodes} className="flex gap-1">
                <input type="hidden" name="from_id" value={n.id} />
                <select name="to_id" required className="rounded border border-line px-2">
                  <option value="">병합 대상</option>
                  {(approved ?? [])
                    .filter((a) => a.stage === n.stage)
                    .map((a) => (
                      <option key={a.id} value={a.id}>{a.label_type}</option>
                    ))}
                </select>
                <button className="rounded border border-line px-3 py-1">병합</button>
              </form>
            </li>
          ))}
          {(pending ?? []).length === 0 && <li className="text-sm text-muted">승인 대기 마디가 없습니다.</li>}
        </ul>
      </section>

      <section className="space-y-2">
        <h2 className="text-lg font-semibold">감사 로그(최근 20건)</h2>
        <ul className="space-y-1 text-xs">
          {(log ?? []).map((l) => (
            <li key={l.id}>
              <span className="text-muted">{new Date(l.created_at).toLocaleString("ko-KR")}</span> {l.action}{" "}
              <code>{JSON.stringify(l.detail)}</code>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
