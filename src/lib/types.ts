export type Tipo = 'extrusion' | 'impresion' | 'bolseo' | 'acabado';
export type Rol = 'dueno' | 'encargado' | 'mecanico' | 'lectura';

export interface Maquina {
  id: string; tipo: Tipo; nombre: string; marca: string | null; estado: string; orden: number;
  carriles: number | null; carriles_max: number | null; golpes: number | null; kgh: number | null;
  sellos: string[]; tintas: number | null; imp_max: number | null; mat_max: number | null; caras: number | null;
  densidades: string[]; ancho_max: number | null; sin_fotocelda: boolean;
  rodillos: { rep: number; cant?: number | null }[]; notas: string | null;
}
export interface Persona { id: string; nombre: string; rol: string; area: string | null; turno: string | null; activo: boolean }
export interface Orden {
  id: string; folio: string; cliente: string; fecha_entrega: string | null; prioridad: string; estado: string; kilos: number | null;
  ancho_ext: number | null; calibre: number | null; densidad: string | null; tratado: string | null; abierto: boolean | null; fuelle: boolean | null;
  color: string | null; pigmento: number | null; kgh: number | null; sello: string | null; bolsa_ancho: number | null; bolsa_largo: number | null;
  impresion: boolean | null; tintas: number | null; caras: number | null; registro: boolean | null; grabados: boolean | null; obs: string | null;
  extrusora_id: string | null; impresora_id: string | null; bolseadora_id: string | null; carriles: number | null; golpes: number | null;
}
export interface LineaRow {
  id: string; reporte_id: string; maquina_id: string; orden_id: string | null; cliente: string | null;
  ancho: number | null; largo: number | null; calibre: number | null; densidad: string | null;
  golpes: number | null; kgh: number | null; carriles: number | null; horas: number | null;
  operario: string; kilos: number; nota: string | null; justificada: boolean; incidencia?: 'sin_operador' | 'sin_trabajo' | null; created_by?: string | null; created_at?: string;
}
export interface Reporte { id: string; fecha: string; turno: 1 | 2; created_by?: string | null; created_at?: string; reporte_lineas: LineaRow[] }
export interface Paro { id: string; maquina_id: string; causa: string; inicio: string; fin: string | null; orden_id: string | null; nota: string | null; created_by?: string | null; created_at?: string }
export interface Mtto {
  id: string; maquina_id: string; tipo: 'correctivo' | 'preventivo'; descr: string; prioridad: string;
  estado: 'Abierta' | 'En proceso' | 'Cerrada'; mecanico: string | null; programada: string | null; cada_dias: number | null;
  creada: string; inicio: string | null; cierre: string | null; nota_cierre: string | null; costo: number | null;
}
export interface Amon { id: string; operario: string; tipo: 'Verbal' | 'Escrita' | 'Acta' | 'Reconocimiento'; fecha: string; evidencia: string | null; nota: string | null }
export interface Cfg {
  horasProd: number; turno1Inicio: number; umbralBajo: number; umbralOk: number; minCambio: number; nAviso: number; umbralRec: number; ventanaDias: number;
  nEscrita: number; nActa: number; nReconoc: number; margenKg: number | null; excusadas: string[];
}
export interface Material { id: string; nombre: string; categoria: 'resina' | 'reciclado' | 'masterbatch' | 'aditivo'; kg_por_saco: number; minimo_kg: number; silo_kg: number | null; codigo: string | null; fabricante: string | null; activo: boolean }
export interface Movimiento {
  id: string; material_id: string; tipo: 'entrada' | 'salida' | 'ajuste'; fecha: string; delta_kg: number; sacos: number | null;
  lote: string | null; proveedor: string | null; factura: string | null; costo_kg: number | null; maquina_id: string | null; orden_id: string | null; nota: string | null;
  ubicacion: 'silo' | 'sacos'; motivo: string | null; referencia: string | null; created_by: string | null; created_at: string;
}
export interface SolicitudCambio {
  id: string; tabla: string; registro_id: string | null; reporte_id: string | null; maquina_id: string | null; resumen: string; motivo: string;
  estado: 'pendiente' | 'aprobada' | 'rechazada' | 'atendida'; solicitada_por: string; solicitada_at: string; resuelta_por: string | null; resuelta_at: string | null; vence_at: string | null;
}
export interface Profile { id: string; nombre: string; usuario: string | null; rol: Rol; activo: boolean; created_at?: string }

/** Línea de reporte con lo que debía producirse ya calculado. */
export interface LineaCalc extends LineaRow {
  fecha: string; turno: 1 | 2; tipo: Tipo | undefined;
  kgh: number | null; exp: number | null; expRaw: number | null; excH: number;
  pct: number | null; pctRaw: number | null;
  /** Orden que ya se terminó (no es la última del turno, o ya se cumplió su cantidad): no se evalúa. */
  cerrada?: boolean;
}
export interface OpTurno {
  operario: string; fecha: string; turno: 1 | 2; rid: string; lines: LineaCalc[];
  kg: number; kgE: number; exp: number; pct: number | null; just: boolean;
}

export interface Bitacora {
  id: number; at: string; actor: string | null; actor_usuario: string | null; actor_nombre: string | null;
  tabla: string; accion: 'INSERT' | 'UPDATE' | 'DELETE' | 'LOGIN'; registro_id: string | null;
  antes: Record<string, unknown> | null; despues: Record<string, unknown> | null;
}
