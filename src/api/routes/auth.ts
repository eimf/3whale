/**
 * One-time OAuth callback for Dev Dashboard app install.
 * Exchange code for access_token and display it so you can copy to .env.
 * No auth required. Add http://localhost:3000/auth/callback to Redirect URLs in the app.
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";

interface CallbackQuery {
  code?: string;
  shop?: string;
  hmac?: string;
  state?: string;
  timestamp?: string;
}

function getClientId(): string {
  const id = process.env.SHOPIFY_CLIENT_ID?.trim();
  if (!id) throw new Error("SHOPIFY_CLIENT_ID is required for OAuth callback");
  return id;
}

function getClientSecret(): string {
  const secret = process.env.SHOPIFY_CLIENT_SECRET?.trim();
  if (!secret) throw new Error("SHOPIFY_CLIENT_SECRET is required for OAuth callback");
  return secret;
}

export async function registerAuthRoutes(fastify: FastifyInstance) {
  /** Exchange code for access_token and show it once (copy to .env). */
  fastify.get<{ Querystring: CallbackQuery }>(
    "/auth/callback",
    async (req, reply) => {
      const { code, shop } = req.query ?? {};
      if (!code || !shop) {
        return reply
          .code(400)
          .type("text/html")
          .send(
            `<html><body><p>Missing code or shop. Use Install from Dev Dashboard and set Redirect URL to http://localhost:3000/auth/callback</p></body></html>`
          );
      }
      const shopNorm = shop.replace(/^https?:\/\//, "").replace(/\/$/, "");
      if (!shopNorm.endsWith(".myshopify.com")) {
        return reply.code(400).type("text/html").send(
          `<html><body><p>Invalid shop.</p></body></html>`
        );
      }
      const clientId = getClientId();
      const clientSecret = getClientSecret();
      const url = `https://${shopNorm}/admin/oauth/access_token`;
      const body = new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        code,
      });
      let res: Response;
      try {
        res = await fetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: body.toString(),
        });
      } catch (err) {
        return reply
          .code(502)
          .type("text/html")
          .send(
            `<html><body><p>Request failed: ${(err as Error).message}</p></body></html>`
          );
      }
      const data = (await res.json()) as { access_token?: string; error_description?: string };
      if (!res.ok) {
        return reply
          .code(502)
          .type("text/html")
          .send(
            `<html><body><p>Token exchange failed: ${data.error_description ?? res.statusText}</p></body></html>`
          );
      }
      const token = data.access_token;
      if (!token) {
        return reply
          .code(502)
          .type("text/html")
          .send(`<html><body><p>No access_token in response.</p></body></html>`);
      }
      const html = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><title>3whale – Access token</title></head>
<body>
  <h1>Access token (one-time)</h1>
  <p>Copy this value into your <code>.env</code> as <code>SHOPIFY_ADMIN_ACCESS_TOKEN</code>, then restart the worker.</p>
  <pre style="background:#eee;padding:1em;overflow:auto;">${token}</pre>
  <p><strong>Do not share this token.</strong> It is tied to your app and store.</p>
</body>
</html>`;
      return reply.type("text/html").send(html);
    }
  );

  /** Root: if Install sent shop (no code), redirect to OAuth grant; else show info. */
  fastify.get<{ Querystring: { shop?: string; code?: string; hmac?: string; timestamp?: string } }>(
    "/",
    async (req, reply) => {
      const { shop, code } = req.query ?? {};
      if (shop && !code) {
        const shopNorm = shop.replace(/^https?:\/\//, "").replace(/\/$/, "");
        if (shopNorm.endsWith(".myshopify.com")) {
          try {
            const clientId = getClientId();
            const redirectUri = "http://localhost:3000/auth/callback";
            const state = Math.random().toString(36).slice(2);
            const authUrl = `https://${shopNorm}/admin/oauth/authorize?client_id=${encodeURIComponent(clientId)}&scope=read_orders&redirect_uri=${encodeURIComponent(redirectUri)}&state=${state}`;
            return reply.redirect(authUrl, 302);
          } catch (err) {
            return reply.code(500).type("text/html").send(
              `<html><body><p>OAuth setup: set SHOPIFY_CLIENT_ID and SHOPIFY_CLIENT_SECRET in .env</p><pre>${(err as Error).message}</pre></body></html>`
            );
          }
        }
      }
      return reply.type("text/html").send(
        `<html><body><p>3whale API. Use <a href="/internal/health">/internal/health</a> to check. For install token, run Install from Dev Dashboard.</p></body></html>`
      );
    }
  );
}
