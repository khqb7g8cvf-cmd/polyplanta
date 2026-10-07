'use client';
import { useEffect, useRef, useState, type ReactNode } from 'react';

export const SERIES = ['var(--s1)', 'var(--s2)', 'var(--s3)', 'var(--s4)'];

function useWidth(): [React.RefObject<HTMLDivElement | null>, number] {
  const ref = useRef<HTMLDivElement | null>(null);
  const [w, setW] = useState(0);
  useEffect(() => {
    const el = ref.current; if (!el) return;
    const ro = new ResizeObserver(() => setW(el.clientWidth));
    ro.observe(el); setW(el.clientWidth);
    return () => ro.disconnect();
  }, []);
  return [ref, w];
}

const nice = (max: number) => {
  if (max <= 0) return 1;
  const p = Math.pow(10, Math.floor(Math.log10(max))), f = max / p;
  return (f <= 1 ? 1 : f <= 2 ? 2 : f <= 2.5 ? 2.5 : f <= 5 ? 5 : 10) * p;
};

export interface TableData { head: string[]; rows: (string | number)[][] }

/** Tarjeta de gráfica: título, leyenda, vista de tabla y descarga CSV. */
export function ChartCard({ title, sub, legend, table, children, csvName }: { title: string; sub?: ReactNode; legend?: { name: string; color: string }[]; table?: TableData; children: ReactNode; csvName?: string }) {
  const [tv, setTv] = useState(false);
  return (
    <div className="cc">
      <div className="cch">
        <div><h3>{title}</h3>{sub && <small>{sub}</small>}</div>
        {table && <div className="row" style={{ gap: 6 }}>
          <button className="btn sm" aria-pressed={tv} onClick={() => setTv(!tv)}>{tv ? 'Ver gráfica' : 'Ver tabla'}</button>
          {csvName && <button className="btn sm" onClick={() => descargarCSV(csvName, table)}>CSV</button>}
        </div>}
      </div>
      {legend && legend.length >= 2 && !tv && <div className="lg">{legend.map((l) => <span key={l.name}><i style={{ background: l.color }} />{l.name}</span>)}</div>}
      {tv && table ? (
        <div className="scroll" style={{ maxHeight: 320, overflowY: 'auto' }}><table className="t"><thead><tr>{table.head.map((h, i) => <th key={i} className={i ? 'num' : ''}>{h}</th>)}</tr></thead>
          <tbody>{table.rows.map((r, i) => <tr key={i}>{r.map((c, j) => <td key={j} className={j ? 'num' : ''}>{c}</td>)}</tr>)}</tbody></table></div>
      ) : children}
    </div>
  );
}

