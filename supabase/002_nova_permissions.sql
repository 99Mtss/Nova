

create or replace function public.is_nova_admin()
returns boolean
language sql
stable
as $$
    select auth.uid() = '8cdc142e-fce4-4fb6-975c-7cffa005d382'::uuid;
$$;

grant usage on schema public to anon, authenticated;

grant select on public.produtos_nova to anon, authenticated;
grant select on public.configuracoes_nova to anon, authenticated;

grant select, update on public.pedidos_nova to authenticated;

alter table public.produtos_nova enable row level security;
alter table public.configuracoes_nova enable row level security;
alter table public.pedidos_nova enable row level security;

drop policy if exists "public_read_active_products" on public.produtos_nova;
create policy "public_read_active_products"
on public.produtos_nova
for select
using (ativo = true);

drop policy if exists "public_read_store_config" on public.configuracoes_nova;
create policy "public_read_store_config"
on public.configuracoes_nova
for select
using (true);

drop policy if exists "admin_read_orders" on public.pedidos_nova;
create policy "admin_read_orders"
on public.pedidos_nova
for select
using (public.is_nova_admin());

drop policy if exists "admin_update_orders" on public.pedidos_nova;
create policy "admin_update_orders"
on public.pedidos_nova
for update
using (public.is_nova_admin())
with check (public.is_nova_admin());


create policy if not exists "public_read_nova_bucket"
on storage.objects
for select
using (bucket_id = 'nova-produtos');

create policy if not exists "admin_manage_nova_bucket"
on storage.objects
for all
using (bucket_id = 'nova-produtos' and public.is_nova_admin())
with check (bucket_id = 'nova-produtos' and public.is_nova_admin());
