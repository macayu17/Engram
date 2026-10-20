"use client";

import { useSyncExternalStore } from "react";

import { readActiveApiKey, subscribeActiveApiKey } from "@/lib/api";

export function useActiveApiKey(): string {
  return useSyncExternalStore(
    subscribeActiveApiKey,
    readActiveApiKey,
    () => "",
  );
}
