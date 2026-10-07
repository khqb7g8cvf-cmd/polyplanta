-- Fase 2 · usuarios con contraseña (sin correo), bitácora de auditoría y kardex de inventario.

-- ───────────── usuarios ─────────────
alter table public.profiles add column if not exists usuario text;
alter table public.profiles add column if not exists activo boolean not null default false;
create unique index if not exists profiles_usuario_uq on public.profiles (lower(usuario));

-- Un perfil inactivo no tiene rol: no ve ni escribe nada.
create or replace function public.app_rol() returns public.rol_app
language sql stable security definer set search_path = public as
$$ select rol from public.profiles where id = auth.uid() and activo $$;

-- El primer usuario es dueño y queda activo; los demás registros por la API pública quedan INACTIVOS
-- (solo el dueño crea usuarios utilizables, con admin_crear_usuario).
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
declare v_first boolean;
begin
  v_first := (select count(*) from public.profiles) = 0;
  insert into public.profiles (id, nombre, usuario, rol, activo)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'nombre', split_part(new.email, '@', 1)),
    coalesce(new.raw_user_meta_data->>'usuario', split_part(new.email, '@', 1)),
    case when v_first then 'dueno'::public.rol_app else 'lectura'::public.rol_app end,
    v_first
  );
  return new;
end $$;

