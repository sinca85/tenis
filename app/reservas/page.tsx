import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { BRIO_SESSION_COOKIE, verifyBrioSession } from "@/lib/brio-session";
import { SESSION_COOKIE, verifySession } from "@/lib/session";
import ReservasDashboard from "./reservas-dashboard";
import { getFamilyMembers } from "@/lib/brio";
import { displayMemberName } from "@/lib/member-name";

export default async function ReservasPage() {
  const cookieStore = await cookies();
  if (!verifySession(cookieStore.get(SESSION_COOKIE)?.value)) redirect("/login");
  const brio = verifyBrioSession(cookieStore.get(BRIO_SESSION_COOKIE)?.value);
  if (!brio) redirect("/brio-login");
  const members = (await getFamilyMembers(brio)).map((member) => ({ ...member, name: displayMemberName(member.name) }));
  return <ReservasDashboard currentMemberId={brio.socioId} members={members} />;
}
