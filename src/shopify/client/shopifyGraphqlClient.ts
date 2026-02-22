/**
 * Thin fetch-based Shopify Admin GraphQL client.
 * Uses shop domain and access token; API version from env SHOPIFY_API_VERSION.
 * Errors are descriptive and never include the access token (safe for logs).
 */

const API_VERSION = process.env.SHOPIFY_API_VERSION ?? "2025-04";

export interface GraphQLResponse<T = unknown> {
  data?: T;
  errors?: Array<{
    message: string;
    path?: (string | number)[];
    extensions?: Record<string, unknown>;
  }>;
}

/**
 * POST to Shopify Admin GraphQL. Throws if response has errors (includes shopDomain and first error message/path).
 */
export async function shopifyGraphqlRequest<T>(params: {
  shopDomain: string;
  accessToken: string;
  query: string;
  variables?: Record<string, unknown>;
}): Promise<T> {
  const { shopDomain, accessToken, query, variables } = params;
  const normalizedDomain = shopDomain.replace(/^https?:\/\//, "").replace(/\/$/, "");
  const url = `https://${normalizedDomain}/admin/api/${API_VERSION}/graphql.json`;

  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Shopify-Access-Token": accessToken,
    },
    body: JSON.stringify({ query, variables }),
  });

  const json = (await res.json()) as GraphQLResponse<T>;
  if (!res.ok) {
    const msg = json.errors?.[0]?.message ?? res.statusText;
    throw new Error(`Shopify GraphQL HTTP ${res.status}: ${msg}`);
  }
  if (json.errors?.length) {
    const first = json.errors[0];
    const pathInfo = first.path?.length ? ` path: ${first.path.join(".")}` : "";
    throw new Error(
      `Shopify GraphQL error (${normalizedDomain}): ${first.message}${pathInfo}`
    );
  }
  if (json.data === undefined) {
    throw new Error(`Shopify GraphQL empty data (${normalizedDomain})`);
  }
  return json.data as T;
}
