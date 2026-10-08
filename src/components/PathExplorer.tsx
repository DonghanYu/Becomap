"use client";

import { sankey, sankeyLeft, sankeyLinkHorizontal, type SankeyLink, type SankeyNode } from "d3-sankey";
import { useMemo, useState } from "react";
import { formatGateStats } from "@/lib/gateStats";
import {
  CURRENT_POSITIONS,
  breakCycles,
  coarseShare,
  destinationCandidates,
  type CurrentPositionKey,
} from "@/lib/graph";
import { STAGE_LABEL } from "@/lib/stages";
import type { GraphNode, OccupationGraph } from "@/lib/types";

type NodeDatum = { id: number; node: GraphNode };
type LinkDatum = { value: number };
type LaidNode = SankeyNode<NodeDatum, LinkDatum>;
type LaidLink = SankeyLink<NodeDatum, LinkDatum>;

const COL_WIDTH = 150;
const NODE_WIDTH = 12;

function layout(graph: OccupationGraph) {
  const { kept, dropped } = breakCycles(graph.links);
  const used = new Set(kept.flatMap((l) => [l.from_node, l.to_node]));
  const nodes = graph.nodes.filter((n) => used.has(n.node_id));
  const build = (width: number, height: number) =>
    sankey<NodeDatum, LinkDatum>()
      .nodeId((d) => d.id)
      .nodeAlign(sankeyLeft)
      .nodeWidth(NODE_WIDTH)
      .nodePadding(22)
      .extent([
        [4, 8],
        [width - 4, height - 8],
      ])({
      nodes: nodes.map((n) => ({ id: n.node_id, node: n })),
      links: kept.map((l) => ({ source: l.from_node, target: l.to_node, value: l.contributors })),
    });

  const probe = build(1000, 600);
  const columns = Math.max(...probe.nodes.map((n) => n.depth ?? 0)) + 1;
  const perColumn = new Map<number, number>();
  probe.nodes.forEach((n) => perColumn.set(n.depth ?? 0, (perColumn.get(n.depth ?? 0) ?? 0) + 1));
  const maxInColumn = Math.max(...perColumn.values());
  const width = Math.max(640, columns * COL_WIDTH);
  const height = Math.max(320, maxInColumn * 70);
  const result = build(width, height);
  return { ...result, width, height, columns, droppedCount: dropped.length, kept };
}

