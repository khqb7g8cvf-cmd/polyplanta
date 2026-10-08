'use client';
import { useMemo, useState } from 'react';
import { useData } from '@/lib/data';
import { AREAS, bolseoCalc, cls, gapTxt, lineKgh, paroH, pctTxt, shiftWin, stepShift, sumL } from '@/lib/calc';
import { fmt, ymd } from '@/lib/format';
import { Bar, ChkF, DateF, Modal, NumF, Pill, SelF, Tile, TxtF, Fld } from '@/components/ui';
import { lineMed, shiftName, useMoney } from '@/components/shared';
import type { LineaRow, Maquina, Tipo } from '@/lib/types';

type Draft = Omit<LineaRow, 'reporte_id' | 'id'> & { id?: string; key: string };

export default function Turno() {
  const { S, L, cfg, turno, setTurno, maqs, canProd } = useData();
  const money = useMoney();
  const [cap, setCap] = useState<string | null>(null);
  const { fecha, turno: t } = turno;
  const ls = useMemo(() => L.filter((x) => x.fecha === fecha && x.turno === t), [L, fecha, t]);
  const s = sumL(ls), activas = maqs().filter((m) => (m.estado || 'Activa') === 'Activa');
  const rep = activas.filter((m) => ls.some((x) => x.maquina_id === m.id)).length;
  const step = (d: 1 | -1) => setTurno(stepShift(fecha, t, d));

  return (
    <section className="sec">
      <h2>Reporte de turno</h2>
      <div className="row" style={{ marginBottom: 14 }}>
        <button className="btn" onClick={() => step(-1)} aria-label="Turno anterior">‹</button>
        <label className="f" style={{ width: 150 }}><input type="date" value={fecha} onChange={(e) => e.target.value && setTurno({ fecha: e.target.value, turno: t })} /></label>
        <div className="chips">{([1, 2] as const).map((k) => <button key={k} aria-pressed={t === k} onClick={() => setTurno({ fecha, turno: k })}>Turno {k}{k === 1 ? ' · día' : ' · noche'}</button>)}</div>
        <button className="btn" onClick={() => step(1)} aria-label="Turno siguiente">›</button>
        <span className="mut">{rep} de {activas.length} máquinas con reporte</span>
      </div>
      <div className="tiles" style={{ marginBottom: 18 }}>
        <Tile l="Debían producir" v={s.exp ? fmt(s.exp) + ' kg' : '—'} e="según golpes, medida y calibre" />
        <Tile l="Reportaron" v={fmt(s.kg) + ' kg'} e="suma del turno" />
        <Tile l="Cumplimiento" v={pctTxt(s.pct)} e={s.pct == null ? 'sin teórico' : gapTxt(s.pct)} c={cls(s.pct, cfg) === 'bad' ? 'alert' : ''} />
        <Tile l="Diferencia" v={s.exp ? fmt(s.kgE - s.exp) + ' kg' : '—'} e={s.falta ? 'dejaron de producir' + money(s.falta) : ''} />
      </div>
      {(['extrusion', 'impresion', 'bolseo', 'acabado'] as Tipo[]).map((tipo) => {
        const lm = activas.filter((m) => m.tipo === tipo);
        if (!lm.length) return null;
        return (
          <div key={tipo}>
            <h3 style={{ margin: '16px 0 8px' }}>{AREAS[tipo]}</h3>
            <div className="grid">
              {lm.map((m) => {
                const mine = ls.filter((x) => x.maquina_id === m.id), ms = sumL(mine), ph = paroH(S.paros, m.id, fecha, t, cfg);
                return (
                  <button key={m.id} className={`card mach ${mine.length ? '' : 'vacio'}`} onClick={() => setCap(m.id)}>
                    <div className="nm"><b>{m.nombre}</b>{mine.length ? <Pill c={cls(ms.pct, cfg)}>{pctTxt(ms.pct)}</Pill> : <Pill>Sin reporte</Pill>}</div>
                    {mine.map((x) => <div className="ln" key={x.id}><span>{x.cliente || '—'} <span className="mut">{lineMed(x)}</span></span><span className="mut">{x.operario}</span></div>)}
                    {mine.length ? (<>
                      <div className="row" style={{ justifyContent: 'space-between' }}><span className="mono">{fmt(ms.kg)} kg</span><span className="mut">{ms.exp ? 'de ' + fmt(ms.exp) : 'sin teórico'}</span></div>
                      <Bar p={ms.pct || 0} c={cls(ms.pct, cfg)} />
                    </>) : <span className="mut">Toca para capturar el reporte</span>}
                    {ph > 0 && <span className="pill warn" style={{ alignSelf: 'flex-start' }}>paro {fmt(ph, 1)} h</span>}
                  </button>
                );
              })}
            </div>
          </div>
        );
      })}
      {cap && <Captura maqId={cap} onClose={() => setCap(null)} />}
      {!canProd && <p className="mut" style={{ marginTop: 14 }}>Tu rol no permite capturar reportes.</p>}
      <p className="mut" style={{ marginTop: 14 }}>{shiftName(fecha, t)}</p>
    </section>
  );
}

