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
          <button type="button" className="rounded-md border border-line bg-panel px-3 py-2 text-sm font-medium text-ink hover:border-signal hover:text-signal">
            Sign in
          </button>
        </SignInButton>
      </Show>
      <Show when="signed-in">
        <UserButton />
      </Show>
    </>
  );
}
