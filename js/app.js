
/* =========================================================
   NØVA — JAVASCRIPT PRINCIPAL
   Loja, carrinho, pedidos e configurações do Supabase
   ========================================================= */

const NOVA_CART_KEY = "novaCarrinho";
const NOVA_ORDERS_KEY = "novaPedidos";
const NOVA_ORDER_KEY = "novaPedido";
const NOVA_PRODUCT_KEY = "novaProdutoSelecionado";

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

function novaGerarIdPedido() {
    const data = new Date();

    const dataFormatada = [
        data.getFullYear(),
        String(data.getMonth() + 1).padStart(2, "0"),
        String(data.getDate()).padStart(2, "0")
    ].join("");

    const aleatorio = Math.random()
        .toString(36)
        .slice(2, 8)
        .toUpperCase();

    return `NVA-${dataFormatada}-${aleatorio}`;
}

/* =========================================================
   INTEGRAÇÃO DE PEDIDOS COM SUPABASE
   ========================================================= */

window.NovaPedidos = {
    carregarPedidos() {
        try {
            const pedidos = JSON.parse(
                localStorage.getItem(NOVA_ORDERS_KEY) || "[]"
            );

            return Array.isArray(pedidos) ? pedidos : [];
        } catch (erro) {
            console.error("Erro ao carregar pedidos:", erro);
            return [];
        }
    },

    async salvarPedido(dados) {
        if (!dados || typeof dados !== "object") {
            throw new Error("Os dados do pedido são inválidos.");
        }

        const itensOriginais = dados.itens || dados.produtos || [];

        if (!Array.isArray(itensOriginais) || itensOriginais.length === 0) {
            throw new Error(
                "O pedido precisa conter pelo menos um produto."
            );
        }

        const itens = itensOriginais.map((item) => ({
            id: item.id ?? "",
            nome: item.nome || item.name || "Produto NØVA",
            imagem: item.imagem || item.imagemUrl || item.image || "",
            preco: Number(item.preco ?? item.price ?? 0),
            quantidade: Math.max(
                1,
                Number.parseInt(
                    item.quantidade ?? item.quantity ?? 1,
                    10
                ) || 1
            ),
            tamanho: item.tamanho || item.size || "",
            cor: item.cor || item.color || ""
        }));

        if (
            itens.some(
                (item) =>
                    !Number.isFinite(item.preco) ||
                    item.preco < 0
            )
        ) {
            throw new Error(
                "Um ou mais produtos possuem preço inválido."
            );
        }

        const subtotalCalculado = itens.reduce(
            (total, item) => total + item.preco * item.quantidade,
            0
        );

        const subtotal = Number(
            dados.subtotal ?? subtotalCalculado
        );

        const frete = Number(dados.frete ?? 0);

        const total = Number(
            dados.total ?? subtotal + frete
        );

        if (
            ![subtotal, frete, total].every(Number.isFinite) ||
            subtotal < 0 ||
            frete < 0 ||
            total < 0
        ) {
            throw new Error("Os valores do pedido são inválidos.");
        }

        const dataAtual = new Date().toISOString();

        const pedido = {
            id: dados.id || novaGerarIdPedido(),
            cliente: dados.cliente || {},
            itens,
            produtos: itens,
            pagamento: dados.pagamento || "",
            subtotal,
            frete,
            total,
            status: dados.status || "Pendente",
            criadoEm: dados.criadoEm || dataAtual,
            data: dados.data || dataAtual
        };

        const supabase = window.supabaseClient;

        if (!supabase || typeof supabase.from !== "function") {
            throw new Error(
                "Conexão com o Supabase indisponível. O pedido não foi salvo."
            );
        }

        const registroBanco = {
            id: pedido.id,
            cliente: pedido.cliente,
            itens: pedido.itens,
            pagamento: pedido.pagamento,
            subtotal: pedido.subtotal,
            frete: pedido.frete,
            total: pedido.total,
            status: pedido.status,
            criado_em: pedido.criadoEm
        };

        const { error } = await supabase
            .from("pedidos_nova")
            .insert(registroBanco);

        if (error) {
            console.error("Erro do Supabase ao salvar pedido:", error);

            throw new Error(
                "Não foi possível salvar o pedido no banco de dados."
            );
        }

        const pedidoSalvo = {
            ...pedido,
            produtos: pedido.itens
        };

        const pedidos = this.carregarPedidos();

        const indiceExistente = pedidos.findIndex(
            (item) => String(item.id) === String(pedidoSalvo.id)
        );

        if (indiceExistente >= 0) {
            pedidos[indiceExistente] = {
                ...pedidos[indiceExistente],
                ...pedidoSalvo
            };
        } else {
            pedidos.unshift(pedidoSalvo);
        }

        localStorage.setItem(
            NOVA_ORDERS_KEY,
            JSON.stringify(pedidos)
        );

        localStorage.setItem(
            NOVA_ORDER_KEY,
            JSON.stringify(pedidoSalvo)
        );

        window.dispatchEvent(
            new CustomEvent("nova:pedido-criado", {
                detail: pedidoSalvo
            })
        );

        return pedidoSalvo;
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
    localStorage.setItem(
        NOVA_CART_KEY,
        JSON.stringify(novaCarrinho)
    );

    novaAtualizarContadorCarrinho();

    window.dispatchEvent(
        new CustomEvent("nova:carrinho-atualizado", {
            detail: novaCarrinho
        })
    );
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

    novaSalvarCarrinho();
    novaMostrarMensagem("Produto adicionado ao carrinho!");
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
        console.warn("Supabase indisponível para carregar produtos.");
        return [];
    }

    const { data, error } = await supabase
        .from("produtos_nova")
        .select("*")
        .eq("ativo", true)
        .gt("estoque", 0)
        .order("created_at", { ascending: false });

    if (error) {
        console.error("Erro ao buscar produtos:", error);
        return [];
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

    const promocao = novaEncontrarPromocao(
        novaConfiguracoes,
        produto.id
    );

    let preco = novaConverterPreco(produto.preco);

    if (promocao) {
        const precoPromocional = novaConverterPreco(promocao.preco);

        if (precoPromocional > 0 && precoPromocional < preco) {
            preco = precoPromocional;
        }
    }

    const produtoSelecionado = {
        ...produto,
        id: produto.id,
        nome: produto.nome,
        name: produto.nome,
        preco,
        price: preco,
        precoOriginal: novaConverterPreco(produto.preco),
        imagem: produto.imagem || "",
        image: produto.imagem || "",
        categoria: produto.categoria || "",
        descricao: produto.descricao || ""
    };

    localStorage.setItem(
        NOVA_PRODUCT_KEY,
        JSON.stringify(produtoSelecionado)
    );

    window.location.href = "pages/produto.html";
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
            novaCarregarProdutosBanco()
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
