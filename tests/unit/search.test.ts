import { describe, expect, it } from "vitest";
import { normalizeQuery, searchOccupations } from "@/lib/search";
import type { Occupation } from "@/lib/types";

const occ = (id: number, slug: string, name_ko: string, aliases: string[]): Occupation => ({
  id, slug, name_ko, aliases, grp: "A_전문직", sort_order: id,
});
const LIST: Occupation[] = [
  occ(1, "lawyer", "변호사", ["변호사", "로이어"]),
  occ(2, "judge", "판사", ["판사", "법관"]),
  occ(3, "prosecutor", "검사", ["검사", "검찰"]),
  occ(5, "accountant", "회계사", ["회계사", "공인회계사", "CPA"]),
  occ(7, "tax-accountant", "세무사", ["세무사"]),
  occ(9, "software-developer", "소프트웨어 개발자", ["개발자", "프로그래머"]),
  occ(10, "ai-engineer", "AI 엔지니어", ["인공지능 개발자", "AI 개발자"]),
  occ(11, "data-analyst", "데이터 분석가", ["데이터 분석가"]),
  occ(13, "security-specialist", "정보보안 전문가", ["화이트해커", "보안 전문가"]),
];

describe("normalizeQuery", () => {
  it("공백과 대소문자, 꼬리말을 정리합니다", () => {
    expect(normalizeQuery("  변호사가 되고 싶어요! ")).toBe("변호사");
    expect(normalizeQuery("CPA")).toBe("cpa");
    expect(normalizeQuery("판사 되려면")).toBe("판사");
  });
});

describe("searchOccupations", () => {
  const slug = (q: string) => searchOccupations(q, LIST).match?.slug ?? null;
  it("별칭으로 찾습니다", () => {
    expect(slug("CPA")).toBe("accountant");
    expect(slug("cpa")).toBe("accountant");
    expect(slug("화이트해커")).toBe("security-specialist");
    expect(slug("화이트 해커")).toBe("security-specialist");
    expect(slug("법관")).toBe("judge");
  });
  it("문장형 검색어도 찾습니다", () => {
    expect(slug("변호사가 되고 싶어요")).toBe("lawyer");
    expect(slug("데이터 분석가가 되고 싶어요")).toBe("data-analyst");
    expect(slug("데이터 분석가 되고 싶어요")).toBe("data-analyst");
    expect(slug("AI 엔지니어가 되려면")).toBe("ai-engineer");
  });
  it("가장 구체적인 별칭을 우선합니다", () => {
    expect(slug("인공지능 개발자")).toBe("ai-engineer");
    expect(slug("개발자")).toBe("software-developer");
  });
  it("없는 직업은 null", () => {
    expect(searchOccupations("우주비행사", LIST).match).toBeNull();
    expect(searchOccupations("", LIST).candidates).toEqual([]);
  });
});
