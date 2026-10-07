import { paroH } from './calc.ts';
import type { Cfg, LineaCalc, Maquina, Paro, Tipo } from './types';

export interface Agg { kg: number; kgE: number; exp: number; expRaw: number; pct: number | null; lines: number }
export const agg = (ls: LineaCalc[]): Agg => {
  let kg = 0, kgE = 0, exp = 0, expRaw = 0;
  for (const x of ls) { kg += x.kilos; if (x.exp) { exp += x.exp; kgE += x.kilos; } if (x.expRaw) expRaw += x.expRaw; }
  return { kg, kgE, exp, expRaw, pct: exp ? kgE / exp : null, lines: ls.length };
};

export const diasEntre = (desde: string, hasta: string): string[] => {
  const out: string[] = [];
  for (let t = Date.parse(desde + 'T12:00:00Z'); t <= Date.parse(hasta + 'T12:00:00Z') && out.length < 400; t += 864e5) out.push(new Date(t).toISOString().slice(0, 10));
  return out;
};
export const enRango = (L: LineaCalc[], tipo: Tipo | null, desde: string, hasta: string) => L.filter((x) => (!tipo || x.tipo === tipo) && x.fecha >= desde && x.fecha <= hasta);

export function serieDiaria(ls: LineaCalc[], dias: string[]) {
  const g = new Map<string, LineaCalc[]>();
  for (const x of ls) g.set(x.fecha, [...(g.get(x.fecha) || []), x]);
  return dias.map((d) => { const a = agg(g.get(d) || []); return { dia: d, kg: a.kg, exp: a.exp, pct: a.pct, hay: (g.get(d) || []).length > 0 }; });
}

export interface FilaMaq { m: Maquina; kg: number; exp: number; pct: number | null; turnos: number; paroH: number; disp: number | null; serie: (number | null)[]; mejor: number | null }
export function porMaquina(ls: LineaCalc[], maquinas: Maquina[], paros: Paro[], cfg: Cfg, dias: string[], now = Date.now()): FilaMaq[] {
  return maquinas.map((m) => {
    const mine = ls.filter((x) => x.maquina_id === m.id);
    const a = agg(mine);
    const slots = new Map<string, true>();
    for (const x of mine) slots.set(`${x.fecha}|${x.turno}`, true);
    let ph = 0;
    for (const k of slots.keys()) { const [f, t] = k.split('|'); ph += paroH(paros, m.id, f, Number(t), cfg, undefined, now); }
    const sched = slots.size * (cfg.horasProd || 10);
    const serie = dias.map((d) => agg(mine.filter((x) => x.fecha === d)).pct);
    const vals = serie.filter((v): v is number => v != null);
    return { m, kg: a.kg, exp: a.exp, pct: a.pct, turnos: slots.size, paroH: ph, disp: sched ? Math.max(0, 1 - ph / sched) : null, serie, mejor: vals.length ? Math.max(...vals) : null };
  }).sort((a, b) => (b.pct ?? -1) - (a.pct ?? -1));
}

export interface FilaOp { operario: string; turnos: number; kg: number; exp: number; pct: number | null; bajos: number; serie: (number | null)[] }
export function porOperador(ls: LineaCalc[], cfg: Cfg, dias: string[]): FilaOp[] {
  const g = new Map<string, LineaCalc[]>();
  for (const x of ls) { const k = (x.operario || '').trim() || 'Sin nombre'; g.set(k, [...(g.get(k) || []), x]); }
  return [...g].map(([operario, mine]) => {
    const byRep = new Map<string, LineaCalc[]>();
    for (const x of mine) byRep.set(x.reporte_id, [...(byRep.get(x.reporte_id) || []), x]);
    let bajos = 0;
    for (const r of byRep.values()) { const a = agg(r); if (a.pct != null && a.pct * 100 < cfg.umbralBajo && !r.every((x) => x.justificada)) bajos++; }
    const a = agg(mine);
    return { operario, turnos: byRep.size, kg: a.kg, exp: a.exp, pct: a.pct, bajos, serie: dias.map((d) => agg(mine.filter((x) => x.fecha === d)).pct) };
  }).sort((a, b) => (b.pct ?? -1) - (a.pct ?? -1));
}

export const porTurno = (ls: LineaCalc[]) => ([1, 2] as const).map((t) => ({ turno: t, ...agg(ls.filter((x) => x.turno === t)) }));
const DIA = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];
export const nombreDia = (i: number) => DIA[i];
export function porDiaSemana(ls: LineaCalc[]) {
  return DIA.map((n, i) => ({ dia: n, ...agg(ls.filter((x) => (new Date(x.fecha + 'T12:00:00Z').getUTCDay() + 6) % 7 === i)) }));
}

export function paretoParos(paros: Paro[], ids: Set<string>, desde: string, hasta: string, now = Date.now()) {
  const a = Date.parse(desde + 'T00:00:00'), b = Date.parse(hasta + 'T23:59:59');
  const g = new Map<string, { h: number; n: number }>();
  for (const p of paros) {
    if (!ids.has(p.maquina_id)) continue;
    const s = Date.parse(p.inicio), e = p.fin ? Date.parse(p.fin) : now;
    const o = Math.min(e, b) - Math.max(s, a);
    if (o <= 0) continue;
    const c = g.get(p.causa) || { h: 0, n: 0 };
    c.h += o / 36e5; c.n++; g.set(p.causa, c);
  }
  return [...g].map(([causa, v]) => ({ causa, ...v })).sort((x, y) => y.h - x.h);
}

/** Disponibilidad × rendimiento = efectividad (kg reales / kg teóricos con turno completo). */
export function efectividad(ls: LineaCalc[], rows: FilaMaq[]) {
  const a = agg(ls);
  const efect = a.expRaw ? a.kg / a.expRaw : null;
  const turnos = rows.reduce((s, r) => s + r.turnos, 0);
  const disp = turnos ? rows.reduce((s, r) => s + (r.disp ?? 0) * r.turnos, 0) / turnos : null;
  return { disp, efect, rend: efect != null && disp ? efect / disp : null };
}
