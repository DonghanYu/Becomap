import { BASE_PATH, IS_STATIC_DEMO } from "@/lib/mode";

// 정적 데모(GitHub Pages)는 폴더형 주소(/search/)를 써야 쿼리가 유지됩니다.
const SEARCH_ACTION = `${BASE_PATH}/search${IS_STATIC_DEMO ? "/" : ""}`;

export function SearchBox({ defaultValue = "" }: { defaultValue?: string }) {
  return (
    <form action={SEARCH_ACTION} method="get" role="search" className="flex w-full flex-col gap-2 sm:flex-row sm:items-stretch">
      <label htmlFor="q" className="sr-only">
        되고 싶은 직업
      </label>
      <div className="flex min-w-0 flex-1 items-center rounded-2xl border border-line bg-white px-4 shadow-sm focus-within:border-brand">
        <input
          id="q"
          name="q"
          defaultValue={defaultValue}
          placeholder="변호사"
          autoComplete="off"
          required
          className="w-0 min-w-0 flex-1 bg-transparent py-3 text-lg outline-none placeholder:text-muted/50"
        />
        <span className="shrink-0 pl-2 text-lg text-muted">가 되고 싶어요</span>
      </div>
      <button type="submit" className="rounded-2xl bg-brand px-5 py-3 text-white hover:opacity-90">
        검색
      </button>
    </form>
  );
}
