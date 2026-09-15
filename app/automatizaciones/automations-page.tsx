"use client";

import { CalendarOutlined, DeleteOutlined, EditOutlined, LogoutOutlined, MinusCircleOutlined, PlusOutlined, RobotOutlined, SearchOutlined } from "@ant-design/icons";
import { App, AutoComplete, Button, Card, Checkbox, DatePicker, Empty, Form, Modal, Select, Skeleton, Tag } from "antd";
import dayjs, { type Dayjs } from "dayjs";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import type { AutomationRule } from "@/lib/automations";
import MemberMenu, { type MemberOption } from "@/app/member-menu";

const horarios = ["08:00", "09:15", "10:30", "11:45", "13:00", "14:15", "15:30", "16:45", "18:00", "19:15", "20:30", "21:45"];
const horasCorte = Array.from({ length: 24 }, (_, hour) => `${String(hour).padStart(2, "0")}:00`);
const canchas = [{ value: 14, label: "Cancha 1" }, { value: 15, label: "Cancha 2" }, { value: 16, label: "Cancha 3" }, { value: 17, label: "Cancha 4" }];
const dias = [{ value: 1, label: "Lunes" }, { value: 2, label: "Martes" }, { value: 3, label: "Miércoles" }, { value: 4, label: "Jueves" }, { value: 5, label: "Viernes" }, { value: 6, label: "Sábado" }, { value: 0, label: "Domingo" }];
const dia = (value: number) => dias.find((item) => item.value === value)?.label || "";
const fechaArgentina = () => {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Argentina/Cordoba", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(new Date());
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
};

