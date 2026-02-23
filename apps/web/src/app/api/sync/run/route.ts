/**
 * BFF: proxies to backend POST /internal/sync/run.
 * Enqueues a sync job; the worker processes it asynchronously.
 * Returns { jobId }. INTERNAL_API_KEY is server-only; never sent to the browser.
 */

import { NextResponse } from "next/server";

export async function POST() {
  const baseUrl = process.env.INTERNAL_API_BASE_URL?.trim();
  const apiKey = process.env.INTERNAL_API_KEY?.trim();
  if (!baseUrl || !apiKey) {
    return NextResponse.json(
      { error: "Server misconfiguration: missing INTERNAL_API_BASE_URL or INTERNAL_API_KEY" },
      { status: 503 }
    );
  }

  const url = `${baseUrl.replace(/\/$/, "")}/internal/sync/run`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "x-internal-api-key": apiKey,
    },
  });

  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    return NextResponse.json(
      { error: "Upstream error", upstreamStatus: res.status, ...body },
      { status: res.status }
    );
  }
  return NextResponse.json(body, { status: 200 });
}
