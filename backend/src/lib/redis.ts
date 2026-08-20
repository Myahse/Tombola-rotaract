import { createClient, type RedisClientType } from "redis";

const memory = new Map<string, number>();
let client: RedisClientType | null = null;
let connecting: Promise<RedisClientType | null> | null = null;
let warned = false;

async function redis(): Promise<RedisClientType | null> {
  const url = process.env.REDIS_URL?.trim();
  if (!url) {
    if (process.env.NODE_ENV === "production" && !warned) {
      warned = true;
      console.warn("REDIS_URL is not set: revoked access tokens are blacklisted in memory only");
    }
    return null;
  }
  if (client?.isOpen) return client;
  if (connecting) return connecting;
  connecting = (async () => {
    const next = createClient({ url });
    next.on("error", (error) => console.error("Redis error", error));
    await next.connect();
    client = next;
    return next;
  })().finally(() => {
    connecting = null;
  });
  return connecting;
}

function memoryGet(jti: string) {
  const until = memory.get(jti);
  if (!until) return false;
  if (until <= Date.now()) {
    memory.delete(jti);
    return false;
  }
  return true;
}

export async function blacklistAccessJti(jti: string, expMs: number) {
  if (!jti) return;
  const ttlSec = Math.max(1, Math.ceil((expMs - Date.now()) / 1000));
  const key = `tombola:bl:${jti}`;
  try {
    const conn = await redis();
    if (conn) {
      await conn.set(key, "1", { EX: ttlSec });
      return;
    }
  } catch (error) {
    console.error("Redis blacklist failed", error);
  }
  memory.set(jti, Date.now() + ttlSec * 1000);
}

export async function isAccessJtiBlacklisted(jti: string) {
  if (!jti) return false;
  const key = `tombola:bl:${jti}`;
  try {
    const conn = await redis();
    if (conn) return (await conn.exists(key)) === 1;
  } catch (error) {
    console.error("Redis blacklist lookup failed", error);
  }
  return memoryGet(jti);
}
