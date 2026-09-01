"use client";

import { ArrowLeftOutlined, CalendarOutlined, DeleteOutlined, EyeOutlined, LogoutOutlined, ReloadOutlined, TeamOutlined } from "@ant-design/icons";
import { Alert, App, Button, Empty, Modal, Skeleton, Tag } from "antd";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import type { ConsultaCancelacion, ReservaUsuario } from "@/lib/types";

export default function ReservasDashboard({ name }: { name: string }) {
  const { message } = App.useApp();
  const [reservas, setReservas] = useState<ReservaUsuario[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selected, setSelected] = useState<ReservaUsuario | null>(null);
  const [warning, setWarning] = useState<ConsultaCancelacion | null>(null);
  const [canceling, setCanceling] = useState(false);
  const [viewing, setViewing] = useState<ReservaUsuario | null>(null);

  const load = useCallback(async () => {
    setLoading(true); setError("");
    try {
      const response = await fetch("/api/mis-reservas", { cache: "no-store" });
      const json = await response.json();
      if (!response.ok) throw new Error(json.error || "No se pudieron cargar tus reservas");
      setReservas(json.data);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "No se pudieron cargar tus reservas");
    } finally { setLoading(false); }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load]);

  const requestCancellation = async (reserva: ReservaUsuario) => {
    setSelected(reserva); setWarning(null); setCanceling(true);
    try {
      const response = await fetch("/api/mis-reservas", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "consultar-cancelacion", reservaId: reserva.id }) });
      const json = await response.json();
      if (!response.ok) throw new Error(json.error || "No se puede cancelar este turno");
      setWarning(json.data);
    } catch (cause) {
      setSelected(null);
      message.error(cause instanceof Error ? cause.message : "No se puede cancelar este turno");
    } finally { setCanceling(false); }
  };

  const confirmCancellation = async () => {
    if (!selected || !warning) return;
    setCanceling(true);
    try {
      const response = await fetch("/api/mis-reservas", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "cancelar", reservaId: selected.id }) });
      const json = await response.json();
      if (!response.ok) throw new Error(json.error || "No se pudo cancelar el turno");
      setSelected(null); setWarning(null);
      Modal.success({ title: json.data.mensaje || "Turno cancelado", content: json.data.detalle });
      await load();
    } catch (cause) {
      message.error(cause instanceof Error ? cause.message : "No se pudo cancelar el turno");
    } finally { setCanceling(false); }
  };

  return (
    <main className="dashboard">
      <header className="topbar">
        <Link href="/turnos" className="brand"><span className="tennis-ball mini" /> TENIS</Link>
        <nav><Button href="/turnos" type="text" icon={<ArrowLeftOutlined />}>Disponibilidad</Button><span className="user-name">Hola, {name}</span><form action="/api/logout" method="post"><Button htmlType="submit" type="text" icon={<LogoutOutlined />}>Salir</Button></form></nav>
      </header>
      <section className="reservations-page">
        <div className="reservations-heading"><div><p className="eyebrow"><CalendarOutlined /> NEPTUNIA</p><h1>Mis reservas</h1><p className="muted">Tus próximos turnos y las personas que juegan con vos.</p></div><Button onClick={() => void load()} disabled={loading} icon={<ReloadOutlined spin={loading} />}>Actualizar</Button></div>
        {error ? <Alert message="No pudimos cargar tus reservas" description={error} type="error" showIcon action={<Button onClick={() => void load()}>Reintentar</Button>} /> : loading ? <Skeleton active paragraph={{ rows: 6 }} /> : reservas.length === 0 ? <Empty description="No tenés reservas próximas" /> : <div className="reservation-grid">{reservas.map((reserva) => <article className="reservation-card" key={reserva.id}><div className="reservation-card-head"><Tag color="success">{reserva.estado}</Tag><div className="reservation-card-actions"><Button type="default" icon={<EyeOutlined />} onClick={() => setViewing(reserva)}>Ver reserva</Button>{reserva.puedeCancelar ? <Button danger type="primary" icon={<DeleteOutlined />} onClick={() => void requestCancellation(reserva)}>Cancelar</Button> : null}</div></div><h2>{reserva.nombre}</h2>{reserva.socios.length ? <p className="reservation-players"><TeamOutlined /> {reserva.socios.join(" · ")}</p> : null}{reserva.mensaje ? <p className="muted">{reserva.mensaje}</p> : null}</article>)}</div>}
      </section>
      <Modal title="Detalle de la reserva" open={Boolean(viewing)} onCancel={() => setViewing(null)} footer={<Button type="primary" onClick={() => setViewing(null)}>Cerrar</Button>}>
        {viewing ? <div className="reservation-detail"><Tag color="success">{viewing.estado}</Tag><h3>{viewing.nombre}</h3>{viewing.socios.length ? <div><strong>Personas en el turno</strong><p className="reservation-players"><TeamOutlined /> {viewing.socios.join(" · ")}</p></div> : null}{viewing.mensaje ? <Alert type="info" showIcon message={viewing.mensaje} /> : null}</div> : null}
      </Modal>
      <Modal title="Cancelar reserva" open={Boolean(selected)} onCancel={() => { if (!canceling) { setSelected(null); setWarning(null); } }} maskClosable={false} closable={!canceling} footer={[<Button key="back" onClick={() => { setSelected(null); setWarning(null); }} disabled={canceling}>Volver</Button>, <Button key="cancel" danger type="primary" icon={<DeleteOutlined />} disabled={!warning} loading={canceling} onClick={() => void confirmCancellation()}>Cancelar turno definitivamente</Button>]}>{selected ? <p className="alert-slot"><strong>{selected.nombre}</strong></p> : null}{canceling && !warning ? <Skeleton active paragraph={{ rows: 2 }} /> : warning ? <Alert type="warning" showIcon message={warning.mensaje} description={warning.detalle} /> : null}</Modal>
    </main>
  );
}
