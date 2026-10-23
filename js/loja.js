
/* =========================================================
   NØVA — LOJA
   Supabase, configurações, produtos, filtros e favoritos
   ========================================================= */

document.addEventListener("DOMContentLoaded", iniciarLoja);

const NOVA_LOJA = {
    chaveCarrinho: "novaCarrinho",
    tabelaProdutos: "produtos_nova",
    tabelaConfiguracoes: "configuracoes_nova",
    produtosPorPagina: 12
};

let produtos = [];
let configuracoes = {};
let produtosFiltrados = [];
let paginaAtual = 1;
let categoriasAtivas = [];
let tamanhosAtivos = [];
let favoritos = new Set();
let carregamentoEmAndamento = false;

/* =========================================================
   ELEMENTOS
   ========================================================= */

const elementos = {};

function obterElementos() {
    elementos.busca = document.querySelector(".shop-search input");
    elementos.limparBusca = document.querySelector("#clear-search");

    elementos.abasCategoria =
        [...document.querySelectorAll(".category-tab")];

    elementos.checkboxesCategoria =
        [...document.querySelectorAll(".filter-option input")];

    elementos.botoesTamanho =
        [...document.querySelectorAll(".size-options button")];

    elementos.precos =
        [...document.querySelectorAll(".price-inputs input")];

    elementos.limparFiltros =
        document.querySelector(".clear-filters");

    elementos.aplicarFiltros =
        document.querySelector("#apply-filters");

    elementos.ordenacao =
        document.querySelector(".sort-products");

    elementos.contadorProdutos =
        document.querySelector(".products-count");

    elementos.contadorCarrinho =
        document.querySelector(".cart-count");

    elementos.grade =
        document.querySelector("#shop-products-list") ||
        document.querySelector(".shop-grid");

    elementos.erro =
        document.querySelector("#products-error");

    elementos.tituloVazio =
        document.querySelector("#products-empty");

    elementos.paginacao =
        document.querySelector("#shop-pagination");

    elementos.infoPagina =
        document.querySelector("#pagination-info");

    elementos.paginaAnterior =
        document.querySelector("#previous-page");

    elementos.proximaPagina =
        document.querySelector("#next-page");

    elementos.tentarNovamente =
        document.querySelector("#retry-products");

    elementos.limparBuscaEFiltros =
        document.querySelector("#reset-search-filters");
}

/* =========================================================
   UTILITÁRIOS
   ========================================================= */

function converterPreco(valor) {
    if (typeof valor === "number") {
        return Number.isFinite(valor) ? valor : 0;
    }

    if (valor === null || valor === undefined || valor === "") {
        return 0;
    }

    let texto = String(valor)
        .trim()
        .replace(/[^\d,.-]/g, "");

    if (texto.includes(",")) {
        texto = texto.replace(/\./g, "").replace(",", ".");
    }

    const resultado = Number(texto);

    return Number.isFinite(resultado) ? resultado : 0;
}

function formatarPreco(valor) {
    return converterPreco(valor).toLocaleString("pt-BR", {
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
        "'": "&#039;"
    })[caractere]);
}

function validarCor(cor) {
    return typeof cor === "string" &&
        /^#[0-9a-fA-F]{3}(?:[0-9a-fA-F]{3})?$/.test(cor);
}

function validarImagem(url) {
    if (!url || typeof url !== "string") {
        return "";
    }

    try {
        const endereco = new URL(url, window.location.href);

        if (
            endereco.protocol === "https:" ||
            endereco.protocol === "http:"
        ) {
            return endereco.href;
        }
    } catch (erro) {
        return "";
    }

    return "";
}

function obterImagem(produto) {
    const imagemPrincipal = validarImagem(produto.imagem);

    if (imagemPrincipal) {
        return imagemPrincipal;
    }

    if (Array.isArray(produto.imagens)) {
        for (const imagem of produto.imagens) {
            const url = typeof imagem === "string"
                ? imagem
                : imagem?.url || imagem?.imagem;

            const valida = validarImagem(url);

            if (valida) return valida;
        }
    }

    return "";
}