-- Crea un usuario con usuario+contraseña directamente en auth (sin correo, sin confirmación).
create or replace function public._crear_usuario(p_usuario text, p_password text, p_nombre text, p_rol public.rol_app)
returns uuid language plpgsql security definer set search_path = public, extensions as $$
declare v_id uuid := gen_random_uuid(); v_u text := lower(trim(p_usuario)); v_email text;
begin
  if v_u !~ '^[a-z0-9._-]{3,30}$' then raise exception 'Usuario inválido: de 3 a 30 caracteres, solo letras sin acento, números, punto, guion o guion bajo'; end if;
  if length(coalesce(p_password, '')) < 6 then raise exception 'La contraseña debe tener al menos 6 caracteres'; end if;
  if exists (select 1 from public.profiles where lower(usuario) = v_u) then raise exception 'Ese usuario ya existe'; end if;
  v_email := v_u || '@usuarios.polyamsa.mx';
  insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
    raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
    confirmation_token, recovery_token, email_change_token_new, email_change, email_change_token_current, reauthentication_token, phone_change, phone_change_token)
  values ('00000000-0000-0000-0000-000000000000', v_id, 'authenticated', 'authenticated', v_email, crypt(p_password, gen_salt('bf')), now(),
    '{"provider":"email","providers":["email"]}', jsonb_build_object('nombre', coalesce(nullif(trim(p_nombre), ''), v_u), 'usuario', v_u, 'email_verified', true), now(), now(),
    '', '', '', '', '', '', '', '');
  insert into auth.identities (provider_id, user_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
  values (v_id::text, v_id, jsonb_build_object('sub', v_id::text, 'email', v_email, 'email_verified', true, 'phone_verified', false), 'email', now(), now(), now());
  update public.profiles set rol = p_rol, activo = true, usuario = v_u where id = v_id;
  return v_id;
end $$;

create or replace function public.admin_crear_usuario(p_usuario text, p_password text, p_nombre text, p_rol public.rol_app)
returns uuid language plpgsql security definer set search_path = public as $$
begin
  if not public.is_dueno() then raise exception 'Solo el dueño puede crear usuarios'; end if;
  return public._crear_usuario(p_usuario, p_password, p_nombre, p_rol);
end $$;

-- Solo funciona mientras no exista ningún usuario: crea al dueño desde la pantalla de configuración inicial.
create or replace function public.crear_primer_dueno(p_usuario text, p_password text, p_nombre text)
returns uuid language plpgsql security definer set search_path = public as $$
begin
  if exists (select 1 from public.profiles) then raise exception 'La planta ya fue configurada'; end if;
  return public._crear_usuario(p_usuario, p_password, p_nombre, 'dueno');
end $$;

create or replace function public.hay_usuarios() returns boolean
language sql stable security definer set search_path = public as $$ select exists (select 1 from public.profiles) $$;

create or replace function public.admin_cambiar_password(p_user uuid, p_password text)
returns void language plpgsql security definer set search_path = public, extensions as $$
begin
  if not public.is_dueno() then raise exception 'Solo el dueño puede cambiar contraseñas'; end if;
  if length(coalesce(p_password, '')) < 6 then raise exception 'La contraseña debe tener al menos 6 caracteres'; end if;
  update auth.users set encrypted_password = crypt(p_password, gen_salt('bf')), updated_at = now() where id = p_user;
end $$;

-- Nunca dejar la planta sin un dueño activo.
create or replace function public.guard_profiles() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if old.rol = 'dueno' and old.activo and (new.rol <> 'dueno' or not new.activo)
     and not exists (select 1 from public.profiles where id <> old.id and rol = 'dueno' and activo) then
    raise exception 'Debe quedar al menos un dueño activo';
  end if;
  return new;
end $$;
drop trigger if exists guard_profiles on public.profiles;
create trigger guard_profiles before update on public.profiles for each row execute function public.guard_profiles();

-- Lectura: solo usuarios activos (antes bastaba con tener sesión).
do $$
declare t text;
begin
  foreach t in array array['maquinas','personas','config','ordenes','reportes','reporte_lineas','paros','mtto','materiales','inv_movimientos','inv_conteos'] loop
    execute format('drop policy if exists leer on public.%I', t);
    execute format('create policy leer on public.%I for select to authenticated using (public.app_rol() is not null)', t);
  end loop;
end $$;
drop policy if exists leer on public.profiles;
create policy leer on public.profiles for select to authenticated using (public.app_rol() is not null or id = auth.uid());

-- ───────────── autoría a prueba de trampas ─────────────
-- created_by y created_at los fija el servidor; el cliente no puede falsearlos.
create or replace function public.forzar_autor() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  new := jsonb_populate_record(new, jsonb_build_object('created_by', auth.uid())
    || case when to_jsonb(new) ? 'created_at' then jsonb_build_object('created_at', now()) else '{}'::jsonb end);
  return new;
end $$;
do $$
declare t text;
begin
  foreach t in array array['reportes','reporte_lineas','paros','inv_movimientos','inv_conteos','amonestaciones'] loop
    execute format('drop trigger if exists forzar_autor on public.%I', t);
    execute format('create trigger forzar_autor before insert on public.%I for each row execute function public.forzar_autor()', t);
  end loop;
end $$;
alter table public.mtto add column if not exists creado_por uuid default auth.uid();
create or replace function public.forzar_autor_mtto() returns trigger
language plpgsql security definer set search_path = public as $$
begin new.creado_por := auth.uid(); new.creada := now(); return new; end $$;
drop trigger if exists forzar_autor on public.mtto;
create trigger forzar_autor before insert on public.mtto for each row execute function public.forzar_autor_mtto();

-- ───────────── bitácora ─────────────
create table if not exists public.bitacora (
  id bigint generated always as identity primary key,
  at timestamptz not null default now(),
  actor uuid,
  actor_usuario text,
  actor_nombre text,
  tabla text not null,
  accion text not null check (accion in ('INSERT','UPDATE','DELETE','LOGIN')),
  registro_id text,
  antes jsonb,
  despues jsonb
);
create index if not exists bitacora_at_idx on public.bitacora (at desc);
create index if not exists bitacora_actor_idx on public.bitacora (actor, at desc);
create index if not exists bitacora_tabla_idx on public.bitacora (tabla, at desc);
alter table public.bitacora enable row level security;
drop policy if exists leer on public.bitacora;
create policy leer on public.bitacora for select to authenticated using (public.is_dueno());
revoke insert, update, delete, truncate on public.bitacora from anon, authenticated;

create or replace function public.log_cambio() returns trigger
language plpgsql security definer set search_path = public as $$
declare v_uid uuid := auth.uid(); v_u text; v_n text; v_old jsonb; v_new jsonb; v_a jsonb := '{}'; v_d jsonb := '{}'; k text; v_id text;
begin
  select usuario, nombre into v_u, v_n from public.profiles where id = v_uid;
  if tg_op = 'INSERT' then v_new := to_jsonb(new); v_id := v_new->>'id';
  elsif tg_op = 'DELETE' then v_old := to_jsonb(old); v_id := v_old->>'id';
  else
    v_old := to_jsonb(old); v_new := to_jsonb(new); v_id := v_new->>'id';
    for k in select jsonb_object_keys(v_new) loop
      if k in ('updated_at') then continue; end if;
      if v_new->k is distinct from v_old->k then v_a := v_a || jsonb_build_object(k, v_old->k); v_d := v_d || jsonb_build_object(k, v_new->k); end if;
    end loop;
    if v_d = '{}'::jsonb then return new; end if;
    v_old := v_a; v_new := v_d;
  end if;
  insert into public.bitacora (actor, actor_usuario, actor_nombre, tabla, accion, registro_id, antes, despues)
  values (v_uid, v_u, v_n, tg_table_name, tg_op, v_id, v_old, v_new);
  return coalesce(new, old);
end $$;

do $$
declare t text;
begin
  foreach t in array array['reportes','reporte_lineas','paros','mtto','amonestaciones','ordenes','maquinas','personas','config','materiales','inv_movimientos','inv_conteos','profiles'] loop
    execute format('drop trigger if exists log_cambio on public.%I', t);
    execute format('create trigger log_cambio after insert or update or delete on public.%I for each row execute function public.log_cambio()', t);
  end loop;
end $$;

create or replace function public.registrar_acceso() returns void
language plpgsql security definer set search_path = public as $$
declare v_u text; v_n text;
begin
  if auth.uid() is null then return; end if;
  select usuario, nombre into v_u, v_n from public.profiles where id = auth.uid();
  insert into public.bitacora (actor, actor_usuario, actor_nombre, tabla, accion, registro_id) values (auth.uid(), v_u, v_n, 'sesion', 'LOGIN', auth.uid()::text);
end $$;

-- ───────────── inventario: motivo y referencia de cada movimiento ─────────────
alter table public.inv_movimientos add column if not exists motivo text
  check (motivo is null or motivo in ('produccion','merma','muestra','devolucion','traspaso','venta','otro'));
alter table public.inv_movimientos add column if not exists referencia text;  -- cliente, folio o a quién/para qué se entregó

-- ───────────── permisos de ejecución ─────────────
revoke execute on function public._crear_usuario(text, text, text, public.rol_app) from public, anon, authenticated;
revoke execute on function public.admin_crear_usuario(text, text, text, public.rol_app) from public, anon;
grant execute on function public.admin_crear_usuario(text, text, text, public.rol_app) to authenticated;
revoke execute on function public.admin_cambiar_password(uuid, text) from public, anon;
grant execute on function public.admin_cambiar_password(uuid, text) to authenticated;
revoke execute on function public.crear_primer_dueno(text, text, text) from public;
grant execute on function public.crear_primer_dueno(text, text, text) to anon, authenticated;
revoke execute on function public.hay_usuarios() from public;
grant execute on function public.hay_usuarios() to anon, authenticated;
revoke execute on function public.registrar_acceso() from public, anon;
grant execute on function public.registrar_acceso() to authenticated;
revoke execute on function public.guard_profiles(), public.log_cambio(), public.forzar_autor(), public.forzar_autor_mtto() from public, anon, authenticated;

do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    alter publication supabase_realtime add table public.bitacora;
  end if;
end $$;
