"use client";

import { Show, SignInButton, UserButton } from "@clerk/nextjs";
import Link from "next/link";

export function AuthControls({ enabled, showDashboardLink = false }: { enabled: boolean; showDashboardLink?: boolean }) {
  if (!enabled) {
    return null;
  }
  return (
    <>
      <Show when="signed-out">
        <SignInButton mode="modal" forceRedirectUrl="/overview">
          <button type="button" className="min-h-9 rounded-sm border border-line px-3.5 font-sans text-xs font-semibold text-ink transition hover:border-signal hover:text-signal focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-signal">
            Sign In
          </button>
        </SignInButton>
      </Show>
      <Show when="signed-in">
        <div className="flex items-center gap-2">
          {showDashboardLink && (
            <Link href="/overview" className="inline-flex min-h-9 items-center rounded-sm border border-line px-3.5 font-sans text-xs font-semibold text-ink transition hover:border-signal hover:text-signal focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-signal active:translate-y-px">
              Dashboard
            </Link>
          )}
          <UserButton />
        </div>
      </Show>
    </>
  );
}
