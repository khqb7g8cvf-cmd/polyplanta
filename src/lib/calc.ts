import type { Amon, Cfg, LineaCalc, LineaRow, Maquina, OpTurno, Orden, Paro, Reporte } from './types';

export const AREAS: Record<string, string> = { extrusion: 'Extrusión', impresion: 'Impresión', bolseo: 'Bolseo', acabado: 'Acabado' };
export const CAUSAS = ['Mecánico', 'Eléctrico', 'Falta de material', 'Cambio de rollo', 'Cambio de orden', 'Falta de gente', 'Comida', 'Calidad', 'Otro'];
export const SELLOS: [string, string][] = [['fondo', 'Fondo'], ['lateral', 'Lateral'], ['camiseta', 'Camiseta'], ['pouch', 'Pouch con zipper'], ['ninguno', 'Sin bolseo (solo rollo)']];

export const DEF_CFG: Cfg = {
  horasProd: 10, horasSab: 6, turno1Inicio: 7, umbralBajo: 75, umbralOk: 85, minCambio: 20, nAviso: 3, umbralRec: 105, ventanaDias: 30,
  nEscrita: 3, nActa: 5, nReconoc: 5, margenKg: null, excusadas: ['Mecánico', 'Eléctrico', 'Falta de material'],
};

const ymd = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

/** Peso de un millar de bolsas en kg: ancho(m) × largo(m) × calibre/2 × densidad. */
export function kgMillar(anchoCm: number | null, largoCm: number | null, calibre: number | null, densidad: string | null): number | null {
  const a = (anchoCm || 0) / 100, l = (largoCm || 0) / 100, c = calibre || 0, d = densidad === 'alta' ? 0.95 : 0.92;
  return a && l && c ? a * l * (c / 2) * d : null;
}

/** kg/h teóricos de una línea de reporte en su máquina. */
export function lineKgh(l: Pick<LineaRow, 'ancho' | 'largo' | 'calibre' | 'densidad' | 'golpes' | 'carriles' | 'kgh'>, m?: Maquina): number | null {
  if (!m) return null;
  if (m.tipo === 'bolseo') {
    const km = kgMillar(l.ancho, l.largo, l.calibre, l.densidad);
    const g = l.golpes || m.golpes || 0, car = l.carriles || m.carriles || 1, t = g && km ? ((g * 60 * car) / 1000) * km : null;
    return t && m.kgh ? Math.min(t, m.kgh) : t; // m.kgh en bolseo = tope real de la máquina
  }
  return l.kgh || m.kgh || null;
}

/** Realismo en bolseo (automático, sin que nadie lo ajuste):
 *  1) Regla base (la dio el dueño): desde calibre 550 la bolsa es lenta (sellado, empacar a mano, sello caliente que pega) → ×0.6 en TODAS las bolseadoras.
 *     Debajo de 550 manda la fórmula. Para el largo no hay umbral dado: lo aprende el historial de cada máquina.
 *  2) Aprendizaje por máquina y tipo de bolsa (≥ 3 reportes en 60 días): si la máquina demuestra que rinde más (percentil 75 de lo logrado),
 *     el factor sube hasta 1. Si con ≥ 5 reportes de ≥ 3 operadores distintos incluso lo mejor queda por debajo, el factor baja, pero nunca
 *     más de 15% abajo del prior (no se aprende a exigir menos de la cuenta). */
