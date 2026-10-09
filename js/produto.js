javascript
/* =========================================================
   NØVA — PÁGINA DO PRODUTO
   ========================================================= */

document.addEventListener("DOMContentLoaded", () => {
    const CART_KEY = "novaCarrinho";
    const PRODUCT_KEY = "novaProdutoSelecionado";

    /* ELEMENTOS */
    const productTitle = document.querySelector(".product-information h1");
    const productPrice = document.querySelector(".product-detail-price strong");
    const productReference = document.querySelector(".product-reference");
    const breadcrumbProduct = document.querySelector(".product-breadcrumb span");

    const colorOptions = document.querySelectorAll(".color-option");
    const selectedColorText = document.querySelector(".option-heading strong");
    const sizeOptions = document.querySelectorAll(".product-sizes button");

    const quantityControl = document.querySelector(".quantity-control");
    const quantityDisplay = quantityControl?.querySelector("span");
    const quantityButtons = quantityControl?.querySelectorAll("button");

    const addToCartButton = document.querySelector(".add-to-cart");
    const cartCount = document.querySelector(".cart-count");
    const favoriteButtons = document.querySelectorAll(
        ".gallery-favorite, .buy-favorite"
    );

    const mainImageContainer = document.querySelector(".product-main-image");
    const placeholder = document.querySelector(".product-image-placeholder");
    const thumbnailsContainer = document.querySelector(".product-thumbnails");

    /* PRODUTO SELECIONADO */
    let produtoSelecionado = null;

    try {
        produtoSelecionado = JSON.parse(
            localStorage.getItem(PRODUCT_KEY)
        );
    } catch (erro) {
        console.error("Erro ao ler produto selecionado:", erro);
    }

    function mostrarMensagem(texto) {
        document.querySelector(".nova-mensagem")?.remove();

        const mensagem = document.createElement("div");
        mensagem.className = "nova-mensagem";
        mensagem.textContent = texto;

        Object.assign(mensagem.style, {
            position: "fixed",
            bottom: "25px",
            right: "25px",
            zIndex: "99999",
            padding: "14px 20px",
            background: "#1E222B",
            color: "#F5F7FA",
            border: "1px solid #8B5CF6",
            borderRadius: "8px",
            fontSize: "14px",
            boxShadow: "0 10px 30px rgba(0,0,0,.3)"
        });

        document.body.appendChild(mensagem);
        setTimeout(() => mensagem.remove(), 2500);
    }

    if (!produtoSelecionado) {
        mostrarMensagem("Nenhum produto selecionado.");

        setTimeout(() => {
            window.location.href = "loja.html";
        }, 1200);

        return;
    }

    let quantidade = 1;
    let corSelecionada = "Preto";
    let tamanhoSelecionado = "M";

    /* FORMATAR PREÇO */
    function formatarPreco(valor) {
        return Number(valor || 0).toLocaleString("pt-BR", {
            style: "currency",
            currency: "BRL"
        });
    }

    /* MOSTRAR DADOS DO PRODUTO */
    function mostrarProduto() {
        if (productTitle) {
            productTitle.textContent = produtoSelecionado.nome || "Produto NØVA";
        }

        if (productPrice) {
            productPrice.textContent = formatarPreco(produtoSelecionado.preco);
        }

        if (breadcrumbProduct) {
            breadcrumbProduct.textContent = produtoSelecionado.nome || "Produto";
        }

        if (productReference && produtoSelecionado.categoria) {
            productReference.textContent =
                produtoSelecionado.categoria.toUpperCase();
        }
    }

    /* =====================================================
       GALERIA DE IMAGENS
       Aceita:
       imagem: "https://..."
       imagem: "assets/produtos/camiseta.jpg"
       imagens: ["foto1.jpg", "foto2.jpg"]
       ===================================================== */

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

    function obterImagens() {
        const imagens = [];

        const principal = normalizarImagem(produtoSelecionado.imagem);

        if (principal) {
            imagens.push(principal);
        }

        if (Array.isArray(produtoSelecionado.imagens)) {
            produtoSelecionado.imagens.forEach(item => {
                const caminho = normalizarImagem(item);

                if (caminho && !imagens.includes(caminho)) {
                    imagens.push(caminho);
                }
            });
        }

        return imagens;
    }

    function configurarGaleria() {
        if (!mainImageContainer) {
            console.warn("Elemento .product-main-image não encontrado.");
            return;
        }

        const imagens = obterImagens();

        let imagemPrincipal = mainImageContainer.querySelector(
            ".product-main-photo"
        );

        if (!imagemPrincipal) {
            imagemPrincipal = document.createElement("img");
            imagemPrincipal.className = "product-main-photo";
            imagemPrincipal.alt = produtoSelecionado.nome || "Produto NØVA";

            Object.assign(imagemPrincipal.style, {
                display: "block",
                width: "100%",
                height: "100%",
                objectFit: "cover",
                objectPosition: "center"
            });

            mainImageContainer.appendChild(imagemPrincipal);
        }

        if (imagens.length === 0) {
            imagemPrincipal.removeAttribute("src");
            imagemPrincipal.hidden = true;

            if (placeholder) {
                placeholder.hidden = false;
                placeholder.textContent = "IMAGEM DO PRODUTO";
            }

            if (thumbnailsContainer) {
                thumbnailsContainer.querySelectorAll("button").forEach(botao => {
                    botao.hidden = true;
                });
            }

            console.warn(
                "Este produto não possui imagem cadastrada.",
                produtoSelecionado
            );

            return;
        }

        if (placeholder) {
            placeholder.hidden = true;
        }

        function selecionarImagem(caminho, botaoAtivo) {
            imagemPrincipal.hidden = false;
            imagemPrincipal.alt = produtoSelecionado.nome || "Produto NØVA";

            imagemPrincipal.onerror = () => {
                imagemPrincipal.hidden = true;

                if (placeholder) {
                    placeholder.hidden = false;
                    placeholder.textContent = "IMAGEM INDISPONÍVEL";
                }

                console.error("Não foi possível carregar a imagem:", caminho);
            };

            imagemPrincipal.onload = () => {
                imagemPrincipal.hidden = false;

                if (placeholder) {
                    placeholder.hidden = true;
                }
            };

            imagemPrincipal.src = caminho;

            if (thumbnailsContainer) {
                thumbnailsContainer.querySelectorAll("button").forEach(botao => {
                    botao.classList.remove("active");
                });
            }

            botaoAtivo?.classList.add("active");
        }

        if (thumbnailsContainer) {
            const botoes = Array.from(
                thumbnailsContainer.querySelectorAll("button")
            );

            imagens.forEach((caminho, indice) => {
                let botao = botoes[indice];

                if (!botao) {
                    botao = document.createElement("button");
                    botao.type = "button";
                    botao.className = "product-thumbnail";
                    thumbnailsContainer.appendChild(botao);
                }

                botao.hidden = false;
                botao.innerHTML = "";

                const miniatura = document.createElement("img");
                miniatura.src = caminho;
                miniatura.alt = `Foto ${indice + 1} de ${produtoSelecionado.nome || "produto"}`;

                Object.assign(miniatura.style, {
                    width: "100%",
                    height: "100%",
                    objectFit: "cover"
                });

                miniatura.onerror = () => {
                    botao.classList.add("thumbnail-error");
                };

                botao.appendChild(miniatura);

                botao.onclick = () => selecionarImagem(caminho, botao);
            });

            botoes.slice(imagens.length).forEach(botao => {
                botao.hidden = true;
            });

            selecionarImagem(
                imagens[0],
                thumbnailsContainer.querySelector("button:not([hidden])")
            );
        } else {
            selecionarImagem(imagens[0], null);
        }
    }

    /* CONTADOR DO CARRINHO */
    function atualizarContador() {
        if (!cartCount) return;

        let carrinho = [];

        try {
            carrinho = JSON.parse(localStorage.getItem(CART_KEY)) || [];
        } catch (erro) {
            carrinho = [];
        }

        const total = carrinho.reduce(
            (soma, produto) => soma + Number(produto.quantidade || 0),
            0
        );

        cartCount.textContent = total;
    }

    /* CORES */
    colorOptions.forEach(botao => {
        botao.addEventListener("click", () => {
            colorOptions.forEach(item => item.classList.remove("selected"));
            botao.classList.add("selected");

            corSelecionada =
                botao.getAttribute("aria-label") ||
                botao.dataset.color ||
                "Preto";

            if (selectedColorText) {
                selectedColorText.textContent = corSelecionada;
            }
        });
    });

    /* TAMANHOS */
    sizeOptions.forEach(botao => {
        botao.addEventListener("click", () => {
            sizeOptions.forEach(item => item.classList.remove("selected"));
            botao.classList.add("selected");
            tamanhoSelecionado = botao.textContent.trim();
        });
    });

    /* QUANTIDADE */
    if (quantityButtons && quantityDisplay) {
        const diminuir = quantityButtons[0];
        const aumentar = quantityButtons[1];

        diminuir?.addEventListener("click", () => {
            if (quantidade > 1) {
                quantidade--;
                quantityDisplay.textContent = quantidade;
            }
        });

        aumentar?.addEventListener("click", () => {
            const estoque = Number(produtoSelecionado.estoque);

            if (estoque > 0 && quantidade >= estoque) {
                mostrarMensagem("Quantidade máxima disponível em estoque.");
                return;
            }

            quantidade++;
            quantityDisplay.textContent = quantidade;
        });
    }

    /* ADICIONAR AO CARRINHO */
    if (addToCartButton) {
        addToCartButton.addEventListener("click", () => {
            let carrinho = [];

            try {
                carrinho = JSON.parse(localStorage.getItem(CART_KEY)) || [];
            } catch (erro) {
                carrinho = [];
            }

            const produtoExistente = carrinho.find(produto =>
                produto.id === produtoSelecionado.id &&
                produto.tamanho === tamanhoSelecionado &&
                produto.cor === corSelecionada
            );

            if (produtoExistente) {
                produtoExistente.quantidade =
                    Number(produtoExistente.quantidade || 0) + quantidade;
            } else {
                carrinho.push({
                    id: produtoSelecionado.id,
                    nome: produtoSelecionado.nome,
                    preco: Number(produtoSelecionado.preco || 0),
                    categoria: produtoSelecionado.categoria || "PRODUTO",
                    imagem: normalizarImagem(produtoSelecionado.imagem),
                    cor: corSelecionada,
                    tamanho: tamanhoSelecionado,
                    quantidade
                });
            }

            try {
                localStorage.setItem(CART_KEY, JSON.stringify(carrinho));
            } catch (erro) {
                console.error("Não foi possível salvar o carrinho:", erro);
                mostrarMensagem("Erro ao salvar o carrinho.");
                return;
            }

            atualizarContador();
            mostrarMensagem("Produto adicionado ao carrinho!");

            const textoOriginal = addToCartButton.innerHTML;
            addToCartButton.innerHTML =
                '<i class="fa-solid fa-check"></i> Adicionado ao carrinho';

            setTimeout(() => {
                addToCartButton.innerHTML = textoOriginal;
            }, 1800);
        });
    }

    /* FAVORITOS */
    favoriteButtons.forEach(botao => {
        botao.addEventListener("click", () => {
            botao.classList.toggle("active");

            const icone = botao.querySelector("i");
            if (!icone) return;

            icone.classList.toggle(
                "fa-solid",
                botao.classList.contains("active")
            );

            icone.classList.toggle(
                "fa-regular",
                !botao.classList.contains("active")
            );
        });
    });

    /* INICIALIZAÇÃO */
    mostrarProduto();
    configurarGaleria();
    atualizarContador();
});

