import { cookies } from "next/headers";
import { cancelarReserva, consultarCancelacion, getReservas } from "@/lib/brio";
import { BRIO_SESSION_COOKIE, verifyBrioSession } from "@/lib/brio-session";
import { SESSION_COOKIE, verifySession } from "@/lib/session";
import { automationOwnerId, rememberLocalReservations, removeLocalReservation } from "@/lib/automations";

async function auth() {
  const cookieStore = await cookies();
  if (!verifySession(cookieStore.get(SESSION_COOKIE)?.value)) return null;
  return verifyBrioSession(cookieStore.get(BRIO_SESSION_COOKIE)?.value);
}

export async function GET() {
  const brio = await auth();
  if (!brio) return Response.json({ status: false, error: "Iniciá sesión en Neptunia" }, { status: 401 });
  try {
    const data = await getReservas(brio);
    try { await rememberLocalReservations(automationOwnerId(brio.username), brio.socioId, data); }
    catch (cacheError) { console.error("[mis-reservas] no se pudo sincronizar el cupo local", cacheError); }
    return Response.json({ status: true, data });
  } catch (error) {
    return Response.json({ status: false, error: error instanceof Error ? error.message : "No se pudieron cargar tus reservas" }, { status: 502 });
  }
}

export async function POST(request: Request) {
  const brio = await auth();
  if (!brio) return Response.json({ status: false, error: "Iniciá sesión en Neptunia" }, { status: 401 });
  try {
    const body = await request.json() as { action?: string; reservaId?: string; turnoId?: string };
    const reservaId = String(body.reservaId || "");
    const data = body.action === "consultar-cancelacion"
      ? await consultarCancelacion(brio, reservaId)
      : body.action === "cancelar"
        ? await cancelarReserva(brio, reservaId)
        : null;
    if (!data) return Response.json({ status: false, error: "Acción inválida" }, { status: 400 });
    if (body.action === "cancelar") {
      try { await removeLocalReservation(automationOwnerId(brio.username), brio.socioId, String(body.turnoId || "")); }
      catch (cacheError) { console.error("[mis-reservas] no se pudo liberar el cupo local", cacheError); }
    }
    return Response.json({ status: true, data });
  } catch (error) {
    return Response.json({ status: false, error: error instanceof Error ? error.message : "No se pudo procesar la reserva" }, { status: 502 });
  }
}
