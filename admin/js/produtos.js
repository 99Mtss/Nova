document.addEventListener("DOMContentLoaded", () => {
    "use strict";

    // =========================================
    // CONFIGURAÇÕES
    // =========================================

    const TABELA_PRODUTOS = "produtos_nova";
    const BUCKET_IMAGENS = "nova-produtos";
    const ITENS_POR_PAGINA = 5;
    const TAMANHO_MAXIMO = 10 * 1024 * 1024;

    const TIPOS_IMAGEM = [
        "image/jpeg",
        "image/png",
        "image/webp",
        "image/gif"
    ];

    const supabaseDB = window.supabaseClient;

    let produtos = [];
    let produtosFiltrados = [];
    let paginaAtual = 1;
    let carregando = false;

    // =========================================
    // ELEMENTOS DO HTML
    // =========================================

    const tabela = document.querySelector("#products-table-body");
    const busca = document.querySelector("#product-search");
    const filtroStatus = document.querySelector("#product-status-filter");
    const filtroCategoria = document.querySelector("#product-category-filter");
    const ordenacao = document.querySelector("#product-sort");

    const botaoAdicionar = document.querySelector("#add-product-button");
    const botaoLimparFiltros = document.querySelector("#product-clear-filters");

    const totalResultados = document.querySelector("#products-results-count");
    const estadoVazio = document.querySelector("#products-empty");

    const informacaoPaginacao =
        document.querySelector("#products-pagination-info");

    const botoesPaginacao =
        document.querySelector("#products-pagination-buttons");

    const botaoAnterior = document.querySelector("#products-prev-page");
    const textoPagina = document.querySelector("#products-current-page");
    const botaoProxima = document.querySelector("#products-next-page");

    // =========================================
    // VERIFICAR CONEXÃO
    // =========================================

    if (!supabaseDB) {
        console.error("Cliente Supabase não encontrado.");

        if (tabela) {
            tabela.innerHTML = `
                <tr>
                    <td colspan="6">
                        Não foi possível inicializar o Supabase.
                        Confira os scripts do HTML.
                    </td>
                </tr>
            `;
        }

        return;
    }

    // =========================================
    // UTILITÁRIOS
    // =========================================

    function formatarPreco(valor) {
        return Number(valor || 0).toLocaleString("pt-BR", {
            style: "currency",
            currency: "BRL"
        });
    }

    function escaparHTML(valor) {
        return String(valor ?? "")
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
    }

    function normalizarProduto(registro) {
        return {
            id: String(registro.id ?? ""),
            nome: String(registro.nome ?? ""),
            categoria: String(registro.categoria ?? ""),
            descricao: String(registro.descricao ?? ""),
            preco: Number(registro.preco ?? 0),
            estoque: Number(registro.estoque ?? 0),
            ativo: registro.ativo !== false,
            imagem: String(registro.imagem ?? ""),
            imagens: Array.isArray(registro.imagens)
                ? registro.imagens
                : [],
            criadoEm: registro.created_at || null
        };
    }

    function mostrarMensagem(texto) {
        let mensagem = document.querySelector(".nova-admin-mensagem");

        if (mensagem) {
            mensagem.remove();
        }

        mensagem = document.createElement("div");
        mensagem.className = "nova-admin-mensagem";
        mensagem.textContent = texto;

        Object.assign(mensagem.style, {
            position: "fixed",
            right: "20px",
            bottom: "20px",
            zIndex: "99999",
            maxWidth: "calc(100vw - 40px)",
            padding: "14px 20px",
            color: "#F5F7FA",
            background: "#1E222B",
            border: "1px solid #8B5CF6",
            borderRadius: "8px",
            boxShadow: "0 8px 25px rgba(0,0,0,.3)"
        });

        document.body.appendChild(mensagem);

        setTimeout(() => mensagem.remove(), 3500);
    }

    function classeEstoque(estoque) {
        if (Number(estoque) <= 0) return "out";
        if (Number(estoque) <= 10) return "low";
        return "";
    }

    function textoEstoque(estoque) {
        return Number(estoque) <= 0
            ? "Sem estoque"
            : `${estoque} unidades`;
    }

    // =========================================
    // ESTATÍSTICAS
    // =========================================

    function atualizarEstatisticas() {
        const estatisticas = {
            "products-total": produtos.length,

            "products-active": produtos.filter(
                produto => produto.ativo
            ).length,

            "products-low-stock": produtos.filter(
                produto =>
                    Number(produto.estoque) > 0 &&
                    Number(produto.estoque) <= 10
            ).length,

            "products-out-of-stock": produtos.filter(
                produto => Number(produto.estoque) <= 0
            ).length
        };

        Object.entries(estatisticas).forEach(([id, valor]) => {
            const elemento = document.getElementById(id);

            if (elemento) {
                elemento.textContent = valor;
            }
        });
    }

    // =========================================
    // CARREGAR PRODUTOS
    // =========================================

    async function carregarProdutos() {
        if (carregando) return;

        carregando = true;

        if (tabela) {
            tabela.innerHTML = `
                <tr>
                    <td colspan="6">Carregando produtos...</td>
                </tr>
            `;
        }

        try {
            const { data, error } = await supabaseDB
                .from(TABELA_PRODUTOS)
                .select("*")
                .order("created_at", { ascending: false });

            if (error) throw error;

            produtos = (data || []).map(normalizarProduto);

            aplicarFiltros();
            atualizarEstatisticas();

            try {
                localStorage.setItem(
                    "novaProdutos",
                    JSON.stringify(produtos)
                );
            } catch (erro) {
                console.warn("Não foi possível atualizar o cache local.", erro);
            }
        } catch (erro) {
            console.error("Erro ao carregar produtos:", erro);

            if (tabela) {
                tabela.innerHTML = `
                    <tr>
                        <td colspan="6">
                            Não foi possível carregar os produtos.
                            <button
                                type="button"
                                id="products-retry"
                            >
                                Tentar novamente
                            </button>
                        </td>
                    </tr>
                `;
            }

            mostrarMensagem("Erro ao carregar produtos.");
        } finally {
            carregando = false;
        }
    }

    // =========================================
    // FILTROS E ORDENAÇÃO
    // =========================================

    function aplicarFiltros() {
        const termo = busca?.value.trim().toLowerCase() || "";
        const status = filtroStatus?.value.toLowerCase() || "";
        const categoria = filtroCategoria?.value.toLowerCase() || "";

        produtosFiltrados = produtos.filter(produto => {
            const correspondeBusca =
                produto.nome.toLowerCase().includes(termo) ||
                produto.id.toLowerCase().includes(termo) ||
                produto.categoria.toLowerCase().includes(termo);

            let correspondeStatus = true;

            if (status && !["todos", "all"].includes(status)) {
                if (status.includes("inativo")) {
                    correspondeStatus = !produto.ativo;
                } else if (status.includes("ativo")) {
                    correspondeStatus = produto.ativo;
                } else if (
                    status.includes("esgotado") ||
                    status.includes("sem estoque")
                ) {
                    correspondeStatus = Number(produto.estoque) <= 0;
                } else if (
                    status.includes("baixo") ||
                    status.includes("estoque")
                ) {
                    correspondeStatus =
                        Number(produto.estoque) > 0 &&
                        Number(produto.estoque) <= 10;
                }
            }

            const correspondeCategoria =
                !categoria ||
                ["todos", "all"].includes(categoria) ||
                produto.categoria.toLowerCase() === categoria;

            return (
                correspondeBusca &&
                correspondeStatus &&
                correspondeCategoria
            );
        });

        const ordem = ordenacao?.value || "";

        if (ordem === "price-asc" || ordem === "preco-menor") {
            produtosFiltrados.sort((a, b) => a.preco - b.preco);
        }

        if (ordem === "price-desc" || ordem === "preco-maior") {
            produtosFiltrados.sort((a, b) => b.preco - a.preco);
        }

        if (ordem === "name-asc" || ordem === "nome") {
            produtosFiltrados.sort((a, b) =>
                a.nome.localeCompare(b.nome, "pt-BR")
            );
        }

        paginaAtual = 1;

        renderizarProdutos();
        atualizarPaginacao();
    }

    // =========================================
    // RENDERIZAR TABELA
    // =========================================

    function renderizarProdutos() {
        if (!tabela) return;

        const inicio = (paginaAtual - 1) * ITENS_POR_PAGINA;

        const lista = produtosFiltrados.slice(
            inicio,
            inicio + ITENS_POR_PAGINA
        );

        if (totalResultados) {
            totalResultados.textContent =
                `${produtosFiltrados.length} produto(s)`;
        }

        if (estadoVazio) {
            estadoVazio.hidden = produtosFiltrados.length !== 0;
        }

        if (lista.length === 0) {
            tabela.innerHTML = `
                <tr>
                    <td colspan="6">
                        Nenhum produto encontrado.
                    </td>
                </tr>
            `;
            return;
        }

        tabela.innerHTML = lista.map(produto => {
            const imagem = produto.imagem
                ? `
                    <img
                        src="${escaparHTML(produto.imagem)}"
                        alt="${escaparHTML(produto.nome)}"
                        width="48"
                        height="48"
                        style="object-fit:cover;border-radius:6px"
                    >
                `
                : `
                    <div class="produto-sem-imagem">
                        Sem foto
                    </div>
                `;

            return `
                <tr data-produto-id="${escaparHTML(produto.id)}">
                    <td>
                        <div class="produto-tabela-identidade">
                            ${imagem}
                            <div>
                                <strong>${escaparHTML(produto.nome)}</strong>
                                <small>${escaparHTML(produto.id)}</small>
                            </div>
                        </div>
                    </td>

                    <td>${escaparHTML(produto.categoria || "Sem categoria")}</td>

                    <td>${formatarPreco(produto.preco)}</td>

                    <td>
                        <span class="${classeEstoque(produto.estoque)}">
                            ${textoEstoque(produto.estoque)}
                        </span>
                    </td>

                    <td>
                        <span class="status-badge ${
                            produto.ativo ? "active" : "inactive"
                        }">
                            ${produto.ativo ? "Ativo" : "Inativo"}
                        </span>
                    </td>

                    <td>
                        <div class="produto-acoes">
                            <button
                                type="button"
                                class="editar-produto"
                                data-id="${escaparHTML(produto.id)}"
                            >
                                Editar
                            </button>

                            <button
                                type="button"
                                class="alternar-produto"
                                data-id="${escaparHTML(produto.id)}"
                            >
                                ${produto.ativo ? "Desativar" : "Ativar"}
                            </button>

                            <button
                                type="button"
                                class="excluir-produto"
                                data-id="${escaparHTML(produto.id)}"
                            >
                                Excluir
                            </button>
                        </div>
                    </td>
                </tr>
            `;
        }).join("");
    }

    // =========================================
    // PAGINAÇÃO
    // =========================================

    function atualizarPaginacao() {
        const totalPaginas = Math.max(
            1,
            Math.ceil(produtosFiltrados.length / ITENS_POR_PAGINA)
        );

        if (paginaAtual > totalPaginas) {
            paginaAtual = totalPaginas;
        }

        if (informacaoPaginacao) {
            informacaoPaginacao.textContent =
                `${produtosFiltrados.length} produto(s) encontrados`;
        }

        if (textoPagina) {
            textoPagina.textContent =
                `${paginaAtual} / ${totalPaginas}`;
        }

        if (botaoAnterior) {
            botaoAnterior.disabled = paginaAtual <= 1;
        }

        if (botaoProxima) {
            botaoProxima.disabled = paginaAtual >= totalPaginas;
        }

        if (botoesPaginacao) {
            botoesPaginacao.innerHTML = `
                <button
                    type="button"
                    data-pagina="${Math.max(1, paginaAtual - 1)}"
                    ${paginaAtual <= 1 ? "disabled" : ""}
                >
                    Anterior
                </button>

                <span>Página ${paginaAtual} de ${totalPaginas}</span>

                <button
                    type="button"
                    data-pagina="${Math.min(totalPaginas, paginaAtual + 1)}"
                    ${paginaAtual >= totalPaginas ? "disabled" : ""}
                >
                    Próxima
                </button>
            `;
        }
    }

    // =========================================
    // UPLOAD DE IMAGENS
    // =========================================

    async function enviarImagem(arquivo, produtoId) {
        if (!TIPOS_IMAGEM.includes(arquivo.type)) {
            throw new Error(`Formato de imagem inválido: ${arquivo.name}`);
        }

        if (arquivo.size > TAMANHO_MAXIMO) {
            throw new Error(`A imagem ${arquivo.name} ultrapassa 10 MB.`);
        }

        const extensao = arquivo.name.split(".").pop().toLowerCase();
        const pasta = produtoId.replace(/[^a-zA-Z0-9_-]/g, "");
        const nomeArquivo =
            `${Date.now()}-${Math.random().toString(36).slice(2)}.${extensao}`;

        const caminho = `${pasta}/${nomeArquivo}`;

        const { error } = await supabaseDB.storage
            .from(BUCKET_IMAGENS)
            .upload(caminho, arquivo, {
                cacheControl: "3600",
                upsert: false,
                contentType: arquivo.type
            });

        if (error) throw error;

        const { data } = supabaseDB.storage
            .from(BUCKET_IMAGENS)
            .getPublicUrl(caminho);

        return data.publicUrl;
    }

    // =========================================
    // MODAL DO PRODUTO
    // =========================================

    function criarModal() {
        if (document.querySelector("#modal-produto-nova")) return;

        const modal = document.createElement("div");
        modal.id = "modal-produto-nova";

        modal.innerHTML = `
            <div class="modal-produto-conteudo">
                <div class="modal-produto-cabecalho">
                    <h2 id="titulo-modal-produto">Novo produto</h2>
                    <button type="button" id="fechar-modal-produto">
                        &times;
                    </button>
                </div>

                <form id="form-produto-nova">
                    <input type="hidden" id="produto-id-original">

                    <label>
                        Nome do produto *
                        <input id="produto-nome" required maxlength="150">
                    </label>

                    <label>
                        Código/SKU *
                        <input id="produto-sku" required maxlength="50">
                    </label>

                    <label>
                        Categoria *
                        <input id="produto-categoria" required maxlength="80">
                    </label>

                    <label>
                        Preço (R$) *
                        <input id="produto-preco" type="number"
                            min="0" step="0.01" required>
                    </label>

                    <label>
                        Estoque *
                        <input id="produto-estoque" type="number"
                            min="0" step="1" required>
                    </label>

                    <label>
                        Status
                        <select id="produto-ativo">
                            <option value="true">Ativo</option>
                            <option value="false">Inativo</option>
                        </select>
                    </label>

                    <label>
                        Descrição
                        <textarea id="produto-descricao" rows="4"></textarea>
                    </label>

                    <label>
                        Imagens
                        <input id="produto-imagens-arquivos" type="file"
                            accept="image/jpeg,image/png,image/webp,image/gif"
                            multiple>
                    </label>

                    <div id="produto-imagens-existentes"></div>

                    <label>
                        <input id="produto-remover-imagens" type="checkbox">
                        Remover imagens atuais
                    </label>

                    <div class="modal-produto-acoes">
                        <button type="button" id="cancelar-modal-produto">
                            Cancelar
                        </button>

                        <button type="submit" id="salvar-produto-botao">
                            Salvar produto
                        </button>
                    </div>
                </form>
            </div>
        `;

        Object.assign(modal.style, {
            position: "fixed",
            inset: "0",
            zIndex: "99990",
            display: "none",
            alignItems: "center",
            justifyContent: "center",
            padding: "20px",
            overflowY: "auto",
            background: "rgba(0,0,0,.8)"
        });

        const conteudo = modal.querySelector(".modal-produto-conteudo");

        Object.assign(conteudo.style, {
            width: "100%",
            maxWidth: "650px",
            maxHeight: "90vh",
            overflowY: "auto",
            padding: "24px",
            borderRadius: "12px",
            background: "#1E222B",
            color: "#F5F7FA",
            boxSizing: "border-box"
        });

        modal.querySelector("form").style.display = "grid";
        modal.querySelector("form").style.gap = "14px";

        modal.querySelectorAll("label").forEach(label => {
            label.style.display = "grid";
            label.style.gap = "7px";
        });

        modal.querySelectorAll("input:not([type=checkbox]), textarea, select")
            .forEach(campo => {
                Object.assign(campo.style, {
                    padding: "11px",
                    borderRadius: "6px",
                    border: "1px solid #414653",
                    background: "#0F1117",
                    color: "#F5F7FA",
                    maxWidth: "100%",
                    boxSizing: "border-box"
                });
            });

        document.body.appendChild(modal);

        modal.addEventListener("click", evento => {
            if (evento.target === modal) fecharModal();
        });

        modal.querySelector("#fechar-modal-produto")
            .addEventListener("click", fecharModal);

        modal.querySelector("#cancelar-modal-produto")
            .addEventListener("click", fecharModal);

        modal.querySelector("#form-produto-nova")
            .addEventListener("submit", salvarProduto);
    }

    function mostrarImagens(imagens) {
        const area = document.querySelector("#produto-imagens-existentes");
        if (!area) return;

        area.innerHTML = "";

        imagens.forEach(url => {
            const imagem = document.createElement("img");
            imagem.src = url;
            imagem.alt = "Imagem do produto";

            Object.assign(imagem.style, {
                width: "75px",
                height: "85px",
                objectFit: "cover",
                borderRadius: "6px"
            });

            area.appendChild(imagem);
        });
    }

    function abrirModal(produto = null) {
        criarModal();

        const modal = document.querySelector("#modal-produto-nova");
        const formulario = document.querySelector("#form-produto-nova");

        formulario.reset();

        document.querySelector("#produto-id-original").value =
            produto?.id || "";

        document.querySelector("#titulo-modal-produto").textContent =
            produto ? "Editar produto" : "Novo produto";

        document.querySelector("#produto-sku").value = produto?.id || "";
        document.querySelector("#produto-sku").readOnly = Boolean(produto);

        document.querySelector("#produto-nome").value = produto?.nome || "";
        document.querySelector("#produto-categoria").value =
            produto?.categoria || "";

        document.querySelector("#produto-preco").value =
            produto?.preco ?? "";

        document.querySelector("#produto-estoque").value =
            produto?.estoque ?? "";

        document.querySelector("#produto-descricao").value =
            produto?.descricao || "";

        document.querySelector("#produto-ativo").value =
            produto?.ativo === false ? "false" : "true";

        document.querySelector("#produto-remover-imagens").checked = false;

        mostrarImagens(
            produto?.imagens?.length
                ? produto.imagens
                : produto?.imagem
                    ? [produto.imagem]
                    : []
        );

        modal.style.display = "flex";
        document.body.style.overflow = "hidden";
    }

    function fecharModal() {
        const modal = document.querySelector("#modal-produto-nova");

        if (modal) {
            modal.style.display = "none";
        }

        document.body.style.overflow = "";
    }

    // =========================================
    // SALVAR PRODUTO
    // =========================================

    async function salvarProduto(evento) {
        evento.preventDefault();

        const botao = document.querySelector("#salvar-produto-botao");

        if (botao.disabled) return;

        const idOriginal =
            document.querySelector("#produto-id-original").value.trim();

        const id =
            document.querySelector("#produto-sku").value.trim().toUpperCase();

        const nome =
            document.querySelector("#produto-nome").value.trim();

        const categoria =
            document.querySelector("#produto-categoria").value.trim();

        const descricao =
            document.querySelector("#produto-descricao").value.trim();

        const preco =
            Number(document.querySelector("#produto-preco").value);

        const estoque =
            Number(document.querySelector("#produto-estoque").value);

        const ativo =
            document.querySelector("#produto-ativo").value === "true";

        const arquivos = Array.from(
            document.querySelector("#produto-imagens-arquivos").files
        );

        const removerImagens =
            document.querySelector("#produto-remover-imagens").checked;

        if (!id || !nome || !categoria) {
            mostrarMensagem("Preencha o código, nome e categoria.");
            return;
        }

        if (!Number.isFinite(preco) || preco < 0) {
            mostrarMensagem("Informe um preço válido.");
            return;
        }

        if (!Number.isInteger(estoque) || estoque < 0) {
            mostrarMensagem("Informe um estoque inteiro válido.");
            return;
        }

        if (
            !idOriginal &&
            produtos.some(produto => produto.id.toUpperCase() === id)
        ) {
            mostrarMensagem("Já existe um produto com esse código.");
            return;
        }

        const existente = produtos.find(
            produto => produto.id === (idOriginal || id)
        );

        let imagens = removerImagens
            ? []
            : [...(existente?.imagens || [])];

        if (!imagens.length && !removerImagens && existente?.imagem) {
            imagens = [existente.imagem];
        }

        botao.disabled = true;
        botao.textContent = "Salvando...";

        try {
            for (const arquivo of arquivos) {
                const url = await enviarImagem(arquivo, idOriginal || id);
                imagens.push(url);
            }

            const registro = {
                id: idOriginal || id,
                nome,
                categoria,
                descricao: descricao || null,
                preco,
                estoque,
                ativo,
                imagem: imagens[0] || null,
                imagens,
                updated_at: new Date().toISOString()
            };

            const { data, error } = await supabaseDB
                .from(TABELA_PRODUTOS)
                .upsert(registro, { onConflict: "id" })
                .select()
                .single();

            if (error) throw error;

            const salvo = normalizarProduto(data);

            produtos = [
                salvo,
                ...produtos.filter(item => item.id !== salvo.id)
            ];

            try {
                localStorage.setItem(
                    "novaProdutos",
                    JSON.stringify(produtos)
                );
            } catch (erro) {
                console.warn("Não foi possível atualizar o cache.", erro);
            }

            aplicarFiltros();
            atualizarEstatisticas();
            fecharModal();

            mostrarMensagem(
                idOriginal
                    ? "Produto atualizado com sucesso!"
                    : "Produto cadastrado com sucesso!"
            );
        } catch (erro) {
            console.error("Erro ao salvar produto:", erro);
            mostrarMensagem(erro.message || "Não foi possível salvar o produto.");
        } finally {
            botao.disabled = false;
            botao.textContent = "Salvar produto";
        }
    }

    // =========================================
    // EXCLUIR PRODUTO
    // =========================================

    async function excluirProduto(id) {
        const produto = produtos.find(item => item.id === id);
        if (!produto) return;

        if (!confirm(`Deseja excluir "${produto.nome}"?`)) return;

        try {
            const { error } = await supabaseDB
                .from(TABELA_PRODUTOS)
                .delete()
                .eq("id", id);

            if (error) throw error;

            produtos = produtos.filter(item => item.id !== id);

            aplicarFiltros();
            atualizarEstatisticas();

            mostrarMensagem("Produto excluído com sucesso.");
        } catch (erro) {
            console.error("Erro ao excluir produto:", erro);
            mostrarMensagem(erro.message || "Não foi possível excluir o produto.");
        }
    }

    // =========================================
    // ATIVAR / DESATIVAR
    // =========================================

    async function alternarProduto(id) {
        const produto = produtos.find(item => item.id === id);
        if (!produto) return;

        const novoStatus = !produto.ativo;

        try {
            const { data, error } = await supabaseDB
                .from(TABELA_PRODUTOS)
                .update({
                    ativo: novoStatus,
                    updated_at: new Date().toISOString()
                })
                .eq("id", id)
                .select()
                .single();

            if (error) throw error;

            const atualizado = normalizarProduto(data);

            produtos = produtos.map(item =>
                item.id === id ? atualizado : item
            );

            aplicarFiltros();
            atualizarEstatisticas();

            mostrarMensagem(
                novoStatus
                    ? "Produto ativado."
                    : "Produto desativado."
            );
        } catch (erro) {
            console.error("Erro ao alterar status:", erro);
            mostrarMensagem(erro.message || "Não foi possível alterar o status.");
        }
    }

    // =========================================
    // EVENTOS DA TABELA E DOS FILTROS
    // =========================================

    document.addEventListener("click", async evento => {
        const editar = evento.target.closest(".editar-produto");
        const excluir = evento.target.closest(".excluir-produto");
        const alternar = evento.target.closest(".alternar-produto");
        const tentar = evento.target.closest("#products-retry");
        const pagina = evento.target.closest("[data-pagina]");

        if (editar) {
            const produto = produtos.find(
                item => item.id === editar.dataset.id
            );

            if (produto) abrirModal(produto);
            return;
        }

        if (excluir) {
            await excluirProduto(excluir.dataset.id);
            return;
        }

        if (alternar) {
            await alternarProduto(alternar.dataset.id);
            return;
        }

        if (tentar) {
            await carregarProdutos();
            return;
        }

        if (pagina && !pagina.disabled) {
            const numero = Number(pagina.dataset.pagina);

            if (Number.isInteger(numero) && numero >= 1) {
                paginaAtual = numero;
                renderizarProdutos();
                atualizarPaginacao();
            }
        }
    });

    if (botaoAdicionar) {
        botaoAdicionar.addEventListener("click", evento => {
            evento.preventDefault();
            abrirModal();
        });
    }

    [busca, filtroStatus, filtroCategoria, ordenacao].forEach(elemento => {
        if (!elemento) return;

        elemento.addEventListener(
            elemento === busca ? "input" : "change",
            aplicarFiltros
        );
    });

    if (botaoLimparFiltros) {
        botaoLimparFiltros.addEventListener("click", evento => {
            evento.preventDefault();

            if (busca) busca.value = "";
            if (filtroStatus) filtroStatus.selectedIndex = 0;
            if (filtroCategoria) filtroCategoria.selectedIndex = 0;
            if (ordenacao) ordenacao.selectedIndex = 0;

            aplicarFiltros();
        });
    }

    if (botaoAnterior) {
        botaoAnterior.addEventListener("click", () => {
            if (paginaAtual > 1) {
                paginaAtual--;
                renderizarProdutos();
                atualizarPaginacao();
            }
        });
    }

    if (botaoProxima) {
        botaoProxima.addEventListener("click", () => {
            const totalPaginas = Math.max(
                1,
                Math.ceil(produtosFiltrados.length / ITENS_POR_PAGINA)
            );

            if (paginaAtual < totalPaginas) {
                paginaAtual++;
                renderizarProdutos();
                atualizarPaginacao();
            }
        });
    }

    // Atualiza a lista ao voltar para a aba.
    document.addEventListener("visibilitychange", () => {
        if (!document.hidden) {
            carregarProdutos();
        }
    });

    // =========================================
    // INICIALIZAÇÃO
    // =========================================

    criarModal();
    carregarProdutos();
});