"use client";

import { CalendarOutlined, DeleteOutlined, LogoutOutlined, PlusOutlined, RobotOutlined, SearchOutlined } from "@ant-design/icons";
import { App, AutoComplete, Button, Card, Checkbox, Empty, Form, Modal, Select, Skeleton, Tag } from "antd";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import type { AutomationRule } from "@/lib/automations";
import MemberMenu, { type MemberOption } from "@/app/member-menu";

const horarios = ["08:00", "09:15", "10:30", "11:45", "13:00", "14:15", "15:30", "16:45", "18:00", "19:15", "20:30", "21:45"];
const canchas = [{ value: 14, label: "Cancha 1" }, { value: 15, label: "Cancha 2" }, { value: 16, label: "Cancha 3" }, { value: 17, label: "Cancha 4" }];
const dias = [{ value: 1, label: "Lunes" }, { value: 2, label: "Martes" }, { value: 3, label: "Miércoles" }, { value: 4, label: "Jueves" }, { value: 5, label: "Viernes" }, { value: 6, label: "Sábado" }, { value: 0, label: "Domingo" }];
const dia = (value: number) => dias.find((item) => item.value === value)?.label || "";

export default function AutomationsPage({ currentMemberId, members }: { currentMemberId: string; members: MemberOption[] }) {
  const { message } = App.useApp();
  const [form] = Form.useForm();
  const [rules, setRules] = useState<AutomationRule[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
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
  const save = async (values: { hora: string; servicioId: number; servicioId2?: number; colegaId: string; diasJuego: number[]; diasEjecucion: number[] }) => {
    setSaving(true);
    try {
      const colleague = colleagues.find((item) => item.value === values.colegaId);
      const response = await fetch("/api/automatizaciones", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...values, hora: `${values.hora}:00`, colegaNombre: colleague?.label || "Compañero" }) });
      const json = await response.json();
      if (!response.ok) throw new Error(json.error || "No se pudo guardar la automatización");
      setOpen(false); form.resetFields(); message.success("Reserva automática creada"); await load();
    } catch (error) { message.error(error instanceof Error ? error.message : "No se pudo guardar"); }
    finally { setSaving(false); }
  };
  const remove = async (id: string) => {
    const response = await fetch(`/api/automatizaciones?id=${encodeURIComponent(id)}`, { method: "DELETE" });
    const json = await response.json();
    if (!response.ok) { message.error(json.error || "No se pudo eliminar"); return; }
    setRules((current) => current.filter((rule) => rule.id !== id)); message.success("Automatización eliminada");
  };

  return <main className="dashboard">
    <header className="topbar"><Link href="/turnos" className="brand"><span className="tennis-ball mini" /> TENIS</Link><nav><Button href="/turnos" type="text" icon={<CalendarOutlined />}><span className="desktop-only">Disponibilidad</span><span className="mobile-only">Ver</span></Button><Button href="/reservas" type="text" icon={<CalendarOutlined />}><span className="desktop-only">Mis reservas</span><span className="mobile-only">Reservas</span></Button><Button href="/automatizaciones" type="text" icon={<RobotOutlined />}><span className="desktop-only">Automatizar</span><span className="mobile-only">Auto</span></Button><MemberMenu currentId={currentMemberId} members={members} /><form action="/api/logout" method="post"><Button htmlType="submit" type="text" icon={<LogoutOutlined />}><span className="desktop-only">Salir</span></Button></form></nav></header>
    <section className="reservations-page automations-page">
      <div className="reservations-heading"><div><p className="eyebrow"><RobotOutlined /> RESERVAS AUTOMÁTICAS</p><h1>Jugá sin acordarte<br />de reservar.</h1><p className="muted">Creamos el próximo turno cuando Brio permita hacerlo, siempre respetando el límite de dos reservas.</p></div><Button type="primary" size="large" icon={<PlusOutlined />} onClick={() => setOpen(true)}>Agregar reserva automática</Button></div>
      {!credentialsEnabled ? <Card className="automation-warning"><strong>Falta habilitar esta cuenta</strong><p>Para ejecutar reservas en segundo plano, cerrá sesión y volvé a entrar a Neptunia marcando “Habilitar reservas automáticas con esta cuenta”.</p></Card> : null}
      {loading ? <Skeleton active paragraph={{ rows: 5 }} /> : rules.length ? <div className="automation-grid">{rules.map((rule) => <Card key={rule.id} className="automation-card" actions={[<Button key="delete" danger type="text" icon={<DeleteOutlined />} onClick={() => void remove(rule.id)}>Eliminar</Button>]}><Tag color="orange">Activa</Tag><h2>{rule.hora.slice(0, 5)} · Cancha {rule.servicioId - 13}{rule.servicioId2 ? ` → Cancha ${rule.servicioId2 - 13}` : ""}</h2><p><strong>Con:</strong> {rule.colegaNombre}</p><p><strong>Juego:</strong> {rule.diasJuego.map(dia).join(", ")}</p><p><strong>Buscar:</strong> {rule.diasEjecucion.map(dia).join(", ")}</p></Card>)}</div> : <Empty description="Todavía no configuraste reservas automáticas" />}
    </section>
    <Modal title="Agregar reserva automática" open={open} onCancel={() => setOpen(false)} footer={null} destroyOnHidden>
      <p className="alert-note">El sistema busca el próximo día de juego, y reserva solo cuando el cron esté habilitado para ese día.</p>
      <Form form={form} layout="vertical" onFinish={save} initialValues={{ diasEjecucion: [1, 2, 3, 4], diasJuego: [2, 4] }}>
        <Form.Item label="Horario" name="hora" rules={[{ required: true }]}><Select options={horarios.map((value) => ({ value, label: value }))} /></Form.Item>
        <Form.Item label="Cancha prioridad 1" name="servicioId" rules={[{ required: true }]}><Select options={canchas} /></Form.Item>
        <Form.Item label="Cancha prioridad 2 (opcional)" name="servicioId2"><Select allowClear placeholder="Sin cancha alternativa" options={canchas} /></Form.Item>
        <Form.Item label="Compañero" name="colegaId" rules={[{ required: true, message: "Buscá y elegí un compañero" }]}><AutoComplete options={colleagues} onSearch={searchColleague} placeholder="Buscá por nombre (ej. Diego)" prefix={<SearchOutlined />} /></Form.Item>
        <Form.Item label="Días que quiero jugar" name="diasJuego" rules={[{ required: true }]}><Checkbox.Group options={dias} /></Form.Item>
        <Form.Item label="Días en que puede reservar" name="diasEjecucion" rules={[{ required: true }]}><Checkbox.Group options={dias} /></Form.Item>
        <Button type="primary" htmlType="submit" loading={saving} block>Crear automatización</Button>
      </Form>
    </Modal>
  </main>;
}
