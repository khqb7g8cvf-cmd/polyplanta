'use client';
import { useState } from 'react';
import { useData } from '@/lib/data';
import { cls, opAll, pctTxt } from '@/lib/calc';
import { dmy, fmt, today } from '@/lib/format';
import { AreaF, DateF, Empty, Modal, PctCell, Pill, Scroll, SelF, Tile } from '@/components/ui';
import { SUGC, actaText, evid } from '@/components/shared';
import type { Amon } from '@/lib/types';

export default function Operadores() {
  const { OT, S, cfg, now } = useData();
  const [det, setDet] = useState<string | null>(null);
  const ops = opAll(OT, S.amon, cfg, now);
  return (
    <section className="sec">
      <h2>Operadores <small>últimos {cfg.ventanaDias} días · la meta se ajusta por paros mecánicos, eléctricos y falta de material</small></h2>
      <p className="mut" style={{ margin: '0 0 12px', maxWidth: '75ch' }}>Un turno cuenta como bajo cuando queda abajo de {cfg.umbralBajo}% de lo que debía producir. Cada turno bajo sin respuesta genera una sugerencia: verbal, escrita y acta administrativa. {cfg.nReconoc} turnos arriba de {cfg.umbralRec}% sugieren un reconocimiento. Las reglas se cambian en Máquinas ▸ Parámetros.</p>
      {ops.length ? (
        <Scroll>
          <table className="t">
            <thead><tr><th>Operador</th><th>Áreas</th><th className="num">Turnos</th><th>Cumplimiento</th><th>Últimos 8 turnos</th><th className="num">Bajos</th><th className="num">Sanciones</th><th>Acción</th></tr></thead>
            <tbody>
              {ops.map((o) => (
                <tr key={o.n} className="click" onClick={() => setDet(o.n)}>
                  <td><b>{o.n}</b></td><td className="mut">{o.areas.join(', ')}</td><td className="num">{o.ots.length}</td>
                  <td><PctCell p={o.pct} c={cls(o.pct, cfg)} txt={pctTxt(o.pct)} /></td>
                  <td><div className="spk">{o.ots.slice(0, 8).reverse().map((t) => <i key={t.rid} className={cls(t.pct, cfg) || 'none'} style={{ height: `${t.pct == null ? 15 : Math.max(12, (Math.min(1.25, t.pct) / 1.25) * 100)}%` }} title={`${dmy(t.fecha)} T${t.turno}: ${pctTxt(t.pct)}`} />)}</div></td>
                  <td className="num">{o.bajos.length}</td><td className="num">{o.sanc.length}</td>
                  <td>{o.sug ? <Pill c={SUGC[o.sug.tipo]}>Sugerida: {o.sug.tipo}</Pill> : <span className="mut">—</span>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Scroll>
      ) : <Empty>Aquí aparecen los operadores en cuanto se capturen reportes de turno con su nombre.</Empty>}
      {det && <Detalle n={det} onClose={() => setDet(null)} />}
    </section>
  );
}

function Detalle({ n, onClose }: { n: string; onClose: () => void }) {
  const { OT, S, cfg, now, maqById, isDueno } = useData();
  const [form, setForm] = useState<string | null>(null);
  const [acta, setActa] = useState<Amon | null>(null);
  const o = opAll(OT, S.amon, cfg, now).find((x) => x.n === n);
  if (!o) return null;
  if (acta) return <ActaView a={acta} onClose={() => setActa(null)} />;
  if (form) return <AmonForm n={n} tipo={form} onClose={() => setForm(null)} onSaved={(a) => { setForm(null); setActa(a); }} />;
  return (
    <Modal title={n} onClose={onClose} foot={<>
      <button className="btn" onClick={onClose}>Cerrar</button>
      {isDueno && <button className="btn" onClick={() => setForm('Reconocimiento')}>Registrar reconocimiento</button>}
      {isDueno && <button className="btn primary" onClick={() => setForm(o.sug && o.sug.tipo !== 'Reconocimiento' ? o.sug.tipo : 'Verbal')}>Registrar amonestación</button>}</>}>
      <div className="tiles" style={{ marginBottom: 14 }}>
        <Tile l="Cumplimiento" v={<b className={cls(o.pct, cfg)}>{pctTxt(o.pct)}</b>} /><Tile l="Turnos bajo meta" v={o.bajos.length} /><Tile l={`Sanciones en ${cfg.ventanaDias} días`} v={o.sanc.length} />
      </div>
      {o.sug && <div className="banner" style={{ marginBottom: 14 }}>Sugerencia: <b>{o.sug.tipo}</b>. {o.sug.tipo === 'Reconocimiento' ? `${o.buenos.length} turnos arriba de ${cfg.umbralRec}%.` : `${o.bajos.length} turnos bajo meta y ${o.sanc.length} amonestaciones registradas.`}</div>}
      <h3 style={{ marginBottom: 6 }}>Turnos</h3>
      <Scroll><table className="t" style={{ minWidth: 520 }}>
        <thead><tr><th>Turno</th><th>Máquina</th><th className="num">Debía</th><th className="num">Reportó</th><th>%</th></tr></thead>
        <tbody>{o.ots.slice(0, 15).map((t) => (
          <tr key={t.rid}><td>{dmy(t.fecha)} · T{t.turno}</td><td>{t.lines.map((x) => maqById(x.maquina_id)?.nombre).filter(Boolean).join(', ')}</td><td className="num">{t.exp ? fmt(t.exp) : '—'}</td><td className="num">{fmt(t.kg)}</td>
            <td><Pill c={cls(t.pct, cfg)}>{pctTxt(t.pct)}</Pill>{t.just && <> <Pill c="ink">justificada</Pill></>}</td></tr>))}</tbody>
      </table></Scroll>
      <h3 style={{ margin: '14px 0 6px' }}>Historial</h3>
      {o.am.length ? <Scroll><table className="t" style={{ minWidth: 420 }}><tbody>
        {o.am.slice().sort((a, b) => b.fecha.localeCompare(a.fecha)).map((a) => (
          <tr key={a.id}><td>{dmy(a.fecha)}</td><td><Pill c={SUGC[a.tipo] || ''}>{a.tipo}</Pill></td><td>{a.nota || a.evidencia || ''}</td><td><button className="btn sm" onClick={() => setActa(a)}>Ver acta</button></td></tr>))}
      </tbody></table></Scroll> : <div className="mut">Sin amonestaciones ni reconocimientos en la ventana.</div>}
      {!isDueno && <p className="mut" style={{ marginTop: 12 }}>Solo el dueño puede registrar amonestaciones.</p>}
    </Modal>
  );
}

function AmonForm({ n, tipo: t0, onClose, onSaved }: { n: string; tipo: string; onClose: () => void; onSaved: (a: Amon) => void }) {
  const { OT, S, cfg, now, maqById, db, toast, refresh } = useData();
  const o = opAll(OT, S.amon, cfg, now).find((x) => x.n === n);
  const [tipo, setTipo] = useState(t0), [fecha, setFecha] = useState(today()), [nota, setNota] = useState('');
  const base = o ? (t0 === 'Reconocimiento' ? o.buenos : o.bajos).slice(0, 5) : [];
  const [ev, setEv] = useState(base.map((x) => evid(x, (id) => maqById(id)?.nombre)).join('\n'));
  const [busy, setBusy] = useState(false);
  async function save() {
    setBusy(true);
    const { data, error } = await db.from('amonestaciones').insert({ operario: n, tipo, fecha: fecha || today(), evidencia: ev.trim(), nota: nota.trim() }).select().single();
    setBusy(false);
    if (error) return toast(error.message, true);
    refresh(); onSaved(data as Amon);
  }
  return (
    <Modal title={'Registrar · ' + n} onClose={onClose} foot={<><button className="btn" onClick={onClose}>Cancelar</button><button className="btn primary" disabled={busy} onClick={save}>Guardar y ver acta</button></>}>
      <div className="fg">
        <SelF l="Tipo" v={tipo} on={setTipo} opts={[['Verbal', 'Llamada de atención verbal'], ['Escrita', 'Amonestación escrita'], ['Acta', 'Acta administrativa'], ['Reconocimiento', 'Reconocimiento']]} />
        <DateF l="Fecha" v={fecha} on={setFecha} />
      </div>
      <div style={{ marginTop: 12 }}><AreaF l="Hechos (se llenan solos con los turnos bajo meta)" v={ev} on={setEv} h={130} /></div>
      <div style={{ marginTop: 12 }}><AreaF l="Comentarios del jefe" v={nota} on={setNota} /></div>
      <p className="mut" style={{ marginTop: 10 }}>Para sanciones escritas, la firma del trabajador y de un testigo es lo que le da peso. Revisa el procedimiento con tu abogado laboral.</p>
    </Modal>
  );
}

function ActaView({ a, onClose }: { a: Amon; onClose: () => void }) {
  const { toast } = useData();
  const txt = actaText(a);
  return (
    <Modal title={'Acta · ' + a.operario} onClose={onClose} foot={<><button className="btn" onClick={onClose}>Cerrar</button>
      <button className="btn primary" onClick={async () => { try { await navigator.clipboard.writeText(txt); toast('Texto copiado'); } catch { toast('Selecciona y copia el texto', true); } }}>Copiar texto</button></>}>
      <textarea className="inp" readOnly defaultValue={txt} style={{ minHeight: 360, fontFamily: 'var(--f-mono)', fontSize: 12.5 }} />
    </Modal>
  );
}
