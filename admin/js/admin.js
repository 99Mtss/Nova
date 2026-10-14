
document.addEventListener("DOMContentLoaded", async () => {
    "use strict";

    // =========================================================
    // CONFIGURAÇÕES
    // =========================================================

    const TABELA_PRODUTOS = "produtos_nova";
    const TABELA_PEDIDOS = "pedidos_nova";
    const ESTOQUE_BAIXO_LIMITE = 10;

    let produtos = [];
    let pedidos = [];

    const supabase = window.supabaseClient;

    // =========================================================
    // FUNÇÕES AUXILIARES
    // =========================================================

    function buscarElemento(...seletores) {
        for (const seletor of seletores) {
            const elemento = document.querySelector(seletor);
            if (elemento) return elemento;
        }

        return null;
    }

    function definirTexto(seletores, valor) {
        const elemento = buscarElemento(...seletores);

        if (elemento) {
            elemento.textContent = valor;
        }
    }

    function formatarPreco(valor) {
        return Number(valor || 0).toLocaleString("pt-BR", {
            style: "currency",
            currency: "BRL"
        });
    }

    function obterDataPedido(pedido) {
        const valor =
            pedido.criado_em ||
            pedido.criadoEm ||
            pedido.created_at ||
            pedido.data;

        if (!valor) return null;

        const data = new Date(valor);

        return Number.isNaN(data.getTime()) ? null : data;
    }

    function formatarData(data) {
        if (!data) return "—";

        return data.toLocaleDateString("pt-BR");
    }

    function normalizarStatus(status) {
        const valor = String(status || "Pendente")
            .trim()
            .toLowerCase();

        const equivalencias = {
            pendente: "pending",
            aguardando: "pending",
            pending: "pending",

            processando: "processing",
            processamento: "processing",
            processing: "processing",

            enviado: "shipped",
            enviada: "shipped",
            shipped: "shipped",

            entregue: "delivered",
            delivered: "delivered",

            cancelado: "cancelled",
            cancelada: "cancelled",
            canceled: "cancelled",
            cancelled: "cancelled"
        };

        return equivalencias[valor] || valor;
    }

    function obterTextoStatus(status) {
        const textos = {
            pending: "Pendente",
            processing: "Processando",
            shipped: "Enviado",
            delivered: "Entregue",
            cancelled: "Cancelado"
        };

        return textos[normalizarStatus(status)] || "Pendente";
    }

    function obterNomeCliente(pedido) {
        const cliente = pedido.cliente || {};

        return (
            cliente.nome ||
            cliente.name ||
            pedido.nomeCliente ||
            pedido.customer_name ||
            "Cliente"
        );
    }

    function obterEmailCliente(pedido) {
        const cliente = pedido.cliente || {};

        return String(
            cliente.email ||
            pedido.email ||
            pedido.customer_email ||
            ""
        ).trim().toLowerCase();
    }

    function obterIdPedido(pedido) {
        return String(pedido.id || pedido.codigo || "—")
            .replace(/^#+/, "");
    }

    function obterTotalPedido(pedido) {
        return Number(
            pedido.total ??
            pedido.valorTotal ??
            pedido.total_amount ??
            0
        );
    }

    function obterEstoque(produto) {
        return Number(produto.estoque ?? produto.stock ?? 0);
    }

    function produtoEstaAtivo(produto) {
        return produto.ativo === true ||
            produto.ativo === 1 ||
            produto.ativo === "true";
    }

    function mostrarMensagem(container, texto, classe = "dashboard-empty") {
        if (!container) return;

        container.replaceChildren();

        const mensagem = document.createElement("p");
        mensagem.className = classe;
        mensagem.textContent = texto;

        container.appendChild(mensagem);
    }

    // =========================================================
    // AUTENTICAÇÃO DO ADMINISTRADOR
    // =========================================================

    async function verificarAcessoAdmin() {
        if (typeof window.verificarAdmin !== "function") {
            console.error(
                "A função verificarAdmin() não foi encontrada. " +
                "Confira se js/supabase.js foi carregado antes de js/admin.js."
            );

            mostrarMensagem(
                buscarElemento("#dashboard-recent-orders"),
                "Não foi possível verificar a sessão administrativa."
            );

            return false;
        }

        try {
            const autorizado = await window.verificarAdmin();

            if (!autorizado) {
                window.location.replace("login.html");
                return false;
            }

            return true;
        } catch (erro) {
            console.error("Erro ao verificar administrador:", erro);
            window.location.replace("login.html");
            return false;
        }
    }

    // =========================================================
    // LEITURA DO SUPABASE
    // =========================================================

    async function carregarProdutos() {
        const { data, error } = await supabase
            .from(TABELA_PRODUTOS)
            .select("*")
            .order("criado_em", { ascending: false });

        if (error) {
            // Compatibilidade caso a tabela use created_at.
            const segundaConsulta = await supabase
                .from(TABELA_PRODUTOS)
                .select("*");

            if (segundaConsulta.error) {
                throw segundaConsulta.error;
            }

            produtos = segundaConsulta.data || [];
            return;
        }

        produtos = data || [];
    }

    async function carregarPedidos() {
        const { data, error } = await supabase
            .from(TABELA_PEDIDOS)
            .select("*")
            .order("criado_em", { ascending: false });

        if (error) {
            // A tabela também possui created_at.
            const segundaConsulta = await supabase
                .from(TABELA_PEDIDOS)
                .select("*")
                .order("created_at", { ascending: false });

            if (segundaConsulta.error) {
                throw segundaConsulta.error;
            }

            pedidos = segundaConsulta.data || [];
            return;
        }

        pedidos = data || [];
    }

    async function recarregarDados() {
        if (!supabase) {
            throw new Error(
                "Supabase não inicializado. Confira o arquivo js/supabase.js."
            );
        }

        // Cada tabela é carregada separadamente para identificar
        // qual consulta apresenta erro, caso exista algum.
        const resultados = await Promise.allSettled([
            carregarProdutos(),
            carregarPedidos()
        ]);

        const erroProdutos = resultados[0].status === "rejected";
        const erroPedidos = resultados[1].status === "rejected";

        if (erroProdutos) {
            console.error(
                "Não foi possível carregar os produtos:",
                resultados[0].reason
            );
        }

        if (erroPedidos) {
            console.error(
                "Não foi possível carregar os pedidos:",
                resultados[1].reason
            );
        }

        atualizarDashboard();

        if (erroProdutos || erroPedidos) {
            const container = buscarElemento("#dashboard-recent-orders");

            if (container && erroPedidos) {
                mostrarMensagem(
                    container,
                    "Não foi possível carregar os pedidos. Verifique as permissões do Supabase."
                );
            }
        }
    }

    // =========================================================
    // ESTATÍSTICAS
    // =========================================================

    function calcularReceita() {
        return pedidos.reduce((total, pedido) => {
            if (normalizarStatus(pedido.status) === "cancelled") {
                return total;
            }

            return total + obterTotalPedido(pedido);
        }, 0);
    }

    function obterClientesUnicos() {
        const clientes = new Set();

        pedidos.forEach(pedido => {
            const email = obterEmailCliente(pedido);

            if (email) clientes.add(email);
        });

        return clientes.size;
    }

    function obterProdutosEstoqueBaixo() {
        return produtos.filter(produto => {
            const estoque = obterEstoque(produto);

            return estoque > 0 &&
                estoque <= ESTOQUE_BAIXO_LIMITE;
        }).length;
    }

    function atualizarEstatisticas() {
        definirTexto(
            ["#dashboard-revenue", ".stat-card:nth-child(1) .stat-value"],
            formatarPreco(calcularReceita())
        );

        definirTexto(
            ["#dashboard-orders", ".stat-card:nth-child(2) .stat-value"],
            pedidos.length
        );

        definirTexto(
            ["#dashboard-products", ".stat-card:nth-child(3) .stat-value"],
            produtos.length
        );

        definirTexto(
            ["#dashboard-customers", ".stat-card:nth-child(4) .stat-value"],
            obterClientesUnicos()
        );

        definirTexto(
            ["#dashboard-low-stock"],
            obterProdutosEstoqueBaixo()
        );

        definirTexto(
            ["#dashboard-active-products"],
            produtos.filter(produtoEstaAtivo).length
        );
    }

    // =========================================================
    // PEDIDOS RECENTES
    // =========================================================

    function criarCelula(texto, classe) {
        const elemento = document.createElement("div");

        if (classe) elemento.className = classe;

        elemento.textContent = texto;

        return elemento;
    }

    function atualizarPedidosRecentes() {
        const container = buscarElemento("#dashboard-recent-orders");

        if (!container) return;

        const pedidosRecentes = [...pedidos]
            .sort((a, b) => {
                return (
                    (obterDataPedido(b)?.getTime() || 0) -
                    (obterDataPedido(a)?.getTime() || 0)
                );
            })
            .slice(0, 5);

        container.replaceChildren();

        if (pedidosRecentes.length === 0) {
            mostrarMensagem(container, "Nenhum pedido encontrado.");
            return;
        }

        pedidosRecentes.forEach(pedido => {
            const linha = document.createElement("div");
            linha.className = "order-row";

            const status = normalizarStatus(pedido.status);

            linha.append(
                criarCelula(`#${obterIdPedido(pedido)}`, "order-id"),
                criarCelula(obterNomeCliente(pedido), "order-client"),
                criarCelula(
                    formatarData(obterDataPedido(pedido)),
                    "order-date"
                ),
                criarCelula(
                    formatarPreco(obterTotalPedido(pedido)),
                    "order-total"
                ),
                criarCelula(
                    obterTextoStatus(pedido.status),
                    `order-status ${status}`
                )
            );

            container.appendChild(linha);
        });
    }

    // =========================================================
    // GRÁFICO DE VENDAS
    // =========================================================

    function obterPeriodoGrafico() {
        return buscarElemento("#dashboard-sales-period")?.value || "7";
    }

    function obterQuantidadeDias(periodo) {
        const valor = String(periodo).toLowerCase();

        if (["30", "month", "mensal", "mes"].includes(valor)) return 30;
        if (["90", "quarter", "trimestre"].includes(valor)) return 90;
        if (["365", "year", "anual", "ano"].includes(valor)) return 365;

        return 7;
    }

    function obterChaveData(data) {
        const ano = data.getFullYear();
        const mes = String(data.getMonth() + 1).padStart(2, "0");
        const dia = String(data.getDate()).padStart(2, "0");

        return `${ano}-${mes}-${dia}`;
    }

    function atualizarGrafico() {
        const container = buscarElemento("#dashboard-chart-bars");

        if (!container) return;

        const quantidadeDias = obterQuantidadeDias(obterPeriodoGrafico());
        const hoje = new Date();

        hoje.setHours(0, 0, 0, 0);

        const valores = [];

        for (let i = quantidadeDias - 1; i >= 0; i--) {
            const data = new Date(hoje);
            data.setDate(hoje.getDate() - i);

            const chave = obterChaveData(data);
            let valor = 0;

            pedidos.forEach(pedido => {
                const dataPedido = obterDataPedido(pedido);

                if (!dataPedido) return;
                if (normalizarStatus(pedido.status) === "cancelled") return;

                if (obterChaveData(dataPedido) === chave) {
                    valor += obterTotalPedido(pedido);
                }
            });

            valores.push({ data, valor });
        }

        const maiorValor = Math.max(
            ...valores.map(item => item.valor),
            1
        );

        container.replaceChildren();

        valores.forEach(item => {
            const barra = document.createElement("div");

            barra.className = "chart-bar";
            barra.style.height = `${Math.max(
                (item.valor / maiorValor) * 100,
                3
            )}%`;

            barra.title =
                `${formatarData(item.data)}: ${formatarPreco(item.valor)}`;

            container.appendChild(barra);
        });

        const eixoX = buscarElemento("#dashboard-chart-x");

        if (eixoX) {
            eixoX.replaceChildren();

            valores.forEach((item, index) => {
                const legenda = document.createElement("span");
                const mostrarData =
                    quantidadeDias === 7 ||
                    index % Math.ceil(quantidadeDias / 6) === 0 ||
                    index === valores.length - 1;

                legenda.textContent = mostrarData
                    ? formatarData(item.data)
                    : "";

                eixoX.appendChild(legenda);
            });
        }

        const eixoY = buscarElemento("#dashboard-chart-y");

        if (eixoY) {
            eixoY.replaceChildren();

            [maiorValor, maiorValor * 0.75, maiorValor * 0.5,
                maiorValor * 0.25, 0].forEach(valor => {
                const legenda = document.createElement("span");

                legenda.textContent = formatarPreco(valor);
                eixoY.appendChild(legenda);
            });
        }

        const mensagem = buscarElemento("#dashboard-chart-message");

        if (mensagem) {
            mensagem.textContent = valores.some(item => item.valor > 0)
                ? ""
                : "Ainda não há vendas registradas neste período.";
        }
    }

    // =========================================================
    // CATEGORIAS
    // =========================================================

    function atualizarCategorias() {
        const categorias = new Map();

        produtos.forEach(produto => {
            const nome = String(produto.categoria || "Outros").trim();

            categorias.set(nome, (categorias.get(nome) || 0) + 1);
        });

        const total = produtos.length;

        document.querySelectorAll("[data-category-count]").forEach(elemento => {
            const categoria = elemento.dataset.categoryCount;
            elemento.textContent = categorias.get(categoria) || 0;
        });

        document.querySelectorAll("[data-category-percent]").forEach(elemento => {
            const categoria = elemento.dataset.categoryPercent;
            const quantidade = categorias.get(categoria) || 0;
            const porcentagem = total > 0
                ? Math.round((quantidade / total) * 100)
                : 0;

            elemento.textContent = `${porcentagem}%`;
        });

        const container = buscarElemento("#dashboard-categories");

        if (!container) return;

        // Preserva as categorias que já estão desenhadas no HTML.
        if (container.children.length > 0) return;

        if (categorias.size === 0) {
            mostrarMensagem(container, "Nenhuma categoria cadastrada.");
            return;
        }

        categorias.forEach((quantidade, nome) => {
            const linha = document.createElement("div");
            linha.className = "dashboard-category-row";

            const nomeElemento = document.createElement("span");
            nomeElemento.textContent = nome;

            const totalElemento = document.createElement("span");
            totalElemento.textContent = String(quantidade);

            linha.append(nomeElemento, totalElemento);
            container.appendChild(linha);
        });
    }

    // =========================================================
    // MENU MOBILE
    // =========================================================

    const sidebarToggle = buscarElemento("#sidebar-toggle", ".sidebar-toggle");
    const sidebar = buscarElemento("#admin-sidebar", ".admin-sidebar");
    const overlay = buscarElemento("#admin-sidebar-overlay");

    function fecharMenuMobile() {
        sidebar?.classList.remove("active");
        sidebarToggle?.setAttribute("aria-expanded", "false");
        document.body.classList.remove("sidebar-open");

        if (overlay) {
            overlay.classList.remove("active");
            overlay.hidden = true;
        }
    }

    if (sidebarToggle && sidebar) {
        sidebarToggle.setAttribute("aria-expanded", "false");

        sidebarToggle.addEventListener("click", () => {
            const aberto = !sidebar.classList.contains("active");

            sidebar.classList.toggle("active", aberto);
            sidebarToggle.setAttribute("aria-expanded", String(aberto));
            document.body.classList.toggle("sidebar-open", aberto);

            if (overlay) {
                overlay.hidden = !aberto;
                overlay.classList.toggle("active", aberto);
            }
        });
    }

    overlay?.addEventListener("click", fecharMenuMobile);

    document.querySelectorAll("#admin-sidebar a, .admin-sidebar a")
        .forEach(link => {
            link.addEventListener("click", fecharMenuMobile);
        });

    // Fecha o menu ao voltar para a versão desktop.
    window.addEventListener("resize", () => {
        if (window.innerWidth > 768) fecharMenuMobile();
    });

    // =========================================================
    // SELETOR DO GRÁFICO
    // =========================================================

    buscarElemento("#dashboard-sales-period")
        ?.addEventListener("change", atualizarGrafico);

    // =========================================================
    // NOTIFICAÇÕES
    // =========================================================

    buscarElemento(".admin-notification")
        ?.addEventListener("click", evento => {
            evento.currentTarget.classList.toggle("active");
        });

    // =========================================================
    // ATALHOS DO DASHBOARD
    // =========================================================

    const atalhos = [
        ['[data-dashboard-link="produto"]', "produtos.html"],
        ['[data-dashboard-link="pedidos"]', "pedidos.html"],
        ['[data-dashboard-link="estoque"]', "produtos.html"]
    ];

    atalhos.forEach(([seletor, destino]) => {
        const elemento = buscarElemento(seletor);

        // Os atalhos que já são links continuam usando o próprio href.
        if (elemento && elemento.tagName !== "A") {
            elemento.addEventListener("click", () => {
                window.location.href = destino;
            });
        }
    });

    // =========================================================
    // ATUALIZAÇÃO DO DASHBOARD
    // =========================================================

    function atualizarDashboard() {
        atualizarEstatisticas();
        atualizarPedidosRecentes();
        atualizarGrafico();
        atualizarCategorias();
    }

    // =========================================================
    // INICIALIZAÇÃO
    // =========================================================

    const autorizado = await verificarAcessoAdmin();

    if (!autorizado) return;

    try {
        await recarregarDados();
    } catch (erro) {
        console.error("Erro ao iniciar o dashboard:", erro);

        mostrarMensagem(
            buscarElemento("#dashboard-recent-orders"),
            "Erro ao conectar com o Supabase. Confira a conexão e as permissões."
        );
    }
});
