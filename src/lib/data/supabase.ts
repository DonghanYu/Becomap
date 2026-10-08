// 기본 백엔드: Supabase(PostgREST)를 anon 키로 호출합니다. RLS와 뷰 권한이 그대로 적용됩니다.
import { createClient } from "@supabase/supabase-js";
import type { GateStat, GraphLink, GraphNode, Occupation } from "../types";
import type { PublicDataSource } from "./index";

export function createSupabaseSource(): PublicDataSource {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) {
    throw new Error("NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY가 설정되지 않았습니다(.env.local).");
  }
  const db = createClient(url, key, { auth: { persistSession: false } });

  const must = <T>(res: { data: T | null; error: { message: string } | null }): T => {
    if (res.error) throw new Error(res.error.message);
    return res.data as T;
  };

  return {
    async listOccupations() {
      return must<Occupation[]>(
        await db.from("occupations").select("id, slug, name_ko, grp, aliases, sort_order").order("sort_order"),
      );
    },
    async getGraph(slug) {
      const occ = must<Occupation[]>(
        await db.from("occupations").select("id, slug, name_ko, grp, aliases, sort_order").eq("slug", slug).limit(1),
      );
      const occupation = occ[0];
      if (!occupation) return null;
      const [totals, nodes, links] = await Promise.all([
        db.from("occupation_totals").select("contributors, has_synthetic").eq("occupation_id", occupation.id),
        db.from("node_agg")
          .select("node_id, stage, label_type, is_gate, description, contributors")
          .eq("occupation_id", occupation.id),
        db.from("flow_agg").select("from_node, to_node, contributors").eq("occupation_id", occupation.id),
      ]);
      const total = must<{ contributors: number; has_synthetic: boolean }[]>(totals)[0];
      const nodeRows = must<GraphNode[]>(nodes);
      const gateIds = nodeRows.filter((n) => n.is_gate).map((n) => n.node_id);
      const gateStats = gateIds.length
        ? must<GateStat[]>(
            await db.from("gate_stats")
              .select("node_id, year, metric, value, source_url, note")
              .in("node_id", gateIds)
              .order("id"),
          )
        : [];
      return {
        occupation,
        total: total?.contributors ?? null,
        hasSynthetic: total?.has_synthetic ?? false,
        nodes: nodeRows,
        links: must<GraphLink[]>(links),
        gateStats: gateStats.map((g) => ({ ...g, value: g.value === null ? null : Number(g.value) })),
      };
    },
  };
}
