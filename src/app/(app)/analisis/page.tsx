'use client';
import { useState } from 'react';
import { useData } from '@/lib/data';
import { AREAS, cls, pctTxt, sumL } from '@/lib/calc';
import { fmt, sum, ymd } from '@/lib/format';
import { Empty, PctCell, Pill, Scroll, Tile } from '@/components/ui';
import { Trend, durH, useMoney } from '@/components/shared';

export default function Analisis() {
  const { S, L, cfg, maqs, maqById, now } = useData();
  const money = useMoney();
  const [days, setDays] = useState(30), [area, setArea] = useState('todas');
  const cutS = ymd(new Date(now - days * 864e5)), cutI = new Date(now - days * 864e5).toISOString();
  const PL = L.filter((x) => x.fecha >= cutS), P = S.paros.filter((p) => p.inicio >= cutI), tot = sumL(PL);
  const mrows = maqs().map((m) => {
    const ls = PL.filter((x) => x.maquina_id === m.id), s = sumL(ls), porOp: Record<string, { e: number; k: number }> = {};
    ls.filter((x) => x.exp).forEach((x) => { const k = x.operario || 'Sin nombre', o = porOp[k] || (porOp[k] = { e: 0, k: 0 }); o.e += x.exp!; o.k += x.kilos; });
    const ops = Object.values(porOp), bajos = ops.filter((o) => (o.k / o.e) * 100 < cfg.umbralBajo).length;
    let dx: '' | 'maq' | 'op' | 'op1' = '';
    if (s.pct != null && s.pct * 100 < cfg.umbralBajo) dx = ops.length >= 2 && bajos >= ops.length * 0.66 ? 'maq' : ops.length === 1 ? 'op1' : 'op';
    const ps = P.filter((p) => p.maquina_id === m.id), hp = sum(ps, (p) => durH(p, now)), porC: Record<string, number> = {};
    ps.forEach((p) => (porC[p.causa] = (porC[p.causa] || 0) + durH(p, now)));
    return { m, s, n: new Set(ls.map((x) => x.reporte_id)).size, dx, hp, top: Object.entries(porC).sort((a, b) => b[1] - a[1])[0], lpar: s.expRaw - s.exp, lren: Math.max(0, s.exp - s.kgE) };
  }).filter((r) => r.s.n || r.hp);
  const pr = P.filter((p) => area === 'todas' || maqById(p.maquina_id)?.tipo === area), porC: Record<string, number> = {};
  pr.forEach((p) => (porC[p.causa] = (porC[p.causa] || 0) + durH(p, now)));
  const causas = Object.entries(porC).sort((a, b) => b[1] - a[1]), maxC = causas[0]?.[1] || 1;
  const maqP = mrows.filter((r) => (area === 'todas' || r.m.tipo === area) && r.hp > 0).sort((a, b) => b.hp - a.hp), maxM = maqP[0]?.hp || 1;
  const cambios = P.filter((p) => p.causa === 'Cambio de orden' && maqById(p.maquina_id)?.tipo === 'impresion');
  const dxT = { maq: <Pill c="bad">Problema de máquina</Pill>, op: <Pill c="warn">Revisar operadores</Pill>, op1: <Pill c="warn">Solo un operador</Pill>, '': <span className="mut">—</span> };
  const perd = Math.max(0, tot.exp - tot.kgE), porParo = Math.max(0, tot.expRaw - tot.exp);
  return (
    <>
      <section className="sec">
        <h2>Análisis <span className="chips">{[7, 30, 60].map((d) => <button key={d} aria-pressed={days === d} onClick={() => setDays(d)}>{d} días</button>)}</span></h2>
        {PL.length ? (
          <div className="tiles" style={{ marginBottom: 16 }}>
            <Tile l="Cumplimiento" v={<b className={cls(tot.pct, cfg)}>{pctTxt(tot.pct)}</b>} e={`${tot.n} líneas de reporte`} />
            <Tile l="Kg no producidos por rendimiento" v={fmt(perd)} e={money(perd).replace(' · ', '') || 'abajo de la meta ajustada'} />
            <Tile l="Kg perdidos por paros justificados" v={fmt(porParo)} e="mecánico, eléctrico, material" />
          </div>
        ) : <div className="empty" style={{ marginBottom: 14 }}>Todavía no hay reportes en este periodo.</div>}
        <h3 style={{ marginBottom: 6 }}>Por máquina</h3>
        <Scroll><table className="t"><thead><tr><th>Máquina</th><th className="num">Turnos</th><th>Cumplimiento</th><th className="num">Kg perdidos<br />por paro</th><th className="num">Kg perdidos<br />por rendimiento</th><th className="num">Horas paro</th><th>Causa principal</th><th>Diagnóstico</th></tr></thead><tbody>
          {mrows.map((r) => (
            <tr key={r.m.id}><td>{r.m.nombre} <span className="mut">{AREAS[r.m.tipo]}</span></td><td className="num">{r.n}</td><td><PctCell p={r.s.pct} c={cls(r.s.pct, cfg)} txt={pctTxt(r.s.pct)} /></td>
              <td className="num">{fmt(r.lpar)}</td><td className="num">{fmt(r.lren)}</td><td className="num">{fmt(r.hp, 1)}</td>
              <td>{r.top ? <>{r.top[0]} <span className="mut">{fmt(r.top[1], 1)} h</span></> : '—'}</td><td>{dxT[r.dx]}</td></tr>))}
          {!mrows.length && <tr><td colSpan={8} className="mut">Sin datos.</td></tr>}
        </tbody></table></Scroll>
        <p className="mut" style={{ marginTop: 6, maxWidth: '80ch' }}>Diagnóstico: si varios operadores distintos quedan bajo meta en la misma máquina, el problema es de la máquina y no de la gente. Si solo uno queda bajo, revisa al operador.</p>
      </section>
      <section className="sec">
        <h2>Dónde se va el tiempo <span className="chips">{[['todas', 'Toda la planta'], ['extrusion', 'Extrusión'], ['impresion', 'Impresión'], ['bolseo', 'Bolseo']].map(([k, t]) => <button key={k} aria-pressed={area === k} onClick={() => setArea(k)}>{t}</button>)}</span></h2>
        <div className="split">
          <div><h3 style={{ marginBottom: 8 }}>Horas de paro por causa</h3>{causas.length ? <div className="bars">{causas.map(([c, h]) => <div className="b" key={c}><span>{c}</span><div className="bar"><i style={{ width: `${(h / maxC) * 100}%` }} /></div><span className="mono num">{fmt(h, 1)} h</span></div>)}</div> : <Empty>Sin paros en el periodo.</Empty>}</div>
          <div><h3 style={{ marginBottom: 8 }}>Horas de paro por máquina</h3>{maqP.length ? <div className="bars">{maqP.map((r) => <div className="b" key={r.m.id}><span>{r.m.nombre}</span><div className="bar bad"><i style={{ width: `${(r.hp / maxM) * 100}%` }} /></div><span className="mono num">{fmt(r.hp, 1)} h</span></div>)}</div> : <Empty>Sin paros en el periodo.</Empty>}</div>
        </div>
        {cambios.length > 0 && <p className="mut" style={{ marginTop: 12 }}>Cambios de orden en impresoras: <b>{cambios.length}</b> en {days} días, <b>{fmt(sum(cambios, (p) => durH(p, now)), 1)} h</b> en total, <b>{fmt((sum(cambios, (p) => durH(p, now)) / cambios.length) * 60, 0)} min</b> en promedio.</p>}
      </section>
      <section className="sec"><h2>Cumplimiento diario <small>la línea es el 100%</small></h2><Trend days={Math.min(days, 30)} /></section>
    </>
  );
}
