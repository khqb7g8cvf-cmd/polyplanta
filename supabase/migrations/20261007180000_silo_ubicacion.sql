-- Silo + sacos: la existencia se lleva por ubicación ('silo' = granel, 'sacos' = bodega).
alter table public.materiales add column if not exists silo_kg numeric check (silo_kg is null or silo_kg > 0);
alter table public.inv_movimientos add column if not exists ubicacion text not null default 'sacos' check (ubicacion in ('silo','sacos'));
alter table public.inv_conteos add column if not exists ubicacion text not null default 'sacos' check (ubicacion in ('silo','sacos'));

create or replace view public.inv_existencias_ub with (security_invoker = true) as
select m.id as material_id, u.ubicacion, coalesce(sum(v.delta_kg) filter (where v.ubicacion = u.ubicacion), 0) as kg
from public.materiales m cross join (values ('silo'), ('sacos')) as u(ubicacion)
left join public.inv_movimientos v on v.material_id = m.id
group by m.id, u.ubicacion;

-- (la versión de 3 argumentos queda sin permiso de ejecución; ver revoke al final)
create or replace function public.registrar_conteo(p_material uuid, p_kg numeric, p_nota text default null, p_ubicacion text default 'sacos')
returns numeric language plpgsql security definer set search_path = public as $$
declare v_sis numeric; v_dif numeric;
begin
  if not public.can_edit_prod() then raise exception 'Sin permiso para registrar conteos'; end if;
  if p_ubicacion not in ('silo','sacos') then raise exception 'Ubicación inválida'; end if;
  select coalesce(sum(delta_kg), 0) into v_sis from public.inv_movimientos where material_id = p_material and ubicacion = p_ubicacion;
  v_dif := p_kg - v_sis;
  insert into public.inv_conteos (material_id, kg_contados, kg_sistema, diferencia, nota, ubicacion)
  values (p_material, p_kg, v_sis, v_dif, p_nota, p_ubicacion);
  if v_dif <> 0 then
    insert into public.inv_movimientos (material_id, tipo, delta_kg, nota, ubicacion)
    values (p_material, 'ajuste', v_dif, coalesce(p_nota, 'Conteo físico'), p_ubicacion);
  end if;
  return v_dif;
end $$;
revoke execute on function public.registrar_conteo(uuid, numeric, text, text) from public, anon;
grant execute on function public.registrar_conteo(uuid, numeric, text, text) to authenticated;
revoke execute on function public.registrar_conteo(uuid, numeric, text) from public, anon;
