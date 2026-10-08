// 로그인 사용자 세션을 쓰는 서버용 Supabase 클라이언트(쿠키 기반)
import { createServerClient } from "@supabase/ssr";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { supabaseEnv } from "./env";

export async function createSessionClient() {
  const env = supabaseEnv();
  if (!env) return null;
  const cookieStore = await cookies();
  return createServerClient(env.url, env.anonKey, {
    cookies: {
      getAll: () => cookieStore.getAll(),
      setAll(toSet) {
        try {
          toSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
        } catch {
          // 서버 컴포넌트에서는 쿠키를 쓸 수 없음 — 미들웨어가 세션을 갱신합니다.
        }
      },
    },
  });
}

/** service role 클라이언트: 탈퇴 시 Auth 사용자 삭제에만 사용합니다. 키가 없으면 null. */
export function createServiceClient() {
  const env = supabaseEnv();
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!env || !key) return null;
  return createAdminClient(env.url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}
