/* =========================================================
   NØVA — LOJA
   ========================================================= */

document.addEventListener("DOMContentLoaded", () => {

    // =========================================================
    // CONFIGURAÇÕES
    // =========================================================

    const CART_KEY = "novaCarrinho";
    const PRODUTOS_KEY = "novaProdutos";

    let produtos = [];


    // =========================================================
    // ELEMENTOS
    // =========================================================

    const buscaInput =
        document.querySelector(".shop-search input");

    const categoryTabs =
        document.querySelectorAll(".category-tab");

    const categoryCheckboxes =
        document.querySelectorAll(
            ".filter-option input"
        );

    const sizeButtons =
        document.querySelectorAll(
            ".size-options button"
        );

    const priceInputs =
        document.querySelectorAll(
            ".price-inputs input"
        );

    const clearFilters =
        document.querySelector(".clear-filters");

    const sortSelect =
        document.querySelector(".sort-products");

    const productsCount =
        document.querySelector(".products-count");

    const cartCount =
        document.querySelector(".cart-count");

    const shopGrid =
        document.querySelector(".shop-grid");


    // =========================================================
    // PRODUTOS PADRÃO
    // =========================================================
    // Usados somente se ainda não existir novaProdutos.

    const produtosPadrao = [
        {
            id: "NVA-TEE-001",
            nome: "Essential Tee",
            categoria: "Camisetas",
            preco: 89.90,
            estoque: 42,
            ativo: true
        },
        {
            id: "NVA-HOD-002",
            nome: "Heavy Hoodie",
            categoria: "Moletons",
            preco: 199.90,
            estoque: 7,
            ativo: true
        },
        {
            id: "NVA-CAR-003",
            nome: "Cargo Pants",
            categoria: "Calças",
            preco: 179.90,
            estoque: 25,
            ativo: true
        },
        {
            id: "NVA-CAP-004",
            nome: "Essential Cap",
            categoria: "Acessórios",
            preco: 69.90,
            estoque: 0,
            ativo: false
        },
        {
            id: "NVA-OVR-005",
            nome: "Oversized Tee",
            categoria: "Camisetas",
            preco: 109.90,
            estoque: 31,
            ativo: true
        }
    ];


    // =========================================================
    // CARREGAR PRODUTOS DO ADM
    // =========================================================

    function carregarProdutos() {

        try {

            const dados =
                localStorage.getItem(
                    PRODUTOS_KEY
                );


            if (dados) {

                const produtosSalvos =
                    JSON.parse(dados);


                if (
                    Array.isArray(
                        produtosSalvos
                    )
                ) {

                    return produtosSalvos
                        .filter(
                            produto =>
                                produto &&
                                produto.ativo !== false &&
                                Number(
                                    produto.estoque ?? 0
                                ) > 0
                        );
                }
            }

        } catch (erro) {

            console.error(
                "Erro ao carregar produtos:",
                erro
            );
        }


        // Caso ainda não exista cadastro no ADM
        return produtosPadrao.filter(
            produto =>
                produto.ativo &&
                produto.estoque > 0
        );
    }


    // =========================================================
    // CONVERTER PREÇO
    // =========================================================

    function converterPreco(valor) {

        if (
            typeof valor === "number"
        ) {
            return valor;
        }


        if (!valor) {
            return 0;
        }


        return Number(
            String(valor)
                .replace(/[^\d,.-]/g, "")
                .replace(/\./g, "")
                .replace(",", ".")
        ) || 0;
    }


    // =========================================================
    // FORMATAR PREÇO
    // =========================================================

    function formatarPreco(valor) {

        return Number(
            valor || 0
        ).toLocaleString(
            "pt-BR",
            {
                style: "currency",
                currency: "BRL"
            }
        );
    }


    // =========================================================
    // CRIAR CARD DO PRODUTO
    // =========================================================

    function criarCardProduto(
        produto,
        index
    ) {

        const card =
            document.createElement("article");


        card.className =
            "shop-product-card";


        card.dataset.id =
            produto.id;


        card.dataset.categoria =
            produto.categoria || "";


        const imagem =
            produto.imagem ||
            "";


        const imagemHTML =
            imagem
                ? `
                    <img
                        src="${imagem}"
                        alt="${produto.nome}"
                    >
                `
                : `
                    <div class="product-placeholder">
                        <span>NØVA</span>
                    </div>
                `;


        card.innerHTML = `

            <div class="shop-product-image">

                ${imagemHTML}

                <button
                    type="button"
                    class="favorite-button"
                    aria-label="Adicionar aos favoritos"
                >
                    <i class="fa-regular fa-heart"></i>
                </button>

            </div>


            <div class="shop-product-info">

                <span class="product-category">
                    ${produto.categoria || "Produto"}
                </span>


                <h3>
                    ${produto.nome}
                </h3>


                <span class="product-price">
                    ${formatarPreco(produto.preco)}
                </span>

            </div>

        `;


        return card;
    }


    // =========================================================
    // RENDERIZAR PRODUTOS
    // =========================================================

    function renderizarProdutos() {

        if (!shopGrid) {
            return;
        }


        shopGrid.innerHTML = "";


        produtos.forEach(
            (produto, index) => {

                const card =
                    criarCardProduto(
                        produto,
                        index
                    );


                produto.card =
                    card;


                produto.indiceOriginal =
                    index;


                produto.favorito =
                    false;


                shopGrid.appendChild(
                    card
                );
            }
        );


        configurarFavoritos();

        configurarCards();


        atualizarProdutos();
    }


    // =========================================================
    // ATUALIZAR CONTADOR DO CARRINHO
    // =========================================================

    function atualizarContador() {

        if (!cartCount) {
            return;
        }


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


        const quantidade =
            carrinho.reduce(
                (total, produto) => {

                    return total +
                        Number(
                            produto.quantidade || 0
                        );

                },
                0
            );


        cartCount.textContent =
            quantidade;
    }


    // =========================================================
    // ATUALIZAR PRODUTOS
    // =========================================================

    function atualizarProdutos() {

        let produtosVisiveis =
            [...produtos];


        // =====================================================
        // BUSCA
        // =====================================================

        const busca =
            buscaInput?.value
                .trim()
                .toLowerCase() || "";


        if (busca) {

            produtosVisiveis =
                produtosVisiveis.filter(
                    produto => {

                        const nome =
                            String(
                                produto.nome || ""
                            ).toLowerCase();


                        const categoria =
                            String(
                                produto.categoria || ""
                            ).toLowerCase();


                        return (
                            nome.includes(busca) ||
                            categoria.includes(busca)
                        );
                    }
                );
        }


        // =====================================================
        // CATEGORIAS
        // =====================================================

        const categoriasSelecionadas =
            Array.from(
                categoryCheckboxes
            )
                .filter(
                    checkbox =>
                        checkbox.checked
                )
                .map(
                    checkbox =>
                        checkbox.nextElementSibling
                            ?.textContent
                            .trim()
                            .toLowerCase()
                );


        if (
            categoriasSelecionadas.length > 0
        ) {

            produtosVisiveis =
                produtosVisiveis.filter(
                    produto => {

                        const categoriaProduto =
                            String(
                                produto.categoria || ""
                            )
                                .toLowerCase();


                        return categoriasSelecionadas
                            .some(
                                categoria => {

                                    return (
                                        categoriaProduto ===
                                        categoria
                                    ) ||
                                    (
                                        categoriaProduto
                                            .replace(
                                                /s$/,
                                                ""
                                            ) ===
                                        categoria
                                            .replace(
                                                /s$/,
                                                ""
                                            )
                                    );
                                }
                            );
                    }
                );
        }


        // =====================================================
        // PREÇO
        // =====================================================

        const precoMin =
            Number(
                priceInputs[0]?.value
            ) || 0;


        const precoMaxValor =
            Number(
                priceInputs[1]?.value
            );


        const precoMax =
            precoMaxValor > 0
                ? precoMaxValor
                : Infinity;


        produtosVisiveis =
            produtosVisiveis.filter(
                produto => {

                    const preco =
                        Number(
                            produto.preco || 0
                        );


                    return (
                        preco >= precoMin &&
                        preco <= precoMax
                    );
                }
            );


        // =====================================================
        // ORDENAÇÃO
        // =====================================================

        const ordenacao =
            sortSelect?.value || "";


        if (
            ordenacao === "Menor preço"
        ) {

            produtosVisiveis.sort(
                (a, b) =>
                    Number(a.preco || 0) -
                    Number(b.preco || 0)
            );
        }


        else if (
            ordenacao === "Maior preço"
        ) {

            produtosVisiveis.sort(
                (a, b) =>
                    Number(b.preco || 0) -
                    Number(a.preco || 0)
            );
        }


        else {

            produtosVisiveis.sort(
                (a, b) =>
                    a.indiceOriginal -
                    b.indiceOriginal
            );
        }


        // =====================================================
        // ORGANIZAR CARDS
        // =====================================================

        if (shopGrid) {

            produtosVisiveis.forEach(
                produto => {

                    if (produto.card) {

                        shopGrid.appendChild(
                            produto.card
                        );
                    }
                }
            );


            produtos.forEach(
                produto => {

                    if (!produto.card) {
                        return;
                    }


                    produto.card.style.display =
                        produtosVisiveis.includes(
                            produto
                        )
                            ? ""
                            : "none";
                }
            );
        }


        // =====================================================
        // CONTADOR
        // =====================================================

        if (productsCount) {

            productsCount.textContent =
                produtosVisiveis.length === 1
                    ? "1 produto"
                    : `${produtosVisiveis.length} produtos`;
        }
    }


    // =========================================================
    // BUSCA
    // =========================================================

    if (buscaInput) {

        buscaInput.addEventListener(
            "input",
            atualizarProdutos
        );
    }


    // =========================================================
    // ABAS DE CATEGORIA
    // =========================================================

    categoryTabs.forEach(
        tab => {

            tab.addEventListener(
                "click",
                () => {

                    categoryTabs.forEach(
                        item =>
                            item.classList.remove(
                                "active"
                            )
                    );


                    tab.classList.add(
                        "active"
                    );


                    const categoria =
                        tab.textContent
                            .trim()
                            .toLowerCase();


                    // TODOS
                    if (
                        categoria === "todos"
                    ) {

                        categoryCheckboxes.forEach(
                            checkbox =>
                                checkbox.checked =
                                    false
                        );

                    }

                    // CATEGORIA
                    else {

                        categoryCheckboxes.forEach(
                            checkbox => {

                                const texto =
                                    checkbox
                                        .nextElementSibling
                                        ?.textContent
                                        .trim()
                                        .toLowerCase();


                                checkbox.checked =
                                    texto ===
                                    categoria;
                            }
                        );
                    }


                    atualizarProdutos();
                }
            );
        }
    );


    // =========================================================
    // CHECKBOXES DE CATEGORIA
    // =========================================================

    categoryCheckboxes.forEach(
        checkbox => {

            checkbox.addEventListener(
                "change",
                () => {

                    categoryTabs.forEach(
                        tab =>
                            tab.classList.remove(
                                "active"
                            )
                    );


                    atualizarProdutos();
                }
            );
        }
    );


    // =========================================================
    // TAMANHOS
    // =========================================================

    sizeButtons.forEach(
        button => {

            button.addEventListener(
                "click",
                () => {

                    button.classList.toggle(
                        "active"
                    );
                }
            );
        }
    );


    // =========================================================
    // FILTRO DE PREÇO
    // =========================================================

    priceInputs.forEach(
        input => {

            input.addEventListener(
                "input",
                atualizarProdutos
            );
        }
    );


    // =========================================================
    // ORDENAÇÃO
    // =========================================================

    if (sortSelect) {

        sortSelect.addEventListener(
            "change",
            atualizarProdutos
        );
    }


    // =========================================================
    // LIMPAR FILTROS
    // =========================================================

    if (clearFilters) {

        clearFilters.addEventListener(
            "click",
            () => {

                if (buscaInput) {
                    buscaInput.value = "";
                }


                categoryCheckboxes.forEach(
                    checkbox =>
                        checkbox.checked = false
                );


                sizeButtons.forEach(
                    button =>
                        button.classList.remove(
                            "active"
                        )
                );


                priceInputs.forEach(
                    input =>
                        input.value = ""
                );


                categoryTabs.forEach(
                    tab =>
                        tab.classList.remove(
                            "active"
                        )
                );


                const todos =
                    Array.from(
                        categoryTabs
                    ).find(
                        tab =>
                            tab.textContent
                                .trim()
                                .toLowerCase() ===
                            "todos"
                    );


                if (todos) {

                    todos.classList.add(
                        "active"
                    );
                }


                if (sortSelect) {
                    sortSelect.selectedIndex = 0;
                }


                atualizarProdutos();
            }
        );
    }


    // =========================================================
    // FAVORITOS
    // =========================================================

    function configurarFavoritos() {

        document
            .querySelectorAll(
                ".favorite-button"
            )
            .forEach(
                button => {

                    button.addEventListener(
                        "click",
                        event => {

                            event.preventDefault();

                            event.stopPropagation();


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
    }


    // =========================================================
    // CLICAR NO PRODUTO
    // =========================================================

    function configurarCards() {

        produtos.forEach(
            produto => {

                if (!produto.card) {
                    return;
                }


                produto.card.addEventListener(
                    "click",
                    event => {

                        // Não abrir produto pelo favorito
                        if (
                            event.target.closest(
                                ".favorite-button"
                            )
                        ) {

                            return;
                        }


                        localStorage.setItem(
                            "novaProdutoSelecionado",
                            JSON.stringify({

                                id:
                                    produto.id,

                                nome:
                                    produto.nome,

                                preco:
                                    Number(
                                        produto.preco || 0
                                    ),

                                categoria:
                                    produto.categoria,

                                imagem:
                                    produto.imagem ||
                                    "",

                                sku:
                                    produto.id,

                                estoque:
                                    Number(
                                        produto.estoque || 0
                                    )
                            })
                        );


                        window.location.href =
                            "produto.html";
                    }
                );
            }
        );
    }


    // =========================================================
    // SINCRONIZAÇÃO COM O ADM
    // =========================================================

    window.addEventListener(
        "storage",
        event => {

            if (
                event.key === PRODUTOS_KEY
            ) {

                produtos =
                    carregarProdutos();


                renderizarProdutos();

                atualizarContador();
            }
        }
    );


    // =========================================================
    // EVENTO INTERNO
    // =========================================================

    window.addEventListener(
        "novaProdutosAtualizados",
        event => {

            if (
                event.detail &&
                Array.isArray(
                    event.detail
                )
            ) {

                produtos =
                    event.detail.filter(
                        produto =>
                            produto &&
                            produto.ativo !== false &&
                            Number(
                                produto.estoque ?? 0
                            ) > 0
                    );


                renderizarProdutos();

                atualizarContador();
            }
        }
    );


    // =========================================================
    // INICIALIZAÇÃO
    // =========================================================

    produtos =
        carregarProdutos();


    renderizarProdutos();


    atualizarContador();

});