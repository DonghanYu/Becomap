import Link from "next/link";
import { SetupNotice } from "@/components/SetupNotice";
import { requireUser } from "@/lib/auth";
import { readConsentText } from "@/lib/consent";
import { renderSimpleMarkdown } from "@/lib/markdown";
import { GROUP_LABEL } from "@/lib/stages";
import type { Occupation } from "@/lib/types";
import { giveConsent } from "./actions";

export const dynamic = "force-dynamic";

const ERRORS: Record<string, string> = {
  agree: "동의 항목에 체크해 주세요.",
  occupation: "직업을 선택해 주세요.",
};

export default async function ContributePage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { error } = await searchParams;
  const { supabase, user } = await requireUser("/contribute");
  if (!supabase || !user) return <SetupNotice />;

  const [{ data: occupations }, { data: mine }] = await Promise.all([
    supabase.from("occupations").select("id, slug, name_ko, grp, aliases, sort_order").order("sort_order"),
    supabase.from("contributors").select("id, occupation_id").maybeSingle(),
  ]);
  const consent = await readConsentText();

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <h1 className="text-2xl font-bold">종사자 경로 등록</h1>
      {mine && (
        <p className="rounded-xl bg-brand-soft p-4 text-sm">
          이미 동의하셨어요. <Link href="/me" className="text-brand underline">내 경로 편집하기</Link>
        </p>
      )}
      <article className="space-y-2 rounded-xl border border-line bg-white p-5 text-sm leading-relaxed">
        {renderSimpleMarkdown(consent)}
      </article>
      <form action={giveConsent} className="space-y-4 rounded-xl border border-line bg-white p-5">
        <label className="block space-y-1">
          <span className="text-sm font-medium">현재 직업</span>
          <select
            name="occupation_id"
            required
            defaultValue={mine?.occupation_id ?? ""}
            className="w-full rounded-lg border border-line bg-white px-3 py-2"
          >
            <option value="" disabled>
              선택해 주세요
            </option>
            {(["A_전문직", "B_기술직"] as const).map((g) => (
              <optgroup key={g} label={GROUP_LABEL[g]}>
                {((occupations ?? []) as Occupation[])
                  .filter((o) => o.grp === g)
                  .map((o) => (
                    <option key={o.id} value={o.id}>
                      {o.name_ko}
                    </option>
                  ))}
              </optgroup>
            ))}
          </select>
        </label>
        <label className="flex items-start gap-2 text-sm">
          <input type="checkbox" name="agree" required className="mt-1" />
          <span>위 수집 항목·이용 목적·공개 범위·철회 방법을 확인했고, 경로 정보 수집·이용에 동의합니다.</span>
        </label>
        {error && <p className="text-sm text-red-700">{ERRORS[error] ?? error}</p>}
        <button type="submit" className="w-full rounded-xl bg-brand py-3 text-white">
          동의하고 경로 입력하기
        </button>
      </form>
    </div>
  );
}
