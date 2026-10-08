import { SetupNotice } from "@/components/SetupNotice";
import { safeNext } from "@/lib/auth";
import { supabaseEnv } from "@/lib/supabase/env";
import { LoginForm } from "./LoginForm";

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const { next } = await searchParams;
  return (
    <div className="mx-auto max-w-md space-y-4">
      <h1 className="text-2xl font-bold">종사자 로그인</h1>
      <p className="text-sm text-muted">
        비밀번호 없이 이메일로 받은 링크로 로그인해요. 경로 그래프 열람에는 로그인이 필요 없습니다.
      </p>
      {supabaseEnv() ? <LoginForm next={safeNext(next, "/contribute")} /> : <SetupNotice />}
    </div>
  );
}
