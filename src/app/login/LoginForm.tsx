"use client";

import { useActionState } from "react";
import { sendLoginLink, type LoginState } from "./actions";

export function LoginForm({ next }: { next: string }) {
  const [state, action, pending] = useActionState<LoginState, FormData>(sendLoginLink, null);
  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="next" value={next} />
      <label className="block text-sm font-medium" htmlFor="email">
        이메일
      </label>
      <input
        id="email"
        name="email"
        type="email"
        required
        autoComplete="email"
        className="w-full rounded-xl border border-line bg-white px-4 py-3"
      />
      <button
        type="submit"
        disabled={pending}
        className="w-full rounded-xl bg-brand py-3 text-white disabled:opacity-60"
      >
        {pending ? "보내는 중…" : "로그인 링크 받기"}
      </button>
      {state && (
        <p role="status" className={state.ok ? "text-sm text-brand" : "text-sm text-red-700"}>
          {state.message}
        </p>
      )}
    </form>
  );
}
