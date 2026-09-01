"use client";

import { BellOutlined, CalendarOutlined, ClockCircleOutlined, LogoutOutlined, ReloadOutlined } from "@ant-design/icons";
import { Alert, App, Button, DatePicker, Empty, Form, Input, Modal, Skeleton, Table, Tag } from "antd";
import type { TableColumnsType } from "antd";
import dayjs, { type Dayjs } from "dayjs";
import "dayjs/locale/es";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { TurnoAgenda } from "@/lib/types";

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

export default function TurnosDashboard({ username }: { username: string }) {
  const { message } = App.useApp();
  const [form] = Form.useForm<{ email: string }>();
  const [fecha, setFecha] = useState(localDate());
  const [turnos, setTurnos] = useState<TurnoAgenda[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [updated, setUpdated] = useState<Date | null>(null);
  const [selected, setSelected] = useState<TurnoAgenda | null>(null);
  const [savingAlert, setSavingAlert] = useState(false);

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
  const openAlert = useCallback((turno: TurnoAgenda) => {
    form.resetFields();
    setSelected(turno);
  }, [form]);
  const columns = useMemo<TableColumnsType<TurnoAgenda>>(
    () => [
      { title: "HORARIO", key: "hora", render: (_, turno) => <span className="time-cell">{turno.hora.slice(0, 5)} <small>a {turno.horafin.slice(0, 5)}</small></span> },
      { title: "CANCHA", dataIndex: "servicioNombre", key: "cancha" },
      { title: "DURACIÓN", key: "duracion", responsive: ["md"], render: (_, turno) => `${duration(turno)} min` },
      { title: "ESTADO", key: "estado", render: (_, turno) => turno.disponible ? <Tag color="success">Disponible</Tag> : <Tag>Ocupado</Tag> },
      { title: "", key: "action", align: "right", render: (_, turno) => turno.disponible ? <Button type="primary" shape="round" href="https://neptunia.brio.club/" target="_blank">Reservar</Button> : <Button shape="round" icon={<BellOutlined />} onClick={() => openAlert(turno)}>Notificar baja</Button> },
    ],
    [openAlert],
  );

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
        <nav><span className="user-name">Hola, {username}</span><form action="/api/logout" method="post"><Button htmlType="submit" type="text" icon={<LogoutOutlined />}>Salir</Button></form></nav>
      </header>
      <section className="hero">
        <div><p className="eyebrow">NEPTUNIA · DISPONIBILIDAD EN VIVO</p><h1>Reservá tu cancha<br />de forma simple.</h1><p className="hero-copy">Elegí el día, encontrá tu horario y seguí jugando.</p></div>
        <div className="hero-ball-wrap" aria-hidden="true"><div className="tennis-ball hero-ball" /></div>
      </section>
      <section className="date-strip">
        <div className="date-picker-group"><span><CalendarOutlined /> Elegí una fecha</span><DatePicker value={dayjs(fecha)} minDate={dayjs(localDate())} onChange={changeDate} format="dddd D [de] MMMM" allowClear={false} /></div>
        <div className="quick-dates"><Button type={fecha === localDate() ? "primary" : "default"} onClick={() => setFecha(localDate())}>Hoy</Button><Button type={fecha === localDate(1) ? "primary" : "default"} onClick={() => setFecha(localDate(1))}>Mañana</Button><Button type={fecha === localDate(2) ? "primary" : "default"} onClick={() => setFecha(localDate(2))}>Pasado</Button></div>
      </section>
      <section className="results">
        <div className="results-head">
          <div><p className="eyebrow"><ClockCircleOutlined /> TURNOS Y DISPONIBILIDAD</p><h2>{prettyDate(fecha)}</h2><p className="muted">{loading ? "Consultando canchas…" : `${availableCount} disponibles de ${turnos.length} turnos futuros en ${courts} canchas`}{updated && !loading ? ` · actualizado ${updated.toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" })}` : ""}</p></div>
          <Button onClick={() => void load()} disabled={loading} icon={<ReloadOutlined spin={loading} />}>{loading ? "Actualizando" : "Actualizar"}</Button>
        </div>
        {error ? <Alert className="results-state" message="No pudimos consultar Brio" description={error} type="error" showIcon action={<Button onClick={() => void load()}>Reintentar</Button>} /> : loading ? <div className="results-state"><Skeleton active paragraph={{ rows: 4 }} /></div> : turnos.length === 0 ? <div className="results-state"><Empty description="No hay turnos disponibles para esta fecha" /></div> : <Table className="slots-table" columns={columns} dataSource={turnos} rowKey="id" pagination={false} scroll={{ x: 680 }} />}
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
      <footer><span className="tennis-ball tiny-ball" /> Tenis Santivillabrile · Datos provistos por Brio Club</footer>
    </main>
  );
}
