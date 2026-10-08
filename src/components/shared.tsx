'use client';
import { useData } from '@/lib/data';
import { cls, pctTxt, sumL } from '@/lib/calc';
import { dmy, fmt, ymd } from '@/lib/format';
import type { Amon, LineaCalc, OpTurno, Paro } from '@/lib/types';
import { PctCell, Pill, Scroll } from './ui';

export const lineMed = (x: { ancho: number | null; largo: number | null; calibre: number | null; golpes: number | null }) =>
  [x.ancho ? fmt(x.ancho, 1) : '', x.largo ? '× ' + fmt(x.largo, 1) : '', x.calibre ? 'cal ' + x.calibre : '', x.golpes ? x.golpes + ' gpm' : ''].filter(Boolean).join(' ');
export const shiftName = (fecha: string, turno: number) => `${dmy(fecha)} · turno ${turno}`;
export const durH = (p: Paro, now = Date.now()) => ((p.fin ? Date.parse(p.fin) : now) - Date.parse(p.inicio)) / 36e5;
export const SUGC: Record<string, string> = { Verbal: 'warn', Escrita: 'bad', Acta: 'bad', Reconocimiento: 'good' };

/** " · ≈ $X" si el dueño configuró margen por kg. */
export function useMoney() {
  const { cfg, isDueno } = useData();
  return (kg: number) => (isDueno && cfg.margenKg && kg > 0 ? ` · ≈ $${fmt(kg * cfg.margenKg)} de margen` : '');
}

export function LinesTable({ arr }: { arr: LineaCalc[] }) {
  const { maqById, cfg, quien } = useData();
  return (
    <Scroll>
      <table className="t">
        <thead><tr><th>Máquina</th><th>Operador</th><th>Orden</th><th className="num">Debía</th><th className="num">Reportó</th><th className="num">Dif.</th><th>Cumplimiento</th><th>Capturó</th></tr></thead>
        <tbody>
          {arr.map((x) => (
            <tr key={x.id}>
              <td><b>{maqById(x.maquina_id)?.nombre || '?'}</b></td>
              <td>{x.operario || '—'}{x.justificada && <> <Pill c="ink">justificada</Pill></>}</td>
              <td>{x.cliente || '—'} <span className="mut">{lineMed(x)}</span></td>
              <td className="num">{x.exp ? fmt(x.exp) : '—'}</td>
              <td className="num">{fmt(x.kilos)}</td>
              <td className="num" style={x.exp && x.kilos < x.exp ? { color: 'var(--bad)' } : undefined}>{x.exp ? fmt(x.kilos - x.exp) : '—'}</td>
              <td><PctCell p={x.pct} c={cls(x.pct, cfg)} txt={pctTxt(x.pct)} /></td>
              <td className="mut">{quien(x.created_by)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </Scroll>
  );
}

export function Trend({ days }: { days: number }) {
  const { L, cfg } = useData();
  const T = Array.from({ length: days }, (_, k) => {
    const d = ymd(new Date(Date.now() - (days - 1 - k) * 864e5)), s = sumL(L.filter((x) => x.fecha === d));
    return { d, pct: s.pct };
  });
  if (!T.some((x) => x.pct != null)) return <div className="empty">La tendencia aparece cuando haya reportes de varios días.</div>;
  return (
    <div className="spark">
      {T.map((x) => {
        const h = x.pct == null ? 4 : Math.max(6, (Math.min(1.25, x.pct) / 1.25) * 100);
        return (
          <div className="sp" key={x.d} title={`${dmy(x.d)}: ${pctTxt(x.pct)}`}>
            <span className="sv mono">{x.pct == null ? '' : fmt(x.pct * 100)}</span>
            <i className={cls(x.pct, cfg) || 'none'} style={{ height: `${h}%` }} />
            <span className="sd">{x.d.slice(8)}</span>
          </div>
        );
      })}
      <div className="sline" style={{ bottom: 133 }} />
    </div>
  );
}

/** Texto de hechos para el acta, a partir de los turnos que motivan la sanción. */
export function evid(t: OpTurno, maqNombre: (id: string) => string | undefined) {
  return t.lines.map((x) =>
    `${dmy(t.fecha)}, turno ${t.turno}, ${maqNombre(x.maquina_id) || 'máquina'}${x.cliente ? ` (${x.cliente}${lineMed(x) ? ', ' + lineMed(x) : ''})` : ''}: se esperaban ${fmt(x.exp)} kg${x.excH > 0.05 ? ` (ya descontadas ${fmt(x.excH, 1)} h de paro)` : ''} y se reportaron ${fmt(x.kilos)} kg (${pctTxt(x.pct)}).`).join(' ');
}

export function actaText(a: Pick<Amon, 'tipo' | 'operario' | 'fecha' | 'evidencia' | 'nota'>) {
  const t = a.tipo === 'Reconocimiento' ? 'RECONOCIMIENTO' : a.tipo === 'Verbal' ? 'LLAMADA DE ATENCIÓN VERBAL (constancia)' : a.tipo === 'Escrita' ? 'AMONESTACIÓN ESCRITA' : 'ACTA ADMINISTRATIVA';
  return `POLYAMSA, S.A. de C.V.\n${t}\n\nFecha: ${dmy(a.fecha)}\nTrabajador: ${a.operario}\n\n${a.tipo === 'Reconocimiento' ? 'Motivo del reconocimiento' : 'Hechos'}:\n${a.evidencia || '—'}\n\n${a.nota ? 'Comentarios: ' + a.nota + '\n\n' : ''}${a.tipo === 'Reconocimiento' ? 'Se reconoce su desempeño y compromiso con la meta de producción.' : 'Se le exhorta a cumplir con la meta de producción establecida para su puesto. La reincidencia puede derivar en medidas disciplinarias de mayor nivel.'}\n\nFirma del trabajador: ______________________\nFirma del jefe: ______________________\nTestigo: ______________________`;
}