/** Calibrado con lo que dijo el dueño: bolsa 52×135 cal 650 en la bolseadora 5 no pasa de ~850–900 kg por turno (tope 160 kg/h → ×0.6). Incluye velocidad lenta, empacar a mano y sello caliente. */
export const FACTOR_GRUESO = 0.6;
export const MIN_MUESTRAS = 3, MIN_BAJAR = 5, MIN_OPS = 3, VENTANA_APRENDE = 60;
export const reglaBolseo = (l: Pick<LineaRow, 'largo' | 'calibre'>) => (Number(l.calibre) >= 550 ? FACTOR_GRUESO : 1);
export const grupoBolseo = (l: Pick<LineaRow, 'largo' | 'calibre'>) => (Number(l.calibre) >= 550 ? 'grueso' : 'normal');
export type FactorIdx = Map<string, { id: string; fecha: string; pct: number; op: string }[]>;
export function factorBolseo(l: Pick<LineaRow, 'largo' | 'calibre'> & { id?: string }, maqId: string, idx: FactorIdx, now = Date.now()): { f: number; aprendido: boolean; prior: number } {
  const prior = reglaBolseo(l), desde = ymd(new Date(now - VENTANA_APRENDE * 864e5));
  const m = (idx.get(`${maqId}|${grupoBolseo(l)}`) || []).filter((x) => x.id !== l.id && x.fecha >= desde);
  if (m.length < MIN_MUESTRAS) return { f: prior, aprendido: false, prior };
  const v = m.map((x) => x.pct).sort((a, b) => a - b), p75 = v[Math.floor((v.length - 1) * 0.75)];
  if (p75 > prior) return { f: Math.min(1, p75), aprendido: true, prior };
  if (m.length >= MIN_BAJAR && new Set(m.map((x) => x.op)).size >= MIN_OPS) return { f: Math.max(prior * 0.85, p75), aprendido: true, prior };
  return { f: prior, aprendido: false, prior };
}

export function kghOrden(o: Orden, m?: Maquina): number | null {
  if (!m) return null;
  if (m.tipo === 'bolseo') {
    const km = kgMillar(o.ancho_ext || o.bolsa_ancho, o.bolsa_largo, o.calibre, o.densidad);
    const g = o.golpes || m.golpes || 0, car = o.carriles || m.carriles || 1, t = g && km ? ((g * 60 * car) / 1000) * km : null;
    return t && m.kgh ? Math.min(t, m.kgh) : t;
  }
  if (m.tipo === 'extrusion') return o.kgh || m.kgh || null;
  return m.kgh || null;
}

export const diaSemana = (fecha: string) => { const [y, mo, d] = fecha.split('-').map(Number); return new Date(y, mo - 1, d).getDay(); }; // 0 dom … 6 sáb
/** Sábado de día: solo se trabaja de 7 a 3 (el turno de noche del sábado sí es de 12 h para extrusión). */
export const esSabadoCorto = (fecha: string, turno: number) => diaSemana(fecha) === 6 && turno === 1;
/** Horas productivas de un turno (cfg.horasSab en sábado de día). */
export const horasTurno = (fecha: string, turno: number, cfg: Cfg) => (esSabadoCorto(fecha, turno) ? cfg.horasSab || 6 : cfg.horasProd || 10);
/** ¿Se espera que esta máquina opere ese turno? Sábado noche y domingo solo extrusión; lo demás es extraordinario. */
export const operaEnTurno = (tipo: string | undefined, fecha: string, turno: number) => {
  if (tipo === 'extrusion') return true;
  const d = diaSemana(fecha);
  return !(d === 0 || (d === 6 && turno === 2));
};

/** Ventana de un turno: 12 h entre semana; sábado solo turno 1 de 7 a 3 (8 h). */
export function shiftWin(fecha: string, turno: number, cfg: Cfg): [Date, Date] {
  const [y, mo, d] = fecha.split('-').map(Number), h0 = cfg.turno1Inicio || 7;
  const a = new Date(y, mo - 1, d, turno === 1 ? h0 : h0 + 12, 0, 0);
  return [a, new Date(a.getTime() + (esSabadoCorto(fecha, turno) ? 8 : 12) * 36e5)];
}

/** Horas de paro de una máquina dentro de un turno (opcionalmente solo ciertas causas). */
export function paroH(paros: Paro[], maqId: string, fecha: string, turno: number, cfg: Cfg, causas?: Set<string>, now = Date.now()): number {
  const [a, b] = shiftWin(fecha, turno, cfg);
  let h = 0;
  for (const p of paros) {
    if (p.maquina_id !== maqId || (causas && !causas.has(p.causa))) continue;
    const s = Date.parse(p.inicio), e = p.fin ? Date.parse(p.fin) : now, o = Math.min(e, +b) - Math.max(s, +a);
    if (o > 0) h += o / 36e5;
  }
  return h;
}

