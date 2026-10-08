import { STAGES } from "./stages";
import type { Stage } from "./types";

export interface ReviewStep {
  seq: number;
  stage: Stage;
  label_type: string;
  start_year_bucket: string | null;
  approved: boolean;
}

/** 관리자 검토용 이상치 표시(자동 삭제하지 않고 표시만 합니다). */
export function outlierFlags(steps: ReviewStep[]): string[] {
  const flags: string[] = [];
  const sorted = [...steps].sort((a, b) => a.seq - b.seq);
  if (sorted.length < 2) flags.push("단계가 2개 미만");
  if (sorted.length > 12) flags.push("단계가 12개 초과");

  const seen = new Set<string>();
  for (const s of sorted) {
    const key = `${s.stage}:${s.label_type}`;
    if (seen.has(key)) {
      flags.push("같은 마디 반복");
      break;
    }
    seen.add(key);
  }

  const rank = (st: Stage) => STAGES.indexOf(st);
  let reachedJob = false;
  for (const s of sorted) {
    if (s.stage === "first_job" || s.stage === "career") reachedJob = true;
    if (reachedJob && rank(s.stage) <= rank("undergrad")) {
      flags.push("취업 이후 고교·학부 단계");
      break;
    }
  }
  const firstHs = sorted.findIndex((s) => s.stage === "high_school");
  if (firstHs > 0) flags.push("고교 단계가 처음이 아님");

  let prev = -Infinity;
  for (const s of sorted) {
    if (!s.start_year_bucket) continue;
    const y = Number(s.start_year_bucket.slice(0, 4));
    if (y < prev) {
      flags.push("연도 역행");
      break;
    }
    prev = y;
  }
  if (sorted.some((s) => !s.approved)) flags.push("미승인 마디 포함");
  return flags;
}
