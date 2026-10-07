'use client';
import { useMemo, useState } from 'react';
import { useData } from '@/lib/data';
import { dmy, fmt, hhmm, localDT, sum } from '@/lib/format';
import { conciliacion, resumenMateriales, type MatResumen } from '@/lib/inv';
import { AreaF, Empty, Fld, Modal, NumF, Pill, Scroll, SelF, Tile, TxtF } from '@/components/ui';
import type { Material, Movimiento } from '@/lib/types';

const CAT: [string, string][] = [['resina', 'Resina'], ['reciclado', 'Reciclado'], ['masterbatch', 'Masterbatch / pigmento'], ['aditivo', 'Aditivo']];
type Modo = { k: 'entrada' | 'salida' | 'conteo'; mat?: string } | { k: 'material'; m?: Material } | null;

export default function Inventario() {
  const { S, now, canProd, isDueno, maqById, run, db } = useData();
  const [modo, setModo] = useState<Modo>(null), [filtro, setFiltro] = useState('');
  const res = useMemo(() => resumenMateriales(S.materiales, S.existencias, S.movs, now), [S.materiales, S.existencias, S.movs, now]);
  const matBy = (id: string) => S.materiales.find((m) => m.id === id);
  const desde = new Date(now - 30 * 864e5).toISOString().slice(0, 10), hasta = new Date(now).toISOString().slice(0, 10);
  const { L } = useData();
  const con = conciliacion(S.movs, L, desde, hasta);
  const valor = sum(res, (r) => r.valor || 0), bajos = res.filter((r) => r.bajo);
  const movs = S.movs.filter((x) => !filtro || x.material_id === filtro).slice(0, 60);

  return (
    <>
      <section className="sec">
        <h2>Inventario de resina
          <span className="row">
            <button className="btn" disabled={!canProd} onClick={() => setModo({ k: 'conteo' })}>Conteo físico</button>
            <button className="btn" disabled={!canProd} onClick={() => setModo({ k: 'salida' })}>− Salida a producción</button>
            <button className="btn primary" disabled={!canProd} onClick={() => setModo({ k: 'entrada' })}>+ Entrada de material</button>
          </span></h2>
        <div className="tiles" style={{ marginBottom: 16 }}>
          <Tile l="Bajo mínimo" v={bajos.length} e={bajos.length ? bajos.map((x) => x.m.nombre).join(', ') : 'todo arriba del mínimo'} c={bajos.length ? 'alert' : ''} />
          <Tile l="Valor en bodega" v={valor ? '$' + fmt(valor) : '—'} e="al último costo por kg capturado" />
          <Tile l="Salidas · 30 días" v={fmt(con.salidas) + ' kg'} e="de bodega a producción" />
          <Tile l="Diferencia vs extruido" v={con.salidas ? fmt(con.dif) + ' kg' : '—'} e={con.pct == null ? 'sin salidas capturadas' : con.dif >= 0 ? `${fmt(con.pct * 100, 1)}% de lo que salió no aparece extruido (merma o reportes incompletos)` : 'se extruyó más de lo registrado: faltan salidas por capturar'} c={con.pct != null && Math.abs(con.pct) > 0.1 ? 'alert' : ''} />
        </div>
        {res.length ? (
          <Scroll><table className="t"><thead><tr><th>Material</th><th className="num">Existencia</th><th className="num">Sacos</th><th className="num">Mínimo</th><th className="num">Consumo/día</th><th className="num">Cobertura</th><th>Estado</th><th className="num">$/kg</th><th></th></tr></thead><tbody>
            {res.map((r: MatResumen) => (
              <tr key={r.m.id}>
                <td><b>{r.m.nombre}</b><div className="mut">{CAT.find((c) => c[0] === r.m.categoria)?.[1]}</div></td>
                <td className="num">{fmt(r.kg)} kg</td><td className="num">{fmt(r.sacos, 1)}</td><td className="num">{fmt(r.m.minimo_kg)}</td>
                <td className="num">{r.consumoDia ? fmt(r.consumoDia, 0) + ' kg' : '—'}</td>
                <td className="num">{r.dias == null ? '—' : fmt(r.dias, 0) + ' d'}</td>
                <td>{r.kg <= 0 ? <Pill c="bad">Sin existencia</Pill> : r.bajo ? <Pill c="bad">Bajo mínimo</Pill> : r.dias != null && r.dias < 7 ? <Pill c="warn">Menos de 7 días</Pill> : <Pill c="good">Bien</Pill>}</td>
                <td className="num">{r.costoKg ? fmt(r.costoKg, 2) : '—'}</td>
                <td style={{ whiteSpace: 'nowrap' }}>{canProd && <><button className="btn sm" onClick={() => setModo({ k: 'entrada', mat: r.m.id })}>Entrada</button>{' '}<button className="btn sm" onClick={() => setModo({ k: 'salida', mat: r.m.id })}>Salida</button>{' '}</>}{isDueno && <button className="btn sm" onClick={() => setModo({ k: 'material', m: r.m })}>Editar</button>}</td>
              </tr>))}
          </tbody></table></Scroll>
        ) : <Empty>Todavía no hay materiales. {isDueno ? 'Agrega el primero.' : 'El dueño debe darlos de alta.'}</Empty>}
        {isDueno && <p style={{ marginTop: 10 }}><button className="btn sm" onClick={() => setModo({ k: 'material' })}>+ Nuevo material</button></p>}
        <p className="mut" style={{ marginTop: 8, maxWidth: '80ch' }}>La cobertura se calcula con el consumo de los últimos 30 días (solo salidas capturadas). Mientras más completo sea el registro de salidas, más confiable es el número.</p>
      </section>

      <section className="sec">
        <h2>Movimientos <select className="inp" style={{ width: 'auto', fontSize: 14 }} value={filtro} onChange={(e) => setFiltro(e.target.value)}><option value="">Todos los materiales</option>{S.materiales.map((m) => <option key={m.id} value={m.id}>{m.nombre}</option>)}</select></h2>
        {movs.length ? (
          <Scroll><table className="t"><thead><tr><th>Fecha</th><th>Material</th><th>Tipo</th><th className="num">Kg</th><th>Detalle</th><th></th></tr></thead><tbody>
            {movs.map((x: Movimiento) => (
              <tr key={x.id}>
                <td className="mono">{dmy(x.fecha)} {hhmm(x.fecha)}</td><td>{matBy(x.material_id)?.nombre || '?'}</td>
                <td><Pill c={x.tipo === 'entrada' ? 'good' : x.tipo === 'salida' ? 'ink' : 'warn'}>{x.tipo}</Pill></td>
                <td className="num" style={{ color: x.delta_kg < 0 ? 'var(--bad)' : undefined }}>{x.delta_kg > 0 ? '+' : ''}{fmt(x.delta_kg, 1)}</td>
                <td>{[x.sacos ? `${fmt(x.sacos, 1)} sacos` : '', x.lote && `lote ${x.lote}`, x.proveedor, x.factura && `fact. ${x.factura}`, x.costo_kg && `$${fmt(x.costo_kg, 2)}/kg`, x.maquina_id && maqById(x.maquina_id)?.nombre, x.nota].filter(Boolean).join(' · ')}</td>
                <td>{isDueno && <button className="btn sm danger" onClick={() => confirm('¿Anular este movimiento? Cambia la existencia.') && run(db.from('inv_movimientos').delete().eq('id', x.id), 'Movimiento anulado')}>Anular</button>}</td>
              </tr>))}
          </tbody></table></Scroll>
        ) : <Empty>Sin movimientos todavía. Empieza con un conteo físico para dejar la existencia inicial y luego registra cada entrada y salida.</Empty>}
      </section>
      {modo && modo.k !== 'material' && modo.k !== 'conteo' && <Mov tipo={modo.k} mat={modo.mat} onClose={() => setModo(null)} />}
      {modo?.k === 'conteo' && <Conteo onClose={() => setModo(null)} />}
      {modo?.k === 'material' && <Mat m={modo.m} onClose={() => setModo(null)} />}
    </>
  );
}

