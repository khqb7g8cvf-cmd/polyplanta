'use client';
import { useEffect, type ReactNode, type InputHTMLAttributes } from 'react';
import type { Cls } from '@/lib/calc';

export const Pill = ({ c = '', children }: { c?: string; children: ReactNode }) => <span className={`pill ${c}`}>{children}</span>;
export const Bar = ({ p, c, w }: { p: number; c?: string; w?: number }) => (
  <div className={`bar ${c || ''}`} style={w ? { width: w } : undefined}><i style={{ width: `${Math.max(0, Math.min(1, p)) * 100}%` }} /></div>
);
export const PctCell = ({ p, c, txt }: { p: number | null; c: Cls; txt: string }) =>
  p == null ? <span className="mut">sin teórico</span> : (
    <div className="row" style={{ flexWrap: 'nowrap', gap: 8 }}><Bar p={p} c={c} w={80} /><span className={`mono ${c === 'bad' ? 't-bad' : ''}`}>{txt}</span></div>
  );
export const Tile = ({ l, v, e, c = '', onClick }: { l: string; v: ReactNode; e?: ReactNode; c?: string; onClick?: () => void }) => (
  <div className={`tile ${c}`} onClick={onClick} style={onClick ? { cursor: 'pointer' } : undefined}><small>{l}</small><b>{v}</b><br /><em>{e}</em></div>
);
export const Empty = ({ children }: { children: ReactNode }) => <div className="empty">{children}</div>;
export const Scroll = ({ children }: { children: ReactNode }) => <div className="scroll">{children}</div>;

export function Modal({ title, onClose, children, foot }: { title: string; onClose: () => void; children: ReactNode; foot?: ReactNode }) {
  useEffect(() => {
    const k = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', k);
    return () => document.removeEventListener('keydown', k);
  }, [onClose]);
  return (
    <div>
      <div className="scrim" onClick={onClose} />
      <div className="sheet" role="dialog" aria-modal="true" aria-label={title}>
        <header><h2>{title}</h2><button className="x" onClick={onClose} aria-label="Cerrar">✕</button></header>
        <div className="body">{children}</div>
        <footer>{foot}</footer>
      </div>
    </div>
  );
}

type Opt = string | [string, string];
const o2 = (o: Opt): [string, string] => (Array.isArray(o) ? o : [o, o]);
export const Fld = ({ l, children }: { l: string; children: ReactNode }) => <label className="f"><span>{l}</span>{children}</label>;
export const TxtF = ({ l, v, on, ...r }: { l: string; v: string | null | undefined; on: (v: string) => void } & Omit<InputHTMLAttributes<HTMLInputElement>, 'onChange' | 'value'>) =>
  <Fld l={l}><input {...r} value={v ?? ''} onChange={(e) => on(e.target.value)} /></Fld>;
export const NumF = ({ l, v, on, ...r }: { l: string; v: number | string | null | undefined; on: (v: number | null) => void } & Omit<InputHTMLAttributes<HTMLInputElement>, 'onChange' | 'value'>) =>
  <Fld l={l}><input type="number" step="any" inputMode="decimal" {...r} value={v ?? ''} onChange={(e) => on(e.target.value === '' ? null : Number(e.target.value))} /></Fld>;
export const DateF = ({ l, v, on, ...r }: { l: string; v: string | null | undefined; on: (v: string) => void } & Omit<InputHTMLAttributes<HTMLInputElement>, 'onChange' | 'value'>) =>
  <Fld l={l}><input type="date" {...r} value={v ?? ''} onChange={(e) => on(e.target.value)} /></Fld>;
export const SelF = ({ l, v, on, opts, disabled }: { l: string; v: string | null | undefined; on: (v: string) => void; opts: Opt[]; disabled?: boolean }) =>
  <Fld l={l}><select value={v ?? ''} disabled={disabled} onChange={(e) => on(e.target.value)}>{opts.map(o2).map(([k, t]) => <option key={k} value={k}>{t}</option>)}</select></Fld>;
export const AreaF = ({ l, v, on, h }: { l: string; v: string | null | undefined; on: (v: string) => void; h?: number }) =>
  <Fld l={l}><textarea value={v ?? ''} style={h ? { minHeight: h } : undefined} onChange={(e) => on(e.target.value)} /></Fld>;
export const ChkF = ({ l, v, on }: { l: string; v: boolean | null | undefined; on: (v: boolean) => void }) =>
  <label className="chk"><input type="checkbox" checked={!!v} onChange={(e) => on(e.target.checked)} />{l}</label>;
export const sn = (b: boolean | null | undefined) => (b ? 'si' : 'no');
