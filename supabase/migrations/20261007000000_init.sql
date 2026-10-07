-- Polyamsa · Control de planta
-- Ejecutar completo en Supabase ▸ SQL Editor (o con `supabase db push`).

create type public.rol_app as enum ('dueno','encargado','mecanico','lectura');

-- ───────────── usuarios y permisos ─────────────
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  nombre text not null default '',
  rol public.rol_app not null default 'lectura',
  created_at timestamptz not null default now()
);

create or replace function public.app_rol() returns public.rol_app
language sql stable security definer set search_path = public as
$$ select rol from public.profiles where id = auth.uid() $$;

create or replace function public.is_dueno() returns boolean
language sql stable security definer set search_path = public as
$$ select coalesce(public.app_rol() = 'dueno', false) $$;

create or replace function public.can_edit_prod() returns boolean
language sql stable security definer set search_path = public as
$$ select coalesce(public.app_rol() in ('dueno','encargado'), false) $$;

create or replace function public.can_mtto() returns boolean
language sql stable security definer set search_path = public as
$$ select coalesce(public.app_rol() in ('dueno','encargado','mecanico'), false) $$;

-- El primer usuario que se crea queda como dueño; los demás entran como "lectura".
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, nombre, rol)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'nombre', split_part(new.email, '@', 1)),
    case when (select count(*) from public.profiles) = 0 then 'dueno'::public.rol_app else 'lectura'::public.rol_app end
  );
  return new;
end $$;

create trigger on_auth_user_created after insert on auth.users
for each row execute function public.handle_new_user();

-- ───────────── catálogo ─────────────
create table public.maquinas (
  id text primary key,
  tipo text not null check (tipo in ('extrusion','impresion','bolseo','acabado')),
  nombre text not null,
  marca text,
  estado text not null default 'Activa',
  orden int not null default 0,
  carriles numeric, carriles_max numeric, golpes numeric, kgh numeric,
  sellos text[] not null default '{}',
  tintas int, imp_max numeric, mat_max numeric, caras int,
  densidades text[] not null default '{}',
  ancho_max numeric,
  sin_fotocelda boolean not null default false,
  rodillos jsonb not null default '[]',
  notas text
);

