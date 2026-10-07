'use client';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useData } from '@/lib/data';
import { describir, ACCION, TABLA, type Lookups } from '@/lib/bitacora';
import { ChartCard, Columns, descargarCSV, type TableData } from '@/components/charts';
import { Empty, Modal, Pill, Scroll, Tile } from '@/components/ui';
import { dmy, fmt, ymd, daysAgo } from '@/lib/format';
import type { Bitacora } from '@/lib/types';

const hora = (iso: string) => new Date(iso).toLocaleString('es-MX', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit', hour12: false });

export default function BitacoraPage() {
  const { db, S, isDueno, maqById, loaded } = useData();
  const [rows, setRows] = useState<Bitacora[]>([]);
  const [busy, setBusy] = useState(true);
  const [f, setF] = useState({ user: '', tabla: '', accion: '', desde: daysAgo(6), hasta: ymd(new Date()), q: '', alertas: false });
  const [sel, setSel] = useState<Bitacora | null>(null);

  const load = useCallback(async () => {
    const { data } = await db.from('bitacora').select('*').gte('at', new Date(Date.now() - 92 * 864e5).toISOString()).order('at', { ascending: false }).limit(6000);
    setRows((data as Bitacora[]) || []); setBusy(false);
  }, [db]);
  useEffect(() => {
    if (!isDueno) return;
    void load();
    let t: ReturnType<typeof setTimeout> | null = null;
    const ch = db.channel('bitacora').on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'bitacora' }, () => { if (t) clearTimeout(t); t = setTimeout(() => void load(), 400); }).subscribe();
    return () => { if (t) clearTimeout(t); void db.removeChannel(ch); };
  }, [db, isDueno, load]);

  const L: Lookups = useMemo(() => ({
    maq: (id) => maqById(String(id))?.nombre || 'máquina eliminada',
    mat: (id) => S.materiales.find((m) => m.id === id)?.nombre || 'material',
    ctx: (tabla, id) => {
      if (!id) return '';
      if (tabla === 'reporte_lineas') { for (const r of S.reportes) { const l = r.reporte_lineas.find((x) => x.id === id); if (l) return `${l.operario} · ${maqById(l.maquina_id)?.nombre ?? ''} · ${dmy(r.fecha)} T${r.turno}`; } }
      if (tabla === 'paros') { const p = S.paros.find((x) => x.id === id); if (p) return `${maqById(p.maquina_id)?.nombre ?? ''} · ${p.causa}`; }
      if (tabla === 'inv_movimientos') { const m = S.movs.find((x) => x.id === id); if (m) return `${S.materiales.find((x) => x.id === m.material_id)?.nombre ?? ''} · ${m.tipo}`; }
      if (tabla === 'maquinas') return maqById(id)?.nombre || '';
      if (tabla === 'materiales') return S.materiales.find((x) => x.id === id)?.nombre || '';
      if (tabla === 'personas') return S.personas.find((x) => x.id === id)?.nombre || '';
      if (tabla === 'ordenes') { const o = S.ordenes.find((x) => x.id === id); return o ? `${o.folio} · ${o.cliente}` : ''; }
      if (tabla === 'profiles') { const u = S.usuarios.find((x) => x.id === id); return u ? (u.usuario || u.nombre) : ''; }
      if (tabla === 'mtto') return S.mtto.find((x) => x.id === id)?.descr || '';
      if (tabla === 'amonestaciones') { const a = S.amon.find((x) => x.id === id); return a ? `${a.operario} · ${a.tipo}` : ''; }
      return '';
    },
  }), [S, maqById]);

  const all = useMemo(() => rows.map((b) => ({ b, d: describir(b, L) })), [rows, L]);
  const vis = useMemo(() => {
    const q = f.q.trim().toLowerCase();
    return all.filter(({ b, d }) => {
      const dl = ymd(new Date(b.at));
      if (dl < f.desde || dl > f.hasta) return false;
      if (f.user && (b.actor_usuario || 'sistema') !== f.user) return false;
      if (f.tabla && b.tabla !== f.tabla) return false;
      if (f.accion && b.accion !== f.accion) return false;
      if (f.alertas && d.nivel === 0) return false;
      if (q && !(`${d.titulo} ${d.detalle} ${d.alertas.join(' ')} ${b.actor_usuario ?? ''} ${b.actor_nombre ?? ''}`.toLowerCase().includes(q))) return false;
      return true;
    });
  }, [all, f]);

  const resumen = useMemo(() => {
    const por = new Map<string, { u: string; n: string; acc: number; al: number; graves: number; del: number; ultima: string; login: string | null }>();
    for (const { b, d } of vis) {
      const k = b.actor_usuario || 'sistema';
      const e = por.get(k) || { u: k, n: b.actor_nombre || '', acc: 0, al: 0, graves: 0, del: 0, ultima: b.at, login: null };
      if (b.accion === 'LOGIN') { if (!e.login || b.at > e.login) e.login = b.at; } else e.acc++;
      if (d.nivel > 0) e.al++;
      if (d.nivel === 2) e.graves++;
      if (b.accion === 'DELETE') e.del++;
      if (b.at > e.ultima) e.ultima = b.at;
      por.set(k, e);
    }
    return [...por.values()].sort((a, b) => b.graves - a.graves || b.al - a.al || b.acc - a.acc);
  }, [vis]);

  const dias = useMemo(() => {
    const out: string[] = [];
    for (let d = new Date(f.desde + 'T12:00'); ymd(d) <= f.hasta && out.length < 92; d = new Date(d.getTime() + 864e5)) out.push(ymd(d));
    return out;
  }, [f.desde, f.hasta]);
  const porDia = useMemo(() => {
    const ok = new Map<string, number>(), al = new Map<string, number>();
    for (const { b, d } of vis) { if (b.accion === 'LOGIN') continue; const k = ymd(new Date(b.at)); (d.nivel ? al : ok).set(k, ((d.nivel ? al : ok).get(k) || 0) + 1); }
    return { ok: dias.map((k) => ok.get(k) || 0), al: dias.map((k) => al.get(k) || 0) };
  }, [vis, dias]);

  const usuarios = [...new Set(rows.map((r) => r.actor_usuario || 'sistema'))].sort();
  const tablas = [...new Set(rows.map((r) => r.tabla))].sort();
  const nAl = vis.filter((x) => x.d.nivel > 0).length, nGr = vis.filter((x) => x.d.nivel === 2).length, nDel = vis.filter((x) => x.b.accion === 'DELETE').length;
  const tbl: TableData = { head: ['Fecha', 'Usuario', 'Acción', 'Detalle', 'Alertas'], rows: vis.map(({ b, d }) => [new Date(b.at).toLocaleString('es-MX'), b.actor_usuario || 'sistema', d.titulo, d.detalle, d.alertas.join(' | ')]) };

  if (loaded && !isDueno) return <Empty>La bitácora solo la ve el dueño.</Empty>;
  const p = (k: Partial<typeof f>) => setF((s) => ({ ...s, ...k }));
  return (
    <>
      <section className="sec">
        <h2>Bitácora de movimientos <small>Cada captura, cambio y borrado queda firmado con el usuario, la fecha y la hora del servidor. Nadie puede editarla ni borrarla, ni siquiera tú.</small></h2>
        <div className="tiles">
          <Tile l="Movimientos" v={fmt(vis.filter((x) => x.b.accion !== 'LOGIN').length)} e={`${dmy(f.desde)} – ${dmy(f.hasta)}`} />
          <Tile l="Con alerta" v={fmt(nAl)} e="cosas para revisar" c={nAl ? '' : ''} onClick={() => p({ alertas: true })} />
          <Tile l="Alertas graves" v={fmt(nGr)} e="kilos, borrados, ajustes" c={nGr ? 'alert' : ''} onClick={() => p({ alertas: true, q: '' })} />
          <Tile l="Borrados" v={fmt(nDel)} e="registros eliminados" c={nDel ? 'alert' : ''} onClick={() => p({ accion: 'DELETE' })} />
          <Tile l="Accesos" v={fmt(vis.filter((x) => x.b.accion === 'LOGIN').length)} e={`${fmt(resumen.filter((r) => r.login).length)} usuarios`} />
        </div>
      </section>

      <section className="sec">
        <div className="filters">
          <label className="f"><span>Usuario</span><select value={f.user} onChange={(e) => p({ user: e.target.value })}><option value="">Todos</option>{usuarios.map((u) => <option key={u}>{u}</option>)}</select></label>
          <label className="f"><span>Qué</span><select value={f.tabla} onChange={(e) => p({ tabla: e.target.value })}><option value="">Todo</option>{tablas.map((t) => <option key={t} value={t}>{TABLA[t] || t}</option>)}</select></label>
          <label className="f"><span>Acción</span><select value={f.accion} onChange={(e) => p({ accion: e.target.value })}><option value="">Todas</option>{Object.entries(ACCION).map(([k, t]) => <option key={k} value={k}>{t}</option>)}</select></label>
          <label className="f"><span>Desde</span><input type="date" value={f.desde} onChange={(e) => p({ desde: e.target.value })} /></label>
          <label className="f"><span>Hasta</span><input type="date" value={f.hasta} onChange={(e) => p({ hasta: e.target.value })} /></label>
          <label className="f" style={{ flex: 1, minWidth: 160 }}><span>Buscar</span><input placeholder="operario, máquina, material…" value={f.q} onChange={(e) => p({ q: e.target.value })} /></label>
          <label className="chk" style={{ paddingBottom: 9 }}><input type="checkbox" checked={f.alertas} onChange={(e) => p({ alertas: e.target.checked })} />Solo alertas</label>
          <div className="row" style={{ paddingBottom: 4 }}>
            {([['Hoy', 0], ['7 días', 6], ['30 días', 29]] as [string, number][]).map(([t, n]) => <button key={t} className="btn sm" onClick={() => p({ desde: daysAgo(n), hasta: ymd(new Date()) })}>{t}</button>)}
            <button className="btn sm" onClick={() => descargarCSV(`bitacora-${f.desde}-a-${f.hasta}`, tbl)}>Exportar CSV</button>
          </div>
        </div>
      </section>

      <section className="sec">
        <div className="cgrid w2">
          <ChartCard title="Actividad por día" sub="Registros capturados (azul) y los que disparan alerta (naranja)" legend={[{ name: 'Normales', color: 'var(--s1)' }, { name: 'Con alerta', color: 'var(--s2)' }]}
            table={{ head: ['Día', 'Normales', 'Con alerta'], rows: dias.map((d, i) => [dmy(d), porDia.ok[i], porDia.al[i]]) }} csvName="actividad-por-dia">
            <Columns x={dias} stacked series={[{ name: 'Normales', values: porDia.ok }, { name: 'Con alerta', values: porDia.al }]} fx={(s) => dmy(s).slice(0, 5)} />
          </ChartCard>
          <div className="cc">
            <div className="cch"><div><h3>Por usuario</h3><small>Ordenado por alertas graves</small></div></div>
            {resumen.length ? <Scroll><table className="t"><thead><tr><th>Usuario</th><th className="num">Capturas</th><th className="num">Alertas</th><th className="num">Graves</th><th className="num">Borrados</th><th>Último movimiento</th></tr></thead><tbody>
              {resumen.map((r) => (
                <tr key={r.u} className="click" onClick={() => p({ user: r.u === f.user ? '' : r.u })}><td><b>{r.u}</b><div className="mut">{r.n}</div></td><td className="num">{fmt(r.acc)}</td>
                  <td className="num">{r.al ? <Pill c="warn">{r.al}</Pill> : 0}</td><td className="num">{r.graves ? <Pill c="bad">{r.graves}</Pill> : 0}</td><td className="num">{r.del ? <Pill c="bad">{r.del}</Pill> : 0}</td><td className="mut">{hora(r.ultima)}</td></tr>))}
            </tbody></table></Scroll> : <Empty>Sin actividad en este periodo.</Empty>}
          </div>
        </div>
      </section>

      <section className="sec">
        <h2>Movimientos <small>{fmt(vis.length)} registros{vis.length > 400 ? ' · mostrando los 400 más recientes (usa filtros o el CSV para ver todo)' : ''}</small></h2>
        {busy ? <Empty>Cargando…</Empty> : vis.length ? (
          <Scroll><table className="t"><thead><tr><th>Cuándo</th><th>Quién</th><th>Qué hizo</th><th>Detalle</th><th>Alertas</th></tr></thead><tbody>
            {vis.slice(0, 400).map(({ b, d }) => (
              <tr key={b.id} className={`click ${d.nivel === 2 ? 'sev2' : d.nivel === 1 ? 'sev1' : ''}`} onClick={() => setSel(b)}>
                <td className="mono" style={{ whiteSpace: 'nowrap' }}>{hora(b.at)}</td>
                <td><b>{b.actor_usuario || 'sistema'}</b></td>
                <td style={{ whiteSpace: 'nowrap' }}>{d.titulo}</td>
                <td>{d.detalle || <span className="mut">—</span>}</td>
                <td className="al">{d.alertas.map((a, i) => <div key={i}><Pill c={d.nivel === 2 ? 'bad' : 'warn'}>{a}</Pill></div>)}</td></tr>))}
          </tbody></table></Scroll>
        ) : <Empty>No hay movimientos con estos filtros.</Empty>}
      </section>
      {sel && <Detalle b={sel} L={L} onClose={() => setSel(null)} />}
    </>
  );
}

