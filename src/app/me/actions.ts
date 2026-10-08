"use server";

import { redirect } from "next/navigation";
import { createServiceClient, createSessionClient } from "@/lib/supabase/server";
import type { Stage, Visibility } from "@/lib/types";

export interface EditorStep {
  node_id: number;
  start_year_bucket: string | null;
  visibility: Visibility;
}

export async function saveMyPath(steps: EditorStep[]): Promise<{ ok: boolean; message: string }> {
  const supabase = await createSessionClient();
  if (!supabase) return { ok: false, message: "Supabase 설정이 필요합니다." };
  const clean = steps.map((s) => ({
    node_id: Number(s.node_id),
    start_year_bucket: s.start_year_bucket && /^\d{4}-\d{4}$/.test(s.start_year_bucket) ? s.start_year_bucket : null,
    visibility: s.visibility === "public" ? "public" : "aggregate_only",
  }));
  const { error } = await supabase.rpc("save_my_path", { p_steps: clean });
  if (error) return { ok: false, message: error.message };
  return { ok: true, message: "저장했어요. 같은 경로의 기여자가 5명 이상이면 그래프에 반영됩니다." };
}

export async function proposeNode(
  stage: Stage,
  label: string,
): Promise<{ ok: true; id: number } | { ok: false; message: string }> {
  const supabase = await createSessionClient();
  if (!supabase) return { ok: false, message: "Supabase 설정이 필요합니다." };
  const { data, error } = await supabase.rpc("propose_node", { p_stage: stage, p_label: label });
  if (error) return { ok: false, message: error.message };
  return { ok: true, id: Number(data) };
}

/** 동의 철회: 기여자·경로를 즉시 삭제하고, service role 키가 있으면 로그인 계정도 삭제합니다. */
export async function withdraw() {
  const supabase = await createSessionClient();
  if (!supabase) throw new Error("Supabase 설정이 필요합니다.");
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { error } = await supabase.rpc("withdraw_me");
  if (error) throw new Error(`철회에 실패했어요: ${error.message}`);
  const admin = createServiceClient();
  if (admin) await admin.auth.admin.deleteUser(user.id);
  await supabase.auth.signOut();
  redirect("/?withdrawn=1");
}
