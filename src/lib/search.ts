import type { Occupation } from "./types";

/** 검색어 정규화: 공백 제거, 소문자, "~가 되고 싶어요" 같은 꼬리말 제거 */
export function normalizeQuery(q: string): string {
  let s = q.normalize("NFC").replace(/\s+/g, "").toLowerCase();
  s = s.replace(/[.!?~]+$/g, "");
  const suffixes = [
    "가되고싶어요", "이되고싶어요", "가되고싶다", "이되고싶다", "되고싶어요", "되고싶다",
    "가되려면", "이되려면", "되려면", "되는법", "되는방법", "입사방법", "들어가는법",
  ];
  for (const suf of suffixes) {
    if (s.endsWith(suf) && s.length > suf.length) {
      s = s.slice(0, -suf.length);
      break;
    }
  }
  return s;
}

export interface SearchResult {
  match: Occupation | null;
  candidates: Occupation[];
}

/**
 * 직업명·별칭 매칭.
 * 1) 정규화한 이름/별칭과 정확히 일치 → 바로 이동
 * 2) 포함 관계(검색어가 별칭을 포함하거나 별칭이 검색어를 포함) → 후보가 하나면 이동, 여럿이면 목록
 */
export function searchOccupations(query: string, occupations: Occupation[]): SearchResult {
  const q = normalizeQuery(query);
  if (!q) return { match: null, candidates: [] };
  const names = (o: Occupation) => [o.name_ko, ...o.aliases].map(normalizeQuery);

  const exact = occupations.filter((o) => names(o).includes(q));
  if (exact.length === 1) return { match: exact[0]!, candidates: exact };
  if (exact.length > 1) return { match: null, candidates: exact };

  const scored = occupations
    .map((o) => {
      let best = 0;
      for (const n of names(o)) {
        if (n.length < 2) continue;
        if (q.includes(n)) best = Math.max(best, n.length);
        else if (n.includes(q) && q.length >= 2) best = Math.max(best, q.length * 0.9);
      }
      return { o, best };
    })
    .filter((x) => x.best > 0)
    .sort((a, b) => b.best - a.best || a.o.sort_order - b.o.sort_order);

  if (scored.length === 0) return { match: null, candidates: [] };
  const top = scored[0]!;
  const tied = scored.filter((x) => x.best === top.best);
  if (tied.length === 1) return { match: top.o, candidates: scored.map((x) => x.o) };
  return { match: null, candidates: scored.map((x) => x.o) };
}
