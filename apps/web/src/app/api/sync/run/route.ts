/**
 * BFF: proxies to backend POST /internal/sync/run.
 * Enqueues a sync job; the worker processes it asynchronously.
 * Body: { fullSync?: boolean } — if true, backend resets watermark so next run does full backfill.
 * Returns { jobId, fullSync }. INTERNAL_API_KEY is server-only; never sent to the browser.
 */

import { NextResponse } from "next/server";

export async function POST(request: Request) {
  const baseUrl = process.env.INTERNAL_API_BASE_URL?.trim();
  const apiKey = process.env.INTERNAL_API_KEY?.trim();
  if (!baseUrl || !apiKey) {
    return NextResponse.json(
      { error: "Server misconfiguration: missing INTERNAL_API_BASE_URL or INTERNAL_API_KEY" },
      { status: 503 }
    );
  }

  let fullSync = false;
  try {
    const body = await request.json().catch(() => ({}));
    fullSync = body?.fullSync === true;
  } catch {
    // no body or invalid JSON
  }

  const url = `${baseUrl.replace(/\/$/, "")}/internal/sync/run${fullSync ? "?fullSync=true" : ""}`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "x-internal-api-key": apiKey,
    },
  });

  const resBody = await res.json().catch(() => ({}));
  if (!res.ok) {
    return NextResponse.json(
      { error: "Upstream error", upstreamStatus: res.status, ...resBody },
      { status: res.status }
    );
  }
  return NextResponse.json(resBody, { status: 200 });
}
