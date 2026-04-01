# Sync behavior: UI vs script

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

The web dashboard **polls** `GET /api/sync/status` until the run reaches a terminal state (`success` / `failure`), then refetches income endpoints so cards update without a manual browser refresh. On first visit, it may **auto-sync** once per tab when data looks stale (see `apps/web` dashboard code).

Same logic, different invocation: **queue + worker** vs **direct call**.

---

## Why the UI sync might not update the data

1. **No worker running**  
   If nothing is running `pnpm run dev:worker`, the job stays in Redis and is never processed. The UI still gets `200` and `{ jobId }`, but no sync runs. This is the most likely reason the data did not update when using the UI.

2. **Worker was failing**  
   If the worker was running but the job was failing, `last_sync_status` would be `failure` and the watermark would not advance as expected.

3. **Timeout**  
   If a run takes longer than the dashboard wait window (several minutes), the UI shows a timeout message. Ensure the worker is running and healthy; try Sync again.

**Conclusion:** For the UI “Sync” to actually update data, the **worker must be running** and healthy. The script works without a worker because it runs the sync in-process.

---

## Does the UI use a different worker or endpoint?

No. Same job name (`syncOrdersIncomeV1`), same queue (`shopify-sync`), same processor. Only the way the job is **triggered** differs:

- UI → BFF → `POST /internal/sync/run` → enqueue → worker runs processor.
- Script → `syncOrdersIncomeV1()` called directly.

---

## Current sync semantics (incremental)

`syncOrdersIncomeV1` is **watermark-based incremental**:

- Reads `watermark_processed_at` from `sync_state`.
- **Effective window:**
  - If watermark exists: `effectiveWatermark = watermark - OVERLAP_DAYS` (default 2 days).
  - If no watermark (first run): `effectiveWatermark = now - INITIAL_BACKFILL_DAYS` (default 30 days, env `SHOPIFY_INITIAL_BACKFILL_DAYS`).
- Fetches Shopify orders with:
  - `processed_at:>= effectiveWatermark`
  - `updated_at:>= effectiveWatermark`
  - (two passes for idempotency; overlap avoids gaps.)
- Advances the watermark to the latest `processed_at`/`updated_at` seen.

It does **not** re-fetch the entire store history in one shot. If the job had been failing for a while, some days may be thin until the watermark moves forward. To **re-run a wider backfill** after fixing logic or metrics, reset the watermark (e.g. `scripts/reset-sync-watermark-for-new-metrics.ts` or SQL) and trigger sync again so the next run treats “no watermark” / new window like an initial backfill.

---

## Summary

| Question | Answer |
| -------- | ------ |
| What does the UI Sync do? | Proxies to `POST /internal/sync/run`, which **enqueues** a `syncOrdersIncomeV1` job. The **worker** runs the sync. The UI **polls** status and refetches income when the job completes. |
| Full or incremental? | **Incremental**: uses `watermark_processed_at` (with overlap / initial backfill). |
| Same watermark? | Yes. Same `sync_state.watermark_processed_at`; script and worker use the same processor. |
| Why did UI not update data? | Most likely **worker not running** or job **failure**; less often **poll timeout** on very long runs. |
| Different worker/endpoint? | No. Same queue, same job, same processor. |
| Wider re-backfill? | **Reset watermark** (script/SQL) then run sync; next run uses initial backfill window from env. |
