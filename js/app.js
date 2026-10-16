/* =========================================================
   NØVA — JAVASCRIPT PRINCIPAL
   Loja, carrinho e integração com pedidos do ADM
   ========================================================= */

const NOVA_CART_KEY = "novaCarrinho";
const NOVA_ORDERS_KEY = "novaPedidos";
const NOVA_ORDER_KEY = "novaPedido";

/* =========================================================
   INTEGRAÇÃO DE PEDIDOS COM SUPABASE
   ========================================================= */

window.NovaPedidos = {
    carregarPedidos() {
        try {
            const pedidos = JSON.parse(
                localStorage.getItem(NOVA_ORDERS_KEY)
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
            (total, item) =>
                total + item.preco * item.quantidade,
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
            throw new Error(
                "Os valores do pedido são inválidos."
            );
        }

        const dataAtual = new Date().toISOString();

        const pedido = {
            id: dados.id || gerarIdPedido(),
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

        /* =============================================
           VERIFICAR CONEXÃO COM O SUPABASE
           ============================================= */

        const supabase = window.supabaseClient;

        if (!supabase || typeof supabase.from !== "function") {
            throw new Error(
                "Conexão com o Supabase indisponível. " +
                "O pedido não foi salvo."
            );
        }

        /* =============================================
           PREPARAR REGISTRO PARA A TABELA
           public.pedidos_nova
           ============================================= */

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

        /* =============================================
           SALVAR NO SUPABASE
           ============================================= */

        const { error } = await supabase
            .from("pedidos_nova")
            .insert(registroBanco);

        if (error) {
            console.error(
                "Erro do Supabase ao salvar pedido:",
                error
            );

            throw new Error(
                "Não foi possível salvar o pedido no banco de dados."
            );
        }

        /* =============================================
           ATUALIZAR CACHE LOCAL APÓS O SUCESSO
           ============================================= */

        const pedidoSalvo = {
            ...pedido,
            produtos: pedido.itens
        };

        const pedidos = this.carregarPedidos();

        const indiceExistente = pedidos.findIndex(
            (item) =>
                String(item.id) === String(pedidoSalvo.id)
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

        /* =============================================
           AVISAR OUTRAS PARTES DA APLICAÇÃO
           ============================================= */

        window.dispatchEvent(
            new CustomEvent("nova:pedido-criado", {
                detail: pedidoSalvo
            })
        );

        return pedidoSalvo;
    }
};

/* =========================================================
   GERAR ID DO PEDIDO
   ========================================================= */

function gerarIdPedido() {
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
   INICIALIZAÇÃO DA LOJA
   ========================================================= */

document.addEventListener("DOMContentLoaded", () => {
    let carrinho = [];

    try {
        const salvo = JSON.parse(
            localStorage.getItem(NOVA_CART_KEY)
        );

        carrinho = Array.isArray(salvo) ? salvo : [];
    } catch (erro) {
        console.error("Erro ao carregar carrinho:", erro);
        carrinho = [];
    }

    /* =============================================
       ELEMENTOS
       ============================================= */

    const cartCount = document.querySelector(".cart-count");

    const productButtons = document.querySelectorAll(
        ".product-cart"
    );

    console.log("NØVA JS carregado.");
    console.log("Botões encontrados:", productButtons.length);

    /* =============================================
       CONTADOR DO CARRINHO
       ============================================= */

    function atualizarContador() {
        if (!cartCount) return;

        const quantidade = carrinho.reduce(
            (total, produto) => {
                return total + Number(produto.quantidade || 0);
            },
            0
        );

        cartCount.textContent = quantidade;
    }

    /* =============================================
       SALVAR CARRINHO
       ============================================= */

    function salvarCarrinho() {
        localStorage.setItem(
            NOVA_CART_KEY,
            JSON.stringify(carrinho)
        );

        atualizarContador();

        window.dispatchEvent(
            new CustomEvent("nova:carrinho-atualizado", {
                detail: carrinho
            })
        );
    }

    /* =============================================
       CONVERTER PREÇO BRASILEIRO
       Exemplos: R$ 129,90 ou 129.90
       ============================================= */

    function converterPreco(valor) {
        if (typeof valor === "number") {
            return Number.isFinite(valor) ? valor : 0;
        }

        if (!valor) return 0;

        let texto = String(valor)
            .trim()
            .replace(/[^\d,.-]/g, "");

        if (texto.includes(",")) {
            texto = texto
                .replace(/\./g, "")
                .replace(",", ".");
        }

        const preco = Number(texto);

        return Number.isFinite(preco) ? preco : 0;
    }

    /* =============================================
       ADICIONAR PRODUTO AO CARRINHO
       ============================================= */

    function adicionarProduto(produto) {
        console.log("Produto recebido:", produto);

        const produtoExistente = carrinho.find(
            (item) =>
                String(item.id) === String(produto.id)
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
                quantidade: 1,
                tamanho: produto.tamanho || ""
            });
        }

        salvarCarrinho();

        mostrarMensagem("Produto adicionado ao carrinho!");

        console.log("Carrinho atual:", carrinho);
    }

    /* =============================================
       BOTÕES DOS PRODUTOS
       ============================================= */

    productButtons.forEach((button, index) => {
        button.addEventListener("click", (event) => {
            event.preventDefault();
            event.stopPropagation();

            const card = button.closest(".product-card");

            if (!card) {
                console.error(
                    "Não encontrei .product-card para o botão."
                );
                return;
            }

            const nomeElement = card.querySelector(
                ".product-info h3"
            );

            const nome = nomeElement
                ? nomeElement.textContent.trim()
                : "Produto NØVA";

            const precoElement = card.querySelector(
                ".product-price"
            );

            const preco = converterPreco(
                precoElement
                    ? precoElement.textContent
                    : "0"
            );

            const imagemElement = card.querySelector("img");

            const imagem = imagemElement
                ? imagemElement.getAttribute("src") || ""
                : "";

            const categoriaElement = card.querySelector(
                ".product-category"
            );

            const categoria = categoriaElement
                ? categoriaElement.textContent.trim()
                : "PRODUTO";

            const id =
                card.dataset.productId ||
                card.dataset.id ||
                `nova-produto-${index + 1}`;

            const produto = {
                id,
                nome,
                preco,
                imagem,
                categoria
            };

            adicionarProduto(produto);
        });
    });

    /* =============================================
       MENSAGEM TEMPORÁRIA
       ============================================= */

    function mostrarMensagem(texto) {
        const mensagemExistente = document.querySelector(
            ".nova-mensagem"
        );

        if (mensagemExistente) {
            mensagemExistente.remove();
        }

        const mensagem = document.createElement("div");

        mensagem.className = "nova-mensagem";
        mensagem.textContent = texto;
        mensagem.setAttribute("role", "status");

        Object.assign(mensagem.style, {
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
            boxShadow: "0 10px 30px rgba(0,0,0,0.3)"
        });

        document.body.appendChild(mensagem);

        setTimeout(() => {
            mensagem.remove();
        }, 2500);
    }

    /* =============================================
       MENU MOBILE
       ============================================= */

    const menuMobile =
        document.querySelector(".menu-mobile") ||
        document.querySelector(".menu-toggle");

    const nav = document.querySelector(".nav");

    if (menuMobile && nav) {
        menuMobile.addEventListener("click", () => {
            nav.classList.toggle("menu-open");

            const aberto = nav.classList.contains("menu-open");

            menuMobile.setAttribute(
                "aria-expanded",
                String(aberto)
            );
        });
    }

    /* =============================================
       BANNER PRINCIPAL
       ============================================= */

    const hero = document.querySelector(".hero");

    const heroLeft = document.querySelector(
        ".hero-arrow-left"
    );

    const heroRight = document.querySelector(
        ".hero-arrow-right"
    );

    const heroDots = document.querySelectorAll(".hero-dot");

    let bannerAtual = 0;

    function atualizarBanner() {
        heroDots.forEach((dot, index) => {
            dot.classList.toggle(
                "active",
                index === bannerAtual
            );

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

    /* =============================================
       SINCRONIZAÇÃO DO CARRINHO ENTRE ABAS
       ============================================= */

    window.addEventListener("storage", (event) => {
        if (event.key !== NOVA_CART_KEY) return;

        try {
            const dados = JSON.parse(event.newValue || "[]");

            carrinho = Array.isArray(dados) ? dados : [];
        } catch (erro) {
            console.error(
                "Erro ao sincronizar carrinho:",
                erro
            );

            carrinho = [];
        }

        atualizarContador();
    });

    /* =============================================
       INICIALIZAÇÃO
       ============================================= */

    atualizarContador();
    atualizarBanner();

    console.log("NØVA APP.JS inicializado.");
});