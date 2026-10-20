
/* =========================================================
   NØVA — CHECKOUT
   Validação, resumo e salvamento do pedido no Supabase
   ========================================================= */

document.addEventListener("DOMContentLoaded", () => {
    "use strict";

    const CART_KEY = "novaCarrinho";
    const ORDER_KEY = "novaPedido";

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

    const paymentOptions = document.querySelectorAll(".payment-option");
    const paymentNotice = document.querySelector("#payment-notice");
    const cepInput = document.querySelector("#cep");

    let carrinho = [];
    let configuracoes = {};
    let finalizando = false;

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
        localStorage.setItem(CART_KEY, JSON.stringify(carrinho));
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
            console.warn(
                "Não foi possível carregar as promoções:",
                configError.message
            );
        } else {
            configuracoes = configData?.configuracoes || {};
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
        const desconto = calcularDesconto();

        if (itemsCountElement) {
            itemsCountElement.textContent =
                `${quantidade} ${quantidade === 1 ? "item" : "itens"}`;
        }

        if (subtotalElement) {
            subtotalElement.textContent = formatarPreco(subtotal);
        }

        /* O frete permanece sem cálculo até a integração de entrega. */
        if (shippingElement) {
            shippingElement.textContent = "A calcular";
        }

        if (discountElement) {
            discountElement.textContent = `− ${formatarPreco(desconto)}`;
        }

        if (discountRow) {
            discountRow.hidden = desconto <= 0;
        }

        /* Ainda não existe cálculo automático de frete. */
        if (totalElement) {
            totalElement.textContent = formatarPreco(subtotal);
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
                pix: "O pedido será registrado como pendente. O PIX ainda precisa ser integrado para gerar a cobrança.",
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
        });
    }

    /* =====================================================
       VALIDAR FORMULÁRIO
       ===================================================== */

    function validarFormulario() {
        limparMensagem();

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
       GERAR ID DO PEDIDO
       ===================================================== */

    function gerarIdPedido() {
        const agora = new Date();

        const data = [
            agora.getFullYear(),
            String(agora.getMonth() + 1).padStart(2, "0"),
            String(agora.getDate()).padStart(2, "0")
        ].join("");

        const aleatorio = Math.random()
            .toString(36)
            .slice(2, 8)
            .toUpperCase();

        return `NVA-${data}-${aleatorio}`;
    }

    /* =====================================================
       ENVIAR PEDIDO
       ===================================================== */

    async function finalizarPedido(evento) {
        evento.preventDefault();

        if (finalizando) {
            return;
        }

        if (!validarFormulario()) {
            return;
        }

        finalizando = true;
        limparMensagem();

        finishButton.disabled = true;
        finishButton.setAttribute("aria-busy", "true");
        finishButton.textContent = "Conferindo estoque...";

        if (loadingElement) {
            loadingElement.hidden = false;
        }

        try {
            /*
             * Atualiza preço e estoque antes de calcular o pedido.
             */
            await atualizarDadosDosProdutos();
            renderizarResumo();

            const subtotal = calcularSubtotal();
            const pagamento = document.querySelector(
                'input[name="payment"]:checked'
            );

            const cliente = {
                nome: document.querySelector("#name").value.trim(),
                email: document.querySelector("#email").value.trim(),
                endereco: {
                    cep: document.querySelector("#cep").value.trim(),
                    rua: document.querySelector("#street").value.trim(),
                    numero: document.querySelector("#number").value.trim(),
                    complemento:
                        document.querySelector("#complement")?.value.trim() || "",
                    bairro: document.querySelector("#neighborhood").value.trim(),
                    cidade: document.querySelector("#city").value.trim(),
                    estado: document.querySelector("#state").value
                }
            };

            const pedido = {
                id: gerarIdPedido(),
                cliente,
                pagamento: pagamento.value,
                itens: carrinho.map(item => ({
                    id: item.id,
                    nome: item.nome,
                    imagem: item.imagem || "",
                    preco: item.preco,
                    quantidade: item.quantidade,
                    cor: item.cor || "",
                    tamanho: item.tamanho || ""
                })),
                subtotal,
                frete: 0,
                total: subtotal,
                status: "Pendente",
                criadoEm: new Date().toISOString()
            };

            finishButton.textContent = "Salvando pedido...";

            if (
                !window.NovaPedidos ||
                typeof window.NovaPedidos.salvarPedido !== "function"
            ) {
                throw new Error(
                    "A integração de pedidos não foi carregada. Confira o app.js."
                );
            }

            /*
             * O app.js faz o INSERT no Supabase.
             * Só continuamos se ele confirmar o pedido.
             */
            const pedidoSalvo = await window.NovaPedidos.salvarPedido(pedido);

            if (!pedidoSalvo?.id) {
                throw new Error(
                    "O banco não confirmou o salvamento do pedido."
                );
            }

            /*
             * Guarda o último pedido para a página de confirmação.
             * O carrinho só é limpo após a confirmação do Supabase.
             */
            localStorage.setItem(ORDER_KEY, JSON.stringify(pedidoSalvo));
            localStorage.removeItem(CART_KEY);

            finishButton.textContent = "Pedido registrado!";

            mostrarMensagem(
                "Pedido registrado como pendente. O pagamento ainda precisa ser confirmado."
            );

            window.setTimeout(() => {
                window.location.href = "pedido-realizado.html";
            }, 1000);

        } catch (erro) {
            console.error("Erro ao finalizar pedido:", erro);

            mostrarMensagem(
                erro?.message ||
                "Não foi possível registrar o pedido. Seus produtos continuam no carrinho."
            );

            finalizando = false;
            finishButton.disabled = false;
            finishButton.removeAttribute("aria-busy");
            finishButton.innerHTML =
                'Revisar pedido <i class="fa-solid fa-arrow-right" aria-hidden="true"></i>';

        } finally {
            if (loadingElement) {
                loadingElement.hidden = true;
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