function obterCategoria(texto) {
    return String(texto || "")
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .trim()
        .toLowerCase()
        .replace(/s$/, "");
}

function mostrarMensagem(texto) {
    const anterior = document.querySelector(".nova-mensagem");

    if (anterior) anterior.remove();

    const mensagem = document.createElement("div");

    mensagem.className = "nova-mensagem";
    mensagem.textContent = texto;
    mensagem.setAttribute("role", "status");

    Object.assign(mensagem.style, {
        position: "fixed",
        bottom: "24px",
        right: "24px",
        zIndex: "99999",
        maxWidth: "calc(100% - 48px)",
        padding: "14px 20px",
        color: "#F5F5F5",
        background: "#151519",
        border: "1px solid #8B5CF6",
        borderRadius: "8px",
        boxShadow: "0 8px 24px rgba(0,0,0,.3)"
    });

    document.body.appendChild(mensagem);

    setTimeout(() => mensagem.remove(), 2500);
}

/* =========================================================
   SUPABASE
   ========================================================= */

function obterSupabase() {
    const cliente = window.supabaseClient;

    if (!cliente || typeof cliente.from !== "function") {
        throw new Error(
            "Supabase indisponível. Verifique os scripts da página."
        );
    }

    return cliente;
}

async function carregarProdutosSupabase() {
    const supabase = obterSupabase();

    const { data, error } = await supabase
        .from(NOVA_LOJA.tabelaProdutos)
        .select("*")
        .eq("ativo", true)
        .gt("estoque", 0)
        .order("created_at", { ascending: false });

    if (error) {
        console.error("Erro ao carregar produtos:", error);
        throw new Error("Não foi possível consultar os produtos.");
    }

    return Array.isArray(data) ? data : [];
}

async function carregarConfiguracoesSupabase() {
    const supabase = obterSupabase();

    const { data, error } = await supabase
        .from(NOVA_LOJA.tabelaConfiguracoes)
        .select("configuracoes")
        .eq("id", "loja")
        .maybeSingle();

    if (error) {
        console.error("Erro ao carregar configurações:", error);
        throw new Error("Não foi possível carregar as configurações.");
    }

    return data?.configuracoes &&
        typeof data.configuracoes === "object"
        ? data.configuracoes
        : {};
}

/* =========================================================
   APLICAR CORES DO PAINEL ADM
   ========================================================= */

function aplicarCores() {
    const cores = configuracoes.cores || {};
    const raiz = document.documentElement;

    const variaveis = {
        "Fundo": "--nova-cor-fundo",
        "Superfície": "--nova-cor-superficie",
        "Destaque": "--nova-cor-destaque",
        "Texto": "--nova-cor-texto"
    };

    Object.entries(variaveis).forEach(([nome, variavel]) => {
        if (validarCor(cores[nome])) {
            raiz.style.setProperty(variavel, cores[nome]);
        }
    });

    if (validarCor(cores["Fundo"])) {
        document.body.style.backgroundColor = cores["Fundo"];
    }

    if (validarCor(cores["Texto"])) {
        document.body.style.color = cores["Texto"];
    }

    if (validarCor(cores["Superfície"])) {
        document.querySelectorAll(
            ".header, .footer, .filters, .shop-product-card"
        ).forEach(elemento => {
            elemento.style.backgroundColor = cores["Superfície"];
        });
    }
}

/* =========================================================
   PROMOÇÕES
   Estrutura esperada:
   promocoes: [{ id: "ID_PRODUTO", preco: 79.90 }]
   ========================================================= */

function obterPromocao(produto) {
    const promocoes = Array.isArray(configuracoes.promocoes)
        ? configuracoes.promocoes
        : [];

    return promocoes.find(promocao =>
        String(promocao.id) === String(produto.id)
    );
}

function obterPrecoAtual(produto) {
    const precoOriginal = converterPreco(produto.preco);
    const promocao = obterPromocao(produto);

    if (!promocao) return precoOriginal;

    const precoPromocional = converterPreco(promocao.preco);

    if (
        precoPromocional > 0 &&
        precoPromocional < precoOriginal
    ) {
        return precoPromocional;
    }

    return precoOriginal;
}

