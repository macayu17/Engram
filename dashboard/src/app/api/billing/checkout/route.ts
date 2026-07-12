import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";

const apiBaseUrl = process.env.NEXT_PUBLIC_API_URL?.trim() || "http://localhost:8000";
const serviceKey = process.env.ENGRAM_SERVICE_KEY?.trim() ?? "";

export async function POST(request: NextRequest) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!serviceKey) {
    return NextResponse.json({ error: "Engram service key is not configured" }, { status: 503 });
  }
  if (process.env.VERCEL && apiBaseUrl.includes("localhost")) {
    return NextResponse.json({ error: "NEXT_PUBLIC_API_URL must point to the hosted Engram API" }, { status: 503 });
  }
  const body = await request.json().catch(() => null) as { orgId?: unknown } | null;
  if (!body || typeof body.orgId !== "string" || !body.orgId) {
    return NextResponse.json({ error: "orgId is required" }, { status: 422 });
  }
  const response = await fetch(`${apiBaseUrl.replace(/\/$/, "")}/billing/checkout`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Engram-Service-Key": serviceKey,
    },
    body: JSON.stringify({
      external_id: `clerk:${userId}`,
      org_id: body.orgId,
    }),
    cache: "no-store",
  });
  if (!response.ok) {
    return NextResponse.json({ error: await response.text() }, { status: response.status });
  }
  const payload = await response.json() as { url: string };
  return NextResponse.json({ url: payload.url });
}
