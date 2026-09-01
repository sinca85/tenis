import { cookies } from "next/headers";
import { buscarColegas, cancelarPreReserva, confirmarReserva, consultarReserva, iniciarPreReserva } from "@/lib/brio";
import { SESSION_COOKIE, verifySession } from "@/lib/session";

async function authorized() {
  return Boolean(verifySession((await cookies()).get(SESSION_COOKIE)?.value));
}

export async function GET(request: Request) {
  if (!(await authorized())) return Response.json({ status: false, error: "No autorizado" }, { status: 401 });
  const url = new URL(request.url);
  try {
    const data = await buscarColegas(url.searchParams.get("turnoId") || "", url.searchParams.get("search") || "");
    return Response.json({ status: true, data });
  } catch (error) {
    return Response.json({ status: false, error: error instanceof Error ? error.message : "No se pudieron buscar socios" }, { status: 502 });
  }
}

export async function POST(request: Request) {
  if (!(await authorized())) return Response.json({ status: false, error: "No autorizado" }, { status: 401 });
  try {
    const body = await request.json() as { action?: string; turnoId?: string; colegaId?: string };
    const turnoId = String(body.turnoId || "");
    const data = body.action === "consultar"
      ? await consultarReserva(turnoId)
      : body.action === "prereservar"
        ? await iniciarPreReserva(turnoId)
        : body.action === "confirmar"
          ? await confirmarReserva(turnoId, String(body.colegaId || ""))
          : body.action === "cancelar"
            ? await cancelarPreReserva(turnoId)
          : null;
    if (!data) return Response.json({ status: false, error: "Acción inválida" }, { status: 400 });
    return Response.json({ status: true, data });
  } catch (error) {
    return Response.json({ status: false, error: error instanceof Error ? error.message : "No se pudo procesar la reserva" }, { status: 502 });
  }
}
