'use client';
import { useState } from 'react';
import { useData } from '@/lib/data';
import { AREAS, CAUSAS } from '@/lib/calc';
import { Empty, Fld, Modal, NumF, Pill, Scroll, SelF, TxtF, AreaF, ChkF } from '@/components/ui';
import type { Cfg, Maquina, Persona, Profile, Rol, Tipo } from '@/lib/types';

const specs = (m: Maquina) => {
  const a: string[] = [];
  if (m.tipo === 'bolseo') { a.push(m.carriles ? `${m.carriles} carril${m.carriles > 1 ? 'es' : ''}${m.carriles_max && m.carriles_max > m.carriles ? ` (hasta ${m.carriles_max})` : ''}` : 'carriles ?'); a.push((m.sellos || []).join(' / ') || 'sello ?'); if (m.sin_fotocelda) a.push('sin fotocelda'); if (m.golpes) a.push(m.golpes + ' golpes/min'); }
  if (m.tipo === 'extrusion') { a.push((m.densidades || []).join(' + ') + ' densidad'); if (m.ancho_max) a.push('hasta ' + m.ancho_max + ' cm'); if (m.kgh) a.push(m.kgh + ' kg/h'); }
  if (m.tipo === 'impresion') { a.push((m.tintas || '?') + ' tintas'); if (m.imp_max) a.push('imprime ' + m.imp_max + ' cm'); if (m.mat_max) a.push('material ' + m.mat_max + ' cm'); a.push(m.caras === 1 ? '1 lado' : 'frente y vuelta'); }
  if (m.tipo === 'acabado' && m.ancho_max) a.push('hasta ' + m.ancho_max + ' cm');
  return a.join(' · ');
};
const ROLES: [Rol, string][] = [['dueno', 'Dueño'], ['encargado', 'Encargado'], ['mecanico', 'Mecánico'], ['lectura', 'Solo lectura']];

export default function Maquinas() {
  const { S, maqs, isDueno, canProd, run, db } = useData();
  const [m, setM] = useState<Maquina | 'nueva' | null>(null), [cfgOpen, setCfgOpen] = useState(false), [per, setPer] = useState(false);
  return (
    <>
      <section className="sec">
        <h2>Catálogo de máquinas <span className="row"><button className="btn" onClick={() => setCfgOpen(true)}>Parámetros</button><button className="btn primary" disabled={!isDueno} onClick={() => setM('nueva')}>+ Nueva máquina</button></span></h2>
        {(['extrusion', 'impresion', 'bolseo', 'acabado'] as Tipo[]).map((t) => maqs(t).length > 0 && (
          <div key={t}><h3 style={{ margin: '12px 0 6px' }}>{AREAS[t]}</h3>
            <Scroll><table className="t"><thead><tr><th>Máquina</th><th>Marca</th><th>Especificaciones</th><th>Estado</th><th>Notas</th></tr></thead><tbody>
              {maqs(t).map((x) => (
                <tr key={x.id} className="click" onClick={() => setM(x)}><td><b>{x.nombre}</b></td><td>{x.marca || '—'}</td>
                  <td>{specs(x)}{(x.rodillos || []).length > 0 && <div className="mut">Rodillos: {x.rodillos.map((r) => `${r.rep}×${r.cant ?? '?'}`).join(', ')}</div>}</td>
                  <td><Pill c={x.estado && x.estado !== 'Activa' ? 'warn' : 'good'}>{x.estado || 'Activa'}</Pill></td><td className="mut">{x.notas || ''}</td></tr>))}
            </tbody></table></Scroll></div>))}
      </section>
      <section className="sec">
        <h2>Personas <button className="btn" disabled={!canProd} onClick={() => setPer(true)}>+ Agregar</button></h2>
        {S.personas.length ? (
          <Scroll><table className="t" style={{ minWidth: 420 }}><thead><tr><th>Nombre</th><th>Rol</th><th>Área</th><th>Turno</th><th></th></tr></thead><tbody>
            {S.personas.map((p) => <tr key={p.id}><td>{p.nombre}</td><td>{p.rol}</td><td>{AREAS[p.area || ''] || p.area || '—'}</td><td>{p.turno || '—'}</td>
              <td>{canProd && <button className="btn sm" onClick={() => confirm(`¿Quitar a ${p.nombre}? Su historial de reportes se conserva.`) && run(db.from('personas').update({ activo: false }).eq('id', p.id))}>Quitar</button>}</td></tr>)}
          </tbody></table></Scroll>
        ) : <Empty>Los operarios se agregan solos cuando se captura su nombre en un reporte. Agrega aquí a los mecánicos para poder asignarles trabajos.</Empty>}
      </section>
      {m && <MaqForm m={m === 'nueva' ? null : m} onClose={() => setM(null)} />}
      {cfgOpen && <CfgForm onClose={() => setCfgOpen(false)} />}
      {per && <PerForm onClose={() => setPer(false)} />}
    </>
  );
}