export function PathExplorer({ graph }: { graph: OccupationGraph }) {
  const total = graph.total ?? 0;
  const laid = useMemo(() => layout(graph), [graph]);
  const [position, setPosition] = useState<CurrentPositionKey | null>(null);
  const [selectedId, setSelectedId] = useState<number | null>(null);

  const candidates = useMemo(
    () => (position ? destinationCandidates(graph.nodes, laid.kept, position) : []),
    [graph.nodes, laid.kept, position],
  );
  const destination = candidates[0] ?? null;
  const others = candidates.slice(1, 4);
  const selected = graph.nodes.find((n) => n.node_id === selectedId) ?? null;
  const linkPath = sankeyLinkHorizontal<NodeDatum, LinkDatum>();

  return (
    <div className="space-y-5">
      <section aria-labelledby="now-label" className="rounded-xl border border-line bg-white p-4">
        <h2 id="now-label" className="mb-3 font-semibold">
          지금 나는
        </h2>
        <div role="radiogroup" aria-labelledby="now-label" className="flex flex-wrap gap-2">
          {CURRENT_POSITIONS.map((p) => (
            <button
              key={p.key}
              type="button"
              role="radio"
              aria-checked={position === p.key}
              onClick={() => setPosition(p.key)}
              className={`rounded-full border px-4 py-1.5 text-sm ${
                position === p.key ? "border-brand bg-brand text-white" : "border-line bg-white hover:border-brand"
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>
        {position && (
          <div className="mt-4" aria-live="polite">
            {destination ? (
              <div data-testid="destination" className="rounded-lg bg-brand-soft p-3">
                <p className="text-xs font-semibold text-brand">다음 단기 목적지</p>
                <button
                  type="button"
                  onClick={() => setSelectedId(destination.node.node_id)}
                  className="mt-1 text-left text-lg font-bold underline-offset-2 hover:underline"
                >
                  {destination.node.label_type}
                </button>
                <p className="mt-1 text-sm text-muted">
                  지금 단계 다음에 가장 많은 종사자가 바로 거친 마디예요(종사자 {destination.inflow}명). 정답이라는
                  뜻은 아닙니다.
                </p>
                {others.length > 0 && (
                  <p className="mt-2 text-sm">
                    <span className="text-muted">다른 갈래: </span>
                    {others.map((o, i) => (
                      <span key={o.node.node_id}>
                        {i > 0 && ", "}
                        <button
                          type="button"
                          onClick={() => setSelectedId(o.node.node_id)}
                          className="underline-offset-2 hover:underline"
                        >
                          {o.node.label_type}
                        </button>{" "}
                        <span className="text-muted">({o.inflow}명)</span>
                      </span>
                    ))}
                  </p>
                )}
              </div>
            ) : (
              <p className="text-sm text-muted">이 단계 이후로 공개 기준을 넘는 마디가 없어요.</p>
            )}
          </div>
        )}
      </section>

      <section aria-label="경로 그래프" className="rounded-xl border border-line bg-white p-2">
        <div className="overflow-x-auto">
          <svg
            width={laid.width}
            height={laid.height}
            viewBox={`0 0 ${laid.width} ${laid.height}`}
            role="img"
            aria-label={`${graph.occupation.name_ko} 경로 그래프`}
          >
            <g fill="none">
              {(laid.links as LaidLink[]).map((l, i) => {
                const s = l.source as LaidNode;
                const t = l.target as LaidNode;
                const hot = destination && t.id === destination.node.node_id;
                return (
                  <path
                    key={i}
                    d={linkPath(l) ?? undefined}
                    stroke={hot ? "var(--color-accent)" : "var(--color-brand)"}
                    strokeOpacity={hot ? 0.55 : 0.22}
                    strokeWidth={Math.max(1, l.width ?? 1)}
                  >
                    <title>{`${s.node.label_type} → ${t.node.label_type}: ${l.value}명`}</title>
                  </path>
                );
              })}
            </g>
            {(laid.nodes as LaidNode[]).map((n) => {
              const x0 = n.x0 ?? 0;
              const x1 = n.x1 ?? 0;
              const y0 = n.y0 ?? 0;
              const y1 = n.y1 ?? 0;
              const isDest = destination?.node.node_id === n.id;
              const isSel = selectedId === n.id;
              const lastCol = (n.depth ?? 0) === laid.columns - 1;
              return (
                <g
                  key={n.id}
                  onClick={() => setSelectedId(n.id)}
                  className="cursor-pointer"
                  role="button"
                  tabIndex={0}
                  aria-label={`${n.node.label_type}, ${n.node.contributors}명`}
                  onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && setSelectedId(n.id)}
                >
                  <rect
                    x={x0}
                    y={y0}
                    width={x1 - x0}
                    height={Math.max(2, y1 - y0)}
                    rx={2}
                    fill={isDest ? "var(--color-accent)" : n.node.is_gate ? "#1d2433" : "var(--color-brand)"}
                    stroke={isSel ? "var(--color-accent)" : "none"}
                    strokeWidth={3}
                  />
                  <text
                    x={lastCol ? x0 - 6 : x1 + 6}
                    y={(y0 + y1) / 2}
                    dy="0.35em"
                    textAnchor={lastCol ? "end" : "start"}
                    fontSize={12}
                    fontWeight={isDest ? 700 : 400}
                    fill="var(--color-ink)"
                  >
                    {n.node.is_gate ? "◆ " : ""}
                    {n.node.label_type}
                  </text>
                </g>
              );
            })}
          </svg>
        </div>
        <p className="px-2 pb-1 pt-2 text-xs text-muted">
          {laid.width > 640 && "좌우로 밀어 전체 경로를 볼 수 있어요. "}
          선의 굵기 = 그 길을 지난 종사자 수. ◆는 관문(시험·전형)입니다. 마디를 누르면 자세히 볼 수 있어요.
          {laid.droppedCount > 0 && ` 그래프로 그릴 수 없는 순환 흐름 ${laid.droppedCount}개는 생략했습니다.`}
        </p>
      </section>

      {selected && <NodePanel node={selected} total={total} graph={graph} onClose={() => setSelectedId(null)} />}

      <details className="rounded-xl border border-line bg-white p-4 text-sm">
        <summary className="cursor-pointer font-semibold">마디 목록으로 보기</summary>
        <ul className="mt-3 space-y-1">
          {[...graph.nodes]
            .sort((a, b) => b.contributors - a.contributors)
            .map((n) => (
              <li key={n.node_id}>
                <button type="button" onClick={() => setSelectedId(n.node_id)} className="hover:text-brand">
                  {n.label_type}
                </button>{" "}
                <span className="text-muted">— {coarseShare(n.contributors, total)}</span>
              </li>
            ))}
        </ul>
      </details>
    </div>
  );
}

function NodePanel({
  node,
  total,
  graph,
  onClose,
}: {
  node: GraphNode;
  total: number;
  graph: OccupationGraph;
  onClose: () => void;
}) {
  const stats = formatGateStats(graph.gateStats.filter((g) => g.node_id === node.node_id));
  return (
    <section
      aria-labelledby="panel-title"
      data-testid="node-panel"
      className="rounded-xl border border-brand/40 bg-white p-4 shadow-sm"
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs text-muted">{STAGE_LABEL[node.stage]}</p>
          <h2 id="panel-title" className="text-lg font-bold">
            {node.label_type}
          </h2>
        </div>
        <button type="button" onClick={onClose} className="text-sm text-muted hover:text-ink" aria-label="닫기">
          닫기
        </button>
      </div>
      <p className="mt-2 text-sm">{node.description ?? "설명을 준비하고 있어요."}</p>
      <p className="mt-2 text-sm">
        이 직업 종사자 중 <strong>{coarseShare(node.contributors, total)}</strong>가 거쳤어요.
        <span className="text-muted"> (표본 {total}명 기준, 5% 단위 반올림)</span>
      </p>
      {node.is_gate && (
        <div className="mt-3 rounded-lg bg-paper p-3 text-sm">
          <h3 className="mb-1 font-semibold">공식 통계</h3>
          {stats.pending ? (
            <p data-testid="gate-pending">공식 통계 확인 중</p>
          ) : (
            <ul className="space-y-1">
              {stats.numeric.map((s, i) => (
                <li key={i}>
                  {s.year ? `${s.year}년 ` : ""}
                  {s.label}: <strong>{s.text}</strong>{" "}
                  <a href={s.source_url} target="_blank" rel="noopener noreferrer" className="text-brand underline">
                    출처
                  </a>
                </li>
              ))}
            </ul>
          )}
          {stats.notes.map((n, i) => (
            <p key={i} className="mt-1 text-muted">
              {n.text}{" "}
              {n.source_url && (
                <a href={n.source_url} target="_blank" rel="noopener noreferrer" className="text-brand underline">
                  출처
                </a>
              )}
            </p>
          ))}
        </div>
      )}
    </section>
  );
}
