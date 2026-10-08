-- Borrar: solo el dueño. Encargados siguen capturando (insert) y corrigiendo (update) lo suyo.
alter policy escribir on public.reportes       using (public.is_dueno()) with check (public.is_dueno());
alter policy escribir on public.reporte_lineas using (public.is_dueno()) with check (public.is_dueno());
alter policy escribir on public.paros          using (public.is_dueno()) with check (public.is_dueno());
alter policy escribir on public.personas       using (public.is_dueno()) with check (public.is_dueno());
alter policy escribir on public.mtto           using (public.is_dueno()) with check (public.is_dueno());

create policy capturar_ins on public.reportes       for insert to authenticated with check (public.can_edit_prod());
create policy capturar_upd on public.reportes       for update to authenticated using (public.can_edit_prod()) with check (public.can_edit_prod());
create policy capturar_ins on public.reporte_lineas for insert to authenticated with check (public.can_edit_prod());
create policy capturar_upd on public.reporte_lineas for update to authenticated using (public.can_edit_prod()) with check (public.can_edit_prod());
create policy capturar_ins on public.paros          for insert to authenticated with check (public.can_edit_prod());
create policy capturar_upd on public.paros          for update to authenticated using (public.can_edit_prod()) with check (public.can_edit_prod());
create policy capturar_ins on public.personas       for insert to authenticated with check (public.can_edit_prod());
create policy capturar_upd on public.personas       for update to authenticated using (public.can_edit_prod()) with check (public.can_edit_prod());
create policy capturar_ins on public.mtto           for insert to authenticated with check (public.can_mtto());
create policy capturar_upd on public.mtto           for update to authenticated using (public.can_mtto()) with check (public.can_mtto());

-- Materia prima: código de producto y fabricante
alter table public.materiales add column if not exists codigo text;
alter table public.materiales add column if not exists fabricante text;
