/* =========================================================
   NØVA — JAVASCRIPT PRINCIPAL
   ========================================================= */

document.addEventListener("DOMContentLoaded", () => {

    const CART_KEY = "novaCarrinho";

    /* =====================================================
       CARRINHO
       ===================================================== */

    let carrinho = [];

    try {
        carrinho = JSON.parse(
            localStorage.getItem(CART_KEY)
        ) || [];
    } catch (erro) {
        console.error("Erro ao carregar carrinho:", erro);
        carrinho = [];
    }


    /* =====================================================
       ELEMENTOS
       ===================================================== */

    const cartCount =
        document.querySelector(".cart-count");

    const productButtons =
        document.querySelectorAll(".product-cart");


    console.log("NØVA JS carregado.");
    console.log(
        "Botões encontrados:",
        productButtons.length
    );


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
       SALVAR
       ===================================================== */

    function salvarCarrinho() {

        localStorage.setItem(
            CART_KEY,
            JSON.stringify(carrinho)
        );

        atualizarContador();
    }


    /* =====================================================
       CONVERTER PREÇO
       ===================================================== */

    function converterPreco(valor) {

        if (!valor) {
            return 0;
        }

        return Number(
            valor
                .replace(/[^\d,]/g, "")
                .replace(",", ".")
        );
    }


    /* =====================================================
       ADICIONAR PRODUTO
       ===================================================== */

    function adicionarProduto(produto) {

        console.log("Produto recebido:", produto);

        const produtoExistente =
            carrinho.find(
                item => item.id === produto.id
            );


        if (produtoExistente) {

            produtoExistente.quantidade =
                Number(produtoExistente.quantidade || 0) + 1;

        } else {

            carrinho.push({
                id: produto.id,
                nome: produto.nome,
                preco: produto.preco,
                imagem: produto.imagem,
                categoria: produto.categoria || "PRODUTO",
                quantidade: 1
            });
        }


        salvarCarrinho();

        mostrarMensagem(
            "Produto adicionado ao carrinho!"
        );

        console.log(
            "Carrinho atual:",
            carrinho
        );
    }


    /* =====================================================
       BOTÕES DOS PRODUTOS
       ===================================================== */

    productButtons.forEach((button, index) => {

        button.addEventListener("click", (event) => {

            event.preventDefault();
            event.stopPropagation();


            console.log(
                "Clique detectado no produto:",
                index + 1
            );


            const card =
                button.closest(".product-card");


            if (!card) {

                console.error(
                    "Não encontrei .product-card para o botão."
                );

                return;
            }


            /* NOME */

            const nomeElement =
                card.querySelector(
                    ".product-info h3"
                );

            const nome =
                nomeElement
                    ? nomeElement.textContent.trim()
                    : "Produto NØVA";


            /* PREÇO */

            const precoElement =
                card.querySelector(
                    ".product-price"
                );

            const precoTexto =
                precoElement
                    ? precoElement.textContent.trim()
                    : "R$ 0,00";

            const preco =
                converterPreco(precoTexto);


            /* IMAGEM */

            const imagemElement =
                card.querySelector("img");

            const imagem =
                imagemElement
                    ? imagemElement.getAttribute("src")
                    : "";


            /* CATEGORIA */

            const categoriaElement =
                card.querySelector(
                    ".product-category"
                );

            const categoria =
                categoriaElement
                    ? categoriaElement.textContent.trim()
                    : "PRODUTO";


            /* PRODUTO */

            const produto = {

                id: `nova-produto-${index + 1}`,

                nome: nome,

                preco: preco,

                imagem: imagem,

                categoria: categoria
            };


            adicionarProduto(produto);

        });

    });


    /* =====================================================
       MENSAGEM
       ===================================================== */

    function mostrarMensagem(texto) {

        const mensagemExistente =
            document.querySelector(".nova-mensagem");


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
                zIndex: "99999",
                padding: "14px 20px",
                background: "#1E222B",
                color: "#F5F7FA",
                border: "1px solid #8B5CF6",
                borderRadius: "8px",
                fontSize: "14px",
                fontFamily: "Arial, sans-serif",
                boxShadow:
                    "0 10px 30px rgba(0,0,0,0.3)"
            }
        );


        document.body.appendChild(
            mensagem
        );


        setTimeout(() => {

            if (mensagem) {
                mensagem.remove();
            }

        }, 2500);
    }


    /* =====================================================
       MENU MOBILE
       ===================================================== */

    const menuMobile =
        document.querySelector(".menu-mobile") ||
        document.querySelector(".menu-toggle");


    const nav =
        document.querySelector(".nav");


    if (menuMobile && nav) {

        menuMobile.addEventListener(
            "click",
            () => {

                nav.classList.toggle(
                    "menu-open"
                );

            }
        );
    }


    /* =====================================================
       HERO
       ===================================================== */

    const hero =
        document.querySelector(".hero");

    const heroLeft =
        document.querySelector(
            ".hero-arrow-left"
        );

    const heroRight =
        document.querySelector(
            ".hero-arrow-right"
        );

    const heroDots =
        document.querySelectorAll(
            ".hero-dot"
        );


    let bannerAtual = 0;


    function atualizarBanner() {

        heroDots.forEach(
            (dot, index) => {

                dot.classList.toggle(
                    "active",
                    index === bannerAtual
                );

            }
        );
    }


    if (heroLeft) {

        heroLeft.addEventListener(
            "click",
            () => {

                bannerAtual--;

                if (bannerAtual < 0) {
                    bannerAtual =
                        heroDots.length - 1;
                }

                atualizarBanner();

            }
        );
    }


    if (heroRight) {

        heroRight.addEventListener(
            "click",
            () => {

                bannerAtual++;

                if (
                    bannerAtual >=
                    heroDots.length
                ) {
                    bannerAtual = 0;
                }

                atualizarBanner();

            }
        );
    }


    heroDots.forEach(
        (dot, index) => {

            dot.addEventListener(
                "click",
                () => {

                    bannerAtual = index;

                    atualizarBanner();

                }
            );

        }
    );


    /* =====================================================
       INICIALIZAÇÃO
       ===================================================== */

    atualizarContador();

    atualizarBanner();

    console.log("TESTE NØVA APP.JS");
});