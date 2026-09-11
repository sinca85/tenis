import { authenticateBrio, confirmarReserva, consultarReserva, getAgenda, iniciarPreReserva } from "@/lib/brio";
import { getAutomationCredentials, listAutomationRules } from "@/lib/automations";
import type { BrioAuth } from "@/lib/brio-session";

const TIME_ZONE = "America/Argentina/Cordoba";

function localNow() {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: TIME_ZONE, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23", weekday: "short" }).formatToParts(new Date());
  const value = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  const weekday = ({ Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 } as Record<string, number>)[value.weekday];
  return { date: `${value.year}-${value.month}-${value.day}`, time: `${value.hour}:${value.minute}`, weekday };
}

function addDays(date: string, days: number) {
  const result = new Date(`${date}T12:00:00-03:00`);
  result.setDate(result.getDate() + days);
  return `${result.getFullYear()}-${String(result.getMonth() + 1).padStart(2, "0")}-${String(result.getDate()).padStart(2, "0")}`;
}

function weekday(date: string) { return new Date(`${date}T12:00:00-03:00`).getDay(); }

function nextPlayDate(days: number[], hora: string, now: ReturnType<typeof localNow>) {
  for (let offset = 0; offset < 15; offset += 1) {
    const date = addDays(now.date, offset);
    if (!days.includes(weekday(date))) continue;
    if (date > now.date || hora.slice(0, 5) > now.time) return date;
  }
  return null;
}

export async function runAutomations() {
  const now = localNow();
  const results: Array<{ id: string; status: "reserved" | "skipped" | "error"; detail?: string }> = [];
  for (const rule of await listAutomationRules()) {
    if (!rule.activo || !rule.diasEjecucion.includes(now.weekday)) { results.push({ id: rule.id, status: "skipped" }); continue; }
    try {
      const credentials = await getAutomationCredentials(rule.ownerId);
      if (!credentials) throw new Error("El usuario no habilitó credenciales para automatizar");
      const login = await authenticateBrio(credentials.username, credentials.password);
      if (!login.members.some((member) => member.socioId === rule.memberId)) throw new Error("El perfil de Neptunia seleccionado ya no está disponible");
      const auth: BrioAuth = { ...login, socioId: rule.memberId };
      const fecha = nextPlayDate(rule.diasJuego, rule.hora, now);
      if (!fecha) throw new Error("No se encontró un próximo día de juego");
      const turno = (await getAgenda(fecha, auth)).find((item) => item.disponible && item.hora === rule.hora && item.servicio_id === rule.servicioId);
      if (!turno) { results.push({ id: rule.id, status: "skipped", detail: "El próximo turno todavía no está disponible" }); continue; }
      await consultarReserva(auth, turno.id);
      await iniciarPreReserva(auth, turno.id);
      await confirmarReserva(auth, turno.id, rule.colegaId);
      results.push({ id: rule.id, status: "reserved", detail: `${fecha} ${rule.hora}` });
    } catch (error) {
      results.push({ id: rule.id, status: "error", detail: error instanceof Error ? error.message : "Error inesperado" });
    }
  }
  return results;
}
