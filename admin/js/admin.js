document.addEventListener("DOMContentLoaded", () => {

    // =========================================================
    // CONFIGURAÇÕES
    // =========================================================

    const PEDIDOS_KEY = "novaPedidos";
    const PEDIDO_KEY = "novaPedido";

    // IMPORTANTE:
    // Esta é a chave compartilhada entre:
    // ADM → Produtos → Loja
    const PRODUTOS_KEY = "novaProdutos";
    const PRODUTOS_KEY_ANTIGO = "novaProdutosAdmin";


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
    // PRODUTOS
    // =========================================================

    function obterProdutos() {

        let produtos = localStorage.getItem(PRODUTOS_KEY);

        if (produtos) {
            try {
                return JSON.parse(produtos);
            } catch (erro) {
                console.error("Erro ao ler produtos:", erro);
            }
        }


        // Compatibilidade com a chave antiga
        const produtosAntigos = localStorage.getItem(PRODUTOS_KEY_ANTIGO);

        if (produtosAntigos) {
            try {

                const produtosConvertidos = JSON.parse(produtosAntigos);

                localStorage.setItem(
                    PRODUTOS_KEY,
                    JSON.stringify(produtosConvertidos)
                );

                return produtosConvertidos;

            } catch (erro) {
                console.error("Erro ao migrar produtos antigos:", erro);
            }
        }


        // Caso ainda não exista nenhum produto
        localStorage.setItem(
            PRODUTOS_KEY,
            JSON.stringify(produtosPadrao)
        );

        return produtosPadrao;
    }


    function salvarProdutos(produtos) {

        localStorage.setItem(
            PRODUTOS_KEY,
            JSON.stringify(produtos)
        );

        // Permite que outras páginas saibam que os produtos mudaram
        window.dispatchEvent(
            new CustomEvent("novaProdutosAtualizados", {
                detail: produtos
            })
        );
    }


    // Inicializa os produtos
    let produtos = obterProdutos();


    // =========================================================
    // PEDIDOS
    // =========================================================

    function obterPedidos() {

        let pedidos = [];

        const pedidosSalvos = localStorage.getItem(PEDIDOS_KEY);

        if (pedidosSalvos) {

            try {
                pedidos = JSON.parse(pedidosSalvos);

                if (!Array.isArray(pedidos)) {
                    pedidos = [];
                }

            } catch (erro) {
                console.error("Erro ao ler pedidos:", erro);
                pedidos = [];
            }
        }


        // Recupera também o pedido mais recente
        const pedidoAtual = localStorage.getItem(PEDIDO_KEY);

        if (pedidoAtual) {

            try {

                const pedido = JSON.parse(pedidoAtual);

                if (
                    pedido &&
                    pedido.id &&
                    !pedidos.some(item => item.id === pedido.id)
                ) {
                    pedidos.push(pedido);
                }

            } catch (erro) {
                console.error("Erro ao ler pedido atual:", erro);
            }
        }


        localStorage.setItem(
            PEDIDOS_KEY,
            JSON.stringify(pedidos)
        );

        return pedidos;
    }


    const pedidos = obterPedidos();


    // =========================================================
    // ELEMENTOS DO DASHBOARD
    // =========================================================

    const receitaElement = document.querySelector(
        ".stat-card:nth-child(1) .stat-value"
    );

    const pedidosElement = document.querySelector(
        ".stat-card:nth-child(2) .stat-value"
    );

    const produtosElement = document.querySelector(
        ".stat-card:nth-child(3) .stat-value"
    );

    const clientesElement = document.querySelector(
        ".stat-card:nth-child(4) .stat-value"
    );


    // =========================================================
    // CALCULAR RECEITA
    // =========================================================

    function calcularReceita() {

        return pedidos.reduce((total, pedido) => {

            const status = String(
                pedido.status || ""
            ).toLowerCase();

            if (status === "cancelado") {
                return total;
            }

            return total + Number(pedido.total || 0);

        }, 0);
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
    // ATUALIZAR ESTATÍSTICAS
    // =========================================================

    function atualizarEstatisticas() {

        const receita = calcularReceita();

        if (receitaElement) {
            receitaElement.textContent =
                formatarPreco(receita);
        }

        if (pedidosElement) {
            pedidosElement.textContent =
                pedidos.length;
        }

        if (produtosElement) {
            produtosElement.textContent =
                produtos.length;
        }


        // Clientes únicos
        const clientes = new Set();

        pedidos.forEach(pedido => {

            if (
                pedido.cliente &&
                pedido.cliente.email
            ) {
                clientes.add(
                    pedido.cliente.email
                );
            }

        });

        if (clientesElement) {
            clientesElement.textContent =
                clientes.size;
        }
    }


    // =========================================================
    // PEDIDOS RECENTES
    // =========================================================

    function atualizarPedidosRecentes() {

        const container =
            document.querySelector(".orders-table");

        if (!container) return;


        const pedidosOrdenados = [...pedidos]
            .sort((a, b) => {

                const dataA =
                    new Date(
                        a.criadoEm || a.data || 0
                    );

                const dataB =
                    new Date(
                        b.criadoEm || b.data || 0
                    );

                return dataB - dataA;
            })
            .slice(0, 5);


        const linhas =
            container.querySelectorAll(
                ".order-row"
            );


        linhas.forEach(linha => linha.remove());


        pedidosOrdenados.forEach(pedido => {

            const linha =
                document.createElement("div");

            linha.className = "order-row";

            const cliente =
                pedido.cliente?.nome ||
                "Cliente";

            const total =
                formatarPreco(pedido.total);


            const status =
                String(
                    pedido.status || "pending"
                ).toLowerCase();


            let statusTexto = "Pendente";

            if (status === "processing") {
                statusTexto = "Processando";
            }

            if (status === "shipped") {
                statusTexto = "Enviado";
            }

            if (status === "delivered") {
                statusTexto = "Entregue";
            }

            if (status === "cancelled" ||
                status === "canceled") {
                statusTexto = "Cancelado";
            }


            const idPedido =
                String(
                    pedido.id || ""
                ).replace(/^#+/, "");


            linha.innerHTML = `
                <div class="order-id">
                    #${idPedido}
                </div>

                <div class="order-client">
                    ${cliente}
                </div>

                <div class="order-total">
                    ${total}
                </div>

                <div class="order-status ${status}">
                    ${statusTexto}
                </div>
            `;


            container.appendChild(linha);
        });
    }


    // =========================================================
    // GRÁFICO
    // =========================================================

    function atualizarGrafico() {

        const barras =
            document.querySelectorAll(
                ".chart-bars .chart-bar"
            );

        if (!barras.length) return;


        const agora = new Date();

        const valores = [];


        for (let i = 6; i >= 0; i--) {

            const data = new Date(agora);

            data.setDate(
                agora.getDate() - i
            );


            const dia = data
                .toISOString()
                .split("T")[0];


            let valor = 0;


            pedidos.forEach(pedido => {

                const dataPedido =
                    pedido.criadoEm ||
                    pedido.data;

                if (!dataPedido) return;


                const dataPedidoFormatada =
                    new Date(dataPedido)
                        .toISOString()
                        .split("T")[0];


                if (
                    dataPedidoFormatada === dia
                ) {
                    valor +=
                        Number(
                            pedido.total || 0
                        );
                }
            });


            valores.push(valor);
        }


        const maiorValor =
            Math.max(...valores, 1);


        barras.forEach((barra, index) => {

            const valor =
                valores[index] || 0;

            const porcentagem =
                (valor / maiorValor) * 100;

            barra.style.height =
                `${Math.max(
                    porcentagem,
                    4
                )}%`;
        });
    }


    // =========================================================
    // BOTÃO NOVO PRODUTO
    // =========================================================

    const novoProduto =
        document.querySelector(
            ".shortcut-card:nth-child(1)"
        );

    if (novoProduto) {

        novoProduto.addEventListener(
            "click",
            () => {

                window.location.href =
                    "produtos.html";
            }
        );
    }


    // =========================================================
    // BOTÃO PEDIDOS
    // =========================================================

    const atalhoPedidos =
        document.querySelector(
            ".shortcut-card:nth-child(2)"
        );

    if (atalhoPedidos) {

        atalhoPedidos.addEventListener(
            "click",
            () => {

                window.location.href =
                    "pedidos.html";
            }
        );
    }


    // =========================================================
    // BOTÃO ESTOQUE
    // =========================================================

    const atalhoEstoque =
        document.querySelector(
            ".shortcut-card:nth-child(3)"
        );

    if (atalhoEstoque) {

        atalhoEstoque.addEventListener(
            "click",
            () => {

                window.location.href =
                    "produtos.html";
            }
        );
    }


    // =========================================================
    // MENU MOBILE
    // =========================================================

    const sidebarToggle =
        document.querySelector(
            ".sidebar-toggle"
        );

    const sidebar =
        document.querySelector(
            ".admin-sidebar"
        );


    if (
        sidebarToggle &&
        sidebar
    ) {

        sidebarToggle.addEventListener(
            "click",
            () => {

                sidebar.classList.toggle(
                    "active"
                );
            }
        );
    }


    // =========================================================
    // NOTIFICAÇÃO
    // =========================================================

    const notification =
        document.querySelector(
            ".admin-notification"
        );


    if (notification) {

        notification.addEventListener(
            "click",
            () => {

                notification.classList.toggle(
                    "active"
                );
            }
        );
    }


    // =========================================================
    // SELETOR DO GRÁFICO
    // =========================================================

    const chartSelect =
        document.querySelector(
            ".chart-header select"
        );


    if (chartSelect) {

        chartSelect.addEventListener(
            "change",
            () => {

                atualizarGrafico();
            }
        );
    }


    // =========================================================
    // ESCUTAR ALTERAÇÕES NOS PRODUTOS
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

                atualizarEstatisticas();
            }
        }
    );


    // =========================================================
    // INICIALIZAÇÃO
    // =========================================================

    atualizarEstatisticas();
    atualizarPedidosRecentes();
    atualizarGrafico();

});