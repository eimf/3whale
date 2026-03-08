# Sync behavior: UI vs script, and true reconciliation

## What the UI “Sync” button does

1. **Dashboard** calls `POST /api/sync/run` (Next.js BFF in `apps/web`).
2. **BFF** (`apps/web/src/app/api/sync/run/route.ts`) proxies to the backend:
   - `POST ${INTERNAL_API_BASE_URL}/internal/sync/run`
   - With header `x-internal-api-key: INTERNAL_API_KEY`
3. **Backend** (`src/api/routes/internal.ts`):
   - **Enqueues** a BullMQ job: `queue.add("syncOrdersIncomeV1", {})`
   - Returns `{ jobId }` immediately. It does **not** run the sync in the API process.
4. A **worker process** must be running (`pnpm run dev:worker`) that consumes the `shopify-sync` queue. When it picks up the job, it runs the **same** processor: `syncOrdersIncomeV1()` in `src/jobs/processors/syncOrdersIncomeV1.ts`.

So:

- **UI sync** = enqueue job → worker runs `syncOrdersIncomeV1()` (async).
- **Script sync** (`npx tsx scripts/run-sync-once.ts`) = call `syncOrdersIncomeV1()` **directly** in the script process (sync, no queue).

Same logic, different invocation: **queue + worker** vs **direct call**.

---

## Why the UI sync might not update the data

1. **No worker running**  
   If nothing is running `pnpm run dev:worker`, the job stays in Redis and is never processed. The UI still gets `200` and `{ jobId }`, shows “Sync started”, but no sync runs. This is the most likely reason the data didn’t update when using the UI.

2. **Worker was failing before the fix**  
   If the worker was running but the job was failing (e.g. `numberOfOrders` string vs number), `last_sync_status` would be `failure` and the watermark wouldn’t advance. The script you ran later bypassed the queue and ran the fixed code directly, so it succeeded.

3. **Refresh timing**  
   The dashboard refetches status and data once after 4 seconds. If the worker is slow or the job runs later, the UI might refresh before the sync finishes, so the numbers don’t change yet.

**Conclusion:** For the UI “Sync” to actually update data, the **worker must be running** and healthy. The script works without a worker because it runs the sync in-process.

---

## Does the UI use a different worker or endpoint?

No. Same job name (`syncOrdersIncomeV1`), same queue (`shopify-sync`), same processor. Only the way the job is **triggered** differs:

- UI → BFF → `POST /internal/sync/run` → enqueue → worker runs processor.
- Script → `syncOrdersIncomeV1()` called directly.

---

## Current sync semantics (incremental only)

`syncOrdersIncomeV1` is **watermark-based incremental**:

- Reads `watermark_processed_at` from `sync_state`.
- **Effective window:**
  - If watermark exists: `effectiveWatermark = watermark - OVERLAP_DAYS` (default 2 days).
  - If no watermark (first run): `effectiveWatermark = now - INITIAL_BACKFILL_DAYS` (default 30 days).
- Fetches Shopify orders with:
  - `processed_at:>= effectiveWatermark`
  - `updated_at:>= effectiveWatermark`
  - (two passes for idempotency; overlap avoids gaps.)
- Advances the watermark to the latest `processed_at`/`updated_at` seen.

It does **not**:

- Re-fetch “all orders” in the store.
- Compare Shopify vs DB to find missing orders.
- Guarantee full parity after past failures.

So if the job had been failing for a while, some days were never (or partially) synced. Once the job is fixed, the next run only fetches from `(watermark - 2 days)` onward. If the watermark was already ahead (e.g. from an old successful run), the run may fetch little or nothing new. To “catch up” missing days you had to either reset the watermark (e.g. `scripts/reset-sync-watermark-for-new-metrics.ts`) and run a sync, or run the script (which still uses the same watermark logic unless you reset it first).

---

## True reconciliation / full sync

To get **data parity with Shopify** (reconcile all orders, fill gaps from past failures), we need a way to run a **full backfill** over a chosen window instead of only “from watermark onward”.

### Implemented behavior

1. **Full sync (reconcile) trigger**  
   - Backend: `POST /internal/sync/run?fullSync=true`  
   - Before enqueuing the job, sets `watermark_processed_at = null` for the singleton `sync_state`.  
   - Enqueues the job with `fullSyncDays: 90`.  
   - When the worker runs, it sees no watermark and uses **90 days** for the backfill window (re-fetches and upserts all orders in that window).  
   - After the run, the watermark is set again as usual.

2. **BFF**  
   - `POST /api/sync/run` accepts optional query param `fullSync=true` and forwards it to the backend.

3. **UI**  
   - “Sync now” = incremental (current behavior).  
   - “Full sync” (or “Reconcile”) = opens a confirmation modal explaining what will happen (watermark reset, 90-day re-fetch, worker requirement) and what to expect (run time, dashboard refresh). On confirm, calls with `fullSync=true` so the next run is a 90-day full backfill.

To reconcile a longer period, run a full sync (90 days) or add a future option to pass a “sync from” date / custom days.

### Operational notes

- **Worker must be running** for enqueued jobs (including full sync) to run.
- For a one-off full reconciliation without the worker, you can still:
  1. Run `npx tsx scripts/reset-sync-watermark-for-new-metrics.ts` (or manually set `watermark_processed_at = null`).
  2. Run `npx tsx scripts/run-sync-once.ts`.

---

## Summary

| Question | Answer |
| -------- | ------ |
| What does the UI Sync do? | Proxies to `POST /internal/sync/run`, which **enqueues** a `syncOrdersIncomeV1` job. The **worker** runs the sync. |
| Full or incremental? | **Incremental**: uses `watermark_processed_at` (with overlap / initial backfill). |
| Same watermark? | Yes. Same `sync_state.watermark_processed_at`; script and worker use the same processor. |
| Why didn’t UI update data? | Most likely **worker not running**; or job was failing before the schema fix; or UI refreshed before sync finished. |
| Different worker/endpoint? | No. Same queue, same job, same processor. |
| True reconciliation? | Use **Full sync** (reconcile): `fullSync=true` resets the watermark and the next run does a **90-day** full backfill. Ensure the worker is running. |