/** Resultado de evaluar una máquina en un turno POR TIEMPO: cada orden "debía tardar" kilos ÷ kg/h.
 *  - Con horas capturadas en todas las órdenes: cada una se compara contra sus horas reales (menos su parte de los paros justificados).
 *  - Sin horas: el turno suma los tiempos teóricos de todas las órdenes contra las horas disponibles (horas de turno − paros justificados).
 *  - Cada cambio de orden (ajustar medida, rollo, fotocelda…) se perdona con `minCambio` minutos, para no exigir como si no hubiera ajustes.
 *  - `horas_perdidas` (ajustes, cambio de banda, falla, falta de material) que el encargado anota se descuentan también del tiempo disponible.
 *  - Si la última orden ya cumplió su cantidad y no hay horas, el resto del turno no se puede juzgar y no se evalúa. */
export interface EvalLinea { tTeo: number | null; disp: number | null; exp: number | null; expRaw: number | null; cerrada: boolean }
export function evalMaquinaTurno(
  ls: { orden_id: string | null; kilos: number | null; horas: number | null; horas_perdidas?: number | null }[], ks: (number | null)[], excH: number, H: number,
  ordenes: Pick<Orden, 'id' | 'kilos'>[], producido: Map<string, number>, minCambio = 0,
): EvalLinea[] {
  const n = ls.length, cambioH = (Math.max(0, n - 1) * (minCambio || 0)) / 60, desc = excH + cambioH, ps = ls.map((l) => Math.max(0, Number(l.horas_perdidas) || 0)), kg = ls.map((l) => Number(l.kilos) || 0), hs = ls.map((l) => Number(l.horas) || 0), tot = hs.reduce((a, b) => a + b, 0);
  const tTeo = ls.map((_, i) => (ks[i] ? kg[i] / (ks[i] as number) : null));
  if (n > 1 && hs.every((x) => x > 0)) {
    return ls.map((_, i) => { const ef = Math.max(0, hs[i] - desc * (hs[i] / tot) - ps[i]); return { tTeo: tTeo[i], disp: ef, exp: ks[i] ? (ks[i] as number) * ef : null, expRaw: ks[i] ? (ks[i] as number) * hs[i] : null, cerrada: false }; });
  }
  const last = ls[n - 1], meta = last?.orden_id ? ordenes.find((o) => o.id === last.orden_id)?.kilos : null;
  if (last?.orden_id && meta && (producido.get(last.orden_id) || 0) >= meta) return ls.map((_, i) => ({ tTeo: tTeo[i], disp: null, exp: null, expRaw: null, cerrada: true }));
  const sumT = tTeo.reduce<number>((a, b) => a + (b || 0), 0), disp = Math.max(0, H - desc - ps.reduce((a, b) => a + b, 0));
  return ls.map((_, i) => {
    const share = sumT > 0 ? (tTeo[i] || 0) / sumT : 1 / n;
    return { tTeo: tTeo[i], disp: disp * share, exp: ks[i] ? (ks[i] as number) * disp * share : null, expRaw: ks[i] ? (ks[i] as number) * H * share : null, cerrada: false };
  });
}
export const producidoPorOrden = (reportes: Reporte[]) => {
  const g = new Map<string, number>();
  for (const r of reportes) for (const l of r.reporte_lineas || []) if (l.orden_id && !l.incidencia) g.set(l.orden_id, (g.get(l.orden_id) || 0) + (Number(l.kilos) || 0));
  return g;
};

