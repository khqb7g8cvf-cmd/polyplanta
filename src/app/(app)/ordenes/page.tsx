'use client';
import { useMemo, useState } from 'react';
import { useData } from '@/lib/data';
import { AREAS, SELLOS, compat, kgMillar, kghOrden } from '@/lib/calc';
import { dmy, fmt, today } from '@/lib/format';
import { AreaF, Bar, ChkF, DateF, Empty, Modal, NumF, Pill, Scroll, SelF, TxtF, sn } from '@/components/ui';
import type { Orden, Tipo } from '@/lib/types';

const etapas = (o: Orden): Tipo[] => ['extrusion', ...(o.impresion ? ['impresion' as Tipo] : []), ...(o.sello && o.sello !== 'ninguno' ? ['bolseo' as Tipo] : [])];
const medida = (o: Orden) => [o.ancho_ext ? fmt(o.ancho_ext, 1) : '', o.bolsa_largo ? '× ' + fmt(o.bolsa_largo, 1) : '', o.calibre ? 'cal ' + o.calibre : '', o.densidad === 'alta' ? 'alta' : ''].filter(Boolean).join(' ');

export default function Ordenes() {
  const { S, L, isDueno } = useData();
  const [filtro, setFiltro] = useState<'activas' | 'terminadas' | 'todas'>('activas');
  const [edit, setEdit] = useState<Orden | 'nueva' | null>(null);
  const f = { activas: (o: Orden) => o.estado !== 'Terminada', terminadas: (o: Orden) => o.estado === 'Terminada', todas: () => true }[filtro];
  const list = S.ordenes.filter(f).sort((a, b) => (a.fecha_entrega || '9').localeCompare(b.fecha_entrega || '9'));
  const hoy = today();
  const kgEtapa = (oid: string, t: Tipo) => L.filter((x) => x.orden_id === oid && x.tipo === t).reduce((s, x) => s + x.kilos, 0);
  return (
    <section className="sec">
      <h2>Órdenes de producción <button className="btn primary" disabled={!isDueno} onClick={() => setEdit('nueva')}>+ Nueva orden</button></h2>
      <p className="mut" style={{ margin: '0 0 10px' }}>Las órdenes son opcionales: el reporte de turno funciona sin ellas. Úsalas si quieres ver avance por pedido y que la captura se llene sola.</p>
      <div className="chips" style={{ marginBottom: 10 }}>{([['activas', 'Activas'], ['terminadas', 'Terminadas'], ['todas', 'Todas']] as const).map(([k, t]) => <button key={k} aria-pressed={filtro === k} onClick={() => setFiltro(k)}>{t}</button>)}</div>
      {list.length ? (
        <Scroll><table className="t"><thead><tr><th>Folio</th><th>Cliente</th><th>Producto</th><th className="num">Kilos</th><th>Avance</th><th>Entrega</th><th>Estado</th></tr></thead><tbody>
          {list.map((o) => {
            const late = o.estado !== 'Terminada' && o.fecha_entrega && o.fecha_entrega < hoy;
            return (
              <tr key={o.id} className="click" onClick={() => setEdit(o)}>
                <td className="mono">{o.folio}</td><td>{o.cliente} {o.prioridad === 'Alta' && <Pill c="warn">Alta</Pill>}</td><td style={{ whiteSpace: 'nowrap' }}>{medida(o)}</td><td className="num">{fmt(o.kilos)}</td>
                <td><div className="row" style={{ gap: 10, flexWrap: 'nowrap' }}>{etapas(o).map((t) => { const p = o.kilos ? kgEtapa(o.id, t) / o.kilos : 0; return <div className="mini" key={t}><span className="mut">{AREAS[t].slice(0, 3)} {fmt(p * 100)}%</span><Bar p={p} c={p >= 1 ? 'good' : ''} /></div>; })}</div></td>
                <td className={late ? '' : 'mut'} style={late ? { color: 'var(--bad)', fontWeight: 600 } : undefined}>{dmy(o.fecha_entrega)}{late ? ' · atrasada' : ''}</td>
                <td><Pill c={o.estado === 'En proceso' ? 'good' : o.estado === 'Terminada' ? '' : o.estado === 'Pausada' ? 'warn' : 'ink'}>{o.estado}</Pill></td></tr>);
          })}</tbody></table></Scroll>
      ) : <Empty>No hay órdenes {filtro === 'activas' ? 'activas' : ''}.</Empty>}
      {edit && <OrdenForm o={edit === 'nueva' ? null : edit} onClose={() => setEdit(null)} />}
    </section>
  );
}

