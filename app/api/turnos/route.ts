import { cookies } from "next/headers";
import { NextRequest } from "next/server";
import { getAgenda } from "@/lib/brio";
import { SESSION_COOKIE, verifySession } from "@/lib/session";
import { BRIO_SESSION_COOKIE, verifyBrioSession } from "@/lib/brio-session";

export async function GET(request: NextRequest) {
  const cookieStore = await cookies();
  if (!verifySession(cookieStore.get(SESSION_COOKIE)?.value)) {
    return Response.json({ status: false, error: "No autorizado" }, { status: 401 });
  }
  const brio = verifyBrioSession(cookieStore.get(BRIO_SESSION_COOKIE)?.value);
  if (!brio) return Response.json({ status: false, error: "Iniciá sesión en Neptunia" }, { status: 401 });
  const fecha = request.nextUrl.searchParams.get("fecha") || "";
  try {
    const data = await getAgenda(fecha, brio);
    return Response.json({ status: true, data, consultedAt: new Date().toISOString() });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Error inesperado";
    return Response.json({ status: false, error: message }, { status: 502 });
  }
}
