
document.addEventListener("DOMContentLoaded", async () => {
    "use strict";

    // =========================================================
    // CONFIGURAÇÕES
    // =========================================================

    const TABELA_PEDIDOS = "pedidos_nova";
    const PEDIDOS_POR_PAGINA = 5;

    const STATUS_VALIDOS = [
        "Pendente",
        "Processando",
        "Enviado",
        "Entregue",
        "Cancelado"
    ];

    const supabase = window.supabaseClient;

    let pedidos = [];
    let pedidosFiltrados = [];
    let paginaAtual = 1;
    let carregando = false;
    let salvandoStatus = false;

    // =========================================================
    // ELEMENTOS HTML
    // =========================================================

    const tabela = document.getElementById("orders-table-body");
    const campoBusca = document.getElementById("order-search");
    const filtroStatus = document.getElementById("order-status-filter");
    const filtroData = document.getElementById("order-date-filter");

    const botaoFiltrar = document.getElementById("order-filter-button");
    const botaoLimpar = document.getElementById("order-clear-filters");

    const textoEncontrados = document.getElementById("orders-results-count");
    const textoPaginacao = document.getElementById("orders-pagination-info");
    const paginacao = document.getElementById("orders-pagination-buttons");

    const botaoAnterior = document.getElementById("orders-prev-page");
    const botaoProximo = document.getElementById("orders-next-page");
    const paginaAtualElemento = document.getElementById("orders-current-page");

    const estadoVazio = document.getElementById("orders-empty");
    const estadoCarregamento = document.getElementById("orders-loading");
    const estadoErro = document.getElementById("orders-error");
    const mensagemErro = document.getElementById("orders-error-message");
    const botaoTentarNovamente = document.getElementById("orders-retry-button");

    const estatisticas = {
        total: document.getElementById("orders-total"),
        pendentes: document.getElementById("orders-pending"),
        enviados: document.getElementById("orders-shipped"),
        cancelados: document.getElementById("orders-cancelled")
    };

    // =========================================================
    // UTILITÁRIOS
    // =========================================================

    function escaparHTML(valor) {
        return String(valor ?? "").replace(/[&<>"']/g, caractere => ({
            "&": "&amp;",
            "<": "&lt;",
            ">": "&gt;",
            '"': "&quot;",
            "'": "&#39;"
        })[caractere]);
    }

    function normalizarIdPedido(id) {
        return String(id ?? "").trim().replace(/^#+/, "");
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

    function obterDataPedido(pedido) {
        return pedido.criado_em ||
            pedido.criadoEm ||
            pedido.created_at ||
            pedido.data ||
            null;
    }

    function formatarData(valor) {
        if (!valor) return { data: "—", hora: "" };

        const data = new Date(valor);

        if (Number.isNaN(data.getTime())) {
            return { data: "—", hora: "" };
        }

        return {
            data: data.toLocaleDateString("pt-BR"),
            hora: data.toLocaleTimeString("pt-BR", {
                hour: "2-digit",
                minute: "2-digit"
            })
        };
    }

    function obterNomeCliente(pedido) {
        const cliente = pedido.cliente || {};

        return cliente.nome ||
            cliente.name ||
            pedido.nomeCliente ||
            pedido.customer_name ||
            "Cliente não informado";
    }

    function obterEmailCliente(pedido) {
        const cliente = pedido.cliente || {};

        return cliente.email ||
            pedido.email ||
            pedido.customer_email ||
            "";
    }

    function obterItens(pedido) {
        if (Array.isArray(pedido.itens)) return pedido.itens;
        if (Array.isArray(pedido.produtos)) return pedido.produtos;
        if (Array.isArray(pedido.items)) return pedido.items;

        return [];
    }

    function quantidadeProdutos(pedido) {
        return obterItens(pedido).reduce((total, item) => {
            const quantidade = Number(item.quantidade ?? item.quantity ?? 1);

            return total + (
                Number.isFinite(quantidade) && quantidade > 0
                    ? quantidade
                    : 1
            );
        }, 0);
    }

    function obterTotalPedido(pedido) {
        const total = Number(
            pedido.total ??
            pedido.valorTotal ??
            pedido.total_amount ??
            pedido.subtotal ??
            0
        );

        return Number.isFinite(total) ? total : 0;
    }

    // =========================================================
    // STATUS
    // =========================================================

    function normalizarStatus(status) {
        const valor = String(status || "Pendente").trim().toLowerCase();

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
            cancelado: "Cancelado",
            cancelada: "Cancelado"
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

    function validarStatus(valor) {
        const procurado = String(valor || "").trim().toLowerCase();

        return STATUS_VALIDOS.find(
            status => status.toLowerCase() === procurado
        ) || null;
    }

    // =========================================================
    // ESTADOS DA INTERFACE
    // =========================================================

    function mostrarCarregamento(mostrar) {
        if (estadoCarregamento) {
            estadoCarregamento.hidden = !mostrar;
        }
    }

    function mostrarErro(mensagem = "") {
        if (estadoErro) estadoErro.hidden = !mensagem;
        if (mensagemErro) mensagemErro.textContent = mensagem;
    }

    function mostrarVazio(mostrar) {
        if (estadoVazio) estadoVazio.hidden = !mostrar;
    }

    // =========================================================
    // AUTENTICAÇÃO
    // =========================================================

    async function verificarAcessoAdmin() {
        if (!supabase || typeof window.verificarAdmin !== "function") {
            console.error(
                "Supabase ou verificarAdmin() não está disponível. " +
                "Confira a ordem dos scripts no HTML."
            );

            mostrarErro("Não foi possível verificar a sessão administrativa.");
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
            console.error("Erro ao verificar o administrador:", erro);
            window.location.replace("login.html");
            return false;
        }
    }

    // =========================================================
    // CARREGAR PEDIDOS DO SUPABASE
    // =========================================================

    async function buscarPedidosSupabase() {
        let resultado = await supabase
            .from(TABELA_PEDIDOS)
            .select("*")
            .order("criado_em", { ascending: false });

        // Compatibilidade com registros ordenados por created_at.
        if (resultado.error) {
            resultado = await supabase
                .from(TABELA_PEDIDOS)
                .select("*")
                .order("created_at", { ascending: false });
        }

        if (resultado.error) {
            throw resultado.error;
        }

        pedidos = (resultado.data || []).map(pedido => ({
            ...pedido,
            id: normalizarIdPedido(pedido.id),
            status: normalizarStatus(pedido.status)
        }));

        pedidos.sort((a, b) => {
            const dataA = new Date(obterDataPedido(a) || 0).getTime();
            const dataB = new Date(obterDataPedido(b) || 0).getTime();

            return dataB - dataA;
        });
    }

    async function carregarPedidos() {
        if (carregando) return;

        carregando = true;
        mostrarCarregamento(true);
        mostrarErro("");

        try {
            await buscarPedidosSupabase();

            aplicarFiltros();
            atualizarEstatisticas();
        } catch (erro) {
            console.error("Erro ao carregar pedidos do Supabase:", erro);

            pedidos = [];
            pedidosFiltrados = [];

            if (tabela) tabela.replaceChildren();

            mostrarVazio(false);
            mostrarErro(
                "Não foi possível carregar os pedidos. " +
                "Verifique sua conexão, o login e as políticas RLS do Supabase."
            );

            atualizarEstatisticas();
            atualizarPaginacao();
        } finally {
            mostrarCarregamento(false);
            carregando = false;
        }
    }

    // =========================================================
    // ESTATÍSTICAS
    // =========================================================

    function atualizarEstatisticas() {
        if (estatisticas.total) {
            estatisticas.total.textContent = pedidos.length;
        }

        if (estatisticas.pendentes) {
            estatisticas.pendentes.textContent = pedidos.filter(
                pedido => pedido.status === "Pendente"
            ).length;
        }

        if (estatisticas.enviados) {
            estatisticas.enviados.textContent = pedidos.filter(
                pedido => pedido.status === "Enviado"
            ).length;
        }

        if (estatisticas.cancelados) {
            estatisticas.cancelados.textContent = pedidos.filter(
                pedido => pedido.status === "Cancelado"
            ).length;
        }
    }

    // =========================================================
    // PAGINAÇÃO
    // =========================================================

    function obterTotalPaginas() {
        return Math.max(
            1,
            Math.ceil(pedidosFiltrados.length / PEDIDOS_POR_PAGINA)
        );
    }

    function atualizarPaginacao() {
        const total = pedidosFiltrados.length;
        const totalPaginas = obterTotalPaginas();

        paginaAtual = Math.min(Math.max(1, paginaAtual), totalPaginas);

        const inicio = total === 0
            ? 0
            : (paginaAtual - 1) * PEDIDOS_POR_PAGINA + 1;

        const fim = Math.min(
            paginaAtual * PEDIDOS_POR_PAGINA,
            total
        );

        if (textoPaginacao) {
            textoPaginacao.textContent = total === 0
                ? "Mostrando 0 de 0 pedidos"
                : `Mostrando ${inicio}–${fim} de ${total} pedidos`;
        }

        if (paginaAtualElemento) {
            paginaAtualElemento.textContent = paginaAtual;
        }

        if (botaoAnterior) {
            botaoAnterior.disabled = paginaAtual <= 1;
        }

        if (botaoProximo) {
            botaoProximo.disabled = paginaAtual >= totalPaginas;
        }

        if (!paginacao) return;

        paginacao.replaceChildren();

        const limite = 5;
        let primeiro = Math.max(1, paginaAtual - 2);
        let ultimo = Math.min(totalPaginas, primeiro + limite - 1);

        if (ultimo - primeiro < limite - 1) {
            primeiro = Math.max(1, ultimo - limite + 1);
        }

        for (let numero = primeiro; numero <= ultimo; numero++) {
            const botao = document.createElement("button");

            botao.type = "button";
            botao.textContent = numero;
            botao.className = numero === paginaAtual ? "active" : "";
            botao.setAttribute("aria-label", `Ir para a página ${numero}`);

            if (numero === paginaAtual) {
                botao.setAttribute("aria-current", "page");
            }

            botao.addEventListener("click", () => {
                paginaAtual = numero;
                renderizarPedidos();
            });

            paginacao.appendChild(botao);
        }
    }

    // =========================================================
    // RENDERIZAR TABELA
    // =========================================================

    function renderizarPedidos() {
        if (!tabela) {
            console.error('Elemento "orders-table-body" não encontrado.');
            return;
        }

        tabela.replaceChildren();

        const total = pedidosFiltrados.length;

        mostrarVazio(total === 0);

        if (textoEncontrados) {
            textoEncontrados.textContent =
                `${total} ${total === 1 ? "pedido encontrado" : "pedidos encontrados"}`;
        }

        if (total === 0) {
            atualizarPaginacao();
            return;
        }

        paginaAtual = Math.min(paginaAtual, obterTotalPaginas());

        const inicio = (paginaAtual - 1) * PEDIDOS_POR_PAGINA;
        const pedidosPagina = pedidosFiltrados.slice(
            inicio,
            inicio + PEDIDOS_POR_PAGINA
        );

        pedidosPagina.forEach(pedido => {
            const data = formatarData(obterDataPedido(pedido));
            const id = escaparHTML(pedido.id);
            const nome = escaparHTML(obterNomeCliente(pedido));
            const email = escaparHTML(obterEmailCliente(pedido));
            const quantidade = quantidadeProdutos(pedido);
            const status = normalizarStatus(pedido.status);
            const classe = classeStatus(status);

            const linha = document.createElement("tr");

            linha.innerHTML = `
                <td>
                    <strong class="pedido-id">#${id}</strong>
                </td>

                <td>
                    <div class="cliente-info">
                        <strong>${nome}</strong>
                        <span>${email || "E-mail não informado"}</span>
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
                        ${quantidade} ${quantidade === 1 ? "produto" : "produtos"}
                    </span>
                </td>

                <td>
                    <strong class="pedido-total">
                        ${formatarPreco(obterTotalPedido(pedido))}
                    </strong>
                </td>

                <td>
                    <span class="pedido-status ${classe}">
                        <span></span>${status}
                    </span>
                </td>

                <td>
                    <div class="pedido-actions">
                        <button
                            type="button"
                            class="view-order"
                            data-id="${id}"
                            title="Visualizar pedido"
                            aria-label="Visualizar pedido ${id}">
                            <i class="fa-regular fa-eye"></i>
                        </button>

                        <button
                            type="button"
                            class="order-menu"
                            data-id="${id}"
                            title="Alterar status"
                            aria-label="Alterar status do pedido ${id}">
                            <i class="fa-solid fa-ellipsis"></i>
                        </button>
                    </div>
                </td>
            `;

            tabela.appendChild(linha);
        });

        atualizarPaginacao();
    }

    // =========================================================
    // FILTROS
    // =========================================================

    function correspondeFiltroData(pedido, filtro) {
        const valor = String(filtro || "").trim().toLowerCase();

        if (!valor || ["todos", "todas", "all"].includes(valor)) {
            return true;
        }

        const dataPedido = new Date(obterDataPedido(pedido) || "");

        if (Number.isNaN(dataPedido.getTime())) return false;

        const agora = new Date();

        const inicioHoje = new Date(
            agora.getFullYear(),
            agora.getMonth(),
            agora.getDate()
        );

        const inicioAmanha = new Date(inicioHoje);
        inicioAmanha.setDate(inicioAmanha.getDate() + 1);

        if (valor.includes("hoje") || valor === "today") {
            return dataPedido >= inicioHoje && dataPedido < inicioAmanha;
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

    function aplicarFiltros() {
        const busca = String(campoBusca?.value || "").trim().toLowerCase();
        const statusSelecionado = String(filtroStatus?.value || "")
            .trim()
            .toLowerCase();
        const dataSelecionada = String(filtroData?.value || "")
            .trim()
            .toLowerCase();

        pedidosFiltrados = pedidos.filter(pedido => {
            const id = normalizarIdPedido(pedido.id).toLowerCase();
            const nome = obterNomeCliente(pedido).toLowerCase();
            const email = obterEmailCliente(pedido).toLowerCase();

            const correspondeBusca = !busca ||
                id.includes(busca) ||
                nome.includes(busca) ||
                email.includes(busca);

            if (!correspondeBusca) return false;

            if (
                statusSelecionado &&
                !["todos", "todas", "all"].includes(statusSelecionado) &&
                normalizarStatus(pedido.status).toLowerCase() !== statusSelecionado
            ) {
                return false;
            }

            return correspondeFiltroData(pedido, dataSelecionada);
        });

        paginaAtual = 1;
        renderizarPedidos();
    }

    function limparFiltros() {
        if (campoBusca) campoBusca.value = "";
        if (filtroStatus) filtroStatus.selectedIndex = 0;
        if (filtroData) filtroData.selectedIndex = 0;

        aplicarFiltros();
    }

    // =========================================================
    // VISUALIZAR DETALHES
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
                const nome = item.nome ||
                    item.nomeProduto ||
                    item.name ||
                    "Produto";

                const quantidade = Number(item.quantidade ?? item.quantity ?? 1);
                const tamanho = item.tamanho ? ` | Tamanho: ${item.tamanho}` : "";
                const cor = item.cor ? ` | Cor: ${item.cor}` : "";
                const preco = item.preco != null
                    ? ` | ${formatarPreco(item.preco)}`
                    : "";

                return `• ${nome} x${quantidade}${tamanho}${cor}${preco}`;
            }).join("\n")
            : "Nenhum produto informado.";

        const endereco = pedido.endereco || pedido.address || {};

        const enderecoTexto = [
            endereco.rua || endereco.logradouro || endereco.street,
            endereco.numero || endereco.number,
            endereco.complemento,
            endereco.bairro || endereco.neighborhood,
            endereco.cidade || endereco.city,
            endereco.estado || endereco.state,
            (endereco.cep || endereco.zipcode)
                ? `CEP: ${endereco.cep || endereco.zipcode}`
                : ""
        ].filter(Boolean).join(", ") || "Endereço não informado.";

        const data = formatarData(obterDataPedido(pedido));

        alert(
            `PEDIDO #${normalizarIdPedido(pedido.id)}\n\n` +
            `Cliente: ${obterNomeCliente(pedido)}\n` +
            `E-mail: ${obterEmailCliente(pedido) || "Não informado"}\n` +
            `Data: ${data.data} ${data.hora}\n\n` +
            `ENDEREÇO\n${enderecoTexto}\n\n` +
            `PRODUTOS\n${produtosTexto}\n\n` +
            `Pagamento: ${pedido.pagamento || "Não informado"}\n` +
            `Subtotal: ${formatarPreco(pedido.subtotal)}\n` +
            `Frete: ${formatarPreco(pedido.frete)}\n` +
            `Total: ${formatarPreco(obterTotalPedido(pedido))}\n\n` +
            `Status: ${normalizarStatus(pedido.status)}`
        );
    }

    // =========================================================
    // ATUALIZAR STATUS NO SUPABASE
    // =========================================================

    async function alterarStatus(id) {
        if (salvandoStatus) return;

        const pedido = pedidos.find(
            item => normalizarIdPedido(item.id) === normalizarIdPedido(id)
        );

        if (!pedido) {
            alert("Pedido não encontrado.");
            return;
        }

        const statusAtual = normalizarStatus(pedido.status);

        const novoStatus = prompt(
            "Digite o novo status do pedido:\n\n" +
            STATUS_VALIDOS.join("\n") +
            `\n\nStatus atual: ${statusAtual}`,
            statusAtual
        );

        if (novoStatus === null) return;

        const statusValidado = validarStatus(novoStatus);

        if (!statusValidado) {
            alert("Status inválido. Use: " + STATUS_VALIDOS.join(", ") + ".");
            return;
        }

        if (statusValidado === statusAtual) return;

        salvandoStatus = true;

        try {
            const { data, error } = await supabase
                .from(TABELA_PEDIDOS)
                .update({ status: statusValidado })
                .eq("id", pedido.id)
                .select("id, status")
                .maybeSingle();

            if (error) throw error;

            if (!data) {
                throw new Error(
                    "Nenhum pedido foi atualizado. Confira se sua sessão de administrador está válida e se a política RLS permite atualizar esse registro."
                );
            }

            pedido.status = normalizarStatus(data.status);

            aplicarFiltros();
            atualizarEstatisticas();

            alert("Status do pedido atualizado com sucesso!");
        } catch (erro) {
            console.error("Erro ao atualizar status:", erro);

            alert(
                "Não foi possível atualizar o status no Supabase.\n\n" +
                (erro.message || "Verifique sua conexão e as permissões do administrador.")
            );
        } finally {
            salvandoStatus = false;
        }
    }

    // =========================================================
    // EVENTOS DA TABELA
    // =========================================================

    if (tabela) {
        tabela.addEventListener("click", event => {
            const botaoVisualizar = event.target.closest(".view-order");

            if (botaoVisualizar) {
                visualizarPedido(botaoVisualizar.dataset.id);
                return;
            }

            const botaoStatus = event.target.closest(".order-menu");

            if (botaoStatus) {
                alterarStatus(botaoStatus.dataset.id);
            }
        });
    }

    // =========================================================
    // EVENTOS DOS FILTROS E DA PAGINAÇÃO
    // =========================================================

    campoBusca?.addEventListener("input", aplicarFiltros);
    filtroStatus?.addEventListener("change", aplicarFiltros);
    filtroData?.addEventListener("change", aplicarFiltros);
    botaoFiltrar?.addEventListener("click", aplicarFiltros);
    botaoLimpar?.addEventListener("click", limparFiltros);

    botaoAnterior?.addEventListener("click", () => {
        if (paginaAtual > 1) {
            paginaAtual--;
            renderizarPedidos();
        }
    });

    botaoProximo?.addEventListener("click", () => {
        if (paginaAtual < obterTotalPaginas()) {
            paginaAtual++;
            renderizarPedidos();
        }
    });

    botaoTentarNovamente?.addEventListener("click", carregarPedidos);

    // =========================================================
    // INICIALIZAÇÃO
    // =========================================================

    const autorizado = await verificarAcessoAdmin();

    if (!autorizado) return;

    await carregarPedidos();

    console.log("NØVA ADM — Pedidos conectados ao Supabase.");
});
