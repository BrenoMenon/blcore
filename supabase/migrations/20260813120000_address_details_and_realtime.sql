-- Endereço detalhado (número, complemento, bairro) e categoria personalizada
alter table public.profiles add column if not exists address_number text;
alter table public.profiles add column if not exists address_complement text;
alter table public.profiles add column if not exists neighborhood text;
alter table public.profiles add column if not exists custom_category text;

-- Realtime: garante que agendamentos e notificações emitam eventos
alter table public.appointments replica identity full;
alter table public.notifications replica identity full;

do $$
declare t text;
begin
  foreach t in array array['appointments','notifications','services','clients']
  loop
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t
    ) then
      execute format('alter publication supabase_realtime add table public.%I', t);
    end if;
  end loop;
end $$;
