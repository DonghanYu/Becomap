"use client";

import { useMemo, useState, useTransition } from "react";
import { moveItem, removeItem, validatePath } from "@/lib/pathEditor";
import { STAGES, STAGE_LABEL, yearBuckets } from "@/lib/stages";
import type { Stage, Visibility } from "@/lib/types";
import { proposeNode, saveMyPath } from "./actions";

export interface EditorNode {
  id: number;
  stage: Stage;
  label_type: string;
  approved: boolean;
}

interface Row {
  key: number;
  stage: Stage;
  node_id: number | null;
  start_year_bucket: string | null;
  visibility: Visibility;
}

const BUCKETS = yearBuckets();
let keySeq = 0;

export function PathEditor({
  nodes: initialNodes,
  initialSteps,
}: {
  nodes: EditorNode[];
  initialSteps: { node_id: number; start_year_bucket: string | null; visibility: Visibility }[];
}) {
  const [nodes, setNodes] = useState(initialNodes);
  const byId = useMemo(() => new Map(nodes.map((n) => [n.id, n])), [nodes]);
  const [rows, setRows] = useState<Row[]>(() =>
    initialSteps.map((s) => ({
      key: ++keySeq,
      stage: byId.get(s.node_id)?.stage ?? "high_school",
      node_id: s.node_id,
      start_year_bucket: s.start_year_bucket,
      visibility: s.visibility,
    })),
  );
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, startTransition] = useTransition();
  const [proposal, setProposal] = useState<{ row: number; label: string } | null>(null);

  const update = (i: number, patch: Partial<Row>) =>
    setRows((rs) => rs.map((r, j) => (j === i ? { ...r, ...patch } : r)));

  const addRow = () =>
    setRows((rs) => [
      ...rs,
      {
        key: ++keySeq,
        stage: rs.length === 0 ? "high_school" : (rs.at(-1)?.stage ?? "high_school"),
        node_id: null,
        start_year_bucket: rs.at(-1)?.start_year_bucket ?? null,
        visibility: "aggregate_only",
      },
    ]);

  const save = () => {
    const err = validatePath(rows);
    if (err) return setMessage({ ok: false, text: err });
    startTransition(async () => {
      const res = await saveMyPath(
        rows.map((r) => ({ node_id: r.node_id!, start_year_bucket: r.start_year_bucket, visibility: r.visibility })),
      );
      setMessage({ ok: res.ok, text: res.message });
    });
  };

  const submitProposal = (i: number) => {
    if (!proposal) return;
    const row = rows[i]!;
    startTransition(async () => {
      const res = await proposeNode(row.stage, proposal.label);
      if (!res.ok) return setMessage({ ok: false, text: res.message });
      if (!byId.has(res.id)) {
        setNodes((ns) => [...ns, { id: res.id, stage: row.stage, label_type: proposal.label.trim(), approved: false }]);
      }
      update(i, { node_id: res.id });
      setProposal(null);
      setMessage({ ok: true, text: "새 마디를 제안했어요. 관리자 승인 후 그래프에 반영됩니다." });
    });
  };

  return (
    <section className="space-y-4">
      <p className="text-sm text-muted">
        고교부터 지금까지 거친 단계를 순서대로 입력해 주세요. 기관명 대신 유형으로 고르고, 연도는 5년 구간으로만
        저장합니다.
      </p>
      <ol className="space-y-3">
        {rows.map((r, i) => {
          const options = nodes.filter((n) => n.stage === r.stage);
          return (
            <li key={r.key} className="rounded-xl border border-line bg-white p-4">
              <div className="mb-2 flex items-center justify-between">
                <span className="text-sm font-semibold">{i + 1}단계</span>
                <div className="flex gap-1 text-sm">
                  <button type="button" aria-label="위로" onClick={() => setRows((rs) => moveItem(rs, i, -1))}
                    className="rounded border border-line px-2 disabled:opacity-30" disabled={i === 0}>↑</button>
                  <button type="button" aria-label="아래로" onClick={() => setRows((rs) => moveItem(rs, i, 1))}
                    className="rounded border border-line px-2 disabled:opacity-30" disabled={i === rows.length - 1}>↓</button>
                  <button type="button" onClick={() => setRows((rs) => removeItem(rs, i))}
                    className="rounded border border-line px-2 text-red-700">삭제</button>
                </div>
              </div>
              <div className="grid gap-2 sm:grid-cols-2">
                <label className="text-sm">
                  <span className="text-muted">단계 유형</span>
                  <select value={r.stage} onChange={(e) => update(i, { stage: e.target.value as Stage, node_id: null })}
                    className="mt-1 w-full rounded-lg border border-line px-2 py-2">
                    {STAGES.map((s) => (
                      <option key={s} value={s}>{STAGE_LABEL[s]}</option>
                    ))}
                  </select>
                </label>
                <label className="text-sm">
                  <span className="text-muted">마디</span>
                  <select value={r.node_id ?? ""} onChange={(e) => update(i, { node_id: Number(e.target.value) || null })}
                    className="mt-1 w-full rounded-lg border border-line px-2 py-2">
                    <option value="">선택</option>
                    {options.map((n) => (
                      <option key={n.id} value={n.id}>
                        {n.label_type}
                        {n.approved ? "" : " (승인 대기)"}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="text-sm">
                  <span className="text-muted">시작 연도(5년 구간)</span>
                  <select value={r.start_year_bucket ?? ""}
                    onChange={(e) => update(i, { start_year_bucket: e.target.value || null })}
                    className="mt-1 w-full rounded-lg border border-line px-2 py-2">
                    <option value="">선택 안 함</option>
                    {BUCKETS.map((b) => (
                      <option key={b} value={b}>{b}</option>
                    ))}
                  </select>
                </label>
                <label className="text-sm">
                  <span className="text-muted">공개 범위</span>
                  <select value={r.visibility} onChange={(e) => update(i, { visibility: e.target.value as Visibility })}
                    className="mt-1 w-full rounded-lg border border-line px-2 py-2">
                    <option value="aggregate_only">집계에만 사용(기본)</option>
                    <option value="public">공개 동의</option>
                  </select>
                </label>
              </div>
              {proposal?.row === r.key ? (
                <div className="mt-2 flex gap-2">
                  <input value={proposal.label} onChange={(e) => setProposal({ row: r.key, label: e.target.value })}
                    placeholder="예: 학원-편입 준비" maxLength={60}
                    className="min-w-0 flex-1 rounded-lg border border-line px-2 py-1 text-sm" />
                  <button type="button" onClick={() => submitProposal(i)} className="rounded-lg bg-ink px-3 text-sm text-white">
                    제안
                  </button>
                  <button type="button" onClick={() => setProposal(null)} className="text-sm text-muted">취소</button>
                </div>
              ) : (
                <button type="button" onClick={() => setProposal({ row: r.key, label: "" })}
                  className="mt-2 text-xs text-muted underline">
                  목록에 없어요(유형 이름 제안)
                </button>
              )}
            </li>
          );
        })}
      </ol>
      <div className="flex gap-2">
        <button type="button" onClick={addRow} className="rounded-xl border border-line bg-white px-4 py-2">
          + 단계 추가
        </button>
        <button type="button" onClick={save} disabled={pending}
          className="flex-1 rounded-xl bg-brand px-4 py-2 text-white disabled:opacity-60">
          {pending ? "저장 중…" : "경로 저장"}
        </button>
      </div>
      {message && (
        <p role="status" className={message.ok ? "text-sm text-brand" : "text-sm text-red-700"}>
          {message.text}
        </p>
      )}
    </section>
  );
}
