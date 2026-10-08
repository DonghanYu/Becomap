import type { Stage } from "./types";

export const STAGES: Stage[] = ["high_school", "undergrad", "grad", "prep", "gate", "first_job", "career"];

export const STAGE_LABEL: Record<Stage, string> = {
  high_school: "고교",
  undergrad: "학부",
  grad: "대학원",
  prep: "준비(학원·교육)",
  gate: "관문(시험·전형)",
  first_job: "첫 소속",
  career: "경력",
};

export const GROUP_LABEL = { A_전문직: "전문직·고위직", B_기술직: "기술직" } as const;

/** 경로 단계 시작 연도를 5년 구간으로 고릅니다. */
export function yearBuckets(fromYear = 1970, toYear = new Date().getFullYear()): string[] {
  const out: string[] = [];
  const start = toYear - (toYear % 5);
  for (let y = start; y >= fromYear; y -= 5) out.push(`${y}-${y + 4}`);
  return out;
}

export function yearToBucket(year: number): string {
  const s = year - (year % 5);
  return `${s}-${s + 4}`;
}