function PerForm({ onClose }: { onClose: () => void }) {
  const { db, run, toast } = useData();
  const [f, setF] = useState({ nombre: '', rol: 'operador', area: '', turno: '' });
  async function save() {
    if (!f.nombre.trim()) return toast('Falta el nombre.', true);
    if (await run(db.from('personas').insert({ nombre: f.nombre.trim(), rol: f.rol, area: f.area || null, turno: f.turno || null }), 'Persona agregada')) onClose();
  }
  return (
    <Modal title="Agregar persona" onClose={onClose} foot={<><button className="btn" onClick={onClose}>Cancelar</button><button className="btn primary" onClick={save}>Guardar</button></>}>
      <div className="fg"><TxtF l="Nombre" v={f.nombre} on={(v) => setF({ ...f, nombre: v })} /><SelF l="Rol" v={f.rol} on={(v) => setF({ ...f, rol: v })} opts={['operador', 'mecánico', 'encargado', 'chofer', 'ayudante']} />
        <SelF l="Área" v={f.area} on={(v) => setF({ ...f, area: v })} opts={[['', '—'], ...Object.entries(AREAS)]} /><SelF l="Turno" v={f.turno} on={(v) => setF({ ...f, turno: v })} opts={[['', '—'], '1', '2']} /></div>
    </Modal>
  );
}

function MaqForm({ m, onClose }: { m: Maquina | null; onClose: () => void }) {
  const { S, db, run, toast, isDueno } = useData();
  const [f, setF] = useState<Maquina>(m ? { ...m } : { id: '', tipo: 'bolseo', nombre: '', marca: null, estado: 'Activa', orden: (S.maquinas.length + 1) * 10, carriles: null, carriles_max: null, golpes: null, kgh: null, sellos: [], tintas: null, imp_max: null, mat_max: null, caras: 2, densidades: ['baja'], ancho_max: null, sin_fotocelda: false, rodillos: [], notas: null });
  const [rod, setRod] = useState((m?.rodillos || []).map((r) => `${r.rep}x${r.cant ?? ''}`).join(', '));
  const p = (k: Partial<Maquina>) => setF((s) => ({ ...s, ...k }));
  const tog = (arr: string[], v: string, on: boolean) => (on ? [...new Set([...arr, v])] : arr.filter((x) => x !== v));
  async function save() {
    if (!f.nombre.trim()) return toast('Falta el nombre.', true);
    const rodillos = rod.split(',').map((x) => x.trim()).filter(Boolean).map((x) => { const [a, b] = x.split(/x|×/i); return { rep: Number(a), cant: b ? Number(b) : null }; }).filter((r) => r.rep);
    const row = { ...f, nombre: f.nombre.trim(), rodillos: f.tipo === 'impresion' ? rodillos : [], id: f.id || f.tipo.slice(0, 3) + Date.now().toString(36) };
    if (await run(db.from('maquinas').upsert(row), 'Máquina guardada')) onClose();
  }
  return (
    <Modal title={m ? m.nombre : 'Nueva máquina'} onClose={onClose} foot={<><button className="btn" onClick={onClose}>Cancelar</button><button className="btn primary" disabled={!isDueno} onClick={save}>Guardar</button></>}>
      <div className="fg">
        <TxtF l="Nombre" v={f.nombre} on={(v) => p({ nombre: v })} /><TxtF l="Marca" v={f.marca} on={(v) => p({ marca: v })} />
        <SelF l="Área" v={f.tipo} on={(v) => p({ tipo: v as Tipo })} opts={Object.entries(AREAS)} disabled={!!m} /><SelF l="Estado" v={f.estado} on={(v) => p({ estado: v })} opts={['Activa', 'En camino', 'Fuera de servicio']} />
        <NumF l="Ancho máx. (cm)" v={f.ancho_max} on={(v) => p({ ancho_max: v })} /><NumF l="kg/h normal" v={f.kgh} on={(v) => p({ kgh: v })} />
      </div>
      {f.tipo === 'bolseo' && <fieldset style={{ marginTop: 12 }}><legend>Bolseo</legend>
        <div className="fg"><NumF l="Carriles" v={f.carriles} on={(v) => p({ carriles: v })} /><NumF l="Carriles máx." v={f.carriles_max} on={(v) => p({ carriles_max: v })} /><NumF l="Golpes/min normales" v={f.golpes} on={(v) => p({ golpes: v })} /></div>
        <div className="row" style={{ marginTop: 8 }}>{['fondo', 'lateral', 'camiseta', 'pouch'].map((s) => <ChkF key={s} l={'Sello ' + s} v={f.sellos.includes(s)} on={(on) => p({ sellos: tog(f.sellos, s, on) })} />)}<ChkF l="Sin fotocelda" v={f.sin_fotocelda} on={(v) => p({ sin_fotocelda: v })} /></div></fieldset>}
      {f.tipo === 'extrusion' && <fieldset style={{ marginTop: 12 }}><legend>Extrusión</legend><div className="row">{['baja', 'alta'].map((s) => <ChkF key={s} l={`${s === 'baja' ? 'Baja' : 'Alta'} densidad`} v={f.densidades.includes(s)} on={(on) => p({ densidades: tog(f.densidades, s, on) })} />)}</div></fieldset>}
      {f.tipo === 'impresion' && <fieldset style={{ marginTop: 12 }}><legend>Impresión</legend>
        <div className="fg"><NumF l="Tintas" v={f.tintas} on={(v) => p({ tintas: v })} /><NumF l="Impresión máx. (cm)" v={f.imp_max} on={(v) => p({ imp_max: v })} /><NumF l="Material máx. (cm)" v={f.mat_max} on={(v) => p({ mat_max: v })} />
          <SelF l="Caras" v={String(f.caras ?? 2)} on={(v) => p({ caras: Number(v) })} opts={[['1', '1 lado'], ['2', 'Frente y vuelta']]} /></div>
        <div style={{ marginTop: 8 }}><Fld l="Rodillos (repetición × cantidad)"><input value={rod} placeholder="30x4, 35x4, 40x4" onChange={(e) => setRod(e.target.value)} /></Fld></div></fieldset>}
      <div style={{ marginTop: 12 }}><AreaF l="Notas" v={f.notas} on={(v) => p({ notas: v })} /></div>
    </Modal>
  );
}

