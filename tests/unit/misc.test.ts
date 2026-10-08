import { describe, expect, it } from "vitest";
import { formatGateStats } from "@/lib/gateStats";
import { iGa } from "@/lib/josa";
import { outlierFlags } from "@/lib/outliers";
import { moveItem, removeItem, validatePath } from "@/lib/pathEditor";
import { yearBuckets, yearToBucket } from "@/lib/stages";

describe("formatGateStats", () => {
  it("값이 NULL뿐이면 '확인 중' 상태입니다", () => {
    const v = formatGateStats([
      { node_id: 1, year: null, metric: "pass_rate_examinees", value: null, source_url: null, note: "TODO: 출처 확인 필요" },
    ]);
    expect(v.pending).toBe(true);
    expect(v.notes).toEqual([]); // TODO 메모는 화면에 노출하지 않음
  });
  it("출처가 있는 수치만 표시합니다", () => {
    const v = formatGateStats([
      { node_id: 1, year: 2026, metric: "pass_rate_examinees", value: 50.95, source_url: "https://x", note: null },
      { node_id: 1, year: 2026, metric: "passers", value: 1714, source_url: null, note: null },
    ]);
    expect(v.pending).toBe(false);
    expect(v.numeric).toHaveLength(1);
    expect(v.numeric[0]!.text).toBe("50.95%");
  });
  it("절차 메모는 출처와 함께 표시합니다", () => {
    const v = formatGateStats([
      { node_id: 1, year: 2026, metric: "procedure", value: null, source_url: "https://s", note: "직무적합성평가 → GSAT" },
    ]);
    expect(v.pending).toBe(true);
    expect(v.notes[0]).toEqual({ text: "직무적합성평가 → GSAT", source_url: "https://s" });
  });
});

describe("iGa", () => {
  it("받침에 따라 조사를 고릅니다", () => {
    expect(iGa("변호사")).toBe("가");
    expect(iGa("전문가")).toBe("가");
    expect(iGa("기술직")).toBe("이");
    expect(iGa("AI")).toBe("가");
  });
});

describe("연도 구간", () => {
  it("5년 단위", () => {
    expect(yearToBucket(2013)).toBe("2010-2014");
    expect(yearBuckets(2000, 2026)).toEqual(["2025-2029", "2020-2024", "2015-2019", "2010-2014", "2005-2009", "2000-2004"]);
  });
});

describe("경로 입력기", () => {
  it("순서 변경과 삭제", () => {
    expect(moveItem([1, 2, 3], 0, 1)).toEqual([2, 1, 3]);
    expect(moveItem([1, 2, 3], 0, -1)).toEqual([1, 2, 3]);
    expect(removeItem([1, 2, 3], 1)).toEqual([1, 3]);
  });
  it("검증", () => {
    expect(validatePath([])).not.toBeNull();
    expect(validatePath([{ node_id: null }])).not.toBeNull();
    expect(validatePath([{ node_id: 1 }])).toBeNull();
  });
});

describe("outlierFlags", () => {
  const s = (seq: number, stage: any, label: string, y: string | null = null, approved = true) => ({
    seq, stage, label_type: label, start_year_bucket: y, approved,
  });
  it("정상 경로는 표시 없음", () => {
    expect(outlierFlags([s(1, "high_school", "고교-일반고", "2005-2009"), s(2, "undergrad", "학부-법학", "2010-2014")])).toEqual([]);
  });
  it("역행·반복·미승인을 표시합니다", () => {
    const f = outlierFlags([
      s(1, "undergrad", "학부-법학", "2015-2019"),
      s(2, "first_job", "첫 소속-로펌", "2010-2014"),
      s(3, "high_school", "고교-일반고", null, false),
      s(4, "undergrad", "학부-법학"),
    ]);
    expect(f).toEqual(expect.arrayContaining(["같은 마디 반복", "취업 이후 고교·학부 단계", "고교 단계가 처음이 아님", "연도 역행", "미승인 마디 포함"]));
  });
});
