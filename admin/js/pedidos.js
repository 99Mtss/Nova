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


    // =========================================================
    // ELEMENTOS
    // =========================================================

    const tabela = document.querySelector(".pedidos-table tbody");

    const campoBusca =
        document.querySelector(".pedido-search input");

    const filtroStatus =
        document.querySelector(
            ".pedidos-filters select:nth-of-type(1)"
        );

    const filtroData =
        document.querySelector(
            ".pedidos-filters select:nth-of-type(2)"
        );

    const botaoFiltrar =
        document.querySelector(".pedido-filter-button");

    const paginacao =
        document.querySelector(".pagination-buttons");

    const textoEncontrados =
        document.querySelector(
            ".pedidos-table-header p"
        );


    // =========================================================
    // NORMALIZAR ID
    // =========================================================

    function normalizarIdPedido(id) {

        return String(id || "")
            .trim()
            .replace(/^#+/, "");

    }


    // =========================================================
    // CARREGAR PEDIDOS
    // =========================================================

    function obterPedidos() {

        let pedidosSalvos = [];

        try {

            const dados =
                localStorage.getItem(PEDIDOS_KEY);

            if (dados) {

                const parsed =
                    JSON.parse(dados);

                if (Array.isArray(parsed)) {

                    pedidosSalvos = parsed;

                }

            }

        } catch (erro) {

            console.error(
                "Erro ao carregar novaPedidos:",
                erro
            );

        }


        // =====================================================
        // COMPATIBILIDADE
        // =====================================================

        let pedidoAtual = null;

        try {

            const dadosAtual =
                localStorage.getItem(PEDIDO_KEY);

            if (dadosAtual) {

                pedidoAtual =
                    JSON.parse(dadosAtual);

            }

        } catch (erro) {

            console.error(
                "Erro ao carregar novaPedido:",
                erro
            );

        }


        // =====================================================
        // ADICIONAR PEDIDO ATUAL CASO AINDA NÃO EXISTA
        // =====================================================

        if (
            pedidoAtual &&
            pedidoAtual.id
        ) {

            const idAtual =
                normalizarIdPedido(
                    pedidoAtual.id
                );

            const existe =
                pedidosSalvos.some(
                    pedido =>
                        normalizarIdPedido(
                            pedido.id
                        ) === idAtual
                );

            if (!existe) {

                pedidosSalvos.push({
                    ...pedidoAtual,
                    id: idAtual
                });

            }

        }


        // =====================================================
        // NORMALIZAR PEDIDOS
        // =====================================================

        pedidosSalvos =
            pedidosSalvos
                .filter(
                    pedido =>
                        pedido &&
                        pedido.id
                )
                .map(pedido => ({
                    ...pedido,
                    id: normalizarIdPedido(
                        pedido.id
                    )
                }));


        // =====================================================
        // REMOVER DUPLICADOS
        // =====================================================

        const mapa =
            new Map();

        pedidosSalvos.forEach(
            pedido => {

                mapa.set(
                    normalizarIdPedido(
                        pedido.id
                    ),
                    pedido
                );

            }
        );


        pedidosSalvos =
            Array.from(
                mapa.values()
            );


        // =====================================================
        // SALVAR VERSÃO NORMALIZADA
        // =====================================================

        try {

            localStorage.setItem(
                PEDIDOS_KEY,
                JSON.stringify(
                    pedidosSalvos
                )
            );

        } catch (erro) {

            console.error(
                "Erro ao salvar pedidos:",
                erro
            );

        }


        return pedidosSalvos;

    }


    // =========================================================
    // FORMATAR PREÇO
    // =========================================================

    function formatarPreco(valor) {

        return Number(
            valor || 0
        ).toLocaleString(
            "pt-BR",
            {
                style: "currency",
                currency: "BRL"
            }
        );

    }


    // =========================================================
    // FORMATAR DATA
    // =========================================================

    function formatarData(data) {

        if (!data) {

            return {
                data: "-",
                hora: ""
            };

        }

        const dataObj =
            new Date(data);

        if (
            Number.isNaN(
                dataObj.getTime()
            )
        ) {

            return {
                data: "-",
                hora: ""
            };

        }

        return {

            data:
                dataObj.toLocaleDateString(
                    "pt-BR",
                    {
                        day: "2-digit",
                        month: "short",
                        year: "numeric"
                    }
                ),

            hora:
                dataObj.toLocaleTimeString(
                    "pt-BR",
                    {
                        hour: "2-digit",
                        minute: "2-digit"
                    }
                )

        };

    }


    // =========================================================
    // OBTER NOME DO CLIENTE
    // =========================================================

    function obterNomeCliente(pedido) {

        return (
            pedido.cliente?.nome ||
            pedido.nome ||
            "Cliente não informado"
        );

    }


    // =========================================================
    // OBTER EMAIL
    // =========================================================

    function obterEmailCliente(pedido) {

        return (
            pedido.cliente?.email ||
            pedido.email ||
            ""
        );

    }


    // =========================================================
    // OBTER ITENS
    // =========================================================

    function obterItens(pedido) {

        if (
            Array.isArray(
                pedido.itens
            )
        ) {

            return pedido.itens;

        }

        if (
            Array.isArray(
                pedido.produtos
            )
        ) {

            return pedido.produtos;

        }

        return [];

    }


    // =========================================================
    // QUANTIDADE DE PRODUTOS
    // =========================================================

    function quantidadeProdutos(pedido) {

        const itens =
            obterItens(pedido);

        return itens.reduce(
            (total, item) =>
                total +
                Number(
                    item.quantidade || 1
                ),
            0
        );

    }


    // =========================================================
    // STATUS
    // =========================================================

    function normalizarStatus(status) {

        const valor =
            String(
                status || "pending"
            )
                .toLowerCase()
                .trim();

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

        return (
            mapa[valor] ||
            "Pendente"
        );

    }


    // =========================================================
    // CLASSE DO STATUS
    // =========================================================

    function classeStatus(status) {

        const valor =
            normalizarStatus(status);

        const mapa = {

            "Pendente": "pendente",
            "Processando": "processando",
            "Enviado": "enviado",
            "Entregue": "entregue",
            "Cancelado": "cancelado"

        };

        return (
            mapa[valor] ||
            "pendente"
        );

    }


    // =========================================================
    // ATUALIZAR ESTATÍSTICAS
    // =========================================================

    function atualizarEstatisticas() {

        const cards =
            document.querySelectorAll(
                ".pedido-stat-card strong"
            );

        if (!cards.length) {
            return;
        }


        const total =
            pedidos.length;


        const pendentes =
            pedidos.filter(
                pedido =>
                    normalizarStatus(
                        pedido.status
                    ) === "Pendente"
            ).length;


        const processando =
            pedidos.filter(
                pedido =>
                    normalizarStatus(
                        pedido.status
                    ) === "Processando"
            ).length;


        const entregues =
            pedidos.filter(
                pedido =>
                    normalizarStatus(
                        pedido.status
                    ) === "Entregue"
            ).length;


        if (cards[0]) {
            cards[0].textContent =
                total;
        }

        if (cards[1]) {
            cards[1].textContent =
                pendentes;
        }

        if (cards[2]) {
            cards[2].textContent =
                processando;
        }

        if (cards[3]) {
            cards[3].textContent =
                entregues;
        }

    }


    // =========================================================
    // RENDERIZAR PEDIDOS
    // =========================================================

    function renderizarPedidos() {

        if (!tabela) {
            return;
        }


        tabela.innerHTML = "";


        // =====================================================
        // NENHUM PEDIDO
        // =====================================================

        if (!pedidosFiltrados.length) {

            tabela.innerHTML = `

                <tr>

                    <td
                        colspan="6"
                        style="
                            text-align:center;
                            padding:50px 20px;
                            color:#8b8f9a;
                        "
                    >

                        <i
                            class="fa-solid fa-box-open"
                            style="
                                font-size:32px;
                                margin-bottom:15px;
                                display:block;
                            "
                        ></i>

                        Nenhum pedido encontrado.

                    </td>

                </tr>

            `;

            atualizarPaginacao();

            if (textoEncontrados) {

                textoEncontrados.textContent =
                    "0 pedidos encontrados";

            }

            return;

        }


        // =====================================================
        // PAGINAÇÃO
        // =====================================================

        const inicio =
            (paginaAtual - 1) *
            PEDIDOS_POR_PAGINA;

        const fim =
            inicio +
            PEDIDOS_POR_PAGINA;

        const pedidosPagina =
            pedidosFiltrados.slice(
                inicio,
                fim
            );


        // =====================================================
        // RENDER
        // =====================================================

        pedidosPagina.forEach(
            pedido => {

                const data =
                    formatarData(
                        pedido.criadoEm ||
                        pedido.data
                    );


                const nome =
                    obterNomeCliente(
                        pedido
                    );


                const email =
                    obterEmailCliente(
                        pedido
                    );


                const quantidade =
                    quantidadeProdutos(
                        pedido
                    );


                const total =
                    Number(
                        pedido.total ||
                        pedido.subtotal ||
                        0
                    );


                const status =
                    normalizarStatus(
                        pedido.status
                    );


                const classe =
                    classeStatus(
                        status
                    );


                const tr =
                    document.createElement(
                        "tr"
                    );


                tr.innerHTML = `

                    <td>

                        <strong
                            class="pedido-id"
                        >
                            #${normalizarIdPedido(
                                pedido.id
                            )}
                        </strong>

                    </td>


                    <td>

                        <div
                            class="cliente-info"
                        >

                            <strong>
                                ${nome}
                            </strong>

                            <span>
                                ${email}
                            </span>

                        </div>

                    </td>


                    <td>

                        <div
                            class="pedido-date"
                        >

                            <span>
                                ${data.data}
                            </span>

                            <small>
                                ${data.hora}
                            </small>

                        </div>

                    </td>


                    <td>

                        <span
                            class="produtos-count"
                        >
                            ${quantidade}
                            ${
                                quantidade === 1
                                    ? "produto"
                                    : "produtos"
                            }
                        </span>

                    </td>


                    <td>

                        <strong
                            class="pedido-total"
                        >
                            ${formatarPreco(
                                total
                            )}
                        </strong>

                    </td>


                    <td>

                        <span
                            class="pedido-status ${classe}"
                        >

                            <span></span>

                            ${status}

                        </span>

                    </td>


                    <td>

                        <div
                            class="pedido-actions"
                        >

                            <button
                                type="button"
                                class="view-order"
                                data-id="${normalizarIdPedido(
                                    pedido.id
                                )}"
                                title="Visualizar pedido"
                            >

                                <i
                                    class="fa-regular fa-eye"
                                ></i>

                            </button>


                            <button
                                type="button"
                                class="order-menu"
                                data-id="${normalizarIdPedido(
                                    pedido.id
                                )}"
                                title="Alterar status"
                            >

                                <i
                                    class="fa-solid fa-ellipsis"
                                ></i>

                            </button>

                        </div>

                    </td>

                `;


                tabela.appendChild(
                    tr
                );

            }
        );


        // =====================================================
        // TEXTO
        // =====================================================

        if (textoEncontrados) {

            textoEncontrados.textContent =
                `${pedidosFiltrados.length} ${
                    pedidosFiltrados.length === 1
                        ? "pedido"
                        : "pedidos"
                } encontrados`;

        }


        atualizarPaginacao();

    }


    // =========================================================
    // PAGINAÇÃO
    // =========================================================

    function atualizarPaginacao() {

        if (!paginacao) {
            return;
        }


        const totalPaginas =
            Math.max(
                1,
                Math.ceil(
                    pedidosFiltrados.length /
                    PEDIDOS_POR_PAGINA
                )
            );


        paginacao.innerHTML = "";


        // VOLTAR

        const anterior =
            document.createElement(
                "button"
            );

        anterior.type =
            "button";

        anterior.innerHTML =
            `<i class="fa-solid fa-chevron-left"></i>`;

        anterior.disabled =
            paginaAtual <= 1;

        anterior.addEventListener(
            "click",
            () => {

                if (
                    paginaAtual > 1
                ) {

                    paginaAtual--;

                    renderizarPedidos();

                }

            }
        );

        paginacao.appendChild(
            anterior
        );


        // PÁGINAS

        for (
            let i = 1;
            i <= totalPaginas;
            i++
        ) {

            const botao =
                document.createElement(
                    "button"
                );

            botao.type =
                "button";

            botao.textContent =
                i;

            if (
                i === paginaAtual
            ) {

                botao.classList.add(
                    "active"
                );

            }


            botao.addEventListener(
                "click",
                () => {

                    paginaAtual =
                        i;

                    renderizarPedidos();

                }
            );


            paginacao.appendChild(
                botao
            );

        }


        // AVANÇAR

        const proximo =
            document.createElement(
                "button"
            );

        proximo.type =
            "button";

        proximo.innerHTML =
            `<i class="fa-solid fa-chevron-right"></i>`;

        proximo.disabled =
            paginaAtual >= totalPaginas;


        proximo.addEventListener(
            "click",
            () => {

                if (
                    paginaAtual <
                    totalPaginas
                ) {

                    paginaAtual++;

                    renderizarPedidos();

                }

            }
        );


        paginacao.appendChild(
            proximo
        );

    }


    // =========================================================
    // FILTRAR
    // =========================================================

    function aplicarFiltros() {

        const busca =
            campoBusca
                ? campoBusca.value
                    .toLowerCase()
                    .trim()
                : "";


        const statusSelecionado =
            filtroStatus
                ? filtroStatus.value
                : "";


        const dataSelecionada =
            filtroData
                ? filtroData.value
                : "";


        pedidosFiltrados =
            pedidos.filter(
                pedido => {


                    // -----------------------------------------
                    // BUSCA
                    // -----------------------------------------

                    const id =
                        normalizarIdPedido(
                            pedido.id
                        ).toLowerCase();


                    const nome =
                        obterNomeCliente(
                            pedido
                        ).toLowerCase();


                    const email =
                        obterEmailCliente(
                            pedido
                        ).toLowerCase();


                    const correspondeBusca =
                        !busca ||
                        id.includes(busca) ||
                        nome.includes(busca) ||
                        email.includes(busca);


                    if (
                        !correspondeBusca
                    ) {

                        return false;

                    }


                    // -----------------------------------------
                    // STATUS
                    // -----------------------------------------

                    if (
                        statusSelecionado &&
                        statusSelecionado !== "todos"
                    ) {

                        const status =
                            normalizarStatus(
                                pedido.status
                            );


                        const statusFiltro =
                            statusSelecionado
                                .toLowerCase();


                        if (
                            status.toLowerCase() !==
                            statusFiltro
                        ) {

                            return false;

                        }

                    }


                    // -----------------------------------------
                    // DATA
                    // -----------------------------------------

                    if (
                        dataSelecionada &&
                        dataSelecionada !== "todas"
                    ) {

                        if (
                            !correspondeFiltroData(
                                pedido,
                                dataSelecionada
                            )
                        ) {

                            return false;

                        }

                    }


                    return true;

                }
            );


        paginaAtual = 1;

        renderizarPedidos();

    }


    // =========================================================
    // FILTRO DE DATA
    // =========================================================

    function correspondeFiltroData(
        pedido,
        filtro
    ) {

        const dataPedido =
            new Date(
                pedido.criadoEm ||
                pedido.data
            );


        if (
            Number.isNaN(
                dataPedido.getTime()
            )
        ) {

            return false;

        }


        const agora =
            new Date();


        const inicioHoje =
            new Date(
                agora.getFullYear(),
                agora.getMonth(),
                agora.getDate()
            );


        if (
            filtro.toLowerCase() ===
            "hoje"
        ) {

            return (
                dataPedido >=
                inicioHoje
            );

        }


        if (
            filtro.toLowerCase()
                .includes("7")
        ) {

            const limite =
                new Date(
                    agora
                );

            limite.setDate(
                limite.getDate() - 7
            );

            return (
                dataPedido >=
                limite
            );

        }


        if (
            filtro.toLowerCase()
                .includes("30")
        ) {

            const limite =
                new Date(
                    agora
                );

            limite.setDate(
                limite.getDate() - 30
            );

            return (
                dataPedido >=
                limite
            );

        }


        if (
            filtro.toLowerCase()
                .includes("mês") ||
            filtro.toLowerCase()
                .includes("mes")
        ) {

            return (
                dataPedido.getMonth() ===
                    agora.getMonth() &&
                dataPedido.getFullYear() ===
                    agora.getFullYear()
            );

        }


        return true;

    }


    // =========================================================
    // VISUALIZAR PEDIDO
    // =========================================================

    function visualizarPedido(id) {

        const pedido =
            pedidos.find(
                item =>
                    normalizarIdPedido(
                        item.id
                    ) ===
                    normalizarIdPedido(
                        id
                    )
            );


        if (!pedido) {

            return;

        }


        const itens =
            obterItens(
                pedido
            );


        const produtosTexto =
            itens.length
                ? itens.map(
                    item =>
                        `${item.nome || "Produto"} x${Number(item.quantidade || 1)}`
                ).join("\n")
                : "Nenhum produto";


        alert(

            `PEDIDO #${normalizarIdPedido(
                pedido.id
            )}\n\n` +

            `Cliente: ${obterNomeCliente(
                pedido
            )}\n` +

            `E-mail: ${obterEmailCliente(
                pedido
            )}\n\n` +

            `Produtos:\n${produtosTexto}\n\n` +

            `Total: ${formatarPreco(
                pedido.total ||
                pedido.subtotal ||
                0
            )}\n\n` +

            `Status: ${normalizarStatus(
                pedido.status
            )}`

        );

    }


    // =========================================================
    // ALTERAR STATUS
    // =========================================================

    function alterarStatus(id) {

        const pedido =
            pedidos.find(
                item =>
                    normalizarIdPedido(
                        item.id
                    ) ===
                    normalizarIdPedido(
                        id
                    )
            );


        if (!pedido) {

            return;

        }


        const novoStatus =
            prompt(
                "Digite o novo status:\n\n" +
                "Pendente\n" +
                "Processando\n" +
                "Enviado\n" +
                "Entregue\n" +
                "Cancelado",
                normalizarStatus(
                    pedido.status
                )
            );


        if (!novoStatus) {

            return;

        }


        const status =
            normalizarStatus(
                novoStatus
            );


        pedido.status =
            status;


        localStorage.setItem(
            PEDIDOS_KEY,
            JSON.stringify(
                pedidos
            )
        );


        aplicarFiltros();


        window.dispatchEvent(
            new CustomEvent(
                "novaPedidosAtualizados",
                {
                    detail: pedidos
                }
            )
        );

    }


    // =========================================================
    // CLIQUES NA TABELA
    // =========================================================

    if (tabela) {

        tabela.addEventListener(
            "click",
            event => {

                const visualizar =
                    event.target.closest(
                        ".view-order"
                    );


                if (visualizar) {

                    visualizarPedido(
                        visualizar.dataset.id
                    );

                    return;

                }


                const menu =
                    event.target.closest(
                        ".order-menu"
                    );


                if (menu) {

                    alterarStatus(
                        menu.dataset.id
                    );

                }

            }
        );

    }


    // =========================================================
    // BUSCA
    // =========================================================

    if (campoBusca) {

        campoBusca.addEventListener(
            "input",
            aplicarFiltros
        );

    }


    // =========================================================
    // FILTRAR
    // =========================================================

    if (botaoFiltrar) {

        botaoFiltrar.addEventListener(
            "click",
            aplicarFiltros
        );

    }


    // =========================================================
    // SELECTS
    // =========================================================

    if (filtroStatus) {

        filtroStatus.addEventListener(
            "change",
            aplicarFiltros
        );

    }


    if (filtroData) {

        filtroData.addEventListener(
            "change",
            aplicarFiltros
        );

    }


    // =========================================================
    // SINCRONIZAÇÃO
    // =========================================================

    function atualizarPedidos() {

        pedidos =
            obterPedidos();

        aplicarFiltros();

        atualizarEstatisticas();

    }


    // Outra aba/janela

    window.addEventListener(
        "storage",
        event => {

            if (
                event.key === PEDIDOS_KEY ||
                event.key === PEDIDO_KEY
            ) {

                atualizarPedidos();

            }

        }
    );


    // Evento interno da NØVA

    window.addEventListener(
        "novaPedidosAtualizados",
        () => {

            atualizarPedidos();

        }
    );


    // Quando voltar para a página

    document.addEventListener(
        "visibilitychange",
        () => {

            if (
                document.visibilityState ===
                "visible"
            ) {

                atualizarPedidos();

            }

        }
    );


    // Verificação periódica

    setInterval(
        () => {

            const novosPedidos =
                obterPedidos();


            if (
                JSON.stringify(
                    novosPedidos
                ) !==
                JSON.stringify(
                    pedidos
                )
            ) {

                pedidos =
                    novosPedidos;

                aplicarFiltros();

                atualizarEstatisticas();

            }

        },
        2000
    );


    // =========================================================
    // INICIALIZAÇÃO
    // =========================================================

    pedidos =
        obterPedidos();

    pedidosFiltrados =
        [...pedidos];

    atualizarEstatisticas();

    renderizarPedidos();


    console.log(
        "NØVA ADM — Pedidos carregados:",
        pedidos
    );

});