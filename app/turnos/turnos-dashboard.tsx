"use client";

import { BellOutlined, CalendarOutlined, ClockCircleOutlined, LogoutOutlined, ReloadOutlined } from "@ant-design/icons";
import { Alert, App, Button, DatePicker, Empty, Form, Input, Modal, Select, Skeleton, Switch, Table, Tag } from "antd";
import type { TableColumnsType } from "antd";
import dayjs, { type Dayjs } from "dayjs";
import "dayjs/locale/es";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Colega, ConsultaReserva, PreReserva, TurnoAgenda } from "@/lib/types";
import MemberMenu, { type MemberOption } from "@/app/member-menu";

function localDate(offset = 0) {
  const date = new Date();
  date.setDate(date.getDate() + offset);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function prettyDate(value: string) {
  return new Intl.DateTimeFormat("es-AR", { weekday: "long", day: "numeric", month: "long" }).format(new Date(`${value}T12:00:00`));
}

function duration(turno: TurnoAgenda) {
  const [startHour, startMinute] = turno.hora.split(":").map(Number);
  const [endHour, endMinute] = turno.horafin.split(":").map(Number);
  return endHour * 60 + endMinute - startHour * 60 - startMinute;
}

export default function TurnosDashboard({ currentMemberId, members }: { currentMemberId: string; members: MemberOption[] }) {
  const { message } = App.useApp();
  const [form] = Form.useForm<{ email: string }>();
  const [fecha, setFecha] = useState(localDate());
  const [turnos, setTurnos] = useState<TurnoAgenda[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [updated, setUpdated] = useState<Date | null>(null);
  const [selected, setSelected] = useState<TurnoAgenda | null>(null);
  const [savingAlert, setSavingAlert] = useState(false);
  const [showAll, setShowAll] = useState(false);
  const [reserveTurno, setReserveTurno] = useState<TurnoAgenda | null>(null);
  const [reserveInfo, setReserveInfo] = useState<ConsultaReserva | null>(null);
  const [preReserve, setPreReserve] = useState<PreReserva | null>(null);
  const [reserveLoading, setReserveLoading] = useState(false);
  const [colegas, setColegas] = useState<Colega[]>([]);
  const [colegaId, setColegaId] = useState<string>();
  const [searchingColegas, setSearchingColegas] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState(0);
  const searchSequence = useRef(0);

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
  const availableCount = useMemo(() => turnos.filter((turno) => turno.disponible).length, [turnos]);
  const visibleTurnos = useMemo(
    () => showAll ? turnos : turnos.filter((turno) => turno.disponible),
    [showAll, turnos],
  );
  const openAlert = useCallback((turno: TurnoAgenda) => {
    form.resetFields();
    setSelected(turno);
  }, [form]);
  const reserveRequest = useCallback(async (action: string, turnoId: string, selectedColegaId?: string) => {
    const response = await fetch("/api/reservas", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, turnoId, colegaId: selectedColegaId }),
    });
    const json = await response.json();
    if (!response.ok || !json.status) throw new Error(json.error || "No se pudo procesar la reserva");
    return json.data;
  }, []);
  const openReserve = useCallback(async (turno: TurnoAgenda) => {
    setReserveTurno(turno);
    setReserveInfo(null);
    setPreReserve(null);
    setColegas([]);
    setColegaId(undefined);
    setReserveLoading(true);
    try {
      setReserveInfo(await reserveRequest("consultar", turno.id));
    } catch (cause) {
      setReserveTurno(null);
      message.error(cause instanceof Error ? cause.message : "No se pudo consultar el turno");
    } finally {
      setReserveLoading(false);
    }
  }, [message, reserveRequest]);
  const columns = useMemo<TableColumnsType<TurnoAgenda>>(
    () => [
      { title: "HORARIO", key: "hora", className: "slot-time-column", render: (_, turno) => <span className="time-cell">{turno.hora.slice(0, 5)} <small>a {turno.horafin.slice(0, 5)}</small></span> },
      { title: <><span className="desktop-only">CANCHA</span><span className="mobile-only">C.</span></>, key: "cancha", className: "slot-court-column", render: (_, turno) => <><span className="desktop-only">{turno.servicioNombre}</span><span className="mobile-only court-short">C{turno.servicioNombre.match(/\d+/)?.[0]?.replace(/^0/, "")}</span></> },
      { title: "DURACIÓN", key: "duracion", responsive: ["md"], render: (_, turno) => `${duration(turno)} min` },
      { title: <span className="desktop-only">ESTADO</span>, key: "estado", className: "slot-status-column", render: (_, turno) => <><span className={`status-dot mobile-only ${turno.disponible ? "available" : "occupied"}`} title={turno.disponible ? "Disponible" : "Reservado"} aria-label={turno.disponible ? "Disponible" : "Reservado"} /><span className="desktop-only">{turno.disponible ? <Tag color="success">Disponible</Tag> : <Tag>Ocupado</Tag>}</span></> },
      { title: "", key: "action", className: "slot-action-column", align: "right", render: (_, turno) => turno.disponible ? <Button className="slot-action" type="primary" shape="round" onClick={() => void openReserve(turno)}>Reservar</Button> : <Button className="slot-action" shape="round" icon={<BellOutlined />} aria-label="Notificar baja" onClick={() => openAlert(turno)}><span className="desktop-only">Notificar baja</span><span className="mobile-only">Avisar</span></Button> },
    ],
    [openAlert, openReserve],
  );

  useEffect(() => {
    if (!preReserve) return;
    const timer = window.setInterval(() => setSecondsLeft((current) => Math.max(0, current - 1)), 1_000);
    return () => window.clearInterval(timer);
  }, [preReserve]);

  const startPreReserve = async () => {
    if (!reserveTurno) return;
    setReserveLoading(true);
    try {
      const data = await reserveRequest("prereservar", reserveTurno.id) as PreReserva;
      setSecondsLeft(data.timer);
      setPreReserve(data);
    } catch (cause) {
      message.error(cause instanceof Error ? cause.message : "No se pudo iniciar la pre-reserva");
    } finally {
      setReserveLoading(false);
    }
  };

  const searchColegas = async (search: string) => {
    if (!reserveTurno || search.trim().length < 3) { setColegas([]); return; }
    const sequence = ++searchSequence.current;
    setSearchingColegas(true);
    try {
      const response = await fetch(`/api/reservas?turnoId=${encodeURIComponent(reserveTurno.id)}&search=${encodeURIComponent(search.trim())}`, { cache: "no-store" });
      const json = await response.json();
      if (!response.ok) throw new Error(json.error || "No se pudieron buscar socios");
      if (sequence === searchSequence.current) setColegas(json.data);
    } catch (cause) {
      if (sequence === searchSequence.current) message.error(cause instanceof Error ? cause.message : "No se pudieron buscar socios");
    } finally {
      if (sequence === searchSequence.current) setSearchingColegas(false);
    }
  };

  const closeReserve = async () => {
    const turno = reserveTurno;
    const shouldCancel = Boolean(preReserve);
    setReserveTurno(null); setReserveInfo(null); setPreReserve(null); setColegaId(undefined);
    if (turno && shouldCancel) {
      try { await reserveRequest("cancelar", turno.id); } catch { /* La pre-reserva vence automáticamente. */ }
    }
  };

  const finishReserve = async () => {
    if (!reserveTurno || !colegaId) return;
    setReserveLoading(true);
    try {
      const result = await reserveRequest("confirmar", reserveTurno.id, colegaId);
      setReserveTurno(null); setReserveInfo(null); setPreReserve(null); setColegaId(undefined);
      Modal.success({ title: result.titulo || "Turno reservado", content: result.mensaje });
      await load();
    } catch (cause) {
      message.error(cause instanceof Error ? cause.message : "No se pudo confirmar la reserva");
    } finally {
      setReserveLoading(false);
    }
  };

  const changeDate = (value: Dayjs | null) => {
    if (value) setFecha(value.format("YYYY-MM-DD"));
  };

  const createAlert = async ({ email }: { email: string }) => {
    if (!selected) return;
    setSavingAlert(true);
    try {
      const response = await fetch("/api/alertas", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email,
          fecha: selected.fecha,
          hora: selected.hora,
          servicio_id: selected.servicio_id,
        }),
      });
      const json = await response.json();
      if (!response.ok) throw new Error(json.error || "No se pudo crear la alerta");
      setSelected(null);
      message.success("Alerta creada. Te avisaremos si se libera el turno.");
    } catch (cause) {
      message.error(cause instanceof Error ? cause.message : "No se pudo crear la alerta");
    } finally {
      setSavingAlert(false);
    }
  };

  return (
    <main className="dashboard">
      <header className="topbar">
        <Link href="/turnos" className="brand"><span className="tennis-ball mini" /> TENIS</Link>
        <nav><Button href="/reservas" type="text" icon={<CalendarOutlined />}>Mis reservas</Button><MemberMenu currentId={currentMemberId} members={members} /><form action="/api/logout" method="post"><Button htmlType="submit" type="text" icon={<LogoutOutlined />}>Salir</Button></form></nav>
      </header>
      <section className="hero">
        <div><p className="eyebrow">NEPTUNIA · DISPONIBILIDAD EN VIVO</p><p className="hero-copy">Elegí el día, encontrá tu horario y seguí jugando.</p></div>
      </section>
      <section className="date-strip">
        <div className="date-picker-group"><span><CalendarOutlined /> Elegí una fecha</span><DatePicker value={dayjs(fecha)} minDate={dayjs(localDate())} onChange={changeDate} format="dddd D [de] MMMM" allowClear={false} /></div>
        <div className="quick-dates"><Button type={fecha === localDate() ? "primary" : "default"} onClick={() => setFecha(localDate())}>Hoy</Button><Button type={fecha === localDate(1) ? "primary" : "default"} onClick={() => setFecha(localDate(1))}>Mañana</Button><Button type={fecha === localDate(2) ? "primary" : "default"} onClick={() => setFecha(localDate(2))}>Pasado</Button></div>
      </section>
      <section className="results">
        <div className="results-head">
          <div><p className="eyebrow"><ClockCircleOutlined /> TURNOS Y DISPONIBILIDAD</p><h2>{prettyDate(fecha)}</h2><p className="muted">{loading ? "Consultando canchas…" : showAll ? `${availableCount} disponibles de ${turnos.length} turnos futuros en ${courts} canchas` : `${availableCount} turnos disponibles en ${courts} canchas`}{updated && !loading ? ` · actualizado ${updated.toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" })}` : ""}</p></div>
          <div className="results-actions"><label className="availability-toggle"><Switch checked={showAll} onChange={setShowAll} /><span>Mostrar todos</span></label><Button onClick={() => void load()} disabled={loading} icon={<ReloadOutlined spin={loading} />}>{loading ? "Actualizando" : "Actualizar"}</Button></div>
        </div>
        {error ? <Alert className="results-state" message="No pudimos consultar Brio" description={error} type="error" showIcon action={<Button onClick={() => void load()}>Reintentar</Button>} /> : loading ? <div className="results-state"><Skeleton active paragraph={{ rows: 4 }} /></div> : visibleTurnos.length === 0 ? <div className="results-state"><Empty description={showAll ? "No hay turnos futuros para esta fecha" : "No hay turnos disponibles para esta fecha"} /></div> : <Table className="slots-table" columns={columns} dataSource={visibleTurnos} rowKey="id" rowClassName={(turno) => turno.disponible && turno.servicio_id === 16 ? "court-three-available" : ""} pagination={false} tableLayout="fixed" />}
      </section>
      <Modal title="Avisarme si se libera" open={Boolean(selected)} onCancel={() => setSelected(null)} footer={null} destroyOnHidden>
        {selected ? <p className="alert-slot"><strong>{selected.servicioNombre}</strong><span>{prettyDate(selected.fecha)} · {selected.hora.slice(0, 5)} a {selected.horafin.slice(0, 5)}</span></p> : null}
        <Form form={form} layout="vertical" onFinish={createAlert} requiredMark={false}>
          <Form.Item label="Email para el aviso" name="email" rules={[{ required: true, message: "Ingresá tu email" }, { type: "email", message: "Ingresá un email válido" }]}>
            <Input type="email" placeholder="vos@ejemplo.com" autoComplete="email" prefix={<BellOutlined />} />
          </Form.Item>
          <Button type="primary" htmlType="submit" loading={savingAlert} block>Crear alerta</Button>
        </Form>
        <p className="alert-note">Lo verificamos periódicamente y enviamos un único email cuando Brio vuelve a mostrarlo disponible.</p>
      </Modal>
      <Modal
        title={preReserve ? "Elegí a tu compañero" : "Confirmar turno"}
        open={Boolean(reserveTurno)}
        onCancel={() => void closeReserve()}
        closable={!reserveLoading}
        maskClosable={false}
        footer={preReserve ? [
          <Button key="cancel" onClick={() => void closeReserve()} disabled={reserveLoading}>Cancelar</Button>,
          <Button key="confirm" type="primary" onClick={() => void finishReserve()} loading={reserveLoading} disabled={!colegaId || secondsLeft === 0}>Confirmar reserva</Button>,
        ] : [
          <Button key="cancel" onClick={() => void closeReserve()} disabled={reserveLoading}>Cancelar</Button>,
          <Button key="continue" type="primary" onClick={() => void startPreReserve()} loading={reserveLoading} disabled={!reserveInfo}>Continuar</Button>,
        ]}
        destroyOnHidden
      >
        {reserveTurno ? <p className="alert-slot"><strong>{reserveTurno.servicioNombre}</strong><span>{prettyDate(reserveTurno.fecha)} · {reserveTurno.hora.slice(0, 5)} a {reserveTurno.horafin.slice(0, 5)}</span></p> : null}
        {reserveLoading && !reserveInfo ? <Skeleton active paragraph={{ rows: 2 }} /> : null}
        {reserveInfo && !preReserve ? <Alert type={reserveInfo.genera_deuda ? "warning" : "info"} showIcon message={reserveInfo.mensaje || "El turno está disponible"} description="Al continuar, Brio lo bloqueará durante 2 minutos mientras elegís a tu compañero." /> : null}
        {preReserve ? <div className="reserve-companion"><Alert type={secondsLeft > 30 ? "info" : "warning"} showIcon message={secondsLeft > 0 ? `Tenés ${secondsLeft} segundos para confirmar` : "La pre-reserva venció"} /><label>Compañero</label><Select showSearch value={colegaId} onSearch={(value) => void searchColegas(value)} onChange={setColegaId} filterOption={false} loading={searchingColegas} placeholder="Escribí al menos 3 letras" notFoundContent={searchingColegas ? "Buscando…" : "Sin resultados"} options={colegas.map((colega) => ({ value: colega.socioid, label: `${colega.apellidonombre} · DNI ${colega.documento}` }))} /></div> : null}
      </Modal>
      <footer><span className="tennis-ball tiny-ball" /> Tenis Santivillabrile · Datos provistos por Brio Club</footer>
    </main>
  );
}
