import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { SESSION_COOKIE, verifySession } from "@/lib/session";
import { BRIO_SESSION_COOKIE, verifyBrioSession } from "@/lib/brio-session";
import TurnosDashboard from "./turnos-dashboard";
import { getSocioName } from "@/lib/brio";
import { displayMemberName } from "@/lib/member-name";

export default async function TurnosPage() {
  const cookieStore = await cookies();
  const session = verifySession(cookieStore.get(SESSION_COOKIE)?.value);
  if (!session) redirect("/login");
  const brio = verifyBrioSession(cookieStore.get(BRIO_SESSION_COOKIE)?.value);
  if (!brio) redirect("/brio-login");
  return <TurnosDashboard name={displayMemberName(await getSocioName(brio))} />;
}
