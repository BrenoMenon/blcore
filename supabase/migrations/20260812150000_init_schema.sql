-- =====================================================================
-- BL CORE — schema completo (executar 1x no SQL Editor do Supabase)
-- Idempotente: pode rodar novamente sem erro.
-- =====================================================================

-- ---------- ENUMS ----------
do $$ begin
  create type public.user_type as enum ('client','company');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.appointment_status as enum
    ('pending','scheduled','confirmed','in_progress','completed','cancelled','declined');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.reminder_offset as enum ('off','m30','h1','h2','h12','h24');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.reminder_status as enum ('pending','sent','failed','cancelled');
exception when duplicate_object then null; end $$;

-- ---------- HELPER: updated_at ----------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ---------- PROFILES ----------
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  business_name text,
  user_type public.user_type not null default 'client',
  avatar_url text,
  bio text,
  category text,
  phone text,
  whatsapp text,
  address text,
  city text,
  state text,
  lat double precision,
  lng double precision,
  is_public boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

grant select, insert, update, delete on public.profiles to authenticated;
grant select on public.profiles to anon;
grant all on public.profiles to service_role;
alter table public.profiles enable row level security;

drop policy if exists "profiles_select_own" on public.profiles;
create policy "profiles_select_own" on public.profiles
  for select to authenticated using (auth.uid() = id);

drop policy if exists "profiles_select_public_companies" on public.profiles;
create policy "profiles_select_public_companies" on public.profiles
  for select to authenticated, anon
  using (user_type = 'company' and is_public = true);

drop policy if exists "profiles_insert_own" on public.profiles;
create policy "profiles_insert_own" on public.profiles
  for insert to authenticated with check (auth.uid() = id);

drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own" on public.profiles
  for update to authenticated using (auth.uid() = id) with check (auth.uid() = id);

drop trigger if exists profiles_set_updated_at on public.profiles;
create trigger profiles_set_updated_at before update on public.profiles
  for each row execute function public.set_updated_at();

