import type { SolicitudCambio } from './types';

/** Minutos que un encargado puede corregir lo que él mismo capturó, sin pedir permiso. Debe coincidir con la política de la base. */
export const VENTANA_MIN = 15;

interface Linea { created_by?: string | null; created_at?: string; reporte_id?: string; maquina_id: string }

/** Autorización vigente (aprobada y sin vencer) para corregir la producción de una máquina en un reporte. */
export function autorizacion(sols: SolicitudCambio[], reporteId: string | undefined, maquinaId: string, uid: string | undefined, now: number) {
  return sols.find((s) => s.tabla === 'reporte_lineas' && s.estado === 'aprobada' && s.solicitada_por === uid && s.reporte_id === reporteId && s.maquina_id === maquinaId && s.vence_at && Date.parse(s.vence_at) > now);
}
export function pendiente(sols: SolicitudCambio[], reporteId: string | undefined, maquinaId: string, uid: string | undefined) {
  return sols.find((s) => s.tabla === 'reporte_lineas' && s.estado === 'pendiente' && s.solicitada_por === uid && s.reporte_id === reporteId && s.maquina_id === maquinaId);
}
/** ¿Puede el encargado corregir esta línea ya guardada? (suya y reciente, o con autorización del dueño) */
export function lineaLibre(l: Linea, uid: string | undefined, sols: SolicitudCambio[], now: number) {
  const suya = !!uid && l.created_by === uid && !!l.created_at && now - Date.parse(l.created_at) < VENTANA_MIN * 60000;
  return suya || !!autorizacion(sols, l.reporte_id, l.maquina_id, uid, now);
}
