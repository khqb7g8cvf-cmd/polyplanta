-- Resumen diario de inventario por WhatsApp: 9:00 am CDMX (15:00 UTC). La función vive en supabase/functions/resumen-inventario.
create extension if not exists pg_cron;
create extension if not exists pg_net;
create table if not exists public.secretos_internos (nombre text primary key, valor text not null);
alter table public.secretos_internos enable row level security;
revoke all on public.secretos_internos from anon, authenticated;
insert into public.secretos_internos (nombre, valor) values ('cron_resumen', replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', '')) on conflict do nothing;
select cron.schedule('resumen-inventario-9am', '0 15 * * *', $$select net.http_post(url := 'https://<PROJECT_REF>.supabase.co/functions/v1/resumen-inventario', headers := jsonb_build_object('x-cron-secret', (select valor from public.secretos_internos where nombre='cron_resumen'), 'Content-Type','application/json'), body := '{}'::jsonb)$$);
