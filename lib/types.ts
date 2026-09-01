export type Turno = {
  id: string;
  sede_id: number;
  servicio_id: number;
  fecha: string;
  hora: string;
  horafin: string;
  fechahora: string;
  nombre: string;
  servicioNombre: string;
  activo: boolean;
  locked: boolean;
  pagado: boolean;
};

export type TurnosResponse = {
  status: boolean;
  data: Turno[];
  mensaje?: string;
};

export type TurnoAgenda = {
  id: string;
  fecha: string;
  hora: string;
  horafin: string;
  servicio_id: number;
  servicioNombre: string;
  disponible: boolean;
};

export type AlertaTurno = {
  id: string;
  email: string;
  fecha: string;
  hora: string;
  horafin: string;
  servicio_id: number;
  servicioNombre: string;
  createdAt: string;
};

export type ConsultaReserva = {
  status: boolean;
  mensaje: string;
  turnoid: string;
  costo_turno: number;
  genera_deuda?: boolean;
};

export type PreReserva = ConsultaReserva & {
  timer: number;
  min: number;
  max: number;
  mul: number;
};

export type Colega = {
  apellidonombre: string;
  documento: number;
  socioid: string;
};

export type ReservaConfirmada = {
  status: boolean;
  titulo: string;
  mensaje: string;
};

export type ReservaUsuario = {
  id: string;
  turnoId: string;
  nombre: string;
  estado: string;
  mensaje: string;
  puedeCancelar: boolean;
  locked: boolean;
  socios: string[];
};

export type ConsultaCancelacion = {
  mensaje: string;
  detalle: string;
};
