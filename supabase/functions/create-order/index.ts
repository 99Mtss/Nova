import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const ADMIN_UID = Deno.env.get('ADMIN_UID') || '8cdc142e-fce4-4fb6-975c-7cffa005d382';
const ALLOW_PUBLIC_ORDER_CREATION = (Deno.env.get('ALLOW_PUBLIC_ORDER_CREATION') || 'false').toLowerCase() === 'true';

const badRequest = (message: string) => new Response(JSON.stringify({ error: message }), {
  status: 400,
  headers: { 'Content-Type': 'application/json' },
});

const serverError = (message: string, status = 500) => new Response(JSON.stringify({ error: message }), {
  status,
  headers: { 'Content-Type': 'application/json' },
});

Deno.serve(async (req) => {
  try {
    const url = Deno.env.get('SUPABASE_URL');
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!url || !serviceKey) {
      return serverError('Missing Supabase configuration for Edge Function.', 500);
    }

    const authHeader = req.headers.get('Authorization');
    const body = await req.json().catch(() => ({}));
    const { items, customer, idempotencyKey, shipping, paymentMethod } = body ?? {};

    if (!Array.isArray(items) || items.length === 0) {
      return badRequest('O carrinho está vazio.');
    }

    if (typeof idempotencyKey !== 'string' || !idempotencyKey.trim()) {
      return badRequest('idempotencyKey é obrigatório.');
    }

    const supabaseAdmin = createClient(url, serviceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
      global: { headers: { Authorization: `Bearer ${serviceKey}` } },
    });

    const authToken = authHeader && authHeader.startsWith('Bearer ') ? authHeader : null;
    const userClient = createClient(url, serviceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
      global: { headers: { Authorization: authToken ?? '' } },
    });

    const { data: userData, error: userError } = await userClient.auth.getUser();
    if (userError || !userData?.user) {
      return serverError('Autenticação obrigatória para criar pedidos.', 401);
    }

    const userId = userData.user.id;
    const isAdmin = userId === ADMIN_UID;
    const canCreateOrder = ALLOW_PUBLIC_ORDER_CREATION || isAdmin;

    if (!canCreateOrder) {
      return serverError('A criação de pedidos não está autorizada para este usuário.', 403);
    }

    const productIds = [...new Set(items.map((item: any) => String(item.id)).filter(Boolean))];
    if (productIds.length === 0) {
      return badRequest('Nenhum item válido foi enviado no pedido.');
    }

    const { data: products, error: productsError } = await supabaseAdmin
      .from('produtos_nova')
      .select('id, nome, preco, estoque, ativo')
      .in('id', productIds);

    if (productsError) {
      return serverError('Não foi possível validar os produtos do pedido.', 500);
    }

    const productsById = new Map((products ?? []).map((product: any) => [String(product.id), product]));
    const invalidProducts = productIds.filter((id) => !productsById.has(id));
    if (invalidProducts.length > 0) {
      return badRequest('Alguns produtos não existem mais na loja.');
    }

    const orderItems: Array<any> = [];
    let subtotal = 0;

    for (const item of items) {
      const productId = String(item.id);
      const product = productsById.get(productId);
      const quantity = Number(item.quantidade ?? item.quantity ?? 1);

      if (!product || product.ativo !== true) {
        return badRequest(`O produto ${productId} não está disponível.`);
      }

      if (!Number.isFinite(quantity) || quantity <= 0) {
        return badRequest(`Quantidade inválida para o produto ${productId}.`);
      }

      if (Number(product.estoque) < quantity) {
        return badRequest(`Estoque insuficiente para o produto ${product.nome}.`);
      }

      const unitPrice = Number(product.preco ?? 0);
      const totalLine = unitPrice * quantity;
      subtotal += totalLine;

      orderItems.push({
        id: productId,
        nome: product.nome,
        quantidade: quantity,
        preco_unitario: unitPrice,
        subtotal: totalLine,
      });
    }

    const deliveryFee = Number(shipping?.valor ?? shipping?.value ?? 0);
    const total = subtotal + (Number.isFinite(deliveryFee) ? deliveryFee : 0);

    const existingOrder = await supabaseAdmin
      .from('pedidos_nova')
      .select('id')
      .eq('idempotency_key', idempotencyKey.trim())
      .maybeSingle();

    if (existingOrder.error) {
      return serverError('Não foi possível verificar a idempotência do pedido.', 500);
    }

    if (existingOrder.data?.id) {
      return new Response(JSON.stringify({
        ok: true,
        orderId: existingOrder.data.id,
        idempotent: true,
        message: 'Pedido já foi processado.',
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const orderPayload = {
      status: 'Pendente',
      cliente: {
        id: userId,
        nome: customer?.nome ?? customer?.name ?? 'Cliente NØVA',
        email: customer?.email ?? null,
      },
      itens: orderItems,
      subtotal,
      frete: deliveryFee,
      total,
      metodo_pagamento: paymentMethod ?? 'Nao configurado',
      observacoes: shipping?.observacoes ?? null,
      idempotency_key: idempotencyKey.trim(),
    };

    const { data: insertedOrder, error: insertError } = await supabaseAdmin
      .from('pedidos_nova')
      .insert(orderPayload)
      .select('id')
      .single();

    if (insertError) {
      return serverError('Falha ao registrar o pedido no banco.', 500);
    }

    for (const item of items) {
      const productId = String(item.id);
      const product = productsById.get(productId);
      const quantity = Number(item.quantidade ?? item.quantity ?? 1);

      if (!product) continue;

      const nextStock = Number(product.estoque) - quantity;
      const { error: stockError } = await supabaseAdmin
        .from('produtos_nova')
        .update({
          estoque: nextStock,
          updated_at: new Date().toISOString(),
        })
        .eq('id', productId);

      if (stockError) {
        await supabaseAdmin.from('pedidos_nova').update({ status: 'Cancelado' }).eq('id', insertedOrder.id);
        return serverError('Falha ao reservar estoque do pedido.', 500);
      }
    }

    return new Response(JSON.stringify({
      ok: true,
      orderId: insertedOrder.id,
      status: 'Pendente',
      subtotal,
      total,
    }), {
      status: 201,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Erro inesperado no Edge Function.';
    return serverError(message, 500);
  }
});