function Detalle({ b, L, onClose }: { b: Bitacora; L: Lookups; onClose: () => void }) {
  const d = describir(b, L);
  return (
    <Modal title={d.titulo} onClose={onClose} foot={<button className="btn" onClick={onClose}>Cerrar</button>}>
      <p style={{ margin: '0 0 10px' }}><b>{b.actor_usuario || 'sistema'}</b>{b.actor_nombre ? ` (${b.actor_nombre})` : ''} · {new Date(b.at).toLocaleString('es-MX', { dateStyle: 'full', timeStyle: 'medium' })}</p>
      {d.detalle && <p style={{ margin: '0 0 10px' }}>{d.detalle}</p>}
      {d.alertas.map((a, i) => <div key={i} style={{ marginBottom: 6 }}><Pill c={d.nivel === 2 ? 'bad' : 'warn'}>⚠ {a}</Pill></div>)}
      {d.cambios.length > 0 && <Scroll><table className="t"><thead><tr><th>Campo</th>{b.accion !== 'INSERT' && <th>Antes</th>}{b.accion !== 'DELETE' && <th>{b.accion === 'UPDATE' ? 'Después' : 'Valor'}</th>}</tr></thead><tbody>
        {d.cambios.map(([k, a, n]) => <tr key={k}><td>{k}</td>{b.accion !== 'INSERT' && <td className={b.accion === 'DELETE' ? '' : 'mut'}>{a}</td>}{b.accion !== 'DELETE' && <td><b>{n}</b></td>}</tr>)}
      </tbody></table></Scroll>}
    </Modal>
  );
}
