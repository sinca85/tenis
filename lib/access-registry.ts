const ACCESS_REGISTRY_KEY = "tenis:access:members";

function redisConfig() {
  const url = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) throw new Error("El registro de accesos no tiene Redis configurado");
  return { url, token };
}

export async function rememberAccess(dni: string | number | undefined, nombre: string) {
  const normalizedDni = String(dni || "").replace(/\D/g, "");
  const normalizedName = nombre.trim();
  if (!normalizedDni || !normalizedName) return;

  const { url, token } = redisConfig();
  const response = await fetch(url, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify([
      "HSET",
      ACCESS_REGISTRY_KEY,
      normalizedDni,
      JSON.stringify({ dni: normalizedDni, nombre: normalizedName }),
    ]),
    cache: "no-store",
    signal: AbortSignal.timeout(8_000),
  });
  if (!response.ok) throw new Error("No se pudo guardar el registro de acceso");
  const json = await response.json() as { error?: string };
  if (json.error) throw new Error(json.error);
}
