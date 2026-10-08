-- Encargado: en inventario solo puede registrar entradas y salidas. Conteos, ajustes, anulaciones y materiales: solo dueño.
alter policy escribir on public.inv_movimientos using (public.is_dueno()) with check (public.is_dueno());
alter policy escribir on public.inv_conteos using (public.is_dueno()) with check (public.is_dueno());
create policy insertar_encargado on public.inv_movimientos for insert to authenticated
  with check (public.can_edit_prod() and tipo in ('entrada','salida'));
-- registrar_conteo: ahora exige is_dueno() (ver 20261007180000_silo_ubicacion.sql para el cuerpo)
