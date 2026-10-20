"use client";

import { useSyncExternalStore } from "react";

import { readActiveNamespace, subscribeNamespace } from "./api";

export function useNamespace(): string {
  return useSyncExternalStore(
    subscribeNamespace,
    readActiveNamespace,
    () => "default",
  );
}
