import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { authenticateBrio } from "@/lib/brio";
import { BRIO_SESSION_COOKIE, brioSessionMaxAge, createBrioSession, type BrioAuth } from "@/lib/brio-session";
import { SESSION_COOKIE, verifySession } from "@/lib/session";
import { saveAutomationCredentials } from "@/lib/automations";

export async function POST(request: NextRequest) {
  if (!verifySession((await cookies()).get(SESSION_COOKIE)?.value)) {
    return NextResponse.redirect(new URL("/login", request.url), 303);
  }

  const form = await request.formData();
  const username = String(form.get("username") || "").trim();
  const password = String(form.get("password") || "");
  const enableAutomations = form.get("enableAutomations") === "true";

  let auth: BrioAuth;
  try {
    auth = await authenticateBrio(username, password);
  } catch {
    return NextResponse.redirect(new URL("/brio-login?error=1", request.url), 303);
  }
  if (enableAutomations) {
    try {
      await saveAutomationCredentials(auth.username, password);
    } catch {
      return NextResponse.redirect(new URL("/brio-login?automationError=1", request.url), 303);
    }
  }
  const response = NextResponse.redirect(new URL("/turnos", request.url), 303);
  response.cookies.set(BRIO_SESSION_COOKIE, createBrioSession(auth), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: brioSessionMaxAge,
  });
  return response;
}