/** Primera pasada (sin ajuste): qué % logró cada línea de bolseo con bolsa gruesa/larga, para aprender qué rinde cada máquina. */
export function indiceFactores(reportes: Reporte[], maquinas: Maquina[], paros: Paro[], cfg: Cfg, ordenes: Pick<Orden, 'id' | 'kilos'>[] = [], now = Date.now()): FactorIdx {
  const idx: FactorIdx = new Map(), prod = producidoPorOrden(reportes), exc = new Set(cfg.excusadas || []), mById = new Map(maquinas.map((m) => [m.id, m]));
  for (const rep of reportes) {
    const byM = new Map<string, LineaRow[]>();
    for (const l of rep.reporte_lineas || []) if (!l.incidencia) byM.set(l.maquina_id, [...(byM.get(l.maquina_id) || []), l]);
    for (const [mid, ls] of byM) {
      const m = mById.get(mid);
      if (m?.tipo !== 'bolseo') continue;
      const ks = ls.map((l) => lineKgh(l, m)), ev = evalMaquinaTurno(ls, ks, paroH(paros, mid, rep.fecha, rep.turno, cfg, exc, now), horasTurno(rep.fecha, rep.turno, cfg), ordenes, prod, cfg.minCambio);
      ls.forEach((l, i) => {
        const kg = Number(l.kilos) || 0, e = ev[i].exp;
        if (!e || !kg) return;
        const k = `${mid}|${grupoBolseo(l)}`;
        idx.set(k, [...(idx.get(k) || []), { id: l.id, fecha: rep.fecha, pct: kg / e, op: (l.operario || '').trim().toLowerCase() }]);
      });
    }
  }
  return idx;
}

/** Calcula, por línea de reporte, lo que debía producirse (ya descontados paros justificados). */
export function buildLineas(reportes: Reporte[], maquinas: Maquina[], paros: Paro[], cfg: Cfg, now = Date.now(), ordenes: Pick<Orden, 'id' | 'kilos'>[] = []): LineaCalc[] {
  const prod = producidoPorOrden(reportes), idx = indiceFactores(reportes, maquinas, paros, cfg, ordenes, now);
  const out: LineaCalc[] = [], exc = new Set(cfg.excusadas || []);
  const mById = new Map(maquinas.map((m) => [m.id, m]));
  for (const rep of reportes) {
    const byM = new Map<string, LineaRow[]>();
    for (const l of rep.reporte_lineas || []) if (!l.incidencia) byM.set(l.maquina_id, [...(byM.get(l.maquina_id) || []), l]);
    for (const [mid, ls] of byM) {
      const H = horasTurno(rep.fecha, rep.turno, cfg), m = mById.get(mid), excH = paroH(paros, mid, rep.fecha, rep.turno, cfg, exc, now), heff = Math.max(0, H - excH);
      const facs = ls.map((l) => (m?.tipo === 'bolseo' ? factorBolseo(l, mid, idx, now) : { f: 1, aprendido: false })), ks = ls.map((l, i) => { const k = lineKgh(l, m); return k ? k * facs[i].f : k; });
      const ev = evalMaquinaTurno(ls, ks, excH, H, ordenes, prod, cfg.minCambio), tot = ls.reduce((a, x) => a + (Number(x.horas) || 0), 0);
      ls.forEach((l, i) => {
        const kgh = ks[i], kilos = Number(l.kilos) || 0, { exp, expRaw, cerrada } = ev[i], share = tot > 0 && (Number(l.horas) || 0) > 0 ? (Number(l.horas) || 0) / tot : 1 / ls.length;
        out.push({ ...l, kilos, fecha: rep.fecha, turno: rep.turno, tipo: m?.tipo, kgh, exp, expRaw, excH: excH * share, pct: exp ? kilos / exp : null, pctRaw: expRaw ? kilos / expRaw : null, cerrada, fac: facs[i].f });
      });
    }
  }
  return out;
}