/* =========================================================
   CRIAR CARD DO PRODUTO
   ========================================================= */

function criarCardProduto(produto) {
    const card = document.createElement("article");

    card.className = "shop-product-card";
    card.dataset.id = produto.id;
    card.dataset.categoria = produto.categoria || "";

    const nome = escaparHTML(produto.nome || "Produto NØVA");
    const categoria = escaparHTML(produto.categoria || "Produto");
    const imagem = obterImagem(produto);
    const precoOriginal = converterPreco(produto.preco);
    const precoAtual = obterPrecoAtual(produto);
    const emPromocao = precoAtual < precoOriginal;

    const imagemHTML = imagem
        ? `
            <img
                src="${escaparHTML(imagem)}"
                alt="${nome}"
                loading="lazy"
            >
        `
        : `
            <div class="product-placeholder">
                <span>NØVA</span>
            </div>
        `;

    const promocaoHTML = emPromocao
        ? `<span class="nova-etiqueta-promocao">PROMOÇÃO</span>`
        : "";

    const precoAntigoHTML = emPromocao
        ? `
            <span class="nova-preco-antigo">
                ${formatarPreco(precoOriginal)}
            </span>
        `
        : "";

    card.innerHTML = `
        <div class="shop-product-image">
            ${promocaoHTML}
            ${imagemHTML}

            <button
                type="button"
                class="favorite-button"
                aria-label="Adicionar aos favoritos"
                aria-pressed="false"
            >
                <i class="fa-regular fa-heart"></i>
            </button>
        </div>

        <div class="shop-product-info">
            <span class="product-category">${categoria}</span>

            <h3>${nome}</h3>

            <div class="product-price">
                <span>${formatarPreco(precoAtual)}</span>
                ${precoAntigoHTML}
            </div>
        </div>
    `;

    const botaoFavorito = card.querySelector(".favorite-button");

    botaoFavorito.addEventListener("click", evento => {
        evento.preventDefault();
        evento.stopPropagation();

        alternarFavorito(produto.id, botaoFavorito);
    });

    card.addEventListener("click", evento => {
        if (evento.target.closest(".favorite-button")) return;

        abrirProduto(produto);
    });

    return card;
}

/* =========================================================
   ABRIR DETALHES DO PRODUTO
   ========================================================= */

function abrirProduto(produto) {
    const url = new URL("produto.html", window.location.href);
    url.searchParams.set("id", produto.id);
    window.location.href = url.href;
}

/* =========================================================
   FAVORITOS
   ========================================================= */

function alternarFavorito(id, botao) {
    const chave = String(id);
    const icone = botao.querySelector("i");

    if (favoritos.has(chave)) {
        favoritos.delete(chave);
        botao.classList.remove("active");
        botao.setAttribute("aria-pressed", "false");

        if (icone) {
            icone.classList.remove("fa-solid");
            icone.classList.add("fa-regular");
        }
    } else {
        favoritos.add(chave);
        botao.classList.add("active");
        botao.setAttribute("aria-pressed", "true");

        if (icone) {
            icone.classList.remove("fa-regular");
            icone.classList.add("fa-solid");
        }
    }
}

/* =========================================================
   CONTADOR DO CARRINHO
   ========================================================= */

function atualizarContadorCarrinho() {
    if (!elementos.contadorCarrinho) return;

    try {
        const carrinho = JSON.parse(
            localStorage.getItem(NOVA_LOJA.chaveCarrinho) || "[]"
        );

        const quantidade = Array.isArray(carrinho)
            ? carrinho.reduce(
                (total, item) => total + Number(item.quantidade || 0),
                0
            )
            : 0;

        elementos.contadorCarrinho.textContent = quantidade;
    } catch (erro) {
        console.error("Erro ao atualizar o carrinho:", erro);
        elementos.contadorCarrinho.textContent = "0";
        mostrarMensagem(
            "Não foi possível ler o carrinho salvo neste navegador."
        );
    }
}

