'use client';
import { useMemo, useState } from 'react';
import { useData } from '@/lib/data';
import { dmy, fmt, hhmm, localDT, sum, ymd, daysAgo } from '@/lib/format';
import { conciliacion, existenciaDiaria, kardex, MOTIVOS, motivoTxt, proveedores, resumenMateriales, salidasPor, type MatResumen } from '@/lib/inv';
import { diasEntre } from '@/lib/analytics';
import { ChartCard, Columns, HBars, LineChart, Spark, descargarCSV, SERIES } from '@/components/charts';
import { AreaF, Empty, Fld, Modal, NumF, Pill, Scroll, SelF, Tile, TxtF } from '@/components/ui';
import type { Material } from '@/lib/types';

const CAT: [string, string][] = [['resina', 'Resina'], ['reciclado', 'Reciclado'], ['masterbatch', 'Masterbatch / pigmento'], ['aditivo', 'Aditivo']];
type Modo = { k: 'entrada' | 'salida' | 'conteo'; mat?: string } | { k: 'material'; m?: Material } | { k: 'ficha'; id: string } | null;
type Tab = 'resumen' | 'kardex' | 'consumo' | 'proveedores';
const dd = (s: string) => dmy(s).slice(0, 5);

export default function Inventario() {
  const { S, now, canProd, isDueno, L } = useData();
  const [modo, setModo] = useState<Modo>(null), [tab, setTab] = useState<Tab>('resumen');
  const res = useMemo(() => resumenMateriales(S.materiales, S.existencias, S.movs, now), [S.materiales, S.existencias, S.movs, now]);
  const con = conciliacion(S.movs, L, daysAgo(29), ymd(new Date(now)));
  const valor = sum(res, (r) => r.valor || 0), bajos = res.filter((r) => r.bajo);
  const dias60 = useMemo(() => diasEntre(daysAgo(59), ymd(new Date(now))), [now]);
  return (
    <>
      <section className="sec">
        <h2>Inventario
          <span className="row">
            <button className="btn" disabled={!canProd} onClick={() => setModo({ k: 'conteo' })}>Conteo físico</button>
            <button className="btn" disabled={!canProd} onClick={() => setModo({ k: 'salida' })}>− Salida</button>
            <button className="btn primary" disabled={!canProd} onClick={() => setModo({ k: 'entrada' })}>+ Entrada</button>
          </span></h2>
        <div className="tiles">
          <Tile l="Bajo mínimo" v={bajos.length} e={bajos.length ? bajos.map((x) => x.m.nombre).join(', ') : 'todo arriba del mínimo'} c={bajos.length ? 'alert' : ''} />
          <Tile l="Valor en bodega" v={valor ? '$' + fmt(valor) : '—'} e="al último costo por kg capturado" />
          <Tile l="Salidas · 30 días" v={fmt(con.salidas) + ' kg'} e="de bodega a producción" />
          <Tile l="Diferencia vs extruido" v={con.salidas ? fmt(con.dif) + ' kg' : '—'} e={con.pct == null ? 'sin salidas capturadas' : con.dif >= 0 ? `${fmt(con.pct * 100, 1)}% de lo que salió no aparece extruido (merma o reportes incompletos)` : 'se extruyó más de lo registrado: faltan salidas por capturar'} c={con.pct != null && Math.abs(con.pct) > 0.1 ? 'alert' : ''} />
        </div>
        <div className="chips" style={{ marginTop: 16 }} role="tablist">
          {([['resumen', 'Resumen'], ['kardex', 'Kardex (historial)'], ['consumo', 'Consumo'], ['proveedores', 'Proveedores y precios']] as [Tab, string][]).map(([k, t]) => <button key={k} aria-pressed={tab === k} onClick={() => setTab(k)}>{t}</button>)}
        </div>
      </section>

      {tab === 'resumen' && (
        <section className="sec">
          {res.length ? (
            <Scroll><table className="t"><thead><tr><th>Material</th><th className="num">Existencia</th><th className="num">Sacos</th><th className="num">Mínimo</th><th>60 días</th><th className="num">Consumo/día</th><th className="num">Cobertura</th><th>Estado</th><th className="num">$/kg</th><th></th></tr></thead><tbody>
              {res.map((r: MatResumen) => (
                <tr key={r.m.id} className="click" onClick={() => setModo({ k: 'ficha', id: r.m.id })}>
                  <td><b>{r.m.nombre}</b><div className="mut">{CAT.find((c) => c[0] === r.m.categoria)?.[1]}</div></td>
                  <td className="num">{fmt(r.kg)} kg</td><td className="num">{fmt(r.sacos, 1)}</td><td className="num">{fmt(r.m.minimo_kg)}</td>
                  <td><Spark values={existenciaDiaria(S.movs.filter((x) => x.material_id === r.m.id), r.kg, dias60)} color={r.bajo ? 'var(--bad)' : 'var(--s1)'} /></td>
                  <td className="num">{r.consumoDia ? fmt(r.consumoDia, 0) + ' kg' : '—'}</td>
                  <td className="num">{r.dias == null ? '—' : fmt(r.dias, 0) + ' d'}</td>
                  <td>{r.kg <= 0 ? <Pill c="bad">Sin existencia</Pill> : r.bajo ? <Pill c="bad">Bajo mínimo</Pill> : r.dias != null && r.dias < 7 ? <Pill c="warn">Menos de 7 días</Pill> : <Pill c="good">Bien</Pill>}</td>
                  <td className="num">{r.costoKg ? fmt(r.costoKg, 2) : '—'}</td>
                  <td style={{ whiteSpace: 'nowrap' }} onClick={(e) => e.stopPropagation()}>{canProd && <><button className="btn sm" onClick={() => setModo({ k: 'entrada', mat: r.m.id })}>Entrada</button>{' '}<button className="btn sm" onClick={() => setModo({ k: 'salida', mat: r.m.id })}>Salida</button>{' '}</>}{isDueno && <button className="btn sm" onClick={() => setModo({ k: 'material', m: r.m })}>Editar</button>}</td>
                </tr>))}
            </tbody></table></Scroll>
          ) : <Empty>Todavía no hay materiales. {isDueno ? 'Agrega el primero.' : 'El dueño debe darlos de alta.'}</Empty>}
          {isDueno && <p style={{ marginTop: 10 }}><button className="btn sm" onClick={() => setModo({ k: 'material' })}>+ Nuevo material</button></p>}
          <p className="mut" style={{ marginTop: 8, maxWidth: '80ch' }}>Toca un material para ver su ficha con gráficas e historial. La cobertura usa el consumo de los últimos 30 días (solo salidas capturadas).</p>
        </section>
      )}
      {tab === 'kardex' && <Kardex />}
      {tab === 'consumo' && <Consumo />}
      {tab === 'proveedores' && <Proveedores />}

      {modo && (modo.k === 'entrada' || modo.k === 'salida') && <Mov tipo={modo.k} mat={modo.mat} onClose={() => setModo(null)} />}
      {modo?.k === 'conteo' && <Conteo onClose={() => setModo(null)} />}
      {modo?.k === 'material' && <Mat m={modo.m} onClose={() => setModo(null)} />}
      {modo?.k === 'ficha' && <Ficha id={modo.id} onClose={() => setModo(null)} />}
    </>
  );
}

