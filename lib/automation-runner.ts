import { authenticateBrio, confirmarReserva, consultarReserva, getAgenda, iniciarPreReserva } from "@/lib/brio";
import { countLocalReservations, getAutomationCredentials, listAutomationRules, saveLocalReservation } from "@/lib/automations";
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

function nextPlayDate(days: number[], hora: string, now: ReturnType<typeof localNow>, fechasOmitidas: string[] = []) {
  for (let offset = 0; offset < 15; offset += 1) {
    const date = addDays(now.date, offset);
    if (!days.includes(weekday(date))) continue;
    if (fechasOmitidas.includes(date)) continue;
    if (date > now.date || hora.slice(0, 5) > now.time) return date;
  }
  return null;
}

export async function runAutomations() {
  const now = localNow();
  const results: Array<{ id: string; status: "reserved" | "skipped" | "error"; detail?: string }> = [];
  const candidates = (await listAutomationRules()).flatMap((rule) => {
    // La pausa detiene por completo esta regla hasta la fecha y hora elegidas.
    if (rule.pausadaHasta && Date.parse(rule.pausadaHasta) > Date.now()) return [];
    if (!rule.activo || !rule.diasEjecucion.includes(now.weekday)) return [];
    if (rule.diaCorte !== undefined && rule.horaCorte && (now.weekday > rule.diaCorte || (now.weekday === rule.diaCorte && now.time >= rule.horaCorte))) return [];
    const fecha = nextPlayDate(rule.diasJuego, rule.hora, now, rule.fechasOmitidas);
    return fecha ? [{ rule, fecha }] : [];
  });
  const groups = new Map<string, typeof candidates>();
  candidates.forEach((candidate) => {
    const key = `${candidate.rule.ownerId}:${candidate.rule.memberId}`;
    groups.set(key, [...(groups.get(key) || []), candidate]);
  });

  // El registro local se consulta antes de iniciar sesión en Brio. Con dos
  // reservas activas, este socio no genera ninguna consulta externa.
  for (const group of groups.values()) {
    try {
      const { rule: firstRule } = group[0];
      let reservasActivas = await countLocalReservations(firstRule.ownerId, firstRule.memberId);
      if (reservasActivas >= 2) {
        group.forEach(({ rule }) => results.push({ id: rule.id, status: "skipped", detail: "Ya hay dos reservas activas registradas" }));
        continue;
      }
      const credentials = await getAutomationCredentials(firstRule.ownerId);
      if (!credentials) throw new Error("El usuario no habilitó credenciales para automatizar");
      const login = await authenticateBrio(credentials.username, credentials.password);
      if (!login.members.some((member) => member.socioId === firstRule.memberId)) throw new Error("El perfil de Neptunia seleccionado ya no está disponible");
      const auth: BrioAuth = { ...login, socioId: firstRule.memberId };
      for (const { rule, fecha } of group.sort((a, b) => `${a.fecha}T${a.rule.hora}`.localeCompare(`${b.fecha}T${b.rule.hora}`))) {
        if (reservasActivas >= 2) { results.push({ id: rule.id, status: "skipped", detail: "Ya hay dos reservas activas registradas" }); continue; }
        try {
          const agenda = await getAgenda(fecha, auth);
          const prioridades = [rule.servicioId, rule.servicioId2].filter((cancha): cancha is number => typeof cancha === "number");
          const turno = prioridades.map((cancha) => agenda.find((item) => item.disponible && item.hora === rule.hora && item.servicio_id === cancha)).find(Boolean);
          if (!turno) { results.push({ id: rule.id, status: "skipped", detail: "El próximo turno todavía no está disponible" }); continue; }
          await consultarReserva(auth, turno.id);
          await iniciarPreReserva(auth, turno.id);
          await confirmarReserva(auth, turno.id, rule.colegaId);
          await saveLocalReservation(rule.ownerId, rule.memberId, turno.id, fecha, turno.horafin);
          reservasActivas += 1;
          results.push({ id: rule.id, status: "reserved", detail: `${fecha} ${rule.hora} · ${turno.servicioNombre}` });
        } catch (error) {
          results.push({ id: rule.id, status: "error", detail: error instanceof Error ? error.message : "Brio rechazó la reserva" });
        }
      }
    } catch (error) {
      group.forEach(({ rule }) => results.push({ id: rule.id, status: "error", detail: error instanceof Error ? error.message : "Error inesperado" }));
    }
  }
  return results;
}
