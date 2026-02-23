/**
 * BFF: proxies to backend GET /internal/income/daily-v2?days=...
 * Returns daily series with MoneyValue { raw, display } for all money fields.
 * INTERNAL_API_KEY is server-only; never sent to the browser.
 */

import { z } from "zod";
import { NextResponse } from "next/server";

const allowedDays = [1, 2, 3, 7, 30] as const;
const daysSchema = z
  .union([
    z.literal(1),
    z.literal(2),
    z.literal(3),
    z.literal(7),
    z.literal(30),
  ])
  .optional()
  .default(30);

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const rawDays = searchParams.get("days");
  const parsed = daysSchema.safeParse(
    rawDays === null || rawDays === "" ? undefined : Number(rawDays)
  );
  if (!parsed.success) {
    return NextResponse.json(
      { error: `days must be one of: ${allowedDays.join(", ")}` },
      { status: 400 }
    );
  }
  const days = parsed.data;

  const baseUrl = process.env.INTERNAL_API_BASE_URL?.trim();
  const apiKey = process.env.INTERNAL_API_KEY?.trim();
  if (!baseUrl || !apiKey) {
    return NextResponse.json(
      { error: "Server misconfiguration: missing INTERNAL_API_BASE_URL or INTERNAL_API_KEY" },
      { status: 503 }
    );
  }

  const url = `${baseUrl.replace(/\/$/, "")}/internal/income/daily-v2?days=${days}`;
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
