/** 받침 유무에 따라 "이/가"를 고릅니다. */
export function iGa(word: string): "이" | "가" {
  const last = word.trim().at(-1);
  if (!last) return "가";
  const code = last.charCodeAt(0) - 0xac00;
  if (code < 0 || code > 11171) return "가";
  return code % 28 === 0 ? "가" : "이";
}
