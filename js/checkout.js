/* =========================================================
   NØVA — CHECKOUT
   Finalização da compra e integração com o ADM
   ========================================================= */

document.addEventListener("DOMContentLoaded", () => {
    const CART_KEY = "novaCarrinho";
    const ORDER_KEY = "novaPedido";

    let carrinho = [];

    try {
        const dados = JSON.parse(
            localStorage.getItem(CART_KEY) || "[]"
        );

        carrinho = Array.isArray(dados) ? dados : [];
    } catch (erro) {
        console.error("Erro ao carregar carrinho:", erro);
        carrinho = [];
    }

    /* =====================================================
       ELEMENTOS
       ===================================================== */

    const summaryContainer = document.querySelector(
        ".checkout-summary"
    );

    const summaryItemsCount = document.querySelector(
        ".checkout-summary-heading span"
    );

    const subtotalElement = document.querySelector(
        ".checkout-summary-values div:first-child strong"
    );

    const totalElement = document.querySelector(
        ".checkout-total strong"
    );

    const finishButton = document.querySelector(
        ".finish-order"
    );

    const paymentOptions = document.querySelectorAll(
        ".payment-option"
    );

    const cardPaymentFields = document.querySelector(
        ".card-payment-fields"
    );

    const termsCheckbox = document.querySelector(
        ".terms-check input"
    );

    let finalizando = false;

    /* =====================================================
       MENSAGENS
       ===================================================== */

    function mostrarMensagem(texto) {
        const antiga = document.querySelector(".nova-mensagem");

        if (antiga) antiga.remove();

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

        setTimeout(() => mensagem.remove(), 3000);
    }

    /* =====================================================
       VERIFICAR CARRINHO
       ===================================================== */

    if (carrinho.length === 0) {
        mostrarMensagem("Seu carrinho está vazio.");

        if (finishButton) {
            finishButton.disabled = true;
        }

        setTimeout(() => {
            window.location.href = "carrinho.html";
        }, 1500);

        return;
    }

    /* =====================================================
       FORMATAR PREÇO
       ===================================================== */

    function formatarPreco(valor) {
        return Number(valor).toLocaleString("pt-BR", {
            style: "currency",
            currency: "BRL"
        });
    }

    /* =====================================================
       QUANTIDADE E SUBTOTAL
       ===================================================== */

    function calcularQuantidadeItens() {
        return carrinho.reduce((total, produto) => {
            return total + Math.max(
                0,
                Number(produto.quantidade) || 0
            );
        }, 0);
    }

    function calcularSubtotal() {
        return carrinho.reduce((total, produto) => {
            const preco = Math.max(
                0,
                Number(produto.preco) || 0
            );

            const quantidade = Math.max(
                0,
                Number(produto.quantidade) || 0
            );

            return total + preco * quantidade;
        }, 0);
    }

    /* =====================================================
       RENDERIZAR RESUMO DO PEDIDO
       ===================================================== */

    function renderizarResumo() {
        if (!summaryContainer) return;

        summaryContainer
            .querySelectorAll(".summary-product")
            .forEach((item) => item.remove());

        const valores = summaryContainer.querySelector(
            ".checkout-summary-values"
        );

        carrinho.forEach((produto) => {
            const item = document.createElement("div");
            item.className = "summary-product";

            const imagemContainer = document.createElement("div");
            imagemContainer.className = "summary-product-image";

            if (produto.imagem) {
                const imagem = document.createElement("img");

                imagem.src = produto.imagem;
                imagem.alt = produto.nome || "Produto NØVA";
                imagem.loading = "lazy";

                imagemContainer.appendChild(imagem);
            } else {
                const placeholder = document.createElement("span");
                placeholder.textContent = "IMG";

                imagemContainer.appendChild(placeholder);
            }

            const quantidade = document.createElement("b");

            quantidade.textContent = String(
                Number(produto.quantidade) || 1
            );

            imagemContainer.appendChild(quantidade);

            const info = document.createElement("div");
            info.className = "summary-product-info";

            const nome = document.createElement("h3");
            nome.textContent = produto.nome || "Produto NØVA";

            const detalhes = document.createElement("span");
            const caracteristicas = [];

            if (produto.cor) {
                caracteristicas.push(produto.cor);
            }

            if (produto.tamanho) {
                caracteristicas.push(`Tam. ${produto.tamanho}`);
            }

            detalhes.textContent = caracteristicas.length
                ? caracteristicas.join(" / ")
                : "Produto";

            info.append(nome, detalhes);

            const preco = document.createElement("strong");

            preco.textContent = formatarPreco(
                (Number(produto.preco) || 0) *
                (Number(produto.quantidade) || 1)
            );

            item.append(imagemContainer, info, preco);

            if (valores) {
                summaryContainer.insertBefore(item, valores);
            } else {
                summaryContainer.appendChild(item);
            }
        });

        const quantidade = calcularQuantidadeItens();
        const subtotal = calcularSubtotal();

        if (summaryItemsCount) {
            summaryItemsCount.textContent =
                `${quantidade} ${quantidade === 1 ? "item" : "itens"}`;
        }

        if (subtotalElement) {
            subtotalElement.textContent = formatarPreco(subtotal);
        }

        if (totalElement) {
            totalElement.textContent = formatarPreco(subtotal);
        }
    }

    /* =====================================================
       FORMAS DE PAGAMENTO
       ===================================================== */

    function atualizarCamposPagamento() {
        const pagamento = document.querySelector(
            'input[name="payment"]:checked'
        );

        if (!pagamento || !cardPaymentFields) return;

        const nome = pagamento
            .closest(".payment-option")
            ?.querySelector(".payment-text strong")
            ?.textContent.trim();

        cardPaymentFields.style.display =
            nome === "Cartão" ? "block" : "none";
    }

    paymentOptions.forEach((option) => {
        const radio = option.querySelector('input[type="radio"]');

        if (!radio) return;

        radio.addEventListener("change", () => {
            paymentOptions.forEach((item) => {
                item.classList.remove("selected");

                const check = item.querySelector(".payment-check");

                if (check) {
                    check.className =
                        "fa-regular fa-circle payment-check";
                }
            });

            option.classList.add("selected");

            const check = option.querySelector(".payment-check");

            if (check) {
                check.className =
                    "fa-solid fa-circle-check payment-check";
            }

            atualizarCamposPagamento();
        });
    });

    /* =====================================================
       MÁSCARA CEP
       ===================================================== */

    const cep = document.querySelector("#cep");

    if (cep) {
        cep.addEventListener("input", () => {
            let valor = cep.value
                .replace(/\D/g, "")
                .slice(0, 8);

            if (valor.length > 5) {
                valor = `${valor.slice(0, 5)}-${valor.slice(5)}`;
            }

            cep.value = valor;
        });
    }

    /* =====================================================
       MÁSCARA CARTÃO
       ===================================================== */

    const numeroCartao = document.querySelector("#card-number");

    if (numeroCartao) {
        numeroCartao.addEventListener("input", () => {
            const valor = numeroCartao.value
                .replace(/\D/g, "")
                .slice(0, 16);

            numeroCartao.value = valor.replace(
                /(\d{4})(?=\d)/g,
                "$1 "
            );
        });
    }

    /* =====================================================
       MÁSCARA VALIDADE
       ===================================================== */

    const campoValidade = document.querySelector("#expiration");

    if (campoValidade) {
        campoValidade.addEventListener("input", () => {
            let valor = campoValidade.value
                .replace(/\D/g, "")
                .slice(0, 4);

            if (valor.length > 2) {
                valor = `${valor.slice(0, 2)}/${valor.slice(2)}`;
            }

            campoValidade.value = valor;
        });
    }

    /* =====================================================
       MÁSCARA CVV
       ===================================================== */

    const campoCVV = document.querySelector("#cvv");

    if (campoCVV) {
        campoCVV.addEventListener("input", () => {
            campoCVV.value = campoCVV.value
                .replace(/\D/g, "")
                .slice(0, 4);
        });
    }

    /* =====================================================
       VALIDAR FORMULÁRIO
       ===================================================== */

    function validarFormulario() {
        const campos = [
            ["name", "Digite seu nome completo."],
            ["email", "Digite seu e-mail."],
            ["cep", "Digite seu CEP."],
            ["street", "Digite sua rua."],
            ["number", "Digite o número do endereço."],
            ["neighborhood", "Digite seu bairro."],
            ["city", "Digite sua cidade."],
            ["state", "Selecione seu estado."]
        ];

        for (const [id, mensagem] of campos) {
            const elemento = document.getElementById(id);

            if (!elemento || !elemento.value.trim()) {
                mostrarMensagem(mensagem);
                elemento?.focus();

                return false;
            }
        }

        const email = document
            .querySelector("#email")
            .value.trim();

        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
            mostrarMensagem("Digite um e-mail válido.");
            document.querySelector("#email").focus();

            return false;
        }

        if (!termsCheckbox || !termsCheckbox.checked) {
            mostrarMensagem(
                "Aceite os termos de compra para continuar."
            );

            return false;
        }

        const pagamento = document.querySelector(
            'input[name="payment"]:checked'
        );

        if (!pagamento) {
            mostrarMensagem("Selecione uma forma de pagamento.");
            return false;
        }

        const nomePagamento = pagamento
            .closest(".payment-option")
            ?.querySelector(".payment-text strong")
            ?.textContent.trim();

        if (nomePagamento === "Cartão") {
            const numero = document.querySelector("#card-number");
            const nome = document.querySelector("#card-name");
            const validade = document.querySelector("#expiration");
            const cvv = document.querySelector("#cvv");

            if (
                !numero ||
                numero.value.replace(/\D/g, "").length < 13 ||
                !nome ||
                !nome.value.trim() ||
                !validade ||
                !/^\d{2}\/\d{2}$/.test(validade.value) ||
                !cvv ||
                cvv.value.replace(/\D/g, "").length < 3
            ) {
                mostrarMensagem(
                    "Confira os dados preenchidos do cartão."
                );

                return false;
            }

            /*
             * Este protótipo não processa pagamentos.
             * Não armazene dados de cartão.
             */

            mostrarMensagem(
                "O pagamento por cartão ainda precisa de um serviço de pagamento integrado."
            );

            return false;
        }

        return true;
    }

    /* =====================================================
       GERAR ID ÚNICO DO PEDIDO
       ===================================================== */

    function gerarIdPedido() {
        const agora = new Date();

        const data = [
            agora.getFullYear(),
            String(agora.getMonth() + 1).padStart(2, "0"),
            String(agora.getDate()).padStart(2, "0")
        ].join("");

        const aleatorio = Math.random()
            .toString(36)
            .slice(2, 8)
            .toUpperCase();

        return `NVA-${data}-${aleatorio}`;
    }

    /* =====================================================
       FINALIZAR PEDIDO — SUPABASE
       ===================================================== */

    if (finishButton) {
        finishButton.addEventListener("click", async (event) => {
            event.preventDefault();

            if (finalizando) return;

            if (!validarFormulario()) return;

            if (
                !window.NovaPedidos ||
                typeof window.NovaPedidos.salvarPedido !== "function"
            ) {
                mostrarMensagem(
                    "Sistema de pedidos indisponível. Atualize a página e tente novamente."
                );

                console.error(
                    "window.NovaPedidos.salvarPedido não está disponível."
                );

                return;
            }

            const pagamento = document.querySelector(
                'input[name="payment"]:checked'
            );

            const formaPagamento = pagamento
                ?.closest(".payment-option")
                ?.querySelector(".payment-text strong")
                ?.textContent.trim() || "Não informado";

            const subtotal = calcularSubtotal();

            const cliente = {
                nome: document.querySelector("#name").value.trim(),
                email: document.querySelector("#email").value.trim(),

                endereco: {
                    cep: document.querySelector("#cep").value.trim(),
                    rua: document.querySelector("#street").value.trim(),
                    numero: document.querySelector("#number").value.trim(),
                    complemento:
                        document.querySelector("#complement")?.value.trim() || "",
                    bairro:
                        document.querySelector("#neighborhood").value.trim(),
                    cidade: document.querySelector("#city").value.trim(),
                    estado: document.querySelector("#state").value
                }
            };

            const pedido = {
                id: gerarIdPedido(),

                cliente,

                pagamento: formaPagamento,

                itens: carrinho.map((item) => ({
                    id: item.id ?? "",
                    nome: item.nome || "Produto NØVA",
                    preco: Number(item.preco) || 0,
                    quantidade: Math.max(
                        1,
                        Number.parseInt(item.quantidade, 10) || 1
                    ),
                    imagem: item.imagem || "",
                    cor: item.cor || "",
                    tamanho: item.tamanho || ""
                })),

                subtotal,
                frete: 0,
                total: subtotal,
                status: "Pendente",
                criadoEm: new Date().toISOString()
            };

            /* Bloquear cliques repetidos durante o salvamento. */

            finalizando = true;
            finishButton.disabled = true;
            finishButton.setAttribute("aria-busy", "true");
            finishButton.textContent = "Salvando pedido...";

            try {
                /*
                 * Aguarda a confirmação do Supabase.
                 * Não limpar o carrinho antes deste passo.
                 */

                const pedidoSalvo =
                    await window.NovaPedidos.salvarPedido(pedido);

                if (!pedidoSalvo || !pedidoSalvo.id) {
                    throw new Error(
                        "O sistema não confirmou o salvamento do pedido."
                    );
                }

                /*
                 * Salvar o último pedido localmente para a página
                 * de confirmação, somente depois do sucesso.
                 */

                localStorage.setItem(
                    ORDER_KEY,
                    JSON.stringify(pedidoSalvo)
                );

                /*
                 * Limpar o carrinho apenas depois que o Supabase
                 * confirmar a inserção.
                 */

                localStorage.removeItem(CART_KEY);

                finishButton.textContent = "Pedido registrado!";

                mostrarMensagem("Pedido registrado com sucesso!");

                setTimeout(() => {
                    window.location.href = "pedido-realizado.html";
                }, 800);

            } catch (erro) {
                console.error(
                    "Erro ao registrar pedido:",
                    erro
                );

                mostrarMensagem(
                    erro.message ||
                    "Não foi possível registrar o pedido. Tente novamente."
                );

                /*
                 * Preservar o carrinho e liberar nova tentativa.
                 */

                finalizando = false;
                finishButton.disabled = false;
                finishButton.removeAttribute("aria-busy");
                finishButton.textContent = "Finalizar pedido";
            }
        });
    }

    /* =====================================================
       INICIALIZAÇÃO
       ===================================================== */

    renderizarResumo();
    atualizarCamposPagamento();

    console.log("NØVA checkout inicializado.");
});