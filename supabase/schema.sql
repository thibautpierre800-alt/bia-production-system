-- ARCHIVE TECHNIQUE DE LA V5 LOCALE PRÉCÉDENTE — NE PAS EXÉCUTER.
-- Ce schéma ne couvre ni le référentiel BIA V5 cible, ni les quatre profils,
-- ni les ateliers, ni le cycle Signal → Problème → Action → Vérification.
-- Une migration versionnée et testée sur une base isolée devra le remplacer
-- après inventaire du backend réel. L'application V5 actuelle ne le charge pas.

create extension if not exists pgcrypto;

create table if not exists public.profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null,
  site_id text not null,
  role text not null default 'member' check (role in ('member','manager','admin')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create or replace function public.current_user_role()
returns text language sql stable security definer set search_path=public
as $$ select coalesce((select role from public.profiles where user_id=auth.uid()),'member') $$;

create or replace function public.current_user_site()
returns text language sql stable security definer set search_path=public
as $$ select site_id from public.profiles where user_id=auth.uid() $$;

create table if not exists public.actions (
  id uuid primary key default gen_random_uuid(), site_id text not null, title text not null,
  owner text, priority text not null default 'Moyenne', status text not null default 'Ouverte',
  due_date date, origin_type text, description text, created_by uuid references auth.users(id),
  closed_at timestamptz, created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table if not exists public.gembas (
  id uuid primary key default gen_random_uuid(), site_id text not null, workshop text not null,
  finding text not null, category text not null, priority text not null, action_id uuid references public.actions(id),
  photo_path text, observed_at timestamptz not null default now(), created_by uuid references auth.users(id), created_at timestamptz not null default now()
);
create table if not exists public.audits (
  id uuid primary key default gen_random_uuid(), site_id text not null, status text not null,
  score numeric, notes text, performed_at timestamptz not null, audit_data jsonb not null default '{}'::jsonb,
  auditor_id uuid references auth.users(id), created_at timestamptz not null default now()
);
create table if not exists public.improvement_projects (
  id uuid primary key default gen_random_uuid(), site_id text not null, title text not null,
  method text, status text, owner text, objective text, expected_gain numeric, gain_unit text,
  progress numeric default 0, target_date date, created_by uuid references auth.users(id), created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table if not exists public.best_practices (
  id uuid primary key default gen_random_uuid(), site_id text not null, title text not null,
  category text, summary text not null, expected_gain text, status text not null default 'À valider',
  created_by uuid references auth.users(id), created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table if not exists public.kpi_measurements (
  id uuid primary key default gen_random_uuid(), site_id text not null, period date not null,
  trs numeric check (trs between 0 and 100), rebuts numeric check (rebuts between 0 and 100),
  otif numeric check (otif between 0 and 100), maturity numeric check (maturity between 0 and 5),
  comment text, created_by uuid references auth.users(id), created_at timestamptz not null default now(),
  unique(site_id,period)
);
create table if not exists public.toolkit_runs (
  id uuid primary key default gen_random_uuid(), site_id text not null, module_id text not null,
  title text not null, status text not null, progress jsonb not null default '{}'::jsonb,
  started_at timestamptz not null default now(), created_by uuid references auth.users(id), created_at timestamptz not null default now()
);
create table if not exists public.knowledge_sources (
  id uuid primary key default gen_random_uuid(), site_id text not null, classification text not null, title text not null,
  statement text not null, source_url text, consulted_at date, validation_owner text, status text,
  created_by uuid references auth.users(id), created_at timestamptz not null default now()
);

create index if not exists actions_site_status_idx on public.actions(site_id,status);
create index if not exists gembas_site_date_idx on public.gembas(site_id,observed_at desc);
create index if not exists kpi_site_period_idx on public.kpi_measurements(site_id,period desc);
create index if not exists audits_site_date_idx on public.audits(site_id,performed_at desc);

alter table public.profiles enable row level security;
alter table public.actions enable row level security;
alter table public.gembas enable row level security;
alter table public.audits enable row level security;
alter table public.improvement_projects enable row level security;
alter table public.best_practices enable row level security;
alter table public.kpi_measurements enable row level security;
alter table public.toolkit_runs enable row level security;
alter table public.knowledge_sources enable row level security;

drop policy if exists "profiles_read" on public.profiles;
create policy "profiles_read" on public.profiles for select to authenticated using (user_id=auth.uid() or public.current_user_role()='admin');
drop policy if exists "profiles_insert_self" on public.profiles;
create policy "profiles_insert_self" on public.profiles for insert to authenticated with check (public.current_user_role()='admin');
drop policy if exists "profiles_update" on public.profiles;
create policy "profiles_update" on public.profiles for update to authenticated using (public.current_user_role()='admin') with check (public.current_user_role()='admin');

do $$
declare t text;
begin
  foreach t in array array['actions','gembas','improvement_projects','best_practices','kpi_measurements','toolkit_runs','knowledge_sources'] loop
    execute format('drop policy if exists %I on public.%I','read_scope_'||t,t);
    execute format('create policy %I on public.%I for select to authenticated using (site_id=public.current_user_site() or public.current_user_role()=''admin'')','read_scope_'||t,t);
    execute format('drop policy if exists %I on public.%I','insert_scope_'||t,t);
    execute format('create policy %I on public.%I for insert to authenticated with check (created_by=auth.uid() and (site_id=public.current_user_site() or public.current_user_role()=''admin''))','insert_scope_'||t,t);
    execute format('drop policy if exists %I on public.%I','update_scope_'||t,t);
    execute format('create policy %I on public.%I for update to authenticated using (public.current_user_role()=''admin'' or (site_id=public.current_user_site() and (created_by=auth.uid() or public.current_user_role()=''manager''))) with check (public.current_user_role()=''admin'' or (site_id=public.current_user_site() and (created_by=auth.uid() or public.current_user_role()=''manager'')))','update_scope_'||t,t);
  end loop;
end $$;

drop policy if exists "audit_read_scope" on public.audits;
create policy "audit_read_scope" on public.audits for select to authenticated using (site_id=public.current_user_site() or public.current_user_role()='admin');
drop policy if exists "audit_insert_scope" on public.audits;
create policy "audit_insert_scope" on public.audits for insert to authenticated with check (auditor_id=auth.uid() and (site_id=public.current_user_site() or public.current_user_role()='admin'));

insert into storage.buckets(id,name,public) values('bia-media','bia-media',false) on conflict(id) do nothing;
drop policy if exists "media_insert_own" on storage.objects;
create policy "media_insert_own" on storage.objects for insert to authenticated with check (bucket_id='bia-media' and (storage.foldername(name))[1]=auth.uid()::text);
drop policy if exists "media_read_authenticated" on storage.objects;
create policy "media_read_authenticated" on storage.objects for select to authenticated using (bucket_id='bia-media' and ((storage.foldername(name))[1]=auth.uid()::text or public.current_user_role()='admin'));

-- Ajouter les tables à supabase_realtime seulement après contrôle de la publication existante.
-- Ce fichier décrit une nouvelle base. Sur la base V4, réaliser une migration contrôlée :
-- CREATE TABLE IF NOT EXISTS ne modifie ni les colonnes ni les anciennes politiques.
