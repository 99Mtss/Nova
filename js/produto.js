/* =========================================================
   NØVA — PÁGINA DO PRODUTO
   ========================================================= */

document.addEventListener("DOMContentLoaded", () => {

    const CART_KEY = "novaCarrinho";
    const PRODUCT_KEY = "novaProdutoSelecionado";


    /* =====================================================
       ELEMENTOS
       ===================================================== */

    const productTitle =
        document.querySelector(".product-information h1");

    const productPrice =
        document.querySelector(".product-detail-price strong");

    const productReference =
        document.querySelector(".product-reference");

    const breadcrumbProduct =
        document.querySelector(".product-breadcrumb span");

    const colorOptions =
        document.querySelectorAll(".color-option");

    const selectedColorText =
        document.querySelector(".option-heading strong");

    const sizeOptions =
        document.querySelectorAll(".product-sizes button");

    const quantityControl =
        document.querySelector(".quantity-control");

    const quantityDisplay =
        quantityControl?.querySelector("span");

    const quantityButtons =
        quantityControl?.querySelectorAll("button");

    const addToCartButton =
        document.querySelector(".add-to-cart");

    const cartCount =
        document.querySelector(".cart-count");

    const favoriteButtons =
        document.querySelectorAll(
            ".gallery-favorite, .buy-favorite"
        );


    /* =====================================================
       PRODUTO SELECIONADO
       ===================================================== */

    let produtoSelecionado = null;

    try {

        produtoSelecionado =
            JSON.parse(
                localStorage.getItem(PRODUCT_KEY)
            );

    } catch (erro) {

        produtoSelecionado = null;
    }


    /* =====================================================
       VERIFICAR PRODUTO
       ===================================================== */

    if (!produtoSelecionado) {

        mostrarMensagem(
            "Nenhum produto selecionado."
        );

        setTimeout(() => {

            window.location.href = "loja.html";

        }, 1200);

        return;
    }


    /* =====================================================
       VARIÁVEIS DO PRODUTO
       ===================================================== */

    let quantidade = 1;

    let corSelecionada = "Preto";

    let tamanhoSelecionado = "M";


    /* =====================================================
       MOSTRAR PRODUTO
       ===================================================== */

    function mostrarProduto() {

        if (productTitle) {

            productTitle.textContent =
                produtoSelecionado.nome;
        }


        if (productPrice) {

            productPrice.textContent =
                formatarPreco(
                    produtoSelecionado.preco
                );
        }


        if (breadcrumbProduct) {

            breadcrumbProduct.textContent =
                produtoSelecionado.nome;
        }


        if (productReference) {

            if (produtoSelecionado.categoria) {

                productReference.textContent =
                    produtoSelecionado.categoria
                        .toUpperCase();
            }
        }
    }


    /* =====================================================
       FORMATAR PREÇO
       ===================================================== */

    function formatarPreco(valor) {

        return Number(valor).toLocaleString(
            "pt-BR",
            {
                style: "currency",
                currency: "BRL"
            }
        );
    }


    /* =====================================================
       ATUALIZAR CONTADOR DO CARRINHO
       ===================================================== */

    function atualizarContador() {

        if (!cartCount) {
            return;
        }

        let carrinho = [];

        try {

            carrinho =
                JSON.parse(
                    localStorage.getItem(CART_KEY)
                ) || [];

        } catch (erro) {

            carrinho = [];
        }


        const total =
            carrinho.reduce(
                (soma, produto) =>
                    soma +
                    Number(
                        produto.quantidade || 0
                    ),
                0
            );


        cartCount.textContent = total;
    }


    /* =====================================================
       CORES
       ===================================================== */

    colorOptions.forEach(
        button => {

            button.addEventListener(
                "click",
                () => {

                    colorOptions.forEach(
                        item =>
                            item.classList.remove(
                                "selected"
                            )
                    );


                    button.classList.add(
                        "selected"
                    );


                    corSelecionada =
                        button.getAttribute(
                            "aria-label"
                        ) || "Preto";


                    if (selectedColorText) {

                        selectedColorText.textContent =
                            corSelecionada;
                    }
                }
            );
        }
    );


    /* =====================================================
       TAMANHOS
       ===================================================== */

    sizeOptions.forEach(
        button => {

            button.addEventListener(
                "click",
                () => {

                    sizeOptions.forEach(
                        item =>
                            item.classList.remove(
                                "selected"
                            )
                    );


                    button.classList.add(
                        "selected"
                    );


                    tamanhoSelecionado =
                        button.textContent
                            .trim();
                }
            );
        }
    );


    /* =====================================================
       QUANTIDADE
       ===================================================== */

    if (
        quantityButtons &&
        quantityDisplay
    ) {

        const diminuir =
            quantityButtons[0];

        const aumentar =
            quantityButtons[1];


        /* ================================
           DIMINUIR
           ================================= */

        diminuir.addEventListener(
            "click",
            () => {

                if (quantidade <= 1) {
                    return;
                }


                quantidade--;


                quantityDisplay.textContent =
                    quantidade;
            }
        );


        /* ================================
           AUMENTAR
           ================================= */

        aumentar.addEventListener(
            "click",
            () => {

                quantidade++;


                quantityDisplay.textContent =
                    quantidade;
            }
        );
    }


    /* =====================================================
       ADICIONAR AO CARRINHO
       ===================================================== */

    if (addToCartButton) {

        addToCartButton.addEventListener(
            "click",
            () => {

                let carrinho = [];

                try {

                    carrinho =
                        JSON.parse(
                            localStorage.getItem(
                                CART_KEY
                            )
                        ) || [];

                } catch (erro) {

                    carrinho = [];
                }


                /*
                   Cada combinação de produto +
                   tamanho + cor é uma variante
                   diferente.
                */

                const produtoExistente =
                    carrinho.find(
                        produto =>
                            produto.id ===
                                produtoSelecionado.id &&

                            produto.tamanho ===
                                tamanhoSelecionado &&

                            produto.cor ===
                                corSelecionada
                    );


                if (produtoExistente) {

                    produtoExistente.quantidade +=
                        quantidade;

                } else {

                    carrinho.push({

                        id:
                            produtoSelecionado.id,

                        nome:
                            produtoSelecionado.nome,

                        preco:
                            Number(
                                produtoSelecionado.preco
                            ),

                        categoria:
                            produtoSelecionado.categoria ||
                            "PRODUTO",

                        cor:
                            corSelecionada,

                        tamanho:
                            tamanhoSelecionado,

                        quantidade:
                            quantidade
                    });
                }


                /* ================================
                   SALVAR CARRINHO
                   ================================= */

                localStorage.setItem(
                    CART_KEY,
                    JSON.stringify(carrinho)
                );


                /* ================================
                   ATUALIZAR CONTADOR
                   ================================= */

                atualizarContador();


                /* ================================
                   MENSAGEM
                   ================================= */

                mostrarMensagem(
                    "Produto adicionado ao carrinho!"
                );


                /*
                   Pequena alteração visual no botão.
                */

                const textoOriginal =
                    addToCartButton.innerHTML;


                addToCartButton.innerHTML = `
                    <i class="fa-solid fa-check"></i>
                    Adicionado ao carrinho
                `;


                setTimeout(() => {

                    addToCartButton.innerHTML =
                        textoOriginal;

                }, 1800);
            }
        );
    }


    /* =====================================================
       FAVORITO
       ===================================================== */

    favoriteButtons.forEach(
        button => {

            button.addEventListener(
                "click",
                () => {

                    button.classList.toggle(
                        "active"
                    );


                    const icon =
                        button.querySelector(
                            "i"
                        );


                    if (!icon) {
                        return;
                    }


                    if (
                        button.classList.contains(
                            "active"
                        )
                    ) {

                        icon.classList.remove(
                            "fa-regular"
                        );

                        icon.classList.add(
                            "fa-solid"
                        );

                    } else {

                        icon.classList.remove(
                            "fa-solid"
                        );

                        icon.classList.add(
                            "fa-regular"
                        );
                    }
                }
            );
        }
    );


    /* =====================================================
       MENSAGEM
       ===================================================== */

    function mostrarMensagem(texto) {

        const mensagemExistente =
            document.querySelector(
                ".nova-mensagem"
            );


        if (mensagemExistente) {
            mensagemExistente.remove();
        }


        const mensagem =
            document.createElement("div");


        mensagem.className =
            "nova-mensagem";


        mensagem.textContent =
            texto;


        Object.assign(
            mensagem.style,
            {
                position: "fixed",
                bottom: "25px",
                right: "25px",
                zIndex: "9999",
                padding: "14px 20px",
                background: "#1E222B",
                color: "#F5F7FA",
                border: "1px solid #8B5CF6",
                borderRadius: "8px",
                fontSize: "14px",
                boxShadow:
                    "0 10px 30px rgba(0,0,0,0.3)",
                animation:
                    "fadeIn 0.3s ease"
            }
        );


        document.body.appendChild(
            mensagem
        );


        setTimeout(() => {

            mensagem.remove();

        }, 2500);
    }


    /* =====================================================
       INICIALIZAÇÃO
       ===================================================== */

    mostrarProduto();

    atualizarContador();

});