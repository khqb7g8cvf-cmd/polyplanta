'use client';
import { useMemo, useState } from 'react';
import { useData } from '@/lib/data';
import { AREAS, cls, pctTxt } from '@/lib/calc';
import { agg, diasEntre, efectividad, enRango, paretoParos, porDiaSemana, porMaquina, porOperador, porTurno, serieDiaria } from '@/lib/analytics';
import { ChartCard, Columns, Heat, HBars, LineChart, Pareto, Spark, descargarCSV, SERIES } from '@/components/charts';
import { Empty, Pill, Scroll, Tile, Bar } from '@/components/ui';
import { daysAgo, dmy, fmt, today } from '@/lib/format';
import type { Tipo } from '@/lib/types';

const TIPOS: Tipo[] = ['extrusion', 'impresion', 'bolseo', 'acabado'];
const pc = (v: number | null) => (v == null ? '—' : Math.round(v * 100) + '%');
const dd = (s: string) => dmy(s).slice(0, 5);

export default function Departamentos() {
  const { L, S, cfg, now } = useData();
  const [vista, setVista] = useState<Tipo | 'todos'>('todos');
  const [n, setN] = useState(30);
  const hasta = today(), desde = daysAgo(n - 1);
  const dias = useMemo(() => diasEntre(desde, hasta), [desde, hasta]);
  const prev = 2 * n <= 90 ? { d: daysAgo(2 * n - 1), h: daysAgo(n) } : null;

  const resumen = useMemo(() => TIPOS.map((t) => {
    const ls = enRango(L, t, desde, hasta), a = agg(ls), pa = prev ? agg(enRango(L, t, prev.d, prev.h)) : null;
    return { t, ls, a, delta: a.pct != null && pa?.pct != null ? a.pct - pa.pct : null, serie: serieDiaria(ls, dias) };
  }), [L, desde, hasta, prev, dias]);

  return (
    <>
      <section className="sec">
        <h2>Productividad por departamento <small>Kilos reales contra lo que la máquina debía producir (descontando paros no imputables al operador).</small></h2>
        <div className="row" style={{ justifyContent: 'space-between' }}>
          <div className="chips" role="tablist">
            <button aria-pressed={vista === 'todos'} onClick={() => setVista('todos')}>Comparativo</button>
            {TIPOS.map((t) => <button key={t} aria-pressed={vista === t} onClick={() => setVista(t)}>{AREAS[t]}</button>)}
          </div>
          <div className="chips">{[7, 14, 30, 60, 90].map((d) => <button key={d} aria-pressed={n === d} onClick={() => setN(d)}>{d} días</button>)}</div>
        </div>
      </section>
      {vista === 'todos' ? <Comparativo resumen={resumen} dias={dias} n={n} prev={!!prev} /> : <Area key={vista} tipo={vista} dias={dias} desde={desde} hasta={hasta} L={L} S={S} cfg={cfg} now={now} />}
    </>
  );
}

