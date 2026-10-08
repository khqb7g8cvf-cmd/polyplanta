-- Costos de compra: solo el dueño los ve y los captura. Viven en inv_costos (RLS dueño); la columna vieja queda siempre en null.
create table if not exists public.inv_costos (id uuid primary key references public.inv_movimientos(id) on delete cascade, costo_kg numeric not null check (costo_kg >= 0));
alter table public.inv_costos enable row level security;
create policy dueno_todo on public.inv_costos for all to authenticated using (public.is_dueno()) with check (public.is_dueno());
insert into public.inv_costos (id, costo_kg) select id, costo_kg from public.inv_movimientos where costo_kg is not null on conflict do nothing;
create trigger log_cambio after insert or update or delete on public.inv_costos for each row execute function public.log_cambio();
grant select, insert, update, delete on public.inv_costos to authenticated;
revoke all on public.inv_costos from anon;
update public.inv_movimientos set costo_kg = null where costo_kg is not null;
create or replace function public.sin_costo_en_mov() returns trigger language plpgsql set search_path = public as $$ begin new.costo_kg := null; return new; end $$;
create trigger sin_costo_en_mov before insert or update on public.inv_movimientos for each row execute function public.sin_costo_en_mov();
revoke execute on function public.sin_costo_en_mov() from public, anon, authenticated;
-- El encargado puede capturar el costo de sus propias entradas (no puede leerlo ni cambiarlo después).
create policy insertar_encargado on public.inv_costos for insert to authenticated
  with check (public.can_edit_prod() and exists (select 1 from public.inv_movimientos m where m.id = inv_costos.id and m.created_by = auth.uid() and m.tipo = 'entrada'));
