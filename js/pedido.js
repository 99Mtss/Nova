document.addEventListener("DOMContentLoaded", () => {

    const ORDER_KEY = "novaPedido";

    const pedido = JSON.parse(
        localStorage.getItem(ORDER_KEY)
    );

    /* =========================
       VERIFICAR PEDIDO
    ========================= */

    if (!pedido) {

        mostrarMensagem(
            "Nenhum pedido encontrado."
        );

        setTimeout(() => {
            window.location.href = "loja.html";
        }, 1500);

        return;
    }

    /* =========================
       ELEMENTOS
    ========================= */

    const numeroPedido =
        document.querySelector(".pedido-numero strong");

    const produtosContainer =
        document.querySelector(".pedido-resumo .pedido-card");

    const totais =
        document.querySelector(".pedido-totais");

    const emailTexto =
        document.querySelector(".pedido-info p");

    /* =========================
       FORMATAR PREÇO
    ========================= */

    function formatarPreco(valor) {

        return Number(valor || 0).toLocaleString(
            "pt-BR",
            {
                style: "currency",
                currency: "BRL"
            }
        );
    }

    /* =========================
       MOSTRAR ID DO PEDIDO
    ========================= */

    if (numeroPedido && pedido.id) {

        numeroPedido.textContent =
            `#${pedido.id}`;
    }

    /* =========================
       RENDERIZAR PRODUTOS
    ========================= */

    function renderizarProdutos() {

        if (!produtosContainer) return;

        // Remove produtos fixos do HTML
        const produtosExistentes =
            produtosContainer.querySelectorAll(
                ".pedido-produto"
            );

        produtosExistentes.forEach(produto => {
            produto.remove();
        });

        // Local onde os produtos serão inseridos
        const elementoTotais =
            produtosContainer.querySelector(
                ".pedido-totais"
            );

        /*
            O checkout atual salva os produtos
            dentro de "itens".

            "produtos" é mantido como compatibilidade
            com versões anteriores.
        */

        const produtos =
            pedido.itens ||
            pedido.produtos ||
            [];

        produtos.forEach(produto => {

            const item =
                document.createElement("div");

            item.className =
                "pedido-produto";

            /* =========================
               COR E TAMANHO
            ========================= */

            const detalhes = [];

            if (produto.cor) {
                detalhes.push(produto.cor);
            }

            if (produto.tamanho) {
                detalhes.push(produto.tamanho);
            }

            const detalhesTexto =
                detalhes.length > 0
                    ? detalhes.join(" · ")
                    : "Produto";

            /* =========================
               HTML DO PRODUTO
            ========================= */

            item.innerHTML = `
                <div class="pedido-produto-imagem">
                    ${
                        produto.imagem
                            ? `<img 
                                src="${produto.imagem}" 
                                alt="${produto.nome || "Produto NØVA"}"
                              >`
                            : `<span>NØVA</span>`
                    }
                </div>

                <div class="pedido-produto-info">

                    <h3>
                        ${produto.nome || "Produto NØVA"}
                    </h3>

                    <p>
                        ${detalhesTexto}
                    </p>

                    <span>
                        Quantidade: ${produto.quantidade || 1}
                    </span>

                </div>

                <strong>
                    ${formatarPreco(
                        Number(produto.preco || 0) *
                        Number(produto.quantidade || 1)
                    )}
                </strong>
            `;

            // Insere o produto antes dos totais
            if (elementoTotais) {

                produtosContainer.insertBefore(
                    item,
                    elementoTotais
                );

            } else {

                produtosContainer.appendChild(item);

            }

        });
    }

    /* =========================
       ATUALIZAR TOTAIS
    ========================= */

    function atualizarTotais() {

        if (!totais) return;

        const linhas =
            totais.querySelectorAll(
                ":scope > div"
            );

        /* =========================
           SUBTOTAL
        ========================= */

        if (linhas.length >= 1) {

            const subtotal =
                linhas[0].querySelector("strong");

            if (subtotal) {

                subtotal.textContent =
                    formatarPreco(
                        pedido.subtotal || 0
                    );
            }
        }

        /* =========================
           FRETE
        ========================= */

        if (linhas.length >= 2) {

            const frete =
                linhas[1].querySelector("strong");

            if (frete) {

                const valorFrete =
                    Number(pedido.frete || 0);

                frete.textContent =
                    valorFrete > 0
                        ? formatarPreco(valorFrete)
                        : "Grátis";
            }
        }

        /* =========================
           TOTAL FINAL
        ========================= */

        const totalFinal =
            document.querySelector(
                ".pedido-total-final strong"
            );

        if (totalFinal) {

            totalFinal.textContent =
                formatarPreco(
                    pedido.total || 0
                );
        }
    }

    /* =========================
       ATUALIZAR E-MAIL
    ========================= */

    if (
        emailTexto &&
        pedido.cliente &&
        pedido.cliente.email
    ) {

        emailTexto.textContent =
            `Enviamos os detalhes do seu pedido para ${pedido.cliente.email}.`;
    }

    /* =========================
       MOSTRAR PAGAMENTO
    ========================= */

    const resumoHeader =
        document.querySelector(
            ".pedido-card-header"
        );

    if (
        resumoHeader &&
        pedido.pagamento
    ) {

        const pagamentoExistente =
            resumoHeader.querySelector(
                ".pedido-pagamento"
            );

        if (!pagamentoExistente) {

            const pagamento =
                document.createElement("span");

            pagamento.className =
                "pedido-pagamento";

            pagamento.textContent =
                `Pagamento: ${pedido.pagamento}`;

            resumoHeader.appendChild(
                pagamento
            );
        }
    }

    /* =========================
       RENDERIZAÇÃO
    ========================= */

    renderizarProdutos();

    atualizarTotais();

    /* =========================
       MENSAGEM
    ========================= */

    function mostrarMensagem(texto) {

        const mensagemExistente =
            document.querySelector(
                ".nova-mensagem"
            );

        if (mensagemExistente) {
            mensagemExistente.remove();
        }

        const mensagem =
            document.createElement("div");

        mensagem.className =
            "nova-mensagem";

        mensagem.textContent =
            texto;

        Object.assign(
            mensagem.style,
            {
                position: "fixed",
                bottom: "25px",
                right: "25px",
                zIndex: "9999",
                padding: "14px 20px",
                background: "#1E222B",
                color: "#F5F7FA",
                border: "1px solid #8B5CF6",
                borderRadius: "8px",
                fontSize: "14px",
                boxShadow:
                    "0 10px 30px rgba(0,0,0,0.3)"
            }
        );

        document.body.appendChild(
            mensagem
        );

        setTimeout(() => {

            mensagem.remove();

        }, 3000);
    }

});