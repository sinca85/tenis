import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { SESSION_COOKIE, verifySession } from "@/lib/session";

export default async function Home() {
  const session = verifySession((await cookies()).get(SESSION_COOKIE)?.value);
  redirect(session ? "/turnos" : "/login");
}
