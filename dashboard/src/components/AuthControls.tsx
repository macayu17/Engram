"use client";

import { Show, SignInButton, SignUpButton, UserButton } from "@clerk/nextjs";

export function AuthControls({ enabled }: { enabled: boolean }) {
  if (!enabled) {
    return null;
  }
  return (
    <>
      <Show when="signed-out">
        <div className="flex items-center gap-3">
          <SignInButton>
            <button type="button" className="text-muted hover:text-signal">
              Sign In
            </button>
          </SignInButton>
          <SignUpButton>
            <button type="button" className="hidden border border-line px-3 py-2 text-ink hover:border-signal hover:text-signal xl:inline-flex">
              Join
            </button>
          </SignUpButton>
        </div>
      </Show>
      <Show when="signed-in">
        <UserButton />
      </Show>
    </>
  );
}
