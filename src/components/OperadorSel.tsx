'use client';
import { useState } from 'react';
import { useData } from '@/lib/data';
import { Fld } from '@/components/ui';

const NUEVO = '__nuevo__';

/** Lista desplegable de operadores (tabla personas). Los del área de la máquina salen primero; "Otro / nuevo" permite escribir uno que aún no existe. */
export default function OperadorSel({ l, v, on, area, opcional }: { l: string; v: string; on: (v: string) => void; area?: string; opcional?: boolean }) {
  const { S } = useData();
  const ops = S.personas.filter((p) => p.rol === 'operador' && p.activo);
  const ord = [...ops.filter((p) => p.area === area), ...ops.filter((p) => p.area !== area)].map((p) => p.nombre);
  const existe = (x: string) => ord.some((n) => n.toLowerCase() === x.trim().toLowerCase());
  const [nuevo, setNuevo] = useState(() => !!v.trim() && !existe(v));
  return (
    <Fld l={l}>
      <select value={nuevo ? NUEVO : v} onChange={(e) => { if (e.target.value === NUEVO) { setNuevo(true); on(''); } else { setNuevo(false); on(e.target.value); } }}>
        <option value="">{opcional ? '— sin especificar —' : '— elige operador —'}</option>
        {ord.map((n) => <option key={n} value={n}>{n}</option>)}
        <option value={NUEVO}>➕ Otro / nuevo…</option>
      </select>
      {nuevo && <input autoFocus placeholder="Nombre completo del operador nuevo" autoComplete="off" value={v} onChange={(e) => on(e.target.value)} style={{ marginTop: 6 }} />}
    </Fld>
  );
}
