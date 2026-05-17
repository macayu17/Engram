"use client";

import { Show, SignInButton, SignUpButton, UserButton } from "@clerk/nextjs";


export function AuthControls({ enabled }: { enabled: boolean }) {
  if (!enabled) {
    return null;
  }
  return (
    <>
      <Show when="signed-out">
        <SignInButton>
          <button type="button" className="hover:text-signal">
            Sign In
          </button>
        </SignInButton>
        <SignUpButton>
          <button type="button" className="border border-line px-3 py-2 text-ink hover:border-signal hover:text-signal">
            Create Account
          </button>
        </SignUpButton>
      </Show>
      <Show when="signed-in">
        <UserButton />
      </Show>
    </>
  );
}
