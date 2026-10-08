'use client';
import { useState } from 'react';
import { useData } from '@/lib/data';
import { Empty, Modal, Pill, Scroll, SelF, TxtF } from '@/components/ui';
import type { Profile, Rol } from '@/lib/types';

const ROLES: [Rol, string][] = [['dueno', 'Dueño'], ['encargado', 'Encargado'], ['mecanico', 'Mecánico'], ['lectura', 'Solo lectura']];

export default function UsuariosPage() {
  const { isDueno, loaded } = useData();
  if (loaded && !isDueno) return <Empty>Solo el dueño administra usuarios.</Empty>;
  return <Usuarios />;
}

function Usuarios() {
  const { S, me, run, db, toast } = useData();
  const [nuevo, setNuevo] = useState(false), [pw, setPw] = useState<Profile | null>(null);
  return (
    <section className="sec">
      <h2>Usuarios y roles <button className="btn primary" onClick={() => setNuevo(true)}>+ Nuevo usuario</button></h2>
      <p className="mut" style={{ margin: '0 0 10px', maxWidth: '75ch' }}>Tú creas cada cuenta (usuario y contraseña) y se la das a la persona. Dueño: todo y es el único que ve la bitácora. Encargado: captura reportes y paros, y en inventario solo entradas y salidas (sin conteos, ajustes, anulaciones ni materiales). Mecánico: solo mantenimiento. Solo lectura: ve todo, no captura. Todo lo que cada quien captura queda firmado con su usuario.</p>
      <Scroll><table className="t" style={{ minWidth: 560 }}><thead><tr><th>Usuario</th><th>Nombre</th><th>Rol</th><th>Estado</th><th></th></tr></thead><tbody>
        {S.usuarios.map((u: Profile) => (
          <tr key={u.id}><td className="mono"><b>{u.usuario || '—'}</b>{u.id === me?.id && <> <Pill c="ink">tú</Pill></>}</td><td>{u.nombre || '(sin nombre)'}</td>
            <td><select className="inp" style={{ width: 'auto' }} value={u.rol} disabled={u.id === me?.id} onChange={(e) => run(db.from('profiles').update({ rol: e.target.value }).eq('id', u.id), 'Rol actualizado')}>{ROLES.map(([k, t]) => <option key={k} value={k}>{t}</option>)}</select></td>
            <td>{u.activo ? <Pill c="good">Activo</Pill> : <Pill c="bad">Desactivado</Pill>}</td>
            <td><div className="row" style={{ flexWrap: 'nowrap' }}>
              <button className="btn sm" onClick={() => setPw(u)}>Contraseña</button>
              {u.id !== me?.id && <button className="btn sm" onClick={() => run(db.from('profiles').update({ activo: !u.activo }).eq('id', u.id), u.activo ? 'Usuario desactivado' : 'Usuario activado')}>{u.activo ? 'Desactivar' : 'Activar'}</button>}
            </div></td></tr>))}
      </tbody></table></Scroll>
      <p className="mut" style={{ marginTop: 8 }}>Desactivar a alguien le corta el acceso al instante pero conserva todo su historial.</p>
      {nuevo && <NuevoUsuario onClose={() => setNuevo(false)} />}
      {pw && <CambiarPw u={pw} onClose={() => setPw(null)} toast={toast} />}
    </section>
  );
}

function NuevoUsuario({ onClose }: { onClose: () => void }) {
  const { db, toast, refresh } = useData();
  const [f, setF] = useState({ usuario: '', nombre: '', rol: 'encargado', password: '' }), [busy, setBusy] = useState(false);
  async function save() {
    const u = f.usuario.trim().toLowerCase();
    if (!/^[a-z0-9._-]{3,30}$/.test(u)) return toast('Usuario: 3 a 30 caracteres, solo letras minúsculas, números, punto, guion.', true);
    if (!f.nombre.trim()) return toast('Falta el nombre.', true);
    if (f.password.length < 6) return toast('La contraseña debe tener al menos 6 caracteres.', true);
    setBusy(true);
    const { error } = await db.rpc('admin_crear_usuario', { p_usuario: u, p_password: f.password, p_nombre: f.nombre.trim(), p_rol: f.rol });
    setBusy(false);
    if (error) return toast(error.message, true);
    toast(`Usuario ${u} creado`); refresh(); onClose();
  }
  return (
    <Modal title="Nuevo usuario" onClose={onClose} foot={<><button className="btn" onClick={onClose}>Cancelar</button><button className="btn primary" disabled={busy} onClick={save}>Crear</button></>}>
      <div className="fg"><TxtF l="Usuario (para entrar)" v={f.usuario} on={(v) => setF({ ...f, usuario: v })} autoCapitalize="none" autoCorrect="off" /><TxtF l="Nombre completo" v={f.nombre} on={(v) => setF({ ...f, nombre: v })} />
        <SelF l="Rol" v={f.rol} on={(v) => setF({ ...f, rol: v })} opts={ROLES.map(([k, t]) => [k, t] as [string, string])} /><TxtF l="Contraseña inicial" v={f.password} on={(v) => setF({ ...f, password: v })} autoComplete="off" /></div>
      <p className="mut" style={{ marginTop: 10 }}>Anótale el usuario y la contraseña a la persona. Tú puedes cambiarle la contraseña cuando quieras.</p>
    </Modal>
  );
}

function CambiarPw({ u, onClose, toast }: { u: Profile; onClose: () => void; toast: (m: string, bad?: boolean) => void }) {
  const { db } = useData();
  const [p, setP] = useState(''), [busy, setBusy] = useState(false);
  async function save() {
    if (p.length < 6) return toast('Mínimo 6 caracteres.', true);
    setBusy(true);
    const { error } = await db.rpc('admin_cambiar_password', { p_user: u.id, p_password: p });
    setBusy(false);
    if (error) return toast(error.message, true);
    toast('Contraseña actualizada'); onClose();
  }
  return (
    <Modal title={`Contraseña de ${u.usuario || u.nombre}`} onClose={onClose} foot={<><button className="btn" onClick={onClose}>Cancelar</button><button className="btn primary" disabled={busy} onClick={save}>Guardar</button></>}>
      <TxtF l="Nueva contraseña" v={p} on={setP} autoComplete="off" />
    </Modal>
  );
}

