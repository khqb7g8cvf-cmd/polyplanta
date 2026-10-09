-- Horas perdidas (ajustes, cambio de banda, falla...) por línea de reporte; se descuentan del tiempo disponible.
alter table public.reporte_lineas add column if not exists horas_perdidas numeric check (horas_perdidas is null or horas_perdidas >= 0);
-- Reportes de turno sin candado para el encargado: puede corregirlos cuando quiera (borrar sigue siendo solo del dueño; todo queda en la bitácora).
alter policy capturar_upd on public.reporte_lineas using (public.can_edit_prod()) with check (public.can_edit_prod());
