'use client';
import { useState } from 'react';
import { useData } from '@/lib/data';
import { AREAS, CAUSAS } from '@/lib/calc';
import { dmy, fmtDur, hhmm, localDT } from '@/lib/format';
import { AreaF, Empty, Fld, Modal, Pill, Scroll, SelF } from '@/components/ui';
import PedirCambio, { type RefCambio } from '@/components/PedirCambio';
import type { Paro } from '@/lib/types';

export default function Paros() {
  const { S, now, maqById, canProd, run, db, quien, isDueno } = useData();
  const [open, setOpen] = useState(false), [pedir, setPedir] = useState<RefCambio | null>(null);
  const abiertos = S.paros.filter((p) => !p.fin).sort((a, b) => a.inicio.localeCompare(b.inicio));
  const cut = new Date(now - 7 * 864e5).toISOString(), rec = S.paros.filter((p) => p.fin && p.inicio >= cut).sort((a, b) => b.inicio.localeCompare(a.inicio));
  const tbl = (L: Paro[]) => (
    <Scroll><table className="t"><thead><tr><th>Máquina</th><th>Causa</th><th>Inicio</th><th className="num">Duración</th><th>Nota</th><th>Registró</th><th></th></tr></thead><tbody>
      {L.map((p) => (
        <tr key={p.id}><td>{maqById(p.maquina_id)?.nombre || '?'}</td><td><Pill c={p.causa === 'Mecánico' ? 'bad' : ''}>{p.causa}</Pill></td><td className="mono">{dmy(p.inicio)} {hhmm(p.inicio)}</td>
          <td className="num">{fmtDur((p.fin ? Date.parse(p.fin) : now) - Date.parse(p.inicio))}</td><td>{p.nota || ''}</td><td>{quien(p.created_by)}</td>
          <td style={{ whiteSpace: 'nowrap' }}>{!p.fin && canProd && <button className="btn sm" onClick={() => run(db.from('paros').update({ fin: new Date().toISOString() }).eq('id', p.id), 'Máquina reanudada')}>Reanudar</button>}{canProd && !isDueno && <>{' '}<button className="btn sm" onClick={() => setPedir({ tabla: 'paros', registro_id: p.id, resumen: `Paro de ${maqById(p.maquina_id)?.nombre || 'máquina'} · ${p.causa} · ${dmy(p.inicio)} ${hhmm(p.inicio)}` })}>Pedir cambio</button></>}{isDueno && <>{' '}<button className="btn sm danger" onClick={() => confirm(`¿Borrar el paro de ${maqById(p.maquina_id)?.nombre || 'la máquina'} (${p.causa})? Queda en la bitácora.`) && run(db.from('paros').delete().eq('id', p.id), 'Paro borrado')}>Borrar</button></>}</td></tr>))}
    </tbody></table></Scroll>
  );
  return (
    <>
      <section className="sec"><h2>Paros <button className="btn danger" disabled={!canProd} onClick={() => setOpen(true)}>+ Registrar paro</button></h2>
        <h3 style={{ marginBottom: 6 }}>Abiertos ({abiertos.length})</h3>{abiertos.length ? tbl(abiertos) : <Empty>Ninguna máquina detenida ahora.</Empty>}</section>
      <section className="sec"><h2>Últimos 7 días</h2>{rec.length ? tbl(rec) : <Empty>Todavía no hay paros cerrados. Cada paro registrado aquí alimenta el análisis de causas.</Empty>}</section>
      {open && <ParoForm onClose={() => setOpen(false)} />}
      {pedir && <PedirCambio r={pedir} onClose={() => setPedir(null)} />}
    </>
  );
}

function ParoForm({ onClose }: { onClose: () => void }) {
  const { S, maqs, db, run, toast } = useData();
  const [maq, setMaq] = useState(''), [causa, setCausa] = useState('Mecánico'), [ini, setIni] = useState(localDT(new Date())), [fin, setFin] = useState(''), [ord, setOrd] = useState(''), [nota, setNota] = useState('');
  async function save() {
    if (!ini || !maq) return toast('Falta máquina o inicio.', true);
    if (fin && new Date(fin) < new Date(ini)) return toast('El fin es anterior al inicio.', true);
    if (await run(db.from('paros').insert({ maquina_id: maq, causa, inicio: new Date(ini).toISOString(), fin: fin ? new Date(fin).toISOString() : null, orden_id: ord || null, nota: nota.trim() }), 'Paro registrado')) onClose();
  }
  return (
    <Modal title="Registrar paro" onClose={onClose} foot={<><button className="btn" onClick={onClose}>Cancelar</button><button className="btn danger" onClick={save}>Guardar paro</button></>}>
      <div className="fg">
        <SelF l="Máquina" v={maq} on={setMaq} opts={[['', '— elige —'], ...maqs().map((m): [string, string] => [m.id, `${m.nombre} · ${AREAS[m.tipo]}`])]} />
        <SelF l="Causa" v={causa} on={setCausa} opts={CAUSAS} />
        <Fld l="Inicio"><input type="datetime-local" value={ini} onChange={(e) => setIni(e.target.value)} /></Fld>
        <Fld l="Fin (vacío = sigue parada)"><input type="datetime-local" value={fin} onChange={(e) => setFin(e.target.value)} /></Fld>
        <SelF l="Orden (opcional)" v={ord} on={setOrd} opts={[['', '—'], ...S.ordenes.filter((o) => o.estado === 'En proceso').map((o): [string, string] => [o.id, `${o.folio} · ${o.cliente}`])]} />
      </div>
      <div style={{ marginTop: 10 }}><AreaF l="Nota" v={nota} on={setNota} /></div>
    </Modal>
  );
}
