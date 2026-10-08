import Link from "next/link";

/** 정적 데모에서 로그인이 필요한 화면 대신 보여주는 안내 */
export function DemoNotice({ title }: { title: string }) {
  return (
    <div className="mx-auto max-w-md space-y-3 rounded-xl border border-line bg-white p-6">
      <h1 className="text-xl font-bold">{title}</h1>
      <p className="text-sm text-muted">
        지금 보시는 사이트는 합성(가상) 데이터로 만든 <strong>읽기 전용 데모</strong>입니다. 종사자 로그인·경로
        등록·철회 기능은 정식 서비스(Supabase 연결)에서 제공할 예정입니다.
      </p>
      <Link href="/" className="inline-block text-sm text-brand underline">
        경로 그래프 보러 가기
      </Link>
    </div>
  );
}
