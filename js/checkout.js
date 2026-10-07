document.addEventListener("DOMContentLoaded", () => {

    const CART_KEY = "novaCarrinho";
    const PEDIDOS_KEY = "novaPedidos";
    const ORDER_KEY = "novaPedido";

    let carrinho =
        JSON.parse(localStorage.getItem(CART_KEY)) || [];


    /* =====================================================
       VERIFICAR CARRINHO
    ===================================================== */

    if (carrinho.length === 0) {

        mostrarMensagem("Seu carrinho está vazio.");

        setTimeout(() => {
            window.location.href = "carrinho.html";
        }, 1500);

        return;
    }


    /* =====================================================
       ELEMENTOS
    ===================================================== */

    const summaryContainer =
        document.querySelector(".checkout-summary");

    const summaryProducts =
        document.querySelectorAll(".summary-product");

    const summaryItemsCount =
        document.querySelector(
            ".checkout-summary-heading span"
        );

    const subtotalElement =
        document.querySelector(
            ".checkout-summary-values div:first-child strong"
        );

    const totalElement =
        document.querySelector(
            ".checkout-total strong"
        );

    const finishButton =
        document.querySelector(".finish-order");

    const paymentOptions =
        document.querySelectorAll(".payment-option");

    const cardPaymentFields =
        document.querySelector(".card-payment-fields");

    const termsCheckbox =
        document.querySelector(".terms-check input");


    /* =====================================================
       FORMATAR PREÇO
    ===================================================== */

    function formatarPreco(valor) {

        return Number(valor).toLocaleString(
            "pt-BR",
            {
                style: "currency",
                currency: "BRL"
            }
        );
    }


    /* =====================================================
       QUANTIDADE DE ITENS
    ===================================================== */

    function calcularQuantidadeItens() {

        return carrinho.reduce(
            (total, produto) =>
                total + Number(produto.quantidade || 0),
            0
        );
    }


    /* =====================================================
       SUBTOTAL
    ===================================================== */

    function calcularSubtotal() {

        return carrinho.reduce(
            (total, produto) => {

                return total +
                    (
                        Number(produto.preco || 0) *
                        Number(produto.quantidade || 0)
                    );

            },
            0
        );
    }


    /* =====================================================
       RENDERIZAR RESUMO
    ===================================================== */

    function renderizarResumo() {

        summaryProducts.forEach(item => {
            item.remove();
        });


        carrinho.forEach(produto => {

            const item =
                document.createElement("div");

            item.className =
                "summary-product";


            const detalhes = [];

            if (produto.cor) {
                detalhes.push(produto.cor);
            }

            if (produto.tamanho) {
                detalhes.push(produto.tamanho);
            }


            const detalhesTexto =
                detalhes.length
                    ? detalhes.join(" / ")
                    : "Produto";


            item.innerHTML = `

                <div class="summary-product-image">

                    <span>
                        IMG
                    </span>

                    <b>
                        ${produto.quantidade}
                    </b>

                </div>


                <div class="summary-product-info">

                    <h3>
                        ${produto.nome}
                    </h3>

                    <span>
                        ${detalhesTexto}
                    </span>

                </div>


                <strong>
                    ${formatarPreco(
                        Number(produto.preco || 0) *
                        Number(produto.quantidade || 0)
                    )}
                </strong>

            `;


            const valores =
                document.querySelector(
                    ".checkout-summary-values"
                );


            summaryContainer.insertBefore(
                item,
                valores
            );

        });


        const quantidade =
            calcularQuantidadeItens();

        const subtotal =
            calcularSubtotal();


        if (summaryItemsCount) {

            summaryItemsCount.textContent =
                `${quantidade} ${
                    quantidade === 1
                        ? "item"
                        : "itens"
                }`;
        }


        if (subtotalElement) {

            subtotalElement.textContent =
                formatarPreco(subtotal);
        }


        if (totalElement) {

            totalElement.textContent =
                formatarPreco(subtotal);
        }

    }


    /* =====================================================
       FORMAS DE PAGAMENTO
    ===================================================== */

    paymentOptions.forEach(option => {

        const radio =
            option.querySelector(
                'input[type="radio"]'
            );


        radio.addEventListener(
            "change",
            () => {

                paymentOptions.forEach(item => {

                    item.classList.remove(
                        "selected"
                    );


                    const check =
                        item.querySelector(
                            ".payment-check"
                        );


                    if (check) {

                        check.className =
                            "fa-regular fa-circle payment-check";
                    }

                });


                option.classList.add(
                    "selected"
                );


                const check =
                    option.querySelector(
                        ".payment-check"
                    );


                if (check) {

                    check.className =
                        "fa-solid fa-circle-check payment-check";
                }


                atualizarCamposPagamento();

            }
        );

    });


    function atualizarCamposPagamento() {

        const pagamento =
            document.querySelector(
                'input[name="payment"]:checked'
            );


        if (!pagamento) {
            return;
        }


        const option =
            pagamento.closest(
                ".payment-option"
            );


        const nome =
            option
                ?.querySelector(
                    ".payment-text strong"
                )
                ?.textContent
                .trim();


        if (!cardPaymentFields) {
            return;
        }


        if (nome === "Cartão") {

            cardPaymentFields.style.display =
                "block";

        } else {

            cardPaymentFields.style.display =
                "none";

        }

    }


    /* =====================================================
       MÁSCARA CEP
    ===================================================== */

    const cep =
        document.querySelector("#cep");


    if (cep) {

        cep.addEventListener(
            "input",
            () => {

                let valor =
                    cep.value
                        .replace(/\D/g, "")
                        .slice(0, 8);


                if (valor.length > 5) {

                    valor =
                        valor.substring(0, 5) +
                        "-" +
                        valor.substring(5);

                }


                cep.value = valor;

            }
        );

    }


    /* =====================================================
       MÁSCARA CARTÃO
    ===================================================== */

    const numeroCartao =
        document.querySelector("#card-number");


    if (numeroCartao) {

        numeroCartao.addEventListener(
            "input",
            () => {

                let valor =
                    numeroCartao.value
                        .replace(/\D/g, "")
                        .slice(0, 16);


                valor =
                    valor.replace(
                        /(\d{4})(?=\d)/g,
                        "$1 "
                    );


                numeroCartao.value =
                    valor;

            }
        );

    }


    /* =====================================================
       MÁSCARA VALIDADE
    ===================================================== */

    const validade =
        document.querySelector("#expiration");


    if (validade) {

        validade.addEventListener(
            "input",
            () => {

                let valor =
                    validade.value
                        .replace(/\D/g, "")
                        .slice(0, 4);


                if (valor.length > 2) {

                    valor =
                        valor.substring(0, 2) +
                        "/" +
                        valor.substring(2);

                }


                validade.value =
                    valor;

            }
        );

    }


    /* =====================================================
       MÁSCARA CVV
    ===================================================== */

    const cvv =
        document.querySelector("#cvv");


    if (cvv) {

        cvv.addEventListener(
            "input",
            () => {

                cvv.value =
                    cvv.value
                        .replace(/\D/g, "")
                        .slice(0, 4);

            }
        );

    }


    /* =====================================================
       VALIDAR FORMULÁRIO
    ===================================================== */

    function validarFormulario() {

        const campos = [

            {
                id: "name",
                mensagem:
                    "Digite seu nome completo."
            },

            {
                id: "email",
                mensagem:
                    "Digite seu e-mail."
            },

            {
                id: "cep",
                mensagem:
                    "Digite seu CEP."
            },

            {
                id: "street",
                mensagem:
                    "Digite sua rua."
            },

            {
                id: "number",
                mensagem:
                    "Digite o número do endereço."
            },

            {
                id: "neighborhood",
                mensagem:
                    "Digite seu bairro."
            },

            {
                id: "city",
                mensagem:
                    "Digite sua cidade."
            },

            {
                id: "state",
                mensagem:
                    "Selecione seu estado."
            }

        ];


        for (const campo of campos) {

            const elemento =
                document.querySelector(
                    `#${campo.id}`
                );


            if (
                !elemento ||
                !elemento.value.trim()
            ) {

                mostrarMensagem(
                    campo.mensagem
                );

                elemento?.focus();

                return false;
            }

        }


        const email =
            document.querySelector(
                "#email"
            ).value.trim();


        if (
            !/^[^\s@]+@[^\s@]+\.[^\s@]+$/
                .test(email)
        ) {

            mostrarMensagem(
                "Digite um e-mail válido."
            );

            return false;
        }


        if (
            !termsCheckbox ||
            !termsCheckbox.checked
        ) {

            mostrarMensagem(
                "Aceite os termos de compra para continuar."
            );

            return false;
        }


        const pagamento =
            document.querySelector(
                'input[name="payment"]:checked'
            );


        if (!pagamento) {

            mostrarMensagem(
                "Selecione uma forma de pagamento."
            );

            return false;
        }


        const nomePagamento =
            pagamento
                .closest(".payment-option")
                ?.querySelector(
                    ".payment-text strong"
                )
                ?.textContent
                .trim();


        if (nomePagamento === "Cartão") {

            const numero =
                document.querySelector(
                    "#card-number"
                );

            const nome =
                document.querySelector(
                    "#card-name"
                );

            const validade =
                document.querySelector(
                    "#expiration"
                );

            const cvv =
                document.querySelector(
                    "#cvv"
                );


            if (
                !numero.value.trim() ||
                !nome.value.trim() ||
                !validade.value.trim() ||
                !cvv.value.trim()
            ) {

                mostrarMensagem(
                    "Preencha todos os dados do cartão."
                );

                return false;
            }

        }


        return true;
    }


    /* =====================================================
       GERAR ID
    ===================================================== */

    function gerarIdPedido() {

        const agora =
            new Date();


        const ano =
            agora.getFullYear();


        const mes =
            String(
                agora.getMonth() + 1
            ).padStart(2, "0");


        const dia =
            String(
                agora.getDate()
            ).padStart(2, "0");


        const numero =
            Math.floor(
                1000 +
                Math.random() * 9000
            );


        return `NVA-${ano}${mes}${dia}-${numero}`;

    }


    /* =====================================================
       FINALIZAR PEDIDO
    ===================================================== */

    if (finishButton) {

        finishButton.addEventListener(
            "click",
            () => {

                if (!validarFormulario()) {
                    return;
                }


                const pagamento =
                    document.querySelector(
                        'input[name="payment"]:checked'
                    );


                const formaPagamento =
                    pagamento
                        ?.closest(".payment-option")
                        ?.querySelector(
                            ".payment-text strong"
                        )
                        ?.textContent
                        .trim();


                const subtotal =
                    calcularSubtotal();


                const pedidoId =
                    gerarIdPedido();


                /* -----------------------------------------
                   PEDIDO COMPATÍVEL COM O ADM
                ----------------------------------------- */

                const pedido = {

                    id: pedidoId,


                    cliente: {

                        nome:
                            document
                                .querySelector("#name")
                                .value
                                .trim(),

                        email:
                            document
                                .querySelector("#email")
                                .value
                                .trim()

                    },


                    endereco: {

                        cep:
                            document
                                .querySelector("#cep")
                                .value
                                .trim(),

                        rua:
                            document
                                .querySelector("#street")
                                .value
                                .trim(),

                        numero:
                            document
                                .querySelector("#number")
                                .value
                                .trim(),

                        complemento:
                            document
                                .querySelector("#complement")
                                .value
                                .trim(),

                        bairro:
                            document
                                .querySelector("#neighborhood")
                                .value
                                .trim(),

                        cidade:
                            document
                                .querySelector("#city")
                                .value
                                .trim(),

                        estado:
                            document
                                .querySelector("#state")
                                .value

                    },


                    pagamento:
                        formaPagamento,


                    itens:
                        carrinho.map(item => ({

                            id:
                                item.id,

                            nome:
                                item.nome,

                            preco:
                                Number(
                                    item.preco || 0
                                ),

                            quantidade:
                                Number(
                                    item.quantidade || 1
                                ),

                            imagem:
                                item.imagem || "",

                            cor:
                                item.cor || "",

                            tamanho:
                                item.tamanho || ""

                        })),


                    subtotal:
                        subtotal,


                    frete:
                        0,


                    total:
                        subtotal,


                    status:
                        "pending",


                    criadoEm:
                        new Date().toISOString()

                };


                /* -----------------------------------------
                   SALVAR PEDIDO ATUAL
                ----------------------------------------- */

                localStorage.setItem(
                    ORDER_KEY,
                    JSON.stringify(pedido)
                );


                /* -----------------------------------------
                   SALVAR NO ADM
                ----------------------------------------- */

                let pedidos = [];


                try {

                    const dados =
                        localStorage.getItem(
                            PEDIDOS_KEY
                        );


                    if (dados) {

                        const convertidos =
                            JSON.parse(dados);


                        if (
                            Array.isArray(convertidos)
                        ) {

                            pedidos =
                                convertidos;

                        }

                    }

                } catch (erro) {

                    console.error(
                        "Erro ao carregar pedidos:",
                        erro
                    );

                    pedidos = [];

                }


                pedidos.push(pedido);


                localStorage.setItem(
                    PEDIDOS_KEY,
                    JSON.stringify(pedidos)
                );


                /* -----------------------------------------
                   BOTÃO
                ----------------------------------------- */

                finishButton.disabled =
                    true;


                finishButton.innerHTML = `
                    Processando pedido
                    <i class="fa-solid fa-spinner fa-spin"></i>
                `;


                setTimeout(() => {

                    localStorage.removeItem(
                        CART_KEY
                    );


                    window.location.href =
                        "pedido-realizado.html";

                }, 800);

            }
        );

    }


    /* =====================================================
       MENSAGEM
    ===================================================== */

    function mostrarMensagem(texto) {

        const antiga =
            document.querySelector(
                ".nova-mensagem"
            );


        if (antiga) {
            antiga.remove();
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


    /* =====================================================
       INICIAR
    ===================================================== */

    renderizarResumo();

    atualizarCamposPagamento();

});