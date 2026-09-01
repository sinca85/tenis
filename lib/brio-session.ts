import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";

export const BRIO_SESSION_COOKIE = "tenis_brio_session";
export const brioSessionMaxAge = 60 * 60 * 12;

export type BrioMember = { socioId: string; name: string };

export type BrioAuth = {
  cookie: string;
  socioId: string;
  username: string;
  name: string;
  members: BrioMember[];
};

function key() {
  return createHash("sha256")
    .update(process.env.SESSION_SECRET || "desarrollo-cambiar-este-secreto")
    .digest();
}

export function createBrioSession(auth: BrioAuth) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key(), iv);
  const payload = { ...auth, expires: Math.floor(Date.now() / 1000) + brioSessionMaxAge };
  const encrypted = Buffer.concat([cipher.update(JSON.stringify(payload), "utf8"), cipher.final()]);
  return [iv, cipher.getAuthTag(), encrypted].map((part) => part.toString("base64url")).join(".");
}

export function verifyBrioSession(token?: string): BrioAuth | null {
  if (!token) return null;
  try {
    const [ivValue, tagValue, encryptedValue] = token.split(".");
    if (!ivValue || !tagValue || !encryptedValue) return null;
    const decipher = createDecipheriv("aes-256-gcm", key(), Buffer.from(ivValue, "base64url"));
    decipher.setAuthTag(Buffer.from(tagValue, "base64url"));
    const decoded = Buffer.concat([
      decipher.update(Buffer.from(encryptedValue, "base64url")),
      decipher.final(),
    ]).toString("utf8");
    const auth = JSON.parse(decoded) as Partial<BrioAuth> & { expires?: number };
    return typeof auth.cookie === "string" && typeof auth.socioId === "string" && typeof auth.username === "string" &&
      typeof auth.expires === "number" && auth.expires > Date.now() / 1000
      ? {
          cookie: auth.cookie,
          socioId: auth.socioId,
          username: auth.username,
          name: typeof auth.name === "string" ? auth.name : auth.username,
          members: Array.isArray(auth.members) ? auth.members : [{ socioId: auth.socioId, name: typeof auth.name === "string" ? auth.name : auth.username }],
        }
      : null;
  } catch {
    return null;
  }
}
