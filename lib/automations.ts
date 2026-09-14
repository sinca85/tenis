import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";

export const AUTOMATIONS_RULES_KEY = "tenis:automations:rules";
export const AUTOMATIONS_CREDENTIALS_KEY = "tenis:automations:credentials";

export type AutomationRule = {
  id: string;
  ownerId: string;
  memberId: string;
  hora: string;
  servicioId: number;
  servicioId2?: number;
  colegaId: string;
  colegaNombre: string;
  diasJuego: number[];
  diasEjecucion: number[];
  diaCorte?: number;
  horaCorte?: string;
  fechasOmitidas?: string[];
  pausadaHasta?: string;
  activo: boolean;
  createdAt: string;
};

type StoredCredentials = { username: string; password: string };

function redisConfig() {
  const url = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) throw new Error("Las automatizaciones todavía no tienen Redis configurado");
  return { url, token };
}

async function command<T>(args: Array<string | number>) {
  const { url, token } = redisConfig();
  const response = await fetch(url, { method: "POST", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" }, body: JSON.stringify(args), cache: "no-store", signal: AbortSignal.timeout(8_000) });
  if (!response.ok) throw new Error("No se pudo guardar la automatización");
  const json = await response.json() as { result: T; error?: string };
  if (json.error) throw new Error(json.error);
  return json.result;
}

function cryptoKey() {
  const value = process.env.AUTOMATION_ENCRYPTION_KEY;
  if (!value) throw new Error("Falta configurar AUTOMATION_ENCRYPTION_KEY");
  return createHash("sha256").update(value).digest();
}

function encrypt(value: unknown) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", cryptoKey(), iv);
  const encrypted = Buffer.concat([cipher.update(JSON.stringify(value), "utf8"), cipher.final()]);
  return [iv, cipher.getAuthTag(), encrypted].map((part) => part.toString("base64url")).join(".");
}

function decrypt(value: string) {
  const [iv, tag, encrypted] = value.split(".");
  if (!iv || !tag || !encrypted) throw new Error("Las credenciales guardadas no son válidas");
  const decipher = createDecipheriv("aes-256-gcm", cryptoKey(), Buffer.from(iv, "base64url"));
  decipher.setAuthTag(Buffer.from(tag, "base64url"));
  return JSON.parse(Buffer.concat([decipher.update(Buffer.from(encrypted, "base64url")), decipher.final()]).toString("utf8")) as StoredCredentials;
}

export function automationOwnerId(username: string) {
  return createHash("sha256").update(username.trim().toLowerCase()).digest("base64url").slice(0, 32);
}

export async function saveAutomationCredentials(username: string, password: string) {
  await command<number>(["HSET", AUTOMATIONS_CREDENTIALS_KEY, automationOwnerId(username), encrypt({ username, password })]);
}

export async function getAutomationCredentials(ownerId: string) {
  const stored = await command<string | null>(["HGET", AUTOMATIONS_CREDENTIALS_KEY, ownerId]);
  return stored ? decrypt(stored) : null;
}

export async function listAutomationRules(ownerId?: string) {
  const values = await command<string[]>(["HVALS", AUTOMATIONS_RULES_KEY]);
  return (values || []).flatMap((value) => { try { return [JSON.parse(value) as AutomationRule]; } catch { return []; } })
    .filter((rule) => !ownerId || rule.ownerId === ownerId);
}

export async function saveAutomationRule(rule: AutomationRule) {
  await command<number>(["HSET", AUTOMATIONS_RULES_KEY, rule.id, JSON.stringify(rule)]);
}

export async function deleteAutomationRule(id: string) {
  await command<number>(["HDEL", AUTOMATIONS_RULES_KEY, id]);
}
