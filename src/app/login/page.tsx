'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabaseBrowser } from '@/lib/supabase/client';
import { emailDe } from '@/lib/usuario';

export default function Login() {
  const r = useRouter();
  const [usuario, setUsuario] = useState(''), [pass, setPass] = useState(''), [nombre, setNombre] = useState(''), [pass2, setPass2] = useState('');
  const [setup, setSetup] = useState<boolean | null>(null), [err, setErr] = useState(''), [busy, setBusy] = useState(false);

  useEffect(() => {
    supabaseBrowser().rpc('hay_usuarios').then(({ data }) => setSetup(data === false));
  }, []);

  async function entrar(u: string, p: string) {
    const db = supabaseBrowser();
    const { error } = await db.auth.signInWithPassword({ email: emailDe(u), password: p });
    if (error) { setErr(error.message === 'Invalid login credentials' ? 'Usuario o contraseña incorrectos.' : error.message); return false; }
    await db.rpc('registrar_acceso');
    r.replace('/'); r.refresh();
    return true;
  }

  async function go(e: React.FormEvent) {
    e.preventDefault(); setErr(''); setBusy(true);
    if (setup) {
      if (pass !== pass2) { setErr('Las contraseñas no coinciden.'); setBusy(false); return; }
      const { error } = await supabaseBrowser().rpc('crear_primer_dueno', { p_usuario: usuario, p_password: pass, p_nombre: nombre });
      if (error) { setErr(error.message); setBusy(false); return; }
    }
    await entrar(usuario, pass);
    setBusy(false);
  }

  return (
    <div className="login">
      <form onSubmit={go}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/logo-white.png" alt="Polyamsa" />
        <h1>{setup ? 'Configurar la planta' : 'Control de planta'}</h1>
        {setup && <p className="mut" style={{ margin: 0 }}>Crea la cuenta del dueño. Después podrás dar de alta a los demás desde la pestaña Usuarios.</p>}
        {setup && <label className="f"><span>Tu nombre</span><input value={nombre} onChange={(e) => setNombre(e.target.value)} required /></label>}
        <label className="f"><span>Usuario</span><input autoCapitalize="none" autoCorrect="off" autoComplete="username" value={usuario} onChange={(e) => setUsuario(e.target.value)} required /></label>
        <label className="f"><span>Contraseña</span><input type="password" autoComplete={setup ? 'new-password' : 'current-password'} minLength={6} value={pass} onChange={(e) => setPass(e.target.value)} required /></label>
        {setup && <label className="f"><span>Repite la contraseña</span><input type="password" autoComplete="new-password" minLength={6} value={pass2} onChange={(e) => setPass2(e.target.value)} required /></label>}
        {err && <div className="err" role="alert">{err}</div>}
        <button className="btn primary" disabled={busy || setup === null}>{setup ? 'Crear cuenta del dueño' : 'Entrar'}</button>
        {!setup && <p className="mut" style={{ margin: 0 }}>¿No tienes usuario? Pídeselo al dueño.</p>}
      </form>
    </div>
  );
}
