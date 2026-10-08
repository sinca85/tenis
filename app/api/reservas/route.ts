import { cookies } from "next/headers";
import { buscarColegas, cancelarPreReserva, confirmarReserva, consultarReserva, iniciarPreReserva } from "@/lib/brio";
import { SESSION_COOKIE, verifySession } from "@/lib/session";
import { BRIO_SESSION_COOKIE, verifyBrioSession, type BrioAuth } from "@/lib/brio-session";
import { automationOwnerId, saveLocalReservation } from "@/lib/automations";

async function authorized(): Promise<BrioAuth | null> {
  const cookieStore = await cookies();
  if (!verifySession(cookieStore.get(SESSION_COOKIE)?.value)) return null;
  return verifyBrioSession(cookieStore.get(BRIO_SESSION_COOKIE)?.value);
}

export async function GET(request: Request) {
  const brio = await authorized();
  if (!brio) return Response.json({ status: false, error: "Iniciá sesión en Neptunia" }, { status: 401 });
  const url = new URL(request.url);
  try {
    const data = await buscarColegas(brio, url.searchParams.get("turnoId") || "", url.searchParams.get("search") || "");
    return Response.json({ status: true, data });
  } catch (error) {
    return Response.json({ status: false, error: error instanceof Error ? error.message : "No se pudieron buscar socios" }, { status: 502 });
  }
}

export async function POST(request: Request) {
  const brio = await authorized();
  if (!brio) return Response.json({ status: false, error: "Iniciá sesión en Neptunia" }, { status: 401 });
  try {
    const body = await request.json() as { action?: string; turnoId?: string; colegaId?: string; fecha?: string; horafin?: string };
    const turnoId = String(body.turnoId || "");
    const data = body.action === "consultar"
      ? await consultarReserva(brio, turnoId)
      : body.action === "prereservar"
        ? await iniciarPreReserva(brio, turnoId)
        : body.action === "confirmar"
          ? await confirmarReserva(brio, turnoId, String(body.colegaId || ""))
          : body.action === "cancelar"
            ? await cancelarPreReserva(brio, turnoId)
          : null;
    if (!data) return Response.json({ status: false, error: "Acción inválida" }, { status: 400 });
    if (body.action === "confirmar" && /^\d{4}-\d{2}-\d{2}$/.test(String(body.fecha || "")) && /^\d{2}:\d{2}:\d{2}$/.test(String(body.horafin || ""))) {
      try { await saveLocalReservation(automationOwnerId(brio.username), brio.socioId, turnoId, String(body.fecha), String(body.horafin)); }
      catch (cacheError) { console.error("[reservas] no se pudo registrar el cupo local", cacheError); }
    }
    return Response.json({ status: true, data });
  } catch (error) {
    return Response.json({ status: false, error: error instanceof Error ? error.message : "No se pudo procesar la reserva" }, { status: 502 });
  }
}
