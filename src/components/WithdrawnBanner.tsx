"use client";

import { useEffect, useState } from "react";

/** 철회 직후(/?withdrawn=1) 안내. 정적 빌드와도 호환되도록 브라우저에서 주소를 읽습니다. */
export function WithdrawnBanner() {
  const [show, setShow] = useState(false);
  useEffect(() => {
    setShow(new URLSearchParams(window.location.search).has("withdrawn"));
  }, []);
  if (!show) return null;
  return (
    <p role="status" className="rounded-xl bg-brand-soft p-4 text-sm">
      동의를 철회했어요. 기여자 정보와 경로가 모두 삭제되었습니다.
    </p>
  );
}
