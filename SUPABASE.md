# Supabase integration status

The browser code references the `public` tables `produtos_nova`,
`pedidos_nova`, and `configuracoes_nova`, and the Storage bucket
`nova-produtos`. These names and the columns used by the frontend are code
references, not a verified description of the live database.

There are draft SQL scripts in this workspace, but no verified remote schema
definition or database results. Consequently, the live column types,
constraints, relationships, RLS policies, Storage policies, indexes, triggers,
functions, and grants remain unverified. No claim is made that the remote
Supabase project was queried.

## Read-only schema inventory

Review and run [`supabase/audit_schema.sql`](./supabase/audit_schema.sql) in the
Supabase SQL Editor. It contains catalog `SELECT` statements only and does not
create or alter database objects. Save the results alongside the project
review before designing a migration.

## Storefront imagery

Storefront images must be uploaded to the `nova-produtos` Supabase Storage
bucket and their public paths/URLs saved in database fields. Product images
come from `produtos_nova.imagem` / `produtos_nova.imagens`; the home hero and
collection banner come from `configuracoes_nova.configuracoes.banner` and
`bannerColecao`. Home category cards use an image from an active product in the
matching category. HTML and CSS contain no image asset URLs or image-file
fallbacks; missing database imagery renders without an image.

The admin product editor and store settings page upload image files directly
to the `nova-produtos` bucket. Uploads accept JPEG, PNG, WebP, and GIF files up
to 5 MB, and require an authenticated admin Storage policy. The draft policy
is in `supabase/002_vertice_permissions.sql`; verify the live bucket settings and
policies before expecting uploads to work. A successful banner upload still
requires saving the store settings to update the database reference.

## Storefront theme

The storefront uses the new neutral Vértice palette by default. Saved colors in
`configuracoes_nova.configuracoes.cores` are applied only when the same JSON
object includes `temaVisual: "personalizado"`. This prevents older saved colors
from overriding the redesigned palette. The admin settings page loads the
defaults for older configurations; saving the identity settings writes the new
colors and the marker together.

A draft schema proposal for the storefront/admin contract is available at
[`supabase/001_vertice_schema.sql`](./supabase/001_vertice_schema.sql). It is a
reviewable starting point based on the client-side app contract and must be
validated against the real Supabase project before execution.

The permission baseline is in
[`supabase/002_vertice_permissions.sql`](./supabase/002_vertice_permissions.sql). It
allows storefront reads, grants catalog/configuration writes only to
authenticated sessions that pass the admin RLS policies, and keeps order
access admin-only. The policies are recreated safely on each run. Review the
live schema first; the script assumes the table and column names shown above.

The Edge Function at
[`supabase/functions/create-order/index.ts`](./supabase/functions/create-order/index.ts)
currently rejects order creation with HTTP 503. It must remain disabled until a
server-side transaction can validate prices, delivery, payment, stock, and
idempotency atomically. Do not enable it by setting an environment variable.

## Checkout is intentionally blocked

The workspace has no shipping-rate provider or configured shipping rule and no
payment-provider integration. The browser previously inserted caller-supplied
prices, shipping, totals, and status directly into `pedidos_nova`; that path is
blocked, and the Edge Function now fails closed. Do not enable checkout or
create a replacement RPC until the live schema, RLS policies, delivery rules,
payment flow, and authorized admin access have been reviewed.

A safe order-creation implementation must calculate prices and totals from
database records, validate delivery and payment, reserve/decrement stock
atomically, and enforce idempotency on the server. It must also preserve
admin-only order and catalog management under RLS. No migration is supplied
for those behaviors because the necessary schema and policy evidence is not
available here; drafting one against guessed columns or permissions could
weaken security or break existing data.

Coupon definitions are stored in
`configuracoes_nova.configuracoes.cupons`. The checkout currently applies a
browser-only preview of the percentage, expiration date, and minimum order;
this is not a redemption or a trusted discount. Usage limits cannot be checked
from the browser. Before enabling checkout, the order transaction must reload
and validate the coupon and atomically enforce/consume its usage limit with
order creation.

The shipping settings page stores the origin CEP and optional local pickup /
motoboy contact details in `configuracoes_nova.configuracoes.frete`. The
checkout does not return carrier rates yet: PAC/SEDEX remain pending until the
store has a Melhor Envio account and a server-side quote integration with its
authorization stored as a server secret. Never put provider credentials in
public store configuration. Pickup and motoboy stay hidden until an admin
confirms and enables their address/contact details. Browser display of these
options does not enable order creation or verify a delivery charge.

## Configuration required to resume checkout

1. Run the read-only inventory and review its results.
2. Create and authorize the Melhor Envio account; implement and test a
   server-side quote integration using the shop's origin CEP and destination
   CEP, and configure its token as a server secret.
3. Select and configure an actual payment provider; do not mark payment as
   confirmed based on the browser.
4. Design and review a server-side transactional order operation, including
   product/stock and coupon validation, atomic usage-limit enforcement,
   idempotency, and least-privilege grants.
5. Test RLS and the order flow in a non-production Supabase environment before
   enabling the checkout UI.
