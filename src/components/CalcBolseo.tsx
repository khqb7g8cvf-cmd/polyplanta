'use client';
import { useState } from 'react';
import { useData } from '@/lib/data';
import { bolseoCalc } from '@/lib/calc';
import { fmt } from '@/lib/format';
import { Modal, NumF, SelF, Tile } from '@/components/ui';

/** Calculadora de bolseo: medida + calibre + golpes → kg/millar, bolsas/min, kg/h y producción por turno. */
export default function CalcBolseo({ onClose }: { onClose: () => void }) {
  const { cfg, maqs } = useData();
  const bols = maqs('bolseo');
  const [f, setF] = useState({ maq: '', ancho: null as number | null, largo: null as number | null, calibre: null as number | null, densidad: 'baja', golpes: null as number | null, carriles: 1 as number | null, millares: null as number | null, kilos: null as number | null });
  const p = (x: Partial<typeof f>) => setF((a) => ({ ...a, ...x }));
  const pick = (id: string) => { const m = bols.find((x) => x.id === id); p({ maq: id, golpes: m?.golpes ?? f.golpes, carriles: m?.carriles ?? f.carriles }); };
  const horas = cfg.horasProd || 10;
  const r = bolseoCalc({ ancho: f.ancho, largo: f.largo, calibre: f.calibre, densidad: f.densidad, golpes: f.golpes, carriles: f.carriles, horas });
  const pedMil = r ? (f.millares ?? (f.kilos ? f.kilos / r.kgMillar : null)) : null;
  const pedKg = r ? (f.kilos ?? (f.millares ? f.millares * r.kgMillar : null)) : null;
  const pedH = r && pedMil ? pedMil / r.millaresH : null;
  return (
    <Modal title="Calculadora de bolseo" onClose={onClose} foot={<button className="btn primary" onClick={onClose}>Cerrar</button>}>
      <p className="mut" style={{ margin: '0 0 12px' }}>Pon la medida de la bolsa, el calibre y los golpes por minuto, y te saca cuánto produce la máquina. Es producción teórica al 100% (sin paros ni mermas).</p>
      <div className="fg">
        <SelF l="Bolseadora (opcional, trae sus golpes y carriles)" v={f.maq} on={pick} opts={[['', '— ninguna —'], ...bols.map((m): [string, string] => [m.id, m.nombre])]} />
        <NumF l="Ancho bolsa (cm)" v={f.ancho} on={(v) => p({ ancho: v })} />
        <NumF l="Largo bolsa (cm)" v={f.largo} on={(v) => p({ largo: v })} />
        <NumF l="Calibre" v={f.calibre} on={(v) => p({ calibre: v })} />
        <SelF l="Densidad" v={f.densidad} on={(v) => p({ densidad: v })} opts={[['baja', 'Baja (0.92)'], ['alta', 'Alta (0.95)']]} />
        <NumF l="Golpes por minuto" v={f.golpes} on={(v) => p({ golpes: v })} />
        <NumF l="Carriles" v={f.carriles} on={(v) => p({ carriles: v })} />
      </div>
      {r ? (
        <>
          <div className="tiles" style={{ marginTop: 14 }}>
            <Tile l="Peso del millar" v={fmt(r.kgMillar, 1) + ' kg'} e={`${fmt(r.gBolsa, 1)} g por bolsa`} />
            <Tile l="Velocidad" v={fmt(r.bolsasMin, 0) + ' bolsas/min'} e={`${fmt(r.millaresH, 2)} millares por hora`} />
            <Tile l="Producción por hora" v={fmt(r.kgH, 0) + ' kg/h'} />
            <Tile l={`Por turno (${horas} h)`} v={fmt(r.kgTurno, 0) + ' kg'} e={`${fmt(r.millaresTurno, 1)} millares`} />
          </div>
          <fieldset style={{ marginTop: 14 }}>
            <legend>¿Cuánto tarda un pedido? (opcional)</legend>
            <div className="fg">
              <NumF l="Millares del pedido" v={f.millares} on={(v) => p({ millares: v, kilos: null })} />
              <NumF l="o kilos del pedido" v={f.kilos} on={(v) => p({ kilos: v, millares: null })} />
            </div>
            {pedH != null && pedMil != null && pedKg != null && <div className="calc" style={{ marginTop: 10 }}><span><b>{fmt(pedMil, 1)}</b> millares = <b>{fmt(pedKg)} kg</b></span><span>Tarda <b>{fmt(pedH, 1)} h</b> ({fmt(pedH / horas, 1)} turnos)</span></div>}
          </fieldset>
        </>
      ) : <p className="mut" style={{ marginTop: 14 }}>Captura ancho, largo, calibre y golpes para calcular.</p>}
    </Modal>
  );
}