/* =========================================================
   FILTROS
   ========================================================= */

function obterCategoriasSelecionadas() {
    const categoriasCheckbox = elementos.checkboxesCategoria
        .filter(checkbox => checkbox.checked)
        .map(checkbox =>
            checkbox.value ||
            checkbox.nextElementSibling?.textContent?.trim() ||
            ""
        );

    const categoriasAbas = elementos.abasCategoria
        .filter(aba => aba.classList.contains("active"))
        .map(aba => aba.dataset.category || aba.textContent.trim())
        .filter(categoria =>
            categoria && obterCategoria(categoria) !== "todo"
        );

    return [
        ...new Set(
            [...categoriasCheckbox, ...categoriasAbas]
                .map(obterCategoria)
                .filter(Boolean)
        )
    ];
}

function obterTamanhosSelecionados() {
    return elementos.botoesTamanho
        .filter(botao => botao.classList.contains("active"))
        .map(botao =>
            botao.dataset.filterSize ||
            botao.textContent.trim()
        );
}

function produtoTemTamanho(produto, tamanhos) {
    if (!tamanhos.length) return true;

    const tamanhosProduto = produto.tamanhos ||
        produto.tamanhos_disponiveis ||
        produto.tamanhosDisponiveis ||
        [];

    if (!Array.isArray(tamanhosProduto)) {
        return true;
    }

    return tamanhos.some(tamanho =>
        tamanhosProduto.map(String).includes(String(tamanho))
    );
}

function filtrarProdutos() {
    let resultado = [...produtos];

    const busca = elementos.busca?.value
        .trim()
        .toLocaleLowerCase("pt-BR") || "";

    const categorias = obterCategoriasSelecionadas();
    const tamanhos = obterTamanhosSelecionados();

    const precoMinimo = Math.max(
        0,
        converterPreco(elementos.precos[0]?.value)
    );

    const valorMaximo = converterPreco(elementos.precos[1]?.value);
    const precoMaximo = valorMaximo > 0 ? valorMaximo : Infinity;

    if (busca) {
        resultado = resultado.filter(produto => {
            const nome = String(produto.nome || "")
                .toLocaleLowerCase("pt-BR");

            const categoria = String(produto.categoria || "")
                .toLocaleLowerCase("pt-BR");

            const descricao = String(produto.descricao || "")
                .toLocaleLowerCase("pt-BR");

            return nome.includes(busca) ||
                categoria.includes(busca) ||
                descricao.includes(busca);
        });
    }

    if (categorias.length) {
        resultado = resultado.filter(produto =>
            categorias.includes(obterCategoria(produto.categoria))
        );
    }

    if (tamanhos.length) {
        resultado = resultado.filter(produto =>
            produtoTemTamanho(produto, tamanhos)
        );
    }

    resultado = resultado.filter(produto => {
        const preco = obterPrecoAtual(produto);

        return preco >= precoMinimo && preco <= precoMaximo;
    });

    const ordenacao = elementos.ordenacao?.value || "relevancia";

    switch (ordenacao) {
        case "preco-menor":
        case "Menor preço":
            resultado.sort(
                (a, b) => obterPrecoAtual(a) - obterPrecoAtual(b)
            );
            break;

        case "preco-maior":
        case "Maior preço":
            resultado.sort(
                (a, b) => obterPrecoAtual(b) - obterPrecoAtual(a)
            );
            break;

        case "recentes":
            resultado.sort((a, b) =>
                new Date(b.created_at || 0) -
                new Date(a.created_at || 0)
            );
            break;

        default:
            resultado.sort((a, b) =>
                new Date(b.created_at || 0) -
                new Date(a.created_at || 0)
            );
    }

    produtosFiltrados = resultado;
    paginaAtual = 1;

    renderizarPagina();
}

/* =========================================================
   RENDERIZAÇÃO E PAGINAÇÃO
   ========================================================= */

