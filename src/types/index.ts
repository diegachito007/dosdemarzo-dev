export interface AnioLectivo {
  id: string;
  nombre: string;
  fechaInicio: string;
  fechaFin: string;
  tipoEvaluacion: 'trimestral' | 'quimestral';
  activo: boolean;
  createdAt: string;
}

export interface PeriodoEvaluacion {
  id: string;
  nombre: string;
  tipo: 'trimestre' | 'quimestre';
  anioLectivoId: string;
  fechaInicio: string;
  fechaFin: string;
  orden: number;
  activo: boolean;
  createdAt: string;
}

export interface Grado {
  id: string;
  nombre: string;
  paralelo: string;
  anioLectivoId: string;
  activo: boolean;
  orden: number;
  createdAt: string;
}

export interface Estudiante {
  id: string;
  apellidos: string;
  nombres: string;
  cedula: string;
  gradoId: string;
  anioLectivoId: string;
  activo: boolean;
  createdAt: string;
}

export interface Ambito {
  id: string;
  nombre: string;
  gradoId: string;
  orden: number;
  activo: boolean;
  createdAt: string;
}

export interface Destreza {
  id: string;
  nombre: string;
  descripcion: string;
  ambitoId: string;
  gradoId: string;
  orden: number;
  activo: boolean;
  createdAt: string;
}

export interface Calificacion {
  id: string;
  estudianteId: string;
  destrezaId: string;
  periodoId: string;
  anioLectivoId: string;
  nota: number;
  observacion?: string;
  docenteId: string;
  fechaActualizacion: string;
}