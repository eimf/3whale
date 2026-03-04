/**
 * BFF: proxies to backend GET /internal/income/daily-v2.
 * Query: days= or from=&to= (YYYY-MM-DD), optional granularity=hour|day,
 * optional includeExcluded=true|1, optional compare=1.
 * Returns { range, granularity, data, comparison?, comparisonRange? }.
 * INTERNAL_API_KEY is server-only; never sent to the browser.
 */

import { NextResponse } from "next/server";

const allowedDays = [1, 2, 3, 7, 14, 30, 90, 365] as const;
const dateRegex = /^\d{4}-\d{2}-\d{2}$/;

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const daysParam = searchParams.get("days");
    const fromParam = searchParams.get("from");
    const toParam = searchParams.get("to");
    const granularityParam = searchParams.get("granularity");
    const includeExcludedParam = searchParams.get("includeExcluded");
    const compareParam = searchParams.get("compare");

    const hasDays =
        daysParam !== null &&
        daysParam !== "" &&
        allowedDays.includes(Number(daysParam) as (typeof allowedDays)[number]);
    const hasFromTo =
        fromParam !== null &&
        fromParam !== "" &&
        dateRegex.test(fromParam) &&
        toParam !== null &&
        toParam !== "" &&
        dateRegex.test(toParam);

    if (!hasDays && !hasFromTo) {
        return NextResponse.json(
            {
                error: "Provide either days (1|2|3|7|14|30|90|365) or both from and to (YYYY-MM-DD)",
            },
            { status: 400 },
        );
    }
    if (hasDays && hasFromTo) {
        return NextResponse.json(
            { error: "Provide either days or from/to, not both" },
            { status: 400 },
        );
    }

    const baseUrl = process.env.INTERNAL_API_BASE_URL?.trim();
    const apiKey = process.env.INTERNAL_API_KEY?.trim();
    if (!baseUrl || !apiKey) {
        return NextResponse.json(
            {
                error: "Server misconfiguration: missing INTERNAL_API_BASE_URL or INTERNAL_API_KEY",
            },
            { status: 503 },
        );
    }

    const query = new URLSearchParams();
    if (hasDays && daysParam) query.set("days", daysParam);
    if (hasFromTo && fromParam && toParam) {
        query.set("from", fromParam);
        query.set("to", toParam);
    }
    if (granularityParam === "hour" || granularityParam === "day") {
        query.set("granularity", granularityParam);
    }
    if (includeExcludedParam !== null && includeExcludedParam !== "") {
        query.set("includeExcluded", includeExcludedParam);
    }
    if (compareParam === "1" || compareParam === "true") {
        query.set("compare", "1");
    }

    const url = `${baseUrl.replace(/\/$/, "")}/internal/income/daily-v2?${query.toString()}`;
    const res = await fetch(url, {
        headers: {
            "x-internal-api-key": apiKey,
        },
    });

    const body = await res.json().catch(() => ({}));
    if (!res.ok) {
        return NextResponse.json(
            { error: "Upstream error", upstreamStatus: res.status, ...body },
            { status: res.status },
        );
    }
    return NextResponse.json(body, { status: 200 });
}