type Res = { t: Tipo; ls: ReturnType<typeof enRango>; a: ReturnType<typeof agg>; delta: number | null; serie: ReturnType<typeof serieDiaria> }[];
function Comparativo({ resumen, dias, n, prev }: { resumen: Res; dias: string[]; n: number; prev: boolean }) {
  const { cfg } = useData();
  const hay = resumen.some((r) => r.a.lines);
  if (!hay) return <Empty>Todavía no hay reportes en estos {n} días. Captura turnos en la pestaña Turno y aquí aparece todo.</Empty>;
  const csv = { head: ['Departamento', 'Kg reales', 'Kg esperados', 'Cumplimiento %', 'Líneas'], rows: resumen.map((r) => [AREAS[r.t], Math.round(r.a.kg), Math.round(r.a.exp), r.a.pct == null ? '' : Math.round(r.a.pct * 100), r.a.lines]) };
  return (
    <>
      <section className="sec">
        <div className="tiles">
          {resumen.map((r) => (
            <div key={r.t} className="tile" style={{ borderTop: `3px solid ${SERIES[TIPOS.indexOf(r.t)]}` }}>
              <small>{AREAS[r.t]}</small>
              <b className={cls(r.a.pct, cfg) === 'bad' ? 't-bad' : ''}>{r.a.lines ? pc(r.a.pct) : '—'}</b><br />
              <em>{r.a.lines ? `${fmt(r.a.kg)} kg${r.a.exp ? ` de ${fmt(r.a.exp)}` : ''}` : 'sin captura en el periodo'}</em>
              {prev && r.delta != null && <div className={`hint ${r.delta < 0 ? 'bad' : ''}`}>{r.delta >= 0 ? '▲' : '▼'} {Math.abs(Math.round(r.delta * 100))} {Math.abs(Math.round(r.delta * 100)) === 1 ? 'pt' : 'pts'} vs periodo anterior</div>}
              <div style={{ marginTop: 4 }}><Spark values={r.serie.map((x) => x.pct)} color={SERIES[TIPOS.indexOf(r.t)]} w={140} /></div>
            </div>
          ))}
        </div>
      </section>
      <section className="sec">
        <div className="cgrid w2">
          <ChartCard title="Cumplimiento diario por departamento" sub="100 % = produjo lo que debía" legend={TIPOS.map((t, i) => ({ name: AREAS[t], color: SERIES[i] })).filter((_, i) => resumen[i].a.lines)}
            table={{ head: ['Día', ...TIPOS.map((t) => AREAS[t])], rows: dias.map((d, i) => [dmy(d), ...resumen.map((r) => pc(r.serie[i].pct))]) }} csvName="cumplimiento-por-departamento">
            <LineChart x={dias} h={240} refLine={100} refLabel="Meta" fy={(v) => Math.round(v) + '%'} fx={dd}
              series={resumen.map((r, i) => ({ name: AREAS[r.t], color: SERIES[i], values: r.serie.map((x) => (x.pct == null ? null : x.pct * 100)) })).filter((_, i) => resumen[i].a.lines)} />
          </ChartCard>
          <ChartCard title="Flujo de kilos por departamento" sub="Lo que pasó por cada etapa en el periodo" table={{ head: ['Departamento', 'Kg'], rows: resumen.map((r) => [AREAS[r.t], Math.round(r.a.kg)]) }} csvName="kilos-por-departamento">
            <HBars rows={resumen.map((r, i) => ({ label: AREAS[r.t], value: r.a.kg, color: SERIES[i] }))} fv={(v) => fmt(v) + ' kg'} />
            <p className="mut" style={{ margin: '6px 0 0' }}>Los kilos de impresión suelen ser menores porque no todo se imprime.</p>
          </ChartCard>
        </div>
      </section>
      <section className="sec">
        <h2>Resumen <button className="btn sm" onClick={() => descargarCSV(`departamentos-${dias[0]}-a-${dias[dias.length - 1]}`, csv)}>CSV</button></h2>
        <Scroll><table className="t"><thead><tr><th>Departamento</th><th className="num">Kg reales</th><th className="num">Kg esperados</th><th>Cumplimiento</th><th className="num">Líneas</th></tr></thead><tbody>
          {resumen.map((r) => <tr key={r.t}><td><b>{AREAS[r.t]}</b></td><td className="num">{fmt(r.a.kg)}</td><td className="num">{fmt(r.a.exp)}</td>
            <td>{r.a.pct == null ? <span className="mut">sin teórico</span> : <div className="row" style={{ flexWrap: 'nowrap', gap: 8 }}><Bar p={r.a.pct} c={cls(r.a.pct, cfg)} w={90} /><span className="mono">{pc(r.a.pct)}</span></div>}</td><td className="num">{r.a.lines}</td></tr>)}
        </tbody></table></Scroll>
      </section>
    </>
  );
}

