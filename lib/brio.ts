import type { Colega, ConsultaCancelacion, ConsultaReserva, PreReserva, ReservaConfirmada, ReservaUsuario, Turno, TurnoAgenda, TurnosResponse } from "@/lib/types";
import type { BrioAuth, BrioMember } from "@/lib/brio-session";

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const LOGIN_PATH = "/accounts/login/";
const BRIO_BASE_URL = "https://neptunia.brio.club";
const BRIO_SEDE_ID = 4;
const BRIO_TIPO_SERVICIO_ID = 1;
const BRIO_HORA_DESDE = 7;
const BRIO_HORA_HASTA = 23;
const TIME_ZONE = "America/Argentina/Cordoba";
const CANCHAS = [
  { id: 14, nombre: "Cancha 01" },
  { id: 15, nombre: "Cancha 02" },
  { id: 16, nombre: "Cancha 03" },
  { id: 17, nombre: "Cancha 04" },
] as const;
const HORARIOS = [
  "08:00:00", "09:15:00", "10:30:00", "11:45:00", "13:00:00", "14:15:00",
  "15:30:00", "16:45:00", "18:00:00", "19:15:00", "20:30:00", "21:45:00",
] as const;

let legacySessionPromise: Promise<BrioAuth> | null = null;

function cookiePairs(response: Response) {
  const headers = response.headers as Headers & { getSetCookie?: () => string[] };
  const values = headers.getSetCookie?.() ?? [];
  if (!values.length) {
    const value = response.headers.get("set-cookie");
    if (value) values.push(value);
  }
  return values.map((value) => value.split(";", 1)[0]).filter(Boolean);
}

function mergeCookies(...groups: string[][]) {
  const cookies = new Map<string, string>();
  groups.flat().forEach((pair) => {
    const separator = pair.indexOf("=");
    if (separator > 0) cookies.set(pair.slice(0, separator), pair.slice(separator + 1));
  });
  return [...cookies].map(([name, value]) => `${name}=${value}`).join("; ");
}

