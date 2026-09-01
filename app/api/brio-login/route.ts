import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { authenticateBrio } from "@/lib/brio";
import { BRIO_SESSION_COOKIE, brioSessionMaxAge, createBrioSession } from "@/lib/brio-session";
import { SESSION_COOKIE, verifySession } from "@/lib/session";

export async function POST(request: NextRequest) {
  if (!verifySession((await cookies()).get(SESSION_COOKIE)?.value)) {
    return NextResponse.redirect(new URL("/login", request.url), 303);
  }

  const form = await request.formData();
  const username = String(form.get("username") || "").trim();
  const password = String(form.get("password") || "");

  try {
    const auth = await authenticateBrio(username, password);
    const response = NextResponse.redirect(new URL("/turnos", request.url), 303);
    response.cookies.set(BRIO_SESSION_COOKIE, createBrioSession(auth), {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: brioSessionMaxAge,
    });
    return response;
  } catch {
    return NextResponse.redirect(new URL("/brio-login?error=1", request.url), 303);
  }
}
