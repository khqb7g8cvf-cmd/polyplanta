'use client';
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import type { SupabaseClient } from '@supabase/supabase-js';
import { supabaseBrowser } from './supabase/client';
import { buildLineas, buildOT, DEF_CFG, lastDone } from './calc';
import { daysAgo } from './format';
import type { Amon, Cfg, LineaCalc, Maquina, Material, Mtto, Movimiento, Orden, OpTurno, Paro, Persona, Profile, Reporte, SolicitudCambio } from './types';

export interface Store {
  maquinas: Maquina[]; personas: Persona[]; ordenes: Orden[]; reportes: Reporte[]; paros: Paro[]; mtto: Mtto[];
  amon: Amon[]; materiales: Material[]; movs: Movimiento[]; existencias: Record<string, number>; existUb: Record<string, { silo: number; sacos: number }>; usuarios: Profile[]; solicitudes: SolicitudCambio[];
}
const EMPTY: Store = { maquinas: [], personas: [], ordenes: [], reportes: [], paros: [], mtto: [], amon: [], materiales: [], movs: [], existencias: {}, existUb: {}, usuarios: [], solicitudes: [] };

interface Ctx {
  db: SupabaseClient; S: Store; cfg: Cfg; me: Profile | null; loaded: boolean; live: boolean;
  L: LineaCalc[]; OT: OpTurno[];
  canProd: boolean; canMtto: boolean; isDueno: boolean;
  quien: (id?: string | null) => string; maqById: (id?: string | null) => Maquina | undefined; maqs: (tipo?: string) => Maquina[]; ordById: (id?: string | null) => Orden | undefined;
  refresh: () => void;
  /** Ejecuta una operación de Supabase; muestra el error si falla. */
  run: (p: PromiseLike<{ error: { message: string } | null }>, okMsg?: string) => Promise<boolean>;
  toast: (msg: string, bad?: boolean) => void; toastMsg: { msg: string; bad: boolean } | null;
  turno: { fecha: string; turno: 1 | 2 }; setTurno: (t: { fecha: string; turno: 1 | 2 }) => void;
  now: number;
}
const C = createContext<Ctx | null>(null);
export const useData = () => {
  const c = useContext(C);
  if (!c) throw new Error('useData fuera de DataProvider');
  return c;
};

