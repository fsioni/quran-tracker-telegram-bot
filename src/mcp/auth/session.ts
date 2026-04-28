const encoder = new TextEncoder();
const TRAILING_EQUALS_RE = /=+$/;

function toBase64Url(bytes: Uint8Array): string {
  const bin = String.fromCharCode(...bytes);
  return btoa(bin)
    .replaceAll("+", "-")
    .replaceAll("/", "_")
    .replace(TRAILING_EQUALS_RE, "");
}

function fromBase64Url(s: string): Uint8Array {
  const padded = s
    .replaceAll("-", "+")
    .replaceAll("_", "/")
    .padEnd(s.length + ((4 - (s.length % 4)) % 4), "=");
  const bin = atob(padded);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) {
    out[i] = bin.charCodeAt(i);
  }
  return out;
}

function importHmacKey(secret: string): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"]
  );
}

export function generateCode(): string {
  const buf = new Uint32Array(1);
  crypto.getRandomValues(buf);
  const n = buf[0] % 1_000_000;
  return String(n).padStart(6, "0");
}

export async function hashCode(code: string, secret: string): Promise<string> {
  const key = await importHmacKey(secret);
  const sig = new Uint8Array(
    await crypto.subtle.sign("HMAC", key, encoder.encode(code))
  );
  return toBase64Url(sig);
}

export async function signSessionId(
  id: string,
  secret: string
): Promise<string> {
  const key = await importHmacKey(secret);
  const sig = new Uint8Array(
    await crypto.subtle.sign("HMAC", key, encoder.encode(id))
  );
  return `${id}.${toBase64Url(sig)}`;
}

export async function verifySessionId(
  signed: string,
  secret: string
): Promise<string | null> {
  const dot = signed.lastIndexOf(".");
  if (dot < 1) {
    return null;
  }
  const id = signed.slice(0, dot);
  const sig = signed.slice(dot + 1);
  const key = await importHmacKey(secret);
  const ok = await crypto.subtle.verify(
    "HMAC",
    key,
    fromBase64Url(sig),
    encoder.encode(id)
  );
  return ok ? id : null;
}

export function newSessionId(): string {
  const buf = new Uint8Array(32);
  crypto.getRandomValues(buf);
  return toBase64Url(buf);
}

export interface LoginSessionRecord {
  attempts: number;
  codeHash: string;
  createdAt: number;
  oauthReqInfo: unknown; // The full AuthRequest from parseAuthRequest. Stored verbatim as JSON.
}

export const LOGIN_TTL_SECONDS = 5 * 60;
export const MAX_ATTEMPTS = 3;
const RATE_LIMIT_WINDOW_S = 10 * 60;
const RATE_LIMIT_MAX = 3;

export async function putLoginSession(
  kv: KVNamespace,
  sessionId: string,
  rec: LoginSessionRecord
): Promise<void> {
  await kv.put(`login:${sessionId}`, JSON.stringify(rec), {
    expirationTtl: LOGIN_TTL_SECONDS,
  });
}

export async function getLoginSession(
  kv: KVNamespace,
  sessionId: string
): Promise<LoginSessionRecord | null> {
  const raw = await kv.get(`login:${sessionId}`);
  return raw ? JSON.parse(raw) : null;
}

export async function deleteLoginSession(
  kv: KVNamespace,
  sessionId: string
): Promise<void> {
  await kv.delete(`login:${sessionId}`);
}

export async function bumpAttempts(
  kv: KVNamespace,
  sessionId: string,
  rec: LoginSessionRecord
): Promise<number> {
  const updated = { ...rec, attempts: rec.attempts + 1 };
  if (updated.attempts >= MAX_ATTEMPTS) {
    await deleteLoginSession(kv, sessionId);
  } else {
    await kv.put(`login:${sessionId}`, JSON.stringify(updated), {
      expirationTtl: LOGIN_TTL_SECONDS,
    });
  }
  return MAX_ATTEMPTS - updated.attempts;
}

export async function checkAndBumpRateLimit(
  kv: KVNamespace,
  ip: string
): Promise<{ allowed: boolean; minutesUntilReset: number }> {
  const key = `login_rate:${ip}`;
  const raw = await kv.get(key);
  const now = Math.floor(Date.now() / 1000);
  let count = 1;
  let resetAt = now + RATE_LIMIT_WINDOW_S;
  if (raw) {
    const parsed = JSON.parse(raw) as { count: number; resetAt: number };
    if (parsed.resetAt > now) {
      count = parsed.count + 1;
      resetAt = parsed.resetAt;
    }
  }
  await kv.put(key, JSON.stringify({ count, resetAt }), {
    expirationTtl: RATE_LIMIT_WINDOW_S,
  });
  if (count > RATE_LIMIT_MAX) {
    const minutes = Math.max(1, Math.ceil((resetAt - now) / 60));
    return { allowed: false, minutesUntilReset: minutes };
  }
  return { allowed: true, minutesUntilReset: 0 };
}
