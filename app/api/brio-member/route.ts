import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { getFamilyMembers } from "@/lib/brio";
import { BRIO_SESSION_COOKIE, brioSessionMaxAge, createBrioSession, verifyBrioSession } from "@/lib/brio-session";
import { SESSION_COOKIE, verifySession } from "@/lib/session";

export async function POST(request: NextRequest) {
  const cookieStore = await cookies();
  if (!verifySession(cookieStore.get(SESSION_COOKIE)?.value)) {
    return Response.json({ status: false, error: "No autorizado" }, { status: 401 });
  }
  const brio = verifyBrioSession(cookieStore.get(BRIO_SESSION_COOKIE)?.value);
  if (!brio) return Response.json({ status: false, error: "Iniciá sesión en Neptunia" }, { status: 401 });

  try {
    const body = await request.json() as { socioId?: string };
    const members = await getFamilyMembers(brio);
    const selected = members.find((member) => member.socioId === body.socioId);
    if (!selected) return Response.json({ status: false, error: "Ese socio no pertenece a la cuenta" }, { status: 403 });
    const response = NextResponse.json({ status: true });
    response.cookies.set(BRIO_SESSION_COOKIE, createBrioSession({ ...brio, socioId: selected.socioId, name: selected.name, members }), {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: brioSessionMaxAge,
    });
    return response;
  } catch (error) {
    return Response.json({ status: false, error: error instanceof Error ? error.message : "No se pudo cambiar de socio" }, { status: 502 });
  }
}
