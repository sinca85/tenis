import { cookies } from "next/headers";
import { alertId, deleteAlert, saveAlert } from "@/lib/alerts";
import { getAgenda } from "@/lib/brio";
import { SESSION_COOKIE, verifySession } from "@/lib/session";
import type { AlertaTurno } from "@/lib/types";
import { BRIO_SESSION_COOKIE, verifyBrioSession } from "@/lib/brio-session";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function alertInput(body: Partial<AlertaTurno>) {
  const email = String(body.email || "").trim().toLowerCase();
  const fecha = String(body.fecha || "");
  const hora = String(body.hora || "");
  const servicioId = Number(body.servicio_id);
  if (!EMAIL_PATTERN.test(email)) throw new Error("Ingresá un email válido");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha) || !/^\d{2}:\d{2}:\d{2}$/.test(hora) || !Number.isInteger(servicioId)) {
    throw new Error("Los datos de la alerta no son válidos");
  }
  return { email, fecha, hora, servicioId };
}

export async function POST(request: Request) {
  const cookieStore = await cookies();
  if (!verifySession(cookieStore.get(SESSION_COOKIE)?.value)) {
    return Response.json({ status: false, error: "No autorizado" }, { status: 401 });
  }
  const brio = verifyBrioSession(cookieStore.get(BRIO_SESSION_COOKIE)?.value);
  if (!brio) return Response.json({ status: false, error: "Iniciá sesión en Neptunia" }, { status: 401 });

  try {
    const body = (await request.json()) as Partial<AlertaTurno>;
    const { email, fecha, hora, servicioId } = alertInput(body);

    const agenda = await getAgenda(fecha, brio);
    const turno = agenda.find((item) => item.hora === hora && item.servicio_id === servicioId);
    if (!turno) return Response.json({ status: false, error: "El turno ya pasó o no existe" }, { status: 400 });
    if (turno.disponible) return Response.json({ status: false, error: "El turno ya está disponible" }, { status: 409 });

    const base = { email, fecha, hora, servicio_id: servicioId };
    const alert: AlertaTurno = {
      ...base,
      id: alertId(base),
      horafin: turno.horafin,
      servicioNombre: turno.servicioNombre,
      createdAt: new Date().toISOString(),
    };
    await saveAlert(alert);
    return Response.json({ status: true, id: alert.id });
  } catch (error) {
    const message = error instanceof Error ? error.message : "No se pudo crear la alerta";
    return Response.json({ status: false, error: message }, { status: 503 });
  }
}

export async function DELETE(request: Request) {
  const cookieStore = await cookies();
  if (!verifySession(cookieStore.get(SESSION_COOKIE)?.value)) {
    return Response.json({ status: false, error: "No autorizado" }, { status: 401 });
  }

  try {
    const body = (await request.json()) as Partial<AlertaTurno>;
    const { email, fecha, hora, servicioId } = alertInput(body);
    await deleteAlert(alertId({ email, fecha, hora, servicio_id: servicioId }));
    return Response.json({ status: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "No se pudo cancelar la alerta";
    return Response.json({ status: false, error: message }, { status: 400 });
  }
}
