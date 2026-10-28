-- Proposed schema for the NØVA storefront/admin project.
-- This file is intentionally a draft for review in the Supabase SQL Editor.
-- It is based on the client-side contract observed in the app, not on a verified
-- remote schema. Adjust the admin UUID and policies to match the real project.

create extension if not exists pgcrypto;

create table if not exists public.produtos_nova (
    id uuid primary key default gen_random_uuid(),
    nome text not null,
    slug text unique,
    descricao text,
    categoria text not null default 'Geral',
    preco numeric(12,2) not null default 0,
    estoque integer not null default 0,
    ativo boolean not null default true,
    imagem text,
    imagens jsonb not null default '[]'::jsonb,
    tags text[] default array[]::text[],
    destaque boolean not null default false,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create table if not exists public.configuracoes_nova (
    id text primary key,
    configuracoes jsonb not null default '{}'::jsonb,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create table if not exists public.pedidos_nova (
    id uuid primary key default gen_random_uuid(),
    status text not null default 'Pendente' check (status in ('Pendente', 'Processando', 'Enviado', 'Entregue', 'Cancelado')),
    cliente jsonb not null default '{}'::jsonb,
    itens jsonb not null default '[]'::jsonb,
    subtotal numeric(12,2) not null default 0,
    frete numeric(12,2) not null default 0,
    total numeric(12,2) not null default 0,
    metodo_pagamento text not null default 'Nao configurado',
    observacoes text,
    idempotency_key text unique,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
    new.updated_at = now();
    return new;
end;
$$;

drop trigger if exists trg_produtos_nova_updated_at on public.produtos_nova;
create trigger trg_produtos_nova_updated_at
before update on public.produtos_nova
for each row execute function public.set_updated_at();

drop trigger if exists trg_configuracoes_nova_updated_at on public.configuracoes_nova;
create trigger trg_configuracoes_nova_updated_at
before update on public.configuracoes_nova
for each row execute function public.set_updated_at();

drop trigger if exists trg_pedidos_nova_updated_at on public.pedidos_nova;
create trigger trg_pedidos_nova_updated_at
before update on public.pedidos_nova
for each row execute function public.set_updated_at();

create index if not exists idx_produtos_nova_ativo
    on public.produtos_nova (ativo, created_at desc);

create index if not exists idx_produtos_nova_categoria
    on public.produtos_nova (categoria, ativo);

create index if not exists idx_pedidos_nova_status
    on public.pedidos_nova (status, created_at desc);

create index if not exists idx_pedidos_nova_idempotency
    on public.pedidos_nova (idempotency_key);

-- The app also expects a product-image bucket named nova-produtos.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('nova-produtos', 'nova-produtos', true, 5242880, array['image/jpeg', 'image/png', 'image/webp', 'image/gif'])
on conflict (id) do nothing;

-- Security baseline for the observed app contract.
-- Replace the UUID below with the real admin user id if it differs.
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
grant select on public.produtos_nova, public.configuracoes_nova to anon, authenticated;
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

drop policy if exists "admin_manage_orders" on public.pedidos_nova;
create policy "admin_manage_orders"
on public.pedidos_nova
for select
using (public.is_nova_admin());

drop policy if exists "admin_update_orders" on public.pedidos_nova;
create policy "admin_update_orders"
on public.pedidos_nova
for update
using (public.is_nova_admin())
with check (public.is_nova_admin());

-- Storage policies: public may read product images, admin may upload/replace.
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
