import { NextResponse } from "next/server";

const fallbackApiBaseUrl = "http://localhost:8000";

type UserCreatePayload = {
  external_id?: unknown;
};

function getApiBaseUrl(): string {
  return (process.env.NEXT_PUBLIC_API_URL?.trim() || fallbackApiBaseUrl).replace(/\/+$/, "");
}

function getServiceKey(): string {
  return process.env.ENGRAM_SERVICE_KEY?.trim() ?? "";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function getErrorText(body: string): string {
  if (!body) {
    return "Engram API request failed";
  }
  try {
    const parsed = JSON.parse(body) as unknown;
    if (isRecord(parsed)) {
      const detail = parsed.error ?? parsed.detail;
      if (typeof detail === "string") {
        return detail;
      }
    }
  } catch {
    return body;
  }
  return body;
}

export async function POST(request: Request) {
  let payload: UserCreatePayload;
  try {
    const parsed = await request.json() as unknown;
    payload = isRecord(parsed) ? parsed : {};
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 422 });
  }

  const externalId = typeof payload.external_id === "string" ? payload.external_id.trim() : "";
  if (!externalId) {
    return NextResponse.json({ error: "External ID is required" }, { status: 422 });
  }

  const apiBaseUrl = getApiBaseUrl();
  if (process.env.VERCEL && apiBaseUrl.includes("localhost")) {
    return NextResponse.json({ error: "NEXT_PUBLIC_API_URL must point to the hosted Engram API" }, { status: 503 });
  }

  const serviceKey = getServiceKey();
  const path = serviceKey ? "/users/service-key" : "/users";
  const body = serviceKey
    ? { external_id: externalId, key_name: "manual" }
    : { external_id: externalId };

  let response: Response;
  try {
    response = await fetch(`${apiBaseUrl}${path}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(serviceKey ? { "X-Engram-Service-Key": serviceKey } : {}),
      },
      body: JSON.stringify(body),
      cache: "no-store",
    });
  } catch {
    return NextResponse.json({ error: "Unable to reach the hosted Engram API" }, { status: 503 });
  }

  const responseBody = await response.text();
  if (!response.ok) {
    return NextResponse.json({ error: getErrorText(responseBody) }, { status: response.status });
  }

  return new NextResponse(responseBody, {
    status: response.status,
    headers: {
      "Content-Type": "application/json",
    },
  });
}