function CfgForm({ onClose }: { onClose: () => void }) {
  const { cfg, db, run, toast, isDueno } = useData();
  const [c, setC] = useState<Cfg>({ ...cfg });
  const p = (k: Partial<Cfg>) => setC((s) => ({ ...s, ...k }));
  async function save() {
    if (!c.horasProd || c.horasProd < 1 || c.horasProd > 12) return toast('Las horas productivas van de 1 a 12.', true);
    if (!c.umbralBajo || c.umbralBajo > 100 || !c.ventanaDias) return toast('Revisa el umbral y la ventana de días.', true);
    if (c.umbralOk < c.umbralBajo) return toast('El verde debe empezar en un % igual o mayor al de amonestación.', true);
    if (await run(db.from('config').upsert({ id: 1, data: c }), 'Parámetros guardados')) onClose();
  }
  return (
    <Modal title="Parámetros y reglas" onClose={onClose} foot={<><button className="btn" onClick={onClose}>Cancelar</button><button className="btn primary" disabled={!isDueno} onClick={save}>Guardar</button></>}>
      <fieldset><legend>Turnos y meta</legend>
        <div className="fg"><NumF l="Horas productivas por turno" v={c.horasProd} on={(v) => p({ horasProd: v ?? 10 })} /><NumF l="Hora en que inicia el turno 1" v={c.turno1Inicio} on={(v) => p({ turno1Inicio: v ?? 7 })} /><NumF l="Margen por kg (MXN, opcional)" v={c.margenKg} on={(v) => p({ margenKg: v })} /></div>
        <p className="mut" style={{ margin: '10px 0 6px' }}>Paros que se descuentan de la meta del turno (no es culpa del operador):</p>
        <div className="row">{CAUSAS.map((x) => <ChkF key={x} l={x} v={c.excusadas.includes(x)} on={(on) => p({ excusadas: on ? [...c.excusadas, x] : c.excusadas.filter((y) => y !== x) })} />)}</div></fieldset>
      <fieldset><legend>Reglas de amonestación</legend>
        <div className="fg"><NumF l="Amonestación directa si el turno queda abajo de (%)" v={c.umbralBajo} on={(v) => p({ umbralBajo: v ?? 75 })} /><NumF l="Verde (todo bien) desde (%)" v={c.umbralOk} on={(v) => p({ umbralOk: v ?? 85 })} /><NumF l="Turnos amarillos para avisar 'presionar'" v={c.nAviso} on={(v) => p({ nAviso: v ?? 3 })} /><NumF l="Reconocer arriba de (%)" v={c.umbralRec} on={(v) => p({ umbralRec: v ?? 105 })} /><NumF l="Ventana de análisis (días)" v={c.ventanaDias} on={(v) => p({ ventanaDias: v ?? 30 })} />
          <NumF l="Amonestación escrita desde la sanción No." v={c.nEscrita} on={(v) => p({ nEscrita: v ?? 3 })} /><NumF l="Acta administrativa desde la sanción No." v={c.nActa} on={(v) => p({ nActa: v ?? 5 })} /><NumF l="Turnos buenos para reconocer" v={c.nReconoc} on={(v) => p({ nReconoc: v ?? 5 })} /></div></fieldset>
      {!isDueno && <p className="mut">Solo el dueño puede cambiar los parámetros.</p>}
    </Modal>
  );
}
