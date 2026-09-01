"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { Turno } from "@/lib/types";

function localDate(offset = 0) {
  const date = new Date();
  date.setDate(date.getDate() + offset);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function prettyDate(value: string) {
  return new Intl.DateTimeFormat("es-AR", { weekday: "long", day: "numeric", month: "long" }).format(new Date(`${value}T12:00:00`));
}

export default function TurnosDashboard({ email }: { email: string }) {
  const [fecha, setFecha] = useState(localDate());
  const [turnos, setTurnos] = useState<Turno[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [updated, setUpdated] = useState<Date | null>(null);

  const load = useCallback(async () => {
    setLoading(true); setError("");
    try {
      const response = await fetch(`/api/turnos?fecha=${fecha}`, { cache: "no-store" });
      const json = await response.json();
      if (!response.ok) throw new Error(json.error || "No se pudieron cargar los turnos");
      setTurnos(json.data); setUpdated(new Date());
    } catch (cause) {
      setTurnos([]); setError(cause instanceof Error ? cause.message : "Error inesperado");
    } finally { setLoading(false); }
  }, [fecha]);

  useEffect(() => {
    // Sincroniza el panel con la API externa al abrirlo o cambiar la fecha.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load]);
  const courts = useMemo(() => new Set(turnos.map((turno) => turno.servicio_id)).size, [turnos]);

  return (
    <main className="dashboard">
      <header className="topbar">
        <a href="/turnos" className="logo"><span>⇗</span> TENIS</a>
        <nav><span className="user-email">{email}</span><form action="/api/logout" method="post"><button className="text-button">Salir</button></form></nav>
      </header>
      <section className="hero">
        <div><p className="eyebrow">NEPTUNIA · DISPONIBILIDAD EN VIVO</p><h1>Tu próximo partido<br />empieza acá.</h1></div>
        <div className="date-panel">
          <label>Elegí una fecha<input type="date" value={fecha} min={localDate()} onChange={(e) => setFecha(e.target.value)} /></label>
          <div className="quick-dates">
            <button onClick={() => setFecha(localDate())}>Hoy</button>
            <button onClick={() => setFecha(localDate(1))}>Mañana</button>
            <button onClick={() => setFecha(localDate(2))}>Pasado</button>
          </div>
        </div>
      </section>
      <section className="results">
        <div className="results-head">
          <div><p className="eyebrow">TURNOS DISPONIBLES</p><h2>{prettyDate(fecha)}</h2><p className="muted">{loading ? "Consultando canchas…" : `${turnos.length} turnos en ${courts} canchas`}{updated && !loading ? ` · actualizado ${updated.toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" })}` : ""}</p></div>
          <button onClick={() => void load()} disabled={loading} className="refresh-button">↻ {loading ? "Actualizando" : "Actualizar"}</button>
        </div>
        {error ? <div className="state error-state"><strong>No pudimos consultar Brio</strong><span>{error}</span><button onClick={() => void load()}>Reintentar</button></div> :
          loading ? <div className="state"><div className="spinner" /><span>Buscando disponibilidad hora por hora…</span></div> :
          turnos.length === 0 ? <div className="state"><strong>No hay turnos disponibles</strong><span>Probá otra fecha o actualizá dentro de unos minutos.</span></div> :
          <div className="table-wrap"><table><thead><tr><th>Horario</th><th>Cancha</th><th>Duración</th><th>Estado</th><th /></tr></thead><tbody>{turnos.map((turno) => <tr key={turno.id}><td><strong>{turno.hora.slice(0, 5)}</strong><span className="end-time"> a {turno.horafin.slice(0, 5)}</span></td><td>{turno.servicioNombre}</td><td>60 min</td><td><span className="available"><i /> Disponible</span></td><td><a className="book-button" href="https://neptunia.brio.club/" target="_blank" rel="noreferrer">Reservar <span>↗</span></a></td></tr>)}</tbody></table></div>}
      </section>
      <section className="alerts-card"><div className="bell">●</div><div><p className="eyebrow">PRÓXIMAMENTE</p><h3>Alertas de disponibilidad</h3><p>Recibí un aviso apenas se libere un turno en tu día y horario preferido.</p></div><span className="soon">En preparación</span></section>
      <footer>Tenis Santivillabrile <span>·</span> Datos provistos por Brio Club</footer>
    </main>
  );
}
