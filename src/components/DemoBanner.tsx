import { IS_STATIC_DEMO } from "@/lib/mode";

export function DemoBanner() {
  if (!IS_STATIC_DEMO) return null;
  return (
    <div className="bg-ink px-4 py-2 text-center text-xs text-white">
      읽기 전용 데모 — 모든 경로는 합성(가상) 데이터이며 실제 종사자 통계가 아닙니다.
    </div>
  );
}
