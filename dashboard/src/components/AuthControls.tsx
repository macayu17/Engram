"use client";

import { Show, SignInButton, UserButton } from "@clerk/nextjs";

export function AuthControls({ enabled }: { enabled: boolean }) {
  if (!enabled) {
    return null;
  }
  return (
    <>
      <Show when="signed-out">
        <SignInButton mode="modal">
          <button type="button" className="min-h-9 rounded-full border border-line px-3.5 font-sans text-[11px] font-semibold uppercase tracking-[0.1em] text-ink transition hover:border-signal hover:text-signal focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-signal">
            Sign In
          </button>
        </SignInButton>
      </Show>
      <Show when="signed-in">
        <UserButton />
      </Show>
    </>
  );
}
