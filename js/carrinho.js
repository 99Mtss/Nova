/* =========================================================
   NØVA — CARRINHO
   ========================================================= */

document.addEventListener("DOMContentLoaded", () => {

    const CART_KEY = "novaCarrinho";

    const cartProducts = document.querySelector(".cart-products");
    const cartProductsHeader = document.querySelector(".cart-products-header");
    const summaryTotal = document.querySelector(".summary-total strong");
    const cartCount = document.querySelector(".cart-count");

    let carrinho = carregarCarrinho();


    /* =====================================================
       CARREGAR CARRINHO
       ===================================================== */

    function carregarCarrinho() {
        try {
            const dados = localStorage.getItem(CART_KEY);

            if (!dados) {
                return [];
            }

            const produtos = JSON.parse(dados);

            if (!Array.isArray(produtos)) {
                return [];
            }

            return produtos.map(produto => ({
                ...produto,
                quantidade: Number(produto.quantidade) || 1,
                preco: Number(produto.preco) || 0
            }));

        } catch (erro) {
            console.error("Erro ao carregar carrinho:", erro);
            return [];
        }
    }


    /* =====================================================
       FORMATAR PREÇO
       ===================================================== */

    function formatarPreco(valor) {
        return Number(valor).toLocaleString("pt-BR", {
            style: "currency",
            currency: "BRL"
        });
    }


    /* =====================================================
       SALVAR CARRINHO
       ===================================================== */

    function salvarCarrinho() {
        localStorage.setItem(
            CART_KEY,
            JSON.stringify(carrinho)
        );
    }


    /* =====================================================
       ATUALIZAR CONTADOR
       ===================================================== */

    function atualizarContador() {

        if (!cartCount) {
            return;
        }

        const quantidade = carrinho.reduce(
            (total, produto) => {
                return total + Number(produto.quantidade || 0);
            },
            0
        );

        cartCount.textContent = quantidade;
    }


    /* =====================================================
       ATUALIZAR RESUMO
       ===================================================== */

    function atualizarResumo() {

        const subtotal = carrinho.reduce(
            (total, produto) => {
                return total +
                    Number(produto.preco || 0) *
                    Number(produto.quantidade || 0);
            },
            0
        );


        /* SUBTOTAL */

        const subtotalElement = document.querySelector(
            ".summary-items .summary-row:first-child strong"
        );

        if (subtotalElement) {
            subtotalElement.textContent =
                formatarPreco(subtotal);
        }


        /* TOTAL */

        if (summaryTotal) {
            summaryTotal.textContent =
                formatarPreco(subtotal);
        }


        /* QUANTIDADE */

        if (cartProductsHeader) {

            const quantidade = carrinho.reduce(
                (total, produto) => {
                    return total +
                        Number(produto.quantidade || 0);
                },
                0
            );

            const quantidadeElement =
                cartProductsHeader.querySelector("span");

            if (quantidadeElement) {

                quantidadeElement.textContent =
                    quantidade === 1
                        ? "1 item"
                        : `${quantidade} itens`;
            }
        }
    }


    /* =====================================================
       CARRINHO VAZIO
       ===================================================== */

    function mostrarCarrinhoVazio() {

        const continuar =
            cartProducts.querySelector(".continue-shopping");

        if (!continuar) {
            return;
        }

        const vazio =
            document.createElement("div");

        vazio.className = "cart-empty";

        vazio.innerHTML = `
            <i class="fa-solid fa-bag-shopping"></i>

            <h3>
                Seu carrinho está vazio
            </h3>

            <p>
                Adicione alguns produtos para continuar.
            </p>

            <a href="loja.html">
                Explorar produtos
            </a>
        `;

        cartProducts.insertBefore(
            vazio,
            continuar
        );
    }


    /* =====================================================
       RENDERIZAR PRODUTOS
       ===================================================== */

    function renderizarCarrinho() {

        if (!cartProducts) {
            return;
        }


        /* Remove produtos antigos */

        cartProducts
            .querySelectorAll(".cart-item")
            .forEach(item => item.remove());


        /* Remove mensagem de carrinho vazio anterior */

        cartProducts
            .querySelectorAll(".cart-empty")
            .forEach(item => item.remove());


        /* Carrinho vazio */

        if (carrinho.length === 0) {

            mostrarCarrinhoVazio();

            atualizarResumo();
            atualizarContador();

            return;
        }


        /* Produtos */

        carrinho.forEach((produto, index) => {

            const item =
                document.createElement("article");

            item.className = "cart-item";


            const imagem =
                produto.imagem || "";


            item.innerHTML = `

                <div class="cart-item-image">

                    ${
                        imagem
                            ? `
                                <img
                                    src="${imagem}"
                                    alt="${produto.nome || "Produto NØVA"}"
                                >
                            `
                            : `
                                <span>
                                    IMAGEM
                                </span>
                            `
                    }

                </div>


                <div class="cart-item-info">

                    <span class="cart-item-category">
                        ${produto.categoria || "PRODUTO"}
                    </span>

                    <h3>
                        ${produto.nome || "Produto NØVA"}
                    </h3>

                    ${
                        produto.cor
                            ? `
                                <p class="cart-item-color">
                                    Cor: ${produto.cor}
                                </p>
                            `
                            : ""
                    }

                    ${
                        produto.tamanho
                            ? `
                                <p class="cart-item-size">
                                    Tamanho: ${produto.tamanho}
                                </p>
                            `
                            : ""
                    }

                    <button
                        class="remove-item"
                        type="button"
                        data-index="${index}"
                    >

                        <i class="fa-regular fa-trash-can"></i>

                        Remover

                    </button>

                </div>


                <div class="cart-item-right">

                    <div class="cart-item-price">
                        ${formatarPreco(produto.preco)}
                    </div>


                    <div class="cart-quantity">

                        <button
                            type="button"
                            class="decrease-quantity"
                            data-index="${index}"
                            aria-label="Diminuir quantidade"
                        >
                            −
                        </button>

                        <span>
                            ${produto.quantidade}
                        </span>

                        <button
                            type="button"
                            class="increase-quantity"
                            data-index="${index}"
                            aria-label="Aumentar quantidade"
                        >
                            +
                        </button>

                    </div>

                </div>

            `;


            const continuar =
                cartProducts.querySelector(
                    ".continue-shopping"
                );


            cartProducts.insertBefore(
                item,
                continuar
            );

        });


        adicionarEventos();

        atualizarResumo();

        atualizarContador();
    }


    /* =====================================================
       EVENTOS DOS BOTÕES
       ===================================================== */

    function adicionarEventos() {


        /* AUMENTAR */

        document
            .querySelectorAll(".increase-quantity")
            .forEach(button => {

                button.addEventListener(
                    "click",
                    () => {

                        const index =
                            Number(button.dataset.index);


                        if (!carrinho[index]) {
                            return;
                        }


                        carrinho[index].quantidade =
                            Number(
                                carrinho[index].quantidade
                            ) + 1;


                        salvarCarrinho();

                        renderizarCarrinho();

                    }
                );

            });


        /* DIMINUIR */

        document
            .querySelectorAll(".decrease-quantity")
            .forEach(button => {

                button.addEventListener(
                    "click",
                    () => {

                        const index =
                            Number(button.dataset.index);


                        if (!carrinho[index]) {
                            return;
                        }


                        if (
                            Number(
                                carrinho[index].quantidade
                            ) > 1
                        ) {

                            carrinho[index].quantidade--;

                        } else {

                            carrinho.splice(index, 1);

                        }


                        salvarCarrinho();

                        renderizarCarrinho();

                    }
                );

            });


        /* REMOVER */

        document
            .querySelectorAll(".remove-item")
            .forEach(button => {

                button.addEventListener(
                    "click",
                    () => {

                        const index =
                            Number(button.dataset.index);


                        if (!carrinho[index]) {
                            return;
                        }


                        carrinho.splice(index, 1);

                        salvarCarrinho();

                        renderizarCarrinho();

                    }
                );

            });

    }


    /* =====================================================
       INICIALIZAÇÃO
       ===================================================== */

    renderizarCarrinho();

    atualizarContador();

});