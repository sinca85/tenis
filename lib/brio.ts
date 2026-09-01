import type { Turno, TurnosResponse } from "@/lib/types";

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export async function getTurnos(fecha: string): Promise<Turno[]> {
  if (!DATE_PATTERN.test(fecha)) throw new Error("Fecha inválida");

  const baseUrl = process.env.BRIO_BASE_URL || "https://neptunia.brio.club";
  const sede = process.env.BRIO_SEDE_ID || "4";
  const servicio = process.env.BRIO_TIPO_SERVICIO_ID || "1";
  const socio = process.env.BRIO_SOCIO_ID;
  const cookie = process.env.BRIO_COOKIE;
  const desde = Number(process.env.BRIO_HORA_DESDE || 7);
  const hasta = Number(process.env.BRIO_HORA_HASTA || 23);

  if (!socio) throw new Error("Falta configurar BRIO_SOCIO_ID");

  const requests = Array.from({ length: hasta - desde + 1 }, (_, index) => desde + index).map(
    async (hora) => {
      const url = new URL(
        `/turno/sede/${sede}/st/${servicio}/fecha/${fecha}/socio/${socio}/horario/${hora}/turnos/json`,
        baseUrl,
      );
      const response = await fetch(url, {
        headers: {
          Accept: "application/json",
          "User-Agent": "tenis.santivillabrile.com",
          ...(cookie ? { Cookie: cookie } : {}),
        },
        cache: "no-store",
        redirect: "manual",
        signal: AbortSignal.timeout(8_000),
      });
      if (response.status >= 300 && response.status < 400) {
        throw new Error("Brio requiere una sesión autenticada o la sesión configurada venció");
      }
      if (!response.ok) throw new Error(`Brio respondió ${response.status} para las ${hora}hs`);
      const contentType = response.headers.get("content-type") || "";
      if (!contentType.includes("application/json")) {
        throw new Error("Brio no devolvió JSON; verificá la sesión configurada");
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
