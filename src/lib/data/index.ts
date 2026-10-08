// 공개 집계 데이터 읽기 계층(서버 전용).
// 어떤 백엔드든 DB의 집계 뷰(occupation_totals, node_agg, flow_agg)만 읽으므로
// 표본 기준(MIN_SAMPLE) 필터는 항상 DB에서 적용됩니다.
import type { Occupation, OccupationGraph } from "../types";

export interface PublicDataSource {
  listOccupations(): Promise<Occupation[]>;
  getGraph(slug: string): Promise<OccupationGraph | null>;
}

let cached: PublicDataSource | null = null;

export async function publicData(): Promise<PublicDataSource> {
  if (cached) return cached;
  if (process.env.DATA_BACKEND === "postgres") {
    const { createPgSource } = await import("./pg");
    cached = createPgSource(process.env.DATABASE_URL ?? "");
  } else {
    const { createSupabaseSource } = await import("./supabase");
    cached = createSupabaseSource();
  }
  return cached;
}
