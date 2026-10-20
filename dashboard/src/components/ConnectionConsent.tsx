"use client";

import { useMutation, useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { useSearchParams } from "next/navigation";

import { api, type OAuthAuthorization } from "@/lib/api";
import { validateAuthorizationParams } from "@/lib/connection-config";
import { useActiveApiKey } from "@/lib/useActiveApiKey";
import { useNamespace } from "@/lib/useNamespace";
import { ProductPageHeader } from "./ProductPageHeader";

export function ConnectionConsent() {
  const searchParams = useSearchParams();
  const apiKey = useActiveApiKey();
  const namespace = useNamespace();
  const params = new URLSearchParams(searchParams.toString());
  const validationError = validateAuthorizationParams(params);
  const clientId = params.get("client_id") || "";
  const redirectUri = params.get("redirect_uri") || "";
  const scope = params.get("scope") || "";
  const consent = useQuery({
    queryKey: ["oauth-consent", apiKey, namespace, clientId, redirectUri],
    queryFn: () => api.oauth.consent(clientId, redirectUri),
    enabled: !validationError,
  });
  const authorize = useMutation({
    mutationFn: () => {
      if (
        validationError ||
        !apiKey ||
        !consent.data ||
        namespace === "personal"
      )
        throw new Error(
          "Choose a project and connect your Engram API key before authorizing.",
        );
      const payload: OAuthAuthorization = {
        client_id: clientId,
        redirect_uri: redirectUri,
        response_type: "code",
        code_challenge: params.get("code_challenge") || "",
        code_challenge_method: "S256",
        scope,
        namespace,
      };
      if (params.has("state")) payload.state = params.get("state") || "";
      if (params.has("resource"))
        payload.resource = params.get("resource") || "";
      return api.oauth.authorize(payload);
    },
    onSuccess: (result) => window.location.assign(result.redirect_url),
  });
  return (
    <section className="mx-auto max-w-2xl space-y-8">
      <ProductPageHeader
        eyebrow="Connection request"
        title="Authorize an assistant"
        description="Review the assistant, permissions and project before sharing memory access."
      />
      {validationError && (
        <p role="alert" className="text-sm text-fault">
          {validationError}
        </p>
      )}
      {[consent.error, authorize.error].filter(Boolean).map((error, index) => (
        <p key={index} role="alert" className="text-sm text-fault">
          {error?.message}
        </p>
      ))}
      {consent.isLoading && <p role="status">Checking connection request...</p>}
      {consent.data && (
        <dl className="space-y-6 rounded border border-line bg-panel p-6">
          <div>
            <dt className="text-xs uppercase text-muted">Assistant</dt>
            <dd className="mt-2 font-serif text-2xl">
              {consent.data.client_name}
            </dd>
          </div>
          <div>
            <dt className="text-xs uppercase text-muted">Project</dt>
            <dd className="mt-2">{namespace}</dd>
          </div>
          <div>
            <dt className="text-xs uppercase text-muted">
              Requested permissions
            </dt>
            <dd className="mt-2 space-y-2">
              {scope
                .split(" ")
                .filter(Boolean)
                .map((permission) => (
                  <p key={permission}>
                    {permission === "memory:read"
                      ? "Read, search and inspect memories, sources and retrieval logs in this project."
                      : "Create, edit, approve, reject and delete memories in this project."}
                  </p>
                ))}
            </dd>
          </div>
          <div>
            <dt className="text-xs uppercase text-muted">Return address</dt>
            <dd className="mt-2 break-all font-mono text-xs">
              {consent.data.redirect_uri}
            </dd>
          </div>
        </dl>
      )}
      <p className="text-sm leading-7 text-muted">
        Access is limited to the selected project. You can revoke it at any time
        from Connections. The assistant never receives your Engram API key.
      </p>
      {!apiKey && (
        <p className="text-sm text-fault">
          Connect an API key in Settings, then return to this request.
        </p>
      )}
      {namespace === "personal" && (
        <p className="text-sm text-fault">
          Personal memory access is unavailable for OAuth connections. Select a
          project above.
        </p>
      )}
      <div className="flex gap-4">
        <button
          type="button"
          disabled={
            Boolean(validationError) ||
            !consent.data ||
            !apiKey ||
            namespace === "personal" ||
            authorize.isPending
          }
          onClick={() => authorize.mutate()}
          className="min-h-11 rounded border border-ink bg-ink px-5 text-sm text-paper disabled:opacity-40"
        >
          {authorize.isPending ? "Authorizing..." : "Authorize project access"}
        </button>
        <Link
          href="/connections"
          className="inline-flex min-h-11 items-center px-4 text-sm text-muted"
        >
          Cancel
        </Link>
      </div>
    </section>
  );
}