function Captura({ maqId, onClose }: { maqId: string; onClose: () => void }) {
  const { S, L, cfg, turno, maqById, db, run, toast, canProd } = useData();
  const { fecha, turno: t } = turno, m = maqById(maqId) as Maquina;
  const rep = S.reportes.find((r) => r.fecha === fecha && r.turno === t);
  const ords = S.ordenes.filter((o) => o.estado !== 'Terminada'), b = m.tipo === 'bolseo';
  const mk = (): Draft => {
    const prev = L.filter((x) => x.maquina_id === m.id).sort((a, c) => (c.fecha + c.turno).localeCompare(a.fecha + a.turno))[0];
    return { key: Math.random().toString(36).slice(2), maquina_id: m.id, orden_id: null, cliente: prev?.cliente || '', ancho: prev?.ancho ?? null, largo: prev?.largo ?? null, calibre: prev?.calibre ?? null, densidad: prev?.densidad || 'baja', golpes: prev?.golpes ?? null, carriles: prev?.carriles ?? null, kgh: prev?.kgh ?? null, horas: null, operario: '', kilos: null as unknown as number, nota: '', justificada: false };
  };
  const [lines, setLines] = useState<Draft[]>(() => {
    const ex = (rep?.reporte_lineas || []).filter((l) => l.maquina_id === m.id).map((l) => ({ ...l, key: l.id }));
    return ex.length ? ex : [mk()];
  });
  const [busy, setBusy] = useState(false);
  const set = (i: number, p: Partial<Draft>) => setLines((a) => a.map((l, k) => (k === i ? { ...l, ...p } : l)));
  const exc = new Set(cfg.excusadas || []);
  const [a, c] = shiftWin(fecha, t, cfg);
  const ps = S.paros.filter((p) => p.maquina_id === m.id && Date.parse(p.inicio) < +c && (p.fin ? Date.parse(p.fin) : Date.now()) > +a);
  const excH = paroH(S.paros, m.id, fecha, t, cfg, exc), heff = Math.max(0, cfg.horasProd - excH);
  const n = lines.length, hs = lines.map((l) => Number(l.horas) || 0), all = n > 1 && hs.every((x) => x > 0), tot = hs.reduce((x, y) => x + y, 0);

  async function save() {
    if (lines.some((l) => !l.operario.trim() || l.kilos == null || Number.isNaN(Number(l.kilos)))) return toast('Falta el operador o los kilos.', true);
    setBusy(true);
    const { data: r, error } = await db.from('reportes').upsert({ fecha, turno: t }, { onConflict: 'fecha,turno' }).select('id').single();
    if (error || !r) { setBusy(false); return toast(error?.message || 'No se pudo crear el reporte', true); }
    const keep = lines.filter((l) => l.id).map((l) => l.id as string);
    const old = (rep?.reporte_lineas || []).filter((l) => l.maquina_id === m.id).map((l) => l.id);
    const del = old.filter((id) => !keep.includes(id));
    if (del.length) { const e = await db.from('reporte_lineas').delete().in('id', del); if (e.error) { setBusy(false); return toast(e.error.message, true); } }
    const rows = lines.map(({ key: _k, ...l }) => ({ ...l, operario: l.operario.trim(), cliente: (l.cliente || '').trim(), nota: (l.nota || '').trim(), reporte_id: r.id, maquina_id: m.id }));
    const upd = rows.filter((x) => x.id), ins = rows.filter((x) => !x.id).map(({ id: _i, ...x }) => x);
    const ok = (!upd.length || (await run(db.from('reporte_lineas').upsert(upd)))) && (!ins.length || (await run(db.from('reporte_lineas').insert(ins))));
    if (ok) {
      for (const l of lines) if (!S.personas.some((p) => p.nombre.toLowerCase() === l.operario.trim().toLowerCase()))
        await db.from('personas').insert({ nombre: l.operario.trim(), rol: 'operador', area: m.tipo });
      toast('Reporte guardado'); onClose();
    }
    setBusy(false);
  }

  return (
    <Modal title={'Reporte · ' + m.nombre} onClose={onClose} foot={<><button className="btn" onClick={onClose}>Cancelar</button><button className="btn primary" disabled={!canProd || busy} onClick={save}>Guardar reporte</button></>}>
      <p className="mut" style={{ margin: '0 0 12px' }}>{m.nombre} · {shiftName(fecha, t)}. {ps.length ? <>Paros registrados en este turno: {ps.map((p, i) => <span key={p.id}>{i ? ', ' : ''}<b>{p.causa}</b> {fmt(paroH([p], m.id, fecha, t, cfg), 1)} h{exc.has(p.causa) ? ' (se descuenta de la meta)' : ' (no se descuenta)'}</span>)}.</> : 'Sin paros registrados en este turno.'}</p>
      <datalist id="dl_oper">{S.personas.filter((p) => p.rol === 'operador').map((p) => <option key={p.id} value={p.nombre} />)}</datalist>
      {lines.map((l, i) => {
        const kgh = lineKgh(l, m), bq = b ? bolseoCalc({ ancho: l.ancho, largo: l.largo, calibre: l.calibre, densidad: l.densidad, golpes: l.golpes || m.golpes, carriles: l.carriles || m.carriles, horas: heff }) : null, share = all ? hs[i] / tot : 1 / n, exp = kgh ? kgh * heff * share : null, pct = exp && l.kilos != null ? l.kilos / exp : null;
        const pickOrden = (id: string) => {
          const o = S.ordenes.find((x) => x.id === id);
          set(i, o ? { orden_id: id, cliente: o.cliente, ancho: (b ? o.bolsa_ancho : o.ancho_ext) ?? l.ancho, largo: o.bolsa_largo ?? l.largo, calibre: o.calibre ?? l.calibre, densidad: o.densidad || 'baja' } : { orden_id: null });
        };
        return (
          <fieldset key={l.key}>
            <legend>{n > 1 ? 'Orden ' + (i + 1) : 'Producción del turno'}</legend>
            <div className="fg">
              {ords.length > 0 && <SelF l="Orden programada (opcional)" v={l.orden_id || ''} on={pickOrden} opts={[['', '— capturar a mano —'], ...ords.map((o): [string, string] => [o.id, `${o.folio} · ${o.cliente}`])]} />}
              <TxtF l="Cliente" v={l.cliente} on={(v) => set(i, { cliente: v })} />
            </div>
            <div className="fg" style={{ marginTop: 10 }}>
              <NumF l={b ? 'Ancho bolsa (cm)' : 'Ancho (cm)'} v={l.ancho} on={(v) => set(i, { ancho: v })} />
              {b && <NumF l="Largo bolsa (cm)" v={l.largo} on={(v) => set(i, { largo: v })} />}
              <NumF l="Calibre" v={l.calibre} on={(v) => set(i, { calibre: v })} />
              <SelF l="Densidad" v={l.densidad} on={(v) => set(i, { densidad: v })} opts={[['baja', 'Baja'], ['alta', 'Alta']]} />
              {b ? <NumF l="Golpes por minuto" v={l.golpes ?? m.golpes} on={(v) => set(i, { golpes: v })} /> : <NumF l="kg/h esperados" v={l.kgh ?? m.kgh} on={(v) => set(i, { kgh: v })} />}
              {b && <NumF l="Carriles" v={l.carriles ?? m.carriles} on={(v) => set(i, { carriles: v })} />}
              {n > 1 && <NumF l="Horas en esta orden" v={l.horas} on={(v) => set(i, { horas: v })} />}
            </div>
            <div className="fg" style={{ marginTop: 10 }}>
              <Fld l="Operador"><input list="dl_oper" autoComplete="off" value={l.operario} onChange={(e) => set(i, { operario: e.target.value })} /></Fld>
              <NumF l="Kilos reportados" v={l.kilos as number | null} on={(v) => set(i, { kilos: v as number })} style={{ fontSize: 18, fontWeight: 600 }} />
              <TxtF l="Nota" v={l.nota} on={(v) => set(i, { nota: v })} />
            </div>
            <div className="row" style={{ marginTop: 10, justifyContent: 'space-between' }}>
              <ChkF l="Justificada por el jefe (no cuenta para amonestación)" v={l.justificada} on={(v) => set(i, { justificada: v })} />
              {n > 1 && <button className="btn sm danger" onClick={() => setLines((a) => a.filter((_, k) => k !== i))}>Quitar</button>}
            </div>
            <div className="calc" style={{ marginTop: 10 }}>
              {exp ? <><span>Debía: <b>{fmt(exp)} kg</b></span><span>({fmt(kgh, 0)} kg/h × {fmt(heff * share, 1)} h{bq ? ` · ${fmt(bq.bolsasMin, 0)} bolsas/min = ${fmt(bq.millaresH * heff * share, 1)} millares` : ''})</span>
                {pct != null && <><span>Reportó: <b>{fmt(l.kilos)} kg</b></span><span className={cls(pct, cfg) === 'bad' ? 't-bad' : ''}>Cumplimiento: <b>{pctTxt(pct)}</b> · {l.kilos >= exp ? '+' : ''}{fmt(l.kilos - exp)} kg</span></>}</>
                : <span className="mut">Captura golpes, medida y calibre{b ? '' : ' (o kg/h)'} para calcular lo que debía producir.</span>}
            </div>
          </fieldset>
        );
      })}
      <button className="btn" onClick={() => setLines((a) => [...a, mk()])}>+ Otra orden en esta máquina</button>
    </Modal>
  );
}
