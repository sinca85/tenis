import { deleteAlert, listAlerts, sendAvailabilityEmail } from "@/lib/alerts";
import { getTurnos } from "@/lib/brio";

export const maxDuration = 60;

export async function GET(request: Request) {
  if (!process.env.CRON_SECRET || request.headers.get("authorization") !== `Bearer ${process.env.CRON_SECRET}`) {
    return new Response("Unauthorized", { status: 401 });
  }

  const alerts = await listAlerts();
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Argentina/Cordoba" }).format(new Date());
  const active = alerts.filter((alert) => alert.fecha >= today);
  const expired = alerts.filter((alert) => alert.fecha < today);
  await Promise.all(expired.map((alert) => deleteAlert(alert.id)));

  const dates = [...new Set(active.map((alert) => alert.fecha))];
  const availability = new Map<string, Set<string>>();
  await Promise.all(dates.map(async (fecha) => {
    const turnos = await getTurnos(fecha);
    availability.set(fecha, new Set(turnos.map((turno) => `${turno.servicio_id}:${turno.hora}`)));
  }));

  let sent = 0;
  for (const alert of active) {
    if (!availability.get(alert.fecha)?.has(`${alert.servicio_id}:${alert.hora}`)) continue;
    await sendAvailabilityEmail(alert);
    await deleteAlert(alert.id);
    sent += 1;
  }

  return Response.json({ status: true, checked: active.length, sent, expired: expired.length });
}
