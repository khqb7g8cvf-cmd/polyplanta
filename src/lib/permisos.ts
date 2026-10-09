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
/** ¿Puede el encargado corregir esta línea ya guardada? Sí, siempre: el dueño decidió no ponerle candado a los reportes de turno
 *  (cada cambio queda en la bitácora y solo el dueño puede borrar). Se conserva la firma por si se vuelve a poner un candado. */
export function lineaLibre(_l: Linea, _uid: string | undefined, _sols: SolicitudCambio[], _now: number) {
  return true;
}
