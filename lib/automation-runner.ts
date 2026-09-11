import { authenticateBrio, confirmarReserva, consultarReserva, getAgenda, getReservas, iniciarPreReserva } from "@/lib/brio";
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
  const candidates = (await listAutomationRules()).flatMap((rule) => {
    if (!rule.activo || !rule.diasEjecucion.includes(now.weekday)) return [];
    const fecha = nextPlayDate(rule.diasJuego, rule.hora, now);
    return fecha ? [{ rule, fecha }] : [];
  });
  const groups = new Map<string, typeof candidates>();
  candidates.forEach((candidate) => {
    const key = `${candidate.rule.ownerId}:${candidate.rule.memberId}`;
    groups.set(key, [...(groups.get(key) || []), candidate]);
  });

  // Una única sesión y una única consulta de reservas por socio. Si ya tiene
  // dos turnos activos, no hacemos ninguna consulta adicional de canchas.
  for (const group of groups.values()) {
    try {
      const { rule: firstRule } = group[0];
      const credentials = await getAutomationCredentials(firstRule.ownerId);
      if (!credentials) throw new Error("El usuario no habilitó credenciales para automatizar");
      const login = await authenticateBrio(credentials.username, credentials.password);
      if (!login.members.some((member) => member.socioId === firstRule.memberId)) throw new Error("El perfil de Neptunia seleccionado ya no está disponible");
      const auth: BrioAuth = { ...login, socioId: firstRule.memberId };
      let cupo = Math.max(0, 2 - (await getReservas(auth)).length);
      for (const { rule, fecha } of group.sort((a, b) => `${a.fecha}T${a.rule.hora}`.localeCompare(`${b.fecha}T${b.rule.hora}`))) {
        if (!cupo) { results.push({ id: rule.id, status: "skipped", detail: "Ya tiene dos turnos activos" }); continue; }
        const turno = (await getAgenda(fecha, auth)).find((item) => item.disponible && item.hora === rule.hora && item.servicio_id === rule.servicioId);
        if (!turno) { results.push({ id: rule.id, status: "skipped", detail: "El próximo turno todavía no está disponible" }); continue; }
        await consultarReserva(auth, turno.id);
        await iniciarPreReserva(auth, turno.id);
        await confirmarReserva(auth, turno.id, rule.colegaId);
        cupo -= 1;
        results.push({ id: rule.id, status: "reserved", detail: `${fecha} ${rule.hora}` });
      }
    } catch (error) {
      group.forEach(({ rule }) => results.push({ id: rule.id, status: "error", detail: error instanceof Error ? error.message : "Error inesperado" }));
    }
  }
  return results;
}