export function descargarCSV(name: string, t: TableData) {
  const esc = (v: string | number) => { const s = String(v ?? ''); return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
  const csv = '﻿' + [t.head, ...t.rows].map((r) => r.map(esc).join(',')).join('\n');
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
  a.download = name.endsWith('.csv') ? name : name + '.csv';
  a.click(); URL.revokeObjectURL(a.href);
}

export interface Serie { name: string; values: (number | null)[]; color?: string }

/** Línea / área con cruz y tooltip. `ref` dibuja una línea de referencia (p. ej. 100 %). */
export function LineChart({ x, series, h = 220, fy = (v: number) => String(v), fx = (s: string) => s, refLine, refLabel, min0 = true }: { x: string[]; series: Serie[]; h?: number; fy?: (v: number) => string; fx?: (s: string) => string; refLine?: number; refLabel?: string; min0?: boolean }) {
  const [ref, w] = useWidth();
  const [hi, setHi] = useState<number | null>(null);
  const padL = 44, padR = 10, padT = 10, padB = 24;
  const vals = series.flatMap((s) => s.values).filter((v): v is number => v != null);
  if (refLine != null) vals.push(refLine);
  let lo = min0 ? 0 : Math.min(...vals, Infinity), hiV = Math.max(...vals, 1);
  if (!isFinite(lo)) lo = 0;
  hiV = lo + nice(hiV - lo);
  const iw = Math.max(10, w - padL - padR), ih = h - padT - padB, n = x.length;
  const X = (i: number) => padL + (n <= 1 ? iw / 2 : (i / (n - 1)) * iw), Y = (v: number) => padT + ih - ((v - lo) / (hiV - lo || 1)) * ih;
  const ticks = [0, 1, 2, 3, 4].map((i) => lo + ((hiV - lo) * i) / 4);
  const lw = Math.max(...x.map((v) => fx(v).length), 1) * 6.4 + 16, every = Math.max(1, Math.ceil(n / Math.max(2, Math.floor(iw / lw))));
  return (
    <div ref={ref} className="chart" style={{ height: h }}>
      {w > 0 && (
        <svg width={w} height={h} role="img" onMouseLeave={() => setHi(null)}
          onMouseMove={(e) => { const r = (e.currentTarget as SVGSVGElement).getBoundingClientRect(); const i = Math.round(((e.clientX - r.left - padL) / iw) * (n - 1)); setHi(Math.max(0, Math.min(n - 1, i))); }}>
          {ticks.map((t, i) => <g key={i}><line x1={padL} x2={w - padR} y1={Y(t)} y2={Y(t)} className="grid" /><text x={padL - 6} y={Y(t) + 4} textAnchor="end" className="ax">{fy(t)}</text></g>)}
          {x.map((s, i) => i % every === 0 && <text key={i} x={X(i)} y={h - 6} textAnchor="middle" className="ax">{fx(s)}</text>)}
          {refLine != null && <g><line x1={padL} x2={w - padR} y1={Y(refLine)} y2={Y(refLine)} className="refl" />{refLabel && <text x={w - padR} y={Y(refLine) - 4} textAnchor="end" className="ax">{refLabel}</text>}</g>}
          {series.map((s, si) => {
            const col = s.color || SERIES[si % 4];
            let d = '', pen = false, area = '', seg: number[] = [];
            const flush = () => { if (seg.length > 1) area += `M${X(seg[0])},${Y(lo)}` + seg.map((i) => `L${X(i).toFixed(1)},${Y(s.values[i]!).toFixed(1)}`).join('') + `L${X(seg[seg.length - 1])},${Y(lo)}Z`; seg = []; };
            s.values.forEach((v, i) => { if (v == null) { pen = false; flush(); return; } d += `${pen ? 'L' : 'M'}${X(i).toFixed(1)},${Y(v).toFixed(1)}`; pen = true; seg.push(i); });
            flush();
            return <g key={si}>
              {series.length === 1 && <path d={area} fill={col} opacity=".1" />}
              <path d={d} fill="none" stroke={col} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
              {n <= 40 && s.values.map((v, i) => v != null && <circle key={i} cx={X(i)} cy={Y(v)} r={n > 20 ? 2 : 3} fill={col} stroke="var(--surface)" strokeWidth="1.5" />)}
            </g>;
          })}
          {hi != null && <g><line x1={X(hi)} x2={X(hi)} y1={padT} y2={padT + ih} className="cross" />
            {series.map((s, si) => s.values[hi] != null && <circle key={si} cx={X(hi)} cy={Y(s.values[hi]!)} r="5" fill={s.color || SERIES[si % 4]} stroke="var(--surface)" strokeWidth="2" />)}</g>}
        </svg>
      )}
      {hi != null && w > 0 && (
        <div className="tip" style={{ left: Math.min(Math.max(X(hi) + 12, 0), w - 150), top: 6 }}>
          <b>{fx(x[hi])}</b>
          {series.map((s, si) => <div key={si}><i style={{ background: s.color || SERIES[si % 4] }} />{series.length > 1 ? s.name + ': ' : ''}<span className="mono">{s.values[hi] == null ? '—' : fy(s.values[hi]!)}</span></div>)}
        </div>
      )}
    </div>
  );
}

/** Columnas (agrupadas o apiladas) con tooltip. */
export function Columns({ x, series, h = 200, stacked, fy = (v: number) => String(v), fx = (s: string) => s, refLine }: { x: string[]; series: Serie[]; h?: number; stacked?: boolean; fy?: (v: number) => string; fx?: (s: string) => string; refLine?: number }) {
  const [ref, w] = useWidth();
  const [hi, setHi] = useState<number | null>(null);
  const padL = 44, padR = 8, padT = 10, padB = 24, n = x.length;
  const tot = (i: number) => series.reduce((s, z) => s + (z.values[i] || 0), 0);
  const mx = Math.max(refLine || 0, ...x.map((_, i) => (stacked ? tot(i) : Math.max(...series.map((z) => z.values[i] || 0)))), 1);
  const top = nice(mx), iw = Math.max(10, w - padL - padR), ih = h - padT - padB, slot = iw / Math.max(1, n);
  const Y = (v: number) => padT + ih - (v / top) * ih;
  const gw = Math.min(28, Math.max(3, slot * 0.7)), bw = stacked ? gw : Math.max(2, gw / series.length - 1);
  const lw = Math.max(...x.map((v) => fx(v).length), 1) * 6.4 + 12, every = Math.max(1, Math.ceil(n / Math.max(2, Math.floor(iw / lw))));
  return (
    <div ref={ref} className="chart" style={{ height: h }}>
      {w > 0 && (
        <svg width={w} height={h} role="img" onMouseLeave={() => setHi(null)}>
          {[0, 1, 2, 3, 4].map((i) => { const t = (top * i) / 4; return <g key={i}><line x1={padL} x2={w - padR} y1={Y(t)} y2={Y(t)} className="grid" /><text x={padL - 6} y={Y(t) + 4} textAnchor="end" className="ax">{fy(t)}</text></g>; })}
          {refLine != null && <line x1={padL} x2={w - padR} y1={Y(refLine)} y2={Y(refLine)} className="refl" />}
          {x.map((s, i) => {
            const cx = padL + slot * i + slot / 2;
            let acc = 0;
            return <g key={i} onMouseEnter={() => setHi(i)}>
              <rect x={padL + slot * i} y={padT} width={slot} height={ih} fill="transparent" />
              {i % every === 0 && <text x={cx} y={h - 6} textAnchor="middle" className="ax">{fx(s)}</text>}
              {series.map((z, si) => {
                const v = z.values[i] || 0; if (!v) return null;
                const col = z.color || SERIES[si % 4];
                if (stacked) { const y1 = Y(acc + v), y0 = Y(acc); acc += v; return <rect key={si} x={cx - bw / 2} y={y1} width={bw} height={Math.max(0, y0 - y1 - 1)} fill={col} rx="2" opacity={hi == null || hi === i ? 1 : 0.55} />; }
                const bx = cx - gw / 2 + si * (bw + 1);
                return <rect key={si} x={bx} y={Y(v)} width={bw} height={Math.max(0, Y(0) - Y(v))} fill={col} rx="2" opacity={hi == null || hi === i ? 1 : 0.55} />;
              })}
            </g>;
          })}
        </svg>
      )}
      {hi != null && w > 0 && (
        <div className="tip" style={{ left: Math.min(Math.max(padL + slot * hi + slot / 2 + 10, 0), w - 150), top: 6 }}>
          <b>{fx(x[hi])}</b>
          {series.map((s, si) => <div key={si}><i style={{ background: s.color || SERIES[si % 4] }} />{series.length > 1 ? s.name + ': ' : ''}<span className="mono">{fy(s.values[hi] || 0)}</span></div>)}
          {stacked && series.length > 1 && <div className="mut">Total <span className="mono">{fy(tot(hi))}</span></div>}
        </div>
      )}
    </div>
  );
}

/** Barras horizontales con valor al final. */
export function HBars({ rows, max, fv = (v: number) => String(v), color = 'var(--s1)' }: { rows: { label: ReactNode; value: number; sub?: ReactNode; color?: string }[]; max?: number; fv?: (v: number) => string; color?: string }) {
  const mx = max ?? Math.max(...rows.map((r) => r.value), 1);
  return (
    <div className="hb">
      {rows.map((r, i) => (
        <div key={i} className="hbr" title={`${typeof r.label === 'string' ? r.label : ''} ${fv(r.value)}`}>
          <span className="l">{r.label}</span>
          <span className="tr"><i style={{ width: `${Math.max(0, Math.min(1, r.value / mx)) * 100}%`, background: r.color || color }} /></span>
          <span className="v mono">{fv(r.value)}{r.sub && <small>{r.sub}</small>}</span>
        </div>
      ))}
    </div>
  );
}

/** Mapa de calor filas × columnas. `v` null = sin dato. Escala secuencial de un solo tono. */
export function Heat({ rows, cols, v, fv, lo = 0, hi = 1, title }: { rows: string[]; cols: string[]; v: (number | null)[][]; fv: (n: number) => string; lo?: number; hi?: number; title?: (r: string, c: string, n: number | null) => string }) {
  return (
    <div className="heat" style={{ gridTemplateColumns: `minmax(90px,130px) repeat(${cols.length}, minmax(14px,1fr))` }}>
      <span />
      {cols.map((c, i) => <span key={i} className="hc">{i % Math.ceil(cols.length / 14) === 0 ? c : ''}</span>)}
      {rows.map((r, ri) => (
        <div key={ri} style={{ display: 'contents' }}>
          <span className="hr">{r}</span>
          {cols.map((c, ci) => {
            const n = v[ri][ci];
            const t = n == null ? 0 : Math.max(0, Math.min(1, (n - lo) / (hi - lo || 1)));
            return <span key={ci} className="hcell" title={title ? title(r, c, n) : `${r} · ${c}: ${n == null ? 'sin dato' : fv(n)}`}
              style={n == null ? { background: 'var(--surface2)' } : { background: `color-mix(in srgb, var(--s1) ${Math.round(12 + t * 88)}%, var(--surface))` }} />;
          })}
        </div>
      ))}
    </div>
  );
}

/** Pareto: barras descendentes + acumulado %. */
export function Pareto({ rows, fv = (v: number) => String(v), h = 220 }: { rows: { label: string; value: number }[]; fv?: (v: number) => string; h?: number }) {
  const [ref, w] = useWidth();
  const [hi, setHi] = useState<number | null>(null);
  const total = rows.reduce((s, r) => s + r.value, 0) || 1, mx = nice(Math.max(...rows.map((r) => r.value), 1));
  const padL = 44, padR = 40, padT = 10, padB = 46, n = rows.length, iw = Math.max(10, w - padL - padR), ih = h - padT - padB, slot = iw / Math.max(1, n);
  let acc = 0;
  const pts = rows.map((r, i) => { acc += r.value; return [padL + slot * i + slot / 2, padT + ih - (acc / total) * ih] as const; });
  return (
    <div ref={ref} className="chart" style={{ height: h }}>
      {w > 0 && (
        <svg width={w} height={h} role="img" onMouseLeave={() => setHi(null)}>
          {[0, 1, 2, 3, 4].map((i) => { const y = padT + ih - (ih * i) / 4; return <g key={i}><line x1={padL} x2={w - padR} y1={y} y2={y} className="grid" /><text x={padL - 6} y={y + 4} textAnchor="end" className="ax">{fv((mx * i) / 4)}</text><text x={w - padR + 6} y={y + 4} className="ax">{i * 25}%</text></g>; })}
          {rows.map((r, i) => {
            const bh = (r.value / mx) * ih, cx = padL + slot * i + slot / 2, bw = Math.min(34, slot * 0.7);
            return <g key={i} onMouseEnter={() => setHi(i)}>
              <rect x={cx - bw / 2} y={padT + ih - bh} width={bw} height={Math.max(0, bh)} rx="3" fill="var(--s1)" opacity={hi == null || hi === i ? 1 : 0.55} />
              <text x={cx} y={h - 28} textAnchor="end" className="ax" transform={`rotate(-30 ${cx} ${h - 28})`}>{r.label.length > 14 ? r.label.slice(0, 13) + '…' : r.label}</text>
              <rect x={padL + slot * i} y={padT} width={slot} height={ih} fill="transparent" />
            </g>;
          })}
          <path d={pts.map((p, i) => `${i ? 'L' : 'M'}${p[0]},${p[1]}`).join('')} fill="none" stroke="var(--s2)" strokeWidth="2" />
          {pts.map((p, i) => <circle key={i} cx={p[0]} cy={p[1]} r="3" fill="var(--s2)" stroke="var(--surface)" strokeWidth="1.5" />)}
        </svg>
      )}
      {hi != null && w > 0 && (
        <div className="tip" style={{ left: Math.min(padL + slot * hi + slot / 2 + 10, w - 160), top: 6 }}>
          <b>{rows[hi].label}</b>
          <div><i style={{ background: 'var(--s1)' }} />Total: <span className="mono">{fv(rows[hi].value)}</span></div>
          <div><i style={{ background: 'var(--s2)' }} />Acumulado: <span className="mono">{Math.round((pts.slice(0, hi + 1).length && rows.slice(0, hi + 1).reduce((s, r) => s + r.value, 0) / total) * 100)}%</span></div>
        </div>
      )}
    </div>
  );
}

/** Mini línea sin ejes. */
export function Spark({ values, color = 'var(--s1)', w = 96, h = 26 }: { values: (number | null)[]; color?: string; w?: number; h?: number }) {
  const v = values.filter((x): x is number => x != null);
  if (v.length < 2) return <span className="mut">—</span>;
  const lo = Math.min(...v), hiV = Math.max(...v), n = values.length;
  let d = '', pen = false;
  values.forEach((x, i) => { if (x == null) { pen = false; return; } d += `${pen ? 'L' : 'M'}${((i / (n - 1)) * (w - 4) + 2).toFixed(1)},${(h - 3 - ((x - lo) / (hiV - lo || 1)) * (h - 6)).toFixed(1)}`; pen = true; });
  return <svg width={w} height={h} aria-hidden><path d={d} fill="none" stroke={color} strokeWidth="1.8" strokeLinejoin="round" strokeLinecap="round" /></svg>;
}
