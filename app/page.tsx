import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { SESSION_COOKIE, verifySession } from "@/lib/session";
import { BRIO_SESSION_COOKIE, verifyBrioSession } from "@/lib/brio-session";

export default async function Home() {
  const cookieStore = await cookies();
  const session = verifySession(cookieStore.get(SESSION_COOKIE)?.value);
  redirect(!session ? "/login" : verifyBrioSession(cookieStore.get(BRIO_SESSION_COOKIE)?.value) ? "/turnos" : "/brio-login");
}
