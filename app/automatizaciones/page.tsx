import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { BRIO_SESSION_COOKIE, verifyBrioSession } from "@/lib/brio-session";
import { SESSION_COOKIE, verifySession } from "@/lib/session";
import AutomationsPage from "./automations-page";

export default async function Page() {
  const store = await cookies();
  if (!verifySession(store.get(SESSION_COOKIE)?.value)) redirect("/login");
  if (!verifyBrioSession(store.get(BRIO_SESSION_COOKIE)?.value)) redirect("/brio-login");
  return <AutomationsPage />;
}
