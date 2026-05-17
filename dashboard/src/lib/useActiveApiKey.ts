"use client";

import { useEffect, useState } from "react";

import { readActiveApiKey, subscribeActiveApiKey } from "@/lib/api";


export function useActiveApiKey(): string {
  const [apiKey, setApiKey] = useState(readActiveApiKey);

  useEffect(
    () =>
      subscribeActiveApiKey(() => {
        setApiKey(readActiveApiKey());
      }),
    [],
  );

  return apiKey;
}