export default function AutomationsPage({ currentMemberId, members }: { currentMemberId: string; members: MemberOption[] }) {
  const { message } = App.useApp();
  const [form] = Form.useForm();
  const [rules, setRules] = useState<AutomationRule[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [pauseOpen, setPauseOpen] = useState(false);
  const [pauseRule, setPauseRule] = useState<AutomationRule | null>(null);
  const [pauseForm] = Form.useForm<{ pausadaHasta: Dayjs }>();
  const [editing, setEditing] = useState<AutomationRule | null>(null);
  const [saving, setSaving] = useState(false);
  const [credentialsEnabled, setCredentialsEnabled] = useState(false);
  const [colleagues, setColleagues] = useState<Array<{ value: string; label: string }>>([]);
  const colleagueSearchTimer = useRef<number | undefined>(undefined);

  const load = async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/automatizaciones", { cache: "no-store" });
      const json = await response.json();
      if (!response.ok) throw new Error(json.error || "No se pudieron cargar las reglas");
      setRules(json.data); setCredentialsEnabled(Boolean(json.credentialsEnabled));
    } catch (error) { message.error(error instanceof Error ? error.message : "Error inesperado"); }
    finally { setLoading(false); }
  };
  useEffect(() => {
    const timer = window.setTimeout(() => { void load(); }, 0);
    return () => window.clearTimeout(timer);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => () => {
    if (colleagueSearchTimer.current) window.clearTimeout(colleagueSearchTimer.current);
  }, []);

  const searchColleague = (query: string) => {
    if (colleagueSearchTimer.current) window.clearTimeout(colleagueSearchTimer.current);
    if (query.trim().length < 3) { setColleagues([]); return; }
    colleagueSearchTimer.current = window.setTimeout(async () => {
      try {
        const response = await fetch(`/api/automatizaciones?search=${encodeURIComponent(query)}`, { cache: "no-store" });
        const json = await response.json();
        if (!response.ok) throw new Error(json.error || "No se pudo buscar el compañero");
        setColleagues((json.data || []).map((person: { socioid: string; apellidonombre: string }) => ({ value: person.socioid, label: person.apellidonombre })));
      } catch (error) { message.error(error instanceof Error ? error.message : "No se pudo buscar el compañero"); }
    }, 550);
  };
  const save = async (values: { hora: string; servicioId: number; servicioId2?: number; colegaId: string; diasJuego: number[]; diasEjecucion: number[]; diaCorte?: number; horaCorte?: string }) => {
    setSaving(true);
    try {
      const colleague = colleagues.find((item) => item.value === values.colegaId);
      const response = await fetch("/api/automatizaciones", { method: editing ? "PUT" : "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...values, id: editing?.id, hora: `${values.hora}:00`, colegaNombre: colleague?.label || editing?.colegaNombre || "Compañero" }) });
      const json = await response.json();
      if (!response.ok) throw new Error(json.error || "No se pudo guardar la automatización");
      setOpen(false); setEditing(null); form.resetFields(); message.success(editing ? "Automatización actualizada" : "Reserva automática creada"); await load();
    } catch (error) { message.error(error instanceof Error ? error.message : "No se pudo guardar"); }
    finally { setSaving(false); }
  };
  const startCreate = () => { setEditing(null); setColleagues([]); form.resetFields(); setOpen(true); };
  const startEdit = (rule: AutomationRule) => {
    setEditing(rule);
    setColleagues([{ value: rule.colegaId, label: rule.colegaNombre }]);
    form.setFieldsValue({ hora: rule.hora.slice(0, 5), servicioId: rule.servicioId, servicioId2: rule.servicioId2, colegaId: rule.colegaId, diasJuego: rule.diasJuego, diasEjecucion: rule.diasEjecucion, diaCorte: rule.diaCorte, horaCorte: rule.horaCorte });
    setOpen(true);
  };
  const remove = async (id: string) => {
    const response = await fetch(`/api/automatizaciones?id=${encodeURIComponent(id)}`, { method: "DELETE" });
    const json = await response.json();
    if (!response.ok) { message.error(json.error || "No se pudo eliminar"); return; }
    setRules((current) => current.filter((rule) => rule.id !== id)); message.success("Automatización eliminada");
  };
  const pauseReservation = async (values: { pausadaHasta: Dayjs }) => {
    if (!pauseRule) return;
    try {
      const response = await fetch("/api/automatizaciones", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: pauseRule.id, action: "pause", pausadaHasta: values.pausadaHasta.toISOString() }) });
      const json = await response.json();
      if (!response.ok) throw new Error(json.error || "No se pudo actualizar la automatización");
      setRules((current) => current.map((item) => item.id === pauseRule.id ? json.data : item));
      setPauseOpen(false); setPauseRule(null); pauseForm.resetFields();
      message.success("La reserva automática quedó pausada");
    } catch (error) { message.error(error instanceof Error ? error.message : "No se pudo actualizar"); }
  };
  const resumeReservation = async (rule: AutomationRule) => {
    try {
      const response = await fetch("/api/automatizaciones", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: rule.id, action: "resume" }) });
      const json = await response.json();
      if (!response.ok) throw new Error(json.error || "No se pudo actualizar la automatización");
      setRules((current) => current.map((item) => item.id === rule.id ? json.data : item));
      message.success("La reserva automática volvió a estar activa");
    } catch (error) { message.error(error instanceof Error ? error.message : "No se pudo actualizar"); }
  };
  const startPause = (rule: AutomationRule) => { setPauseRule(rule); pauseForm.setFieldsValue({ pausadaHasta: dayjs().add(1, "day").hour(20).minute(0).second(0) }); setPauseOpen(true); };

  return <main className="dashboard">
    <header className="topbar"><Link href="/turnos" className="brand"><span className="tennis-ball mini" /> TENIS</Link><nav><Button href="/turnos" type="text" icon={<CalendarOutlined />}><span className="desktop-only">Disponibilidad</span><span className="mobile-only">Ver</span></Button><Button href="/reservas" type="text" icon={<CalendarOutlined />}><span className="desktop-only">Mis reservas</span><span className="mobile-only">Reservas</span></Button><Button href="/automatizaciones" type="text" icon={<RobotOutlined />}><span className="desktop-only">Automatizar</span><span className="mobile-only">Auto</span></Button><MemberMenu currentId={currentMemberId} members={members} /><form action="/api/logout" method="post"><Button htmlType="submit" type="text" icon={<LogoutOutlined />}><span className="desktop-only">Salir</span></Button></form></nav></header>
    <section className="reservations-page automations-page">
      <div className="reservations-heading"><div><p className="eyebrow"><RobotOutlined /> RESERVAS AUTOMÁTICAS</p><h1>Jugá sin acordarte<br />de reservar.</h1><p className="muted">Creamos el próximo turno cuando Brio permita hacerlo, siempre respetando el límite de dos reservas.</p></div><Button type="primary" size="large" icon={<PlusOutlined />} onClick={startCreate}>Agregar reserva automática</Button></div>
      {!credentialsEnabled ? <Card className="automation-warning"><strong>Falta habilitar esta cuenta</strong><p>Para ejecutar reservas en segundo plano, cerrá sesión y volvé a entrar a Neptunia marcando “Habilitar reservas automáticas con esta cuenta”.</p></Card> : null}
      {loading ? <Skeleton active paragraph={{ rows: 5 }} /> : rules.length ? <div className="automation-grid">{rules.map((rule) => { const paused = Boolean(rule.pausadaHasta && Date.parse(rule.pausadaHasta) > Date.now()); return <Card key={rule.id} className="automation-card" actions={[<Button key="pause" type="text" icon={<MinusCircleOutlined />} onClick={() => paused ? void resumeReservation(rule) : startPause(rule)}>{paused ? "Reactivar reserva" : "Pausar reserva"}</Button>, <Button key="edit" type="text" icon={<EditOutlined />} onClick={() => startEdit(rule)}>Editar</Button>, <Button key="delete" danger type="text" icon={<DeleteOutlined />} onClick={() => void remove(rule.id)}>Eliminar</Button>]}><Tag color={paused ? "default" : "orange"}>{paused ? "Saltea turnos" : "Activa"}</Tag><h2>{rule.hora.slice(0, 5)} · Cancha {rule.servicioId - 13}{rule.servicioId2 ? ` → Cancha ${rule.servicioId2 - 13}` : ""}</h2><p><strong>Con:</strong> {rule.colegaNombre}</p><p><strong>Juego:</strong> {rule.diasJuego.map(dia).join(", ")}</p><p><strong>Buscar:</strong> {rule.diasEjecucion.map(dia).join(", ")}</p>{paused ? <p><strong>Saltear hasta:</strong> {new Intl.DateTimeFormat("es-AR", { dateStyle: "short", timeStyle: "short", timeZone: "America/Argentina/Cordoba" }).format(new Date(rule.pausadaHasta!))}</p> : null}{rule.diaCorte !== undefined && rule.horaCorte ? <p><strong>Pausar desde:</strong> {dia(rule.diaCorte)} {rule.horaCorte}</p> : null}</Card>; })}</div> : <Empty description="Todavía no configuraste reservas automáticas" />}
    </section>
    <Modal title="Pausar reserva automática" open={pauseOpen} onCancel={() => { setPauseOpen(false); setPauseRule(null); }} footer={null} destroyOnHidden>
      <p className="alert-note">Se saltean los turnos de esta regla anteriores a esa fecha. Los siguientes —por ejemplo, el del jueves— pueden reservarse normalmente.</p>
      <Form form={pauseForm} layout="vertical" onFinish={pauseReservation}>
        <Form.Item label="No reservar hasta" name="pausadaHasta" rules={[{ required: true, message: "Elegí hasta cuándo pausarla" }]}><DatePicker showTime format="DD/MM/YYYY HH:mm" minuteStep={5} disabledDate={(date) => date.endOf("day") < dayjs().startOf("day")} style={{ width: "100%" }} /></Form.Item>
        <Button type="primary" htmlType="submit" block>Pausar reserva</Button>
      </Form>
    </Modal>
    <Modal title={editing ? "Editar reserva automática" : "Agregar reserva automática"} open={open} onCancel={() => { setOpen(false); setEditing(null); }} footer={null} destroyOnHidden>
      <p className="alert-note">El sistema busca el próximo día de juego, y reserva solo cuando el cron esté habilitado para ese día.</p>
      <Form form={form} layout="vertical" onFinish={save} initialValues={{ diasEjecucion: [1, 2, 3, 4], diasJuego: [2, 4] }}>
        <Form.Item label="Horario" name="hora" rules={[{ required: true }]}><Select options={horarios.map((value) => ({ value, label: value }))} /></Form.Item>
        <Form.Item label="Cancha prioridad 1" name="servicioId" rules={[{ required: true }]}><Select options={canchas} /></Form.Item>
        <Form.Item label="Cancha prioridad 2 (opcional)" name="servicioId2"><Select allowClear placeholder="Sin cancha alternativa" options={canchas} /></Form.Item>
        <Form.Item label="Compañero" name="colegaId" rules={[{ required: true, message: "Buscá y elegí un compañero" }]}><AutoComplete options={colleagues} onSearch={searchColleague} placeholder="Buscá por nombre (ej. Diego)" prefix={<SearchOutlined />} /></Form.Item>
        <Form.Item label="Días que quiero jugar" name="diasJuego" rules={[{ required: true }]}><Checkbox.Group options={dias} /></Form.Item>
        <Form.Item label="Días en que puede reservar" name="diasEjecucion" rules={[{ required: true }]}><Checkbox.Group options={dias} /></Form.Item>
        <Form.Item label="Dejar de intentar desde (opcional)"><div className="automation-cutoff"><Form.Item name="diaCorte" noStyle><Select allowClear placeholder="Día" options={dias} /></Form.Item><Form.Item name="horaCorte" noStyle><Select allowClear placeholder="Hora" options={horasCorte.map((value) => ({ value, label: value }))} /></Form.Item></div></Form.Item>
        <Button type="primary" htmlType="submit" loading={saving} block>{editing ? "Guardar cambios" : "Crear automatización"}</Button>
      </Form>
    </Modal>
  </main>;
}
