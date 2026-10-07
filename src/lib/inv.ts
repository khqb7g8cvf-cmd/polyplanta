import type { LineaCalc, Material, Movimiento } from './types';

export interface MatResumen {
  m: Material; kg: number; sacos: number; consumo30: number; consumoDia: number; dias: number | null; bajo: boolean;
  costoKg: number | null; valor: number | null;
}

/** Existencia, consumo y cobertura por material. */
export function resumenMateriales(materiales: Material[], existencias: Record<string, number>, movs: Movimiento[], now = Date.now()): MatResumen[] {
  const cut = now - 30 * 864e5;
  return materiales.filter((m) => m.activo).map((m) => {
    const kg = existencias[m.id] ?? 0;
    const ms = movs.filter((x) => x.material_id === m.id);
    const consumo30 = -ms.filter((x) => x.tipo === 'salida' && Date.parse(x.fecha) >= cut).reduce((s, x) => s + x.delta_kg, 0);
    const consumoDia = consumo30 / 30;
    const entradas = ms.filter((x) => x.tipo === 'entrada' && x.costo_kg).sort((a, b) => b.fecha.localeCompare(a.fecha));
    const costoKg = entradas[0]?.costo_kg ?? null;
    return { m, kg, sacos: m.kg_por_saco ? kg / m.kg_por_saco : 0, consumo30, consumoDia, dias: consumoDia > 0 ? kg / consumoDia : null, bajo: kg < m.minimo_kg, costoKg, valor: costoKg ? kg * costoKg : null };
  });
}

/** Compara lo que salió de bodega hacia extrusión contra los kilos extruidos reportados. */
export function conciliacion(movs: Movimiento[], lineas: LineaCalc[], desde: string, hasta: string) {
  const salidas = -movs.filter((x) => x.tipo === 'salida' && x.fecha.slice(0, 10) >= desde && x.fecha.slice(0, 10) <= hasta).reduce((s, x) => s + x.delta_kg, 0);
  const extruidos = lineas.filter((x) => x.tipo === 'extrusion' && x.fecha >= desde && x.fecha <= hasta).reduce((s, x) => s + x.kilos, 0);
  const dif = salidas - extruidos;
  return { salidas, extruidos, dif, pct: salidas ? dif / salidas : null };
}

export const MOTIVOS: [string, string][] = [['produccion', 'Producción'], ['merma', 'Merma / desperdicio'], ['muestra', 'Muestra / prueba'], ['devolucion', 'Devolución'], ['traspaso', 'Traspaso'], ['venta', 'Venta de material'], ['otro', 'Otro']];
export const motivoTxt = (m: string | null | undefined, tipo?: string) => (m ? MOTIVOS.find((x) => x[0] === m)?.[1] ?? m : tipo === 'entrada' ? 'Compra' : tipo === 'ajuste' ? 'Ajuste de conteo' : '—');

export interface KRow extends Movimiento { saldo: number }
/** Kardex: cada movimiento con el saldo del material justo después de aplicarlo. `movs` debe venir del más nuevo al más viejo. */
export function kardex(movs: Movimiento[], existencias: Record<string, number>): KRow[] {
  const run = new Map<string, number>();
  return movs.map((m) => {
    const cur = run.get(m.material_id) ?? existencias[m.material_id] ?? 0;
    run.set(m.material_id, cur - m.delta_kg);
    return { ...m, saldo: cur };
  });
}

/** Existencia al cierre de cada día (dias ascendente, formato YYYY-MM-DD). */
export function existenciaDiaria(movs: Movimiento[], existenciaActual: number, dias: string[]): number[] {
  const out: number[] = [];
  const sorted = [...movs].sort((a, b) => b.fecha.localeCompare(a.fecha));
  for (let i = dias.length - 1; i >= 0; i--) {
    const after = sorted.filter((m) => m.fecha.slice(0, 10) > dias[i]).reduce((s, m) => s + m.delta_kg, 0);
    out[i] = existenciaActual - after;
  }
  return out;
}

export function salidasPor<K extends string>(movs: Movimiento[], key: (m: Movimiento) => K) {
  const g = new Map<K, number>();
  for (const m of movs) if (m.tipo === 'salida') g.set(key(m), (g.get(key(m)) || 0) - m.delta_kg);
  return [...g].map(([k, kg]) => ({ k, kg })).sort((a, b) => b.kg - a.kg);
}

export interface Prov { proveedor: string; n: number; kg: number; monto: number; kgConPrecio: number; promedio: number | null; ultimo: number | null; ultimaFecha: string }
export function proveedores(movs: Movimiento[]): Prov[] {
  const g = new Map<string, Prov>();
  for (const m of [...movs].sort((a, b) => a.fecha.localeCompare(b.fecha))) {
    if (m.tipo !== 'entrada') continue;
    const k = (m.proveedor || '').trim() || 'Sin proveedor';
    const p = g.get(k) || { proveedor: k, n: 0, kg: 0, monto: 0, kgConPrecio: 0, promedio: null, ultimo: null, ultimaFecha: m.fecha };
    p.n++; p.kg += m.delta_kg; p.ultimaFecha = m.fecha;
    if (m.costo_kg) { p.monto += m.costo_kg * m.delta_kg; p.kgConPrecio += m.delta_kg; p.ultimo = m.costo_kg; }
    g.set(k, p);
  }
  return [...g.values()].map((p) => ({ ...p, promedio: p.kgConPrecio ? p.monto / p.kgConPrecio : null })).sort((a, b) => b.kg - a.kg);
}
