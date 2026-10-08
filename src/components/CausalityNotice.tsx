/** 결과 화면 상시 고지 */
export function CausalityNotice() {
  return (
    <p role="note" className="rounded-xl border border-accent/30 bg-accent-soft px-4 py-3 text-sm leading-relaxed">
      <strong>경로 빈도는 인과가 아닙니다.</strong> 많은 종사자가 지나간 길이 정답이거나 필수 조건이라는 뜻이
      아닙니다. 관문의 공식 통과율과 함께 참고해 주세요.
    </p>
  );
}
