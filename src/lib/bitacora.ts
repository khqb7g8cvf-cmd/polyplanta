import type { Bitacora } from './types';
import { fmt } from './format';

export interface Lookups {
  maq: (id: unknown) => string; mat: (id: unknown) => string;
  /** Contexto del registro afectado (p. ej. "Juan · Bolseadora 3") cuando el cambio solo trae columnas modificadas. */
  ctx: (tabla: string, id: string | null) => string;
}
export interface Desc { tabla: string; titulo: string; detalle: string; alertas: string[]; nivel: 0 | 1 | 2; cambios: [string, string, string][] }

export const TABLA: Record<string, string> = {
  reportes: 'Reporte de turno', reporte_lineas: 'Captura de producción', paros: 'Paro', mtto: 'Mantenimiento', amonestaciones: 'Amonestación',
  ordenes: 'Orden', maquinas: 'Máquina', personas: 'Persona', config: 'Parámetros', materiales: 'Material', inv_movimientos: 'Mov. de inventario',
  inv_conteos: 'Conteo físico', profiles: 'Usuario', sesion: 'Acceso',
};
const ACC: Record<string, string> = { INSERT: 'Registró', UPDATE: 'Modificó', DELETE: 'Borró', LOGIN: 'Entró al sistema' };
export const ACCION = ACC;

const LBL: Record<string, string> = {
  kilos: 'Kilos', horas: 'Horas', operario: 'Operario', justificada: 'Justificada', maquina_id: 'Máquina', orden_id: 'Orden', ancho: 'Ancho (m)', largo: 'Largo (m)',
  calibre: 'Calibre', densidad: 'Densidad', golpes: 'Golpes/min', kgh: 'kg/h', carriles: 'Carriles', nota: 'Nota', cliente: 'Cliente', causa: 'Causa', inicio: 'Inicio', fin: 'Fin',
  fecha: 'Fecha', turno: 'Turno', tipo: 'Tipo', delta_kg: 'Kg (±)', sacos: 'Sacos', lote: 'Lote', proveedor: 'Proveedor', factura: 'Factura', costo_kg: 'Costo/kg', motivo: 'Motivo',
  referencia: 'Referencia', estado: 'Estado', rol: 'Rol', activo: 'Activo', usuario: 'Usuario', nombre: 'Nombre', data: 'Parámetros', descr: 'Descripción', prioridad: 'Prioridad',
  mecanico: 'Mecánico', costo: 'Costo', kg_contados: 'Kg contados', kg_sistema: 'Kg en sistema', diferencia: 'Diferencia', minimo_kg: 'Mínimo (kg)', kg_por_saco: 'Kg por saco',
  folio: 'Folio', kilos_orden: 'Kilos', fecha_entrega: 'Entrega', evidencia: 'Evidencia', cierre: 'Cierre', nota_cierre: 'Nota de cierre', programada: 'Programada',
};
const OCULTAS = new Set(['id', 'created_by', 'created_at', 'reporte_id', 'creado_por', 'orden', 'updated_at']);
export const campo = (k: string) => LBL[k] || k.replace(/_/g, ' ');

export function valTxt(k: string, v: unknown, L: Lookups): string {
  if (v == null || v === '') return '—';
  if (k === 'maquina_id' || k === 'extrusora_id' || k === 'impresora_id' || k === 'bolseadora_id') return L.maq(v);
  if (k === 'material_id') return L.mat(v);
  if (typeof v === 'boolean') return v ? 'Sí' : 'No';
  if (typeof v === 'number') return fmt(v, Math.abs(v) < 100 ? 2 : 1);
  if (typeof v === 'object') return JSON.stringify(v);
  const s = String(v);
  if (/^\d{4}-\d\d-\d\dT/.test(s)) return new Date(s).toLocaleString('es-MX', { dateStyle: 'short', timeStyle: 'short' });
  return s;
}

const num = (v: unknown) => (v == null || v === '' ? null : Number(v));
const BORRABLES = new Set(['reportes', 'reporte_lineas', 'paros', 'inv_movimientos', 'inv_conteos', 'amonestaciones', 'mtto']);

