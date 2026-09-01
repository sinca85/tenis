import { NextRequest, NextResponse } from "next/server";
import { createSession, SESSION_COOKIE, sessionMaxAge } from "@/lib/session";

export async function POST(request: NextRequest) {
  const form = await request.formData();
  const username = String(form.get("username") || "").trim();
  const password = String(form.get("password") || "");
  const expectedUsername = process.env.ADMIN_USER || "admin";
  const expectedPassword = process.env.ADMIN_PASSWORD || "tenis";

  if (username !== expectedUsername || password !== expectedPassword) {
    return NextResponse.redirect(new URL("/login?error=1", request.url), 303);
  }

  const response = NextResponse.redirect(new URL("/turnos", request.url), 303);
  response.cookies.set(SESSION_COOKIE, createSession(username), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: sessionMaxAge,
  });
  return response;
}
