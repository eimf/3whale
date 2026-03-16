/**
 * Redis connection options for BullMQ (queue + worker).
 */

function getRedisUrl(): string {
  const url = process.env.REDIS_URL;
  if (!url) throw new Error("REDIS_URL is required");
  return url;
}

export function getRedisConnectionOptions(): {
  host: string;
  port: number;
  password?: string;
  maxRetriesPerRequest: null;
} {
  const url = getRedisUrl();
  const u = new URL(url);
  const opts: {
    host: string;
    port: number;
    password?: string;
    maxRetriesPerRequest: null;
  } = {
    host: u.hostname,
    port: u.port ? parseInt(u.port, 10) : 6379,
    maxRetriesPerRequest: null,
  };
  if (u.password) opts.password = u.password;
  return opts;
}
