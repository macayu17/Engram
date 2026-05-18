import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

const apiBaseUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";
const serviceKey = process.env.ENGRAM_SERVICE_KEY ?? "";

export async function POST() {
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
  const response = await fetch(`${apiBaseUrl.replace(/\/$/, "")}/users/service-key`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Engram-Service-Key": serviceKey,
    },
    body: JSON.stringify({
      external_id: `clerk:${userId}`,
      key_name: "clerk",
    }),
    cache: "no-store",
  });
  if (!response.ok) {
    return NextResponse.json({ error: await response.text() }, { status: response.status });
  }
  const payload = await response.json() as { api_key: string; external_id: string };
  return NextResponse.json({
    apiKey: payload.api_key,
    externalId: payload.external_id,
  });
}