create table public.personas (
  id uuid primary key default gen_random_uuid(),
  nombre text not null,
  rol text not null default 'operador',   -- operador, mecánico, encargado, chofer, ayudante
  area text, turno text,
  activo boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.config (
  id int primary key default 1 check (id = 1),
  data jsonb not null default '{}'
);

-- ───────────── órdenes de producción ─────────────
create table public.ordenes (
  id uuid primary key default gen_random_uuid(),
  folio text not null,
  cliente text not null,
  fecha_entrega date,
  prioridad text not null default 'Normal',
  estado text not null default 'Programada',
  kilos numeric,
  ancho_ext numeric, calibre numeric, densidad text default 'baja',
  tratado text default 'no', abierto boolean default false, fuelle boolean default false,
  color text, pigmento numeric, kgh numeric,
  sello text default 'fondo', bolsa_ancho numeric, bolsa_largo numeric,
  impresion boolean default false, tintas int, caras int default 1, registro boolean default false,
  grabados boolean default false, obs text,
  extrusora_id text references public.maquinas(id) on delete set null,
  impresora_id text references public.maquinas(id) on delete set null,
  bolseadora_id text references public.maquinas(id) on delete set null,
  carriles numeric, golpes numeric,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ───────────── reporte de turno ─────────────
create table public.reportes (
  id uuid primary key default gen_random_uuid(),
  fecha date not null,
  turno int not null check (turno in (1,2)),
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now(),
  unique (fecha, turno)
);

create table public.reporte_lineas (
  id uuid primary key default gen_random_uuid(),
  reporte_id uuid not null references public.reportes(id) on delete cascade,
  maquina_id text not null references public.maquinas(id),
  orden_id uuid references public.ordenes(id) on delete set null,
  cliente text,
  ancho numeric, largo numeric, calibre numeric, densidad text default 'baja',
  golpes numeric, kgh numeric, carriles numeric, horas numeric,
  operario text not null,
  kilos numeric not null check (kilos >= 0),
  nota text,
  justificada boolean not null default false,
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now()
);
create index on public.reporte_lineas (reporte_id);
create index on public.reporte_lineas (maquina_id);

-- ───────────── paros y mantenimiento ─────────────
create table public.paros (
  id uuid primary key default gen_random_uuid(),
  maquina_id text not null references public.maquinas(id),
  causa text not null,
  inicio timestamptz not null,
  fin timestamptz,
  orden_id uuid references public.ordenes(id) on delete set null,
  nota text,
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now(),
  check (fin is null or fin >= inicio)
);
create index on public.paros (maquina_id, inicio);

create table public.mtto (
  id uuid primary key default gen_random_uuid(),
  maquina_id text not null references public.maquinas(id),
  tipo text not null check (tipo in ('correctivo','preventivo')),
  descr text not null,
  prioridad text not null default 'Normal',
  estado text not null default 'Abierta' check (estado in ('Abierta','En proceso','Cerrada')),
  mecanico text,
  programada date,
  cada_dias int,
  creada timestamptz not null default now(),
  inicio timestamptz,
  cierre timestamptz,
  nota_cierre text,
  costo numeric
);

create table public.amonestaciones (
  id uuid primary key default gen_random_uuid(),
  operario text not null,
  tipo text not null check (tipo in ('Verbal','Escrita','Acta','Reconocimiento')),
  fecha date not null default current_date,
  evidencia text, nota text,
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now()
);

-- ───────────── inventario de resina ─────────────
create table public.materiales (
  id uuid primary key default gen_random_uuid(),
  nombre text not null unique,
  categoria text not null default 'resina' check (categoria in ('resina','reciclado','masterbatch','aditivo')),
  kg_por_saco numeric not null default 25,
  minimo_kg numeric not null default 0,
  activo boolean not null default true,
  created_at timestamptz not null default now()
);

-- delta_kg: entrada (+), salida a producción (−), ajuste por conteo (±)
create table public.inv_movimientos (
  id uuid primary key default gen_random_uuid(),
  material_id uuid not null references public.materiales(id),
  tipo text not null check (tipo in ('entrada','salida','ajuste')),
  fecha timestamptz not null default now(),
  delta_kg numeric not null,
  sacos numeric,
  lote text, proveedor text, factura text,
  costo_kg numeric,
  maquina_id text references public.maquinas(id),
  orden_id uuid references public.ordenes(id) on delete set null,
  nota text,
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now(),
  check ((tipo='entrada' and delta_kg > 0) or (tipo='salida' and delta_kg < 0) or tipo='ajuste')
);
create index on public.inv_movimientos (material_id, fecha);

create table public.inv_conteos (
  id uuid primary key default gen_random_uuid(),
  material_id uuid not null references public.materiales(id),
  fecha timestamptz not null default now(),
  kg_contados numeric not null,
  kg_sistema numeric not null,
  diferencia numeric not null,
  nota text,
  created_by uuid default auth.uid()
);

create view public.inv_existencias with (security_invoker = true) as
select m.id as material_id, coalesce(sum(v.delta_kg), 0) as kg
from public.materiales m left join public.inv_movimientos v on v.material_id = m.id
group by m.id;

-- Conteo físico: guarda el conteo y crea el ajuste que cuadra la existencia.
create or replace function public.registrar_conteo(p_material uuid, p_kg numeric, p_nota text default null)
returns numeric language plpgsql security definer set search_path = public as $$
declare v_sis numeric; v_dif numeric;
begin
  if not public.can_edit_prod() then raise exception 'Sin permiso para registrar conteos'; end if;
  select coalesce(sum(delta_kg), 0) into v_sis from public.inv_movimientos where material_id = p_material;
  v_dif := p_kg - v_sis;
  insert into public.inv_conteos (material_id, kg_contados, kg_sistema, diferencia, nota)
  values (p_material, p_kg, v_sis, v_dif, p_nota);
  if v_dif <> 0 then
    insert into public.inv_movimientos (material_id, tipo, delta_kg, nota)
    values (p_material, 'ajuste', v_dif, coalesce(p_nota, 'Conteo físico'));
  end if;
  return v_dif;
end $$;

-- ───────────── seguridad por fila (RLS) ─────────────
alter table public.profiles enable row level security;
alter table public.maquinas enable row level security;
alter table public.personas enable row level security;
alter table public.config enable row level security;
alter table public.ordenes enable row level security;
alter table public.reportes enable row level security;
alter table public.reporte_lineas enable row level security;
alter table public.paros enable row level security;
alter table public.mtto enable row level security;
alter table public.amonestaciones enable row level security;
alter table public.materiales enable row level security;
alter table public.inv_movimientos enable row level security;
alter table public.inv_conteos enable row level security;

-- Todos los usuarios con sesión leen todo, menos las amonestaciones.
create policy leer on public.profiles for select to authenticated using (true);
create policy leer on public.maquinas for select to authenticated using (true);
create policy leer on public.personas for select to authenticated using (true);
create policy leer on public.config for select to authenticated using (true);
create policy leer on public.ordenes for select to authenticated using (true);
create policy leer on public.reportes for select to authenticated using (true);
create policy leer on public.reporte_lineas for select to authenticated using (true);
create policy leer on public.paros for select to authenticated using (true);
create policy leer on public.mtto for select to authenticated using (true);
create policy leer on public.materiales for select to authenticated using (true);
create policy leer on public.inv_movimientos for select to authenticated using (true);
create policy leer on public.inv_conteos for select to authenticated using (true);
create policy leer on public.amonestaciones for select to authenticated using (public.can_edit_prod());

-- Solo el dueño: roles, catálogo, órdenes, configuración, materiales y amonestaciones.
create policy escribir on public.profiles for update to authenticated using (public.is_dueno()) with check (public.is_dueno());
create policy escribir on public.maquinas for all to authenticated using (public.is_dueno()) with check (public.is_dueno());
create policy escribir on public.config for all to authenticated using (public.is_dueno()) with check (public.is_dueno());
create policy escribir on public.ordenes for all to authenticated using (public.is_dueno()) with check (public.is_dueno());
create policy escribir on public.materiales for all to authenticated using (public.is_dueno()) with check (public.is_dueno());
create policy escribir on public.amonestaciones for all to authenticated using (public.is_dueno()) with check (public.is_dueno());

-- Dueño y encargado: reportes, personas, paros, inventario.
create policy escribir on public.personas for all to authenticated using (public.can_edit_prod()) with check (public.can_edit_prod());
create policy escribir on public.reportes for all to authenticated using (public.can_edit_prod()) with check (public.can_edit_prod());
create policy escribir on public.reporte_lineas for all to authenticated using (public.can_edit_prod()) with check (public.can_edit_prod());
create policy escribir on public.paros for all to authenticated using (public.can_edit_prod()) with check (public.can_edit_prod());
create policy escribir on public.inv_movimientos for all to authenticated using (public.can_edit_prod()) with check (public.can_edit_prod());
create policy escribir on public.inv_conteos for all to authenticated using (public.can_edit_prod()) with check (public.can_edit_prod());

-- Dueño, encargado y mecánico: órdenes de trabajo de mantenimiento.
create policy escribir on public.mtto for all to authenticated using (public.can_mtto()) with check (public.can_mtto());

-- ───────────── tiempo real ─────────────
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    alter publication supabase_realtime add table
      public.maquinas, public.personas, public.config, public.ordenes, public.reportes,
      public.reporte_lineas, public.paros, public.mtto, public.amonestaciones,
      public.materiales, public.inv_movimientos, public.inv_conteos;
  end if;
end $$;
