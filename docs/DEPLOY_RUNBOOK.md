# 3whale – Deployment runbook

Follow these steps in order. Replace placeholders with your real values.

---

## Prerequisites

- Railway project with **Postgres** and **Redis** (linked so `DATABASE_URL` and `REDIS_URL` are set).
- **API** service deployed (start command: `pnpm run start:api`), with variables set.
- Migrations already run against production DB (you did this with `DATABASE_URL='...' pnpm run db:migrate`).

---

## Step 1 – Bootstrap shop config

Bootstrap reads timezone and currency from the Shopify API and writes them to the DB.

```bash
curl -s -X POST 'https://YOUR_RAILWAY_API_DOMAIN/internal/bootstrap' \
  -H 'x-internal-api-key: YOUR_INTERNAL_API_KEY'
```

- **YOUR_RAILWAY_API_DOMAIN** – Your API’s public host (e.g. `3whale-api.up.railway.app`), no trailing slash.
- **YOUR_INTERNAL_API_KEY** – Same value as `INTERNAL_API_KEY` in Railway Variables.

**Success:** HTTP 200 and JSON with `id`, `shopDomain`, `timezoneIana`, `currencyCode`.  
**Failure:** 400 = missing env on API; 401 = wrong key; 502 = Shopify API error (check domain/token).

---

## Step 2 – Bootstrap admin user (web app login)

Creates the single admin user in `admin_user` so you can log in to the dashboard.

```bash
DATABASE_URL='YOUR_RAILWAY_PUBLIC_DATABASE_URL' \
ADMIN_EMAIL=your@email.com \
ADMIN_PASSWORD='YourSecurePass1!' \
pnpm run bootstrap:admin
```

- Use the **public** Postgres URL (same one you used for migrations). Password rules: 8–15 chars, one upper, one number, one special, no spaces.

---

## Step 3 – Deploy the Worker (Railway)

1. In Railway: **+ New** → **Empty Service** (or clone from API).
2. **Settings** → Connect the **same repo** and branch; **Root Directory** = empty (repo root).
3. **Settings** → **Start Command:** `pnpm run start:worker`
4. **Settings** → **Variables:** Same as API (link Postgres + Redis; add `INTERNAL_API_KEY`, `SHOPIFY_SHOP_DOMAIN`, `SHOPIFY_ADMIN_ACCESS_TOKEN`). No need for `PORT`.
5. Deploy. Worker will listen for sync jobs; it only does work after you trigger sync (Step 6 or from the dashboard).

---

## Step 4 – Health check (API)

```bash
curl -s https://YOUR_RAILWAY_API_DOMAIN/internal/health
```

Expect: `{"ok":true}`

---

## Step 5 – Deploy the web app (Vercel)

1. **Vercel** → New project → Import this repo.
2. **Root Directory:** `apps/web`
3. **Build command:** `pnpm run build` (or `pnpm install && pnpm run build` if needed).
4. **Environment variables** (all required for production):

   | Variable | Value | Secret? |
   |----------|--------|--------|
   | `AUTH_JWT_SECRET` | Long random string (e.g. `openssl rand -hex 32`) | Yes |
   | `DATABASE_URL` | Same Railway Postgres **public** URL (for login) | Yes |
   | `INTERNAL_API_BASE_URL` | `https://YOUR_RAILWAY_API_DOMAIN` (no trailing slash) | No |
   | `INTERNAL_API_KEY` | Same as Railway `INTERNAL_API_KEY` | Yes |

5. Deploy. Note the Vercel URL.

---

## Step 6 – Post-deploy checks

1. **API health:**  
   `curl -s https://YOUR_RAILWAY_API_DOMAIN/internal/health` → `{"ok":true}`

2. **Web app:** Open your Vercel URL → landing page loads.

3. **Login:** Go to `/login` → sign in with the admin email/password from Step 2 → redirect to dashboard.

4. **Trigger sync (optional):** From dashboard use “Sync”/“Run sync”, or:
   ```bash
   curl -s --max-time 60 -X POST 'https://YOUR_RAILWAY_API_DOMAIN/internal/sync/run' \
     -H 'x-internal-api-key: YOUR_INTERNAL_API_KEY'
   ```
   (If the request hangs, the API may be blocked on Redis or DB; check `REDIS_URL` and `DATABASE_URL` on Railway.)
   Worker will process the job; check sync status in the dashboard or:
   ```bash
   curl -s 'https://YOUR_RAILWAY_API_DOMAIN/internal/sync-status' \
     -H 'x-internal-api-key: YOUR_INTERNAL_API_KEY'
   ```

5. **Logout:** Logout clears cookie and redirects to `/login`.

---

## Quick reference – Railway API/Worker variables

| Variable | Required |
|----------|----------|
| `DATABASE_URL` | Yes (link Postgres) |
| `REDIS_URL` | Yes (link Redis) |
| `INTERNAL_API_KEY` | Yes |
| `SHOPIFY_SHOP_DOMAIN` | Yes |
| `SHOPIFY_ADMIN_ACCESS_TOKEN` | Yes |
| `NODE_ENV` | Yes in prod: `production` |
| `PORT` | API only, default 3000 |
| `SHOPIFY_API_VERSION` | No (default 2025-04) |

No `SHOP_TIMEZONE_IANA` or `SHOP_CURRENCY_CODE` – bootstrap gets them from Shopify.
