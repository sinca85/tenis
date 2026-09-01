import { cookies } from "next/headers";
import Link from "next/link";
import { redirect } from "next/navigation";
import { BRIO_SESSION_COOKIE, verifyBrioSession } from "@/lib/brio-session";
import { SESSION_COOKIE, verifySession } from "@/lib/session";
import BrioLoginForm from "./brio-login-form";

export default async function BrioLoginPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const cookieStore = await cookies();
  if (!verifySession(cookieStore.get(SESSION_COOKIE)?.value)) redirect("/login");
  if (verifyBrioSession(cookieStore.get(BRIO_SESSION_COOKIE)?.value)) redirect("/turnos");
  const { error } = await searchParams;

  return (
    <main className="login-shell">
      <section className="login-card">
        <Link className="brand" href="/" aria-label="Tenis, inicio"><span className="tennis-ball mini" /> TENIS</Link>
        <p className="eyebrow">CONECTAR CON EL CLUB</p>
        <h1>Entrá con tu cuenta<br />de Neptunia.</h1>
        <p className="muted">Usamos esta sesión para mostrar tus turnos y reservar siempre con tu propio socio.</p>
        <BrioLoginForm hasError={Boolean(error)} />
        <p className="tiny">Tu contraseña no se guarda · La sesión permanece cifrada</p>
      </section>
      <aside className="login-visual" aria-hidden="true"><div className="tennis-ball giant" /><div className="visual-copy">ELEGÍ.<br />RESERVÁ.<br />JUGÁ.</div></aside>
    </main>
  );
}
