'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabaseBrowser } from '@/lib/supabase/client';

export default function Login() {
  const r = useRouter();
  const [email, setEmail] = useState(''), [pass, setPass] = useState(''), [nombre, setNombre] = useState('');
  const [reg, setReg] = useState(false), [err, setErr] = useState(''), [info, setInfo] = useState(''), [busy, setBusy] = useState(false);

  async function go(e: React.FormEvent) {
    e.preventDefault(); setErr(''); setInfo(''); setBusy(true);
    const db = supabaseBrowser();
    if (reg) {
      const { data, error } = await db.auth.signUp({ email, password: pass, options: { data: { nombre } } });
      if (error) setErr(error.message);
      else if (!data.session) setInfo('Cuenta creada. Revisa tu correo para confirmarla y luego entra.');
      else { r.replace('/'); r.refresh(); }
    } else {
      const { error } = await db.auth.signInWithPassword({ email, password: pass });
      if (error) setErr(error.message === 'Invalid login credentials' ? 'Correo o contraseña incorrectos.' : error.message);
      else { r.replace('/'); r.refresh(); }
    }
    setBusy(false);
  }

  return (
    <div className="login">
      <form onSubmit={go}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/logo-white.png" alt="Polyamsa" />
        <h1>{reg ? 'Crear cuenta' : 'Control de planta'}</h1>
        {reg && <label className="f"><span>Nombre</span><input value={nombre} onChange={(e) => setNombre(e.target.value)} required /></label>}
        <label className="f"><span>Correo</span><input type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} required /></label>
        <label className="f"><span>Contraseña</span><input type="password" autoComplete={reg ? 'new-password' : 'current-password'} minLength={6} value={pass} onChange={(e) => setPass(e.target.value)} required /></label>
        {err && <div className="err" role="alert">{err}</div>}
        {info && <div className="mut">{info}</div>}
        <button className="btn primary" disabled={busy}>{reg ? 'Crear cuenta' : 'Entrar'}</button>
        <button type="button" className="btn sm" onClick={() => { setReg(!reg); setErr(''); }}>{reg ? 'Ya tengo cuenta' : 'Crear cuenta nueva'}</button>
        {reg && <p className="mut" style={{ margin: 0 }}>La primera cuenta que se crea es la del dueño. Las demás entran en modo lectura hasta que el dueño les asigne un rol.</p>}
      </form>
    </div>
  );
}