const BLANK: Partial<Orden> = { estado: 'Programada', prioridad: 'Normal', densidad: 'baja', caras: 1, tratado: 'no', abierto: false, fuelle: false, sello: 'fondo', impresion: false, registro: false, grabados: false };

function OrdenForm({ o, onClose }: { o: Orden | null; onClose: () => void }) {
  const { S, cfg, maqs, maqById, db, run, toast, isDueno } = useData();
  const nextFolio = useMemo(() => { const n = S.ordenes.map((x) => parseInt(x.folio)).filter((x) => !isNaN(x)); return n.length ? String(Math.max(...n) + 1) : ''; }, [S.ordenes]);
  const [f, setF] = useState<Partial<Orden>>(o ? { ...o } : { ...BLANK, folio: nextFolio });
  const p = (k: Partial<Orden>) => setF((s) => ({ ...s, ...k }));
  const opts = (t: Tipo): [string, string][] => [['', '— sin asignar —'], ...maqs(t).map((m): [string, string] => {
    const c = compat(f, m);
    return [m.id, m.nombre + (c.bad.length ? ` ✕ ${c.bad[0]}` : c.warn.length ? ' ⚠' : '')];
  })];
  const hint = (id: string | null | undefined, t: Tipo) => {
    const m = maqById(id);
    if (m) { const c = compat(f, m); return <div className={`hint ${c.bad.length ? 'bad' : c.warn.length ? 'warn' : ''}`}>{c.bad.length ? '✕ ' + c.bad.join('; ') : c.warn.length ? '⚠ ' + c.warn.join('; ') : '✓ compatible'}</div>; }
    const ok = maqs(t).filter((x) => !compat(f, x).bad.length);
    return f.cliente ? <div className="hint">Opciones: {ok.map((x) => x.nombre).join(', ') || 'ninguna'}</div> : null;
  };
  const km = kgMillar(f.ancho_ext || f.bolsa_ancho || null, f.bolsa_largo ?? null, f.calibre ?? null, f.densidad ?? null);
  const kh = f.bolseadora_id ? kghOrden(f as Orden, maqById(f.bolseadora_id)) : null;
  const mill = km && f.kilos ? f.kilos / km : null;

  async function save() {
    if (!f.cliente?.trim() || !f.kilos) return toast('Falta cliente o kilos.', true);
    if (!f.folio?.trim()) return toast('Falta el folio.', true);
    for (const k of ['extrusora_id', 'impresora_id', 'bolseadora_id'] as const) {
      const id = f[k]; if (!id) continue;
      const c = compat(f, maqById(id)!); if (c.bad.length) return toast(`${maqById(id)!.nombre}: ${c.bad[0]}`, true);
    }
    const { id: _id, created_at: _c, updated_at: _u, ...row } = f as Orden & { created_at?: string; updated_at?: string };
    const body = { ...row, extrusora_id: f.extrusora_id || null, impresora_id: f.impresora_id || null, bolseadora_id: f.bolseadora_id || null, fecha_entrega: f.fecha_entrega || null, updated_at: new Date().toISOString() };
    const q = o ? db.from('ordenes').update(body).eq('id', o.id) : db.from('ordenes').insert(body);
    if (await run(q, 'Orden guardada')) onClose();
  }
  async function del() {
    if (!o || !confirm(`¿Eliminar la orden ${o.folio}?`)) return;
    if (await run(db.from('ordenes').delete().eq('id', o.id), 'Orden eliminada')) onClose();
  }
  return (
    <Modal title={o ? `Orden ${o.folio}` : 'Nueva orden'} onClose={onClose} foot={<>
      {o && isDueno && <><button className="btn danger" onClick={del}>Eliminar</button><span style={{ flex: 1 }} /></>}
      <button className="btn" onClick={onClose}>Cancelar</button><button className="btn primary" disabled={!isDueno} onClick={save}>Guardar orden</button></>}>
      <fieldset><legend>Pedido</legend><div className="fg">
        <TxtF l="Folio / No. de orden" v={f.folio} on={(v) => p({ folio: v })} /><TxtF l="Cliente" v={f.cliente} on={(v) => p({ cliente: v })} /><DateF l="Fecha de entrega" v={f.fecha_entrega} on={(v) => p({ fecha_entrega: v })} />
        <SelF l="Prioridad" v={f.prioridad} on={(v) => p({ prioridad: v })} opts={['Alta', 'Normal', 'Baja']} /><NumF l="Kilos pedidos" v={f.kilos} on={(v) => p({ kilos: v })} />
        <SelF l="Estado" v={f.estado} on={(v) => p({ estado: v })} opts={['Programada', 'En proceso', 'Pausada', 'Terminada']} /></div></fieldset>
      <fieldset><legend>Producto (extrusión)</legend><div className="fg">
        <NumF l="Ancho extruido (cm)" v={f.ancho_ext} on={(v) => p({ ancho_ext: v })} /><NumF l="Calibre" v={f.calibre} on={(v) => p({ calibre: v })} />
        <SelF l="Densidad" v={f.densidad} on={(v) => p({ densidad: v })} opts={[['baja', 'Baja'], ['alta', 'Alta']]} />
        <SelF l="Tratado" v={f.tratado} on={(v) => p({ tratado: v })} opts={[['no', 'No'], ['1', '1 lado'], ['2', '2 lados']]} />
        <SelF l="Abierto" v={sn(f.abierto)} on={(v) => p({ abierto: v === 'si' })} opts={[['no', 'No'], ['si', 'Sí']]} /><SelF l="Fuelle" v={sn(f.fuelle)} on={(v) => p({ fuelle: v === 'si' })} opts={[['no', 'No'], ['si', 'Sí']]} />
        <TxtF l="Color" v={f.color} on={(v) => p({ color: v })} /><NumF l="Pigmento %" v={f.pigmento} on={(v) => p({ pigmento: v })} /><NumF l="Producción por hora (kg/h)" v={f.kgh} on={(v) => p({ kgh: v })} /></div></fieldset>
      <fieldset><legend>Bolsa e impresión</legend><div className="fg">
        <SelF l="Tipo de sello" v={f.sello} on={(v) => p({ sello: v })} opts={SELLOS} /><NumF l="Ancho bolsa (cm)" v={f.bolsa_ancho} on={(v) => p({ bolsa_ancho: v })} /><NumF l="Largo bolsa (cm)" v={f.bolsa_largo} on={(v) => p({ bolsa_largo: v })} />
        <SelF l="Lleva impresión" v={sn(f.impresion)} on={(v) => p({ impresion: v === 'si' })} opts={[['no', 'No'], ['si', 'Sí']]} /><NumF l="Tintas" v={f.tintas} on={(v) => p({ tintas: v })} />
        <SelF l="Caras impresas" v={String(f.caras ?? 1)} on={(v) => p({ caras: Number(v) })} opts={[['1', '1 lado'], ['2', 'Frente y vuelta']]} />
        <SelF l="Impresión a registro" v={sn(f.registro)} on={(v) => p({ registro: v === 'si' })} opts={[['no', 'No'], ['si', 'Sí']]} /><ChkF l="Se mandaron hacer grabados" v={f.grabados} on={(v) => p({ grabados: v })} /></div>
        <AreaF l="Observaciones (medida final, instrucciones, impresión)" v={f.obs} on={(v) => p({ obs: v })} /></fieldset>
      <fieldset><legend>Asignación de máquinas</legend><div className="fg">
        <div><SelF l="Extrusora" v={f.extrusora_id} on={(v) => p({ extrusora_id: v })} opts={opts('extrusion')} />{hint(f.extrusora_id, 'extrusion')}</div>
        <div><SelF l="Impresora" v={f.impresora_id} on={(v) => p({ impresora_id: v })} opts={opts('impresion')} />{hint(f.impresora_id, 'impresion')}</div>
        <div><SelF l="Bolseadora" v={f.bolseadora_id} on={(v) => p({ bolseadora_id: v })} opts={opts('bolseo')} />{hint(f.bolseadora_id, 'bolseo')}</div>
        <NumF l="Carriles a correr" v={f.carriles} on={(v) => p({ carriles: v })} /><NumF l="Golpes/min planeados" v={f.golpes} on={(v) => p({ golpes: v })} /></div>
        <div className="calc" style={{ marginTop: 10 }}><span>Peso: <b>{km ? fmt(km, 1) + ' kg/millar' : '—'}</b></span><span>Millares: <b>{mill ? fmt(mill, 1) : '—'}</b></span>
          <span>Bolseo teórico: <b>{kh ? fmt(kh, 0) + ' kg/h' : '—'}</b></span><span>Horas: <b>{kh && f.kilos ? fmt(f.kilos / kh, 1) : '—'}</b></span><span>Turnos ({cfg.horasProd} h): <b>{kh && f.kilos ? fmt(f.kilos / kh / cfg.horasProd, 1) : '—'}</b></span></div></fieldset>
    </Modal>
  );
}
