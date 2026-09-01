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
