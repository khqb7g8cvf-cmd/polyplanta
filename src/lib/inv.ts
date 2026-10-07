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
