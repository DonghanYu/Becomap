import Link from "next/link";
import { GROUP_LABEL } from "@/lib/stages";
import type { Occupation } from "@/lib/types";

export function OccupationChips({ occupations }: { occupations: Occupation[] }) {
  const groups = (["A_전문직", "B_기술직"] as const).map((g) => ({
    g,
    items: occupations.filter((o) => o.grp === g),
  }));
  return (
    <div className="space-y-5">
      {groups.map(({ g, items }) => (
        <section key={g} aria-labelledby={`grp-${g}`}>
          <h2 id={`grp-${g}`} className="mb-2 text-sm font-semibold text-muted">
            {g === "A_전문직" ? "A" : "B"}. {GROUP_LABEL[g]}
          </h2>
          <ul className="flex flex-wrap gap-2">
            {items.map((o) => (
              <li key={o.slug}>
                <Link
                  href={`/jobs/${o.slug}`}
                  className="inline-block rounded-full border border-line bg-white px-3 py-1.5 text-sm hover:border-brand hover:text-brand"
                >
                  {o.name_ko}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
