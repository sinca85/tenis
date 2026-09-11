import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { BRIO_SESSION_COOKIE, verifyBrioSession } from "@/lib/brio-session";
import { SESSION_COOKIE, verifySession } from "@/lib/session";
import AutomationsPage from "./automations-page";
import { getFamilyMembers } from "@/lib/brio";
import { displayMemberName } from "@/lib/member-name";

export default async function Page() {
  const store = await cookies();
  if (!verifySession(store.get(SESSION_COOKIE)?.value)) redirect("/login");
  const brio = verifyBrioSession(store.get(BRIO_SESSION_COOKIE)?.value);
  if (!brio) redirect("/brio-login");
  const members = (await getFamilyMembers(brio)).map((member) => ({ ...member, name: displayMemberName(member.name) }));
  return <AutomationsPage currentMemberId={brio.socioId} members={members} />;
}