function Mov({ tipo, mat, onClose }: { tipo: 'entrada' | 'salida'; mat?: string; onClose: () => void }) {
  const { S, maqs, db, run, toast } = useData();
  const [f, setF] = useState({ mat: mat || '', sacos: null as number | null, kg: null as number | null, fecha: localDT(new Date()), lote: '', prov: '', fact: '', costo: null as number | null, maq: '', nota: '' });
  const p = (k: Partial<typeof f>) => setF((s) => ({ ...s, ...k }));
  const m = S.materiales.find((x) => x.id === f.mat);
  const ex = m ? S.existencias[m.id] ?? 0 : 0;
  async function save() {
    if (!m) return toast('Elige el material.', true);
    const kg = f.kg ?? (f.sacos ? f.sacos * m.kg_por_saco : null);
    if (!kg || kg <= 0) return toast('Captura los kilos o los sacos.', true);
    if (tipo === 'salida' && kg > ex && !confirm(`Solo hay ${fmt(ex)} kg en el sistema y estás sacando ${fmt(kg)} kg. ¿Registrar de todos modos? (la existencia quedaría negativa; haz un conteo físico para corregir)`)) return;
    const row = {
      material_id: m.id, tipo, delta_kg: tipo === 'entrada' ? kg : -kg, sacos: f.sacos ?? (m.kg_por_saco ? kg / m.kg_por_saco : null), fecha: new Date(f.fecha).toISOString(),
      lote: f.lote.trim() || null, proveedor: f.prov.trim() || null, factura: f.fact.trim() || null, costo_kg: tipo === 'entrada' ? f.costo : null, maquina_id: tipo === 'salida' ? f.maq || null : null, nota: f.nota.trim() || null,
    };
    if (await run(db.from('inv_movimientos').insert(row), tipo === 'entrada' ? 'Entrada registrada' : 'Salida registrada')) onClose();
  }
  return (
    <Modal title={tipo === 'entrada' ? 'Entrada de material' : 'Salida a producción'} onClose={onClose} foot={<><button className="btn" onClick={onClose}>Cancelar</button><button className="btn primary" onClick={save}>Guardar</button></>}>
      <div className="fg">
        <SelF l="Material" v={f.mat} on={(v) => p({ mat: v })} opts={[['', '— elige —'], ...S.materiales.filter((x) => x.activo).map((x): [string, string] => [x.id, x.nombre])]} />
        <Fld l="Fecha y hora"><input type="datetime-local" value={f.fecha} onChange={(e) => p({ fecha: e.target.value })} /></Fld>
        <NumF l={`Sacos${m ? ` (${m.kg_por_saco} kg)` : ''}`} v={f.sacos} on={(v) => p({ sacos: v, kg: v && m ? v * m.kg_por_saco : null })} />
        <NumF l="Kilos" v={f.kg} on={(v) => p({ kg: v })} style={{ fontWeight: 600 }} />
        {tipo === 'entrada' && <><TxtF l="Proveedor" v={f.prov} on={(v) => p({ prov: v })} /><TxtF l="Lote" v={f.lote} on={(v) => p({ lote: v })} /><TxtF l="Factura / remisión" v={f.fact} on={(v) => p({ fact: v })} /><NumF l="Costo por kg (MXN)" v={f.costo} on={(v) => p({ costo: v })} /></>}
        {tipo === 'salida' && <SelF l="Extrusora destino (opcional)" v={f.maq} on={(v) => p({ maq: v })} opts={[['', '—'], ...maqs('extrusion').map((x): [string, string] => [x.id, x.nombre])]} />}
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