function renderizarPagina() {
    if (!elementos.grade) return;

    const total = produtosFiltrados.length;
    const totalPaginas = Math.max(
        1,
        Math.ceil(total / NOVA_LOJA.produtosPorPagina)
    );

    if (paginaAtual > totalPaginas) {
        paginaAtual = totalPaginas;
    }

    const inicio = (paginaAtual - 1) * NOVA_LOJA.produtosPorPagina;
    const paginaProdutos = produtosFiltrados.slice(
        inicio,
        inicio + NOVA_LOJA.produtosPorPagina
    );

    elementos.grade.innerHTML = "";
    elementos.grade.setAttribute("aria-busy", "false");

    paginaProdutos.forEach(produto => {
        elementos.grade.appendChild(criarCardProduto(produto));
    });

    if (elementos.contadorProdutos) {
        elementos.contadorProdutos.textContent =
            total === 1 ? "1 produto" : `${total} produtos`;
    }

    const semProdutos = total === 0;

    if (elementos.tituloVazio) {
        elementos.tituloVazio.hidden = !semProdutos;
    }

    if (elementos.paginacao) {
        elementos.paginacao.hidden = semProdutos || totalPaginas <= 1;
    }

    if (elementos.infoPagina) {
        elementos.infoPagina.textContent =
            `Página ${paginaAtual} de ${totalPaginas}`;
    }

    if (elementos.paginaAnterior) {
        elementos.paginaAnterior.disabled = paginaAtual <= 1;
    }

    if (elementos.proximaPagina) {
        elementos.proximaPagina.disabled =
            paginaAtual >= totalPaginas;
    }
}

function mudarPagina(direcao) {
    const totalPaginas = Math.max(
        1,
        Math.ceil(
            produtosFiltrados.length / NOVA_LOJA.produtosPorPagina
        )
    );

    paginaAtual = Math.min(
        totalPaginas,
        Math.max(1, paginaAtual + direcao)
    );

    renderizarPagina();

    elementos.grade?.scrollIntoView({
        behavior: "smooth",
        block: "start"
    });
}

/* =========================================================
   LIMPAR FILTROS
   ========================================================= */

function limparFiltros() {
    if (elementos.busca) elementos.busca.value = "";

    elementos.checkboxesCategoria.forEach(checkbox => {
        checkbox.checked = false;
    });

    elementos.botoesTamanho.forEach(botao => {
        botao.classList.remove("active");
        botao.setAttribute("aria-pressed", "false");
    });

    elementos.precos.forEach(input => {
        input.value = "";
    });

    elementos.abasCategoria.forEach(aba => {
        const categoria = obterCategoria(
            aba.dataset.category || aba.textContent
        );

        const selecionada = categoria === "todo";

        aba.classList.toggle("active", selecionada);
        aba.setAttribute("aria-pressed", String(selecionada));
    });

    if (elementos.ordenacao) {
        elementos.ordenacao.value = "relevancia";
    }

    filtrarProdutos();
}

/* =========================================================
   EVENTOS DOS FILTROS
   ========================================================= */

function inicializarFiltros() {
    elementos.busca?.addEventListener("input", filtrarProdutos);

    elementos.limparBusca?.addEventListener("click", () => {
        if (elementos.busca) elementos.busca.value = "";

        filtrarProdutos();
        elementos.busca?.focus();
    });

    elementos.abasCategoria.forEach(aba => {
        aba.addEventListener("click", () => {
            elementos.abasCategoria.forEach(item => {
                item.classList.remove("active");
                item.setAttribute("aria-pressed", "false");
            });

            aba.classList.add("active");
            aba.setAttribute("aria-pressed", "true");

            const categoria = obterCategoria(
                aba.dataset.category || aba.textContent
            );

            elementos.checkboxesCategoria.forEach(checkbox => {
                const valor = checkbox.value ||
                    checkbox.nextElementSibling?.textContent || "";

                checkbox.checked = categoria !== "todo" &&
                    obterCategoria(valor) === categoria;
            });

            filtrarProdutos();
        });
    });

    elementos.checkboxesCategoria.forEach(checkbox => {
        checkbox.addEventListener("change", () => {
            elementos.abasCategoria.forEach(aba => {
                aba.classList.remove("active");
                aba.setAttribute("aria-pressed", "false");
            });

            filtrarProdutos();
        });
    });

    elementos.botoesTamanho.forEach(botao => {
        botao.addEventListener("click", () => {
            botao.classList.toggle("active");

            botao.setAttribute(
                "aria-pressed",
                String(botao.classList.contains("active"))
            );

            filtrarProdutos();
        });
    });

    elementos.precos.forEach(input => {
        input.addEventListener("input", filtrarProdutos);
    });

    elementos.ordenacao?.addEventListener("change", filtrarProdutos);

    elementos.aplicarFiltros?.addEventListener("click", filtrarProdutos);

    elementos.limparFiltros?.addEventListener("click", limparFiltros);

    elementos.limparBuscaEFiltros?.addEventListener(
        "click",
        limparFiltros
    );

    elementos.paginaAnterior?.addEventListener(
        "click",
        () => mudarPagina(-1)
    );

    elementos.proximaPagina?.addEventListener(
        "click",
        () => mudarPagina(1)
    );

    elementos.tentarNovamente?.addEventListener(
        "click",
        carregarLoja
    );
}

