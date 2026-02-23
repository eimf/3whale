/**
 * BFF: proxies to backend GET /internal/income/summary-v2.
 * Query: days=1|2|3|7|30, or from=&to= (YYYY-MM-DD) and optional includeExcluded=false.
 * Returns summary with MoneyValue for all money fields and aovNeto.
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
  .optional();

const dateRegex = /^\d{4}-\d{2}-\d{2}$/;

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const daysParam = searchParams.get("days");
  const fromParam = searchParams.get("from");
  const toParam = searchParams.get("to");
  const includeExcludedParam = searchParams.get("includeExcluded");

  const daysParsed = daysSchema.safeParse(
    daysParam === null || daysParam === "" ? undefined : Number(daysParam)
  );
  const hasDays = daysParsed.success && daysParsed.data !== undefined;
  const hasFromTo =
    fromParam !== null &&
    fromParam !== "" &&
    dateRegex.test(fromParam) &&
    toParam !== null &&
    toParam !== "" &&
    dateRegex.test(toParam);

  if (!hasDays && !hasFromTo) {
    return NextResponse.json(
      { error: "Provide either days (1|2|3|7|30) or both from and to (YYYY-MM-DD)" },
      { status: 400 }
    );
  }
  if (hasDays && hasFromTo) {
    return NextResponse.json(
      { error: "Provide either days or from/to, not both" },
      { status: 400 }
    );
  }

  const baseUrl = process.env.INTERNAL_API_BASE_URL?.trim();
  const apiKey = process.env.INTERNAL_API_KEY?.trim();
  if (!baseUrl || !apiKey) {
    return NextResponse.json(
      {
        error:
          "Server misconfiguration: missing INTERNAL_API_BASE_URL or INTERNAL_API_KEY",
      },
      { status: 503 }
    );
  }

  const query = new URLSearchParams();
  if (hasDays && daysParsed.success) query.set("days", String(daysParsed.data));
  if (hasFromTo && fromParam && toParam) {
    query.set("from", fromParam);
    query.set("to", toParam);
  }
  if (includeExcludedParam !== null && includeExcludedParam !== "")
    query.set("includeExcluded", includeExcludedParam);

  const url = `${baseUrl.replace(/\/$/, "")}/internal/income/summary-v2?${query.toString()}`;
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
