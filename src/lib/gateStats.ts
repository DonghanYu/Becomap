import type { GateStat } from "./types";

const METRIC_LABEL: Record<string, { label: string; unit: string }> = {
  examinees: { label: "응시자", unit: "명" },
  passers: { label: "합격자", unit: "명" },
  pass_rate_examinees: { label: "응시자 대비 합격률", unit: "%" },
  first_attempt_pass_rate: { label: "초시 합격률", unit: "%" },
  admission_quota: { label: "입학정원", unit: "명" },
  min_legal_career_years: { label: "최소 법조경력", unit: "년 이상" },
};

export interface GateStatView {
  numeric: { label: string; text: string; year: number | null; source_url: string; note: string | null }[];
  notes: { text: string; source_url: string | null }[];
  /** 공식 수치가 하나도 없으면 true → "공식 통계 확인 중" 표시 */
  pending: boolean;
}

export function formatGateStats(stats: GateStat[]): GateStatView {
  const numeric: GateStatView["numeric"] = [];
  const notes: GateStatView["notes"] = [];
  for (const s of stats) {
    if (s.value !== null && s.source_url) {
      const m = METRIC_LABEL[s.metric] ?? { label: s.metric, unit: "" };
      const v = Number(s.value);
      const text = `${v.toLocaleString("ko-KR", { maximumFractionDigits: 2 })}${m.unit}`;
      numeric.push({ label: m.label, text, year: s.year, source_url: s.source_url, note: s.note });
    } else if (s.note && !s.note.startsWith("TODO")) {
      notes.push({ text: s.note, source_url: s.source_url });
    }
  }
  return { numeric, notes, pending: numeric.length === 0 };
}
