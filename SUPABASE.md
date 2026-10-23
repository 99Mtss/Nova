# Supabase integration status

The browser code references the `public` tables `produtos_nova`,
`pedidos_nova`, and `configuracoes_nova`, and the Storage bucket
`nova-produtos`. These names and the columns used by the frontend are code
references, not a verified description of the live database.

There are no SQL migrations, schema definitions, or remote database results in
this workspace. Consequently, column types, constraints, relationships, RLS
policies, Storage policies, indexes, triggers, functions, and grants remain
unverified. No claim is made that the remote Supabase project was queried.

## Read-only schema inventory

Review and run [`supabase/audit_schema.sql`](./supabase/audit_schema.sql) in the
Supabase SQL Editor. It contains catalog `SELECT` statements only and does not
create or alter database objects. Save the results alongside the project
review before designing a migration.

A draft schema proposal for the storefront/admin contract is available at
[`supabase/001_nova_schema.sql`](./supabase/001_nova_schema.sql). It is a
reviewable starting point based on the client-side app contract and must be
validated against the real Supabase project before execution.

The minimal permission fix for the verified issue is in
[`supabase/002_nova_permissions.sql`](./supabase/002_nova_permissions.sql). It
restores storefront reads for products/configs and keeps `pedidos_nova`
admin-only while the server-side order creation flow is not yet implemented.

The secure server-side order endpoint lives in
[`supabase/functions/create-order/index.ts`](./supabase/functions/create-order/index.ts).
It validates the authenticated user, checks product stock at the server, blocks
public order creation by default, and creates a single transactional order
record with idempotency protection.

## Checkout is intentionally blocked

The workspace has no shipping-rate provider or configured shipping rule, no
payment-provider integration, and no server-side order-creation function or
Edge Function. The browser previously inserted caller-supplied prices,
shipping, totals, and status directly into `pedidos_nova`; that path is now
blocked. Do not enable checkout or create a replacement RPC until the live
schema, RLS policies, delivery rules, payment flow, and authorized admin access
have been reviewed.

A safe order-creation implementation must calculate prices and totals from
database records, validate delivery and payment, reserve/decrement stock
atomically, and enforce idempotency on the server. It must also preserve
admin-only order and catalog management under RLS. No migration is supplied
for those behaviors because the necessary schema and policy evidence is not
available here; drafting one against guessed columns or permissions could
weaken security or break existing data.

## Configuration required to resume checkout

1. Run the read-only inventory and review its results.
2. Confirm the delivery provider or the store's approved shipping rules.
3. Select and configure an actual payment provider; do not mark payment as
   confirmed based on the browser.
4. Design and review a server-side transactional order operation, including
   product/stock validation, idempotency, and least-privilege grants.
5. Test RLS and the order flow in a non-production Supabase environment before
   enabling the checkout UI.
