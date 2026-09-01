import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { SESSION_COOKIE, verifySession } from "@/lib/session";
import TurnosDashboard from "./turnos-dashboard";

export default async function TurnosPage() {
  const session = verifySession((await cookies()).get(SESSION_COOKIE)?.value);
  if (!session) redirect("/login");
  return <TurnosDashboard username={session.username} />;
}
