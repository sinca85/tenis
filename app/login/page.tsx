import { cookies } from "next/headers";
import Link from "next/link";
import { redirect } from "next/navigation";
import { SESSION_COOKIE, verifySession } from "@/lib/session";
import { BRIO_SESSION_COOKIE, verifyBrioSession } from "@/lib/brio-session";
import LoginForm from "./login-form";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const cookieStore = await cookies();
  if (verifySession(cookieStore.get(SESSION_COOKIE)?.value)) {
    redirect(verifyBrioSession(cookieStore.get(BRIO_SESSION_COOKIE)?.value) ? "/turnos" : "/brio-login");
  }
  const { error } = await searchParams;

  return (
    <main className="login-shell">
      <section className="login-card">
        <Link className="brand" href="/" aria-label="Tenis, inicio"><span className="tennis-ball mini" /> TENIS</Link>
        <p className="eyebrow">ACCESO PRIVADO</p>
        <h1>Tu próximo partido<br />empieza acá.</h1>
        <p className="muted">Consultá todos los turnos disponibles de Neptunia desde un solo lugar.</p>
        <LoginForm hasError={Boolean(error)} />
        <p className="tiny">Acceso privado · tenis.santivillabrile.com</p>
      </section>
      <aside className="login-visual" aria-hidden="true"><div className="tennis-ball giant" /><div className="visual-copy">RESERVÁ.<br />JUGÁ.<br />REPETÍ.</div></aside>
    </main>
  );
}
