
/* =========================================================
   NØVA — CHECKOUT
   Validação e resumo dos dados atuais do carrinho
   ========================================================= */

document.addEventListener("DOMContentLoaded", () => {
    "use strict";

    const CART_KEY = "novaCarrinho";
    const FRETE_CONFIGURADO = false;
    const CRIACAO_SEGURA_DE_PEDIDOS_CONFIGURADA = false;
    const CHECKOUT_BLOQUEADO =
        "Não é possível finalizar a compra: o frete ainda não está configurado " +
        "e o servidor ainda não valida preços, pagamento e estoque de forma segura.";

    const form = document.querySelector("#checkout-form");
    const finishButton = document.querySelector("#finish-order");
    const loadingElement = document.querySelector("#checkout-loading");
    const errorElement = document.querySelector("#checkout-error");
    const errorMessage = document.querySelector("#checkout-error-message");
    const layout = document.querySelector("#checkout-layout");
    const formMessage = document.querySelector("#checkout-form-message");

    const summaryProducts = document.querySelector("#checkout-summary-products");
    const productsLoading = document.querySelector("#checkout-products-loading");
    const itemsCountElement = document.querySelector("#checkout-items-count");
    const subtotalElement = document.querySelector("#checkout-subtotal");
    const shippingElement = document.querySelector("#checkout-shipping");
    const discountRow = document.querySelector("#checkout-discount-row");
    const discountElement = document.querySelector("#checkout-discount");
    const totalElement = document.querySelector("#checkout-total");
    const couponForm = document.querySelector("#checkout-coupon-form");
    const couponCodeInput = document.querySelector("#checkout-coupon-code");
    const couponFeedback = document.querySelector("#checkout-coupon-feedback");
    const couponApplyButton = document.querySelector("#checkout-coupon-apply");
    const couponRemoveButton = document.querySelector("#checkout-coupon-remove");

    const paymentOptions = document.querySelectorAll(".payment-option");
    const paymentNotice = document.querySelector("#payment-notice");
    const cepInput = document.querySelector("#cep");
    const calculateShippingButton =
        document.querySelector("#checkout-calculate-shipping");
    const shippingFeedback =
        document.querySelector("#checkout-shipping-feedback");
    const pickupOption = document.querySelector("#checkout-pickup-option");
    const pickupAddress = document.querySelector("#checkout-pickup-address");
    const motoboyOption = document.querySelector("#checkout-motoboy-option");
    const motoboyLink = document.querySelector("#checkout-motoboy-link");

    let carrinho = [];
    let configuracoes = {};
    let cupomAplicado = null;

    /* =====================================================
       UTILITÁRIOS
       ===================================================== */

    function formatarPreco(valor) {
        return Number(valor || 0).toLocaleString("pt-BR", {
            style: "currency",
            currency: "BRL"
        });
    }

    function obterSupabase() {
        return window.supabaseClient || null;
    }

    function mostrarMensagem(mensagem) {
        if (formMessage) {
            formMessage.textContent = mensagem;
            formMessage.hidden = false;
            return;
        }

        alert(mensagem);
    }

    function limparMensagem() {
        if (formMessage) {
            formMessage.textContent = "";
            formMessage.hidden = true;
        }
    }

    function renderizarOpcoesEntrega() {
        const frete = configuracoes.frete &&
            typeof configuracoes.frete === "object"
            ? configuracoes.frete
            : {};
        const retirada = frete.retirada &&
            typeof frete.retirada === "object"
            ? frete.retirada
            : {};
        const motoboy = frete.motoboy &&
            typeof frete.motoboy === "object"
            ? frete.motoboy
            : {};

        if (
            pickupOption &&
            pickupAddress &&
            retirada.ativa === true &&
            typeof retirada.endereco === "string" &&
            retirada.endereco.trim()
        ) {
            pickupAddress.textContent = retirada.endereco.trim();
            pickupOption.hidden = false;
        }

        const whatsapp = String(motoboy.whatsapp || "").replace(/\D/g, "");
        if (
            motoboyOption &&
            motoboyLink &&
            motoboy.ativo === true &&
            whatsapp.length >= 12
        ) {
            const texto = encodeURIComponent(
                "Olá! Gostaria de combinar a entrega por motoboy para meu pedido."
            );
            motoboyLink.href = `https://wa.me/${whatsapp}?text=${texto}`;
            motoboyOption.hidden = false;
        }
    }

    function mostrarErro(mensagem) {
        if (errorElement) {
            errorElement.hidden = false;
        }

        if (errorMessage) {
            errorMessage.textContent = mensagem;
        }

        if (layout) {
            layout.hidden = true;
        }
    }

    function lerCarrinho() {
        try {
            const dados = JSON.parse(
                localStorage.getItem(CART_KEY) || "[]"
            );

            if (!Array.isArray(dados)) {
                return [];
            }

            return dados
                .filter(item => item && typeof item === "object")
                .map(item => ({
                    ...item,
                    quantidade: Math.max(
                        1,
                        Math.floor(Number(item.quantidade) || 1)
                    ),
                    preco: Math.max(0, Number(item.preco) || 0)
                }));
        } catch (erro) {
            console.error("Erro ao ler o carrinho:", erro);
            return [];
        }
    }

    function salvarCarrinhoLocal() {
        try {
            localStorage.setItem(CART_KEY, JSON.stringify(carrinho));
        } catch (erro) {
            console.warn(
                "Não foi possível atualizar o carrinho local; os dados desta página foram preservados.",
                erro
            );
            mostrarMensagem(
                "Os dados foram validados nesta página, mas o carrinho não pôde ser atualizado para a próxima visita."
            );
        }
    }

    function calcularQuantidade() {
        return carrinho.reduce(
            (total, item) => total + item.quantidade,
            0
        );
    }

    function calcularSubtotal() {
        return carrinho.reduce(
            (total, item) => total + item.preco * item.quantidade,
            0
        );
    }

    function calcularSubtotalOriginal() {
        return carrinho.reduce((total, item) => {
            const original = Math.max(
                item.preco,
                Number(item.precoOriginal ?? item.preco) || 0
            );

            return total + original * item.quantidade;
        }, 0);
    }

    function calcularDesconto() {
        return Math.max(
            0,
            calcularSubtotalOriginal() - calcularSubtotal()
        );
    }

    function obterCupomPorCodigo(codigo) {
        const cupons = Array.isArray(configuracoes.cupons)
            ? configuracoes.cupons
            : [];
        const codigoNormalizado = codigo.trim().toUpperCase();

        return cupons.find(cupom =>
            String(cupom?.codigo || "").trim().toUpperCase() ===
            codigoNormalizado
        ) || null;
    }

    function validarDataValidade(valor) {
        const partes = String(valor || "").match(
            /^(\d{4})-(\d{2})-(\d{2})$/
        );

        if (!partes) return false;

        const [, ano, mes, dia] = partes;
        const data = new Date(Number(ano), Number(mes) - 1, Number(dia));

        return data.getFullYear() === Number(ano) &&
            data.getMonth() === Number(mes) - 1 &&
            data.getDate() === Number(dia);
    }

    function calcularDescontoCupom() {
        if (!cupomAplicado) return 0;

        return Math.round(
            calcularSubtotal() * cupomAplicado.percentual
        ) / 100;
    }

    function atualizarFeedbackCupom(mensagem, tipo = "info") {
        if (!couponFeedback) return;

        couponFeedback.textContent = mensagem;
        couponFeedback.dataset.type = tipo;
    }

    function aplicarCupom(evento) {
        evento.preventDefault();
        cupomAplicado = null;

        const codigo = String(couponCodeInput?.value || "").trim().toUpperCase();
        const cupom = obterCupomPorCodigo(codigo);

        if (!codigo || !cupom) {
            atualizarFeedbackCupom("Cupom não encontrado.", "erro");
            renderizarResumo();
            return;
        }

        const percentual = Number(cupom.percentual);
        const pedidoMinimo = Number(cupom.pedidoMinimo || 0);

        if (!Number.isFinite(percentual) || percentual <= 0 || percentual > 100) {
            atualizarFeedbackCupom(
                "Este cupom possui uma configuração inválida. Entre em contato com a loja.",
                "erro"
            );
            renderizarResumo();
            return;
        }

        if (cupom.validade) {
            const hoje = new Date();
            const hojeLocal =
                `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, "0")}-${String(hoje.getDate()).padStart(2, "0")}`;

            if (
                !validarDataValidade(cupom.validade) ||
                cupom.validade < hojeLocal
            ) {
                atualizarFeedbackCupom("Este cupom está expirado.", "erro");
                renderizarResumo();
                return;
            }
        }

        if (!Number.isFinite(pedidoMinimo) || pedidoMinimo < 0) {
            atualizarFeedbackCupom(
                "Este cupom possui um pedido mínimo inválido. Entre em contato com a loja.",
                "erro"
            );
            renderizarResumo();
            return;
        }

        if (calcularSubtotal() < pedidoMinimo) {
            atualizarFeedbackCupom(
                `O pedido mínimo para este cupom é ${formatarPreco(pedidoMinimo)}.`,
                "erro"
            );
            renderizarResumo();
            return;
        }

        cupomAplicado = {
            codigo: String(cupom.codigo).trim().toUpperCase(),
            percentual
        };
        if (couponCodeInput) {
            couponCodeInput.value = cupomAplicado.codigo;
        }

        const limiteMensagem = cupom.limiteUso
            ? " O limite de usos ainda será confirmado pelo servidor."
            : "";
        atualizarFeedbackCupom(
            `Cupom aplicado para simulação: ${percentual}% de desconto. A compra continua indisponível até a validação segura no servidor.${limiteMensagem}`,
            "sucesso"
        );

        renderizarResumo();
    }

    if (couponForm) {
        couponForm.addEventListener("submit", aplicarCupom);
    }

    if (couponRemoveButton) {
        couponRemoveButton.addEventListener("click", () => {
            cupomAplicado = null;
            if (couponCodeInput) couponCodeInput.value = "";
            atualizarFeedbackCupom(
                "Cupom removido. A compra segue indisponível até a configuração segura do checkout."
            );
            renderizarResumo();
        });
    }

    /* =====================================================
       CONFIGURAÇÕES E ESTOQUE
       ===================================================== */

    async function atualizarDadosDosProdutos() {
        const supabase = obterSupabase();

        if (!supabase || typeof supabase.from !== "function") {
            throw new Error(
                "Não foi possível conectar ao Supabase. " +
                "Confira a configuração da conexão antes de finalizar."
            );
        }

        const { data: configData, error: configError } = await supabase
            .from("configuracoes_nova")
            .select("configuracoes")
            .eq("id", "loja")
            .maybeSingle();

        if (configError) {
            console.error("Não foi possível carregar as promoções:", configError);
            throw new Error(
                "Não foi possível validar as promoções atuais. Tente novamente."
            );
        } else {
            configuracoes = configData?.configuracoes || {};
        }
        renderizarOpcoesEntrega();
        if (shippingElement) {
            shippingElement.textContent = "Calcule pelo CEP";
        }

        const ids = [
            ...new Set(
                carrinho
                    .map(item => item.id)
                    .filter(id => id !== null && id !== undefined && String(id).trim())
                    .map(String)
            )
        ];

        if (ids.length === 0) {
            throw new Error(
                "Um ou mais itens do carrinho não possuem identificação. " +
                "Volte à loja e adicione os produtos novamente."
            );
        }

        const { data: produtos, error } = await supabase
            .from("produtos_nova")
            .select("id,nome,categoria,preco,estoque,ativo,imagem,imagens")
            .in("id", ids);

        if (error) {
            console.error("Erro ao consultar produtos:", error);
            throw new Error(
                "Não foi possível conferir os preços e o estoque. Tente novamente."
            );
        }

        const produtosPorId = {};

        (produtos || []).forEach(produto => {
            produtosPorId[String(produto.id)] = produto;
        });

        if (ids.some(id => !produtosPorId[id])) {
            throw new Error(
                "Um ou mais produtos não estão mais disponíveis. " +
                "Volte ao carrinho e revise os itens."
            );
        }

        const promocoes = Array.isArray(configuracoes.promocoes)
            ? configuracoes.promocoes
            : [];

        const carrinhoAtualizado = [];

        for (const item of carrinho) {
            const produto = produtosPorId[String(item.id)];

            if (!produto) {
                throw new Error(
                    `O produto "${item.nome}" não foi encontrado na loja.`
                );
            }

            if (produto.ativo !== true) {
                throw new Error(
                    `O produto "${produto.nome}" não está mais disponível.`
                );
            }

            const estoque = Math.max(0, Number(produto.estoque) || 0);

            if (estoque < 1) {
                throw new Error(
                    `O produto "${produto.nome}" está sem estoque.`
                );
            }

            if (item.quantidade > estoque) {
                throw new Error(
                    `Há apenas ${estoque} unidade(s) de "${produto.nome}" em estoque. ` +
                    "Volte ao carrinho e ajuste a quantidade."
                );
            }

            const precoOriginal = Math.max(0, Number(produto.preco) || 0);

            const promocao = promocoes.find(p =>
                String(p.id) === String(produto.id)
            );

            const precoPromocional = promocao
                ? Number(promocao.preco)
                : precoOriginal;

            const preco = Number.isFinite(precoPromocional)
                ? Math.max(0, Math.min(precoPromocional, precoOriginal))
                : precoOriginal;

            const imagens = Array.isArray(produto.imagens)
                ? produto.imagens
                : [];

            const imagem =
                produto.imagem ||
                imagens.find(img => typeof img === "string" && img.trim()) ||
                item.imagem ||
                "";

            carrinhoAtualizado.push({
                ...item,
                id: produto.id,
                nome: produto.nome || item.nome,
                categoria: produto.categoria || item.categoria || "Produto",
                imagem,
                precoOriginal,
                preco,
                estoque
            });
        }

        carrinho = carrinhoAtualizado;
        salvarCarrinhoLocal();
    }

    /* =====================================================
       RESUMO DO PEDIDO
       ===================================================== */

    function renderizarResumo() {
        if (!summaryProducts) {
            console.error("Elemento #checkout-summary-products não encontrado.");
            return;
        }

        summaryProducts
            .querySelectorAll(".summary-product")
            .forEach(item => item.remove());

        carrinho.forEach(produto => {
            const item = document.createElement("div");
            item.className = "summary-product";

            const imagemContainer = document.createElement("div");
            imagemContainer.className = "summary-product-image";

            if (produto.imagem) {
                const imagem = document.createElement("img");
                imagem.src = produto.imagem;
                imagem.alt = produto.nome;
                imagem.loading = "lazy";

                imagem.onerror = () => {
                    imagem.remove();

                    const placeholder = document.createElement("span");
                    placeholder.textContent = "IMG";
                    imagemContainer.appendChild(placeholder);
                };

                imagemContainer.appendChild(imagem);
            } else {
                const placeholder = document.createElement("span");
                placeholder.textContent = "IMG";
                imagemContainer.appendChild(placeholder);
            }

            const quantidade = document.createElement("b");
            quantidade.textContent = String(produto.quantidade);
            imagemContainer.appendChild(quantidade);

            const info = document.createElement("div");
            info.className = "summary-product-info";

            const nome = document.createElement("h3");
            nome.textContent = produto.nome;

            const detalhes = document.createElement("span");
            const variacoes = [];

            if (produto.cor) {
                variacoes.push(`Cor: ${produto.cor}`);
            }

            if (produto.tamanho) {
                variacoes.push(`Tam. ${produto.tamanho}`);
            }

            detalhes.textContent = variacoes.join(" / ") || produto.categoria;

            info.append(nome, detalhes);

            const preco = document.createElement("strong");
            preco.textContent = formatarPreco(
                produto.preco * produto.quantidade
            );

            item.append(imagemContainer, info, preco);
            summaryProducts.appendChild(item);
        });

        const quantidade = calcularQuantidade();
        const subtotal = calcularSubtotal();
        const desconto = calcularDesconto() + calcularDescontoCupom();

        if (itemsCountElement) {
            itemsCountElement.textContent =
                `${quantidade} ${quantidade === 1 ? "item" : "itens"}`;
        }

        if (subtotalElement) {
            subtotalElement.textContent = formatarPreco(subtotal);
        }

        /* O frete permanece sem cálculo até a integração de entrega. */
        if (shippingElement) {
            shippingElement.textContent = FRETE_CONFIGURADO
                ? "A calcular"
                : "Não configurado";
        }

        if (discountElement) {
            discountElement.textContent = `− ${formatarPreco(desconto)}`;
        }

        if (discountRow) {
            discountRow.hidden = desconto <= 0;
        }

        if (couponRemoveButton) {
            couponRemoveButton.hidden = !cupomAplicado;
        }

        /* Ainda não existe cálculo automático de frete. */
        if (totalElement) {
            totalElement.textContent = FRETE_CONFIGURADO
                ? formatarPreco(subtotal)
                : "Indisponível";
        }

        if (productsLoading) {
            productsLoading.hidden = true;
        }

        summaryProducts.setAttribute("aria-busy", "false");
    }

    /* =====================================================
       FORMAS DE PAGAMENTO
       ===================================================== */

    function atualizarPagamentoSelecionado() {
        paymentOptions.forEach(option => {
            const radio = option.querySelector('input[type="radio"]');
            const icone = option.querySelector(".payment-check");

            const selecionado = Boolean(radio?.checked);

            option.classList.toggle("selected", selecionado);

            if (icone) {
                icone.className = selecionado
                    ? "fa-solid fa-circle-check payment-check"
                    : "fa-regular fa-circle payment-check";
            }
        });

        const selecionado = document.querySelector(
            'input[name="payment"]:checked'
        );

        if (paymentNotice && selecionado) {
            const mensagens = {
                pix: "PIX indisponível: a integração com um provedor ainda não foi configurada.",
                cartao: "O pagamento por cartão não está disponível até a integração com um provedor de pagamentos.",
                boleto: "O boleto ainda não está integrado. O pedido não será considerado pago."
            };

            paymentNotice.textContent =
                mensagens[selecionado.value] ||
                "A forma de pagamento será confirmada após a integração com o provedor.";
        }
    }

    paymentOptions.forEach(option => {
        const radio = option.querySelector('input[type="radio"]');

        radio?.addEventListener("change", atualizarPagamentoSelecionado);
    });

    /* =====================================================
       MÁSCARA DO CEP
       ===================================================== */

    if (cepInput) {
        cepInput.addEventListener("input", () => {
            let valor = cepInput.value.replace(/\D/g, "").slice(0, 8);

            if (valor.length > 5) {
                valor = `${valor.slice(0, 5)}-${valor.slice(5)}`;
            }

            cepInput.value = valor;
            if (shippingFeedback) {
                shippingFeedback.textContent =
                    "PAC e SEDEX estarão disponíveis após a configuração segura do Melhor Envio.";
            }
        });
    }

    if (calculateShippingButton) {
        calculateShippingButton.addEventListener("click", () => {
            const cep = String(cepInput?.value || "").replace(/\D/g, "");

            if (cep.length !== 8) {
                if (shippingFeedback) {
                    shippingFeedback.textContent =
                        "Informe um CEP válido com 8 números para consultar o frete.";
                }
                cepInput?.focus();
                return;
            }

            if (shippingFeedback) {
                shippingFeedback.textContent =
                    "A cotação de PAC e SEDEX ainda não está ativa. A loja precisa criar a conta Melhor Envio e configurar a autorização no servidor. Nenhum preço ou prazo estimado foi inventado.";
            }
        });
    }

    /* =====================================================
       VALIDAR FORMULÁRIO
       ===================================================== */

    function validarFormulario() {
        limparMensagem();

        if (!FRETE_CONFIGURADO || !CRIACAO_SEGURA_DE_PEDIDOS_CONFIGURADA) {
            mostrarMensagem(CHECKOUT_BLOQUEADO);
            return false;
        }

        if (!form.checkValidity()) {
            form.reportValidity();
            return false;
        }

        const nome = document.querySelector("#name")?.value.trim() || "";
        const email = document.querySelector("#email")?.value.trim() || "";
        const cep = document.querySelector("#cep")?.value.replace(/\D/g, "") || "";

        if (nome.length < 3) {
            mostrarMensagem("Informe seu nome completo.");
            document.querySelector("#name")?.focus();
            return false;
        }

        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
            mostrarMensagem("Informe um e-mail válido.");
            document.querySelector("#email")?.focus();
            return false;
        }

        if (cep.length !== 8) {
            mostrarMensagem("Informe um CEP válido com 8 números.");
            document.querySelector("#cep")?.focus();
            return false;
        }

        if (!carrinho.length) {
            mostrarMensagem("Seu carrinho está vazio.");
            return false;
        }

        const pagamento = document.querySelector(
            'input[name="payment"]:checked'
        );

        if (!pagamento) {
            mostrarMensagem("Selecione uma forma de pagamento.");
            return false;
        }

        /*
         * Não registrar cartão ou boleto como se o pagamento
         * estivesse disponível sem um provedor integrado.
         */
        if (pagamento.value !== "pix") {
            mostrarMensagem(
                "Por enquanto, somente o registro de pedidos com PIX está disponível. " +
                "A cobrança PIX ainda precisará ser integrada."
            );
            return false;
        }

        return true;
    }

    /* =====================================================
       BLOQUEAR FINALIZAÇÃO
       ===================================================== */

    async function finalizarPedido(evento) {
        evento.preventDefault();

        if (!validarFormulario()) {
            return;
        }

        if (!window.NovaPedidos || typeof window.NovaPedidos.criarPedido !== "function") {
            mostrarMensagem(CHECKOUT_BLOQUEADO);
            return;
        }

        const backendDisponivel = Boolean(window.NovaPedidos.isBackendConfigured?.());

        if (!backendDisponivel) {
            mostrarMensagem(CHECKOUT_BLOQUEADO);
            return;
        }

        const endpoint = window.NovaPedidos.getEndpoint?.();
        if (!endpoint && !(window.supabaseClient && typeof window.supabaseClient.functions?.invoke === "function")) {
            mostrarMensagem(CHECKOUT_BLOQUEADO);
            return;
        }

        const nome = document.querySelector("#name")?.value.trim() || "";
        const email = document.querySelector("#email")?.value.trim() || "";
        const pagamento = document.querySelector('input[name="payment"]:checked');
        const pedidoId = crypto?.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(16).slice(2)}`;

        if (!pagamento) {
            mostrarMensagem("Selecione uma forma de pagamento.");
            return;
        }

        if (finishButton) {
            finishButton.disabled = true;
            finishButton.textContent = "Enviando pedido...";
        }

        try {
            const payload = {
                idempotencyKey: pedidoId,
                customer: {
                    nome,
                    email
                },
                items: carrinho.map(item => ({
                    id: item.id,
                    quantidade: item.quantidade,
                    tamanho: item.tamanho || null,
                    cor: item.cor || null,
                    preco: item.preco
                })),
                shipping: {
                    valor: 0,
                    observacoes: "Frete ainda não configurado."
                },
                paymentMethod: pagamento.value,
                couponCode: cupomAplicado?.codigo || null
            };

            const resposta = await window.NovaPedidos.criarPedido(payload);

            if (resposta?.ok === false || resposta?.error) {
                throw new Error(resposta?.error || "Não foi possível registrar o pedido.");
            }

            const orderId = resposta?.orderId || resposta?.data?.orderId || resposta?.id || pedidoId;
            const url = new URL("pedido-realizado.html", window.location.href);
            url.searchParams.set("id", orderId);
            window.location.href = url.href;

        } catch (erro) {
            console.error("Erro ao criar pedido:", erro);
            mostrarMensagem(
                erro.message ||
                "Não foi possível concluir o pedido no momento. Tente novamente."
            );

            if (finishButton) {
                finishButton.disabled = false;
                finishButton.textContent = "Revisar pedido";
            }
        }
    }

    if (form) {
        form.addEventListener("submit", finalizarPedido);
    }

    /* =====================================================
       INICIALIZAÇÃO
       ===================================================== */

    async function inicializar() {
        if (couponApplyButton) {
            couponApplyButton.disabled = true;
        }

        if (finishButton) {
            finishButton.disabled = true;
            finishButton.setAttribute("aria-disabled", "true");
            finishButton.title = CHECKOUT_BLOQUEADO;
        }

        if (paymentNotice) {
            paymentNotice.textContent =
                "Nenhuma forma de pagamento está habilitada até a integração com um provedor.";
        }

        paymentOptions.forEach(option => {
            const radio = option.querySelector('input[type="radio"]');
            if (radio) radio.disabled = true;
        });

        carrinho = lerCarrinho();

        if (!carrinho.length) {
            mostrarErro("Seu carrinho está vazio. Adicione produtos antes de finalizar.");

            if (finishButton) {
                finishButton.disabled = true;
            }

            return;
        }

        try {
            if (loadingElement) {
                loadingElement.hidden = false;
            }

            await atualizarDadosDosProdutos();
            renderizarResumo();
            if (couponApplyButton) {
                couponApplyButton.disabled = false;
            }
            mostrarMensagem(CHECKOUT_BLOQUEADO);

        } catch (erro) {
            console.error("Erro ao preparar checkout:", erro);
            mostrarErro(
                erro.message ||
                "Não foi possível conferir seu carrinho. Volte ao carrinho e tente novamente."
            );

        } finally {
            if (loadingElement) {
                loadingElement.hidden = true;
            }
        }

        atualizarPagamentoSelecionado();
    }

    inicializar();
});