export function DataProvider({ children }: { children: ReactNode }) {
  const db = useMemo(() => supabaseBrowser(), []);
  const [S, setS] = useState<Store>(EMPTY);
  const [cfg, setCfg] = useState<Cfg>(DEF_CFG);
  const [me, setMe] = useState<Profile | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [live, setLive] = useState(false);
  const [toastMsg, setToastMsg] = useState<{ msg: string; bad: boolean } | null>(null);
  const [turno, setTurno] = useState<{ fecha: string; turno: 1 | 2 }>(() => lastDone(DEF_CFG));
  const [now, setNow] = useState(() => Date.now());
  const tt = useRef<ReturnType<typeof setTimeout> | null>(null);

  const toast = useCallback((msg: string, bad = false) => {
    setToastMsg({ msg, bad });
    if (tt.current) clearTimeout(tt.current);
    tt.current = setTimeout(() => setToastMsg(null), 3200);
  }, []);

  const load = useCallback(async () => {
    const cut = daysAgo(92), cutTs = new Date(Date.now() - 92 * 864e5).toISOString();
    const { data: u } = await db.auth.getUser();
    const uid = u.user?.id;
    const q = await Promise.all([
      db.from('maquinas').select('*').order('orden'),
      db.from('personas').select('*').eq('activo', true).order('nombre'),
      db.from('config').select('data').eq('id', 1).maybeSingle(),
      db.from('ordenes').select('*').order('fecha_entrega', { nullsFirst: false }),
      db.from('reportes').select('*, reporte_lineas(*)').gte('fecha', cut),
      db.from('paros').select('*').or(`fin.is.null,inicio.gte.${cutTs}`),
      db.from('mtto').select('*'),
      db.from('amonestaciones').select('*').order('fecha', { ascending: false }),
      db.from('materiales').select('*').order('nombre'),
      db.from('inv_movimientos').select('*').order('fecha', { ascending: false }).order('created_at', { ascending: false }).limit(5000),
      db.from('inv_existencias').select('*'),
      uid ? db.from('profiles').select('*').eq('id', uid).maybeSingle() : Promise.resolve({ data: null, error: null }),
      db.from('profiles').select('*').order('created_at'),
      db.from('inv_existencias_ub').select('*'),
      db.from('inv_costos').select('*'),
      db.from('solicitudes_cambio').select('*').order('solicitada_at', { ascending: false }).limit(300),
    ]);
    const err = q.find((r) => r.error)?.error;
    if (err) { console.error(err); setLive(false); toast('No se pudo leer la base de datos: ' + err.message, true); setLoaded(true); return; }
    const ex: Record<string, number> = {};
    for (const r of (q[10].data as { material_id: string; kg: number }[]) || []) ex[r.material_id] = Number(r.kg);
    const ub: Store['existUb'] = {};
    for (const r of (q[13].data as { material_id: string; ubicacion: 'silo' | 'sacos'; kg: number }[]) || []) (ub[r.material_id] ||= { silo: 0, sacos: 0 })[r.ubicacion] = Number(r.kg);
    const costos = new Map(((q[14].data as { id: string; costo_kg: number }[]) || []).map((r) => [r.id, Number(r.costo_kg)]));
    const c = { ...DEF_CFG, ...((q[2].data?.data as Partial<Cfg>) || {}) };
    setCfg(c);
    setS({
      maquinas: (q[0].data as Maquina[]) || [], personas: (q[1].data as Persona[]) || [], ordenes: (q[3].data as Orden[]) || [],
      reportes: (q[4].data as Reporte[]) || [], paros: (q[5].data as Paro[]) || [], mtto: (q[6].data as Mtto[]) || [], amon: (q[7].data as Amon[]) || [],
      materiales: (q[8].data as Material[]) || [], movs: ((q[9].data as Movimiento[]) || []).map((m) => ({ ...m, costo_kg: costos.get(m.id) ?? null })), existencias: ex, existUb: ub, usuarios: (q[12].data as Profile[]) || [], solicitudes: (q[15].data as SolicitudCambio[]) || [],
    });
    setMe((q[11].data as Profile) || null);
    setLoaded(true); setLive(true);
  }, [db, toast]);

  // carga inicial + realtime con refetch (debounce) en cualquier cambio
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const refresh = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => { void load(); }, 250);
  }, [load]);
  useEffect(() => {
    void load();
    const ch = db.channel('planta');
    for (const t of ['maquinas', 'personas', 'config', 'ordenes', 'reportes', 'reporte_lineas', 'paros', 'mtto', 'amonestaciones', 'materiales', 'inv_movimientos', 'inv_costos', 'solicitudes_cambio', 'profiles'])
      ch.on('postgres_changes', { event: '*', schema: 'public', table: t }, refresh);
    ch.subscribe((s) => { if (s === 'CHANNEL_ERROR' || s === 'TIMED_OUT') setLive(false); });
    const iv = setInterval(() => setNow(Date.now()), 30000);
    const vis = () => { if (document.visibilityState === 'visible') void load(); };
    document.addEventListener('visibilitychange', vis);
    return () => { void db.removeChannel(ch); clearInterval(iv); document.removeEventListener('visibilitychange', vis); };
  }, [db, load, refresh]);


  const L = useMemo(() => buildLineas(S.reportes, S.maquinas, S.paros, cfg, now), [S.reportes, S.maquinas, S.paros, cfg, now]);
  const OT = useMemo(() => buildOT(L), [L]);
  const rol = me?.rol;
  const run: Ctx['run'] = useCallback(async (p, okMsg) => {
    const { error } = await p;
    if (error) { console.error(error); toast(error.message, true); return false; }
    if (okMsg) toast(okMsg);
    refresh();
    return true;
  }, [toast, refresh]);

  const value: Ctx = {
    db, S, cfg, me, loaded, live, L, OT, now, turno, setTurno, run, toast, toastMsg, refresh,
    canProd: rol === 'dueno' || rol === 'encargado', canMtto: rol === 'dueno' || rol === 'encargado' || rol === 'mecanico', isDueno: rol === 'dueno',
    quien: (id) => { if (!id) return '—'; const u = S.usuarios.find((x) => x.id === id); return u ? (u.usuario || u.nombre) : 'desconocido'; },
    maqById: (id) => S.maquinas.find((m) => m.id === id), maqs: (t) => S.maquinas.filter((m) => !t || m.tipo === t),
    ordById: (id) => S.ordenes.find((o) => o.id === id),
  };
  return <C.Provider value={value}>{children}</C.Provider>;
}
