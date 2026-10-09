document.addEventListener("DOMContentLoaded", () => {
    "use strict";

    // =========================================================
    // CONFIGURAÇÕES
    // =========================================================
    const PRODUTOS_KEY = "novaProdutos";
    const PRODUTOS_KEY_ANTIGO = "novaProdutosAdmin";
    const ITENS_POR_PAGINA = 5;
    const BUCKET_IMAGENS = "nova-produtos";
    const MAX_TAMANHO_IMAGEM = 10 * 1024 * 1024;
    const TIPOS_IMAGEM = [
        "image/jpeg",
        "image/png",
        "image/webp",
        "image/gif"
    ];

    let produtos = [];
    let produtosFiltrados = [];
    let paginaAtual = 1;
    let carregando = false;

    const supabaseDB = window.supabaseClient;

    if (!supabaseDB) {
        console.error(
            "Supabase não foi inicializado. Confira a ordem dos scripts no HTML."
        );

        alert(
            "Não foi possível conectar ao Supabase. Confira o arquivo js/supabase.js e a conexão com a internet."
        );

        return;
    }

    // =========================================================
    // ELEMENTOS DA PÁGINA
    // =========================================================
    const tabela = document.querySelector(".produtos-table tbody");
    const busca = document.querySelector(".produto-search input");
    const filtroStatus = document.querySelector(
        ".produtos-filtros select:nth-of-type(1)"
    );
    const filtroCategoria = document.querySelector(
        ".produtos-filtros select:nth-of-type(2)"
    );
    const botaoFiltro = document.querySelector(".filter-button");
    const botaoAdicionar = document.querySelector(".btn-admin-primary");
    const paginacao = document.querySelector(".table-pagination");

    // =========================================================
    // NORMALIZAÇÃO ENTRE O BANCO E O JAVASCRIPT
    // =========================================================
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
            criadoEm:
                registro.created_at ||
                registro.criadoEm ||
                new Date().toISOString(),
            updatedAt: registro.updated_at || null
        };
    }

    function paraRegistroBanco(produto) {
        return {
            id: String(produto.id).trim().toUpperCase(),
            nome: String(produto.nome).trim(),
            categoria: produto.categoria || null,
            descricao: produto.descricao || null,
            preco: Number(produto.preco || 0),
            estoque: Number(produto.estoque || 0),
            ativo: produto.ativo !== false,
            imagem: produto.imagem || null,
            imagens: Array.isArray(produto.imagens)
                ? produto.imagens
                : [],
            updated_at: new Date().toISOString()
        };
    }

    // =========================================================
    // CARREGAR PRODUTOS DO SUPABASE
    // =========================================================
    async function carregarProdutos() {
        if (carregando) return;

        carregando = true;

        if (tabela) {
            tabela.innerHTML = `
                <tr>
                    <td colspan="6">
                        <div style="padding:32px;text-align:center;opacity:.75">
                            Carregando produtos...
                        </div>
                    </td>
                </tr>
            `;
        }

        const { data, error } = await supabaseDB
            .from("produtos_nova")
            .select("*")
            .order("created_at", { ascending: false });

        carregando = false;

        if (error) {
            console.error(
                "Erro ao carregar produtos do Supabase:",
                error
            );

            if (tabela) {
                tabela.innerHTML = `
                    <tr>
                        <td colspan="6">
                            <div style="padding:32px;text-align:center">
                                Não foi possível carregar os produtos.
                                <br>
                                <small>
                                    Confira as políticas RLS da tabela produtos_nova.
                                </small>
                                <br>
                                <button
                                    type="button"
                                    class="tentar-carregar-produtos"
                                >
                                    Tentar novamente
                                </button>
                            </div>
                        </td>
                    </tr>
                `;
            }

            mostrarMensagem(
                "Erro ao carregar produtos. Confira o console e as políticas RLS."
            );

            return;
        }

        produtos = (data || []).map(normalizarProduto);

        try {
            localStorage.setItem(
                PRODUTOS_KEY,
                JSON.stringify(produtos)
            );
        } catch (erroLocal) {
            console.warn(
                "Não foi possível atualizar o cache local:",
                erroLocal
            );
        }

        aplicarFiltros();
        atualizarEstatisticas();
    }

    // =========================================================
    // UTILITÁRIOS
    // =========================================================
    function formatarPreco(valor) {
        return Number(valor || 0).toLocaleString("pt-BR", {
            style: "currency",
            currency: "BRL"
        });
    }

    function escaparHTML(texto) {
        return String(texto ?? "")
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
    }

    function obterClasseEstoque(estoque) {
        estoque = Number(estoque);

        if (estoque <= 0) return "out";
        if (estoque <= 10) return "low";

        return "";
    }

    function obterTextoEstoque(estoque) {
        estoque = Number(estoque);

        return estoque <= 0
            ? "Sem estoque"
            : `${estoque} unidades`;
    }

    function mostrarMensagem(texto) {
        const existente = document.querySelector(
            ".nova-admin-mensagem"
        );

        if (existente) existente.remove();

        const mensagem = document.createElement("div");
        mensagem.className = "nova-admin-mensagem";
        mensagem.textContent = texto;

        Object.assign(mensagem.style, {
            position: "fixed",
            right: "25px",
            bottom: "25px",
            zIndex: "99999",
            maxWidth: "min(420px, calc(100vw - 32px))",
            padding: "14px 20px",
            background: "#1E222B",
            color: "#F5F7FA",
            border: "1px solid #8B5CF6",
            borderRadius: "8px",
            fontSize: "14px",
            boxShadow: "0 10px 30px rgba(0,0,0,.35)"
        });

        document.body.appendChild(mensagem);

        window.setTimeout(() => mensagem.remove(), 3500);
    }

    function atualizarEstatisticas() {
        const valores = [
            produtos.length,
            produtos.filter(p => p.ativo).length,
            produtos.filter(
                p => Number(p.estoque) > 0 &&
                     Number(p.estoque) <= 10
            ).length,
            produtos.filter(
                p => Number(p.estoque) <= 0
            ).length
        ];

        document.querySelectorAll(".produto-stat").forEach(
            (card, index) => {
                const valor = card.querySelector("strong");

                if (valor) {
                    valor.textContent = valores[index] ?? 0;
                }
            }
        );
    }

    // O restante do código continua na Parte 2.
        // =========================================================
    // UPLOAD DE IMAGENS PARA O SUPABASE STORAGE
    // =========================================================
    async function enviarImagemStorage(arquivo, produtoId) {
        if (!arquivo) return null;

        if (!TIPOS_IMAGEM.includes(arquivo.type)) {
            throw new Error(
                `Formato não permitido: ${arquivo.name}`
            );
        }

        if (arquivo.size > MAX_TAMANHO_IMAGEM) {
            throw new Error(
                `A imagem "${arquivo.name}" ultrapassa o limite de 10 MB.`
            );
        }

        const extensao = arquivo.name
            .split(".")
            .pop()
            .toLowerCase()
            .replace(/[^a-z0-9]/g, "");

        const nomeSeguro = `${Date.now()}-${Math.random()
            .toString(36)
            .slice(2, 10)}.${extensao}`;

        const pasta = String(produtoId)
            .trim()
            .toUpperCase()
            .replace(/[^A-Z0-9_-]/g, "");

        const caminho = `${pasta}/${nomeSeguro}`;

        const { error: erroUpload } = await supabaseDB
            .storage
            .from(BUCKET_IMAGENS)
            .upload(caminho, arquivo, {
                cacheControl: "3600",
                upsert: false,
                contentType: arquivo.type
            });

        if (erroUpload) {
            console.error("Erro ao enviar imagem:", erroUpload);
            throw erroUpload;
        }

        const { data } = supabaseDB
            .storage
            .from(BUCKET_IMAGENS)
            .getPublicUrl(caminho);

        return data.publicUrl;
    }

    // =========================================================
    // PROCESSAR IMAGENS SELECIONADAS
    // =========================================================
    async function processarImagens(
        arquivos,
        produtoId,
        imagensExistentes = []
    ) {
        const imagens = [...imagensExistentes];

        for (const arquivo of Array.from(arquivos || [])) {
            const url = await enviarImagemStorage(
                arquivo,
                produtoId
            );

            if (url) {
                imagens.push(url);
            }
        }

        return imagens;
    }

    // =========================================================
    // SALVAR PRODUTO NO SUPABASE
    // =========================================================
    async function salvarProdutoBanco(produto) {
        const registro = paraRegistroBanco(produto);

        const { data, error } = await supabaseDB
            .from("produtos_nova")
            .upsert(registro, {
                onConflict: "id"
            })
            .select()
            .single();

        if (error) {
            console.error(
                "Erro ao salvar produto:",
                error
            );

            throw error;
        }

        return normalizarProduto(data);
    }

    // =========================================================
    // EXCLUIR PRODUTO DO SUPABASE
    // =========================================================
    async function excluirProdutoBanco(produtoId) {
        const { error } = await supabaseDB
            .from("produtos_nova")
            .delete()
            .eq("id", produtoId);

        if (error) {
            console.error(
                "Erro ao excluir produto:",
                error
            );

            throw error;
        }
    }

    // =========================================================
    // ALTERAR STATUS DO PRODUTO
    // =========================================================
    async function alterarStatusBanco(produtoId, ativo) {
        const { data, error } = await supabaseDB
            .from("produtos_nova")
            .update({
                ativo: Boolean(ativo),
                updated_at: new Date().toISOString()
            })
            .eq("id", produtoId)
            .select()
            .single();

        if (error) {
            console.error(
                "Erro ao alterar status:",
                error
            );

            throw error;
        }

        return normalizarProduto(data);
    }

    // =========================================================
    // FILTROS E PESQUISA
    // =========================================================
    function aplicarFiltros() {
        const termo = busca
            ? busca.value.trim().toLowerCase()
            : "";

        const status = filtroStatus
            ? filtroStatus.value.toLowerCase()
            : "";

        const categoria = filtroCategoria
            ? filtroCategoria.value.toLowerCase()
            : "";

        produtosFiltrados = produtos.filter(produto => {
            const correspondeBusca =
                !termo ||
                produto.nome.toLowerCase().includes(termo) ||
                produto.id.toLowerCase().includes(termo) ||
                produto.categoria.toLowerCase().includes(termo);

            let correspondeStatus = true;

            if (
                status &&
                status !== "todos" &&
                status !== "all"
            ) {
                if (
                    status.includes("ativo") &&
                    !status.includes("inativo")
                ) {
                    correspondeStatus = produto.ativo;
                } else if (status.includes("inativo")) {
                    correspondeStatus = !produto.ativo;
                } else if (
                    status.includes("estoque") ||
                    status.includes("baixo")
                ) {
                    correspondeStatus =
                        Number(produto.estoque) > 0 &&
                        Number(produto.estoque) <= 10;
                } else if (
                    status.includes("esgotado") ||
                    status.includes("sem estoque")
                ) {
                    correspondeStatus =
                        Number(produto.estoque) <= 0;
                }
            }

            const correspondeCategoria =
                !categoria ||
                categoria === "todos" ||
                categoria === "all" ||
                produto.categoria.toLowerCase() === categoria;

            return (
                correspondeBusca &&
                correspondeStatus &&
                correspondeCategoria
            );
        });

        paginaAtual = 1;
        renderizarProdutos();
        atualizarPaginacao();
    }

    // =========================================================
    // RENDERIZAR A TABELA
    // =========================================================
    function renderizarProdutos() {
        if (!tabela) return;

        const inicio = (paginaAtual - 1) * ITENS_POR_PAGINA;
        const lista = produtosFiltrados.slice(
            inicio,
            inicio + ITENS_POR_PAGINA
        );

        if (lista.length === 0) {
            tabela.innerHTML = `
                <tr>
                    <td colspan="6">
                        <div style="padding:30px;text-align:center">
                            Nenhum produto encontrado.
                        </div>
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
                        style="width:48px;height:48px;object-fit:cover;border-radius:6px"
                        onerror="this.style.display='none'"
                    >
                `
                : `
                    <div style="width:48px;height:48px;display:flex;align-items:center;justify-content:center;background:#252936;border-radius:6px">
                        <span>Sem foto</span>
                    </div>
                `;

            return `
                <tr data-produto-id="${escaparHTML(produto.id)}">
                    <td>
                        <div style="display:flex;align-items:center;gap:12px">
                            ${imagem}
                            <div>
                                <strong>${escaparHTML(produto.nome)}</strong>
                                <small style="display:block;opacity:.65">
                                    ${escaparHTML(produto.id)}
                                </small>
                            </div>
                        </div>
                    </td>

                    <td>
                        ${escaparHTML(produto.categoria || "Sem categoria")}
                    </td>

                    <td>
                        <strong>${formatarPreco(produto.preco)}</strong>
                    </td>

                    <td>
                        <span class="${obterClasseEstoque(produto.estoque)}">
                            ${obterTextoEstoque(produto.estoque)}
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
                                title="Editar produto"
                            >
                                Editar
                            </button>

                            <button
                                type="button"
                                class="alternar-produto"
                                data-id="${escaparHTML(produto.id)}"
                                title="Alterar status"
                            >
                                ${produto.ativo ? "Desativar" : "Ativar"}
                            </button>

                            <button
                                type="button"
                                class="excluir-produto"
                                data-id="${escaparHTML(produto.id)}"
                                title="Excluir produto"
                            >
                                Excluir
                            </button>
                        </div>
                    </td>
                </tr>
            `;
        }).join("");
    }

    // =========================================================
    // PAGINAÇÃO
    // =========================================================
    function atualizarPaginacao() {
        if (!paginacao) return;

        const totalPaginas = Math.max(
            1,
            Math.ceil(
                produtosFiltrados.length / ITENS_POR_PAGINA
            )
        );

        if (paginaAtual > totalPaginas) {
            paginaAtual = totalPaginas;
        }

        paginacao.innerHTML = `
            <button
                type="button"
                class="pagina-anterior"
                ${paginaAtual <= 1 ? "disabled" : ""}
            >
                Anterior
            </button>

            <span>
                Página ${paginaAtual} de ${totalPaginas}
            </span>

            <button
                type="button"
                class="pagina-proxima"
                ${paginaAtual >= totalPaginas ? "disabled" : ""}
            >
                Próxima
            </button>
        `;
    }

    // A Parte 3 continua com o formulário de cadastro e edição.
    
    // =========================================================
    // MODAL DE CADASTRO E EDIÇÃO
    // =========================================================

    function criarModal() {
        if (document.querySelector("#modal-produto-nova")) return;

        const modal = document.createElement("div");
        modal.id = "modal-produto-nova";

        Object.assign(modal.style, {
            position: "fixed",
            inset: "0",
            zIndex: "99990",
            display: "none",
            alignItems: "center",
            justifyContent: "center",
            padding: "20px",
            background: "rgba(0, 0, 0, 0.75)",
            overflowY: "auto"
        });

        modal.innerHTML = `
            <div style="
                width:100%;
                max-width:650px;
                max-height:90vh;
                overflow-y:auto;
                padding:25px;
                border-radius:14px;
                background:#1E222B;
                color:#F5F7FA;
                border:1px solid #343946;
                box-sizing:border-box;
            ">
                <div style="
                    display:flex;
                    justify-content:space-between;
                    align-items:center;
                    gap:15px;
                    margin-bottom:22px;
                ">
                    <h2 id="titulo-modal-produto" style="margin:0;font-size:21px">
                        Novo produto
                    </h2>

                    <button type="button" id="fechar-modal-produto"
                        aria-label="Fechar formulário"
                        style="background:none;border:none;color:#F5F7FA;font-size:27px;cursor:pointer">
                        &times;
                    </button>
                </div>

                <form id="form-produto-nova">
                    <input type="hidden" id="produto-id-original">

                    <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px">
                        <label style="display:flex;flex-direction:column;gap:7px">
                            Nome do produto *
                            <input id="produto-nome" required maxlength="150"
                                placeholder="Ex.: Camiseta Oversized"
                                style="padding:12px;border-radius:7px;border:1px solid #414653;background:#0F1117;color:white">
                        </label>

                        <label style="display:flex;flex-direction:column;gap:7px">
                            Código/SKU *
                            <input id="produto-sku" required maxlength="50"
                                placeholder="Ex.: NOVA-001"
                                style="padding:12px;border-radius:7px;border:1px solid #414653;background:#0F1117;color:white">
                        </label>

                        <label style="display:flex;flex-direction:column;gap:7px">
                            Categoria *
                            <input id="produto-categoria" required maxlength="80"
                                list="categorias-produtos-nova"
                                placeholder="Ex.: Camisetas"
                                style="padding:12px;border-radius:7px;border:1px solid #414653;background:#0F1117;color:white">
                            <datalist id="categorias-produtos-nova">
                                <option value="Camisetas">
                                <option value="Calças">
                                <option value="Moletons">
                                <option value="Jaquetas">
                                <option value="Acessórios">
                            </datalist>
                        </label>

                        <label style="display:flex;flex-direction:column;gap:7px">
                            Preço (R$) *
                            <input id="produto-preco" type="number" required min="0" step="0.01"
                                placeholder="0,00"
                                style="padding:12px;border-radius:7px;border:1px solid #414653;background:#0F1117;color:white">
                        </label>

                        <label style="display:flex;flex-direction:column;gap:7px">
                            Quantidade em estoque *
                            <input id="produto-estoque" type="number" required min="0" step="1"
                                placeholder="0"
                                style="padding:12px;border-radius:7px;border:1px solid #414653;background:#0F1117;color:white">
                        </label>

                        <label style="display:flex;flex-direction:column;gap:7px">
                            Status
                            <select id="produto-ativo"
                                style="padding:12px;border-radius:7px;border:1px solid #414653;background:#0F1117;color:white">
                                <option value="true">Ativo</option>
                                <option value="false">Inativo</option>
                            </select>
                        </label>
                    </div>

                    <label style="display:flex;flex-direction:column;gap:7px;margin-top:17px">
                        Descrição
                        <textarea id="produto-descricao" rows="4" maxlength="2000"
                            placeholder="Descreva os detalhes do produto..."
                            style="padding:12px;border-radius:7px;border:1px solid #414653;background:#0F1117;color:white;resize:vertical"></textarea>
                    </label>

                    <label style="display:flex;flex-direction:column;gap:7px;margin-top:17px">
                        Imagens do produto
                        <input id="produto-imagens-arquivos" type="file"
                            accept="image/jpeg,image/png,image/webp,image/gif" multiple
                            style="padding:12px;border-radius:7px;border:1px solid #414653;background:#0F1117;color:white">
                        <small style="opacity:.75">
                            Selecione imagens do celular ou computador. Máximo de 10 MB por arquivo.
                            As imagens serão enviadas ao Supabase Storage.
                        </small>
                    </label>

                    <div id="produto-imagens-existentes"
                        style="display:flex;flex-wrap:wrap;gap:10px;margin-top:12px">
                    </div>

                    <label style="display:flex;align-items:center;gap:9px;margin-top:17px">
                        <input id="produto-remover-imagens" type="checkbox">
                        Remover as imagens atuais ao salvar
                    </label>

                    <div style="display:flex;justify-content:flex-end;gap:12px;margin-top:25px;flex-wrap:wrap">
                        <button type="button" id="cancelar-modal-produto"
                            style="padding:12px 18px;border-radius:7px;border:1px solid #414653;background:transparent;color:white;cursor:pointer">
                            Cancelar
                        </button>

                        <button type="submit" id="salvar-produto-botao"
                            style="padding:12px 20px;border-radius:7px;border:none;background:#8B5CF6;color:white;font-weight:600;cursor:pointer">
                            Salvar produto
                        </button>
                    </div>
                </form>
            </div>
        `;

        document.body.appendChild(modal);

        modal.addEventListener("click", evento => {
            if (evento.target === modal) fecharModal();
        });

        document.querySelector("#fechar-modal-produto")
            .addEventListener("click", fecharModal);

        document.querySelector("#cancelar-modal-produto")
            .addEventListener("click", fecharModal);

        document.querySelector("#form-produto-nova")
            .addEventListener("submit", salvarProduto);

        document.querySelector("#produto-remover-imagens")
            .addEventListener("change", evento => {
                if (evento.target.checked) {
                    const area = document.querySelector("#produto-imagens-existentes");
                    if (area) area.innerHTML = "";
                } else {
                    const id = document.querySelector("#produto-id-original").value;
                    const produto = produtos.find(item => item.id === id);
                    mostrarImagensExistentes(produto?.imagens || []);
                }
            });
    }

    // =========================================================
    // EXIBIR IMAGENS JÁ CADASTRADAS
    // =========================================================

    function mostrarImagensExistentes(imagens = []) {
        const area = document.querySelector("#produto-imagens-existentes");
        if (!area) return;

        area.innerHTML = "";

        imagens.forEach(url => {
            const imagem = document.createElement("img");
            imagem.src = url;
            imagem.alt = "Imagem cadastrada do produto";

            Object.assign(imagem.style, {
                width: "75px",
                height: "85px",
                objectFit: "cover",
                borderRadius: "7px",
                border: "1px solid #414653"
            });

            area.appendChild(imagem);
        });
    }

    // =========================================================
    // ABRIR MODAL PARA CADASTRAR OU EDITAR
    // =========================================================

    function abrirModal(produto = null) {
        criarModal();

        const modal = document.querySelector("#modal-produto-nova");
        const formulario = document.querySelector("#form-produto-nova");

        formulario.reset();

        document.querySelector("#produto-id-original").value = produto?.id || "";
        document.querySelector("#titulo-modal-produto").textContent =
            produto ? "Editar produto" : "Novo produto";

        document.querySelector("#produto-sku").value = produto?.id || "";
        document.querySelector("#produto-sku").readOnly = Boolean(produto);

        document.querySelector("#produto-nome").value = produto?.nome || "";
        document.querySelector("#produto-categoria").value = produto?.categoria || "";
        document.querySelector("#produto-preco").value = produto?.preco ?? "";
        document.querySelector("#produto-estoque").value = produto?.estoque ?? "";
        document.querySelector("#produto-descricao").value = produto?.descricao || "";
        document.querySelector("#produto-ativo").value =
            produto?.ativo === false ? "false" : "true";

        document.querySelector("#produto-remover-imagens").checked = false;

        mostrarImagensExistentes(produto?.imagens || (produto?.imagem ? [produto.imagem] : []));

        document.querySelector("#salvar-produto-botao").disabled = false;
        document.querySelector("#salvar-produto-botao").textContent = "Salvar produto";

        modal.style.display = "flex";
        document.body.style.overflow = "hidden";

        document.querySelector("#produto-nome").focus();
    }

    function fecharModal() {
        const modal = document.querySelector("#modal-produto-nova");
        if (modal) modal.style.display = "none";

        document.body.style.overflow = "";
    }

    // =========================================================
    // SALVAR PRODUTO NO SUPABASE
    // =========================================================

    async function salvarProduto(evento) {
        evento.preventDefault();

        const botaoSalvar = document.querySelector("#salvar-produto-botao");
        if (botaoSalvar.disabled) return;

        const idOriginal = document.querySelector("#produto-id-original").value.trim();
        const id = document.querySelector("#produto-sku").value.trim().toUpperCase();
        const nome = document.querySelector("#produto-nome").value.trim();
        const categoria = document.querySelector("#produto-categoria").value.trim();
        const descricao = document.querySelector("#produto-descricao").value.trim();
        const preco = Number(document.querySelector("#produto-preco").value);
        const estoque = Number(document.querySelector("#produto-estoque").value);
        const ativo = document.querySelector("#produto-ativo").value === "true";
        const arquivos = Array.from(document.querySelector("#produto-imagens-arquivos").files);
        const removerImagens = document.querySelector("#produto-remover-imagens").checked;

        if (!id || !nome || !categoria) {
            mostrarMensagem("Preencha o código, nome e categoria.");
            return;
        }

        if (!Number.isFinite(preco) || preco < 0) {
            mostrarMensagem("Informe um preço válido.");
            return;
        }

        if (!Number.isInteger(estoque) || estoque < 0) {
            mostrarMensagem("O estoque precisa ser um número inteiro igual ou maior que zero.");
            return;
        }

        for (const arquivo of arquivos) {
            if (!TIPOS_IMAGEM.includes(arquivo.type)) {
                mostrarMensagem(`Formato não permitido: ${arquivo.name}`);
                return;
            }

            if (arquivo.size > MAX_TAMANHO_IMAGEM) {
                mostrarMensagem(`A imagem ${arquivo.name} ultrapassa 10 MB.`);
                return;
            }
        }

        const idFinal = idOriginal || id;

        if (!idOriginal && produtos.some(produto => produto.id.toUpperCase() === idFinal)) {
            mostrarMensagem("Já existe um produto com esse código/SKU.");
            return;
        }

        const produtoExistente = produtos.find(produto => produto.id === idFinal);
        let imagens = removerImagens ? [] : [...(produtoExistente?.imagens || [])];

        if (!imagens.length && !removerImagens && produtoExistente?.imagem) {
            imagens = [produtoExistente.imagem];
        }

        botaoSalvar.disabled = true;
        botaoSalvar.textContent = "Salvando...";

        try {
            if (arquivos.length) {
                imagens = await processarImagens(arquivos, idFinal, imagens);
            }

            const produto = {
                id: idFinal,
                nome,
                categoria,
                descricao,
                preco,
                estoque,
                ativo,
                imagens,
                imagem: imagens[0] || ""
            };

            const salvo = await salvarProdutoBanco(produto);

            produtos = [
                salvo,
                ...produtos.filter(item => item.id !== salvo.id)
            ];

            try {
                localStorage.setItem(PRODUTOS_KEY, JSON.stringify(produtos));
            } catch (erroLocal) {
                console.warn("Cache local indisponível:", erroLocal);
            }

            aplicarFiltros();
            atualizarEstatisticas();
            fecharModal();

            mostrarMensagem(idOriginal
                ? "Produto atualizado com sucesso!"
                : "Produto cadastrado com sucesso!");
        } catch (erro) {
            console.error("Erro ao salvar produto:", erro);
            mostrarMensagem(erro.message || "Não foi possível salvar o produto.");
        } finally {
            botaoSalvar.disabled = false;
            botaoSalvar.textContent = "Salvar produto";
        }
    }

    // =========================================================
    // EXCLUIR, ATIVAR E DESATIVAR PRODUTOS
    // =========================================================

    async function excluirProduto(produtoId) {
        const produto = produtos.find(item => item.id === produtoId);
        if (!produto) return;

        const confirmar = window.confirm(
            `Deseja realmente excluir "${produto.nome}"? Essa ação não poderá ser desfeita.`
        );

        if (!confirmar) return;

        try {
            await excluirProdutoBanco(produtoId);

            produtos = produtos.filter(item => item.id !== produtoId);

            try {
                localStorage.setItem(PRODUTOS_KEY, JSON.stringify(produtos));
            } catch (erroLocal) {
                console.warn("Cache local indisponível:", erroLocal);
            }

            aplicarFiltros();
            atualizarEstatisticas();
            mostrarMensagem("Produto excluído com sucesso.");
        } catch (erro) {
            console.error("Erro ao excluir produto:", erro);
            mostrarMensagem(erro.message || "Não foi possível excluir o produto.");
        }
    }

    async function alternarProduto(produtoId) {
        const produto = produtos.find(item => item.id === produtoId);
        if (!produto) return;

        const novoStatus = !produto.ativo;

        try {
            await alterarStatusBanco(produtoId, novoStatus);

            produtos = produtos.map(item =>
                item.id === produtoId
                    ? { ...item, ativo: novoStatus }
                    : item
            );

            try {
                localStorage.setItem(PRODUTOS_KEY, JSON.stringify(produtos));
            } catch (erroLocal) {
                console.warn("Cache local indisponível:", erroLocal);
            }

            aplicarFiltros();
            atualizarEstatisticas();

            mostrarMensagem(
                novoStatus
                    ? "Produto ativado com sucesso."
                    : "Produto desativado com sucesso."
            );
        } catch (erro) {
            console.error("Erro ao alterar status:", erro);
            mostrarMensagem(erro.message || "Não foi possível alterar o status.");
        }
    }
    
    // =========================================================
    // CONECTAR OS BOTÕES DA TABELA
    // =========================================================

    document.addEventListener("click", async evento => {
        const botaoEditar = evento.target.closest(".editar-produto");
        const botaoAlternar = evento.target.closest(".alternar-produto");
        const botaoExcluir = evento.target.closest(".excluir-produto");
        const botaoTentar = evento.target.closest(".tentar-carregar-produtos");

        if (botaoEditar) {
            const id = botaoEditar.dataset.id;
            const produto = produtos.find(item => item.id === id);

            if (produto) abrirModal(produto);
            return;
        }

        if (botaoAlternar) {
            const id = botaoAlternar.dataset.id;
            await alternarProduto(id);
            return;
        }

        if (botaoExcluir) {
            const id = botaoExcluir.dataset.id;
            await excluirProduto(id);
            return;
        }

        if (botaoTentar) {
            await carregarProdutos();
            return;
        }

        const paginaBotao = evento.target.closest("[data-pagina]");
        if (paginaBotao) {
            const pagina = Number(paginaBotao.dataset.pagina);

            if (Number.isInteger(pagina) && pagina >= 1) {
                paginaAtual = pagina;
                renderizarProdutos();
                atualizarPaginacao();
            }
        }
    });

    // =========================================================
    // BOTÃO ADICIONAR PRODUTO
    // =========================================================

    if (botaoAdicionar) {
        botaoAdicionar.addEventListener("click", evento => {
            evento.preventDefault();
            abrirModal();
        });
    }

    // =========================================================
    // BUSCA E FILTROS
    // =========================================================

    if (busca) {
        busca.addEventListener("input", () => {
            aplicarFiltros();
        });
    }

    if (filtroStatus) {
        filtroStatus.addEventListener("change", aplicarFiltros);
    }

    if (filtroCategoria) {
        filtroCategoria.addEventListener("change", aplicarFiltros);
    }

    if (botaoFiltro) {
        botaoFiltro.addEventListener("click", evento => {
            evento.preventDefault();
            aplicarFiltros();
            mostrarMensagem("Filtros atualizados.");
        });
    }

    // =========================================================
    // ATUALIZAR A LISTA QUANDO A ABA VOLTAR A FICAR VISÍVEL
    // =========================================================

    document.addEventListener("visibilitychange", () => {
        if (!document.hidden) {
            carregarProdutos();
        }
    });

    // =========================================================
    // INICIALIZAÇÃO
    // =========================================================

    criarModal();
    carregarProdutos();

});