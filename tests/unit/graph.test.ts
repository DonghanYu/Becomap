import { describe, expect, it } from "vitest";
import { breakCycles, coarseShare, destinationCandidates, nextDestination } from "@/lib/graph";
import type { GraphLink, GraphNode, Stage } from "@/lib/types";

const n = (node_id: number, stage: Stage, contributors: number, label = `n${node_id}`): GraphNode => ({
  node_id, stage, label_type: label, is_gate: stage === "gate", description: null, contributors,
});
const l = (from_node: number, to_node: number, contributors: number): GraphLink => ({ from_node, to_node, contributors });

// 변호사 경로를 단순화한 그래프
const NODES = [
  n(1, "high_school", 30, "고교-일반고"),
  n(2, "undergrad", 20, "학부-법학"),
  n(3, "undergrad", 10, "학부-비법학"),
  n(4, "prep", 24, "학원-LEET 준비"),
  n(5, "gate", 30, "관문-법학전문대학원 입학"),
  n(6, "grad", 30, "대학원-법학전문대학원"),
  n(7, "gate", 30, "관문-변호사시험"),
];
const LINKS = [l(1, 2, 20), l(1, 3, 10), l(2, 4, 14), l(2, 5, 6), l(3, 4, 10), l(4, 5, 24), l(5, 6, 30), l(6, 7, 30)];

describe("nextDestination", () => {
  it("고교생 → 고교 다음 가장 굵은 마디", () => {
    expect(nextDestination(NODES, LINKS, "high_school")?.node.label_type).toBe("학부-법학");
  });
  it("대학생 → 학부 다음 가장 굵은 마디(흐름 합산)", () => {
    const d = nextDestination(NODES, LINKS, "undergrad");
    expect(d?.node.label_type).toBe("학원-LEET 준비");
    expect(d?.inflow).toBe(24);
  });
  it("졸업 후 → 대학원 이후 마디도 후보에 포함", () => {
    const c = destinationCandidates(NODES, LINKS, "graduated").map((x) => x.node.label_type);
    expect(c).toContain("관문-변호사시험");
    expect(c).toContain("학원-LEET 준비");
  });
  it("후보가 없으면 null", () => {
    expect(nextDestination([n(1, "career", 9)], [], "high_school")).toBeNull();
  });
});

describe("breakCycles", () => {
  it("순환을 만드는 가장 가는 간선만 제외합니다", () => {
    const { kept, dropped } = breakCycles([l(1, 2, 10), l(2, 3, 8), l(3, 1, 5)]);
    expect(dropped).toEqual([l(3, 1, 5)]);
    expect(kept).toHaveLength(2);
  });
  it("순환이 없으면 그대로", () => {
    expect(breakCycles(LINKS).dropped).toEqual([]);
  });
});

describe("coarseShare", () => {
  it("5% 단위로 거칠게 표시합니다", () => {
    expect(coarseShare(14, 30)).toBe("약 45%");
    expect(coarseShare(30, 30)).toBe("대부분(95% 이상)");
    expect(coarseShare(1, 30)).toBe("5% 미만");
    expect(coarseShare(1, 0)).toBe("—");
  });
});
