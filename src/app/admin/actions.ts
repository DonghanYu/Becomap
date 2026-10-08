"use server";

import { revalidatePath } from "next/cache";
import { createSessionClient } from "@/lib/supabase/server";

// 권한 확인과 감사 로그 기록은 DB 함수(admin_*)가 수행합니다.
async function call(fn: string, args: Record<string, unknown>) {
  const supabase = await createSessionClient();
  if (!supabase) throw new Error("Supabase 설정이 필요합니다.");
  const { error } = await supabase.rpc(fn, args);
  if (error) throw new Error(error.message);
  revalidatePath("/admin");
}

export async function markReviewed(form: FormData) {
  await call("admin_mark_reviewed", { p_contributor: String(form.get("contributor_id")) });
}

export async function deleteContributor(form: FormData) {
  await call("admin_delete_contributor", {
    p_contributor: String(form.get("contributor_id")),
    p_reason: String(form.get("reason") ?? "").slice(0, 200),
  });
}

export async function approveNode(form: FormData) {
  await call("admin_approve_node", { p_node: Number(form.get("node_id")) });
}

export async function mergeNodes(form: FormData) {
  await call("admin_merge_nodes", { p_from: Number(form.get("from_id")), p_to: Number(form.get("to_id")) });
}
