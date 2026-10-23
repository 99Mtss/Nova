
/* =========================================================
   NØVA — JAVASCRIPT PRINCIPAL
   Loja, carrinho e configurações do Supabase
   ========================================================= */

const NOVA_CART_KEY = "novaCarrinho";

let novaCarrinho = [];
let novaProdutos = [];
let novaConfiguracoes = {};

/* =========================================================
   FUNÇÕES AUXILIARES
   ========================================================= */

function novaConverterPreco(valor) {
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

    const preco = Number(texto);

    return Number.isFinite(preco) ? preco : 0;
}

function novaFormatarPreco(valor) {
    return novaConverterPreco(valor).toLocaleString("pt-BR", {
        style: "currency",
        currency: "BRL"
    });
}

function novaEscaparHTML(valor) {
    return String(valor ?? "").replace(/[&<>"']/g, (caractere) => {
        const entidades = {
            "&": "&amp;",
            "<": "&lt;",
            ">": "&gt;",
            '"': "&quot;",
            "'": "&#039;"
        };

        return entidades[caractere];
    });
}

function novaImagemValida(url) {
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

/* =========================================================
   PEDIDOS
   ========================================================= */

window.NovaPedidos = {
    getEndpoint() {
        if (window.NOVA_ORDER_ENDPOINT) {
            return window.NOVA_ORDER_ENDPOINT;
        }

        if (window.NOVA_CONFIG?.orderEndpoint) {
            return window.NOVA_CONFIG.orderEndpoint;
        }

        if (window.supabaseClient?.supabaseUrl) {
            const base = String(window.supabaseClient.supabaseUrl).replace(/\/$/, "");
            return `${base}/functions/v1/create-order`;
        }

        return null;
    },

    isBackendConfigured() {
        return Boolean(this.getEndpoint()) || (
            Boolean(window.supabaseClient) &&
            typeof window.supabaseClient?.functions?.invoke === "function"
        );
    },

    async salvarPedido(payload = {}) {
        const endpoint = this.getEndpoint();
        const supabase = window.supabaseClient;

        if (endpoint) {
            const headers = {
                "Content-Type": "application/json"
            };

            if (supabase?.auth?.getSession) {
                const { data } = await supabase.auth.getSession();
                const accessToken = data?.session?.access_token;

                if (accessToken) {
                    headers.Authorization = `Bearer ${accessToken}`;
                }
            }

            const resposta = await fetch(endpoint, {
                method: "POST",
                headers,
                body: JSON.stringify(payload)
            });

            const dados = await resposta.json().catch(() => ({}));

            if (!resposta.ok) {
                throw new Error(
                    dados?.error ||
                    "Não foi possível registrar o pedido no servidor."
                );
            }

            return dados;
        }

        if (supabase && typeof supabase.functions?.invoke === "function") {
            const resposta = await supabase.functions.invoke("create-order", {
                body: payload
            });

            if (resposta?.error) {
                throw new Error(
                    resposta.error.message ||
                    "Não foi possível registrar o pedido no servidor."
                );
            }

            return resposta?.data || resposta;
        }

        throw new Error(
            "A criação de pedidos está bloqueada até existir uma operação " +
            "autorizada no servidor para validar frete, preços e estoque."
        );
    },

    async criarPedido(payload = {}) {
        return this.salvarPedido(payload);
    }
};

/* =========================================================
   CARRINHO
   ========================================================= */

function novaCarregarCarrinho() {
    try {
        const salvo = JSON.parse(
            localStorage.getItem(NOVA_CART_KEY) || "[]"
        );

        novaCarrinho = Array.isArray(salvo) ? salvo : [];
    } catch (erro) {
        console.error("Erro ao carregar carrinho:", erro);
        novaMostrarMensagem(
            "Não foi possível recuperar o carrinho salvo neste navegador."
        );
        novaCarrinho = [];
    }
}

function novaAtualizarContadorCarrinho() {
    const contador = document.querySelector(".cart-count");

    if (!contador) return;

    const quantidade = novaCarrinho.reduce(
        (total, produto) =>
            total + Number(produto.quantidade || 0),
        0
    );

    contador.textContent = quantidade;
}

function novaSalvarCarrinho() {
    try {
        localStorage.setItem(
            NOVA_CART_KEY,
            JSON.stringify(novaCarrinho)
        );
    } catch (erro) {
        console.error("Não foi possível salvar o carrinho local:", erro);
        novaMostrarMensagem(
            "Não foi possível manter o carrinho após recarregar esta página."
        );
        return false;
    }

    novaAtualizarContadorCarrinho();

    window.dispatchEvent(
        new CustomEvent("nova:carrinho-atualizado", {
            detail: novaCarrinho
        })
    );

    return true;
}

function novaMostrarMensagem(texto) {
    const anterior = document.querySelector(".nova-mensagem");

    if (anterior) anterior.remove();

    const mensagem = document.createElement("div");

    mensagem.className = "nova-mensagem";
    mensagem.textContent = texto;
    mensagem.setAttribute("role", "status");

    Object.assign(mensagem.style, {
        position: "fixed",
        bottom: "25px",
        right: "25px",
        zIndex: "99999",
        maxWidth: "calc(100% - 40px)",
        padding: "14px 20px",
        background: "#1E222B",
        color: "#F5F7FA",
        border: "1px solid #8B5CF6",
        borderRadius: "8px",
        fontSize: "14px",
        fontFamily: "Arial, sans-serif",
        boxShadow: "0 10px 30px rgba(0,0,0,0.3)"
    });

    document.body.appendChild(mensagem);

    window.setTimeout(() => mensagem.remove(), 2500);
}

function novaAdicionarProduto(produto) {
    if (!produto || !produto.id) {
        novaMostrarMensagem("Não foi possível identificar o produto.");
        return;
    }

    const existente = novaCarrinho.find(
        (item) => String(item.id) === String(produto.id)
    );

    if (existente) {
        existente.quantidade =
            Number(existente.quantidade || 0) + 1;
    } else {
        novaCarrinho.push({
            id: produto.id,
            nome: produto.nome || produto.name || "Produto NØVA",
            preco: novaConverterPreco(produto.preco ?? produto.price),
            imagem: produto.imagem || produto.image || "",
            categoria: produto.categoria || "PRODUTO",
            quantidade: 1,
            tamanho: produto.tamanho || "",
            cor: produto.cor || ""
        });
    }

    if (novaSalvarCarrinho()) {
        novaMostrarMensagem("Produto adicionado ao carrinho!");
    }
}

/* =========================================================
   CONFIGURAÇÕES DA LOJA — SUPABASE
   Tabela: public.configuracoes_nova
   Colunas esperadas: id, configuracoes
   Registro: id = "loja"
   ========================================================= */

async function novaCarregarConfiguracoes() {
    const supabase = window.supabaseClient;

    if (!supabase || typeof supabase.from !== "function") {
        console.warn(
            "Supabase indisponível. A página usará as configurações padrão."
        );
        return {};
    }

    const { data, error } = await supabase
        .from("configuracoes_nova")
        .select("configuracoes")
        .eq("id", "loja")
        .maybeSingle();

    if (error) {
        console.error("Erro ao carregar configurações da loja:", error);
        return {};
    }

    if (!data || !data.configuracoes) {
        console.warn("Nenhuma configuração da loja foi encontrada.");
        return {};
    }

    const configuracoes = data.configuracoes;

    return configuracoes && typeof configuracoes === "object"
        ? configuracoes
        : {};
}

/* =========================================================
   APLICAR CORES CONFIGURADAS NO ADM
   ========================================================= */

function novaAplicarCores(configuracoes) {
    const cores = configuracoes.cores || {};

    const raiz = document.documentElement;

    const mapaCores = {
        "Fundo": "--nova-cor-fundo",
        "Superfície": "--nova-cor-superficie",
        "Destaque": "--nova-cor-destaque",
        "Texto": "--nova-cor-texto"
    };

    Object.entries(mapaCores).forEach(([chave, variavel]) => {
        const cor = cores[chave];

        if (
            typeof cor === "string" &&
            /^#[0-9a-fA-F]{3}(?:[0-9a-fA-F]{3})?$/.test(cor)
        ) {
            raiz.style.setProperty(variavel, cor);
        }
    });

    /*
       Aplica as cores às áreas principais sem sobrescrever
       indiscriminadamente todos os estilos do site.
    */

    const fundo = cores["Fundo"];
    const superficie = cores["Superfície"];
    const destaque = cores["Destaque"];
    const texto = cores["Texto"];

    if (fundo && /^#[0-9a-fA-F]{3}(?:[0-9a-fA-F]{3})?$/.test(fundo)) {
        document.body.style.backgroundColor = fundo;
    }

    if (texto && /^#[0-9a-fA-F]{3}(?:[0-9a-fA-F]{3})?$/.test(texto)) {
        document.body.style.color = texto;
    }

    if (
        superficie &&
        /^#[0-9a-fA-F]{3}(?:[0-9a-fA-F]{3})?$/.test(superficie)
    ) {
        document.querySelectorAll(
            ".header, .footer, .product-card, .benefit"
        ).forEach((elemento) => {
            elemento.style.setProperty(
                "background-color",
                superficie
            );
        });
    }

    if (
        destaque &&
        /^#[0-9a-fA-F]{3}(?:[0-9a-fA-F]{3})?$/.test(destaque)
    ) {
        document.querySelectorAll(
            ".btn-primary, .section-label"
        ).forEach((elemento) => {
            elemento.style.setProperty(
                "border-color",
                destaque
            );
        });
    }
}

/* =========================================================
   APLICAR IMAGEM DO BANNER PRINCIPAL
   ========================================================= */

function novaAplicarBanner(configuracoes) {
    const hero = document.querySelector(
        "[data-nova-banner], #banner-principal, .hero"
    );

    if (!hero) return;

    const url = novaImagemValida(configuracoes.banner);

    if (!url) return;

    hero.style.backgroundImage =
        `linear-gradient(rgba(0,0,0,0.35), rgba(0,0,0,0.35)), url("${url}")`;

    hero.classList.add("nova-banner-configurado");
    hero.dataset.bannerConfigurado = "true";
}

/* =========================================================
   BUSCAR PRODUTOS NO SUPABASE
   Tabela: public.produtos_nova
   ========================================================= */

async function novaCarregarProdutosBanco() {
    const supabase = window.supabaseClient;

    if (!supabase || typeof supabase.from !== "function") {
        throw new Error("Supabase indisponível para carregar produtos.");
    }

    const { data, error } = await supabase
        .from("produtos_nova")
        .select("*")
        .eq("ativo", true)
        .gt("estoque", 0)
        .order("created_at", { ascending: false });

    if (error) {
        console.error("Erro ao buscar produtos:", error);
        throw new Error("Não foi possível carregar os produtos da loja.");
    }

    return Array.isArray(data) ? data : [];
}

/* =========================================================
   IDENTIFICAR PRODUTOS EM DESTAQUE E PROMOÇÃO
   ========================================================= */

function novaEncontrarPromocao(configuracoes, produtoId) {
    const promocoes = Array.isArray(configuracoes.promocoes)
        ? configuracoes.promocoes
        : [];

    return promocoes.find(
        (promocao) =>
            String(promocao.id) === String(produtoId)
    );
}

function novaMontarListaDestaques(produtos, configuracoes) {
    const idsDestaque = Array.isArray(configuracoes.destaques)
        ? configuracoes.destaques.map(String)
        : [];

    if (idsDestaque.length === 0) {
        return produtos.slice(0, 4);
    }

    return idsDestaque
        .map((id) =>
            produtos.find(
                (produto) => String(produto.id) === id
            )
        )
        .filter(Boolean);
}

/* =========================================================
   EXIBIR PRODUTOS NA PÁGINA INICIAL
   ========================================================= */

function novaRenderizarDestaques(produtos, configuracoes) {
    const lista = document.querySelector(
        '[data-product-list="featured"], #featured-products'
    );

    if (!lista) return;

    const destaques = novaMontarListaDestaques(
        produtos,
        configuracoes
    );

    if (destaques.length === 0) {
        lista.innerHTML = `
            <p class="products-loading">
                Nenhum produto em destaque disponível no momento.
            </p>
        `;
        return;
    }

    lista.innerHTML = destaques.map((produto) => {
        const id = novaEscaparHTML(produto.id);
        const nome = novaEscaparHTML(produto.nome);
        const categoria = novaEscaparHTML(produto.categoria || "NØVA");
        const descricao = novaEscaparHTML(produto.descricao || "");
        const imagem = novaImagemValida(produto.imagem);

        const precoOriginal = novaConverterPreco(produto.preco);
        const promocao = novaEncontrarPromocao(
            configuracoes,
            produto.id
        );

        let precoAtual = precoOriginal;
        let etiquetaPromocao = "";
        let precoAntigo = "";

        if (promocao) {
            const precoPromocional = novaConverterPreco(
                promocao.preco
            );

            if (
                precoPromocional > 0 &&
                precoPromocional < precoOriginal
            ) {
                precoAtual = precoPromocional;

                etiquetaPromocao = `
                    <span class="nova-etiqueta-promocao">
                        PROMOÇÃO
                    </span>
                `;

                precoAntigo = `
                    <span class="nova-preco-antigo">
                        ${novaFormatarPreco(precoOriginal)}
                    </span>
                `;
            }
        }

        const imagemHTML = imagem
            ? `
                <img
                    src="${novaEscaparHTML(imagem)}"
                    alt="${nome}"
                    loading="lazy"
                >
            `
            : `
                <div class="nova-imagem-indisponivel">
                    NØVA
                </div>
            `;

        return `
            <article
                class="product-card"
                data-product-id="${id}"
                data-id="${id}"
            >
                <a
                    href="pages/produto.html"
                    class="product-image nova-link-produto"
                    data-product-open="${id}"
                    aria-label="Ver ${nome}"
                >
                    ${etiquetaPromocao}
                    ${imagemHTML}
                </a>

                <div class="product-info">
                    <span class="product-category">
                        ${categoria}
                    </span>

                    <h3>
                        <a
                            href="pages/produto.html"
                            class="nova-link-produto"
                            data-product-open="${id}"
                        >
                            ${nome}
                        </a>
                    </h3>

                    ${descricao ? `
                        <p class="product-description">
                            ${descricao}
                        </p>
                    ` : ""}

                    <div class="product-price">
                        ${novaFormatarPreco(precoAtual)}
                        ${precoAntigo}
                    </div>

                    <button
                        type="button"
                        class="product-cart"
                        data-add-cart="${id}"
                        aria-label="Adicionar ${nome} ao carrinho"
                    >
                        Adicionar ao carrinho
                    </button>
                </div>
            </article>
        `;
    }).join("");
}

/* =========================================================
   ABRIR PÁGINA DO PRODUTO
   ========================================================= */

function novaAbrirProduto(id) {
    const produto = novaProdutos.find(
        (item) => String(item.id) === String(id)
    );

    if (!produto) {
        novaMostrarMensagem("Não foi possível encontrar esse produto.");
        return;
    }

    const url = new URL("pages/produto.html", window.location.href);
    url.searchParams.set("id", produto.id);
    window.location.href = url.href;
}

/* =========================================================
   MENU MOBILE
   ========================================================= */

function novaInicializarMenuMobile() {
    const menuMobile =
        document.querySelector(".menu-mobile") ||
        document.querySelector(".menu-toggle");

    const nav = document.querySelector(".nav");

    if (!menuMobile || !nav) return;

    menuMobile.addEventListener("click", () => {
        nav.classList.toggle("menu-open");

        const aberto = nav.classList.contains("menu-open");

        menuMobile.setAttribute(
            "aria-expanded",
            String(aberto)
        );
    });
}

/* =========================================================
   CONTROLES DO BANNER
   ========================================================= */

function novaInicializarControlesBanner() {
    const hero = document.querySelector(".hero");

    const heroLeft = document.querySelector(".hero-arrow-left");
    const heroRight = document.querySelector(".hero-arrow-right");
    const heroDots = document.querySelectorAll(".hero-dot");

    let bannerAtual = 0;

    function atualizarBanner() {
        heroDots.forEach((dot, index) => {
            dot.classList.toggle("active", index === bannerAtual);

            dot.setAttribute(
                "aria-current",
                index === bannerAtual ? "true" : "false"
            );
        });

        if (hero) {
            hero.dataset.bannerAtual = String(bannerAtual);
        }
    }

    if (heroDots.length > 0) {
        if (heroLeft) {
            heroLeft.addEventListener("click", () => {
                bannerAtual =
                    (bannerAtual - 1 + heroDots.length) %
                    heroDots.length;

                atualizarBanner();
            });
        }

        if (heroRight) {
            heroRight.addEventListener("click", () => {
                bannerAtual =
                    (bannerAtual + 1) % heroDots.length;

                atualizarBanner();
            });
        }

        heroDots.forEach((dot, index) => {
            dot.addEventListener("click", () => {
                bannerAtual = index;
                atualizarBanner();
            });
        });
    }

    atualizarBanner();
}

/* =========================================================
   EVENTOS DOS PRODUTOS
   ========================================================= */

function novaInicializarEventosProdutos() {
    if (!document.querySelector('[data-product-list="featured"], #featured-products')) {
        return;
    }

    document.addEventListener("click", (event) => {
        const botaoCarrinho = event.target.closest("[data-add-cart]");

        if (botaoCarrinho) {
            event.preventDefault();
            event.stopPropagation();

            const id = botaoCarrinho.dataset.addCart;

            const produto = novaProdutos.find(
                (item) => String(item.id) === String(id)
            );

            if (!produto) {
                novaMostrarMensagem("Produto não encontrado.");
                return;
            }

            const promocao = novaEncontrarPromocao(
                novaConfiguracoes,
                produto.id
            );

            let preco = novaConverterPreco(produto.preco);

            if (promocao) {
                const promocional = novaConverterPreco(promocao.preco);

                if (promocional > 0 && promocional < preco) {
                    preco = promocional;
                }
            }

            novaAdicionarProduto({
                id: produto.id,
                nome: produto.nome,
                preco,
                imagem: produto.imagem || "",
                categoria: produto.categoria || "PRODUTO"
            });

            return;
        }

        const linkProduto = event.target.closest("[data-product-open]");

        if (linkProduto) {
            event.preventDefault();

            novaAbrirProduto(
                linkProduto.dataset.productOpen
            );
        }
    });
}

/* =========================================================
   SINCRONIZAR CARRINHO ENTRE ABAS
   ========================================================= */

function novaInicializarSincronizacaoCarrinho() {
    window.addEventListener("storage", (event) => {
        if (event.key !== NOVA_CART_KEY) return;

        try {
            const dados = JSON.parse(event.newValue || "[]");

            novaCarrinho = Array.isArray(dados) ? dados : [];
        } catch (erro) {
            console.error("Erro ao sincronizar carrinho:", erro);
            novaCarrinho = [];
        }

        novaAtualizarContadorCarrinho();
    });
}

/* =========================================================
   INICIALIZAÇÃO PRINCIPAL
   ========================================================= */

document.addEventListener("DOMContentLoaded", async () => {
    console.log("NØVA JS carregado.");

    novaCarregarCarrinho();
    novaAtualizarContadorCarrinho();

    novaInicializarMenuMobile();
    novaInicializarControlesBanner();
    novaInicializarEventosProdutos();
    novaInicializarSincronizacaoCarrinho();

    const listaDestaques = document.querySelector(
        '[data-product-list="featured"], #featured-products'
    );

    if (listaDestaques) {
        listaDestaques.innerHTML = `
            <p class="products-loading">
                Carregando produtos...
            </p>
        `;
    }

    try {
        /*
         * Carrega as configurações e os produtos do banco.
         */

        const [configuracoes, produtos] = await Promise.all([
            novaCarregarConfiguracoes(),
            listaDestaques
                ? novaCarregarProdutosBanco()
                : Promise.resolve([])
        ]);

        novaConfiguracoes = configuracoes;
        novaProdutos = produtos;

        novaAplicarCores(novaConfiguracoes);
        novaAplicarBanner(novaConfiguracoes);

        novaRenderizarDestaques(
            novaProdutos,
            novaConfiguracoes
        );

        console.log("Configurações da NØVA carregadas.");
        console.log("Produtos disponíveis:", novaProdutos.length);
    } catch (erro) {
        console.error(
            "Erro ao inicializar os dados da loja:",
            erro
        );

        if (listaDestaques) {
            listaDestaques.innerHTML = `
                <p class="products-loading">
                    Não foi possível carregar os produtos.
                    Tente novamente mais tarde.
                </p>
            `;
        }
    }

    console.log("NØVA APP.JS inicializado.");
});
