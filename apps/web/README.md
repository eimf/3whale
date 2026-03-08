This is a [Next.js](https://nextjs.org) project (3whale web app, port 3001).

## Auth (admin login + JWT)

- **Landing**: `GET /` — public; link to Login.
- **Login**: `GET /login` — email + password, show/hide password; on success redirects to `/dashboard`.
- **Dashboard**: `GET /dashboard` — protected; Logout in the top bar.
- **API**: `POST /api/auth/login`, `POST /api/auth/logout`, `GET /api/auth/me` (optional).

JWT is stored in an **HttpOnly** cookie (`auth_token`), 24h expiry, `SameSite=Lax`, `Secure` in production.

### Env vars (apps/web)

Create `.env.local` in `apps/web` (or set in your deployment):

- **`AUTH_JWT_SECRET`** (required) — secret used to sign/verify JWTs. Use a long random string in production.
- **`DATABASE_URL`** (required for login) — same Postgres as the backend (for `admin_user` table).

Optional (for proxying to internal API): `INTERNAL_API_BASE_URL`, `INTERNAL_API_KEY` (see root README_DEV).

### Run migration and bootstrap admin (repo root)

Migrations and bootstrap run from the **repo root** (same DB as Fastify):

```bash
# From repo root
pnpm run db:migrate          # creates admin_user table (and others)
ADMIN_EMAIL=lzdzel@gmail.com ADMIN_PASSWORD='YourPassword123!' pnpm run bootstrap:admin
```

Password rules (enforced by bootstrap and login): length 8–15, at least one uppercase letter, one number, one special character, no spaces.

### Log in / log out

1. Open the app (e.g. http://localhost:3001).
2. Click **Login** → enter admin email and password → Sign in.
3. You are redirected to `/dashboard`. Use **Logout** in the top bar to sign out (cookie cleared, redirect to `/login`).

---

## Getting Started

First, run the development server:

```bash
pnpm dev
```

Open [http://localhost:3001](http://localhost:3001) with your browser (port 3001 for this app).

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
