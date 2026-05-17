"use client";

import { useUser } from "@clerk/nextjs";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";

import {
  api,
  clearActiveApiKey,
  clearClerkApiKey,
  readActiveApiKey,
  readClerkApiKey,
  setActiveApiKey,
  setClerkApiKey,
  subscribeActiveApiKey,
} from "@/lib/api";

type ClerkEngramKey = {
  apiKey: string;
  externalId: string;
};

async function ensureClerkEngramKey(clerkUserId: string): Promise<ClerkEngramKey> {
  const storedApiKey = readClerkApiKey(clerkUserId);
  if (storedApiKey) {
    setActiveApiKey(storedApiKey);
    return {
      apiKey: storedApiKey,
      externalId: `clerk:${clerkUserId}`,
    };
  }
  const response = await api.users.create(`clerk:${clerkUserId}`);
  setClerkApiKey(clerkUserId, response.api_key);
  setActiveApiKey(response.api_key);
  return {
    apiKey: response.api_key,
    externalId: response.external_id,
  };
}

export function ClerkEngramBridge() {
  const { isLoaded, user } = useUser();
  const queryClient = useQueryClient();
  const clerkUserId = user?.id ?? "";
  const bridgeQuery = useQuery({
    queryKey: ["clerk-engram-key", clerkUserId],
    queryFn: () => ensureClerkEngramKey(clerkUserId),
    enabled: isLoaded && Boolean(clerkUserId),
    staleTime: Infinity,
    retry: false,
  });

  useEffect(() => {
    if (isLoaded && !clerkUserId) {
      clearActiveApiKey();
      void queryClient.invalidateQueries({ queryKey: ["current-user"] });
    }
  }, [clerkUserId, isLoaded, queryClient]);

  useEffect(() => {
    if (!clerkUserId) {
      return () => undefined;
    }
    return subscribeActiveApiKey(() => {
      const activeApiKey = readActiveApiKey();
      if (activeApiKey.startsWith("ek_")) {
        setClerkApiKey(clerkUserId, activeApiKey);
      }
      if (!activeApiKey) {
        clearClerkApiKey(clerkUserId);
      }
    });
  }, [clerkUserId]);

  useEffect(() => {
    if (bridgeQuery.data) {
      void queryClient.invalidateQueries({ queryKey: ["current-user"] });
      void queryClient.invalidateQueries({ queryKey: ["memories"] });
      void queryClient.invalidateQueries({ queryKey: ["logs"] });
    }
  }, [bridgeQuery.data, queryClient]);

  return (
    <span className="sr-only" aria-live="polite">
      {bridgeQuery.isError ? "Unable to link Clerk user to Engram." : ""}
    </span>
  );
}
