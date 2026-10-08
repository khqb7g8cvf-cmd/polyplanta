'use client';
import { useState } from 'react';
import { useData } from '@/lib/data';
import { dmy, fmt, sum, today, ymd } from '@/lib/format';
import { AreaF, DateF, Empty, Fld, Modal, NumF, Pill, Scroll, SelF, Tile } from '@/components/ui';
import type { Mtto } from '@/lib/types';

export default function Mtto_() {
  const { S, maqById, canMtto, run, db } = useData();
  const [filtro, setFiltro] = useState<'abiertos' | 'cerrados'>('abiertos');
  const [nuevo, setNuevo] = useState(false), [cierra, setCierra] = useState<Mtto | null>(null);
  const hoy = today(), ab = S.mtto.filter((x) => x.estado !== 'Cerrada'), ce = S.mtto.filter((x) => x.estado === 'Cerrada');
  const venc = ab.filter((x) => x.tipo === 'preventivo' && x.programada && x.programada < hoy);
  const cut = Date.now() - 30 * 864e5, cerr = ce.filter((x) => x.cierre && Date.parse(x.cierre) >= cut);
  const mttr = cerr.length ? sum(cerr, (x) => (Date.parse(x.cierre!) - Date.parse(x.creada)) / 36e5) / cerr.length : null;
  const L = (filtro === 'abiertos' ? ab : ce).slice().sort((a, b) => filtro === 'abiertos' ? (a.prioridad === 'Alta' ? 0 : 1) - (b.prioridad === 'Alta' ? 0 : 1) || a.creada.localeCompare(b.creada) : (b.cierre || '').localeCompare(a.cierre || ''));
  return (
    <section className="sec">
      <h2>Mantenimiento <button className="btn primary" disabled={!canMtto} onClick={() => setNuevo(true)}>+ Nueva orden de trabajo</button></h2>
      <div className="tiles" style={{ marginBottom: 12 }}>
        <Tile l="Abiertas" v={ab.length} e={`${ab.filter((x) => x.tipo === 'correctivo').length} correctivas`} />
        <Tile l="Preventivos vencidos" v={venc.length} e="fecha programada pasada" c={venc.length ? 'alert' : ''} />
        <Tile l="Tiempo medio de reparación" v={mttr == null ? '—' : fmt(mttr, 1) + ' h'} e="cerradas en 30 días" />
      </div>
      <div className="chips" style={{ marginBottom: 10 }}>{([['abiertos', 'Abiertas'], ['cerrados', 'Cerradas']] as const).map(([k, t]) => <button key={k} aria-pressed={filtro === k} onClick={() => setFiltro(k)}>{t}</button>)}</div>
      {L.length ? (
        <Scroll><table className="t"><thead><tr><th>Máquina</th><th>Tipo</th><th>Trabajo</th><th>Mecánico</th><th>Creada</th><th>{filtro === 'abiertos' ? 'Programada' : 'Cierre'}</th><th>Estado</th><th></th></tr></thead><tbody>
          {L.map((x) => {
            const late = x.tipo === 'preventivo' && x.programada && x.programada < hoy && x.estado !== 'Cerrada';
            return (
              <tr key={x.id}><td>{maqById(x.maquina_id)?.nombre || '?'}</td>
                <td><Pill c={x.tipo === 'correctivo' ? 'warn' : 'ink'}>{x.tipo}</Pill>{x.prioridad === 'Alta' && <> <Pill c="bad">Alta</Pill></>}</td>
                <td>{x.descr}{x.nota_cierre && <div className="mut">{x.nota_cierre}</div>}</td><td>{x.mecanico || '—'}</td><td className="mono">{dmy(x.creada)}</td>
                <td className="mono" style={late ? { color: 'var(--bad)', fontWeight: 600 } : undefined}>{dmy(filtro === 'abiertos' ? x.programada : x.cierre)}</td>
                <td><Pill c={x.estado === 'En proceso' ? 'good' : x.estado === 'Cerrada' ? '' : 'ink'}>{x.estado}</Pill></td>
                <td>{canMtto && x.estado === 'Abierta' && <><button className="btn sm" onClick={() => run(db.from('mtto').update({ estado: 'En proceso', inicio: new Date().toISOString() }).eq('id', x.id))}>Tomar</button>{' '}</>}
                  {canMtto && x.estado !== 'Cerrada' && <button className="btn sm" onClick={() => setCierra(x)}>Cerrar</button>}</td></tr>);
          })}</tbody></table></Scroll>
      ) : <Empty>Sin órdenes de trabajo. Carga aquí tu lista de correctivos pendientes y arma los preventivos por máquina (con &quot;repetir cada N días&quot;).</Empty>}
      {nuevo && <Nueva onClose={() => setNuevo(false)} />}
      {cierra && <Cerrar x={cierra} onClose={() => setCierra(null)} />}
    </section>
  );
}

