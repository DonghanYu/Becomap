"use client";

import { withdraw } from "./actions";

export function WithdrawButton() {
  return (
    <form
      action={withdraw}
      onSubmit={(e) => {
        if (!confirm("내 경로와 기여자 정보를 모두 삭제할까요? 되돌릴 수 없습니다.")) e.preventDefault();
      }}
    >
      <button type="submit" className="mt-3 rounded-lg border border-red-300 px-4 py-2 text-sm text-red-700">
        동의 철회 및 전체 삭제
      </button>
    </form>
  );
}
