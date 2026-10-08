/** 경로 입력기의 순수 함수(순서 변경·삭제) */
export function moveItem<T>(items: T[], index: number, delta: -1 | 1): T[] {
  const to = index + delta;
  if (index < 0 || index >= items.length || to < 0 || to >= items.length) return items;
  const next = [...items];
  const [it] = next.splice(index, 1);
  next.splice(to, 0, it as T);
  return next;
}

export function removeItem<T>(items: T[], index: number): T[] {
  return items.filter((_, i) => i !== index);
}

export function validatePath(steps: { node_id: number | null }[]): string | null {
  if (steps.length === 0) return "단계를 하나 이상 추가해 주세요.";
  if (steps.length > 20) return "단계는 최대 20개까지 입력할 수 있어요.";
  if (steps.some((s) => !s.node_id)) return "모든 단계에서 마디를 골라 주세요.";
  return null;
}