const tipoPill = (t: string) => <Pill c={t === 'entrada' ? 'good' : t === 'salida' ? 'ink' : 'warn'}>{t}</Pill>;

function Kardex() {
  const { S, isDueno, maqById, ordById, quien, run, db, now } = useData();
  const [f, setF] = useState({ mat: '', tipo: '', motivo: '', user: '', desde: daysAgo(29), hasta: ymd(new Date(now)), q: '' });
  const p = (k: Partial<typeof f>) => setF((s) => ({ ...s, ...k }));
  const matBy = (id: string) => S.materiales.find((m) => m.id === id)?.nombre || '?';
  const rows = useMemo(() => kardex(S.movs, S.existencias), [S.movs, S.existencias]);
  const vis = useMemo(() => {
    const q = f.q.trim().toLowerCase();
    return rows.filter((x) => {
      const d = x.fecha.slice(0, 10);
      if (d < f.desde || d > f.hasta) return false;
      if (f.mat && x.material_id !== f.mat) return false;
      if (f.tipo && x.tipo !== f.tipo) return false;
      if (f.motivo && (x.motivo || (x.tipo === 'entrada' ? 'compra' : '')) !== f.motivo) return false;
      if (f.user && x.created_by !== f.user) return false;
      if (q && !`${x.proveedor ?? ''} ${x.lote ?? ''} ${x.factura ?? ''} ${x.referencia ?? ''} ${x.nota ?? ''} ${matBy(x.material_id)}`.toLowerCase().includes(q)) return false;
      return true;
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows, f, S.materiales]);
  const ent = sum(vis.filter((x) => x.delta_kg > 0), (x) => x.delta_kg), sal = -sum(vis.filter((x) => x.delta_kg < 0), (x) => x.delta_kg);
  const destino = (x: (typeof vis)[number]) => [x.referencia, x.orden_id && ordById(x.orden_id) ? `OT ${ordById(x.orden_id)!.folio}` : '', x.maquina_id && maqById(x.maquina_id)?.nombre].filter(Boolean).join(' · ');
  const csv = { head: ['Fecha', 'Material', 'Tipo', 'Entrada kg', 'Salida kg', 'Saldo kg', 'Motivo', 'Destino / referencia', 'Proveedor', 'Lote', 'Factura', 'Costo/kg', 'Registró', 'Capturado', 'Nota'], rows: vis.map((x) => [x.fecha.slice(0, 16).replace('T', ' '), matBy(x.material_id), x.tipo, x.delta_kg > 0 ? x.delta_kg : '', x.delta_kg < 0 ? -x.delta_kg : '', Math.round(x.saldo * 10) / 10, motivoTxt(x.motivo, x.tipo), destino(x), x.proveedor ?? '', x.lote ?? '', x.factura ?? '', x.costo_kg ?? '', quien(x.created_by), x.created_at?.slice(0, 16).replace('T', ' ') ?? '', x.nota ?? '']) };
  return (
    <section className="sec">
      <h2>Kardex <small>Cuándo llegó, cuándo salió, para qué y quién lo registró. Con saldo corrido por material.</small></h2>
      <div className="filters" style={{ marginBottom: 12 }}>
        <label className="f"><span>Material</span><select value={f.mat} onChange={(e) => p({ mat: e.target.value })}><option value="">Todos</option>{S.materiales.map((m) => <option key={m.id} value={m.id}>{m.nombre}</option>)}</select></label>
        <label className="f"><span>Tipo</span><select value={f.tipo} onChange={(e) => p({ tipo: e.target.value })}><option value="">Todos</option><option value="entrada">Entradas</option><option value="salida">Salidas</option><option value="ajuste">Ajustes</option></select></label>
        <label className="f"><span>Motivo</span><select value={f.motivo} onChange={(e) => p({ motivo: e.target.value })}><option value="">Todos</option><option value="compra">Compra</option>{MOTIVOS.map(([k, t]) => <option key={k} value={k}>{t}</option>)}</select></label>
        <label className="f"><span>Registró</span><select value={f.user} onChange={(e) => p({ user: e.target.value })}><option value="">Todos</option>{S.usuarios.map((u) => <option key={u.id} value={u.id}>{u.usuario || u.nombre}</option>)}</select></label>
        <label className="f"><span>Desde</span><input type="date" value={f.desde} onChange={(e) => p({ desde: e.target.value })} /></label>
        <label className="f"><span>Hasta</span><input type="date" value={f.hasta} onChange={(e) => p({ hasta: e.target.value })} /></label>
        <label className="f" style={{ flex: 1, minWidth: 150 }}><span>Buscar</span><input placeholder="proveedor, lote, factura…" value={f.q} onChange={(e) => p({ q: e.target.value })} /></label>
        <div className="row" style={{ paddingBottom: 4 }}><button className="btn sm" onClick={() => descargarCSV(`kardex-${f.desde}-a-${f.hasta}`, csv)}>CSV</button><button className="btn sm" onClick={() => window.print()}>Imprimir</button></div>
      </div>
      {vis.length ? (
        <Scroll><table className="t kardex"><thead><tr><th>Fecha</th><th>Material</th><th>Tipo</th><th className="num">Entrada</th><th className="num">Salida</th><th className="num">Saldo</th><th>Motivo</th><th>Destino / referencia</th><th>Proveedor · lote · factura</th><th>Registró</th><th></th></tr></thead><tbody>
          {vis.slice(0, 500).map((x) => (
            <tr key={x.id}>
              <td className="mono" style={{ whiteSpace: 'nowrap' }}>{dmy(x.fecha)} {hhmm(x.fecha)}</td><td>{matBy(x.material_id)}</td><td>{tipoPill(x.tipo)}</td>
              <td className="num" style={{ color: 'var(--good)' }}>{x.delta_kg > 0 ? fmt(x.delta_kg, 1) : ''}</td><td className="num" style={{ color: 'var(--bad)' }}>{x.delta_kg < 0 ? fmt(-x.delta_kg, 1) : ''}</td>
              <td className="num"><b>{fmt(x.saldo, 1)}</b></td>
              <td>{motivoTxt(x.motivo, x.tipo)}</td><td>{destino(x) || <span className="mut">—</span>}{x.nota && <div className="mut">{x.nota}</div>}</td>
              <td>{[x.proveedor, x.lote && `lote ${x.lote}`, x.factura && `fact. ${x.factura}`, x.costo_kg && `$${fmt(x.costo_kg, 2)}/kg`].filter(Boolean).join(' · ') || <span className="mut">—</span>}</td>
              <td><b>{quien(x.created_by)}</b><div className="mut">{x.created_at ? `${dmy(x.created_at)} ${hhmm(x.created_at)}` : ''}</div></td>
              <td>{isDueno && <button className="btn sm danger" onClick={() => confirm('¿Anular este movimiento? Cambia la existencia y queda en la bitácora.') && run(db.from('inv_movimientos').delete().eq('id', x.id), 'Movimiento anulado')}>Anular</button>}</td>
            </tr>))}
        </tbody>
          <tfoot><tr><td colSpan={3}><b>Totales del filtro ({fmt(vis.length)})</b></td><td className="num" style={{ color: 'var(--good)' }}><b>{fmt(ent, 1)}</b></td><td className="num" style={{ color: 'var(--bad)' }}><b>{fmt(sal, 1)}</b></td><td className="num"><b>{ent - sal >= 0 ? '+' : ''}{fmt(ent - sal, 1)}</b></td><td colSpan={5} className="mut">neto del periodo (kg)</td></tr></tfoot>
        </table></Scroll>
      ) : <Empty>No hay movimientos con estos filtros.</Empty>}
      {vis.length > 500 && <p className="mut">Mostrando 500 de {fmt(vis.length)}. Usa los filtros o el CSV.</p>}
    </section>
  );
}

function Consumo() {
  const { S, maqById, quien, now } = useData();
  const [n, setN] = useState(30), [mat, setMat] = useState('');
  const dias = useMemo(() => diasEntre(daysAgo(n - 1), ymd(new Date(now))), [n, now]);
  const sal = useMemo(() => S.movs.filter((x) => x.tipo === 'salida' && x.fecha.slice(0, 10) >= dias[0] && (!mat || x.material_id === mat)), [S.movs, dias, mat]);
  const total = sum(sal, (x) => -x.delta_kg);
  const diario = dias.map((d) => sum(sal.filter((x) => x.fecha.slice(0, 10) === d), (x) => -x.delta_kg));
  const porMot = salidasPor(sal, (x) => motivoTxt(x.motivo, 'salida')), porMaq = salidasPor(sal, (x) => (x.maquina_id ? maqById(x.maquina_id)?.nombre || '?' : 'Sin extrusora')), porUser = salidasPor(sal, (x) => quien(x.created_by)), porMat = salidasPor(sal, (x) => S.materiales.find((m) => m.id === x.material_id)?.nombre || '?');
  const ref = salidasPor(sal.filter((x) => x.referencia), (x) => x.referencia as string).slice(0, 8);
  const sinMotivo = sal.filter((x) => !x.motivo).length;
  if (!S.movs.some((x) => x.tipo === 'salida')) return <section className="sec"><Empty>Todavía no hay salidas capturadas. Cada vez que saques material de bodega, regístralo con su motivo y aquí verás a dónde se va.</Empty></section>;
  return (
    <section className="sec">
      <div className="row" style={{ justifyContent: 'space-between', marginBottom: 12 }}>
        <div className="chips">{[7, 14, 30, 60, 90].map((d) => <button key={d} aria-pressed={n === d} onClick={() => setN(d)}>{d} días</button>)}</div>
        <select className="inp" style={{ width: 'auto' }} value={mat} onChange={(e) => setMat(e.target.value)}><option value="">Todos los materiales</option>{S.materiales.map((m) => <option key={m.id} value={m.id}>{m.nombre}</option>)}</select>
      </div>
      <div className="tiles" style={{ marginBottom: 14 }}>
        <Tile l="Salió" v={fmt(total) + ' kg'} e={`${fmt(total / n, 0)} kg por día`} />
        <Tile l="Salidas" v={fmt(sal.length)} e="movimientos" />
        <Tile l="Merma + muestras" v={fmt(sum(sal.filter((x) => x.motivo === 'merma' || x.motivo === 'muestra'), (x) => -x.delta_kg)) + ' kg'} e={total ? `${fmt((sum(sal.filter((x) => x.motivo === 'merma' || x.motivo === 'muestra'), (x) => -x.delta_kg) / total) * 100, 1)}% de lo que salió` : ''} />
        <Tile l="Sin motivo" v={fmt(sinMotivo)} e="salidas viejas, sin clasificar" c={sinMotivo > 5 ? 'alert' : ''} />
      </div>
      <div className="cgrid w2">
        <ChartCard title="Salidas por día" sub="Kilos que salieron de bodega" table={{ head: ['Día', 'Kg'], rows: dias.map((d, i) => [dmy(d), Math.round(diario[i])]) }} csvName="salidas-por-dia">
          <Columns x={dias} series={[{ name: 'Kg', values: diario }]} fy={(v) => fmt(v)} fx={dd} h={220} />
        </ChartCard>
        <ChartCard title="¿Para qué se sacó?" sub="Por motivo" table={{ head: ['Motivo', 'Kg'], rows: porMot.map((x) => [x.k, Math.round(x.kg)]) }} csvName="salidas-por-motivo">
          <HBars rows={porMot.map((x) => ({ label: x.k, value: x.kg, sub: total ? Math.round((x.kg / total) * 100) + '%' : '' }))} fv={(v) => fmt(v) + ' kg'} />
        </ChartCard>
        <ChartCard title="¿A qué extrusora?" table={{ head: ['Extrusora', 'Kg'], rows: porMaq.map((x) => [x.k, Math.round(x.kg)]) }}>
          <HBars rows={porMaq.map((x, i) => ({ label: x.k, value: x.kg, color: SERIES[i % 4] }))} fv={(v) => fmt(v) + ' kg'} />
        </ChartCard>
        <ChartCard title="¿Quién lo registró?" sub="Para cuadrar contra lo que realmente salió" table={{ head: ['Usuario', 'Kg'], rows: porUser.map((x) => [x.k, Math.round(x.kg)]) }}>
          <HBars rows={porUser.map((x) => ({ label: x.k, value: x.kg }))} fv={(v) => fmt(v) + ' kg'} />
        </ChartCard>
        {!mat && <ChartCard title="Por material" table={{ head: ['Material', 'Kg'], rows: porMat.map((x) => [x.k, Math.round(x.kg)]) }}><HBars rows={porMat.map((x, i) => ({ label: x.k, value: x.kg, color: SERIES[i % 4] }))} fv={(v) => fmt(v) + ' kg'} /></ChartCard>}
        {ref.length > 0 && <ChartCard title="Por cliente / referencia" table={{ head: ['Referencia', 'Kg'], rows: ref.map((x) => [x.k, Math.round(x.kg)]) }}><HBars rows={ref.map((x) => ({ label: x.k, value: x.kg }))} fv={(v) => fmt(v) + ' kg'} /></ChartCard>}
      </div>
    </section>
  );
}

function Proveedores() {
  const { S } = useData();
  const [mat, setMat] = useState('');
  const ent = useMemo(() => S.movs.filter((x) => x.tipo === 'entrada' && (!mat || x.material_id === mat)), [S.movs, mat]);
  const provs = useMemo(() => proveedores(ent), [ent]);
  const top = provs.filter((p) => p.promedio != null).slice(0, 4);
  const fechas = [...new Set(ent.filter((x) => x.costo_kg).map((x) => x.fecha.slice(0, 10)))].sort();
  const serie = top.map((p, i) => ({ name: p.proveedor, color: SERIES[i], values: fechas.map((d) => { const m = ent.filter((x) => (x.proveedor || '').trim() === p.proveedor && x.fecha.slice(0, 10) === d && x.costo_kg); return m.length ? sum(m, (x) => (x.costo_kg || 0) * x.delta_kg) / sum(m, (x) => x.delta_kg) : null; }) }));
  const gasto = sum(ent, (x) => (x.costo_kg || 0) * x.delta_kg);
  return (
    <section className="sec">
      <div className="row" style={{ justifyContent: 'space-between', marginBottom: 12 }}>
        <select className="inp" style={{ width: 'auto' }} value={mat} onChange={(e) => setMat(e.target.value)}><option value="">Todos los materiales</option>{S.materiales.map((m) => <option key={m.id} value={m.id}>{m.nombre}</option>)}</select>
        <span className="mut">{mat ? 'Compara precios del mismo material.' : 'Elige un material para comparar precios justos entre proveedores.'}</span>
      </div>
      {provs.length ? (
        <>
          <div className="tiles" style={{ marginBottom: 14 }}>
            <Tile l="Comprado" v={fmt(sum(ent, (x) => x.delta_kg)) + ' kg'} e={`${fmt(ent.length)} entradas`} /><Tile l="Gasto con precio" v={gasto ? '$' + fmt(gasto) : '—'} e="solo entradas con costo/kg" /><Tile l="Proveedores" v={fmt(provs.length)} e="distintos" />
          </div>
          <div className="cgrid w2">
            <ChartCard title="Precio por kg en el tiempo" sub="Promedio por día de entrada, por proveedor" legend={serie.map((s) => ({ name: s.name, color: s.color }))} table={{ head: ['Fecha', ...serie.map((s) => s.name)], rows: fechas.map((d, i) => [dmy(d), ...serie.map((s) => (s.values[i] == null ? '' : fmt(s.values[i], 2)))]) }} csvName="precio-por-proveedor">
              {fechas.length > 1 ? <LineChart x={fechas} series={serie} fy={(v) => '$' + fmt(v, 2)} fx={dd} min0={false} h={230} /> : <Empty>Se necesitan al menos 2 fechas de compra con costo para graficar.</Empty>}
            </ChartCard>
            <div className="cc"><div className="cch"><div><h3>Por proveedor</h3><small>Precio promedio ponderado por kilos</small></div><button className="btn sm" onClick={() => descargarCSV('proveedores', { head: ['Proveedor', 'Entradas', 'Kg', 'Monto', 'Precio prom/kg', 'Último precio/kg'], rows: provs.map((p) => [p.proveedor, p.n, Math.round(p.kg), Math.round(p.monto), p.promedio?.toFixed(2) ?? '', p.ultimo ?? '']) })}>CSV</button></div>
              <Scroll><table className="t"><thead><tr><th>Proveedor</th><th className="num">Entradas</th><th className="num">Kg</th><th className="num">Prom. $/kg</th><th className="num">Último $/kg</th><th>Última</th></tr></thead><tbody>
                {provs.map((p) => <tr key={p.proveedor}><td><b>{p.proveedor}</b></td><td className="num">{p.n}</td><td className="num">{fmt(p.kg)}</td><td className="num">{p.promedio ? fmt(p.promedio, 2) : '—'}</td><td className="num">{p.ultimo ? fmt(p.ultimo, 2) : '—'}</td><td className="mut">{dmy(p.ultimaFecha)}</td></tr>)}
              </tbody></table></Scroll></div>
          </div>
        </>
      ) : <Empty>Aún no hay entradas registradas.</Empty>}
    </section>
  );
}

function Ficha({ id, onClose }: { id: string; onClose: () => void }) {
  const { S, now, quien, maqById } = useData();
  const m = S.materiales.find((x) => x.id === id);
  const movs = useMemo(() => S.movs.filter((x) => x.material_id === id), [S.movs, id]);
  const dias = useMemo(() => diasEntre(daysAgo(59), ymd(new Date(now))), [now]);
  if (!m) return null;
  const ex = S.existencias[id] ?? 0;
  const hist = existenciaDiaria(movs, ex, dias);
  const cons = dias.map((d) => sum(movs.filter((x) => x.tipo === 'salida' && x.fecha.slice(0, 10) === d), (x) => -x.delta_kg));
  const r = resumenMateriales([m], S.existencias, S.movs, now)[0];
  return (
    <Modal title={m.nombre} onClose={onClose} foot={<button className="btn" onClick={onClose}>Cerrar</button>}>
      <div className="tiles" style={{ marginBottom: 14 }}>
        <Tile l="Existencia" v={fmt(ex) + ' kg'} e={`${fmt(r.sacos, 1)} sacos de ${m.kg_por_saco} kg`} c={r.bajo ? 'alert' : ''} /><Tile l="Cobertura" v={r.dias == null ? '—' : fmt(r.dias, 0) + ' d'} e={`mínimo ${fmt(m.minimo_kg)} kg`} /><Tile l="Consumo/día" v={fmt(r.consumoDia, 0) + ' kg'} e="últimos 30 días" />
      </div>
      <div style={{ display: 'grid', gap: 12 }}>
        <ChartCard title="Existencia (60 días)" sub="Línea punteada no aplica; revisa contra tu mínimo" table={{ head: ['Día', 'Kg'], rows: dias.map((d, i) => [dmy(d), Math.round(hist[i])]) }}>
          <LineChart x={dias} series={[{ name: 'Existencia', values: hist }]} fy={(v) => fmt(v)} fx={dd} refLine={m.minimo_kg || undefined} refLabel="Mínimo" min0 h={200} />
        </ChartCard>
        <ChartCard title="Consumo diario" table={{ head: ['Día', 'Kg'], rows: dias.map((d, i) => [dmy(d), Math.round(cons[i])]) }}>
          <Columns x={dias} series={[{ name: 'Salidas', values: cons }]} fy={(v) => fmt(v)} fx={dd} h={170} />
        </ChartCard>
        <div>
          <h3 style={{ margin: '4px 0 8px' }}>Últimos movimientos</h3>
          {movs.length ? <Scroll><table className="t"><thead><tr><th>Fecha</th><th>Tipo</th><th className="num">Kg</th><th>Motivo</th><th>Registró</th></tr></thead><tbody>
            {movs.slice(0, 12).map((x) => <tr key={x.id}><td className="mono">{dmy(x.fecha)} {hhmm(x.fecha)}</td><td>{tipoPill(x.tipo)}</td><td className="num" style={{ color: x.delta_kg < 0 ? 'var(--bad)' : 'var(--good)' }}>{x.delta_kg > 0 ? '+' : ''}{fmt(x.delta_kg, 1)}</td><td>{motivoTxt(x.motivo, x.tipo)}{x.referencia ? ` · ${x.referencia}` : ''}{x.maquina_id ? ` · ${maqById(x.maquina_id)?.nombre}` : ''}</td><td>{quien(x.created_by)}</td></tr>)}
          </tbody></table></Scroll> : <Empty>Sin movimientos.</Empty>}
        </div>
      </div>
    </Modal>
  );
}

function Mov({ tipo, mat, onClose }: { tipo: 'entrada' | 'salida'; mat?: string; onClose: () => void }) {
  const { S, maqs, db, run, toast, me } = useData();
  const [f, setF] = useState({ mat: mat || '', sacos: null as number | null, kg: null as number | null, fecha: localDT(new Date()), lote: '', prov: '', fact: '', costo: null as number | null, maq: '', ot: '', motivo: tipo === 'salida' ? 'produccion' : '', ref: '', nota: '' });
  const p = (k: Partial<typeof f>) => setF((s) => ({ ...s, ...k }));
  const m = S.materiales.find((x) => x.id === f.mat);
  const ex = m ? S.existencias[m.id] ?? 0 : 0;
  async function save() {
    if (!m) return toast('Elige el material.', true);
    const kg = f.kg ?? (f.sacos ? f.sacos * m.kg_por_saco : null);
    if (!kg || kg <= 0) return toast('Captura los kilos o los sacos.', true);
    if (tipo === 'salida' && !f.motivo) return toast('Indica para qué se saca el material.', true);
    if (f.motivo === 'otro' && !f.nota.trim()) return toast('Si el motivo es "Otro", explícalo en la nota.', true);
    if (tipo === 'salida' && ['venta', 'traspaso', 'devolucion', 'muestra'].includes(f.motivo) && !f.ref.trim()) return toast('Indica a quién / para qué cliente se entrega (referencia).', true);
    if (tipo === 'salida' && kg > ex && !confirm(`Solo hay ${fmt(ex)} kg en el sistema y estás sacando ${fmt(kg)} kg. ¿Registrar de todos modos? (la existencia quedaría negativa; haz un conteo físico para corregir)`)) return;
    const row = {
      material_id: m.id, tipo, delta_kg: tipo === 'entrada' ? kg : -kg, sacos: f.sacos ?? (m.kg_por_saco ? kg / m.kg_por_saco : null), fecha: new Date(f.fecha).toISOString(),
      lote: f.lote.trim() || null, proveedor: f.prov.trim() || null, factura: f.fact.trim() || null, costo_kg: tipo === 'entrada' ? f.costo : null,
      maquina_id: tipo === 'salida' ? f.maq || null : null, orden_id: tipo === 'salida' ? f.ot || null : null, motivo: f.motivo || null, referencia: f.ref.trim() || null, nota: f.nota.trim() || null,
    };
    if (await run(db.from('inv_movimientos').insert(row), tipo === 'entrada' ? 'Entrada registrada' : 'Salida registrada')) onClose();
  }
  return (
    <Modal title={tipo === 'entrada' ? 'Entrada de material' : 'Salida de bodega'} onClose={onClose} foot={<><span className="mut" style={{ marginRight: 'auto', alignSelf: 'center' }}>Se firma como <b>{me?.usuario || me?.nombre}</b></span><button className="btn" onClick={onClose}>Cancelar</button><button className="btn primary" onClick={save}>Guardar</button></>}>
      <div className="fg">
        <SelF l="Material" v={f.mat} on={(v) => p({ mat: v })} opts={[['', '— elige —'], ...S.materiales.filter((x) => x.activo).map((x): [string, string] => [x.id, x.nombre])]} />
        <Fld l="Fecha y hora"><input type="datetime-local" value={f.fecha} onChange={(e) => p({ fecha: e.target.value })} /></Fld>
        <NumF l={`Sacos${m ? ` (${m.kg_por_saco} kg)` : ''}`} v={f.sacos} on={(v) => p({ sacos: v, kg: v && m ? v * m.kg_por_saco : null })} />
        <NumF l="Kilos" v={f.kg} on={(v) => p({ kg: v })} style={{ fontWeight: 600 }} />
        {tipo === 'entrada' && <><TxtF l="Proveedor" v={f.prov} on={(v) => p({ prov: v })} /><TxtF l="Lote" v={f.lote} on={(v) => p({ lote: v })} /><TxtF l="Factura / remisión" v={f.fact} on={(v) => p({ fact: v })} /><NumF l="Costo por kg (MXN)" v={f.costo} on={(v) => p({ costo: v })} />
          <SelF l="Tipo de entrada" v={f.motivo} on={(v) => p({ motivo: v })} opts={[['', 'Compra'], ['devolucion', 'Devolución a bodega'], ['traspaso', 'Traspaso'], ['otro', 'Otro']]} /></>}
        {tipo === 'salida' && <>
          <SelF l="¿Para qué sale?" v={f.motivo} on={(v) => p({ motivo: v })} opts={MOTIVOS} />
          <SelF l="Extrusora destino" v={f.maq} on={(v) => p({ maq: v })} opts={[['', '—'], ...maqs('extrusion').map((x): [string, string] => [x.id, x.nombre])]} />
          <SelF l="Orden (opcional)" v={f.ot} on={(v) => p({ ot: v })} opts={[['', '—'], ...S.ordenes.filter((o) => o.estado !== 'Entregada').map((o): [string, string] => [o.id, `${o.folio} · ${o.cliente}`])]} />
          <TxtF l="Referencia (cliente, a quién, folio)" v={f.ref} on={(v) => p({ ref: v })} /></>}
      </div>
      {m && <p className="mut" style={{ marginTop: 10 }}>Existencia actual: <b>{fmt(ex)} kg</b>{f.kg || f.sacos ? ` → quedaría en ${fmt(ex + (tipo === 'entrada' ? 1 : -1) * (f.kg ?? (f.sacos || 0) * m.kg_por_saco))} kg` : ''}.</p>}
      <div style={{ marginTop: 10 }}><AreaF l="Nota" v={f.nota} on={(v) => p({ nota: v })} /></div>
    </Modal>
  );
}

function Conteo({ onClose }: { onClose: () => void }) {
  const { S, db, run, toast } = useData();
  const act = S.materiales.filter((m) => m.activo);
  const [kg, setKg] = useState<Record<string, number | null>>({});
  const [nota, setNota] = useState('');
  const cambios = act.filter((m) => kg[m.id] != null);
  async function save() {
    if (!cambios.length) return toast('Captura al menos un material.', true);
    let ok = true;
    for (const m of cambios) {
      const { error } = await db.rpc('registrar_conteo', { p_material: m.id, p_kg: kg[m.id], p_nota: nota.trim() || 'Conteo físico' });
      if (error) { ok = false; toast(`${m.nombre}: ${error.message}`, true); break; }
    }
    if (ok) { await run(Promise.resolve({ error: null }), `Conteo registrado (${cambios.length})`); onClose(); }
  }
  return (
    <Modal title="Conteo físico" onClose={onClose} foot={<><button className="btn" onClick={onClose}>Cancelar</button><button className="btn primary" onClick={save}>Registrar conteo</button></>}>
      <p className="mut" style={{ margin: '0 0 12px' }}>Pesa o cuenta lo que hay en bodega y captura los kilos reales. La diferencia contra el sistema se guarda como ajuste. Deja en blanco lo que no contaste.</p>
      <Scroll><table className="t" style={{ minWidth: 480 }}><thead><tr><th>Material</th><th className="num">Sistema</th><th className="num">Contado (kg)</th><th className="num">Diferencia</th></tr></thead><tbody>
        {act.map((m) => { const sis = S.existencias[m.id] ?? 0, c = kg[m.id]; return (
          <tr key={m.id}><td>{m.nombre}</td><td className="num">{fmt(sis, 1)}</td>
            <td className="num"><input type="number" step="any" className="inp" style={{ width: 120, textAlign: 'right' }} value={c ?? ''} onChange={(e) => setKg((s) => ({ ...s, [m.id]: e.target.value === '' ? null : Number(e.target.value) }))} /></td>
            <td className="num" style={{ color: c != null && c - sis < 0 ? 'var(--bad)' : undefined }}>{c == null ? '' : (c - sis > 0 ? '+' : '') + fmt(c - sis, 1)}</td></tr>); })}
      </tbody></table></Scroll>
      <div style={{ marginTop: 10 }}><AreaF l="Nota (quién contó, motivo)" v={nota} on={setNota} /></div>
    </Modal>
  );
}

function Mat({ m, onClose }: { m?: Material; onClose: () => void }) {
  const { db, run, toast } = useData();
  const [f, setF] = useState({ nombre: m?.nombre || '', categoria: m?.categoria || 'resina', kg_por_saco: m?.kg_por_saco ?? 25, minimo_kg: m?.minimo_kg ?? 0, activo: m?.activo ?? true });
  async function save() {
    if (!f.nombre.trim()) return toast('Falta el nombre.', true);
    const q = m ? db.from('materiales').update({ ...f, nombre: f.nombre.trim() }).eq('id', m.id) : db.from('materiales').insert({ ...f, nombre: f.nombre.trim() });
    if (await run(q, 'Material guardado')) onClose();
  }
  return (
    <Modal title={m ? m.nombre : 'Nuevo material'} onClose={onClose} foot={<><button className="btn" onClick={onClose}>Cancelar</button><button className="btn primary" onClick={save}>Guardar</button></>}>
      <div className="fg">
        <TxtF l="Nombre" v={f.nombre} on={(v) => setF({ ...f, nombre: v })} /><SelF l="Categoría" v={f.categoria} on={(v) => setF({ ...f, categoria: v as Material['categoria'] })} opts={CAT} />
        <NumF l="Kg por saco" v={f.kg_por_saco} on={(v) => setF({ ...f, kg_por_saco: v ?? 25 })} /><NumF l="Mínimo en bodega (kg)" v={f.minimo_kg} on={(v) => setF({ ...f, minimo_kg: v ?? 0 })} />
        <SelF l="Estado" v={f.activo ? 'si' : 'no'} on={(v) => setF({ ...f, activo: v === 'si' })} opts={[['si', 'Activo'], ['no', 'Inactivo (se oculta)']]} />
      </div>
    </Modal>
  );
}
