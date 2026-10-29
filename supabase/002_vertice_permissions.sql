
-- Legacy Supabase object names are retained for compatibility.
create or replace function public.is_nova_admin()
returns boolean
language sql
stable
security invoker
as $$
    select auth.uid() = '8cdc142e-fce4-4fb6-975c-7cffa005d382'::uuid;
$$;

revoke all on function public.is_nova_admin() from public;
grant execute on function public.is_nova_admin() to anon, authenticated;

grant usage on schema public to anon, authenticated;

revoke insert, update, delete on public.produtos_nova, public.configuracoes_nova
    from anon, public;
revoke insert, delete on public.pedidos_nova from anon, authenticated, public;

grant select on public.produtos_nova to anon, authenticated;
grant select on public.configuracoes_nova to anon, authenticated;
grant insert, update, delete on public.produtos_nova, public.configuracoes_nova to authenticated;

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

drop policy if exists "admin_manage_products" on public.produtos_nova;
create policy "admin_manage_products"
on public.produtos_nova
for all
using (public.is_nova_admin())
with check (public.is_nova_admin());

drop policy if exists "admin_manage_store_config" on public.configuracoes_nova;
create policy "admin_manage_store_config"
on public.configuracoes_nova
for all
using (public.is_nova_admin())
with check (public.is_nova_admin());

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

drop policy if exists "public_read_nova_bucket" on storage.objects;
create policy "public_read_nova_bucket"
on storage.objects
for select
using (bucket_id = 'nova-produtos');

drop policy if exists "admin_manage_nova_bucket" on storage.objects;
create policy "admin_manage_nova_bucket"
on storage.objects
for all
using (bucket_id = 'nova-produtos' and public.is_nova_admin())
with check (bucket_id = 'nova-produtos' and public.is_nova_admin());
