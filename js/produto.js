
/* =========================================================
   NØVA — PÁGINA DO PRODUTO
   Supabase + imagens + promoções + carrinho + relacionados
   ========================================================= */

document.addEventListener("DOMContentLoaded", () => {
    "use strict";

    const CART_KEY = "novaCarrinho";
    const PRODUCT_KEY = "novaProdutoSelecionado";
    const FAVORITES_KEY = "novaFavoritos";

    const supabaseClient = window.supabaseClient;

    /* ELEMENTOS */
    const productTitle = document.getElementById("product-name");
    const productPrice = document.getElementById("product-price");
    const productReference = document.getElementById("product-reference");
    const breadcrumb = document.getElementById("product-breadcrumb-name");
    const description = document.getElementById("product-description");

    const mainImage = document.getElementById("product-image");
    const mainImageContainer = document.getElementById("product-main-image");
    const placeholder = document.getElementById("product-image-placeholder");
    const thumbnailsContainer = document.getElementById("product-thumbnails");

    const colorOption = document.getElementById("product-color-option");
    const colorContainer = document.getElementById("product-colors");
    const selectedColorText = document.getElementById("selected-color-name");

    const sizeOption = document.getElementById("product-size-option");
    const sizeContainer = document.getElementById("product-sizes");
    const sizeError = document.getElementById("size-error");

    const quantityInput = document.getElementById("product-quantity");
    const decreaseButton = document.getElementById("decrease-quantity");
    const increaseButton = document.getElementById("increase-quantity");

    const addToCartButton = document.getElementById("add-to-cart");
    const addToCartText = document.getElementById("add-to-cart-text");
    const stockElement = document.getElementById("product-stock");
    const messageElement = document.getElementById("product-message");

    const cartCount = document.getElementById("cart-count");
    const errorSection = document.getElementById("product-error");
    const retryButton = document.getElementById("retry-product");
    const relatedContainer = document.getElementById("related-products-list");

    let produtoSelecionado = null;
    let configuracoes = {};
    let quantidade = 1;
    let corSelecionada = "";
    let tamanhoSelecionado = "";
    let precoAtual = 0;
    let finalizandoAdicao = false;

    /* =====================================================
       FUNÇÕES AUXILIARES
       ===================================================== */

    function lerLocalStorage(chave, padrao = null) {
        try {
            const valor = localStorage.getItem(chave);
            return valor ? JSON.parse(valor) : padrao;
        } catch (erro) {
            console.error(`Erro ao ler ${chave}:`, erro);
            return padrao;
        }
    }

    function salvarLocalStorage(chave, valor) {
        try {
            localStorage.setItem(chave, JSON.stringify(valor));
            return true;
        } catch (erro) {
            console.error(`Erro ao salvar ${chave}:`, erro);
            return false;
        }
    }

    function formatarPreco(valor) {
        return Number(valor || 0).toLocaleString("pt-BR", {
            style: "currency",
            currency: "BRL"
        });
    }

    function escaparHTML(valor) {
        return String(valor ?? "").replace(/[&<>"']/g, caractere => ({
            "&": "&amp;",
            "<": "&lt;",
            ">": "&gt;",
            '"': "&quot;",
            "'": "&#39;"
        })[caractere]);
    }

    function normalizarImagem(imagem) {
        if (typeof imagem === "string") {
            return imagem.trim();
        }

        if (imagem && typeof imagem === "object") {
            return (
                imagem.url ||
                imagem.src ||
                imagem.imagem ||
                imagem.caminho ||
                ""
            );
        }

        return "";
    }

    function obterImagens(produto) {
        const imagens = [];
        const principal = normalizarImagem(produto.imagem);

        if (principal) {
            imagens.push(principal);
        }

        let adicionais = produto.imagens;

        if (typeof adicionais === "string") {
            try {
                adicionais = JSON.parse(adicionais);
            } catch {
                adicionais = [];
            }
        }

        if (Array.isArray(adicionais)) {
            adicionais.forEach(item => {
                const imagem = normalizarImagem(item);

                if (imagem && !imagens.includes(imagem)) {
                    imagens.push(imagem);
                }
            });
        }

        return imagens;
    }

    function mostrarMensagem(texto, tipo = "sucesso") {
        if (messageElement) {
            messageElement.textContent = texto;
            messageElement.hidden = false;
            messageElement.dataset.tipo = tipo;
        }

        let toast = document.querySelector(".nova-mensagem");

        if (!toast) {
            toast = document.createElement("div");
            toast.className = "nova-mensagem";

            Object.assign(toast.style, {
                position: "fixed",
                bottom: "24px",
                right: "24px",
                zIndex: "99999",
                padding: "14px 20px",
                background: "#151519",
                color: "#F5F5F5",
                border: "1px solid #777",
                borderRadius: "8px",
                fontSize: "14px",
                boxShadow: "0 10px 30px rgba(0,0,0,.3)",
                maxWidth: "min(90vw, 380px)"
            });

            document.body.appendChild(toast);
        }

        toast.textContent = texto;
        toast.style.borderColor = tipo === "erro" ? "#ef4444" : "#777";

        clearTimeout(toast._timeout);
        toast._timeout = setTimeout(() => toast.remove(), 3000);
    }

    function obterProdutoArmazenado() {
        return lerLocalStorage(PRODUCT_KEY, null);
    }

    function obterIdSelecionado() {
        const selecionado = obterProdutoArmazenado();

        if (selecionado?.id !== undefined && selecionado?.id !== null) {
            return String(selecionado.id);
        }

        return null;
    }

    function obterPromocoes() {
        const promocoes = configuracoes.promocoes;
        return Array.isArray(promocoes) ? promocoes : [];
    }

    function obterPrecoPromocional(produto) {
        const promocao = obterPromocoes().find(item =>
            String(item.id) === String(produto.id)
        );

        if (!promocao) return null;

        const preco = Number(promocao.preco);

        if (
            !Number.isFinite(preco) ||
            preco <= 0 ||
            preco >= Number(produto.preco)
        ) {
            return null;
        }

        return preco;
    }

    function obterPrecoFinal(produto) {
        return obterPrecoPromocional(produto) ?? Number(produto.preco || 0);
    }

    function produtoDisponivel(produto) {
        return produto &&
            produto.ativo !== false &&
            Number(produto.estoque || 0) > 0;
    }

    /* =====================================================
       CONFIGURAÇÕES DA LOJA
       ===================================================== */

    async function carregarConfiguracoes() {
        if (!supabaseClient) {
            console.warn("Cliente Supabase não encontrado.");
            return;
        }

        const { data, error } = await supabaseClient
            .from("configuracoes_nova")
            .select("configuracoes")
            .eq("id", "loja")
            .maybeSingle();

        if (error) {
            console.warn("Não foi possível carregar as configurações:", error);
            return;
        }

        configuracoes = data?.configuracoes || {};
        aplicarCores();
    }

    function aplicarCores() {
        const cores = configuracoes.cores || {};
        const raiz = document.documentElement;

        const variaveis = {
            Fundo: "--nova-cor-fundo",
            Superfície: "--nova-cor-superficie",
            Destaque: "--nova-cor-destaque",
            Texto: "--nova-cor-texto"
        };

        Object.entries(variaveis).forEach(([chave, variavel]) => {
            const valor = cores[chave];

            if (typeof valor === "string" &&
                /^#[0-9a-f]{3,8}$/i.test(valor)) {
                raiz.style.setProperty(variavel, valor);
            }
        });
    }

    /* =====================================================
       CARREGAR PRODUTO DO SUPABASE
       ===================================================== */

    async function carregarProduto() {
        const id = obterIdSelecionado();

        if (!id) {
            mostrarErro("Nenhum produto foi selecionado.");
            return;
        }

        if (!supabaseClient) {
            mostrarErro("A conexão com o banco de dados não foi inicializada.");
            return;
        }

        if (errorSection) errorSection.hidden = true;

        if (addToCartButton) {
            addToCartButton.disabled = true;
            if (addToCartText) addToCartText.textContent = "Carregando produto...";
        }

        const { data, error } = await supabaseClient
            .from("produtos_nova")
            .select("*")
            .eq("id", id)
            .maybeSingle();

        if (error) {
            console.error("Erro ao consultar produto:", error);
            mostrarErro("Não foi possível consultar o produto no banco de dados.");
            return;
        }

        if (!data || data.ativo === false) {
            mostrarErro("Este produto não está disponível na loja.");
            return;
        }

        produtoSelecionado = data;

        /* Mantém o produto selecionado atualizado no navegador. */
        salvarLocalStorage(PRODUCT_KEY, data);

        quantidade = 1;
        corSelecionada = "";
        tamanhoSelecionado = "";
        precoAtual = obterPrecoFinal(data);

        renderizarProduto();
        configurarGaleria();
        configurarCores();
        configurarTamanhos();
        atualizarQuantidade();
        atualizarEstoque();
        atualizarFavoritos();
        atualizarContadorCarrinho();
        await carregarProdutosRelacionados();
    }

    function mostrarErro(mensagem) {
        console.error(mensagem);

        if (errorSection) {
            errorSection.hidden = false;

            const texto = errorSection.querySelector("[role='alert']");
            if (texto) texto.textContent = mensagem;
        }

        if (productTitle) productTitle.textContent = "Produto indisponível";
        if (addToCartButton) addToCartButton.disabled = true;
        if (addToCartText) addToCartText.textContent = "Indisponível";

        if (stockElement) stockElement.textContent = mensagem;
    }

    /* =====================================================
       RENDERIZAR INFORMAÇÕES
       ===================================================== */

    function renderizarProduto() {
        const produto = produtoSelecionado;
        const precoPromocional = obterPrecoPromocional(produto);

        if (productTitle) {
            productTitle.textContent = produto.nome || "Produto NØVA";
        }

        if (productReference) {
            productReference.textContent =
                produto.categoria?.toUpperCase() || "NØVA";
        }

        if (breadcrumb) {
            breadcrumb.textContent = produto.nome || "Produto";
        }

        if (description) {
            description.textContent =
                produto.descricao || "Conheça os detalhes desta peça NØVA.";
        }

        const precoOriginal = Number(produto.preco || 0);

        if (productPrice) {
            if (precoPromocional !== null) {
                productPrice.innerHTML =
                    `<span class="price-old">${formatarPreco(precoOriginal)}</span> ` +
                    `<span class="price-promotion">${formatarPreco(precoPromocional)}</span>`;
            } else {
                productPrice.textContent = formatarPreco(precoOriginal);
            }
        }

        if (precoPromocional !== null && productPrice) {
            productPrice.setAttribute("aria-label",
                `Preço promocional ${formatarPreco(precoPromocional)}. ` +
                `Preço original ${formatarPreco(precoOriginal)}`
            );
        }

        const etiqueta = document.getElementById("product-label");

        if (etiqueta) {
            const destaque = Array.isArray(configuracoes.destaques) &&
                configuracoes.destaques.some(id =>
                    String(id) === String(produto.id)
                );

            const emPromocao = precoPromocional !== null;

            etiqueta.hidden = !destaque && !emPromocao;
            etiqueta.textContent = emPromocao
                ? "PROMOÇÃO"
                : "DESTAQUE";
        }

        const installment = document.getElementById("product-installments");

        if (installment) {
            installment.textContent = precoPromocional !== null
                ? "Oferta especial configurada pela loja."
                : "Confira as condições de pagamento no checkout.";
        }

        if (addToCartText) {
            addToCartText.textContent = "Adicionar ao carrinho";
        }

        document.title = `${produto.nome || "Produto"} | NØVA`;
    }

    /* =====================================================
       GALERIA DE IMAGENS
       ===================================================== */

    function configurarGaleria() {
        if (!produtoSelecionado || !mainImage) return;

        const imagens = obterImagens(produtoSelecionado);

        mainImage.hidden = true;
        mainImage.removeAttribute("src");

        if (thumbnailsContainer) {
            thumbnailsContainer.replaceChildren();
        }

        if (!imagens.length) {
            if (placeholder) {
                placeholder.hidden = false;
                placeholder.textContent = "IMAGEM NÃO CADASTRADA";
            }
            return;
        }

        function selecionarImagem(url, botao) {
            mainImage.hidden = false;
            mainImage.alt = produtoSelecionado.nome || "Produto NØVA";

            mainImage.onload = () => {
                mainImage.hidden = false;
                if (placeholder) placeholder.hidden = true;
            };

            mainImage.onerror = () => {
                mainImage.hidden = true;
                if (placeholder) {
                    placeholder.hidden = false;
                    placeholder.textContent = "IMAGEM INDISPONÍVEL";
                }
                console.error("Falha ao carregar imagem:", url);
            };

            mainImage.src = url;

            if (thumbnailsContainer) {
                thumbnailsContainer.querySelectorAll("button").forEach(item => {
                    item.classList.toggle("active", item === botao);
                });
            }
        }

        imagens.forEach((url, indice) => {
            if (indice === 0) {
                selecionarImagem(url, null);
            }

            if (!thumbnailsContainer) return;

            const botao = document.createElement("button");
            botao.type = "button";
            botao.className = "product-thumbnail";
            botao.setAttribute("aria-label", `Ver imagem ${indice + 1}`);

            const imagem = document.createElement("img");
            imagem.src = url;
            imagem.alt = `${produtoSelecionado.nome || "Produto"} — imagem ${indice + 1}`;
            imagem.loading = "lazy";

            botao.appendChild(imagem);
            botao.addEventListener("click", () => selecionarImagem(url, botao));
            thumbnailsContainer.appendChild(botao);
        });
    }

    /* =====================================================
       CORES
       ===================================================== */

    function configurarCores() {
        if (!colorOption || !colorContainer) return;

        let cores = produtoSelecionado.cores;

        if (typeof cores === "string") {
            try {
                cores = JSON.parse(cores);
            } catch {
                cores = cores.split(",").map(cor => cor.trim()).filter(Boolean);
            }
        }

        if (!Array.isArray(cores) || cores.length === 0) {
            colorOption.hidden = true;
            corSelecionada = "";
            return;
        }

        colorOption.hidden = false;
        colorContainer.replaceChildren();

        cores.forEach(item => {
            const cor = typeof item === "string"
                ? { nome: item }
                : item;

            if (!cor?.nome) return;

            const botao = document.createElement("button");
            botao.type = "button";
            botao.className = "color-option";
            botao.dataset.color = cor.nome;
            botao.setAttribute("aria-label", cor.nome);
            botao.title = cor.nome;

            if (cor.hex && /^#[0-9a-f]{3,8}$/i.test(cor.hex)) {
                botao.style.backgroundColor = cor.hex;
            } else {
                botao.textContent = cor.nome;
            }

            botao.addEventListener("click", () => {
                colorContainer.querySelectorAll("button").forEach(item => {
                    item.classList.remove("selected");
                });

                botao.classList.add("selected");
                corSelecionada = cor.nome;

                if (selectedColorText) {
                    selectedColorText.textContent = cor.nome;
                }
            });

            colorContainer.appendChild(botao);
        });

        if (!colorContainer.children.length) {
            colorOption.hidden = true;
            return;
        }

        if (selectedColorText) selectedColorText.textContent = "Selecione";
    }

    /* =====================================================
       TAMANHOS
       ===================================================== */

    function configurarTamanhos() {
        if (!sizeOption || !sizeContainer) return;

        const categoria = String(produtoSelecionado.categoria || "")
            .normalize("NFD")
            .replace(/[\u0300-\u036f]/g, "")
            .toLowerCase();

        const acessorio = categoria.includes("acessorio") ||
            categoria.includes("bone") ||
            categoria.includes("cap");

        if (acessorio) {
            sizeOption.hidden = true;
            tamanhoSelecionado = "Único";
            if (sizeError) sizeError.hidden = true;
            return;
        }

        sizeOption.hidden = false;

        sizeContainer.querySelectorAll("button").forEach(botao => {
            botao.classList.remove("selected");
            botao.disabled = false;

            botao.addEventListener("click", () => {
                sizeContainer.querySelectorAll("button").forEach(item => {
                    item.classList.remove("selected");
                });

                botao.classList.add("selected");
                tamanhoSelecionado = botao.dataset.size ||
                    botao.textContent.trim();

                if (sizeError) sizeError.hidden = true;
            });
        });
    }

    /* =====================================================
       ESTOQUE E QUANTIDADE
       ===================================================== */

    function atualizarQuantidade() {
        const estoque = Number(produtoSelecionado?.estoque || 0);

        quantidade = Math.max(1, Math.min(
            Number.parseInt(quantidadeInput?.value, 10) || quantidade || 1,
            Math.max(estoque, 1)
        ));

        if (quantityInput) {
            quantityInput.value = quantidade;
            quantityInput.min = "1";
            quantityInput.max = String(Math.max(estoque, 1));
        }

        if (decreaseButton) {
            decreaseButton.disabled = quantidade <= 1;
        }

        if (increaseButton) {
            increaseButton.disabled = estoque <= 0 || quantidade >= estoque;
        }

        if (addToCartButton) {
            addToCartButton.disabled = estoque <= 0;
        }
    }

    function atualizarEstoque() {
        if (!stockElement || !produtoSelecionado) return;

        const estoque = Number(produtoSelecionado.estoque || 0);

        if (estoque <= 0) {
            stockElement.textContent = "Produto esgotado no momento.";
            if (addToCartText) addToCartText.textContent = "Produto esgotado";
            if (addToCartButton) addToCartButton.disabled = true;
        } else if (estoque <= 5) {
            stockElement.textContent = `Últimas unidades: ${estoque} disponível(is).`;
        } else {
            stockElement.textContent = "Produto disponível em estoque.";
        }
    }

    decreaseButton?.addEventListener("click", () => {
        quantidade = Math.max(1, quantidade - 1);
        atualizarQuantidade();
    });

    increaseButton?.addEventListener("click", () => {
        const estoque = Number(produtoSelecionado?.estoque || 0);

        if (quantidade < estoque) {
            quantidade += 1;
            atualizarQuantidade();
        }
    });

    quantityInput?.addEventListener("change", () => {
        const valor = Number.parseInt(quantityInput.value, 10);
        quantidade = Number.isFinite(valor) ? valor : 1;
        atualizarQuantidade();
    });

    quantityInput?.addEventListener("input", () => {
        const valor = Number.parseInt(quantityInput.value, 10);

        if (Number.isFinite(valor) && valor > 0) {
            quantidade = valor;
        }
    });

    /* =====================================================
       CONTADOR DO CARRINHO
       ===================================================== */

    function atualizarContadorCarrinho() {
        const carrinho = lerLocalStorage(CART_KEY, []);
        const total = Array.isArray(carrinho)
            ? carrinho.reduce((soma, item) =>
                soma + Math.max(0, Number(item.quantidade || 0)), 0)
            : 0;

        document.querySelectorAll("[data-cart-count], .cart-count").forEach(el => {
            el.textContent = total;
        });
    }

    /* =====================================================
       ADICIONAR AO CARRINHO
       ===================================================== */

    addToCartButton?.addEventListener("click", () => {
        if (finalizandoAdicao || !produtoSelecionado) return;

        const estoque = Number(produtoSelecionado.estoque || 0);

        if (estoque <= 0) {
            mostrarMensagem("Este produto está esgotado.", "erro");
            return;
        }

        if (sizeOption && !sizeOption.hidden && !tamanhoSelecionado) {
            if (sizeError) sizeError.hidden = false;
            mostrarMensagem("Selecione um tamanho antes de continuar.", "erro");
            return;
        }

        if (colorOption && !colorOption.hidden && !corSelecionada) {
            mostrarMensagem("Selecione uma cor antes de continuar.", "erro");
            return;
        }

        const quantidadeSolicitada = Math.max(
            1,
            Number.parseInt(quantityInput?.value, 10) || quantidade
        );

        if (quantidadeSolicitada > estoque) {
            mostrarMensagem(`Há somente ${estoque} unidade(s) em estoque.`, "erro");
            return;
        }

        finalizandoAdicao = true;

        const carrinho = lerLocalStorage(CART_KEY, []);
        const itens = Array.isArray(carrinho) ? carrinho : [];
        const preco = obterPrecoFinal(produtoSelecionado);

        const produtoExistente = itens.find(item =>
            String(item.id) === String(produtoSelecionado.id) &&
            String(item.tamanho || "") === String(tamanhoSelecionado || "") &&
            String(item.cor || "") === String(corSelecionada || "")
        );

        if (produtoExistente) {
            const novaQuantidade =
                Number(produtoExistente.quantidade || 0) + quantidadeSolicitada;

            if (novaQuantidade > estoque) {
                mostrarMensagem(
                    `Você já tem este produto no carrinho. Estoque disponível: ${estoque}.`,
                    "erro"
                );
                finalizandoAdicao = false;
                return;
            }

            produtoExistente.quantidade = novaQuantidade;
            produtoExistente.preco = preco;
        } else {
            itens.push({
                id: produtoSelecionado.id,
                nome: produtoSelecionado.nome,
                preco,
                precoOriginal: Number(produtoSelecionado.preco || 0),
                categoria: produtoSelecionado.categoria || "PRODUTO",
                imagem: normalizarImagem(produtoSelecionado.imagem),
                cor: corSelecionada || "",
                tamanho: tamanhoSelecionado || "",
                quantidade: quantidadeSolicitada
            });
        }

        if (!salvarLocalStorage(CART_KEY, itens)) {
            mostrarMensagem("Não foi possível salvar o carrinho.", "erro");
            finalizandoAdicao = false;
            return;
        }

        quantidade = 1;
        if (quantityInput) quantityInput.value = "1";

        atualizarQuantidade();
        atualizarContadorCarrinho();
        mostrarMensagem("Produto adicionado ao carrinho!");

        if (addToCartText) {
            addToCartText.textContent = "Adicionado ao carrinho!";
        }

        setTimeout(() => {
            if (addToCartText) {
                addToCartText.textContent = "Adicionar ao carrinho";
            }
            finalizandoAdicao = false;
        }, 1200);
    });

    /* =====================================================
       FAVORITOS
       ===================================================== */

    function obterFavoritos() {
        const favoritos = lerLocalStorage(FAVORITES_KEY, []);
        return Array.isArray(favoritos) ? favoritos.map(String) : [];
    }

    function atualizarFavoritos() {
        if (!produtoSelecionado) return;

        const favoritos = obterFavoritos();
        const favorito = favoritos.includes(String(produtoSelecionado.id));

        document.querySelectorAll("[data-favorite-product]").forEach(botao => {
            botao.classList.toggle("active", favorito);
            botao.setAttribute("aria-pressed", String(favorito));

            const icone = botao.querySelector("i");

            if (icone) {
                icone.classList.toggle("fa-solid", favorito);
                icone.classList.toggle("fa-regular", !favorito);
            }
        });
    }

    document.querySelectorAll("[data-favorite-product]").forEach(botao => {
        botao.addEventListener("click", () => {
            if (!produtoSelecionado) return;

            let favoritos = obterFavoritos();
            const id = String(produtoSelecionado.id);

            favoritos = favoritos.includes(id)
                ? favoritos.filter(item => item !== id)
                : [...favoritos, id];

            if (!salvarLocalStorage(FAVORITES_KEY, favoritos)) {
                mostrarMensagem("Não foi possível salvar os favoritos.", "erro");
                return;
            }

            atualizarFavoritos();

            mostrarMensagem(
                favoritos.includes(id)
                    ? "Produto adicionado aos favoritos."
                    : "Produto removido dos favoritos."
            );
        });
    });

    /* =====================================================
       PRODUTOS RELACIONADOS
       ===================================================== */

    async function carregarProdutosRelacionados() {
        if (!relatedContainer || !supabaseClient || !produtoSelecionado) return;

        relatedContainer.setAttribute("aria-busy", "true");
        relatedContainer.replaceChildren();

        const { data, error } = await supabaseClient
            .from("produtos_nova")
            .select("*")
            .eq("ativo", true)
            .gt("estoque", 0)
            .neq("id", produtoSelecionado.id)
            .limit(4);

        relatedContainer.setAttribute("aria-busy", "false");

        if (error) {
            console.error("Erro ao carregar produtos relacionados:", error);
            return;
        }

        if (!data || data.length === 0) {
            const mensagem = document.createElement("p");
            mensagem.textContent = "Não há outros produtos disponíveis no momento.";
            relatedContainer.appendChild(mensagem);
            return;
        }

        data.forEach(produto => {
            const card = document.createElement("article");
            card.className = "related-product-card";

            const imagens = obterImagens(produto);
            const precoPromocional = obterPrecoPromocional(produto);
            const preco = obterPrecoFinal(produto);

            const imagem = document.createElement("img");
            imagem.className = "related-product-image";
            imagem.alt = produto.nome || "Produto NØVA";
            imagem.loading = "lazy";

            if (imagens[0]) {
                imagem.src = imagens[0];
            } else {
                imagem.hidden = true;
            }

            const linkImagem = document.createElement("a");
            linkImagem.href = "produto.html";
            linkImagem.className = "related-product-image-link";
            linkImagem.appendChild(imagem);

            const nome = document.createElement("h3");
            nome.textContent = produto.nome || "Produto NØVA";

            const linkNome = document.createElement("a");
            linkNome.href = "produto.html";
            linkNome.className = "related-product-name";
            linkNome.appendChild(nome);

            const categoria = document.createElement("p");
            categoria.className = "related-product-category";
            categoria.textContent = produto.categoria || "NØVA";

            const precoEl = document.createElement("p");
            precoEl.className = "related-product-price";

            if (precoPromocional !== null) {
                precoEl.innerHTML =
                    `<span class="price-old">${escaparHTML(formatarPreco(produto.preco))}</span> ` +
                    `<strong class="price-promotion">${escaparHTML(formatarPreco(preco))}</strong>`;
            } else {
                precoEl.textContent = formatarPreco(preco);
            }

            [linkImagem, linkNome].forEach(link => {
                link.addEventListener("click", event => {
                    event.preventDefault();

                    if (!salvarLocalStorage(PRODUCT_KEY, produto)) {
                        mostrarMensagem("Não foi possível abrir este produto.", "erro");
                        return;
                    }

                    window.location.href = "produto.html";
                });
            });

            card.append(linkImagem, categoria, linkNome, precoEl);
            relatedContainer.appendChild(card);
        });
    }

    /* =====================================================
       TENTAR NOVAMENTE
       ===================================================== */

    retryButton?.addEventListener("click", async () => {
        await iniciar();
    });

    /* =====================================================
       INICIALIZAÇÃO
       ===================================================== */

    async function iniciar() {
        try {
            await carregarConfiguracoes();
            await carregarProduto();
        } catch (erro) {
            console.error("Erro ao iniciar página do produto:", erro);
            mostrarErro("Ocorreu um erro ao carregar o produto. Tente novamente.");
        }
    }

    atualizarContadorCarrinho();
    iniciar();
});
