# Agent Plan — Shopify Metrics Parity (2026-02-28)

**Created**: 2026-03-03
**Branch**: feat-office
**Objective**: Make our computed metrics match Shopify Analytics exactly for the reference day 2026-02-28.

---

## Target Metrics (Ground Truth)

| # | Metric       | Expected Value |
|---|--------------|----------------|
| 1 | Orders #     | 169            |
| 2 | Gross sales  | 425,279.00     |
| 3 | Discounts    | -126,096.10    |
| 4 | Returns      | -9,304.30      |
| 5 | Net sales    | 289,878.60     |
| 6 | Shipping     | 13,547.00      |
| 7 | Taxes        | 0.00           |
| 8 | Total sales  | 303,425.60     |

---

## Agent Roster

| Agent     | Role                        | Status     |
|-----------|-----------------------------|------------|
| Ops       | Infrastructure & services   | Spawned    |
| Analyst   | Investigation & planning    | Spawned    |
| Builder   | Implementation              | Waiting    |

---

## Task Breakdown

### Phase 1 — Parallel (Ops + Analyst)

**Ops**:
- Verify Docker services (Postgres :5433, Redis :6379) are running
- Confirm migrations are applied
- Run `npm run print-summary -- --from 2026-02-28 --to 2026-02-28` and capture current output
- Document any service issues

**Analyst**:
- Read and analyze parity query logic (`src/services/incomeQueries.ts`)
- Read sync/mapper code (`mapOrderToNormalized.ts`, `syncOrdersIncomeV1.ts`)
- Read API routes and print-summary script
- Read DB schema and migration files
- Cross-reference Shopify field semantics
- Identify exact divergences between our logic and expected values
- Produce a step-by-step implementation plan with affected files

### Phase 2 — Sequential (Builder)

**Builder**:
- Implement fixes per Analyst's plan
- Run tests (`npm run test`)
- Run print-summary to verify metrics match
- Document what changed and why

---

## Key Files

| Area            | Path |
|-----------------|------|
| Parity query    | `src/services/incomeQueries.ts` |
| Summary route   | `src/api/routes/internal.ts` |
| Refund mapping  | `src/shopify/mappers/mapOrderToNormalized.ts` |
| Sync job        | `src/jobs/processors/syncOrdersIncomeV1.ts` |
| Print script    | `scripts/print-summary.ts` |
| Backfill SQL    | `drizzle/0003_backfill_returns_20260228.sql` |
