-- Candados con lógica: el encargado corrige lo suyo 15 min; después pide autorización al dueño.
create table if not exists public.solicitudes_cambio (
  id uuid primary key default gen_random_uuid(),
  tabla text not null, registro_id uuid, reporte_id uuid, maquina_id text,
  resumen text not null,
  motivo text not null check (length(trim(motivo)) >= 3),
  estado text not null default 'pendiente' check (estado in ('pendiente','aprobada','rechazada','atendida')),
  solicitada_por uuid not null default auth.uid(),
  solicitada_at timestamptz not null default now(),
  resuelta_por uuid, resuelta_at timestamptz, vence_at timestamptz
);
alter table public.solicitudes_cambio enable row level security;
create policy dueno_todo on public.solicitudes_cambio for all to authenticated using (public.is_dueno()) with check (public.is_dueno());
create policy pedir on public.solicitudes_cambio for insert to authenticated with check (public.can_edit_prod() and solicitada_por = auth.uid() and estado = 'pendiente');
create policy ver_propias on public.solicitudes_cambio for select to authenticated using (solicitada_por = auth.uid());
create trigger log_cambio after insert or update or delete on public.solicitudes_cambio for each row execute function public.log_cambio();
alter publication supabase_realtime add table public.solicitudes_cambio;

-- Producción: el encargado edita lo que capturó él en los últimos 15 min, o lo que el dueño autorizó (1 h).
alter policy capturar_upd on public.reporte_lineas using (
  public.can_edit_prod() and (
    (created_by = auth.uid() and created_at > now() - interval '15 minutes')
    or exists (select 1 from public.solicitudes_cambio s where s.tabla = 'reporte_lineas' and s.estado = 'aprobada' and s.vence_at > now()
               and s.solicitada_por = auth.uid() and s.reporte_id = reporte_lineas.reporte_id and s.maquina_id = reporte_lineas.maquina_id)
  )) with check (public.can_edit_prod());
-- El encabezado del reporte (fecha/turno) no se edita.
alter policy capturar_upd on public.reportes using (public.is_dueno()) with check (public.is_dueno());
-- Paros: el encargado solo puede reanudar uno abierto.
alter policy capturar_upd on public.paros using (public.can_edit_prod() and fin is null) with check (public.can_edit_prod());
