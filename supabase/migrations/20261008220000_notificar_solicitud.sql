-- Al crearse una solicitud de cambio, avisa por WhatsApp al dueño (si falla, la solicitud se guarda igual).
create or replace function public.notificar_solicitud() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  begin
    perform net.http_post(
      url := 'https://<PROJECT_REF>.supabase.co/functions/v1/notificar-solicitud',
      headers := jsonb_build_object('x-cron-secret', (select valor from public.secretos_internos where nombre = 'cron_resumen'), 'Content-Type', 'application/json'),
      body := jsonb_build_object('id', new.id));
  exception when others then null;
  end;
  return new;
end $$;
revoke execute on function public.notificar_solicitud() from public, anon, authenticated;
drop trigger if exists avisar_dueno on public.solicitudes_cambio;
create trigger avisar_dueno after insert on public.solicitudes_cambio for each row execute function public.notificar_solicitud();
