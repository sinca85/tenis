import { createHash } from "node:crypto";
import type { AlertaTurno } from "@/lib/types";

const ALERTS_KEY = "tenis:alertas";

function redisConfig() {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) throw new Error("Las alertas todavía no tienen almacenamiento configurado");
  return { url, token };
}

async function command<T>(args: Array<string | number>) {
  const { url, token } = redisConfig();
  const response = await fetch(url, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify(args),
    cache: "no-store",
    signal: AbortSignal.timeout(8_000),
  });
  if (!response.ok) throw new Error("No se pudo guardar la alerta");
  const json = (await response.json()) as { result: T; error?: string };
  if (json.error) throw new Error(json.error);
  return json.result;
}

export function alertId(input: Pick<AlertaTurno, "email" | "fecha" | "hora" | "servicio_id">) {
  return createHash("sha256")
    .update(`${input.email.toLowerCase()}|${input.fecha}|${input.hora}|${input.servicio_id}`)
    .digest("hex")
    .slice(0, 32);
}

export async function saveAlert(alert: AlertaTurno) {
  await command<number>(["HSET", ALERTS_KEY, alert.id, JSON.stringify(alert)]);
}

export async function deleteAlert(id: string) {
  await command<number>(["HDEL", ALERTS_KEY, id]);
}

export async function listAlerts(): Promise<AlertaTurno[]> {
  const values = await command<string[]>(["HVALS", ALERTS_KEY]);
  return (values || []).flatMap((value) => {
    try {
      return [JSON.parse(value) as AlertaTurno];
    } catch {
      return [];
    }
  });
}

export async function sendAvailabilityEmail(alert: AlertaTurno) {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) throw new Error("Falta configurar RESEND_API_KEY");
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from: "Tenis Santivillaabrille <alertas@santivillaabrille.com>",
      to: [alert.email],
      subject: `Se liberó ${alert.servicioNombre} a las ${alert.hora.slice(0, 5)}`,
      html: `<div style="font-family:Arial,sans-serif;max-width:560px;margin:auto;padding:32px;color:#342218"><div style="font-size:28px;font-weight:800;margin-bottom:24px">🎾 TENIS</div><h1 style="font-size:30px;line-height:1.1">¡Se liberó el turno que esperabas!</h1><p style="font-size:17px;line-height:1.6">Ya está disponible <strong>${alert.servicioNombre}</strong> el <strong>${alert.fecha}</strong> de <strong>${alert.hora.slice(0, 5)} a ${alert.horafin.slice(0, 5)}</strong>.</p><a href="https://neptunia.brio.club/" style="display:inline-block;margin-top:18px;padding:14px 22px;border-radius:999px;background:#f45b14;color:white;text-decoration:none;font-weight:700">Reservar ahora</a><p style="margin-top:30px;color:#796a61;font-size:13px">Este aviso se envía una sola vez.</p></div>`,
    }),
    cache: "no-store",
    signal: AbortSignal.timeout(10_000),
  });
  if (!response.ok) throw new Error(`Resend respondió ${response.status}`);
}
