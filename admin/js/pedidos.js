
document.addEventListener("DOMContentLoaded", () => {
    // =========================================================
    // CONFIGURAÇÕES
    // =========================================================

    const PEDIDOS_KEY = "novaPedidos";
    const PEDIDO_KEY = "novaPedido";
    const PEDIDOS_POR_PAGINA = 5;

    let pedidos = [];
    let pedidosFiltrados = [];
    let paginaAtual = 1;

    const STATUS_VALIDOS = [
        "Pendente",
        "Processando",
        "Enviado",
        "Entregue",
        "Cancelado"
    ];

    // =========================================================
    // ELEMENTOS
    // =========================================================

    const tabela = document.querySelector(".pedidos-table tbody");
    const campoBusca = document.querySelector(".pedido-search input");

    const filtroStatus = document.querySelector(
        ".pedidos-filters select:nth-of-type(1)"
    );

    const filtroData = document.querySelector(
        ".pedidos-filters select:nth-of-type(2)"
    );

    const botaoFiltrar = document.querySelector(".pedido-filter-button");
    const paginacao = document.querySelector(".pagination-buttons");
    const textoEncontrados = document.querySelector(".pedidos-table-header p");

    // =========================================================
    // UTILITÁRIOS
    // =========================================================

    function normalizarIdPedido(id) {
        return String(id || "").trim().replace(/^#+/, "");
    }

    function escaparHTML(valor) {
        return String(valor ?? "").replace(/[&<>"']/g, caractere => ({
            "&": "&amp;",
            "<": "&lt;",
            ">": "&gt;",
            '"': "&quot;",
            "'": "&#39;"
        })[caractere]);
    }

    function formatarPreco(valor) {
        const numero = Number(valor);

        return (Number.isFinite(numero) ? numero : 0).toLocaleString(
            "pt-BR",
            {
                style: "currency",
                currency: "BRL"
            }
        );
    }

    function formatarData(data) {
        if (!data) {
            return { data: "-", hora: "" };
        }

        const dataObj = new Date(data);

        if (Number.isNaN(dataObj.getTime())) {
            return { data: "-", hora: "" };
        }

        return {
            data: dataObj.toLocaleDateString("pt-BR", {
                day: "2-digit",
                month: "short",
                year: "numeric"
            }),
            hora: dataObj.toLocaleTimeString("pt-BR", {
                hour: "2-digit",
                minute: "2-digit"
            })
        };
    }

    function obterNomeCliente(pedido) {
        return pedido.cliente?.nome ||
            pedido.nome ||
            "Cliente não informado";
    }

    function obterEmailCliente(pedido) {
        return pedido.cliente?.email ||
            pedido.email ||
            "";
    }

    function obterItens(pedido) {
        if (Array.isArray(pedido.itens)) {
            return pedido.itens;
        }

        if (Array.isArray(pedido.produtos)) {
            return pedido.produtos;
        }

        return [];
    }

    function quantidadeProdutos(pedido) {
        return obterItens(pedido).reduce((total, item) => {
            const quantidade = Number(item.quantidade || 1);
            return total + (
                Number.isFinite(quantidade) && quantidade > 0
                    ? quantidade
                    : 1
            );
        }, 0);
    }

    // =========================================================
    // STATUS
    // =========================================================

    function normalizarStatus(status) {
        const valor = String(status || "Pendente")
            .trim()
            .toLowerCase();

        const mapa = {
            pending: "Pendente",
            pendente: "Pendente",

            processing: "Processando",
            processando: "Processando",

            shipped: "Enviado",
            enviado: "Enviado",

            delivered: "Entregue",
            entregue: "Entregue",

            cancelled: "Cancelado",
            canceled: "Cancelado",
            cancelado: "Cancelado"
        };

        return mapa[valor] || "Pendente";
    }

    function classeStatus(status) {
        const mapa = {
            Pendente: "pendente",
            Processando: "processando",
            Enviado: "enviado",
            Entregue: "entregue",
            Cancelado: "cancelado"
        };

        return mapa[normalizarStatus(status)] || "pendente";
    }

    function obterStatusValido(valor) {
        const procurado = String(valor || "").trim().toLowerCase();

        return STATUS_VALIDOS.find(
            status => status.toLowerCase() === procurado
        ) || null;
    }

    // =========================================================
    // ARMAZENAMENTO
    // =========================================================

    function lerPedidosSalvos() {
        try {
            const dados = JSON.parse(
                localStorage.getItem(PEDIDOS_KEY) || "[]"
            );

            return Array.isArray(dados) ? dados : [];
        } catch (erro) {
            console.error("Erro ao ler novaPedidos:", erro);
            return [];
        }
    }

    function lerPedidoAtual() {
        try {
            const dados = localStorage.getItem(PEDIDO_KEY);
            return dados ? JSON.parse(dados) : null;
        } catch (erro) {
            console.error("Erro ao ler novaPedido:", erro);
            return null;
        }
    }

    function obterPedidos() {
        const salvos = lerPedidosSalvos();
        const pedidoAtual = lerPedidoAtual();

        // Normaliza os pedidos sem apagar os dados originais.
        const mapa = new Map();

        salvos.forEach(pedido => {
            if (!pedido || !pedido.id) return;

            const id = normalizarIdPedido(pedido.id);

            mapa.set(id, {
                ...pedido,
                id,
                status: normalizarStatus(pedido.status)
            });
        });

        // Compatibilidade com instalações que salvam
        // o pedido mais recente somente em novaPedido.
        if (pedidoAtual && pedidoAtual.id) {
            const id = normalizarIdPedido(pedidoAtual.id);

            if (!mapa.has(id)) {
                mapa.set(id, {
                    ...pedidoAtual,
                    id,
                    status: normalizarStatus(pedidoAtual.status)
                });
            }
        }

        return Array.from(mapa.values());
    }

    function salvarPedidos() {
        try {
            localStorage.setItem(
                PEDIDOS_KEY,
                JSON.stringify(pedidos)
            );

            // Atualiza também o pedido individual, caso seja
            // o mesmo que acabou de ser alterado no painel.
            const pedidoAtual = lerPedidoAtual();

            if (pedidoAtual?.id) {
                const idAtual = normalizarIdPedido(pedidoAtual.id);

                const pedidoAtualizado = pedidos.find(
                    pedido => normalizarIdPedido(pedido.id) === idAtual
                );

                if (pedidoAtualizado) {
                    localStorage.setItem(
                        PEDIDO_KEY,
                        JSON.stringify(pedidoAtualizado)
                    );
                }
            }

            window.dispatchEvent(
                new CustomEvent("novaPedidosAtualizados", {
                    detail: pedidos
                })
            );

            return true;
        } catch (erro) {
            console.error("Erro ao salvar os pedidos:", erro);
            alert(
                "Não foi possível salvar a alteração. " +
                "Verifique o armazenamento do navegador."
            );

            return false;
        }
    }

    // =========================================================
    // ESTATÍSTICAS
    // =========================================================

    function atualizarEstatisticas() {
        const cards = document.querySelectorAll(
            ".pedido-stat-card strong"
        );

        if (!cards.length) return;

        const total = pedidos.length;

        const pendentes = pedidos.filter(
            pedido => normalizarStatus(pedido.status) === "Pendente"
        ).length;

        const processando = pedidos.filter(
            pedido => normalizarStatus(pedido.status) === "Processando"
        ).length;

        const entregues = pedidos.filter(
            pedido => normalizarStatus(pedido.status) === "Entregue"
        ).length;

        if (cards[0]) cards[0].textContent = total;
        if (cards[1]) cards[1].textContent = pendentes;
        if (cards[2]) cards[2].textContent = processando;
        if (cards[3]) cards[3].textContent = entregues;
    }

    // =========================================================
    // PAGINAÇÃO
    // =========================================================

    function atualizarPaginacao() {
        if (!paginacao) return;

        const totalPaginas = Math.max(
            1,
            Math.ceil(pedidosFiltrados.length / PEDIDOS_POR_PAGINA)
        );

        // Mantém a página dentro do intervalo válido.
        paginaAtual = Math.min(paginaAtual, totalPaginas);
        paginacao.innerHTML = "";

        const anterior = document.createElement("button");
        anterior.type = "button";
        anterior.innerHTML = '<i class="fa-solid fa-chevron-left"></i>';
        anterior.disabled = paginaAtual <= 1;

        anterior.addEventListener("click", () => {
            if (paginaAtual > 1) {
                paginaAtual--;
                renderizarPedidos();
            }
        });

        paginacao.appendChild(anterior);

        for (let i = 1; i <= totalPaginas; i++) {
            const botao = document.createElement("button");
            botao.type = "button";
            botao.textContent = i;

            if (i === paginaAtual) {
                botao.classList.add("active");
            }

            botao.addEventListener("click", () => {
                paginaAtual = i;
                renderizarPedidos();
            });

            paginacao.appendChild(botao);
        }

        const proximo = document.createElement("button");
        proximo.type = "button";
        proximo.innerHTML = '<i class="fa-solid fa-chevron-right"></i>';
        proximo.disabled = paginaAtual >= totalPaginas;

        proximo.addEventListener("click", () => {
            if (paginaAtual < totalPaginas) {
                paginaAtual++;
                renderizarPedidos();
            }
        });

        paginacao.appendChild(proximo);
    }

    // =========================================================
    // RENDERIZAR PEDIDOS
    // =========================================================

    function renderizarPedidos() {
        if (!tabela) return;

        tabela.innerHTML = "";

        if (!pedidosFiltrados.length) {
            tabela.innerHTML = `
                <tr>
                    <td colspan="7" style="
                        text-align: center;
                        padding: 50px 20px;
                        color: #8b8f9a;
                    ">
                        <i class="fa-solid fa-box-open" style="
                            font-size: 32px;
                            margin-bottom: 15px;
                            display: block;
                        "></i>
                        Nenhum pedido encontrado.
                    </td>
                </tr>
            `;

            if (textoEncontrados) {
                textoEncontrados.textContent = "0 pedidos encontrados";
            }

            atualizarPaginacao();
            return;
        }

        const inicio = (paginaAtual - 1) * PEDIDOS_POR_PAGINA;
        const pedidosPagina = pedidosFiltrados.slice(
            inicio,
            inicio + PEDIDOS_POR_PAGINA
        );

        pedidosPagina.forEach(pedido => {
            const data = formatarData(
                pedido.criadoEm || pedido.data
            );

            const nome = escaparHTML(obterNomeCliente(pedido));
            const email = escaparHTML(obterEmailCliente(pedido));
            const id = escaparHTML(normalizarIdPedido(pedido.id));
            const quantidade = quantidadeProdutos(pedido);

            const valorTotal = Number(
                pedido.total ?? pedido.subtotal ?? 0
            );

            const total = Number.isFinite(valorTotal) ? valorTotal : 0;
            const status = normalizarStatus(pedido.status);
            const classe = classeStatus(status);

            const tr = document.createElement("tr");

            tr.innerHTML = `
                <td>
                    <strong class="pedido-id">#${id}</strong>
                </td>

                <td>
                    <div class="cliente-info">
                        <strong>${nome}</strong>
                        <span>${email}</span>
                    </div>
                </td>

                <td>
                    <div class="pedido-date">
                        <span>${escaparHTML(data.data)}</span>
                        <small>${escaparHTML(data.hora)}</small>
                    </div>
                </td>

                <td>
                    <span class="produtos-count">
                        ${quantidade}
                        ${quantidade === 1 ? "produto" : "produtos"}
                    </span>
                </td>

                <td>
                    <strong class="pedido-total">
                        ${formatarPreco(total)}
                    </strong>
                </td>

                <td>
                    <span class="pedido-status ${classe}">
                        <span></span>
                        ${status}
                    </span>
                </td>

                <td>
                    <div class="pedido-actions">
                        <button
                            type="button"
                            class="view-order"
                            data-id="${id}"
                            title="Visualizar pedido"
                            aria-label="Visualizar pedido ${id}"
                        >
                            <i class="fa-regular fa-eye"></i>
                        </button>

                        <button
                            type="button"
                            class="order-menu"
                            data-id="${id}"
                            title="Alterar status"
                            aria-label="Alterar status do pedido ${id}"
                        >
                            <i class="fa-solid fa-ellipsis"></i>
                        </button>
                    </div>
                </td>
            `;

            tabela.appendChild(tr);
        });

        if (textoEncontrados) {
            const quantidade = pedidosFiltrados.length;

            textoEncontrados.textContent =
                `${quantidade} ${quantidade === 1 ? "pedido encontrado" : "pedidos encontrados"}`;
        }

        atualizarPaginacao();
    }

    // =========================================================
    // FILTRO DE DATA
    // =========================================================

    function correspondeFiltroData(pedido, filtro) {
        const dataPedido = new Date(
            pedido.criadoEm || pedido.data
        );

        if (Number.isNaN(dataPedido.getTime())) {
            return false;
        }

        const agora = new Date();

        const inicioHoje = new Date(
            agora.getFullYear(),
            agora.getMonth(),
            agora.getDate()
        );

        const inicioAmanha = new Date(inicioHoje);
        inicioAmanha.setDate(inicioAmanha.getDate() + 1);

        const valor = String(filtro).toLowerCase();

        if (valor === "hoje") {
            return dataPedido >= inicioHoje &&
                dataPedido < inicioAmanha;
        }

        if (valor.includes("7")) {
            const limite = new Date(agora);
            limite.setDate(limite.getDate() - 7);

            return dataPedido >= limite && dataPedido <= agora;
        }

        if (valor.includes("30")) {
            const limite = new Date(agora);
            limite.setDate(limite.getDate() - 30);

            return dataPedido >= limite && dataPedido <= agora;
        }

        if (valor.includes("mês") || valor.includes("mes")) {
            return dataPedido.getMonth() === agora.getMonth() &&
                dataPedido.getFullYear() === agora.getFullYear();
        }

        return true;
    }

    // =========================================================
    // APLICAR FILTROS
    // =========================================================

    function aplicarFiltros() {
        const busca = campoBusca
            ? campoBusca.value.toLowerCase().trim()
            : "";

        const statusSelecionado = filtroStatus
            ? filtroStatus.value
            : "";

        const dataSelecionada = filtroData
            ? filtroData.value
            : "";

        pedidosFiltrados = pedidos.filter(pedido => {
            const id = normalizarIdPedido(pedido.id).toLowerCase();
            const nome = obterNomeCliente(pedido).toLowerCase();
            const email = obterEmailCliente(pedido).toLowerCase();

            const correspondeBusca = !busca ||
                id.includes(busca) ||
                nome.toLowerCase().includes(busca) ||
                email.toLowerCase().includes(busca);

            if (!correspondeBusca) return false;

            if (
                statusSelecionado &&
                !["todos", "todas"].includes(statusSelecionado.toLowerCase())
            ) {
                if (
                    normalizarStatus(pedido.status).toLowerCase() !==
                    statusSelecionado.toLowerCase()
                ) {
                    return false;
                }
            }

            if (
                dataSelecionada &&
                !["todas", "todos"].includes(dataSelecionada.toLowerCase())
            ) {
                if (!correspondeFiltroData(pedido, dataSelecionada)) {
                    return false;
                }
            }

            return true;
        });

        paginaAtual = 1;
        renderizarPedidos();
        atualizarEstatisticas();
    }

    // =========================================================
    // VISUALIZAR PEDIDO
    // =========================================================

    function visualizarPedido(id) {
        const pedido = pedidos.find(
            item => normalizarIdPedido(item.id) === normalizarIdPedido(id)
        );

        if (!pedido) {
            alert("Pedido não encontrado.");
            return;
        }

        const itens = obterItens(pedido);

        const produtosTexto = itens.length
            ? itens.map(item => {
                const nome = item.nome || item.nomeProduto || "Produto";
                const quantidade = Number(item.quantidade || 1);
                const tamanho = item.tamanho
                    ? ` | Tamanho: ${item.tamanho}`
                    : "";
                const cor = item.cor
                    ? ` | Cor: ${item.cor}`
                    : "";
                const preco = item.preco != null
                    ? ` | ${formatarPreco(item.preco)}`
                    : "";

                return `• ${nome} x${quantidade}${tamanho}${cor}${preco}`;
            }).join("\n")
            : "Nenhum produto informado";

        const endereco = pedido.endereco || {};

        const enderecoTexto = [
            endereco.rua || endereco.logradouro,
            endereco.numero,
            endereco.complemento,
            endereco.bairro,
            endereco.cidade,
            endereco.estado,
            endereco.cep ? `CEP: ${endereco.cep}` : ""
        ].filter(Boolean).join(", ") || "Endereço não informado";

        const data = formatarData(pedido.criadoEm || pedido.data);

        const mensagem =
            `PEDIDO #${normalizarIdPedido(pedido.id)}\n\n` +
            `Cliente: ${obterNomeCliente(pedido)}\n` +
            `E-mail: ${obterEmailCliente(pedido) || "Não informado"}\n` +
            `Data: ${data.data} ${data.hora}\n\n` +
            `ENDEREÇO DE ENTREGA\n${enderecoTexto}\n\n` +
            `PRODUTOS\n${produtosTexto}\n\n` +
            `Pagamento: ${pedido.pagamento || "Não informado"}\n` +
            `Subtotal: ${formatarPreco(pedido.subtotal ?? pedido.total ?? 0)}\n` +
            `Frete: ${formatarPreco(pedido.frete ?? 0)}\n` +
            `Total: ${formatarPreco(pedido.total ?? pedido.subtotal ?? 0)}\n\n` +
            `Status: ${normalizarStatus(pedido.status)}`;

        alert(mensagem);
    }

    // =========================================================
    // ALTERAR STATUS
    // =========================================================

    function alterarStatus(id) {
        const indice = pedidos.findIndex(
            item => normalizarIdPedido(item.id) === normalizarIdPedido(id)
        );

        if (indice === -1) {
            alert("Pedido não encontrado.");
            return;
        }

        const pedido = pedidos[indice];

        const novoStatus = prompt(
            "Digite um dos status abaixo:\n\n" +
            "Pendente\n" +
            "Processando\n" +
            "Enviado\n" +
            "Entregue\n" +
            "Cancelado\n\n" +
            "Status atual: " + normalizarStatus(pedido.status),
            normalizarStatus(pedido.status)
        );

        if (novoStatus === null) return;

        const statusValidado = obterStatusValido(novoStatus);

        if (!statusValidado) {
            alert(
                "Status inválido.\n\n" +
                "Use: Pendente, Processando, Enviado, Entregue ou Cancelado."
            );
            return;
        }

        if (statusValidado === normalizarStatus(pedido.status)) {
            return;
        }

        const statusAnterior = pedido.status;
        pedido.status = statusValidado;

        if (!salvarPedidos()) {
            // Restaura na memória se o armazenamento falhar.
            pedido.status = statusAnterior;
            return;
        }

        aplicarFiltros();
        atualizarEstatisticas();
    }

    // =========================================================
    // CLIQUES NA TABELA
    // =========================================================

    if (tabela) {
        tabela.addEventListener("click", event => {
            const visualizar = event.target.closest(".view-order");

            if (visualizar) {
                visualizarPedido(visualizar.dataset.id);
                return;
            }

            const menu = event.target.closest(".order-menu");

            if (menu) {
                alterarStatus(menu.dataset.id);
            }
        });
    }

    // =========================================================
    // EVENTOS DE BUSCA E FILTROS
    // =========================================================

    if (campoBusca) {
        campoBusca.addEventListener("input", aplicarFiltros);
    }

    if (botaoFiltrar) {
        botaoFiltrar.addEventListener("click", aplicarFiltros);
    }

    if (filtroStatus) {
        filtroStatus.addEventListener("change", aplicarFiltros);
    }

    if (filtroData) {
        filtroData.addEventListener("change", aplicarFiltros);
    }

    // =========================================================
    // SINCRONIZAÇÃO
    // =========================================================

    function atualizarPedidos() {
        pedidos = obterPedidos();
        aplicarFiltros();
        atualizarEstatisticas();
    }

    // Alterações feitas em outra aba do mesmo site.
    window.addEventListener("storage", event => {
        if (event.key === PEDIDOS_KEY || event.key === PEDIDO_KEY) {
            atualizarPedidos();
        }
    });

    // Alterações feitas por outros scripts na mesma página.
    window.addEventListener("novaPedidosAtualizados", () => {
        atualizarPedidos();
    });

    // Atualiza quando o usuário volta à página do ADM.
    document.addEventListener("visibilitychange", () => {
        if (document.visibilityState === "visible") {
            atualizarPedidos();
        }
    });

    // Verifica periodicamente novos pedidos sem regravar
    // o localStorage a cada verificação.
    setInterval(() => {
        const novosPedidos = obterPedidos();

        if (JSON.stringify(novosPedidos) !== JSON.stringify(pedidos)) {
            pedidos = novosPedidos;
            aplicarFiltros();
            atualizarEstatisticas();
        }
    }, 2000);

    // =========================================================
    // INICIALIZAÇÃO
    // =========================================================

    pedidos = obterPedidos();
    pedidosFiltrados = [...pedidos];

    atualizarEstatisticas();
    renderizarPedidos();

    console.log("NØVA ADM — Pedidos carregados:", pedidos);
});