import { redirect } from "next/navigation";
import { createSessionClient } from "./supabase/server";

/** 로그인 사용자와 세션 클라이언트를 돌려줍니다. 로그인하지 않았으면 로그인 화면으로 보냅니다. */
export async function requireUser(next: string) {
  const supabase = await createSessionClient();
  if (!supabase) return { supabase: null, user: null } as const;
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(`/login?next=${encodeURIComponent(next)}`);
  return { supabase, user } as const;
}

/** 내부 경로만 허용(오픈 리다이렉트 방지) */
export function safeNext(next: string | null | undefined, fallback = "/me"): string {
  return next && next.startsWith("/") && !next.startsWith("//") ? next : fallback;
}
