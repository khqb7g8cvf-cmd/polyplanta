'use client';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useData } from '@/lib/data';
import { supabaseBrowser } from '@/lib/supabase/client';
import { fmt } from '@/lib/format';
import { resumenMateriales } from '@/lib/inv';

const TABS: [string, string][] = [['/', 'Hoy'], ['/turno', 'Turno'], ['/operadores', 'Operadores'], ['/paros', 'Paros'], ['/mantenimiento', 'Mantenimiento'], ['/inventario', 'Inventario'], ['/analisis', 'Análisis'], ['/ordenes', 'Órdenes'], ['/maquinas', 'Máquinas']];
const ROL: Record<string, string> = { dueno: 'Dueño', encargado: 'Encargado', mecanico: 'Mecánico', lectura: 'Solo lectura' };

export default function AppShell({ children }: { children: React.ReactNode }) {
  const { live, loaded, me, toastMsg, S, now } = useData();
  const path = usePathname(), r = useRouter();
  const bajos = resumenMateriales(S.materiales, S.existencias, S.movs, now).filter((x) => x.bajo).length;
  return (
    <div className="wrap">
      <header className="hdr">
        <div className="hrow">
          <div className="brand">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logo-white.png" alt="" />
            <div><b>POLYAMSA</b><small>Control de planta</small></div>
          </div>
          <div className="who">
            <span className="live"><span className={`dot ${live ? 'on' : ''}`} /><span>{live ? 'En vivo' : 'Sin conexión'}</span></span>
            {me && <span>{me.nombre || 'Usuario'} · {ROL[me.rol]}</span>}
            <button onClick={async () => { await supabaseBrowser().auth.signOut(); r.replace('/login'); r.refresh(); }}>Salir</button>
          </div>
        </div>
        <nav className="tabs" role="tablist">
          {TABS.map(([h, t]) => (
            <Link key={h} href={h} role="tab" aria-selected={h === '/' ? path === '/' : path.startsWith(h)} style={{ textDecoration: 'none' }}>
              <button tabIndex={-1}>{t}{h === '/inventario' && bajos > 0 ? ` · ${fmt(bajos)}` : ''}</button>
            </Link>
          ))}
        </nav>
      </header>
      {loaded && me?.rol === 'lectura' && <div className="banner" style={{ marginTop: 12 }}>Tu cuenta es de solo lectura: puedes ver todo, pero no capturar. Pide al dueño que te asigne un rol en Máquinas ▸ Usuarios.</div>}
      <main id="view">{loaded ? children : <div className="empty">Cargando planta…</div>}</main>
      {toastMsg && <div id="toast" className={toastMsg.bad ? 'bad' : ''} role="status">{toastMsg.msg}</div>}
    </div>
  );
}
