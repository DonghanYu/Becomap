"use server";

import { redirect } from "next/navigation";
import { CONSENT_VERSION } from "@/lib/consent";
import { createSessionClient } from "@/lib/supabase/server";

export async function giveConsent(form: FormData) {
  const supabase = await createSessionClient();
  if (!supabase) throw new Error("Supabase 설정이 필요합니다.");
  if (form.get("agree") !== "on") redirect("/contribute?error=agree");
  const occupationId = Number(form.get("occupation_id"));
  if (!Number.isInteger(occupationId) || occupationId <= 0) redirect("/contribute?error=occupation");
  const { error } = await supabase.rpc("register_contributor", {
    p_occupation_id: occupationId,
    p_consent_version: CONSENT_VERSION,
  });
  if (error) redirect(`/contribute?error=${encodeURIComponent(error.message)}`);
  redirect("/me");
}
