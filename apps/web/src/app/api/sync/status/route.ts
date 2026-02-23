/**
 * BFF: proxies to backend GET /internal/sync-status.
 * Returns shop config, sync state (last sync time, status), run logs, counts.
 * INTERNAL_API_KEY is server-only; never sent to the browser.
 */

import { NextResponse } from "next/server";

export async function GET() {
  const baseUrl = process.env.INTERNAL_API_BASE_URL?.trim();
  const apiKey = process.env.INTERNAL_API_KEY?.trim();
  if (!baseUrl || !apiKey) {
    return NextResponse.json(
      { error: "Server misconfiguration: missing INTERNAL_API_BASE_URL or INTERNAL_API_KEY" },
      { status: 503 }
    );
  }

  const url = `${baseUrl.replace(/\/$/, "")}/internal/sync-status`;
  const res = await fetch(url, {
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
