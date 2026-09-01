import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { SESSION_COOKIE, verifySession } from "@/lib/session";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  if (verifySession((await cookies()).get(SESSION_COOKIE)?.value)) redirect("/turnos");
  const { error } = await searchParams;

  return (
    <main className="login-shell">
      <section className="login-card">
        <div className="brand-mark" aria-hidden="true">⇗</div>
        <p className="eyebrow">SANTIVILLABRILE</p>
        <h1>Encontrá cancha.<br />Jugá más.</h1>
        <p className="muted">Consultá todos los turnos de tenis disponibles en Neptunia desde un solo lugar.</p>
        <form action="/api/login" method="post" className="login-form">
          <label>Email<input name="email" type="email" required autoComplete="email" placeholder="vos@ejemplo.com" /></label>
          <label>Contraseña<input name="password" type="password" required autoComplete="current-password" placeholder="••••••••" /></label>
          {error && <p className="form-error">Email o contraseña incorrectos.</p>}
          <button type="submit" className="primary-button">Ingresar <span>→</span></button>
        </form>
        <p className="tiny">Acceso privado · tenis.santivillabrile.com</p>
      </section>
      <aside className="court-art"><div className="ball" /><div className="court-lines" /></aside>
    </main>
  );
}
