
/* =========================================================
   NØVA — CARRINHO DE COMPRAS
   Integração com produtos e configurações do Supabase
   ========================================================= */

document.addEventListener("DOMContentLoaded", () => {
    "use strict";

    const CART_KEY = "novaCarrinho";
    const CONFIG_TABLE = "configuracoes_nova";
    const PRODUCTS_TABLE = "produtos_nova";

    /* ELEMENTOS DO HTML */
    const cartProducts = document.querySelector(".cart-products");
    const cartList = document.querySelector("#cart-items-list");
    const cartWarning = document.querySelector("#cart-warning");
    const cartEmpty = document.querySelector("#cart-empty");
    const cartError = document.querySelector("#cart-error");
    const cartLoading = document.querySelector("#cart-loading");
    const cartCount = document.querySelector("#cart-count");
    const cartItemsCount = document.querySelector("#cart-items-count");
    const subtotalElement = document.querySelector("#cart-subtotal");
    const shippingElement = document.querySelector("#cart-shipping");
    const discountRow = document.querySelector("#cart-discount-row");
    const discountElement = document.querySelector("#cart-discount");
    const totalElement = document.querySelector("#cart-total");
    const checkoutButton = document.querySelector("#checkout-button");
    const retryButton = document.querySelector("#retry-cart");
    const couponInput = document.querySelector("#coupon");
    const couponButton = document.querySelector("#apply-coupon");
    const couponMessage = document.querySelector("#coupon-message");

    let erroLeituraCarrinho = false;
    let carrinho = carregarCarrinho();
    let configuracoes = {};
    let produtosBanco = {};
    let carregando = false;
    let dadosDoBancoValidados = false;

    /* =====================================================
       SUPABASE
       ===================================================== */

    function obterClienteSupabase() {
        return window.supabaseClient || null;
    }

    /* =====================================================
       UTILITÁRIOS
       ===================================================== */

    function formatarPreco(valor) {
        return Number(valor || 0).toLocaleString("pt-BR", {
            style: "currency",
            currency: "BRL"
        });
    }

    function numeroValido(valor, padrao = 0) {
        const numero = Number(valor);
        return Number.isFinite(numero) ? numero : padrao;
    }

    function escaparTexto(valor) {
        return String(valor ?? "");
    }

    function carregarCarrinho() {
        try {
            const dados = localStorage.getItem(CART_KEY);
            const produtos = dados ? JSON.parse(dados) : [];
            erroLeituraCarrinho = false;

            if (!Array.isArray(produtos)) {
                return [];
            }

            return produtos
                .filter(produto => produto && typeof produto === "object")
                .map(produto => ({
                    ...produto,
                    id: produto.id ?? produto.produtoId ?? null,
                    nome: produto.nome || "Produto NØVA",
                    categoria: produto.categoria || "Produto",
                    quantidade: Math.max(
                        1,
                        Math.floor(numeroValido(produto.quantidade, 1))
                    ),
                    preco: Math.max(0, numeroValido(produto.preco)),
                    precoOriginal: Math.max(
                        0,
                        numeroValido(produto.precoOriginal, numeroValido(produto.preco))
                    )
                }));
        } catch (erro) {
            console.error("Erro ao ler o carrinho:", erro);
            erroLeituraCarrinho = true;
            return [];
        }
    }

    function salvarCarrinho() {
        try {
            localStorage.setItem(CART_KEY, JSON.stringify(carrinho));
        } catch (erro) {
            console.error("Erro ao salvar o carrinho:", erro);
            mostrarErro("Não foi possível salvar as alterações do carrinho.");
            return false;
        }

        return true;
    }

    function quantidadeTotal() {
        return carrinho.reduce(
            (total, produto) => total + numeroValido(produto.quantidade),
            0
        );
    }

    function precoOriginal(produto) {
        return Math.max(
            0,
            numeroValido(produto.precoOriginal, numeroValido(produto.preco))
        );
    }

    function precoAtual(produto) {
        return Math.max(0, numeroValido(produto.preco));
    }

    function subtotalOriginal() {
        return carrinho.reduce(
            (total, produto) =>
                total + precoOriginal(produto) * numeroValido(produto.quantidade),
            0
        );
    }

    function valorTotal() {
        return carrinho.reduce(
            (total, produto) =>
                total + precoAtual(produto) * numeroValido(produto.quantidade),
            0
        );
    }

    function valorDesconto() {
        return Math.max(0, subtotalOriginal() - valorTotal());
    }

    /* =====================================================
       CONFIGURAÇÕES E PROMOÇÕES
       ===================================================== */

    async function carregarConfiguracoes() {
        const supabase = obterClienteSupabase();

        if (!supabase) {
            throw new Error("Não foi possível conectar ao Supabase.");
        }

        const { data, error } = await supabase
            .from(CONFIG_TABLE)
            .select("configuracoes")
            .eq("id", "loja")
            .maybeSingle();

        if (error) {
            console.error("Não foi possível carregar as configurações:", error);
            configuracoes = {};
            return false;
        }

        configuracoes = data?.configuracoes || {};
        return true;
    }

    function obterPromocao(id) {
        const promocoes = configuracoes?.promocoes;

        if (!Array.isArray(promocoes)) {
            return null;
        }

        return promocoes.find(promocao =>
            String(promocao.id) === String(id)
        ) || null;
    }

    /* =====================================================
       ATUALIZAR DADOS COM O SUPABASE
       ===================================================== */

    async function atualizarProdutosDoBanco() {
        const supabase = obterClienteSupabase();

        if (carrinho.length === 0) {
            return;
        }

        if (!supabase) {
            throw new Error("Não foi possível conectar ao Supabase.");
        }

        const ids = [
            ...new Set(
                carrinho
                    .map(produto => produto.id)
                    .filter(id => id !== null && id !== undefined && String(id).trim() !== "")
                    .map(String)
            )
        ];

        if (ids.length === 0) {
            throw new Error(
                "Há itens sem identificador no carrinho. Remova-os e adicione-os novamente."
            );
        }

        const { data, error } = await supabase
            .from(PRODUCTS_TABLE)
            .select("id,nome,categoria,descricao,preco,estoque,ativo,imagem,imagens")
            .in("id", ids);

        if (error) {
            console.error("Não foi possível atualizar os produtos:", error);
            throw new Error(
                "Não foi possível validar os produtos e preços do carrinho."
            );
        }

        produtosBanco = {};

        (data || []).forEach(produto => {
            produtosBanco[String(produto.id)] = produto;
        });

        if (ids.some(id => !produtosBanco[id])) {
            throw new Error(
                "Um ou mais produtos não estão mais disponíveis. " +
                "Remova os itens indisponíveis e tente novamente."
            );
        }

        const atualizados = carrinho.map(item => {
            const produtoBanco = produtosBanco[String(item.id)];

            if (produtoBanco.ativo !== true) {
                throw new Error(
                    `"${produtoBanco.nome || item.nome}" não está mais disponível.`
                );
            }

            const estoque = Math.max(
                0,
                Math.floor(numeroValido(produtoBanco.estoque))
            );

            if (estoque === 0) {
                throw new Error(
                    `"${produtoBanco.nome || item.nome}" está sem estoque.`
                );
            }

            if (item.quantidade > estoque) {
                throw new Error(
                    `Há apenas ${estoque} unidade(s) de ` +
                    `"${produtoBanco.nome || item.nome}" em estoque. Ajuste a quantidade.`
                );
            }

            const precoBanco = Math.max(0, numeroValido(produtoBanco.preco));
            const promocao = obterPromocao(produtoBanco.id);
            const precoPromocional = promocao
                ? numeroValido(promocao.preco, precoBanco)
                : precoBanco;

            const imagens = Array.isArray(produtoBanco.imagens)
                ? produtoBanco.imagens
                : [];

            return {
                ...item,
                nome: produtoBanco.nome || item.nome,
                categoria: produtoBanco.categoria || item.categoria,
                imagem: produtoBanco.imagem ||
                    imagens.find(imagem =>
                        typeof imagem === "string" && imagem.trim()
                    ) ||
                    "",
                precoOriginal: precoBanco,
                preco: Math.max(0, Math.min(precoPromocional, precoBanco)),
                estoque
            };
        });

        carrinho = atualizados;
        salvarCarrinho();
    }

    /* =====================================================
       CONTADOR DO CABEÇALHO
       ===================================================== */

    function atualizarContador() {
        if (cartCount) {
            cartCount.textContent = quantidadeTotal();
        }
    }

    /* =====================================================
       RESUMO DA COMPRA
       ===================================================== */

    function atualizarResumo() {
        const subtotal = subtotalOriginal();
        const desconto = valorDesconto();
        if (subtotalElement) {
            subtotalElement.textContent = dadosDoBancoValidados
                ? formatarPreco(subtotal)
                : "—";
        }

        if (discountElement) {
            discountElement.textContent = dadosDoBancoValidados
                ? `− ${formatarPreco(desconto)}`
                : "—";
        }

        if (discountRow) {
            discountRow.hidden = !dadosDoBancoValidados || desconto <= 0;
        }

        if (totalElement) {
            totalElement.textContent = dadosDoBancoValidados
                ? "A calcular"
                : "—";
        }

        if (shippingElement) {
            shippingElement.textContent = "A calcular";
        }

        if (cartItemsCount) {
            const quantidade = quantidadeTotal();
            cartItemsCount.textContent =
                quantidade === 1 ? "1 item" : `${quantidade} itens`;
        }

        if (checkoutButton) {
            const indisponivel =
                carrinho.length === 0 || !dadosDoBancoValidados;
            checkoutButton.setAttribute("aria-disabled", String(indisponivel));
            checkoutButton.classList.toggle("disabled", indisponivel);

            if (indisponivel) {
                checkoutButton.setAttribute("tabindex", "-1");
            } else {
                checkoutButton.removeAttribute("tabindex");
            }
        }
    }

    /* =====================================================
       MENSAGENS DE ESTADO
       ===================================================== */

    function mostrarErro(mensagem) {
        if (!cartError) {
            return;
        }

        cartError.hidden = false;

        const paragrafo = cartError.querySelector("p");
        if (paragrafo) {
            paragrafo.textContent = mensagem;
        }
    }

    function esconderErro() {
        if (cartError) {
            cartError.hidden = true;
        }
    }

    function atualizarEstadoVazio() {
        const vazio = carrinho.length === 0;

        if (cartEmpty) {
            cartEmpty.hidden = !vazio;
        }

        if (cartList) {
            cartList.hidden = vazio;
            cartList.setAttribute("aria-busy", "false");
        }

        if (cartLoading) {
            cartLoading.hidden = true;
        }

        atualizarResumo();
        atualizarContador();
    }

    /* =====================================================
       CRIAR ITEM DO CARRINHO
       ===================================================== */

    function criarItem(produto, index) {
        const item = document.createElement("article");
        item.className = "cart-item";

        const imagemContainer = document.createElement("div");
        imagemContainer.className = "cart-item-image";

        if (produto.imagem) {
            const imagem = document.createElement("img");
            imagem.src = produto.imagem;
            imagem.alt = produto.nome;
            imagem.loading = "lazy";
            imagem.onerror = () => {
                imagem.remove();
                const fallback = document.createElement("span");
                fallback.textContent = "SEM IMAGEM";
                imagemContainer.appendChild(fallback);
            };
            imagemContainer.appendChild(imagem);
        } else {
            const fallback = document.createElement("span");
            fallback.textContent = "SEM IMAGEM";
            imagemContainer.appendChild(fallback);
        }

        const info = document.createElement("div");
        info.className = "cart-item-info";

        const categoria = document.createElement("span");
        categoria.className = "cart-item-category";
        categoria.textContent = produto.categoria;

        const nome = document.createElement("h3");
        nome.textContent = produto.nome;

        info.append(categoria, nome);

        if (produto.cor) {
            const cor = document.createElement("p");
            cor.className = "cart-item-color";
            cor.textContent = `Cor: ${produto.cor}`;
            info.appendChild(cor);
        }

        if (produto.tamanho) {
            const tamanho = document.createElement("p");
            tamanho.className = "cart-item-size";
            tamanho.textContent = `Tamanho: ${produto.tamanho}`;
            info.appendChild(tamanho);
        }

        const remover = document.createElement("button");
        remover.type = "button";
        remover.className = "remove-item";
        remover.dataset.index = index;
        remover.setAttribute("aria-label", `Remover ${produto.nome} do carrinho`);
        remover.innerHTML = '<i class="fa-regular fa-trash-can" aria-hidden="true"></i> Remover';
        info.appendChild(remover);

        const ladoDireito = document.createElement("div");
        ladoDireito.className = "cart-item-right";

        const preco = document.createElement("div");
        preco.className = "cart-item-price";
        preco.textContent = dadosDoBancoValidados
            ? formatarPreco(precoAtual(produto))
            : "Preço não validado";

        if (
            dadosDoBancoValidados &&
            precoOriginal(produto) > precoAtual(produto)
        ) {
            const original = document.createElement("del");
            original.className = "cart-item-original-price";
            original.textContent = formatarPreco(precoOriginal(produto));
            preco.appendChild(original);
        }

        const quantidadeContainer = document.createElement("div");
        quantidadeContainer.className = "cart-quantity";

        const diminuir = document.createElement("button");
        diminuir.type = "button";
        diminuir.className = "decrease-quantity";
        diminuir.dataset.index = index;
        diminuir.setAttribute("aria-label", "Diminuir quantidade");
        diminuir.textContent = "−";

        const quantidade = document.createElement("span");
        quantidade.textContent = produto.quantidade;
        quantidade.setAttribute("aria-label", "Quantidade");

        const aumentar = document.createElement("button");
        aumentar.type = "button";
        aumentar.className = "increase-quantity";
        aumentar.dataset.index = index;
        aumentar.setAttribute("aria-label", "Aumentar quantidade");
        aumentar.textContent = "+";

        const estoqueConhecido = Number.isFinite(Number(produto.estoque));
        if (estoqueConhecido && produto.quantidade >= Number(produto.estoque)) {
            aumentar.disabled = true;
            aumentar.title = "Quantidade máxima disponível em estoque";
        }

        quantidadeContainer.append(diminuir, quantidade, aumentar);
        ladoDireito.append(preco, quantidadeContainer);
        item.append(imagemContainer, info, ladoDireito);

        return item;
    }

    /* =====================================================
       RENDERIZAR CARRINHO
       ===================================================== */

    function renderizarCarrinho() {
        if (!cartList) {
            console.error("Elemento #cart-items-list não encontrado no HTML.");
            return;
        }

        cartList.replaceChildren();

        carrinho.forEach((produto, index) => {
            cartList.appendChild(criarItem(produto, index));
        });

        atualizarEstadoVazio();
    }

    /* =====================================================
       ALTERAR QUANTIDADE E REMOVER PRODUTOS
       ===================================================== */

    if (cartList) {
        cartList.addEventListener("click", evento => {
            const botao = evento.target.closest("button");

            if (!botao) {
                return;
            }

            const index = Number(botao.dataset.index);

            if (!Number.isInteger(index) || !carrinho[index]) {
                return;
            }

            if (botao.classList.contains("increase-quantity")) {
                const produto = carrinho[index];
                const estoque = produto.estoque;

                if (
                    estoque !== undefined &&
                    Number.isFinite(Number(estoque)) &&
                    produto.quantidade >= Number(estoque)
                ) {
                    mostrarErro("Você já atingiu a quantidade disponível em estoque.");
                    return;
                }

                produto.quantidade += 1;
            } else if (botao.classList.contains("decrease-quantity")) {
                if (carrinho[index].quantidade > 1) {
                    carrinho[index].quantidade -= 1;
                } else {
                    carrinho.splice(index, 1);
                }
            } else if (botao.classList.contains("remove-item")) {
                carrinho.splice(index, 1);
            } else {
                return;
            }

            salvarCarrinho();
            renderizarCarrinho();
        });
    }

    /* =====================================================
       CUPOM DE DESCONTO
       ===================================================== */

    if (couponButton) {
        couponButton.addEventListener("click", () => {
            const cupom = couponInput?.value.trim() || "";

            if (!couponMessage) {
                return;
            }

            couponMessage.hidden = false;

            if (!cupom) {
                couponMessage.textContent = "Digite um cupom para continuar.";
                return;
            }

            couponMessage.textContent =
                "A validação de cupons ainda não está configurada nesta loja.";
        });
    }

    if (couponInput) {
        couponInput.addEventListener("keydown", evento => {
            if (evento.key === "Enter") {
                evento.preventDefault();
                couponButton?.click();
            }
        });
    }

    /* =====================================================
       IMPEDIR CHECKOUT COM CARRINHO VAZIO
       ===================================================== */

    if (checkoutButton) {
        checkoutButton.addEventListener("click", evento => {
            if (carrinho.length === 0) {
                evento.preventDefault();
                atualizarEstadoVazio();
                return;
            }

            if (!dadosDoBancoValidados) {
                evento.preventDefault();
                mostrarErro(
                    "Atualize os preços e o estoque no Supabase antes de continuar."
                );
            }
        });
    }

    /* =====================================================
       TENTAR NOVAMENTE
       ===================================================== */

    if (retryButton) {
        retryButton.addEventListener("click", async () => {
            esconderErro();
            await inicializarCarrinho();
        });
    }

    /* =====================================================
       INICIALIZAÇÃO
       ===================================================== */

    async function inicializarCarrinho() {
        if (carregando) {
            return;
        }

        carregando = true;

        if (cartList) {
            cartList.setAttribute("aria-busy", "true");
        }

        if (cartLoading) {
            cartLoading.hidden = false;
        }

        try {
            carrinho = carregarCarrinho();

            if (erroLeituraCarrinho) {
                throw new Error(
                    "Não foi possível ler os itens salvos neste navegador."
                );
            }

            if (carrinho.length > 0) {
                const configuracoesCarregadas = await carregarConfiguracoes();
                await atualizarProdutosDoBanco();
                if (cartWarning) {
                    cartWarning.textContent = configuracoesCarregadas
                        ? ""
                        : "As promoções não puderam ser carregadas. Os preços normais do cadastro estão sendo exibidos.";
                    cartWarning.hidden = configuracoesCarregadas;
                }
            } else if (cartWarning) {
                cartWarning.hidden = true;
            }

            const salvo = salvarCarrinho();
            dadosDoBancoValidados = true;
            if (salvo) esconderErro();
            renderizarCarrinho();
        } catch (erro) {
            console.error("Erro ao inicializar o carrinho:", erro);
            dadosDoBancoValidados = false;
            mostrarErro(
                erro.message ||
                "Não foi possível atualizar os preços e o estoque. " +
                "Seus itens foram preservados, mas o checkout está bloqueado."
            );
            renderizarCarrinho();
        } finally {
            carregando = false;

            if (cartList) {
                cartList.setAttribute("aria-busy", "false");
            }

            if (cartLoading) {
                cartLoading.hidden = true;
            }
        }
    }

    inicializarCarrinho();
});
