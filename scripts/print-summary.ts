/**
 * Fetch summary from internal API and print the 8 canonical metrics to the terminal.
 *
 * Usage:
 *   npx tsx scripts/print-summary.ts                    # today (days=1)
 *   npx tsx scripts/print-summary.ts --days 30         # last 30 days
 *   npx tsx scripts/print-summary.ts --from 2026-02-28 --to 2026-02-28
 *
 * Env: INTERNAL_API_KEY (required), INTERNAL_API_BASE_URL (default http://localhost:3000)
 */

import "dotenv/config";
import { readFileSync, existsSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

// Load .env from repo root if not already loaded
const __dirname = dirname(fileURLToPath(import.meta.url));
const rootEnv = resolve(__dirname, "..", ".env");
if (existsSync(rootEnv)) {
  const content = readFileSync(rootEnv, "utf-8");
  for (const line of content.split("\n")) {
    const m = line.match(/^([^#=]+)=(.*)$/);
    if (m && !process.env[m[1].trim()]) {
      process.env[m[1].trim()] = m[2].trim().replace(/^["']|["']$/g, "");
    }
  }
}

const API_BASE = process.env.INTERNAL_API_BASE_URL?.trim() || "http://localhost:3000";
const API_KEY = process.env.INTERNAL_API_KEY?.trim();

function parseArgs(): { days?: number; from?: string; to?: string } {
  const args = process.argv.slice(2);
  const out: { days?: number; from?: string; to?: string } = {};
  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--days" && args[i + 1]) {
      out.days = parseInt(args[i + 1], 10);
      i++;
    } else if (args[i] === "--from" && args[i + 1]) {
      out.from = args[i + 1];
      i++;
    } else if (args[i] === "--to" && args[i + 1]) {
      out.to = args[i + 1];
      i++;
    }
  }
  return out;
}

function buildQuery(opts: { days?: number; from?: string; to?: string }): string {
  if (opts.from != null && opts.to != null) {
    return `from=${encodeURIComponent(opts.from)}&to=${encodeURIComponent(opts.to)}`;
  }
  const days = opts.days ?? 1;
  return `days=${days}`;
}

type MoneyValue = { raw?: string; display?: string };

function moneyDisplay(m?: MoneyValue | null): string {
  if (m?.display != null) return m.display;
  if (m?.raw != null) return m.raw;
  return "—";
}

interface SummaryPayload {
  range?: { from: string; to: string; timezone: string };
  currencyCode?: string;
  ordersIncluded?: number;
  /** Order count for parity (includes cancelled; excludes only test/deleted). Use for "Orders #". */
  ordersCountParity?: number;
  shopifyParity?: {
    grossSales?: MoneyValue;
    discounts?: MoneyValue;
    returns?: MoneyValue;
    netSales?: MoneyValue;
    shippingCharges?: MoneyValue;
    taxes?: MoneyValue;
    totalSales?: MoneyValue;
  };
}

function printTable(payload: SummaryPayload): void {
  const p = payload.shopifyParity;
  const currency = payload.currencyCode || "MXN";
  const range = payload.range;
  const ordersCount =
    payload.ordersCountParity ?? payload.ordersIncluded ?? "—";

  const rows: [string, string][] = [
    ["1) Orders #", String(ordersCount)],
    ["2) Gross sales", moneyDisplay(p?.grossSales)],
    ["3) Discounts", moneyDisplay(p?.discounts)],
    ["4) Returns", moneyDisplay(p?.returns)],
    ["5) Net sales", moneyDisplay(p?.netSales)],
    ["6) Shipping charges", moneyDisplay(p?.shippingCharges)],
    ["7) Taxes", moneyDisplay(p?.taxes)],
    ["8) Total sales", moneyDisplay(p?.totalSales)],
  ];

  const labelWidth = Math.max(...rows.map(([l]) => l.length)) + 2;
  const valueWidth = Math.max(...rows.map(([, v]) => v.length), 16);

  const sep = "─".repeat(labelWidth + valueWidth + 5);
  console.log("\n" + sep);
  if (range) {
    console.log(`  Range: ${range.from} → ${range.to} (${range.timezone})  ${currency}`);
    console.log(sep);
  }
  for (const [label, value] of rows) {
    console.log(`  ${label.padEnd(labelWidth)} ${value.padStart(valueWidth)}`);
  }
  console.log(sep + "\n");
}

async function main(): Promise<void> {
  if (!API_KEY) {
    console.error("Missing INTERNAL_API_KEY in .env");
    process.exit(1);
  }

  const opts = parseArgs();
  const query = buildQuery(opts);
  const url = `${API_BASE.replace(/\/$/, "")}/internal/income/summary-v2?${query}`;

  console.log("Fetching:", url);

  const res = await fetch(url, {
    headers: { "x-internal-api-key": API_KEY },
  });

  if (!res.ok) {
    const text = await res.text();
    console.error("API error", res.status, res.statusText);
    console.error(text);
    process.exit(1);
  }

  const payload: SummaryPayload = await res.json();
  printTable(payload);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