export function describir(b: Bitacora, L: Lookups): Desc {
  const A = (b.antes || {}) as Record<string, unknown>, D = (b.despues || {}) as Record<string, unknown>;
  const base = { ...A, ...D };
  const alertas: string[] = [];
  let nivel: 0 | 1 | 2 = 0;
  const alerta = (n: 1 | 2, t: string) => { alertas.push(t); if (n > nivel) nivel = n; };
  const ctx = b.accion === 'UPDATE' ? L.ctx(b.tabla, b.registro_id) : '';
  const campos = [...new Set([...Object.keys(A), ...Object.keys(D)])].filter((k) => !OCULTAS.has(k));
  const cambios: [string, string, string][] = campos.map((k) => [campo(k), b.accion === 'INSERT' ? '' : valTxt(k, A[k], L), b.accion === 'DELETE' ? '' : valTxt(k, D[k], L)]);

  let det = '';
  switch (b.tabla) {
    case 'reporte_lineas': {
      det = [base.operario, base.maquina_id ? L.maq(base.maquina_id) : '', base.kilos != null ? `${fmt(num(base.kilos), 0)} kg` : ''].filter(Boolean).join(' · ') || ctx;
      if (b.accion === 'UPDATE') {
        if ('kilos' in D) { const a = num(A.kilos) ?? 0, d = num(D.kilos) ?? 0; alerta(a && Math.abs(d - a) / a > 0.1 ? 2 : 1, `Cambió los kilos de ${fmt(a)} a ${fmt(d)}`); }
        if ('justificada' in D) alerta(D.justificada ? 2 : 1, D.justificada ? 'Marcó el turno como justificado (no cuenta como bajo)' : 'Quitó la justificación del turno');
        if ('horas' in D) alerta(1, 'Cambió las horas de la línea');
        if ('operario' in D) alerta(1, `Cambió el operario de ${valTxt('operario', A.operario, L)} a ${valTxt('operario', D.operario, L)}`);
        for (const k of ['golpes', 'kgh', 'carriles', 'ancho', 'largo', 'calibre']) if (k in D) alerta(1, `Cambió ${campo(k)} (modifica la meta teórica)`);
      }
      break;
    }
    case 'reportes': det = base.fecha ? `${valTxt('fecha', base.fecha, L)} · turno ${base.turno ?? ''}` : ctx; break;
    case 'paros': {
      det = [base.maquina_id ? L.maq(base.maquina_id) : '', base.causa].filter(Boolean).join(' · ') || ctx;
      if (b.accion === 'UPDATE' && 'causa' in D) alerta(1, `Cambió la causa del paro de ${A.causa} a ${D.causa}`);
      if (b.accion === 'UPDATE' && ('inicio' in D || 'fin' in D)) alerta(1, 'Cambió el horario del paro');
      break;
    }
    case 'inv_movimientos': {
      const kg = num(base.delta_kg);
      det = [base.material_id ? L.mat(base.material_id) : '', base.tipo, kg != null ? `${kg > 0 ? '+' : ''}${fmt(kg, 1)} kg` : '', base.motivo].filter(Boolean).join(' · ') || ctx;
      if (b.accion === 'INSERT') {
        if (base.tipo === 'ajuste') alerta(kg != null && Math.abs(kg) >= 500 ? 2 : 1, `Ajuste manual de inventario (${kg != null && kg > 0 ? '+' : ''}${fmt(kg, 1)} kg)`);
        if (base.tipo === 'salida' && kg != null && -kg >= 1000) alerta(1, `Salida grande: ${fmt(-kg)} kg`);
        if (base.tipo === 'salida' && (base.motivo === 'otro' || base.motivo === 'merma' || base.motivo === 'venta')) alerta(1, `Salida por motivo "${base.motivo}"`);
        const f = base.fecha ? Date.parse(String(base.fecha)) : NaN;
        if (!isNaN(f) && Date.parse(b.at) - f > 2 * 864e5) alerta(1, 'Movimiento capturado con fecha de hace más de 2 días');
      }
      break;
    }
    case 'inv_conteos': {
      const dif = num(base.diferencia);
      det = `${base.material_id ? L.mat(base.material_id) : ''} · contó ${fmt(num(base.kg_contados), 1)} kg · sistema ${fmt(num(base.kg_sistema), 1)} kg`;
      if (dif != null && Math.abs(dif) >= 100) alerta(Math.abs(dif) >= 300 ? 2 : 1, `Conteo con diferencia de ${dif > 0 ? '+' : ''}${fmt(dif, 1)} kg`);
      break;
    }
    case 'maquinas': {
      det = String(base.nombre ?? ctx);
      if (b.accion === 'UPDATE') for (const k of ['kgh', 'golpes', 'carriles', 'ancho_max', 'densidades']) if (k in D) alerta(1, `Cambió ${campo(k)} de la máquina (afecta la meta teórica)`);
      if (b.accion === 'DELETE') alerta(2, 'Borró una máquina');
      break;
    }
    case 'config': det = 'Parámetros y reglas'; if (b.accion !== 'INSERT') alerta(1, 'Cambió los parámetros que definen metas y amonestaciones'); break;
    case 'profiles': {
      det = String(base.usuario ?? base.nombre ?? ctx);
      if ('rol' in D && b.accion === 'UPDATE') alerta(1, `Cambió el rol de ${A.rol} a ${D.rol}`);
      if ('activo' in D && b.accion === 'UPDATE') alerta(1, D.activo ? 'Activó una cuenta' : 'Desactivó una cuenta');
      break;
    }
    case 'amonestaciones': det = [base.operario, base.tipo].filter(Boolean).join(' · ') || ctx; break;
    case 'ordenes': det = [base.folio, base.cliente].filter(Boolean).join(' · ') || ctx; break;
    case 'materiales': case 'personas': det = String(base.nombre ?? ctx); break;
    case 'mtto': det = String(base.descr ?? ctx); break;
    case 'sesion': det = ''; break;
    default: det = ctx;
  }
  if (b.accion === 'DELETE' && BORRABLES.has(b.tabla)) alerta(2, `Borró ${TABLA[b.tabla]?.toLowerCase() || 'un registro'}`);
  const titulo = b.accion === 'LOGIN' ? 'Entró al sistema' : `${ACC[b.accion]} · ${TABLA[b.tabla] || b.tabla}`;
  return { tabla: TABLA[b.tabla] || b.tabla, titulo, detalle: det, alertas, nivel, cambios };
}
