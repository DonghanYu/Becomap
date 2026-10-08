// 로컬·CI 전용 백엔드: Postgres에 직접 연결하되, 매 쿼리를 anon 역할로 실행해
// Supabase API와 같은 권한(집계 뷰와 공개 참조 테이블만)으로 읽습니다.
import postgres from "postgres";
import type { GateStat, GraphLink, GraphNode, Occupation } from "../types";
import type { PublicDataSource } from "./index";

export function createPgSource(url: string): PublicDataSource {
  if (!url) throw new Error("DATA_BACKEND=postgres에는 DATABASE_URL이 필요합니다.");
  const sql = postgres(url, { max: 5, onnotice: () => {} });

  const asAnon = <T>(fn: (tx: postgres.TransactionSql) => Promise<T>) =>
    sql.begin(async (tx) => {
      await tx`set local role anon`;
      return fn(tx);
    }) as Promise<T>;

  return {
    listOccupations: () =>
      asAnon((tx) => tx<Occupation[]>`
        select id, slug, name_ko, grp, aliases, sort_order from public.occupations order by sort_order`),

    getGraph: (slug) =>
      asAnon(async (tx) => {
        const [occupation] = await tx<Occupation[]>`
          select id, slug, name_ko, grp, aliases, sort_order from public.occupations where slug = ${slug}`;
        if (!occupation) return null;
        const [total] = await tx<{ contributors: number; has_synthetic: boolean }[]>`
          select contributors, has_synthetic from public.occupation_totals where occupation_id = ${occupation.id}`;
        const nodes = await tx<GraphNode[]>`
          select node_id, stage, label_type, is_gate, description, contributors
          from public.node_agg where occupation_id = ${occupation.id}`;
        const links = await tx<GraphLink[]>`
          select from_node, to_node, contributors from public.flow_agg where occupation_id = ${occupation.id}`;
        const gateIds = nodes.filter((n) => n.is_gate).map((n) => n.node_id);
        const gateStats = gateIds.length
          ? await tx<GateStat[]>`
              select node_id, year, metric, value::float8 as value, source_url, note
              from public.gate_stats where node_id in ${tx(gateIds)} order by id`
          : [];
        return {
          occupation,
          total: total?.contributors ?? null,
          hasSynthetic: total?.has_synthetic ?? false,
          nodes: [...nodes],
          links: [...links],
          gateStats: [...gateStats],
        };
      }),
  };
}