function Area({ tipo, dias, desde, hasta, L, S, cfg, now }: { tipo: Tipo; dias: string[]; desde: string; hasta: string } & Pick<ReturnType<typeof useData>, 'L' | 'S' | 'cfg' | 'now'>) {
  const ls = useMemo(() => enRango(L, tipo, desde, hasta), [L, tipo, desde, hasta]);
  const maqs = useMemo(() => S.maquinas.filter((m) => m.tipo === tipo), [S.maquinas, tipo]);
  const a = agg(ls);
  const serie = useMemo(() => serieDiaria(ls, dias), [ls, dias]);
  const filas = useMemo(() => porMaquina(ls, maqs, S.paros, cfg, dias, now), [ls, maqs, S.paros, cfg, dias, now]);
  const ops = useMemo(() => porOperador(ls, cfg, dias), [ls, cfg, dias]);
  const turnos = useMemo(() => porTurno(ls), [ls]);
  const sem = useMemo(() => porDiaSemana(ls), [ls]);
  const paros = useMemo(() => paretoParos(S.paros, new Set(maqs.map((m) => m.id)), desde, hasta, now), [S.paros, maqs, desde, hasta, now]);
  const ef = efectividad(ls, filas);
  const bajos = ops.reduce((s, o) => s + o.bajos, 0), totParo = paros.reduce((s, p) => s + p.h, 0);
  const sinTeorico = !a.exp;
  if (!ls.length) return <Empty>No hay producción de {AREAS[tipo]} en este periodo.</Empty>;
  const heatRows = filas.filter((f) => f.turnos > 0);
  const csv = { head: ['Máquina', 'Kg', 'Kg esperados', 'Cumplimiento %', 'Turnos', 'Horas de paro', 'Disponibilidad %'], rows: filas.map((f) => [f.m.nombre, Math.round(f.kg), Math.round(f.exp), f.pct == null ? '' : Math.round(f.pct * 100), f.turnos, +f.paroH.toFixed(1), f.disp == null ? '' : Math.round(f.disp * 100)]) };
  return (
    <>
      <section className="sec">
        <div className="tiles">
          <Tile l="Producción" v={`${fmt(a.kg)} kg`} e={`${fmt(a.lines)} líneas capturadas`} />
          <Tile l="Cumplimiento" v={pc(a.pct)} e={a.exp ? `de ${fmt(a.exp)} kg esperados` : 'sin kg/h teórico'} c={cls(a.pct, cfg) === 'bad' ? 'alert' : ''} />
          <Tile l="Disponibilidad" v={pc(ef.disp)} e={`${fmt(totParo, 1)} h de paro`} />
          <Tile l="Rendimiento" v={pc(ef.rend)} e="velocidad vs. teórica" />
          <Tile l="Efectividad" v={pc(ef.efect)} e="turno completo, sin descontar" />
          <Tile l="Turnos bajos" v={fmt(bajos)} e={`debajo de ${cfg.umbralBajo}%`} c={bajos ? 'alert' : ''} />
        </div>
        {sinTeorico && <div className="banner" style={{ marginTop: 12 }}>Estas máquinas no tienen kg/h teórico, por eso no se puede medir el cumplimiento. Captúralo en Máquinas.</div>}
      </section>

      <section className="sec">
        <div className="cgrid w2">
          <ChartCard title="Kilos por día" sub="Reales vs. esperados" legend={[{ name: 'Reales', color: 'var(--s1)' }, { name: 'Esperados', color: 'var(--s2)' }]}
            table={{ head: ['Día', 'Kg reales', 'Kg esperados', 'Cumplimiento'], rows: serie.map((s) => [dmy(s.dia), Math.round(s.kg), Math.round(s.exp), pc(s.pct)]) }} csvName={`kilos-diarios-${tipo}`}>
            <Columns x={dias} series={[{ name: 'Reales', values: serie.map((s) => s.kg) }, { name: 'Esperados', values: serie.map((s) => s.exp) }]} fy={(v) => fmt(v)} fx={dd} h={230} />
          </ChartCard>
          <ChartCard title="Cumplimiento diario" sub="Línea punteada = meta (100 %)" table={{ head: ['Día', 'Cumplimiento'], rows: serie.map((s) => [dmy(s.dia), pc(s.pct)]) }} csvName={`cumplimiento-${tipo}`}>
            <LineChart x={dias} h={230} refLine={100} fy={(v) => Math.round(v) + '%'} fx={dd} series={[{ name: 'Cumplimiento', values: serie.map((s) => (s.pct == null ? null : s.pct * 100)) }]} />
          </ChartCard>
        </div>
      </section>

      <section className="sec">
        <h2>Por máquina <button className="btn sm" onClick={() => descargarCSV(`maquinas-${tipo}-${desde}-a-${hasta}`, csv)}>CSV</button></h2>
        <Scroll><table className="t"><thead><tr><th>Máquina</th><th className="num">Kg</th><th className="num">Esperado</th><th>Cumplimiento</th><th>Tendencia</th><th className="num">Turnos</th><th className="num">Paro (h)</th><th className="num">Disp.</th></tr></thead><tbody>
          {filas.map((f) => <tr key={f.m.id}><td><b>{f.m.nombre}</b></td><td className="num">{fmt(f.kg)}</td><td className="num">{fmt(f.exp)}</td>
            <td>{f.pct == null ? <span className="mut">{f.turnos ? 'sin teórico' : 'sin turnos'}</span> : <div className="row" style={{ flexWrap: 'nowrap', gap: 8 }}><Bar p={f.pct} c={cls(f.pct, cfg)} w={80} /><span className={`mono ${cls(f.pct, cfg) === 'bad' ? 't-bad' : ''}`}>{pctTxt(f.pct)}</span></div>}</td>
            <td><Spark values={f.serie.map((v) => (v == null ? null : v * 100))} /></td><td className="num">{f.turnos}</td><td className="num">{fmt(f.paroH, 1)}</td><td className="num">{pc(f.disp)}</td></tr>)}
        </tbody></table></Scroll>
      </section>

      {heatRows.length > 0 && !sinTeorico && (
        <section className="sec">
          <ChartCard title="Mapa de calor: máquina × día" sub="Más oscuro = más cumplimiento (50 % a 110 %). Pasa el cursor para ver el valor.">
            <Heat rows={heatRows.map((f) => f.m.nombre)} cols={dias.map(dd)} v={heatRows.map((f) => f.serie)} fv={pc} lo={0.5} hi={1.1} />
          </ChartCard>
        </section>
      )}

      <section className="sec">
        <div className="cgrid">
          <ChartCard title="Ranking de operadores" sub="Cumplimiento del periodo (≥ 1 turno)" table={{ head: ['Operador', 'Turnos', 'Kg', 'Cumplimiento', 'Turnos bajos'], rows: ops.map((o) => [o.operario, o.turnos, Math.round(o.kg), pc(o.pct), o.bajos]) }} csvName={`operadores-${tipo}`}>
            <HBars rows={ops.filter((o) => o.pct != null).slice(0, 12).map((o) => ({ label: o.operario, value: (o.pct as number) * 100, sub: `${o.turnos} turnos`, color: cls(o.pct, cfg) === 'bad' ? 'var(--bad)' : 'var(--s1)' }))} max={120} fv={(v) => Math.round(v) + '%'} />
            {ops.some((o) => o.bajos) && <div className="row">{ops.filter((o) => o.bajos).map((o) => <Pill key={o.operario} c="bad">{o.operario}: {o.bajos} bajo{o.bajos > 1 ? 's' : ''}</Pill>)}</div>}
          </ChartCard>
          <ChartCard title="Turno 1 vs turno 2" sub="Cumplimiento y kilos" legend={[{ name: 'Cumplimiento %', color: 'var(--s1)' }]}
            table={{ head: ['Turno', 'Kg', 'Esperado', 'Cumplimiento'], rows: turnos.map((t) => [`Turno ${t.turno}`, Math.round(t.kg), Math.round(t.exp), pc(t.pct)]) }}>
            <Columns x={['Turno 1', 'Turno 2']} h={200} series={[{ name: 'Cumplimiento %', values: turnos.map((t) => (t.pct == null ? 0 : Math.round(t.pct * 100))) }]} fy={(v) => Math.round(v) + '%'} refLine={100} />
            <div className="row" style={{ justifyContent: 'space-around' }}>{turnos.map((t) => <span key={t.turno} className="mut">Turno {t.turno}: <b className="mono">{fmt(t.kg)} kg</b></span>)}</div>
          </ChartCard>
          <ChartCard title="Por día de la semana" sub="¿Hay días flojos?" table={{ head: ['Día', 'Kg', 'Cumplimiento'], rows: sem.map((s) => [s.dia, Math.round(s.kg), pc(s.pct)]) }}>
            <Columns x={sem.map((s) => s.dia)} h={200} series={[{ name: 'Cumplimiento %', values: sem.map((s) => (s.pct == null ? 0 : Math.round(s.pct * 100))) }]} fy={(v) => Math.round(v) + '%'} refLine={100} />
          </ChartCard>
          <ChartCard title="Pareto de paros" sub={`${fmt(totParo, 1)} h en el periodo · barras = horas, línea = % acumulado`} table={{ head: ['Causa', 'Horas', 'Paros'], rows: paros.map((p) => [p.causa, +p.h.toFixed(1), p.n]) }} csvName={`paros-${tipo}`}>
            {paros.length ? <Pareto rows={paros.slice(0, 8).map((p) => ({ label: p.causa, value: +p.h.toFixed(1) }))} fv={(v) => fmt(v, 1) + ' h'} /> : <Empty>Sin paros registrados. 👏</Empty>}
          </ChartCard>
        </div>
      </section>
    </>
  );
}
