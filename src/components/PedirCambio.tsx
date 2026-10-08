'use client';
import { useState } from 'react';
import { useData } from '@/lib/data';
import { AreaF, Modal } from '@/components/ui';

export interface RefCambio { tabla: string; registro_id?: string | null; reporte_id?: string | null; maquina_id?: string | null; resumen: string }

/** El encargado explica qué quiere cambiar y por qué; le llega al dueño. */
export default function PedirCambio({ r, onClose }: { r: RefCambio; onClose: () => void }) {
  const { db, toast, refresh } = useData();
  const [motivo, setMotivo] = useState(''), [busy, setBusy] = useState(false);
  async function enviar() {
    if (motivo.trim().length < 3) return toast('Explica qué hay que cambiar.', true);
    setBusy(true);
    const { error } = await db.from('solicitudes_cambio').insert({ tabla: r.tabla, registro_id: r.registro_id ?? null, reporte_id: r.reporte_id ?? null, maquina_id: r.maquina_id ?? null, resumen: r.resumen, motivo: motivo.trim() });
    setBusy(false);
    if (error) return toast(error.message, true);
    toast('Solicitud enviada al dueño'); refresh(); onClose();
  }
  return (
    <Modal title="Pedir un cambio" onClose={onClose} foot={<><button className="btn" onClick={onClose}>Cancelar</button><button className="btn primary" disabled={busy} onClick={enviar}>Enviar al dueño</button></>}>
      <p style={{ margin: '0 0 10px' }}><b>{r.resumen}</b></p>
      <AreaF l="¿Qué hay que cambiar y por qué?" v={motivo} on={setMotivo} />
      <p className="mut" style={{ marginTop: 8 }}>Al dueño le llega la solicitud. Si la autoriza, vas a poder corregirlo.</p>
    </Modal>
  );
}