const MecList = () => { const { S } = useData(); return <datalist id="dl_mec">{S.personas.filter((p) => p.rol === 'mecánico').map((p) => <option key={p.id} value={p.nombre} />)}</datalist>; };

function Nueva({ onClose }: { onClose: () => void }) {
  const { maqs, db, run, toast } = useData();
  const [f, setF] = useState({ maq: '', tipo: 'correctivo', pri: 'Normal', prog: today(), cada: null as number | null, mec: '', desc: '' });
  const p = (k: Partial<typeof f>) => setF((s) => ({ ...s, ...k }));
  async function save() {
    if (!f.maq) return toast('Elige la máquina.', true);
    if (!f.desc.trim()) return toast('Describe el trabajo.', true);
    if (await run(db.from('mtto').insert({ maquina_id: f.maq, tipo: f.tipo, prioridad: f.pri, programada: f.prog || null, cada_dias: f.cada, mecanico: f.mec.trim() || null, descr: f.desc.trim() }), 'Orden de trabajo creada')) onClose();
  }
  return (
    <Modal title="Nueva orden de trabajo" onClose={onClose} foot={<><button className="btn" onClick={onClose}>Cancelar</button><button className="btn primary" onClick={save}>Guardar</button></>}>
      <div className="fg">
        <SelF l="Máquina" v={f.maq} on={(v) => p({ maq: v })} opts={[['', '— elige —'], ...maqs().map((m): [string, string] => [m.id, m.nombre])]} />
        <SelF l="Tipo" v={f.tipo} on={(v) => p({ tipo: v })} opts={['correctivo', 'preventivo']} />
        <SelF l="Prioridad" v={f.pri} on={(v) => p({ pri: v })} opts={['Normal', 'Alta']} />
        <DateF l="Fecha programada" v={f.prog} on={(v) => p({ prog: v })} />
        <NumF l="Repetir cada (días, preventivo)" v={f.cada} on={(v) => p({ cada: v })} />
        <Fld l="Mecánico"><input list="dl_mec" autoComplete="off" value={f.mec} onChange={(e) => p({ mec: e.target.value })} /></Fld>
      </div>
      <MecList />
      <div style={{ marginTop: 10 }}><AreaF l="Descripción del trabajo" v={f.desc} on={(v) => p({ desc: v })} /></div>
    </Modal>
  );
}

function Cerrar({ x, onClose }: { x: Mtto; onClose: () => void }) {
  const { db, run, isDueno } = useData();
  const [costo, setCosto] = useState<number | null>(null), [mec, setMec] = useState(x.mecanico || ''), [nota, setNota] = useState('');
  async function ok() {
    if (!(await run(db.from('mtto').update({ estado: 'Cerrada', cierre: new Date().toISOString(), nota_cierre: nota.trim(), ...(isDueno || costo != null ? { costo } : {}), mecanico: mec.trim() || x.mecanico }).eq('id', x.id), 'Trabajo cerrado'))) return;
    if (x.tipo === 'preventivo' && x.cada_dias) {
      const d = new Date(); d.setDate(d.getDate() + x.cada_dias);
      await run(db.from('mtto').insert({ maquina_id: x.maquina_id, tipo: 'preventivo', prioridad: x.prioridad, cada_dias: x.cada_dias, descr: x.descr, mecanico: x.mecanico, programada: ymd(d) }));
    }
    onClose();
  }
  return (
    <Modal title="Cerrar trabajo" onClose={onClose} foot={<><button className="btn" onClick={onClose}>Cancelar</button><button className="btn primary" onClick={ok}>Cerrar trabajo</button></>}>
      <div className="fg"><NumF l="Costo (opcional, MXN)" v={costo} on={setCosto} /><Fld l="Mecánico"><input list="dl_mec" value={mec} onChange={(e) => setMec(e.target.value)} /></Fld></div>
      <MecList /><div style={{ marginTop: 10 }}><AreaF l="Qué se hizo" v={nota} on={setNota} /></div>
    </Modal>
  );
}
