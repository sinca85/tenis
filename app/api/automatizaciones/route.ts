import { randomUUID } from "node:crypto";
import { cookies } from "next/headers";
import { buscarColegas, getTurnos } from "@/lib/brio";
import { automationOwnerId, deleteAutomationRule, getAutomationCredentials, listAutomationRules, saveAutomationRule, type AutomationRule } from "@/lib/automations";
import { BRIO_SESSION_COOKIE, verifyBrioSession, type BrioAuth } from "@/lib/brio-session";
import { SESSION_COOKIE, verifySession } from "@/lib/session";

const HORARIOS = ["08:00:00", "09:15:00", "10:30:00", "11:45:00", "13:00:00", "14:15:00", "15:30:00", "16:45:00", "18:00:00", "19:15:00", "20:30:00", "21:45:00"];

async function authorized(): Promise<BrioAuth | null> {
  const store = await cookies();
  if (!verifySession(store.get(SESSION_COOKIE)?.value)) return null;
  return verifyBrioSession(store.get(BRIO_SESSION_COOKIE)?.value);
}

function dateOffset(offset: number) {
  const date = new Date();
  date.setDate(date.getDate() + offset);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function weekdays(value: unknown) {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.map(Number).filter((day) => Number.isInteger(day) && day >= 0 && day <= 6))];
}

function ruleValues(body: Partial<AutomationRule>) {
  const hora = String(body.hora || "");
  const servicioId = Number(body.servicioId);
  const optionalServiceId = body.servicioId2 as unknown;
  const servicioId2 = optionalServiceId === undefined || optionalServiceId === null || optionalServiceId === "" ? undefined : Number(optionalServiceId);
  const colegaId = String(body.colegaId || "");
  const diasJuego = weekdays(body.diasJuego);
  const diasEjecucion = weekdays(body.diasEjecucion);
  if (!HORARIOS.includes(hora) || ![14, 15, 16, 17].includes(servicioId) || (servicioId2 !== undefined && (![14, 15, 16, 17].includes(servicioId2) || servicioId2 === servicioId)) || !/^[0-9a-f-]{36}$/i.test(colegaId) || !diasJuego.length || !diasEjecucion.length) throw new Error("Completá horario, cancha, compañero y días");
  return { hora, servicioId, servicioId2, colegaId, diasJuego, diasEjecucion };
}

export async function GET(request: Request) {
  const brio = await authorized();
  if (!brio) return Response.json({ status: false, error: "Iniciá sesión en Neptunia" }, { status: 401 });
  const search = new URL(request.url).searchParams.get("search")?.trim();
  try {
    if (search) {
      // Solo necesitamos un turno real como contexto para el buscador de Brio.
      // Consultar una semana completa por cada tecla saturaba el endpoint externo.
      for (let offset = 1; offset <= 2; offset += 1) {
        const turnos = await getTurnos(dateOffset(offset), brio);
        if (turnos[0]) return Response.json({ status: true, data: await buscarColegas(brio, turnos[0].id, search) });
      }
      return Response.json({ status: true, data: [] });
    }
    return Response.json({ status: true, data: await listAutomationRules(automationOwnerId(brio.username)), credentialsEnabled: Boolean(await getAutomationCredentials(automationOwnerId(brio.username))) });
  } catch (error) {
    return Response.json({ status: false, error: error instanceof Error ? error.message : "No se pudieron cargar las automatizaciones" }, { status: 502 });
  }
}

export async function POST(request: Request) {
  const brio = await authorized();
  if (!brio) return Response.json({ status: false, error: "Iniciá sesión en Neptunia" }, { status: 401 });
  try {
    const body = await request.json() as Partial<AutomationRule>;
    const ownerId = automationOwnerId(brio.username);
    if (!await getAutomationCredentials(ownerId)) return Response.json({ status: false, error: "Para automatizar, cerrá sesión e ingresá de nuevo marcando “Habilitar reservas automáticas”." }, { status: 409 });
    const rule: AutomationRule = { id: randomUUID(), ownerId, memberId: brio.socioId, ...ruleValues(body), colegaNombre: String(body.colegaNombre || "Compañero"), activo: true, createdAt: new Date().toISOString() };
    await saveAutomationRule(rule);
    return Response.json({ status: true, data: rule });
  } catch (error) {
    return Response.json({ status: false, error: error instanceof Error ? error.message : "No se pudo guardar la regla" }, { status: 503 });
  }
}

export async function PUT(request: Request) {
  const brio = await authorized();
  if (!brio) return Response.json({ status: false, error: "Iniciá sesión en Neptunia" }, { status: 401 });
  try {
    const body = await request.json() as Partial<AutomationRule>;
    const ownerId = automationOwnerId(brio.username);
    const existing = (await listAutomationRules(ownerId)).find((rule) => rule.id === String(body.id || ""));
    if (!existing) return Response.json({ status: false, error: "Automatización no encontrada" }, { status: 404 });
    const rule: AutomationRule = { ...existing, ...ruleValues(body), colegaNombre: String(body.colegaNombre || existing.colegaNombre) };
    await saveAutomationRule(rule);
    return Response.json({ status: true, data: rule });
  } catch (error) {
    return Response.json({ status: false, error: error instanceof Error ? error.message : "No se pudo editar la regla" }, { status: 400 });
  }
}

export async function DELETE(request: Request) {
  const brio = await authorized();
  if (!brio) return Response.json({ status: false, error: "Iniciá sesión en Neptunia" }, { status: 401 });
  const id = new URL(request.url).searchParams.get("id") || "";
  const ownerId = automationOwnerId(brio.username);
  if (!(await listAutomationRules(ownerId)).some((rule) => rule.id === id)) return Response.json({ status: false, error: "Automatización no encontrada" }, { status: 404 });
  await deleteAutomationRule(id);
  return Response.json({ status: true });
}
