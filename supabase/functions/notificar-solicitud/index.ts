// Avisa por WhatsApp al dueño cuando un encargado pide un cambio. Lo dispara un trigger de solicitudes_cambio.
// Usa la plantilla aprobada WA_TEMPLATE_SOLICITUD (por defecto solicitud_cambio) con 3 variables: usuario, qué, motivo.
import { createClient } from 'jsr:@supabase/supabase-js@2';

const limpia = (s: string) => s.replace(/[\r\n\t]+/g, ' ').replace(/ {4,}/g, '   ').slice(0, 300);

Deno.serve(async (req) => {
  const sb = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
  const { data: sec } = await sb.from('secretos_internos').select('valor').eq('nombre', 'cron_resumen').maybeSingle();
  if (!sec || req.headers.get('x-cron-secret') !== sec.valor) return new Response('no autorizado', { status: 401 });
  const { id } = await req.json().catch(() => ({ id: null }));
  if (!id) return new Response('falta id', { status: 400 });
  const { data: s } = await sb.from('solicitudes_cambio').select('resumen,motivo,solicitada_por').eq('id', id).maybeSingle();
  if (!s) return new Response('no existe', { status: 404 });
  const { data: u } = await sb.from('profiles').select('usuario,nombre').eq('id', s.solicitada_por).maybeSingle();

  const token = Deno.env.get('WA_TOKEN'), phone = Deno.env.get('WA_PHONE_ID');
  const owner = (Deno.env.get('WA_OWNER') || (Deno.env.get('WA_TO') || '').split(',')[0] || '').trim();
  if (!token || !phone || !owner) return new Response('faltan WA_TOKEN, WA_PHONE_ID o WA_OWNER', { status: 500 });
  const params = [u?.usuario || u?.nombre || 'Un encargado', s.resumen, s.motivo].map(limpia);
  const r = await fetch(`https://graph.facebook.com/v21.0/${phone}/messages`, {
    method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ messaging_product: 'whatsapp', to: owner, type: 'template', template: { name: Deno.env.get('WA_TEMPLATE_SOLICITUD') || 'solicitud_cambio', language: { code: Deno.env.get('WA_LANG') || 'es_MX' }, components: [{ type: 'body', parameters: params.map((text) => ({ type: 'text', text })) }] } }),
  });
  return Response.json({ status: r.status, body: await r.text() });
});