function hiddenCsrfToken(html: string) {
  return html.match(/name=["']csrfmiddlewaretoken["'][^>]*value=["']([^"']+)["']/i)?.[1];
}

export async function authenticateBrio(username: string, password: string): Promise<BrioAuth> {
  const baseUrl = BRIO_BASE_URL;
  if (!username.trim() || !password) throw new Error("Ingresá tu usuario y contraseña de Neptunia");

  const loginUrl = new URL(LOGIN_PATH, baseUrl);
  const page = await fetch(loginUrl, {
    headers: { Accept: "text/html", "User-Agent": "tenis.santivillabrile.com" },
    cache: "no-store",
    redirect: "manual",
    signal: AbortSignal.timeout(10_000),
  });
  if (!page.ok) throw new Error(`No se pudo abrir el login de Brio (${page.status})`);

  const initialCookies = cookiePairs(page);
  const html = await page.text();
  const token = hiddenCsrfToken(html) || process.env.BRIO_TOKEN;
  if (!token) throw new Error("Brio no entregó un csrfmiddlewaretoken");

  const form = new URLSearchParams({ username, password, csrfmiddlewaretoken: token });
  const login = await fetch(loginUrl, {
    method: "POST",
    headers: {
      Accept: "text/html",
      "Content-Type": "application/x-www-form-urlencoded",
      Cookie: mergeCookies(initialCookies),
      Origin: new URL(baseUrl).origin,
      Referer: loginUrl.toString(),
      "User-Agent": "tenis.santivillabrile.com",
    },
    body: form,
    cache: "no-store",
    redirect: "manual",
    signal: AbortSignal.timeout(10_000),
  });

  const cookie = mergeCookies(initialCookies, cookiePairs(login));
  const location = login.headers.get("location") || "";
  const authenticated = login.status >= 300 && login.status < 400 && !location.includes(LOGIN_PATH);
  if (!authenticated || !cookie.includes("sessionid=")) {
    throw new Error("Brio rechazó el usuario o la contraseña");
  }

  const landing = await fetch(new URL(location || "/", baseUrl), {
    headers: { Accept: "text/html", Cookie: cookie, "User-Agent": "tenis.santivillabrile.com" },
    cache: "no-store",
    redirect: "follow",
    signal: AbortSignal.timeout(10_000),
  });
  if (!landing.ok) throw new Error("No pudimos obtener el socio asociado a esta cuenta");
  const landingHtml = await landing.text();
  const socioId = landingHtml.match(/\/carnet\/([0-9a-f-]{36})\//i)?.[1];
  if (!socioId || !validId(socioId)) throw new Error("Brio no informó el socio asociado a esta cuenta");
  const authenticatedCookie = mergeCookies(cookie.split("; "), cookiePairs(landing));
  const familySection = landingHtml.match(/GRUPO FAMILIAR[\s\S]*?PERFIL CLUB/i)?.[0] || landingHtml;
  const memberIds = [...new Set([...familySection.matchAll(/\/carnet\/([0-9a-f-]{36})\//ig)].map((match) => match[1]))];
  const members = await loadMemberProfiles(authenticatedCookie, memberIds.length ? memberIds : [socioId]);
  const selected = members.find((member) => member.socioId === socioId) || members[0];
  return { cookie: authenticatedCookie, socioId: selected.socioId, username: username.trim(), name: selected.name, members };
}

async function loadMemberProfiles(cookie: string, ids: string[]): Promise<BrioMember[]> {
  return Promise.all(ids.map(async (id) => {
    const profile = await fetch(new URL(`/turno/admin/socio/${id}/`, BRIO_BASE_URL), {
      headers: { Accept: "application/json", Cookie: cookie, "User-Agent": "tenis.santivillabrile.com" },
      cache: "no-store",
      signal: AbortSignal.timeout(10_000),
    });
    const data = profile.ok ? await profile.json() as { nombre?: string } : {};
    return { socioId: id, name: data.nombre?.trim() || "Socio" };
  }));
}

async function getLegacySession() {
  if (!legacySessionPromise) {
    const username = process.env.USERNAME;
    const password = process.env.PASSWORD;
    if (!username || !password) throw new Error("La tarea automática no tiene una sesión de Brio configurada");
    legacySessionPromise = authenticateBrio(username, password);
  }
  try {
    return await legacySessionPromise;
  } catch (error) {
    legacySessionPromise = null;
    throw error;
  }
}

async function brioJson<T>(auth: BrioAuth, path: string): Promise<T> {
  const response = await fetch(new URL(path, BRIO_BASE_URL), {
    headers: { Accept: "application/json", Cookie: auth.cookie, "User-Agent": "tenis.santivillabrile.com" },
    cache: "no-store",
    redirect: "manual",
    signal: AbortSignal.timeout(10_000),
  });
  if (response.status >= 300 && response.status < 400) {
    throw new Error("Tu sesión de Neptunia venció; volvé a iniciar sesión");
  }
  if (!response.ok) throw new Error(`Brio respondió ${response.status}`);
  const contentType = response.headers.get("content-type") || "";
  if (!contentType.includes("application/json")) throw new Error("Brio no devolvió una respuesta válida");
  return response.json() as Promise<T>;
}

async function brioText(auth: BrioAuth, path: string) {
  const response = await fetch(new URL(path, BRIO_BASE_URL), {
    headers: { Accept: "text/html", Cookie: auth.cookie, "User-Agent": "tenis.santivillabrile.com" },
    cache: "no-store",
    redirect: "manual",
    signal: AbortSignal.timeout(10_000),
  });
  if (response.status >= 300 && response.status < 400) throw new Error("Tu sesión de Neptunia venció; volvé a iniciar sesión");
  if (!response.ok) throw new Error(`Brio respondió ${response.status}`);
  return response.text();
}

function validId(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

export async function consultarReserva(auth: BrioAuth, turnoId: string) {
  if (!validId(turnoId)) throw new Error("Turno inválido");
  const response = await brioJson<ConsultaReserva>(auth, `/turno/consultar/${turnoId}/socio/${auth.socioId}/`);
  if (!response.status) throw new Error(response.mensaje || "El turno ya no está disponible");
  return response;
}

export async function iniciarPreReserva(auth: BrioAuth, turnoId: string) {
  if (!validId(turnoId)) throw new Error("Turno inválido");
  const response = await brioJson<PreReserva>(auth, `/turno/prereserva/${turnoId}/socio/${auth.socioId}/`);
  if (!response.status) throw new Error(response.mensaje || "El turno ya no está disponible");
  return response;
}

export async function buscarColegas(auth: BrioAuth, turnoId: string, search: string) {
  if (!validId(turnoId)) throw new Error("Turno inválido");
  const params = new URLSearchParams({
    turnoid: turnoId,
    reservarcanchas: "true",
    guid: auth.socioId,
    sede: String(BRIO_SEDE_ID),
    serviciotipo: String(BRIO_TIPO_SERVICIO_ID),
    search: search.trim(),
  });
  const response = await brioJson<{ status?: boolean; data?: Colega[] }>(auth, `/turno/getcolegas/?${params}`);
  return Array.isArray(response.data) ? response.data : [];
}

export async function confirmarReserva(auth: BrioAuth, turnoId: string, colegaId: string) {
  if (!validId(turnoId) || !validId(colegaId)) throw new Error("Datos de reserva inválidos");
  const discarded = await cancelarPreReserva(auth, turnoId);
  if (!discarded.status) throw new Error("Brio no pudo completar la pre-reserva");
  const socios = encodeURIComponent(`|${auth.socioId}|${colegaId}`);
  const response = await brioJson<ReservaConfirmada>(auth,
    `/turno/${turnoId}/modificaradmin/${socios}/socios/%7C/?cobrar_turno=true`,
  );
  if (!response.status) throw new Error(response.mensaje || "Brio no pudo confirmar la reserva");
  return response;
}

export async function cancelarPreReserva(auth: BrioAuth, turnoId: string) {
  if (!validId(turnoId)) throw new Error("Turno inválido");
  return brioJson<{ status: boolean }>(auth, `/turno/desestimar/${turnoId}/`);
}

function plainText(value: unknown) {
  return String(value || "").replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
}

export async function getReservas(auth: BrioAuth): Promise<ReservaUsuario[]> {
  const html = await brioText(auth, "/turno/reservas/");
  const ids = [...new Set([...html.matchAll(/verReserva\(['"]([0-9a-f-]{36})['"]\)/ig)].map((match) => match[1]))];
  return Promise.all(ids.map(async (id) => {
    const response = await brioJson<{
      status: boolean;
      data?: { id?: string; nombre?: string; turnoSocioEstado?: string; mensaje?: string; puedoCancelar?: boolean; locked?: boolean };
      socios?: Array<{ apellidonombre?: string }>;
    }>(auth, `/turno/socio/${id}/`);
    if (!response.status || !response.data) throw new Error("Una reserva ya no está disponible");
    const reservation: ReservaUsuario = {
      id,
      turnoId: response.data.id || "",
      nombre: response.data.nombre || "Turno de tenis",
      estado: response.data.turnoSocioEstado || "Reservado",
      mensaje: plainText(response.data.mensaje),
      puedeCancelar: Boolean(response.data.puedoCancelar),
      locked: Boolean(response.data.locked),
      socios: (response.socios || []).map((socio) => socio.apellidonombre || "Socio").filter(Boolean),
    };
    // El endpoint usado por verReserva bloquea el turno durante 120 segundos.
    // Como aquí solo leemos el detalle, replicamos el cierre del modal oficial y lo liberamos enseguida.
    if (!reservation.locked && validId(reservation.turnoId)) {
      try { await cancelarPreReserva(auth, reservation.turnoId); } catch { /* El bloqueo también vence automáticamente. */ }
    }
    return reservation;
  }));
}

export async function consultarCancelacion(auth: BrioAuth, reservaId: string): Promise<ConsultaCancelacion> {
  if (!validId(reservaId)) throw new Error("Reserva inválida");
  const response = await brioJson<{ status: boolean; data?: { mensaje?: string; mensaje1?: string } | string }>(
    auth,
    `/turno/socio/cancelar/${reservaId}/true/`,
  );
  if (!response.status || typeof response.data === "string") throw new Error(plainText(response.data) || "La reserva no puede cancelarse");
  return { mensaje: plainText(response.data?.mensaje) || "Cancelar turno", detalle: plainText(response.data?.mensaje1) };
}

export async function cancelarReserva(auth: BrioAuth, reservaId: string) {
  if (!validId(reservaId)) throw new Error("Reserva inválida");
  const response = await brioJson<{ status: boolean | string; data?: { mensaje?: string; mensaje1?: string } }>(
    auth,
    `/turno/cancelar/${reservaId}/true/`,
  );
  const successful = response.status === true || response.status === "success";
  if (!successful) throw new Error(plainText(response.data?.mensaje) || "Brio no pudo cancelar el turno");
  return { mensaje: plainText(response.data?.mensaje) || "Turno cancelado", detalle: plainText(response.data?.mensaje1) };
}

export async function getSocioName(auth: BrioAuth) {
  const response = await brioJson<{ status: boolean; nombre?: string }>(auth, `/turno/admin/socio/${auth.socioId}/`);
  return response.status && response.nombre?.trim() ? response.nombre.trim() : auth.name;
}

export async function getFamilyMembers(auth: BrioAuth) {
  const html = await brioText(auth, "/");
  const familySection = html.match(/GRUPO FAMILIAR[\s\S]*?PERFIL CLUB/i)?.[0] || html;
  const ids = [...new Set([...familySection.matchAll(/\/carnet\/([0-9a-f-]{36})\//ig)].map((match) => match[1]))];
  return loadMemberProfiles(auth.cookie, ids.length ? ids : [auth.socioId]);
}

export async function getTurnos(fecha: string, userAuth?: BrioAuth): Promise<Turno[]> {
  if (!DATE_PATTERN.test(fecha)) throw new Error("Fecha inválida");

  const auth = userAuth || await getLegacySession();

  const requests = Array.from(
    { length: BRIO_HORA_HASTA - BRIO_HORA_DESDE + 1 },
    (_, index) => BRIO_HORA_DESDE + index,
  ).map(
    async (hora) => {
      const url = new URL(
        `/turno/sede/${BRIO_SEDE_ID}/st/${BRIO_TIPO_SERVICIO_ID}/fecha/${fecha}/socio/${auth.socioId}/horario/${hora}/turnos/json`,
        BRIO_BASE_URL,
      );
      const response = await fetch(url, {
        headers: { Accept: "application/json", Cookie: auth.cookie, "User-Agent": "tenis.santivillabrile.com" },
        cache: "no-store",
        redirect: "manual",
        signal: AbortSignal.timeout(8_000),
      });
      if (response.status >= 300 && response.status < 400) {
        throw new Error("Tu sesión de Neptunia venció; volvé a iniciar sesión");
      }
      if (!response.ok) throw new Error(`Brio respondió ${response.status} para las ${hora}hs`);
      const contentType = response.headers.get("content-type") || "";
      if (!contentType.includes("application/json")) {
        throw new Error("Brio no devolvió JSON; verificá las credenciales configuradas");
      }
      const json = (await response.json()) as TurnosResponse;
      return Array.isArray(json.data) ? json.data : [];
    },
  );

  const settled = await Promise.allSettled(requests);
  const successful = settled.filter(
    (result): result is PromiseFulfilledResult<Turno[]> => result.status === "fulfilled",
  );
  if (!successful.length) {
    const firstFailure = settled.find(
      (result): result is PromiseRejectedResult => result.status === "rejected",
    );
    throw firstFailure?.reason instanceof Error
      ? firstFailure.reason
      : new Error("No se pudo consultar la disponibilidad de Brio");
  }

  const unique = new Map<string, Turno>();
  successful.flatMap((result) => result.value).forEach((turno) => unique.set(turno.id, turno));
  return [...unique.values()]
    .filter((turno) => turno.activo && !turno.locked)
    .sort((a, b) => `${a.hora}-${a.servicioNombre}`.localeCompare(`${b.hora}-${b.servicioNombre}`));
}

function argentinaNow() {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date());
  const value = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return { date: `${value.year}-${value.month}-${value.day}`, time: `${value.hour}:${value.minute}` };
}

function endTime(start: string) {
  const [hour, minute] = start.split(":").map(Number);
  const total = hour * 60 + minute + 60;
  return `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}:00`;
}

export async function getAgenda(fecha: string, auth?: BrioAuth): Promise<TurnoAgenda[]> {
  const disponibles = await getTurnos(fecha, auth);
  const bySlot = new Map(
    disponibles.map((turno) => [`${turno.servicio_id}:${turno.hora}`, turno] as const),
  );
  const now = argentinaNow();

  if (fecha < now.date) return [];

  return HORARIOS.flatMap((hora) =>
    CANCHAS.map((cancha): TurnoAgenda => {
      const libre = bySlot.get(`${cancha.id}:${hora}`);
      return {
        id: libre?.id || `ocupado-${fecha}-${cancha.id}-${hora.slice(0, 5).replace(":", "")}`,
        fecha,
        hora,
        horafin: libre?.horafin || endTime(hora),
        servicio_id: cancha.id,
        servicioNombre: cancha.nombre,
        disponible: Boolean(libre),
      };
    }),
  )
    .filter((turno) => fecha !== now.date || turno.hora.slice(0, 5) > now.time)
    .sort((a, b) => `${a.hora}-${a.servicioNombre}`.localeCompare(`${b.hora}-${b.servicioNombre}`));
}
