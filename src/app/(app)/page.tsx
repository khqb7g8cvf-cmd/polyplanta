'use client';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useData } from '@/lib/data';
import { AREAS, cls, gapTxt, opAll, pctTxt, sumL } from '@/lib/calc';
import { dmy, fmt, fmtDur, hhmm, today } from '@/lib/format';
import { resumenMateriales } from '@/lib/inv';
import { Empty, Pill, Tile } from '@/components/ui';
import { LinesTable, Trend, shiftName, useMoney } from '@/components/shared';
import Solicitudes from '@/components/Solicitudes';
import type { Tipo } from '@/lib/types';

export default function Hoy() {
  const { S, L, OT, cfg, now, maqById, run, db, canProd, setTurno, isDueno } = useData();
  const r = useRouter(), money = useMoney();
  const hoy = today(), ab = S.paros.filter((p) => !p.fin), mAb = S.mtto.filter((x) => x.estado !== 'Cerrada');
  const venc = mAb.filter((x) => x.tipo === 'preventivo' && x.programada && x.programada < hoy);
  const ops = opAll(OT, S.amon, cfg, now), pend = ops.filter((o) => o.sug && o.sug.tipo !== 'Reconocimiento'), recs = ops.filter((o) => o.sug?.tipo === 'Reconocimiento');
  const inv = resumenMateriales(S.materiales, S.existencias, S.movs, now), bajos = inv.filter((x) => x.bajo), urgentes = inv.filter((x) => x.dias != null && x.dias < 7 && !x.bajo);
  const last = L.map((x) => ({ fecha: x.fecha, turno: x.turno })).sort((a, b) => (a.fecha + a.turno).localeCompare(b.fecha + b.turno)).pop();
  const ls = last ? L.filter((x) => x.fecha === last.fecha && x.turno === last.turno) : [];
  const s = sumL(ls);
  const porA = (['extrusion', 'impresion', 'bolseo'] as Tipo[]).map((t) => ({ t, s: sumL(ls.filter((x) => x.tipo === t)) })).filter((x) => x.s.n);
  // Día completo: los dos turnos de la fecha del último reporte.
  const ld = last ? L.filter((x) => x.fecha === last.fecha) : [], sd = sumL(ld);
  const dA = (['extrusion', 'impresion', 'bolseo'] as Tipo[]).map((t) => ({ t, s: sumL(ld.filter((x) => x.tipo === t)) })).filter((x) => x.s.n);
  const dT = ([1, 2] as const).map((k) => ({ k, s: sumL(ld.filter((x) => x.turno === k)) })).filter((x) => x.s.n);

  return (
    <>
      {isDueno && <Solicitudes />}
      <section className="sec">
        <h2>{new Date().toLocaleDateString('es-MX', { weekday: 'long', day: 'numeric', month: 'long' })}</h2>
        {!last ? (
          <Empty><b>Todavía no hay reportes de turno.</b><br />Cuando se capture el primero en Turno, aquí verás qué tanto cumplió cada máquina contra lo que debía producir.
            <div style={{ marginTop: 12 }}><Link href="/turno"><button className="btn primary">Capturar el primer turno</button></Link></div></Empty>
        ) : (
          <div className={`hero ${cls(s.pct, cfg)}`}>
            <div>
              <small>Último turno reportado · {shiftName(last.fecha, last.turno)}</small>
              <div className="big">{pctTxt(s.pct)}</div>
              <div className="hs">{s.exp ? <>Debían producirse <b>{fmt(s.exp)} kg</b> y se reportaron <b>{fmt(s.kgE)} kg</b>. {gapTxt(s.pct)}{s.falta ? ` · ${fmt(s.falta)} kg menos${money(s.falta)}` : ''}.</> : 'Faltan datos de golpes, calibre o kg/h para calcular lo que debía producirse.'}</div>
            </div>
            <div className="hareas">{porA.map((x) => <div key={x.t}><small>{AREAS[x.t]}</small><b className={cls(x.s.pct, cfg)}>{pctTxt(x.s.pct)}</b></div>)}</div>
            <div><button className="btn" onClick={() => { setTurno({ fecha: last.fecha, turno: last.turno }); r.push('/turno'); }}>Ver reporte completo</button></div>
          </div>
        )}
        {last && ld.length > ls.length && (
          <div className={`hero ${cls(sd.pct, cfg)}`} style={{ marginTop: 12 }}>
            <div>
              <small>Rendimiento del día · {dmy(last.fecha)} · {dT.length === 2 ? 'turnos 1 y 2' : 'turno ' + dT[0]?.k}</small>
              <div className="big">{pctTxt(sd.pct)}</div>
              <div className="hs">{sd.exp ? <>Debían producirse <b>{fmt(sd.exp)} kg</b> y se reportaron <b>{fmt(sd.kgE)} kg</b>. {gapTxt(sd.pct)}{sd.falta ? ` · ${fmt(sd.falta)} kg menos${money(sd.falta)}` : ''}.</> : 'Faltan datos para calcular lo que debía producirse.'}</div>
            </div>
            <div className="hareas">{dT.length > 1 && dT.map((x) => <div key={x.k}><small>Turno {x.k}</small><b className={cls(x.s.pct, cfg)}>{pctTxt(x.s.pct)}</b></div>)}{dA.map((x) => <div key={x.t}><small>{AREAS[x.t]}</small><b className={cls(x.s.pct, cfg)}>{pctTxt(x.s.pct)}</b></div>)}</div>
          </div>
        )}
      </section>
      <section className="sec">
        <div className="tiles">
          <Tile l="Paros abiertos" v={ab.length} e={ab.length ? 'máquinas detenidas ahora' : 'todo corriendo'} c={ab.length ? 'alert' : ''} />
          <Tile l="Amonestaciones por revisar" v={pend.length} e={pend.length ? pend.slice(0, 2).map((o) => o.n).join(', ') + (pend.length > 2 ? '…' : '') : 'nadie en este momento'} c={pend.length ? 'alert' : ''} onClick={() => r.push('/operadores')} />
          <Tile l="Para reconocer" v={recs.length} e={recs.length ? recs.map((o) => o.n).join(', ') : 'sin candidatos'} />
          <Tile l="Mantenimiento" v={mAb.length} e={venc.length ? venc.length + ' preventivos vencidos' : 'órdenes abiertas'} c={venc.length ? 'alert' : ''} />
          <Tile l="Resina bajo mínimo" v={bajos.length} e={bajos.length ? bajos.slice(0, 2).map((x) => x.m.nombre).join(', ') + (bajos.length > 2 ? '…' : '') : urgentes.length ? `${urgentes[0].m.nombre}: ${fmt(urgentes[0].dias!, 0)} días de cobertura` : 'inventario al corriente'} c={bajos.length ? 'alert' : ''} onClick={() => r.push('/inventario')} />
        </div>
      </section>
      {last && (
        <>
          <section className="sec"><h2>Cómo les fue, de peor a mejor <small>{shiftName(last.fecha, last.turno)}</small></h2><LinesTable arr={ls.slice().sort((a, b) => (a.pct ?? 9) - (b.pct ?? 9))} /></section>
          <section className="sec"><h2>Cumplimiento diario de la planta <small>últimos 14 días, la línea es el 100%</small></h2><Trend days={14} /></section>
        </>
      )}
      {ab.length > 0 && (
        <section className="sec"><h2>Paros abiertos</h2>
          <div className="grid">{ab.map((p) => (
            <div key={p.id} className="card parada">
              <div className="nm"><b>{maqById(p.maquina_id)?.nombre || '?'}</b><Pill c="bad">{p.causa}</Pill></div>
              <div className="mut">desde {hhmm(p.inicio)} · {fmtDur(now - Date.parse(p.inicio))}</div>
              {p.nota && <div>{p.nota}</div>}
              {canProd && <div><button className="btn sm" onClick={() => run(db.from('paros').update({ fin: new Date().toISOString() }).eq('id', p.id), 'Máquina reanudada')}>Reanudar</button></div>}
            </div>))}</div>
        </section>
      )}
    </>
  );
}
