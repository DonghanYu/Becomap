export type Stage = "high_school" | "undergrad" | "grad" | "prep" | "gate" | "first_job" | "career";
export type Group = "A_전문직" | "B_기술직";
export type Visibility = "aggregate_only" | "public";

export interface Occupation {
  id: number;
  slug: string;
  name_ko: string;
  grp: Group;
  aliases: string[];
  sort_order: number;
}

/** node_agg 뷰의 한 행(표본 기준을 통과한 마디) */
export interface GraphNode {
  node_id: number;
  stage: Stage;
  label_type: string;
  is_gate: boolean;
  description: string | null;
  contributors: number;
}

/** flow_agg 뷰의 한 행(표본 기준을 통과한 간선) */
export interface GraphLink {
  from_node: number;
  to_node: number;
  contributors: number;
}

export interface GateStat {
  node_id: number;
  year: number | null;
  metric: string;
  value: number | null;
  source_url: string | null;
  note: string | null;
}

export interface OccupationGraph {
  occupation: Occupation;
  /** 직업 전체 기여자 수. 표본 기준 미만이면 null(그래프 비공개) */
  total: number | null;
  hasSynthetic: boolean;
  nodes: GraphNode[];
  links: GraphLink[];
  gateStats: GateStat[];
}
