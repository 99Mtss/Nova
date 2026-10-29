
/* =========================================================
   VÉRTICE — CONFIRMAÇÃO DO PEDIDO
   Dados oficiais consultados no Supabase
   ========================================================= */

document.addEventListener("DOMContentLoaded", () => {
    "use strict";

    const ORDER_KEY = "novaPedido";

    // =====================================================
    // ELEMENTOS DA PÁGINA
    // =====================================================

    const loading = document.getElementById("pedido-loading");
    const erro = document.getElementById("pedido-erro");
    const erroMensagem = document.getElementById("pedido-erro-mensagem");
    const conteudo = document.getElementById("pedido-conteudo");
    const tentarNovamente = document.getElementById("pedido-tentar-novamente");

    const numeroPedido = document.getElementById("pedido-numero");
    const labelStatus = document.getElementById("pedido-label-status");
    const mensagemPedido = document.getElementById("pedido-mensagem");
    const statusPedido = document.getElementById("pedido-status");

    const produtosContainer = document.getElementById("pedido-produtos");
    const semProdutos = document.getElementById("pedido-sem-produtos");

    const subtotalElemento = document.getElementById("pedido-subtotal");
    const freteElemento = document.getElementById("pedido-frete");
    const totalElemento = document.getElementById("pedido-total");

    const pagamentoElemento = document.getElementById("pedido-pagamento");
    const pagamentoStatus = document.getElementById("pedido-pagamento-status");

    const descontoLinha = document.getElementById("pedido-desconto-linha");
    const descontoElemento = document.getElementById("pedido-desconto");

    let carregando = false;

    // =====================================================
    // FORMATAÇÃO
    // =====================================================

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

    function obterNumero(valor, padrao = 0) {
        const numero = Number(valor);
        return Number.isFinite(numero) ? numero : padrao;
    }

    function obterTexto(valor, padrao = "") {
        return typeof valor === "string" && valor.trim()
            ? valor.trim()
            : padrao;
    }

    // =====================================================
    // ESTADOS DA PÁGINA
    // =====================================================

    function mostrarCarregamento() {
        if (loading) loading.hidden = false;
        if (erro) erro.hidden = true;
        if (conteudo) conteudo.hidden = true;
    }

    function mostrarErro(texto) {
        if (loading) loading.hidden = true;
        if (conteudo) conteudo.hidden = true;
        if (erro) erro.hidden = false;

        if (erroMensagem) {
            erroMensagem.textContent = texto;
        }
    }

    function mostrarConteudo() {
        if (loading) loading.hidden = true;
        if (erro) erro.hidden = true;
        if (conteudo) conteudo.hidden = false;
    }

    // =====================================================
    // CARREGAR PEDIDO LOCAL
    // =====================================================

    function carregarIdPedidoLocal() {
        try {
            const dados = localStorage.getItem(ORDER_KEY);

            if (!dados) {
                return null;
            }

            const pedido = JSON.parse(dados);
            return obterTexto(pedido?.id) || null;
        } catch (error) {
            console.error(
                "Erro ao ler o identificador local do pedido:",
                error
            );

            return null;
        }
    }

    // =====================================================
    // VALIDAR PEDIDO
    // =====================================================

    function validarPedido(pedido) {
        if (!pedido || typeof pedido !== "object") {
            return false;
        }

        if (!obterTexto(pedido.id)) {
            return false;
        }

        const itens = Array.isArray(pedido.itens)
            ? pedido.itens
            : Array.isArray(pedido.produtos)
                ? pedido.produtos
                : [];

        if (itens.length === 0) {
            return false;
        }

        const valores = [pedido.subtotal, pedido.frete, pedido.total]
            .map(Number);

        if (
            valores.some(valor => !Number.isFinite(valor) || valor < 0)
        ) {
            return false;
        }

        return itens.every(item => {
            if (!item || typeof item !== "object") {
                return false;
            }

            const quantidade = Number(item.quantidade);
            const preco = Number(item.preco);

            return (
                obterTexto(item.nome).length > 0 &&
                Number.isFinite(quantidade) &&
                quantidade > 0 &&
                Number.isFinite(preco) &&
                preco >= 0
            );
        });
    }

    // =====================================================
    // CONSULTAR PEDIDO NO SUPABASE
    // =====================================================

    async function consultarPedidoSupabase(id) {
        const supabase = window.supabaseClient;

        if (!supabase || !id) {
            throw new Error(
                "Não foi possível conectar ao banco para consultar o pedido."
            );
        }

        const { data, error } = await supabase
            .from("pedidos_nova")
            .select("*")
            .eq("id", id)
            .maybeSingle();

        if (error) {
            console.error("Não foi possível consultar o pedido:", error);
            throw new Error(
                "Não foi possível consultar o pedido autorizado no Supabase. " +
                "Verifique as permissões de leitura."
            );
        }

        if (!data) {
            throw new Error(
                "O pedido não foi encontrado ou você não tem autorização para acessá-lo."
            );
        }

        if (!validarPedido(data) || String(data.id) !== String(id)) {
            throw new Error(
                "Os dados retornados pelo Supabase não são válidos para exibição."
            );
        }

        return data;
    }

    // =====================================================
    // RENDERIZAR PRODUTOS
    // =====================================================

    function renderizarProdutos(pedido) {
        if (!produtosContainer) return;

        produtosContainer.replaceChildren();

        const itens = Array.isArray(pedido.itens)
            ? pedido.itens
            : Array.isArray(pedido.produtos)
                ? pedido.produtos
                : [];

        if (semProdutos) {
            semProdutos.hidden = itens.length > 0;
        }

        itens.forEach(produto => {
            const item = document.createElement("article");
            item.className = "pedido-produto";

            const imagemContainer = document.createElement("div");
            imagemContainer.className = "pedido-produto-imagem";

            const imagemUrl = obterTexto(produto.imagem);

            if (imagemUrl) {
                const imagem = document.createElement("img");

                imagem.src = imagemUrl;
                imagem.alt = obterTexto(
                    produto.nome,
                    "Produto Vértice"
                );
                imagem.loading = "lazy";

                imagem.addEventListener("error", () => {
                    imagem.remove();

                    const fallback = document.createElement("span");
                    fallback.textContent = "VÉRTICE";

                    imagemContainer.appendChild(fallback);
                }, { once: true });

                imagemContainer.appendChild(imagem);
            } else {
                const fallback = document.createElement("span");
                fallback.textContent = "VÉRTICE";

                imagemContainer.appendChild(fallback);
            }

            const informacoes = document.createElement("div");
            informacoes.className = "pedido-produto-info";

            const nome = document.createElement("h3");
            nome.textContent = obterTexto(
                produto.nome,
                "Produto Vértice"
            );

            const detalhes = document.createElement("p");
            const opcoes = [];

            if (produto.cor) {
                opcoes.push(obterTexto(produto.cor));
            }

            if (produto.tamanho) {
                opcoes.push(obterTexto(produto.tamanho));
            }

            detalhes.textContent = opcoes.length
                ? opcoes.join(" · ")
                : "Produto";

            const quantidade = document.createElement("span");
            quantidade.textContent =
                `Quantidade: ${obterNumero(produto.quantidade, 1)}`;

            informacoes.append(nome, detalhes, quantidade);

            const preco = document.createElement("strong");
            preco.textContent = formatarPreco(
                obterNumero(produto.preco) *
                obterNumero(produto.quantidade, 1)
            );

            item.append(
                imagemContainer,
                informacoes,
                preco
            );

            produtosContainer.appendChild(item);
        });
    }

    // =====================================================
    // ATUALIZAR TOTAIS
    // =====================================================

    function atualizarTotais(pedido) {
        const subtotal = obterNumero(pedido.subtotal);
        const frete = obterNumero(pedido.frete);
        const total = obterNumero(pedido.total);

        if (subtotalElemento) {
            subtotalElemento.textContent = formatarPreco(subtotal);
        }

        if (freteElemento) {
            freteElemento.textContent =
                pedido.frete === null || pedido.frete === undefined
                    ? "Não informado"
                    : formatarPreco(frete);
        }

        if (totalElemento) {
            totalElemento.textContent = formatarPreco(total);
        }

        const desconto = obterNumero(pedido.desconto);

        if (descontoLinha && descontoElemento) {
            descontoLinha.hidden = desconto <= 0;
            descontoElemento.textContent = formatarPreco(desconto);
        }
    }

    // =====================================================
    // ATUALIZAR PAGAMENTO
    // =====================================================

    function atualizarPagamento(pedido) {
        if (pagamentoElemento) {
            let pagamento = obterTexto(
                pedido.pagamento,
                "Informação indisponível"
            );

            const formasPagamento = {
                pix: "PIX",
                cartao: "Cartão",
                credito: "Cartão de crédito",
                debito: "Cartão de débito",
                boleto: "Boleto bancário"
            };

            const chave = pagamento.toLowerCase();

            if (formasPagamento[chave]) {
                pagamento = formasPagamento[chave];
            }

            pagamentoElemento.textContent = pagamento;
        }

        if (pagamentoStatus) {
            pagamentoStatus.hidden = false;
            pagamentoStatus.textContent =
                "Pedido registrado. A confirmação do pagamento " +
                "depende da integração com o serviço de pagamento.";
        }
    }

    // =====================================================
    // EXIBIR PEDIDO
    // =====================================================

    function renderizarPedido(pedido) {
        if (numeroPedido) {
            numeroPedido.textContent = `#${pedido.id}`;
        }

        const status = obterTexto(
            pedido.status,
            "Pendente"
        );

        if (labelStatus) {
            labelStatus.textContent =
                status.toLowerCase() === "pendente"
                    ? "PEDIDO RECEBIDO"
                    : `STATUS: ${status.toUpperCase()}`;
        }

        if (statusPedido) {
            statusPedido.textContent = status;
        }

        if (mensagemPedido) {
            mensagemPedido.textContent =
                "Seu pedido foi registrado. Confira abaixo os detalhes " +
                "da compra. O pagamento ainda depende da confirmação " +
                "do serviço de pagamento escolhido.";
        }

        renderizarProdutos(pedido);
        atualizarTotais(pedido);
        atualizarPagamento(pedido);

        mostrarConteudo();
    }

    // =====================================================
    // INICIALIZAÇÃO
    // =====================================================

    async function inicializar() {
        if (carregando) return;

        carregando = true;
        mostrarCarregamento();

        try {
            const idNaUrl = new URLSearchParams(window.location.search)
                .get("id");
            const idPedido = obterTexto(idNaUrl) || carregarIdPedidoLocal();

            if (!idPedido) {
                mostrarErro(
                    "Não encontramos o identificador do pedido. " +
                    "A confirmação só pode exibir dados recuperados e autorizados pelo Supabase."
                );

                return;
            }

            const pedidoFinal = await consultarPedidoSupabase(idPedido);

            renderizarPedido(pedidoFinal);

            try {
                localStorage.removeItem(ORDER_KEY);
            } catch (storageError) {
                console.warn(
                    "Não foi possível limpar o pedido local após exibi-lo:",
                    storageError
                );
            }
        } catch (error) {
            console.error(
                "Erro ao carregar a confirmação do pedido:",
                error
            );

            mostrarErro(
                error?.message ||
                "Ocorreu um erro ao carregar seu pedido. Clique em tentar novamente."
            );
        } finally {
            carregando = false;
        }
    }

    // =====================================================
    // EVENTOS
    // =====================================================

    if (tentarNovamente) {
        tentarNovamente.addEventListener("click", inicializar);
    }

    inicializar();
});
