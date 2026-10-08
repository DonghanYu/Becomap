"use server";

import { safeNext } from "@/lib/auth";
import { createSessionClient } from "@/lib/supabase/server";

export type LoginState = { ok: boolean; message: string } | null;

export async function sendLoginLink(_prev: LoginState, form: FormData): Promise<LoginState> {
  const supabase = await createSessionClient();
  if (!supabase) return { ok: false, message: "Supabase 설정이 필요합니다." };
  const email = String(form.get("email") ?? "").trim();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { ok: false, message: "이메일 주소를 확인해 주세요." };
  const next = safeNext(String(form.get("next") ?? ""), "/contribute");
  const site = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: { emailRedirectTo: `${site}/auth/callback?next=${encodeURIComponent(next)}` },
  });
  if (error) return { ok: false, message: `메일을 보내지 못했어요: ${error.message}` };
  return { ok: true, message: "로그인 링크를 메일로 보냈어요. 메일함을 확인해 주세요." };
}

export async function signOut() {
  const supabase = await createSessionClient();
  await supabase?.auth.signOut();
}
