-- Read-only inventory for reviewing the live Supabase schema.
-- Run in the Supabase SQL Editor; this file does not change database objects.

-- Columns and declared types for the application tables referenced by the client.
select
    table_schema,
    table_name,
    ordinal_position,
    column_name,
    data_type,
    udt_name,
    is_nullable,
    column_default
from information_schema.columns
where table_schema = 'public'
  and table_name in (
      'produtos_nova',
      'pedidos_nova',
      'configuracoes_nova'
  )
order by table_name, ordinal_position;

-- Primary, unique, foreign-key, and check constraints on those tables.
select
    tc.table_schema,
    tc.table_name,
    tc.constraint_name,
    tc.constraint_type,
    kcu.column_name,
    ccu.table_schema as referenced_schema,
    ccu.table_name as referenced_table,
    ccu.column_name as referenced_column,
    check_constraints.check_clause
from information_schema.table_constraints tc
left join information_schema.key_column_usage kcu
    on kcu.constraint_catalog = tc.constraint_catalog
   and kcu.constraint_schema = tc.constraint_schema
   and kcu.constraint_name = tc.constraint_name
   and kcu.table_schema = tc.table_schema
   and kcu.table_name = tc.table_name
left join information_schema.constraint_column_usage ccu
    on ccu.constraint_catalog = tc.constraint_catalog
   and ccu.constraint_schema = tc.constraint_schema
   and ccu.constraint_name = tc.constraint_name
left join information_schema.check_constraints
    on check_constraints.constraint_catalog = tc.constraint_catalog
   and check_constraints.constraint_schema = tc.constraint_schema
   and check_constraints.constraint_name = tc.constraint_name
where tc.table_schema = 'public'
  and tc.table_name in (
      'produtos_nova',
      'pedidos_nova',
      'configuracoes_nova'
  )
order by tc.table_name, tc.constraint_name, kcu.ordinal_position;

-- Index definitions, including uniqueness and primary-key indexes.
select schemaname, tablename, indexname, indexdef
from pg_indexes
where schemaname = 'public'
  and tablename in (
      'produtos_nova',
      'pedidos_nova',
      'configuracoes_nova'
  )
order by tablename, indexname;

-- RLS enablement/force status for the application tables and Storage objects.
select
    n.nspname as schema_name,
    c.relname as table_name,
    c.relrowsecurity as rls_enabled,
    c.relforcerowsecurity as rls_forced
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where (n.nspname = 'public'
       and c.relname in (
           'produtos_nova',
           'pedidos_nova',
           'configuracoes_nova'
       ))
   or (n.nspname = 'storage' and c.relname = 'objects')
order by n.nspname, c.relname;

-- RLS policies for the application tables and Storage objects.
select
    schemaname,
    tablename,
    policyname,
    permissive,
    roles,
    cmd,
    qual,
    with_check
from pg_policies
where (schemaname = 'public'
       and tablename in (
           'produtos_nova',
           'pedidos_nova',
           'configuracoes_nova'
       ))
   or (schemaname = 'storage' and tablename = 'objects')
order by schemaname, tablename, policyname;

-- Storage bucket settings for the product-image bucket referenced by the client.
select id, name, public, file_size_limit, allowed_mime_types
from storage.buckets
where id = 'nova-produtos';

-- Non-internal triggers attached to the application tables.
select
    trigger_ns.nspname as schema_name,
    table_class.relname as table_name,
    trigger_class.relname as trigger_name,
    pg_get_triggerdef(trigger_class.oid, true) as trigger_definition,
    function_ns.nspname as function_schema,
    function_class.relname as function_name
from pg_trigger trigger_class
join pg_class table_class on table_class.oid = trigger_class.tgrelid
join pg_namespace trigger_ns on trigger_ns.oid = table_class.relnamespace
join pg_proc function_class on function_class.oid = trigger_class.tgfoid
join pg_namespace function_ns on function_ns.oid = function_class.pronamespace
where not trigger_class.tgisinternal
  and trigger_ns.nspname = 'public'
  and table_class.relname in (
      'produtos_nova',
      'pedidos_nova',
      'configuracoes_nova'
  )
order by table_class.relname, trigger_class.relname;

-- Functions that may participate in order, stock, payment, or authorization flows.
select
    function_ns.nspname as function_schema,
    function_class.proname as function_name,
    pg_get_function_identity_arguments(function_class.oid) as arguments,
    pg_get_function_result(function_class.oid) as return_type,
    function_class.prosecdef as security_definer,
    function_class.provolatile as volatility,
    pg_get_functiondef(function_class.oid) as definition
from pg_proc function_class
join pg_namespace function_ns on function_ns.oid = function_class.pronamespace
where function_ns.nspname in ('public', 'storage')
  and function_class.prokind in ('f', 'p')
order by function_ns.nspname, function_class.proname;
