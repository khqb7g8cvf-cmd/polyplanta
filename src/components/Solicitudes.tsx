'use client';
import { useData } from '@/lib/data';
import { dmy, hhmm } from '@/lib/format';
import { Pill, Scroll } from '@/components/ui';

/** Bandeja del dueño: solicitudes de cambio de los encargados. */
export default function Solicitudes() {
  const { S, db, me, run, quien, now } = useData();
  const pend = S.solicitudes.filter((s) => s.estado === 'pendiente');
  if (!pend.length) return null;
  const hace = (iso: string) => { const m = Math.max(0, Math.round((now - Date.parse(iso)) / 60000)); return m < 60 ? `hace ${m} min` : m < 1440 ? `hace ${Math.round(m / 60)} h` : `${dmy(iso)} ${hhmm(iso)}`; };
  const resolver = (id: string, estado: 'aprobada' | 'rechazada' | 'atendida', msg: string) =>
    run(db.from('solicitudes_cambio').update({ estado, resuelta_por: me?.id ?? null, resuelta_at: new Date().toISOString(), vence_at: estado === 'aprobada' ? new Date(Date.now() + 3600e3).toISOString() : null }).eq('id', id), msg);
  return (
    <section className="sec">
      <h2>Solicitudes de cambio <Pill c="warn">{pend.length}</Pill></h2>
      <Scroll><table className="t"><thead><tr><th>Quién</th><th>Qué quiere cambiar</th><th>Motivo</th><th>Cuándo</th><th></th></tr></thead><tbody>
        {pend.map((s) => (
          <tr key={s.id}>
            <td><b>{quien(s.solicitada_por)}</b></td><td>{s.resumen}</td><td>{s.motivo}</td><td className="mono">{hace(s.solicitada_at)}</td>
            <td style={{ whiteSpace: 'nowrap' }}>
              {s.tabla === 'reporte_lineas'
                ? <button className="btn sm primary" title="Le abre 1 hora para que corrija ese reporte" onClick={() => resolver(s.id, 'aprobada', 'Autorizado por 1 hora')}>Autorizar 1 h</button>
                : <button className="btn sm primary" title="Tú lo corriges o lo borras desde su pestaña; luego márcala" onClick={() => resolver(s.id, 'atendida', 'Marcada como atendida')}>Ya lo atendí</button>}
              {' '}<button className="btn sm danger" onClick={() => resolver(s.id, 'rechazada', 'Solicitud rechazada')}>Rechazar</button>
            </td>
          </tr>))}
      </tbody></table></Scroll>
    </section>
  );
}