export function buildOT(lineas: LineaCalc[]): OpTurno[] {
  const g = new Map<string, OpTurno>();
  for (const x of lineas) {
    const op = (x.operario || '').trim() || 'Sin nombre', k = op + '|' + x.reporte_id;
    const o = g.get(k) || { operario: op, fecha: x.fecha, turno: x.turno, rid: x.reporte_id, lines: [], kg: 0, kgE: 0, exp: 0, pct: null, just: false };
    o.lines.push(x); o.kg += x.kilos;
    if (x.exp) { o.exp += x.exp; o.kgE += x.kilos; }
    g.set(k, o);
  }
  return [...g.values()].map((o) => ({ ...o, pct: o.exp ? o.kgE / o.exp : null, just: o.lines.every((x) => x.justificada) }));
}

export type Cls = 'good' | 'warn' | 'bad' | '';
export const cls = (p: number | null | undefined, cfg: Cfg): Cls => (p == null ? '' : p * 100 >= cfg.umbralOk ? 'good' : p * 100 >= cfg.umbralBajo ? 'warn' : 'bad');
export const pctTxt = (p: number | null | undefined) => (p == null ? '—' : Math.round(p * 100).toLocaleString('es-MX') + '%');
export const gapTxt = (p: number | null | undefined) =>
  p == null ? '' : p >= 1 ? `${Math.round((p - 1) * 100)}% arriba de la meta` : `${Math.round((1 - p) * 100)}% abajo de la meta`;

export function sumL(a: LineaCalc[]) {
  const w = a.filter((x) => x.exp), exp = w.reduce((s, x) => s + (x.exp || 0), 0), kgE = w.reduce((s, x) => s + x.kilos, 0);
  return { kg: a.reduce((s, x) => s + x.kilos, 0), kgE, exp, expRaw: w.reduce((s, x) => s + (x.expRaw || 0), 0), pct: exp ? kgE / exp : null, falta: Math.max(0, exp - kgE), n: a.length };
}

export interface OpResumen {
  n: string; ots: OpTurno[]; pct: number | null; bajos: OpTurno[]; buenos: OpTurno[]; sanc: Amon[]; rec: Amon[]; am: Amon[];
  sug: { tipo: 'Verbal' | 'Escrita' | 'Acta' | 'Reconocimiento' } | null; areas: string[];
  /** Turnos en zona amarilla (entre el umbral bajo y el verde): no son sanción, solo aviso para presionar. */
  avisos: OpTurno[]; presionar: boolean;
}

/** Escalera de amonestaciones: cada turno bajo meta sin respuesta sugiere la siguiente sanción. */
export function opAll(ot: OpTurno[], amon: Amon[], cfg: Cfg, now = Date.now()): OpResumen[] {
  const cut = ymd(new Date(now - cfg.ventanaDias * 864e5));
  const names = [...new Set(ot.filter((o) => o.fecha >= cut).map((o) => o.operario))];
  return names.map((n) => {
    const ots = ot.filter((o) => o.operario === n && o.fecha >= cut).sort((a, b) => (b.fecha + b.turno).localeCompare(a.fecha + a.turno));
    const w = ots.filter((o) => o.exp), exp = w.reduce((s, o) => s + o.exp, 0), kgE = w.reduce((s, o) => s + o.kgE, 0);
    const bajos = w.filter((o) => (o.pct as number) * 100 < cfg.umbralBajo && !o.just), buenos = w.filter((o) => (o.pct as number) * 100 >= cfg.umbralRec);
    const avisos = w.filter((o) => (o.pct as number) * 100 >= cfg.umbralBajo && (o.pct as number) * 100 < cfg.umbralOk && !o.just);
    const am = amon.filter((a) => a.operario === n && a.fecha >= cut);
    const sanc = am.filter((a) => ['Verbal', 'Escrita', 'Acta'].includes(a.tipo)), rec = am.filter((a) => a.tipo === 'Reconocimiento');
    let sug: OpResumen['sug'] = null;
    if (n !== 'Sin nombre' && bajos.length > sanc.length) {
      const k = sanc.length + 1;
      sug = { tipo: k >= cfg.nActa ? 'Acta' : k >= cfg.nEscrita ? 'Escrita' : 'Verbal' };
    } else if (n !== 'Sin nombre' && buenos.length >= cfg.nReconoc && !rec.length) sug = { tipo: 'Reconocimiento' };
    return { n, ots, pct: exp ? kgE / exp : null, bajos, buenos, sanc, rec, am, sug, avisos, presionar: avisos.length >= cfg.nAviso, areas: [...new Set(ots.flatMap((o) => o.lines.map((x) => AREAS[x.tipo || ''] || '')))] };
  }).sort((a, b) => (a.pct ?? 9) - (b.pct ?? 9));
}

