import { NextRequest, NextResponse } from "next/server";
import { SESSION_COOKIE } from "@/lib/session";
import { BRIO_SESSION_COOKIE } from "@/lib/brio-session";

export async function POST(request: NextRequest) {
  const response = NextResponse.redirect(new URL("/login", request.url), 303);
  response.cookies.set(SESSION_COOKIE, "", { path: "/", maxAge: 0 });
  response.cookies.set(BRIO_SESSION_COOKIE, "", { path: "/", maxAge: 0 });
  return response;
}