/* =========================================================
   ESTADOS DE CARREGAMENTO E ERRO
   ========================================================= */

function mostrarCarregamento() {
    if (elementos.erro) elementos.erro.hidden = true;
    if (elementos.tituloVazio) elementos.tituloVazio.hidden = true;

    if (elementos.grade) {
        elementos.grade.setAttribute("aria-busy", "true");

        elementos.grade.innerHTML = `
            <div class="products-loading" role="status">
                <i class="fa-solid fa-spinner fa-spin"
                   aria-hidden="true"></i>
                <p>Carregando produtos...</p>
            </div>
        `;
    }

    if (elementos.contadorProdutos) {
        elementos.contadorProdutos.textContent = "Carregando produtos...";
    }
}

function mostrarErro() {
    if (elementos.erro) {
        elementos.erro.hidden = false;
    } else if (elementos.grade) {
        elementos.grade.innerHTML = `
            <div class="products-error-message" role="alert">
                <p>Não foi possível carregar os produtos.</p>
                <button type="button" id="nova-tentar-novamente">
                    Tentar novamente
                </button>
            </div>
        `;

        document
            .querySelector("#nova-tentar-novamente")
            ?.addEventListener("click", carregarLoja);
    }

    if (elementos.grade) {
        elementos.grade.setAttribute("aria-busy", "false");
    }

    if (elementos.contadorProdutos) {
        elementos.contadorProdutos.textContent =
            "Não foi possível carregar os produtos";
    }
}

/* =========================================================
   CARREGAR A LOJA
   ========================================================= */

async function carregarLoja() {
    if (carregamentoEmAndamento) return;

    carregamentoEmAndamento = true;
    mostrarCarregamento();

    try {
        const [produtosBanco, configuracoesBanco] = await Promise.all([
            carregarProdutosSupabase(),
            carregarConfiguracoesSupabase()
        ]);

        produtos = produtosBanco;
        configuracoes = configuracoesBanco || {};

        aplicarCores();

        filtrarProdutos();

        console.log("NØVA Loja carregada.");
        console.log("Produtos encontrados:", produtos.length);
    } catch (erro) {
        console.error("Erro ao inicializar a loja:", erro);
        mostrarErro();
    } finally {
        carregamentoEmAndamento = false;
    }
}

/* =========================================================
   SINCRONIZAÇÃO
   ========================================================= */

window.addEventListener("storage", evento => {
    if (evento.key === NOVA_LOJA.chaveCarrinho) {
        atualizarContadorCarrinho();
    }

    /*
       Os produtos são carregados do Supabase.
       Alterações no localStorage não substituem o banco.
    */
});

window.addEventListener("nova:carrinho-atualizado", () => {
    atualizarContadorCarrinho();
});

/* =========================================================
   INICIALIZAÇÃO
   ========================================================= */

async function iniciarLoja() {
    obterElementos();

    inicializarFiltros();
    atualizarContadorCarrinho();

    await carregarLoja();
}