/** Compatibilidad máquina ↔ orden: errores duros y avisos. */
export function compat(o: Partial<Orden>, m: Maquina): { bad: string[]; warn: string[] } {
  const bad: string[] = [], warn: string[] = [];
  const ancho = o.ancho_ext || 0, bAncho = o.bolsa_ancho || 0, largo = o.bolsa_largo || 0;
  if (m.tipo === 'extrusion') {
    if (o.densidad === 'alta' && !(m.densidades || []).includes('alta')) bad.push('no corre alta densidad');
    if (m.ancho_max && ancho > m.ancho_max) bad.push(`ancho máx. ${m.ancho_max} cm`);
    if (!m.ancho_max && ancho && ancho <= 50 && /carnevali/i.test(m.marca || '')) warn.push('medida chica, mejor en las chinas');
  }
  if (m.tipo === 'bolseo') {
    if (o.sello === 'ninguno') bad.push('la orden no lleva bolseo');
    else if (o.sello && (m.sellos || []).length && !m.sellos.includes(o.sello)) bad.push(`no hace sello ${o.sello}`);
    if (m.sin_fotocelda && o.impresion && o.registro) bad.push('sin fotocelda: no corre impresión con registro');
    if (m.ancho_max && (bAncho || ancho) > m.ancho_max) bad.push(`ancho máx. ${m.ancho_max} cm`);
    const cm = m.carriles_max || m.carriles || 1;
    if ((o.carriles || 0) > cm) bad.push(`máx. ${cm} carril(es)`);
  }
  if (m.tipo === 'impresion') {
    if (!o.impresion) warn.push('la orden no lleva impresión');
    if ((o.tintas || 0) > (m.tintas || 99)) bad.push(`solo ${m.tintas} tintas`);
    if ((o.caras || 0) > (m.caras || 2)) bad.push('solo imprime 1 lado');
    if (ancho && m.mat_max && ancho > m.mat_max) bad.push(`material máx. ${m.mat_max} cm`);
    if (largo && (m.rodillos || []).length && !m.rodillos.some((r) => mult(r.rep, largo))) warn.push(`ningún rodillo es múltiplo de ${largo} cm`);
  }
  return { bad, warn };
}
export function mult(rep: number, largo: number) {
  if (!rep || !largo) return false;
  const q = rep / largo;
  return q >= 1 && Math.abs(q - Math.round(q)) < 0.02;
}

/** Turno terminado más reciente (cuando se espera el reporte). */
export function lastDone(cfg: Cfg, now = new Date()): { fecha: string; turno: 1 | 2 } {
  const h = now.getHours(), h0 = cfg.turno1Inicio || 7, y = new Date(now);
  y.setDate(y.getDate() - 1);
  if (h >= h0 + 12) return { fecha: ymd(now), turno: 1 };
  if (h >= h0) return { fecha: ymd(y), turno: 2 };
  return { fecha: ymd(y), turno: 1 };
}
export function stepShift(fecha: string, turno: 1 | 2, dir: 1 | -1): { fecha: string; turno: 1 | 2 } {
  const [y, m, d] = fecha.split('-').map(Number), dt = new Date(y, m - 1, d);
  if (dir > 0) { if (turno === 1) return { fecha, turno: 2 }; dt.setDate(dt.getDate() + 1); return { fecha: ymd(dt), turno: 1 }; }
  if (turno === 2) return { fecha, turno: 1 };
  dt.setDate(dt.getDate() - 1);
  return { fecha: ymd(dt), turno: 2 };
}
