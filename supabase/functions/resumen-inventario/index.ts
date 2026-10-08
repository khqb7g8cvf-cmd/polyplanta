// Resumen diario de inventario por WhatsApp (API oficial de Meta, plantilla aprobada).
// Se dispara con pg_cron a las 9:00 CDMX con el cierre del día anterior. Nunca incluye costos.
import { createClient } from 'jsr:@supabase/supabase-js@2';

const MX = 'America/Mexico_City';
const ymd = (d: Date) => new Intl.DateTimeFormat('en-CA', { timeZone: MX }).format(d); // YYYY-MM-DD
const fmt = (n: number, d = 0) => n.toLocaleString('es-MX', { maximumFractionDigits: d, minimumFractionDigits: d });
const ton = (kg: number) => `${fmt(kg / 1000, 1)} t`;
const limpia = (s: string) => s.replace(/[\r\n\t]+/g, ' | ').replace(/ {4,}/g, '   ').slice(0, 900);

Deno.serve(async (req) => {
  const sb = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
  const { data: sec } = await sb.from('secretos_internos').select('valor').eq('nombre', 'cron_resumen').maybeSingle();
  if (!sec || req.headers.get('x-cron-secret') !== sec.valor) return new Response('no autorizado', { status: 401 });
  const url = new URL(req.url);
  const dry = url.searchParams.get('dry') === '1';

  const hoy = ymd(new Date()), ayerD = new Date(Date.now() - 864e5), ayer = ymd(ayerD);
  const desde = `${ayer}T00:00:00-06:00`, hasta = `${hoy}T00:00:00-06:00`;
  const hace30 = new Date(Date.now() - 30 * 864e5).toISOString();

  const [mats, ub, movsAyer, mov30] = await Promise.all([
    sb.from('materiales').select('id,nombre,minimo_kg,silo_kg,activo').eq('activo', true).order('nombre'),
    sb.from('inv_existencias_ub').select('material_id,ubicacion,kg'),
    sb.from('inv_movimientos').select('material_id,tipo,delta_kg,ubicacion').gte('fecha', desde).lt('fecha', hasta),
    sb.from('inv_movimientos').select('material_id,delta_kg').eq('tipo', 'salida').gte('fecha', hace30),
  ]);
  if (mats.error || ub.error || movsAyer.error || mov30.error) return new Response('error de base: ' + JSON.stringify([mats.error, ub.error, movsAyer.error, mov30.error]), { status: 500 });

  const ex: Record<string, { silo: number; sacos: number }> = {};
  for (const r of ub.data!) (ex[r.material_id] ||= { silo: 0, sacos: 0 })[r.ubicacion as 'silo' | 'sacos'] = Number(r.kg);

  const lineas: string[] = [], alertas: string[] = [];
  for (const m of mats.data!) {
    const e = ex[m.id] || { silo: 0, sacos: 0 }, total = e.silo + e.sacos;
    const cons = -(mov30.data!.filter((x) => x.material_id === m.id).reduce((s, x) => s + Number(x.delta_kg), 0)) / 30;
    const dias = cons > 0 ? Math.round(total / cons) : null;
    if (m.silo_kg) lineas.push(`${m.nombre}: silo ${ton(e.silo)} (${Math.round((e.silo / Number(m.silo_kg)) * 100)}%), sacos ${fmt(e.sacos)} kg${dias != null ? `, alcanza ~${dias} días` : ''}`);
    else if (total > 0 || cons > 0) lineas.push(`${m.nombre}: ${fmt(total)} kg${dias != null ? ` (~${dias} días)` : ''}`);
    if (total < Number(m.minimo_kg)) alertas.push(`${m.nombre} bajo mínimo (${fmt(total)} de ${fmt(Number(m.minimo_kg))} kg)`);
    if (m.silo_kg && e.silo / Number(m.silo_kg) > 0.95) alertas.push(`silo de ${m.nombre} casi lleno`);
  }
  const nombre = (id: string) => mats.data!.find((m) => m.id === id)?.nombre ?? '?';
  const suma = (tipo: 'entrada' | 'salida') => {
    const g = new Map<string, number>();
    for (const x of movsAyer.data!) if ((tipo === 'entrada' ? x.delta_kg > 0 && x.tipo === 'entrada' : x.tipo === 'salida')) g.set(x.material_id, (g.get(x.material_id) || 0) + Math.abs(Number(x.delta_kg)));
    return [...g].map(([id, kg]) => `${nombre(id)} ${kg >= 2000 ? ton(kg) : fmt(kg) + ' kg'}`).join(', ') || 'ninguna';
  };
  const fechaTxt = new Intl.DateTimeFormat('es-MX', { timeZone: MX, day: 'numeric', month: 'short' }).format(ayerD).replace('.', '');
  const params = [fechaTxt, lineas.join(' | ') || 'sin existencias', suma('entrada'), suma('salida'), alertas.join(' | ') || 'sin alertas'].map(limpia);

  if (dry) return Response.json({ params });

  const token = Deno.env.get('WA_TOKEN'), phone = Deno.env.get('WA_PHONE_ID'), to = (Deno.env.get('WA_TO') || '').split(',').map((s) => s.trim()).filter(Boolean);
  if (!token || !phone || !to.length) return new Response('faltan WA_TOKEN, WA_PHONE_ID o WA_TO', { status: 500 });
  const tpl = Deno.env.get('WA_TEMPLATE') || 'resumen_inventario', lang = Deno.env.get('WA_LANG') || 'es_MX';
  const res = [];
  for (const n of to) {
    const r = await fetch(`https://graph.facebook.com/v21.0/${phone}/messages`, {
      method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ messaging_product: 'whatsapp', to: n, type: 'template', template: { name: tpl, language: { code: lang }, components: [{ type: 'body', parameters: params.map((text) => ({ type: 'text', text })) }] } }),
    });
    res.push({ to: n.slice(0, 4) + '…' + n.slice(-3), status: r.status, body: await r.text() });
  }
  return Response.json({ params, res });
});
