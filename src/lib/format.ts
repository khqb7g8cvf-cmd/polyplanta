export const pad = (n: number) => String(n).padStart(2, '0');
export const ymd = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
export const today = () => ymd(new Date());
export const num = (v: unknown): number | null => {
  const n = parseFloat(String(v ?? '').replace(',', '.'));
  return isNaN(n) ? null : n;
};
export const fmt = (n: number | null | undefined, d = 0) =>
  n == null || isNaN(n) ? '—' : Number(n).toLocaleString('es-MX', { maximumFractionDigits: d, minimumFractionDigits: d });
export const dmy = (s?: string | null) => {
  if (!s) return '—';
  const [y, m, d] = s.slice(0, 10).split('-');
  return `${d}/${m}/${y.slice(2)}`;
};
export const hhmm = (iso?: string | null) =>
  iso ? new Date(iso).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit', hour12: false }) : '—';
export const fmtDur = (ms: number) => {
  const m = Math.max(0, Math.round(ms / 60000));
  return m < 60 ? `${m} min` : `${Math.floor(m / 60)} h ${pad(m % 60)} min`;
};
export const localDT = (d: Date) => `${ymd(d)}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
export const sum = <T,>(a: T[], f: (x: T) => number | null | undefined) => a.reduce((s, x) => s + (Number(f(x)) || 0), 0);
export const daysAgo = (n: number) => ymd(new Date(Date.now() - n * 864e5));
