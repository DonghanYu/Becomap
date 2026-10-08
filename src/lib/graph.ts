import type { GraphLink, GraphNode, Stage } from "./types";

/**
 * d3-sankey는 순환이 있으면 그릴 수 없으므로, 굵은 간선부터 넣으면서 순환을 만드는 간선만 제외합니다.
 * (표본 기준 필터는 DB에서 이미 끝났고, 이 함수는 그리기 가능 여부만 다룹니다.)
 */
export function breakCycles(links: GraphLink[]): { kept: GraphLink[]; dropped: GraphLink[] } {
  const sorted = [...links].sort(
    (a, b) => b.contributors - a.contributors || a.from_node - b.from_node || a.to_node - b.to_node,
  );
  const adj = new Map<number, number[]>();
  const reaches = (from: number, target: number): boolean => {
    const stack = [from];
    const seen = new Set<number>();
    while (stack.length) {
      const n = stack.pop()!;
      if (n === target) return true;
      if (seen.has(n)) continue;
      seen.add(n);
      for (const m of adj.get(n) ?? []) stack.push(m);
    }
    return false;
  };
  const kept: GraphLink[] = [];
  const dropped: GraphLink[] = [];
  for (const l of sorted) {
    if (l.from_node === l.to_node || reaches(l.to_node, l.from_node)) {
      dropped.push(l);
      continue;
    }
    adj.set(l.from_node, [...(adj.get(l.from_node) ?? []), l.to_node]);
    kept.push(l);
  }
  return { kept, dropped };
}

/** "지금 나는" 선택지와, 이미 지난 것으로 보는 단계 유형 */
export const CURRENT_POSITIONS = [
  { key: "high_school", label: "고교생", done: ["high_school"] },
  { key: "undergrad", label: "대학생(학부)", done: ["high_school", "undergrad"] },
  { key: "graduated", label: "졸업 후", done: ["high_school", "undergrad", "grad"] },
] as const satisfies readonly { key: string; label: string; done: readonly Stage[] }[];

export type CurrentPositionKey = (typeof CURRENT_POSITIONS)[number]["key"];

export interface Destination {
  node: GraphNode;
  /** 지난 단계에서 이 마디로 바로 이어진 종사자 수(간선 굵기 합) */
  inflow: number;
}

/**
 * 다음 단기 목적지 후보: 이미 지난 단계 유형의 마디에서 바로 이어지는 "아직 지나지 않은" 마디들을
 * 들어오는 흐름(간선 굵기 합)이 큰 순서로 정렬합니다. 동률이면 마디 전체 표본이 큰 쪽, 그다음 id 순.
 * 첫 번째 후보가 "다음 단기 목적지"입니다.
 */
export function destinationCandidates(
  nodes: GraphNode[],
  links: GraphLink[],
  position: CurrentPositionKey,
): Destination[] {
  const pos = CURRENT_POSITIONS.find((p) => p.key === position);
  if (!pos) return [];
  const done = new Set<Stage>(pos.done);
  const byId = new Map(nodes.map((n) => [n.node_id, n]));
  const inflow = new Map<number, number>();
  for (const l of links) {
    const from = byId.get(l.from_node);
    const to = byId.get(l.to_node);
    if (!from || !to) continue;
    if (done.has(from.stage) && !done.has(to.stage)) {
      inflow.set(to.node_id, (inflow.get(to.node_id) ?? 0) + l.contributors);
    }
  }
  return [...inflow]
    .map(([id, flow]) => ({ node: byId.get(id)!, inflow: flow }))
    .sort(
      (a, b) =>
        b.inflow - a.inflow || b.node.contributors - a.node.contributors || a.node.node_id - b.node.node_id,
    );
}

export function nextDestination(
  nodes: GraphNode[],
  links: GraphLink[],
  position: CurrentPositionKey,
): Destination | null {
  return destinationCandidates(nodes, links, position)[0] ?? null;
}

/** 거친 비율 표시: 5% 단위로 반올림해 개인을 특정하기 어려운 수준으로 보여줍니다. */
export function coarseShare(part: number, total: number): string {
  if (total <= 0) return "—";
  const pct = (part / total) * 100;
  if (pct >= 95) return "대부분(95% 이상)";
  if (pct < 5) return "5% 미만";
  return `약 ${Math.round(pct / 5) * 5}%`;
}