-- ---------- COMPANY SETTINGS ----------
create table if not exists public.company_settings (
  user_id uuid primary key references auth.users(id) on delete cascade,
  company_name text,
  logo_url text,
  phone text,
  whatsapp text,
  address text,
  theme text,
  primary_color text,
  business_hours jsonb,
  reminder_offset public.reminder_offset default 'h1',
  reminder_template text,
  whatsapp_provider text,
  whatsapp_config jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

grant select, insert, update, delete on public.company_settings to authenticated;
grant all on public.company_settings to service_role;
alter table public.company_settings enable row level security;

drop policy if exists "company_settings_all_own" on public.company_settings;
create policy "company_settings_all_own" on public.company_settings
  for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop trigger if exists company_settings_set_updated_at on public.company_settings;
create trigger company_settings_set_updated_at before update on public.company_settings
  for each row execute function public.set_updated_at();

-- ---------- SERVICES ----------
create table if not exists public.services (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  description text,
  price numeric(10,2) not null default 0,
  duration_min integer not null default 30,
  color text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists services_user_id_idx on public.services(user_id);

grant select, insert, update, delete on public.services to authenticated;
grant select on public.services to anon;
grant all on public.services to service_role;
alter table public.services enable row level security;

drop policy if exists "services_all_own" on public.services;
create policy "services_all_own" on public.services
  for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "services_select_active_public" on public.services;
create policy "services_select_active_public" on public.services
  for select to authenticated, anon
  using (
    active = true and exists (
      select 1 from public.profiles p
      where p.id = services.user_id and p.user_type = 'company' and p.is_public = true
    )
  );

drop trigger if exists services_set_updated_at on public.services;
create trigger services_set_updated_at before update on public.services
  for each row execute function public.set_updated_at();

-- ---------- CLIENTS (CRM da empresa) ----------
create table if not exists public.clients (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  client_user_id uuid references auth.users(id) on delete set null,
  name text not null,
  email text,
  phone text,
  whatsapp text,
  birth_date date,
  avatar_url text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists clients_user_id_idx on public.clients(user_id);

grant select, insert, update, delete on public.clients to authenticated;
grant all on public.clients to service_role;
alter table public.clients enable row level security;

drop policy if exists "clients_all_own" on public.clients;
create policy "clients_all_own" on public.clients
  for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop trigger if exists clients_set_updated_at on public.clients;
create trigger clients_set_updated_at before update on public.clients
  for each row execute function public.set_updated_at();

-- ---------- APPOINTMENTS ----------
create table if not exists public.appointments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,          -- empresa
  client_id uuid references public.clients(id) on delete set null,
  client_user_id uuid references auth.users(id) on delete set null,           -- cliente logado
  service_id uuid not null references public.services(id) on delete cascade,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  status public.appointment_status not null default 'pending',
  price numeric(10,2),
  notes text,
  decline_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists appointments_user_id_idx on public.appointments(user_id);
create index if not exists appointments_client_user_id_idx on public.appointments(client_user_id);
create index if not exists appointments_starts_at_idx on public.appointments(starts_at);

grant select, insert, update, delete on public.appointments to authenticated;
grant all on public.appointments to service_role;
alter table public.appointments enable row level security;

drop policy if exists "appointments_select" on public.appointments;
create policy "appointments_select" on public.appointments
  for select to authenticated
  using (auth.uid() = user_id or auth.uid() = client_user_id);

drop policy if exists "appointments_insert" on public.appointments;
create policy "appointments_insert" on public.appointments
  for insert to authenticated
  with check (auth.uid() = user_id or auth.uid() = client_user_id);

drop policy if exists "appointments_update" on public.appointments;
create policy "appointments_update" on public.appointments
  for update to authenticated
  using (auth.uid() = user_id or auth.uid() = client_user_id)
  with check (auth.uid() = user_id or auth.uid() = client_user_id);

drop policy if exists "appointments_delete" on public.appointments;
create policy "appointments_delete" on public.appointments
  for delete to authenticated
  using (auth.uid() = user_id or auth.uid() = client_user_id);

drop trigger if exists appointments_set_updated_at on public.appointments;
create trigger appointments_set_updated_at before update on public.appointments
  for each row execute function public.set_updated_at();

-- ---------- WHATSAPP REMINDERS ----------
create table if not exists public.whatsapp_reminders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  appointment_id uuid not null references public.appointments(id) on delete cascade,
  scheduled_for timestamptz not null,
  sent_at timestamptz,
  status public.reminder_status not null default 'pending',
  attempts integer not null default 0,
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists whatsapp_reminders_user_id_idx on public.whatsapp_reminders(user_id);

grant select, insert, update, delete on public.whatsapp_reminders to authenticated;
grant all on public.whatsapp_reminders to service_role;
alter table public.whatsapp_reminders enable row level security;

drop policy if exists "whatsapp_reminders_all_own" on public.whatsapp_reminders;
create policy "whatsapp_reminders_all_own" on public.whatsapp_reminders
  for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop trigger if exists whatsapp_reminders_set_updated_at on public.whatsapp_reminders;
create trigger whatsapp_reminders_set_updated_at before update on public.whatsapp_reminders
  for each row execute function public.set_updated_at();

-- ---------- RECOVERY KEYS ----------
create table if not exists public.recovery_keys (
  user_id uuid primary key references auth.users(id) on delete cascade,
  email text,
  question text not null,
  answer_hash text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists recovery_keys_email_idx on public.recovery_keys(lower(email));

grant select, insert, update, delete on public.recovery_keys to authenticated;
grant all on public.recovery_keys to service_role;
alter table public.recovery_keys enable row level security;

-- Somente o dono acessa; a recuperação de senha usa a service role (bypassa RLS).
drop policy if exists "recovery_keys_all_own" on public.recovery_keys;
create policy "recovery_keys_all_own" on public.recovery_keys
  for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop trigger if exists recovery_keys_set_updated_at on public.recovery_keys;
create trigger recovery_keys_set_updated_at before update on public.recovery_keys
  for each row execute function public.set_updated_at();

-- ---------- TRIGGER: cria perfil ao criar usuário ----------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_type public.user_type;
begin
  v_type := coalesce(nullif(new.raw_user_meta_data->>'user_type','')::public.user_type, 'client');

  insert into public.profiles (id, full_name, business_name, user_type)
  values (
    new.id,
    nullif(new.raw_user_meta_data->>'full_name',''),
    nullif(new.raw_user_meta_data->>'business_name',''),
    v_type
  )
  on conflict (id) do nothing;

  if v_type = 'company' then
    insert into public.company_settings (user_id, company_name)
    values (new.id, coalesce(nullif(new.raw_user_meta_data->>'business_name',''),
                             nullif(new.raw_user_meta_data->>'full_name','')))
    on conflict (user_id) do nothing;
  end if;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Cria perfis para usuários que já existem sem perfil
insert into public.profiles (id, full_name, user_type)
select u.id,
       nullif(u.raw_user_meta_data->>'full_name',''),
       coalesce(nullif(u.raw_user_meta_data->>'user_type','')::public.user_type,'client')
from auth.users u
left join public.profiles p on p.id = u.id
where p.id is null;

-- ---------- STORAGE: bucket de avatares ----------
insert into storage.buckets (id, name, public)
values ('avatars','avatars', false)
on conflict (id) do nothing;

drop policy if exists "avatars_read_own" on storage.objects;
create policy "avatars_read_own" on storage.objects
  for select to authenticated
  using (bucket_id = 'avatars');

drop policy if exists "avatars_insert_own" on storage.objects;
create policy "avatars_insert_own" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "avatars_update_own" on storage.objects;
create policy "avatars_update_own" on storage.objects
  for update to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text)
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "avatars_delete_own" on storage.objects;
create policy "avatars_delete_own" on storage.objects
  for delete to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

-- ---------- Política que depende de appointments (criada por último) ----------
-- Empresa pode ver o perfil de quem agendou com ela; cliente vê a empresa onde agendou
drop policy if exists "profiles_select_counterparty" on public.profiles;
create policy "profiles_select_counterparty" on public.profiles
  for select to authenticated using (
    exists (
      select 1 from public.appointments a
      where (a.user_id = auth.uid() and a.client_user_id = profiles.id)
         or (a.client_user_id = auth.uid() and a.user_id = profiles.id)
    )
  );

-- ---------- Auto-confirmação de e-mail ----------
-- O projeto está com "Confirm email" ligado no painel; sem confirmar, o login
-- logo após o cadastro falha. Este trigger confirma o e-mail na criação da
-- conta, mantendo o fluxo do app funcionando sem configuração manual.
create or replace function public.auto_confirm_email()
returns trigger
language plpgsql
security definer
set search_path = auth, public
as $$
begin
  if new.email_confirmed_at is null then
    new.email_confirmed_at := now();
  end if;
  return new;
end;
$$;

drop trigger if exists on_auth_user_auto_confirm on auth.users;
create trigger on_auth_user_auto_confirm
  before insert on auth.users
  for each row execute function public.auto_confirm_email();

update auth.users set email_confirmed_at = now() where email_confirmed_at is null;

-- ---------- Recuperação de senha sem service role ----------
create or replace function public.recovery_question(p_email text)
returns text
language sql
stable
security definer
set search_path = public
as $$
  select question from public.recovery_keys where lower(email) = lower(p_email) limit 1;
$$;

create or replace function public.recovery_reset(p_email text, p_answer_hash text, p_password text)
returns boolean
language plpgsql
security definer
set search_path = public, auth, extensions
as $$
declare
  v_user uuid;
begin
  if length(p_password) < 6 then
    raise exception 'Senha muito curta';
  end if;

  select user_id into v_user
  from public.recovery_keys
  where lower(email) = lower(p_email) and answer_hash = p_answer_hash
  limit 1;

  if v_user is null then
    return false;
  end if;

  update auth.users
     set encrypted_password = extensions.crypt(p_password, extensions.gen_salt('bf')),
         updated_at = now()
   where id = v_user;

  return true;
end;
$$;

revoke all on function public.recovery_question(text) from public;
revoke all on function public.recovery_reset(text, text, text) from public;
grant execute on function public.recovery_question(text) to anon, authenticated;
grant execute on function public.recovery_reset(text, text, text) to anon, authenticated;
