document.addEventListener("DOMContentLoaded", () => {

    // =========================================================
    // CONFIGURAÇÕES
    // =========================================================

    const PRODUTOS_KEY = "novaProdutos";
    const PRODUTOS_KEY_ANTIGO = "novaProdutosAdmin";

    const ITENS_POR_PAGINA = 5;

    let produtos = [];
    let produtosFiltrados = [];
    let paginaAtual = 1;


    // =========================================================
    // PRODUTOS PADRÃO
    // =========================================================

    const produtosPadrao = [
        {
            id: "NVA-TEE-001",
            nome: "Essential Tee",
            categoria: "Camisetas",
            preco: 89.90,
            estoque: 42,
            ativo: true,
            criadoEm: new Date().toISOString()
        },

        {
            id: "NVA-HOD-002",
            nome: "Heavy Hoodie",
            categoria: "Moletons",
            preco: 199.90,
            estoque: 7,
            ativo: true,
            criadoEm: new Date().toISOString()
        },

        {
            id: "NVA-CAR-003",
            nome: "Cargo Pants",
            categoria: "Calças",
            preco: 179.90,
            estoque: 25,
            ativo: true,
            criadoEm: new Date().toISOString()
        },

        {
            id: "NVA-CAP-004",
            nome: "Essential Cap",
            categoria: "Acessórios",
            preco: 69.90,
            estoque: 0,
            ativo: false,
            criadoEm: new Date().toISOString()
        },

        {
            id: "NVA-OVR-005",
            nome: "Oversized Tee",
            categoria: "Camisetas",
            preco: 109.90,
            estoque: 31,
            ativo: true,
            criadoEm: new Date().toISOString()
        }
    ];


    // =========================================================
    // OBTER PRODUTOS
    // =========================================================

    function obterProdutos() {

        const produtosNovos =
            localStorage.getItem(PRODUTOS_KEY);

        if (produtosNovos) {

            try {

                const dados =
                    JSON.parse(produtosNovos);

                if (Array.isArray(dados)) {
                    return dados;
                }

            } catch (erro) {

                console.error(
                    "Erro ao carregar produtos:",
                    erro
                );
            }
        }


        // =====================================================
        // MIGRAÇÃO DA CHAVE ANTIGA
        // =====================================================

        const produtosAntigos =
            localStorage.getItem(PRODUTOS_KEY_ANTIGO);

        if (produtosAntigos) {

            try {

                const dadosAntigos =
                    JSON.parse(produtosAntigos);

                if (Array.isArray(dadosAntigos)) {

                    localStorage.setItem(
                        PRODUTOS_KEY,
                        JSON.stringify(dadosAntigos)
                    );

                    return dadosAntigos;
                }

            } catch (erro) {

                console.error(
                    "Erro ao migrar produtos antigos:",
                    erro
                );
            }
        }


        // =====================================================
        // CRIAR PRODUTOS PADRÃO
        // =====================================================

        localStorage.setItem(
            PRODUTOS_KEY,
            JSON.stringify(produtosPadrao)
        );

        return [...produtosPadrao];
    }


    // =========================================================
    // SALVAR PRODUTOS
    // =========================================================

    function salvarProdutos() {

        localStorage.setItem(
            PRODUTOS_KEY,
            JSON.stringify(produtos)
        );

        window.dispatchEvent(
            new CustomEvent(
                "novaProdutosAtualizados",
                {
                    detail: produtos
                }
            )
        );
    }


    // =========================================================
    // FORMATAR PREÇO
    // =========================================================

    function formatarPreco(valor) {

        return Number(valor || 0).toLocaleString(
            "pt-BR",
            {
                style: "currency",
                currency: "BRL"
            }
        );
    }


    // =========================================================
    // ELEMENTOS
    // =========================================================

    const tabela =
        document.querySelector(
            ".produtos-table tbody"
        );

    const busca =
        document.querySelector(
            ".produto-search input"
        );

    const filtroStatus =
        document.querySelector(
            ".produtos-filtros select:nth-of-type(1)"
        );

    const filtroCategoria =
        document.querySelector(
            ".produtos-filtros select:nth-of-type(2)"
        );

    const botaoFiltro =
        document.querySelector(
            ".filter-button"
        );

    const botaoAdicionar =
        document.querySelector(
            ".btn-admin-primary"
        );

    const paginacao =
        document.querySelector(
            ".table-pagination"
        );


    // =========================================================
    // CARREGAR PRODUTOS
    // =========================================================

    produtos = obterProdutos();

    produtosFiltrados = [...produtos];


    // =========================================================
    // ATUALIZAR ESTATÍSTICAS
    // =========================================================

    function atualizarEstatisticas() {

        const totalProdutos =
            produtos.length;

        const produtosAtivos =
            produtos.filter(
                produto => produto.ativo
            ).length;

        const estoqueBaixo =
            produtos.filter(
                produto =>
                    Number(produto.estoque) > 0 &&
                    Number(produto.estoque) <= 10
            ).length;

        const semEstoque =
            produtos.filter(
                produto =>
                    Number(produto.estoque) <= 0
            ).length;


        const cards =
            document.querySelectorAll(
                ".produto-stat"
            );

        if (!cards.length) return;


        const valores = [
            totalProdutos,
            produtosAtivos,
            estoqueBaixo,
            semEstoque
        ];


        cards.forEach(
            (card, index) => {

                const valor =
                    card.querySelector("strong");

                if (valor) {
                    valor.textContent =
                        valores[index] ?? 0;
                }
            }
        );
    }


    // =========================================================
    // STATUS DO ESTOQUE
    // =========================================================

    function obterClasseEstoque(estoque) {

        estoque = Number(estoque);

        if (estoque <= 0) {
            return "out";
        }

        if (estoque <= 10) {
            return "low";
        }

        return "";
    }


    function obterTextoEstoque(estoque) {

        estoque = Number(estoque);

        if (estoque <= 0) {
            return "Sem estoque";
        }

        return `${estoque} unidades`;
    }


    // =========================================================
    // ESCAPAR HTML
    // =========================================================

    function escaparHTML(texto) {

        return String(texto || "")
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
    }


    // =========================================================
    // RENDERIZAR PRODUTOS
    // =========================================================

    function renderizarProdutos() {

        if (!tabela) return;

        tabela.innerHTML = "";


        const inicio =
            (paginaAtual - 1) *
            ITENS_POR_PAGINA;

        const fim =
            inicio +
            ITENS_POR_PAGINA;


        const produtosPagina =
            produtosFiltrados.slice(
                inicio,
                fim
            );


        if (!produtosPagina.length) {

            tabela.innerHTML = `
                <tr>
                    <td colspan="6">
                        <div style="
                            padding: 40px;
                            text-align: center;
                            opacity: .7;
                        ">
                            Nenhum produto encontrado.
                        </div>
                    </td>
                </tr>
            `;

            atualizarPaginacao();

            return;
        }


        produtosPagina.forEach(
            produto => {

                const linha =
                    document.createElement("tr");


                const classeEstoque =
                    obterClasseEstoque(
                        produto.estoque
                    );


                const textoEstoque =
                    obterTextoEstoque(
                        produto.estoque
                    );


                const statusTexto =
                    produto.ativo
                        ? "Ativo"
                        : "Inativo";


                const statusClasse =
                    produto.ativo
                        ? "active"
                        : "inactive";


                linha.innerHTML = `

                    <td>

                        <div class="produto-table-info">

                            <div class="produto-table-image">

                                ${
                                    produto.imagem
                                    ?
                                    `
                                    <img
                                        src="${escaparHTML(produto.imagem)}"
                                        alt="${escaparHTML(produto.nome)}"
                                    >
                                    `
                                    :
                                    `
                                    <span>
                                        NØVA
                                    </span>
                                    `
                                }

                            </div>

                            <div>

                                <strong>
                                    ${escaparHTML(produto.nome)}
                                </strong>

                                <span>
                                    ${escaparHTML(produto.id)}
                                </span>

                            </div>

                        </div>

                    </td>


                    <td>
                        ${escaparHTML(produto.categoria || "-")}
                    </td>


                    <td class="price">
                        ${formatarPreco(produto.preco)}
                    </td>


                    <td>

                        <span class="stock ${classeEstoque}">
                            ${textoEstoque}
                        </span>

                    </td>


                    <td>

                        <span class="product-status ${statusClasse}">
                            ${statusTexto}
                        </span>

                    </td>


                    <td>

                        <div class="table-actions">

                            <button
                                type="button"
                                class="edit-product"
                                data-id="${escaparHTML(produto.id)}"
                                title="Editar"
                            >
                                ✎
                            </button>


                            <button
                                type="button"
                                class="delete-product"
                                data-id="${escaparHTML(produto.id)}"
                                title="Excluir"
                            >
                                ×
                            </button>


                            <button
                                type="button"
                                class="toggle-product"
                                data-id="${escaparHTML(produto.id)}"
                                title="${
                                    produto.ativo
                                    ? "Desativar"
                                    : "Ativar"
                                }"
                            >
                                ${
                                    produto.ativo
                                    ? "●"
                                    : "○"
                                }
                            </button>

                        </div>

                    </td>

                `;


                tabela.appendChild(linha);
            }
        );


        atualizarPaginacao();
    }


    // =========================================================
    // PAGINAÇÃO
    // =========================================================

    function atualizarPaginacao() {

        if (!paginacao) return;


        const totalPaginas =
            Math.max(
                1,
                Math.ceil(
                    produtosFiltrados.length /
                    ITENS_POR_PAGINA
                )
            );


        paginacao.innerHTML = "";


        const botaoAnterior =
            document.createElement("button");

        botaoAnterior.textContent = "‹";

        botaoAnterior.disabled =
            paginaAtual === 1;


        botaoAnterior.addEventListener(
            "click",
            () => {

                if (paginaAtual > 1) {

                    paginaAtual--;

                    renderizarProdutos();
                }
            }
        );


        paginacao.appendChild(
            botaoAnterior
        );


        for (
            let pagina = 1;
            pagina <= totalPaginas;
            pagina++
        ) {

            const botao =
                document.createElement("button");

            botao.textContent =
                pagina;


            if (pagina === paginaAtual) {
                botao.classList.add("active");
            }


            botao.addEventListener(
                "click",
                () => {

                    paginaAtual =
                        pagina;

                    renderizarProdutos();
                }
            );


            paginacao.appendChild(
                botao
            );
        }


        const botaoProximo =
            document.createElement("button");

        botaoProximo.textContent = "›";

        botaoProximo.disabled =
            paginaAtual === totalPaginas;


        botaoProximo.addEventListener(
            "click",
            () => {

                if (
                    paginaAtual <
                    totalPaginas
                ) {

                    paginaAtual++;

                    renderizarProdutos();
                }
            }
        );


        paginacao.appendChild(
            botaoProximo
        );
    }


    // =========================================================
    // FILTRAR PRODUTOS
    // =========================================================

    function aplicarFiltros() {

        const texto =
            busca?.value
                ?.trim()
                .toLowerCase() || "";


        const status =
            filtroStatus?.value || "";


        const categoria =
            filtroCategoria?.value || "";


        produtosFiltrados =
            produtos.filter(
                produto => {

                    const correspondeBusca =
                        !texto ||
                        String(produto.nome)
                            .toLowerCase()
                            .includes(texto) ||
                        String(produto.id)
                            .toLowerCase()
                            .includes(texto);


                    if (!correspondeBusca) {
                        return false;
                    }


                    if (
                        status === "Ativos" &&
                        !produto.ativo
                    ) {
                        return false;
                    }


                    if (
                        status === "Inativos" &&
                        produto.ativo
                    ) {
                        return false;
                    }


                    if (
                        status === "Estoque baixo" &&
                        !(
                            Number(produto.estoque) > 0 &&
                            Number(produto.estoque) <= 10
                        )
                    ) {
                        return false;
                    }


                    if (
                        status === "Sem estoque" &&
                        Number(produto.estoque) > 0
                    ) {
                        return false;
                    }


                    if (
                        categoria &&
                        categoria !== "Todas as categorias" &&
                        produto.categoria !== categoria
                    ) {
                        return false;
                    }


                    return true;
                }
            );


        paginaAtual = 1;

        renderizarProdutos();
    }


    // =========================================================
    // CRIAR MODAL
    // =========================================================

    function criarModal() {

        const modalExistente =
            document.querySelector(
                ".produto-modal"
            );

        if (modalExistente) {
            return modalExistente;
        }


        const modal =
            document.createElement("div");


        modal.className =
            "produto-modal";


        modal.innerHTML = `

            <div class="produto-modal-overlay"></div>

            <div class="produto-modal-content">

                <div class="produto-modal-header">

                    <h2>
                        Adicionar produto
                    </h2>

                    <button
                        type="button"
                        class="produto-modal-close"
                    >
                        ×
                    </button>

                </div>


                <form class="produto-form">

                    <div class="form-group">

                        <label>
                            Nome do produto
                        </label>

                        <input
                            type="text"
                            name="nome"
                            required
                            placeholder="Ex: Essential Tee"
                        >

                    </div>


                    <div class="form-row">

                        <div class="form-group">

                            <label>
                                SKU
                            </label>

                            <input
                                type="text"
                                name="id"
                                required
                                placeholder="Ex: NVA-TEE-006"
                            >

                        </div>


                        <div class="form-group">

                            <label>
                                Categoria
                            </label>

                            <select
                                name="categoria"
                                required
                            >

                                <option value="">
                                    Selecione
                                </option>

                                <option value="Camisetas">
                                    Camisetas
                                </option>

                                <option value="Moletons">
                                    Moletons
                                </option>

                                <option value="Calças">
                                    Calças
                                </option>

                                <option value="Acessórios">
                                    Acessórios
                                </option>

                            </select>

                        </div>

                    </div>


                    <div class="form-row">

                        <div class="form-group">

                            <label>
                                Preço
                            </label>

                            <input
                                type="number"
                                name="preco"
                                min="0"
                                step="0.01"
                                required
                                placeholder="0,00"
                            >

                        </div>


                        <div class="form-group">

                            <label>
                                Estoque
                            </label>

                            <input
                                type="number"
                                name="estoque"
                                min="0"
                                step="1"
                                required
                                placeholder="0"
                            >

                        </div>

                    </div>


                    <div class="form-group">

                        <label>
                            URL da imagem
                        </label>

                        <input
                            type="text"
                            name="imagem"
                            placeholder="Opcional"
                        >

                    </div>


                    <label class="form-checkbox">

                        <input
                            type="checkbox"
                            name="ativo"
                            checked
                        >

                        <span>
                            Produto ativo
                        </span>

                    </label>


                    <div class="produto-form-actions">

                        <button
                            type="button"
                            class="btn-cancelar"
                        >
                            Cancelar
                        </button>

                        <button
                            type="submit"
                            class="btn-salvar"
                        >
                            Salvar produto
                        </button>

                    </div>

                </form>

            </div>

        `;


        document.body.appendChild(
            modal
        );


        const fechar =
            () => modal.remove();


        modal.querySelector(
            ".produto-modal-close"
        ).addEventListener(
            "click",
            fechar
        );


        modal.querySelector(
            ".produto-modal-overlay"
        ).addEventListener(
            "click",
            fechar
        );


        modal.querySelector(
            ".btn-cancelar"
        ).addEventListener(
            "click",
            fechar
        );


        return modal;
    }


    // =========================================================
    // ABRIR MODAL
    // =========================================================

    function abrirModal(produto = null) {

        const modal =
            criarModal();


        const titulo =
            modal.querySelector(
                ".produto-modal-header h2"
            );


        const form =
            modal.querySelector(
                ".produto-form"
            );


        // =====================================================
        // EDITAR
        // =====================================================

        if (produto) {

            titulo.textContent =
                "Editar produto";


            form.elements.namedItem("nome").value =
                produto.nome || "";


            const campoId =
                form.elements.namedItem("id");

            campoId.value =
                produto.id || "";

            campoId.dataset.originalId =
                produto.id || "";


            form.elements.namedItem("categoria").value =
                produto.categoria || "";


            form.elements.namedItem("preco").value =
                produto.preco ?? "";


            form.elements.namedItem("estoque").value =
                produto.estoque ?? 0;


            form.elements.namedItem("imagem").value =
                produto.imagem || "";


            form.elements.namedItem("ativo").checked =
                produto.ativo !== false;

        }

        // =====================================================
        // NOVO PRODUTO
        // =====================================================

        else {

            titulo.textContent =
                "Adicionar produto";


            form.reset();


            const campoId =
                form.elements.namedItem("id");

            campoId.dataset.originalId =
                "";


            form.elements.namedItem("ativo").checked =
                true;
        }


        modal.style.display =
            "flex";


        setTimeout(
            () => {

                modal.classList.add(
                    "active"
                );

            },
            10
        );


        form.onsubmit =
            event => {

                event.preventDefault();


                salvarProduto(
                    form,
                    produto
                );
            };
    }


    // =========================================================
    // SALVAR PRODUTO
    // =========================================================

    function salvarProduto(
        form,
        produtoExistente
    ) {

        const nome =
            form.elements.namedItem("nome")
                .value
                .trim();


        // CORREÇÃO PRINCIPAL
        const campoId =
            form.elements.namedItem("id");


        const id =
            campoId
                .value
                .trim()
                .toUpperCase();


        const categoria =
            form.elements.namedItem("categoria")
                .value;


        const preco =
            Number(
                form.elements.namedItem("preco")
                    .value
            );


        const estoque =
            Number(
                form.elements.namedItem("estoque")
                    .value
            );


        const imagem =
            form.elements.namedItem("imagem")
                .value
                .trim();


        const ativo =
            form.elements.namedItem("ativo")
                .checked;


        // =====================================================
        // VALIDAÇÕES
        // =====================================================

        if (!nome) {

            alert(
                "Digite o nome do produto."
            );

            return;
        }


        if (!id) {

            alert(
                "Digite o SKU do produto."
            );

            return;
        }


        if (!categoria) {

            alert(
                "Selecione uma categoria."
            );

            return;
        }


        if (
            Number.isNaN(preco) ||
            preco < 0
        ) {

            alert(
                "Digite um preço válido."
            );

            return;
        }


        if (
            Number.isNaN(estoque) ||
            estoque < 0
        ) {

            alert(
                "Digite um estoque válido."
            );

            return;
        }


        // =====================================================
        // VERIFICAR SKU DUPLICADO
        // =====================================================

        const idOriginal =
            campoId.dataset.originalId || "";


        const skuDuplicado =
            produtos.some(
                produto =>
                    produto.id.toUpperCase() === id &&
                    produto.id !== idOriginal
            );


        if (skuDuplicado) {

            alert(
                "Já existe um produto com esse SKU."
            );

            return;
        }


        // =====================================================
        // EDITAR PRODUTO
        // =====================================================

        if (produtoExistente) {

            const indice =
                produtos.findIndex(
                    produto =>
                        produto.id === idOriginal
                );


            if (indice !== -1) {

                produtos[indice] = {

                    ...produtos[indice],

                    id,
                    nome,
                    categoria,
                    preco,
                    estoque,
                    imagem,
                    ativo
                };
            }

        }


        // =====================================================
        // NOVO PRODUTO
        // =====================================================

        else {

            produtos.push({

                id,
                nome,
                categoria,
                preco,
                estoque,
                imagem,
                ativo,

                criadoEm:
                    new Date().toISOString()
            });
        }


        // =====================================================
        // SALVAR
        // =====================================================

        salvarProdutos();


        produtosFiltrados =
            [...produtos];


        aplicarFiltros();


        atualizarEstatisticas();


        fecharModal();


        mostrarMensagem(
            produtoExistente
                ? "Produto atualizado com sucesso!"
                : "Produto cadastrado com sucesso!"
        );
    }


    // =========================================================
    // FECHAR MODAL
    // =========================================================

    function fecharModal() {

        const modal =
            document.querySelector(
                ".produto-modal"
            );

        if (!modal) return;


        modal.classList.remove(
            "active"
        );


        setTimeout(
            () => {

                modal.remove();

            },
            200
        );
    }


    // =========================================================
    // EXCLUIR PRODUTO
    // =========================================================

    function excluirProduto(id) {

        const produto =
            produtos.find(
                item => item.id === id
            );


        if (!produto) return;


        const confirmar =
            confirm(
                `Deseja excluir o produto "${produto.nome}"?`
            );


        if (!confirmar) return;


        produtos =
            produtos.filter(
                item => item.id !== id
            );


        salvarProdutos();


        aplicarFiltros();


        atualizarEstatisticas();


        mostrarMensagem(
            "Produto excluído com sucesso!"
        );
    }


    // =========================================================
    // ATIVAR / DESATIVAR
    // =========================================================

    function alternarProduto(id) {

        const produto =
            produtos.find(
                item => item.id === id
            );


        if (!produto) return;


        produto.ativo =
            !produto.ativo;


        salvarProdutos();


        aplicarFiltros();


        atualizarEstatisticas();


        mostrarMensagem(
            produto.ativo
                ? "Produto ativado!"
                : "Produto desativado!"
        );
    }


    // =========================================================
    // EVENTOS DA TABELA
    // =========================================================

    if (tabela) {

        tabela.addEventListener(
            "click",
            event => {

                const botao =
                    event.target.closest(
                        "button"
                    );


                if (!botao) return;


                const id =
                    botao.dataset.id;


                if (!id) return;


                // EDITAR
                if (
                    botao.classList.contains(
                        "edit-product"
                    )
                ) {

                    const produto =
                        produtos.find(
                            item =>
                                item.id === id
                        );


                    if (produto) {
                        abrirModal(produto);
                    }
                }


                // EXCLUIR
                if (
                    botao.classList.contains(
                        "delete-product"
                    )
                ) {

                    excluirProduto(id);
                }


                // ATIVAR / DESATIVAR
                if (
                    botao.classList.contains(
                        "toggle-product"
                    )
                ) {

                    alternarProduto(id);
                }

            }
        );
    }


    // =========================================================
    // BOTÃO ADICIONAR
    // =========================================================

    if (botaoAdicionar) {

        botaoAdicionar.addEventListener(
            "click",
            () => {

                abrirModal();

            }
        );
    }


    // =========================================================
    // BUSCA
    // =========================================================

    if (busca) {

        busca.addEventListener(
            "input",
            aplicarFiltros
        );
    }


    // =========================================================
    // FILTROS
    // =========================================================

    if (filtroStatus) {

        filtroStatus.addEventListener(
            "change",
            aplicarFiltros
        );
    }


    if (filtroCategoria) {

        filtroCategoria.addEventListener(
            "change",
            aplicarFiltros
        );
    }


    if (botaoFiltro) {

        botaoFiltro.addEventListener(
            "click",
            aplicarFiltros
        );
    }


    // =========================================================
    // MENSAGEM
    // =========================================================

    function mostrarMensagem(texto) {

        const existente =
            document.querySelector(
                ".nova-admin-mensagem"
            );


        if (existente) {
            existente.remove();
        }


        const mensagem =
            document.createElement(
                "div"
            );


        mensagem.className =
            "nova-admin-mensagem";


        mensagem.textContent =
            texto;


        Object.assign(
            mensagem.style,
            {
                position: "fixed",
                right: "25px",
                bottom: "25px",
                zIndex: "99999",
                padding: "14px 20px",
                background: "#1E222B",
                color: "#F5F7FA",
                border: "1px solid #8B5CF6",
                borderRadius: "8px",
                fontSize: "14px",
                boxShadow:
                    "0 10px 30px rgba(0,0,0,.35)"
            }
        );


        document.body.appendChild(
            mensagem
        );


        setTimeout(
            () => {

                mensagem.remove();

            },
            2500
        );
    }


    // =========================================================
    // SINCRONIZAÇÃO COM OUTRAS PÁGINAS
    // =========================================================

    window.addEventListener(
        "storage",
        event => {

            if (
                event.key === PRODUTOS_KEY ||
                event.key === PRODUTOS_KEY_ANTIGO
            ) {

                produtos =
                    obterProdutos();


                aplicarFiltros();


                atualizarEstatisticas();
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
                Array.isArray(event.detail)
            ) {

                produtos =
                    event.detail;


                aplicarFiltros();


                atualizarEstatisticas();
            }
        }
    );
// =====================================================
// ATUALIZAÇÃO AUTOMÁTICA DOS PEDIDOS
// =====================================================

function atualizarPedidosAutomaticamente() {

    pedidos = obterPedidos();

    paginaAtual = 1;

    atualizarEstatisticas();

    renderizarPedidos();

}


// -----------------------------------------------------
// LOCAL STORAGE — OUTRA ABA
// -----------------------------------------------------

window.addEventListener("storage", (event) => {

    if (
        event.key === "novaPedidos" ||
        event.key === "novaPedido"
    ) {

        atualizarPedidosAutomaticamente();

    }

});


// -----------------------------------------------------
// VOLTOU PARA A ABA
// -----------------------------------------------------

document.addEventListener("visibilitychange", () => {

    if (
        document.visibilityState === "visible"
    ) {

        atualizarPedidosAutomaticamente();

    }

});


// -----------------------------------------------------
// EVENTO PERSONALIZADO DA NØVA
// -----------------------------------------------------

window.addEventListener(
    "novaPedidosAtualizados",
    () => {

        atualizarPedidosAutomaticamente();

    }
);


// -----------------------------------------------------
// VERIFICAÇÃO PERIÓDICA
// -----------------------------------------------------

setInterval(() => {

    const pedidosAtuais =
        obterPedidos();

    if (
        JSON.stringify(pedidosAtuais) !==
        JSON.stringify(pedidos)
    ) {

        pedidos =
            pedidosAtuais;

        paginaAtual = 1;

        atualizarEstatisticas();

        renderizarPedidos();

    }

}, 2000);

    // =========================================================
    // INICIALIZAÇÃO
    // =========================================================

    atualizarEstatisticas();

    aplicarFiltros();

});