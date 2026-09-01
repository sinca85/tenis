import { createHmac, timingSafeEqual } from "node:crypto";

export const SESSION_COOKIE = "tenis_session";
const MAX_AGE = 60 * 60 * 24 * 14;

function secret() {
  return process.env.SESSION_SECRET || "desarrollo-cambiar-este-secreto";
}

export function createSession(email: string) {
  const expires = Math.floor(Date.now() / 1000) + MAX_AGE;
  const payload = Buffer.from(JSON.stringify({ email, expires })).toString("base64url");
  const signature = createHmac("sha256", secret()).update(payload).digest("base64url");
  return `${payload}.${signature}`;
}

export function verifySession(token?: string) {
  if (!token) return null;
  const [payload, signature] = token.split(".");
  if (!payload || !signature) return null;
  const expected = createHmac("sha256", secret()).update(payload).digest("base64url");
  const a = Buffer.from(signature);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;

  try {
    const parsed = JSON.parse(Buffer.from(payload, "base64url").toString()) as {
      email: string;
      expires: number;
    };
    return parsed.expires > Date.now() / 1000 ? parsed : null;
  } catch {
    return null;
  }
}

export const sessionMaxAge = MAX_AGE;
