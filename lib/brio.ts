import type { Turno, TurnosResponse } from "@/lib/types";

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const LOGIN_PATH = "/accounts/login/";
const SESSION_TTL_MS = 20 * 60 * 1_000;
const BRIO_BASE_URL = "https://neptunia.brio.club";
const BRIO_SOCIO_ID = "565be911-6d72-4b32-8714-e192333ee7ad";
const BRIO_SEDE_ID = 4;
const BRIO_TIPO_SERVICIO_ID = 1;
const BRIO_HORA_DESDE = 7;
const BRIO_HORA_HASTA = 23;

type BrioSession = { cookie: string; expiresAt: number };

let sessionPromise: Promise<BrioSession> | null = null;

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

async function loginToBrio(): Promise<BrioSession> {
  const baseUrl = BRIO_BASE_URL;
  const username = process.env.USERNAME;
  const password = process.env.PASSWORD;

  if (!username || !password) {
    throw new Error("Falta configurar USERNAME y PASSWORD para iniciar sesión en Brio");
  }

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

  return { cookie, expiresAt: Date.now() + SESSION_TTL_MS };
}

async function getBrioCookie() {
  if (!sessionPromise) sessionPromise = loginToBrio();

  try {
    const session = await sessionPromise;
    if (session.expiresAt <= Date.now()) {
      sessionPromise = loginToBrio();
      return (await sessionPromise).cookie;
    }
    return session.cookie;
  } catch (error) {
    sessionPromise = null;
    throw error;
  }
}

export async function getTurnos(fecha: string): Promise<Turno[]> {
  if (!DATE_PATTERN.test(fecha)) throw new Error("Fecha inválida");

  const cookie = await getBrioCookie();

  const requests = Array.from(
    { length: BRIO_HORA_HASTA - BRIO_HORA_DESDE + 1 },
    (_, index) => BRIO_HORA_DESDE + index,
  ).map(
    async (hora) => {
      const url = new URL(
        `/turno/sede/${BRIO_SEDE_ID}/st/${BRIO_TIPO_SERVICIO_ID}/fecha/${fecha}/socio/${BRIO_SOCIO_ID}/horario/${hora}/turnos/json`,
        BRIO_BASE_URL,
      );
      const response = await fetch(url, {
        headers: { Accept: "application/json", Cookie: cookie, "User-Agent": "tenis.santivillabrile.com" },
        cache: "no-store",
        redirect: "manual",
        signal: AbortSignal.timeout(8_000),
      });
      if (response.status >= 300 && response.status < 400) {
        sessionPromise = null;
        throw new Error("La sesión de Brio venció; volvé a actualizar para iniciar otra");
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
