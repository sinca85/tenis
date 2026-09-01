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
