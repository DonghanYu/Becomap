export function SetupNotice() {
  return (
    <p className="rounded-xl border border-line bg-white p-6 text-sm text-muted">
      Supabase 설정이 필요합니다. <code>.env.local</code>에 <code>NEXT_PUBLIC_SUPABASE_URL</code>과{" "}
      <code>NEXT_PUBLIC_SUPABASE_ANON_KEY</code>를 입력해 주세요(<code>docs/DEPLOY.md</code> 참고).
    </p>
  );
}
