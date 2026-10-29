
/* =========================================================
   VÉRTICE ADM — CONFIGURAÇÕES
   Arquivo: admin/js/config.js

   Integração com:
   - public.produtos_nova
   - public.configuracoes_nova
   - Supabase Auth

   IMPORTANTE:
   - Não altera os preços originais dos produtos.
   - Salva destaques e promoções separadamente.
   ========================================================= */

document.addEventListener("DOMContentLoaded", async () => {
    "use strict";

    /* =====================================================
       1. ELEMENTOS
       ===================================================== */

    const supabaseClient = window.supabaseClient;

    const botaoSalvar = document.querySelector("#salvar-configuracoes");
    const botaoRestaurarTema =
        document.querySelector("#restaurar-tema-nova");
    const bannerArquivo = document.querySelector("#banner-arquivo");
    const bannerPreview = document.querySelector("#banner-preview");
    const previewTema = document.querySelector("#config-theme-preview");
    const previewDestaque =
        document.querySelector("#preview-cor-destaque");
    const previewBotaoTema =
        document.querySelector("#preview-botao-tema");

    const listaDestaques =
        document.querySelector("#lista-produtos-destaque");

    const listaPromocoes =
        document.querySelector("#lista-produtos-promocao");
    const buscaProdutoDestaque =
        document.querySelector("#busca-produto-destaque");
    const buscaProdutoPromocao =
        document.querySelector("#busca-produto-promocao");
    const resultadoBuscaDestaque =
        document.querySelector("#resultado-busca-destaque");
    const resultadoBuscaPromocao =
        document.querySelector("#resultado-busca-promocao");
    const formCupom = document.querySelector("#form-cupom");
    const listaCupons = document.querySelector("#lista-cupons");
    const freteCepOrigem = document.querySelector("#frete-cep-origem");
    const freteRetiradaAtiva = document.querySelector("#frete-retirada-ativa");
    const freteEnderecoRetirada =
        document.querySelector("#frete-endereco-retirada");
    const freteMotoboyAtivo = document.querySelector("#frete-motoboy-ativo");
    const freteWhatsapp = document.querySelector("#frete-whatsapp");

    const bucketImagens = "nova-produtos";
    const tamanhoMaximoBanner = 5 * 1024 * 1024;
    const tiposImagemPermitidos = new Set([
        "image/jpeg",
        "image/png",
        "image/webp",
        "image/gif"
    ]);

    const camposCores = [
        {
            nome: "Fundo",
            seletor: "#cor-fundo",
            texto: "#hex-fundo",
            valorInicial: "#F7F4EE"
        },
        {
            nome: "Superfície",
            seletor: "#cor-superficie",
            texto: "#hex-superficie",
            valorInicial: "#FFFFFF"
        },
        {
            nome: "Destaque",
            seletor: "#cor-destaque",
            texto: "#hex-destaque",
            valorInicial: "#9A6A45"
        },
        {
            nome: "Texto",
            seletor: "#cor-texto",
            texto: "#hex-texto",
            valorInicial: "#191916"
        }
    ];

    /* =====================================================
       2. ESTADO
       ===================================================== */

    const estado = {
        cores: {},
        configuracoesSalvas: {},
        banner: "",
        destaques: [],
        promocoes: [],
        cupons: [],
        frete: {
            provedor: "melhor_envio",
            cepOrigem: "57800000",
            retirada: { ativa: false, endereco: "" },
            motoboy: { ativo: false, whatsapp: "" }
        },
        produtos: [],
        carregando: false,
        enviandoBanner: false,
        alteracoesPendentes: false,
        administradorAutorizado: false
    };

    /* =====================================================
       3. UTILITÁRIOS
       ===================================================== */

    function normalizarTexto(valor) {
        return String(valor ?? "").trim();
    }

    function normalizarBuscaProduto(valor) {
        return normalizarTexto(valor)
            .normalize("NFD")
            .replace(/[\u0300-\u036f]/g, "")
            .toLocaleLowerCase("pt-BR");
    }

    function normalizarCodigoCupom(valor) {
        return normalizarTexto(valor).toUpperCase();
    }

    function normalizarCep(valor) {
        return String(valor ?? "").replace(/\D/g, "").slice(0, 8);
    }

    function validarDataCupom(valor) {
        if (!valor) return true;

        const partes = valor.match(/^(\d{4})-(\d{2})-(\d{2})$/);

        if (!partes) {
            return false;
        }

        const [, ano, mes, dia] = partes;
        const data = new Date(Number(ano), Number(mes) - 1, Number(dia));

        return !Number.isNaN(data.getTime()) &&
            data.getFullYear() === Number(ano) &&
            data.getMonth() === Number(mes) - 1 &&
            data.getDate() === Number(dia);
    }

    function converterParaHex(valor) {
        const texto = normalizarTexto(valor);

        let correspondencia = texto.match(
            /^#([0-9a-f]{3}|[0-9a-f]{6})$/i
        );

        if (correspondencia) {
            let hex = correspondencia[1];

            if (hex.length === 3) {
                hex = hex
                    .split("")
                    .map(letra => letra + letra)
                    .join("");
            }

            return `#${hex.toUpperCase()}`;
        }

        correspondencia = texto.match(
            /^rgba?\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})(?:\s*,\s*(?:0|1|0?\.\d+))?\s*\)$/i
        ) || texto.match(
            /^(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})$/
        );

        if (!correspondencia) {
            return null;
        }

        const valores = [
            Number(correspondencia[1]),
            Number(correspondencia[2]),
            Number(correspondencia[3])
        ];

        if (valores.some(numero =>
            !Number.isInteger(numero) ||
            numero < 0 ||
            numero > 255
        )) {
            return null;
        }

        return "#" + valores
            .map(numero => numero.toString(16).padStart(2, "0"))
            .join("")
            .toUpperCase();
    }

    function validarUrlImagem(valor) {
        try {
            const url = new URL(normalizarTexto(valor));

            if (!["https:", "http:"].includes(url.protocol)) {
                return null;
            }

            return url.href;
        } catch {
            return null;
        }
    }

    function formatarPreco(valor) {
        const numero = Number(valor);

        if (!Number.isFinite(numero)) {
            return "Preço indisponível";
        }

        return numero.toLocaleString("pt-BR", {
            style: "currency",
            currency: "BRL"
        });
    }

    function mostrarNotificacao(mensagem, tipo = "info") {
        let notificacao = document.querySelector(
            "#config-notificacao"
        );

        if (!notificacao) {
            notificacao = document.createElement("div");
            notificacao.id = "config-notificacao";
            notificacao.setAttribute("role", "status");
            notificacao.setAttribute("aria-live", "polite");

            Object.assign(notificacao.style, {
                position: "fixed",
                top: "20px",
                right: "20px",
                zIndex: "99999",
                maxWidth: "min(400px, calc(100vw - 40px))",
                padding: "15px 18px",
                background: "#FFFFFF",
                color: "#191916",
                border: "1px solid #DED8CD",
                borderRadius: "10px",
                fontSize: "13px",
                lineHeight: "1.6",
                boxShadow: "0 10px 30px rgba(0,0,0,.3)"
            });

            document.body.appendChild(notificacao);
        }

        notificacao.textContent = mensagem;
        notificacao.style.borderColor =
            tipo === "erro" ? "#b94b55" :
            tipo === "sucesso" ? "#438a65" :
            "#9A6A45";
    }

    function marcarAlteracao() {
        estado.alteracoesPendentes = true;

        if (botaoSalvar) {
            botaoSalvar.disabled =
                !estado.administradorAutorizado ||
                estado.carregando ||
                estado.enviandoBanner;
        }
    }

    function atualizarPreviaTema() {
        if (!previewTema) return;

        const fundo = estado.cores.Fundo || "#F7F4EE";
        const superficie = estado.cores.Superfície || "#FFFFFF";
        const destaque = estado.cores.Destaque || "#9A6A45";
        const texto = estado.cores.Texto || "#191916";

        previewTema.style.setProperty("--preview-fundo", fundo);
        previewTema.style.setProperty("--preview-superficie", superficie);
        previewTema.style.setProperty("--preview-texto", texto);
        previewTema.style.setProperty("--preview-destaque", destaque);

        if (previewDestaque) {
            previewDestaque.style.backgroundColor = destaque;
        }

        if (previewBotaoTema) {
            previewBotaoTema.style.backgroundColor = destaque;
            previewBotaoTema.style.color = texto;
        }
    }

    /* =====================================================
       4. CORES
       ===================================================== */

    function configurarCamposCores() {
        camposCores.forEach(campo => {
            const seletor = document.querySelector(campo.seletor);
            const texto = document.querySelector(campo.texto);

            if (!seletor || !texto) {
                console.warn(
                    `[Vértice] Campo de cor ausente: ${campo.nome}`
                );
                return;
            }

            const corInicial =
                converterParaHex(seletor.value) ||
                campo.valorInicial;

            seletor.value = corInicial;
            texto.value = corInicial;
            estado.cores[campo.nome] = corInicial;

            seletor.addEventListener("input", () => {
                const cor = converterParaHex(seletor.value);

                if (!cor) return;

                texto.value = cor;
                texto.setCustomValidity("");
                estado.cores[campo.nome] = cor;
                atualizarPreviaTema();

                marcarAlteracao();
            });

            texto.addEventListener("input", () => {
                const cor = converterParaHex(texto.value);

                if (!cor) {
                    texto.setCustomValidity(
                        "Digite um HEX válido ou uma cor RGB entre 0 e 255."
                    );
                    return;
                }

                texto.setCustomValidity("");
                seletor.value = cor;
                estado.cores[campo.nome] = cor;
                atualizarPreviaTema();

                marcarAlteracao();
            });

            texto.addEventListener("blur", () => {
                const cor = converterParaHex(texto.value);

                if (!cor) {
                    texto.reportValidity();
                    return;
                }

                texto.value = cor;
                seletor.value = cor;
            });
        });

        atualizarPreviaTema();
    }

    function restaurarTemaNova() {
        camposCores.forEach(campo => {
            const seletor = document.querySelector(campo.seletor);
            const texto = document.querySelector(campo.texto);

            if (!seletor || !texto) return;

            seletor.value = campo.valorInicial;
            texto.value = campo.valorInicial;
            texto.setCustomValidity("");
            estado.cores[campo.nome] = campo.valorInicial;
        });

        atualizarPreviaTema();
        marcarAlteracao();
    }

    function validarCamposCores() {
        for (const campo of camposCores) {
            const texto = document.querySelector(campo.texto);
            const cor = converterParaHex(texto?.value);

            if (!cor) {
                texto?.setCustomValidity(
                    `A cor "${campo.nome}" é inválida.`
                );
                texto?.reportValidity();
                texto?.focus();
                return false;
            }

            texto.setCustomValidity("");
            estado.cores[campo.nome] = cor;
        }

        return true;
    }

    /* =====================================================
       5. PRÉ-VISUALIZAÇÃO DO BANNER
       ===================================================== */

    function mostrarPlaceholderBanner(titulo, detalhe) {
        if (!bannerPreview) return;

        bannerPreview.classList.remove("has-image");
        bannerPreview.replaceChildren();

        const container = document.createElement("div");
        container.className = "banner-placeholder";

        const icone = document.createElement("i");
        icone.className = "fa-regular fa-images";
        icone.setAttribute("aria-hidden", "true");

        const texto = document.createElement("span");
        texto.textContent = titulo;

        const descricao = document.createElement("small");
        descricao.textContent = detalhe;

        container.append(icone, texto, descricao);
        bannerPreview.appendChild(container);
    }

    function visualizarBanner(
        urlRecebida,
        marcarAlteracaoPendente = true
    ) {
        if (!bannerPreview) return Promise.resolve(false);

        const url = validarUrlImagem(urlRecebida);

        if (!url) {
            mostrarPlaceholderBanner(
                "Imagem inválida",
                "O endereço do banner não é válido."
            );
            return Promise.resolve(false);
        }

        mostrarPlaceholderBanner(
            "Carregando imagem...",
            "Aguarde a pré-visualização."
        );

        return new Promise(resolve => {
            const imagem = new Image();
            imagem.alt = "Pré-visualização do banner da Vértice";

            imagem.onload = () => {
                bannerPreview.replaceChildren(imagem);
                bannerPreview.classList.add("has-image");

                estado.banner = url;
                if (marcarAlteracaoPendente) {
                    marcarAlteracao();
                }
                resolve(true);
            };

            imagem.onerror = () => {
                mostrarPlaceholderBanner(
                    "Não foi possível carregar a imagem",
                    "Confira as permissões de leitura pública do bucket nova-produtos."
                );
                resolve(false);
            };

            imagem.src = url;
        });
    }

    async function enviarBanner(arquivo) {
        if (!tiposImagemPermitidos.has(arquivo.type)) {
            throw new Error("Formato inválido. Use JPG, PNG, WebP ou GIF.");
        }

        if (arquivo.size > tamanhoMaximoBanner) {
            throw new Error("O banner deve ter no máximo 5 MB.");
        }

        await verificarPermissaoAdmin();

        if (!supabaseClient?.storage) {
            throw new Error("O armazenamento do Supabase não está disponível.");
        }

        const extensaoPorTipo = {
            "image/jpeg": "jpg",
            "image/png": "png",
            "image/webp": "webp",
            "image/gif": "gif"
        };
        const identificador = window.crypto?.randomUUID
            ? window.crypto.randomUUID()
            : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
        const caminho =
            `banners/${identificador}.${extensaoPorTipo[arquivo.type]}`;

        const { error } = await supabaseClient.storage
            .from(bucketImagens)
            .upload(caminho, arquivo, {
                cacheControl: "3600",
                upsert: false,
                contentType: arquivo.type
            });

        if (error) {
            throw error;
        }

        const { data } = supabaseClient.storage
            .from(bucketImagens)
            .getPublicUrl(caminho);
        const url = validarUrlImagem(data?.publicUrl);

        if (!url) {
            throw new Error(
                "O Supabase não retornou uma URL pública válida para o banner."
            );
        }

        const imagemCarregada = await visualizarBanner(url);

        if (!imagemCarregada) {
            throw new Error(
                "O banner foi enviado, mas não pôde ser carregado. Verifique se o bucket permite leitura pública."
            );
        }
    }

    function configurarBanner() {
        bannerArquivo?.addEventListener("change", async () => {
            const arquivo = bannerArquivo.files?.[0];
            if (!arquivo) return;

            estado.enviandoBanner = true;
            bannerArquivo.disabled = true;
            if (botaoSalvar) {
                botaoSalvar.disabled = true;
            }
            mostrarPlaceholderBanner(
                "Enviando banner...",
                "Aguarde o envio para o Supabase Storage."
            );

            try {
                await enviarBanner(arquivo);
                mostrarNotificacao(
                    "Banner enviado. Salve as configurações para publicá-lo.",
                    "sucesso"
                );
            } catch (erro) {
                console.error("[Vértice Config] Erro ao enviar banner:", erro);
                mostrarNotificacao(
                    erro.message || "Não foi possível enviar o banner.",
                    "erro"
                );
                mostrarPlaceholderBanner(
                    "Falha no envio do banner",
                    "Confira sua conexão e as permissões do bucket no Supabase."
                );
                bannerArquivo.value = "";
            } finally {
                estado.enviandoBanner = false;
                bannerArquivo.disabled = false;
                if (botaoSalvar) {
                    botaoSalvar.disabled =
                        !estado.administradorAutorizado ||
                        estado.carregando;
                }
            }
        });
    }

    /* =====================================================
       6. PRODUTOS — CONSULTA AO SUPABASE
       ===================================================== */

    async function carregarProdutos() {
        if (!supabaseClient) {
            throw new Error(
                "O cliente Supabase não foi inicializado. Confira os scripts do config.html."
            );
        }

        const { data, error } = await supabaseClient
            .from("produtos_nova")
            .select("id, nome, categoria, descricao, preco, estoque, ativo, imagem, imagens")
            .order("nome", { ascending: true });

        if (error) {
            throw error;
        }

        estado.produtos = (data || []).map(produto => ({
            id: produto.id,
            nome: produto.nome || "Produto sem nome",
            categoria: produto.categoria || "",
            descricao: produto.descricao || "",
            preco: Number(produto.preco),
            estoque: Number(produto.estoque ?? 0),
            ativo: produto.ativo === true,
            imagem: produto.imagem || "",
            imagens: Array.isArray(produto.imagens)
                ? produto.imagens
                : []
        }));

        renderizarListasProdutos();
    }

    /* =====================================================
       7. CRIAÇÃO DE ELEMENTOS DE PRODUTO
       ===================================================== */

    function criarImagemProduto(produto) {
        const imagem = document.createElement("img");
        imagem.alt = produto.nome;
        imagem.loading = "lazy";

        const url = validarUrlImagem(produto.imagem);

        if (url) {
            imagem.src = url;
        } else {
            imagem.style.display = "none";
        }

        imagem.onerror = () => {
            imagem.style.display = "none";
        };

        return imagem;
    }

    function criarInformacoesProduto(produto, descricaoExtra) {
        const informacoes = document.createElement("div");
        informacoes.className = "config-product-info";

        const nome = document.createElement("h4");
        nome.textContent = produto.nome;

        const descricao = document.createElement("p");
        descricao.textContent = descricaoExtra;

        informacoes.append(nome, descricao);

        return informacoes;
    }

    function criarProdutoDestaque(produto) {
        const item = document.createElement("article");
        item.className = "config-product-item";

        const imagem = criarImagemProduto(produto);

        const informacoes = criarInformacoesProduto(
            produto,
            `Código: ${produto.id} · ${produto.categoria || "Sem categoria"} · ${formatarPreco(produto.preco)} · Estoque: ${produto.estoque}`
        );

        const controles = document.createElement("div");
        controles.className = "config-product-controls";

        const label = document.createElement("label");
        const checkbox = document.createElement("input");

        checkbox.type = "checkbox";
        checkbox.checked = estado.destaques.includes(String(produto.id));
        checkbox.disabled = !produto.ativo;

        label.append(
            checkbox,
            document.createTextNode(
                produto.ativo ? "Em destaque" : "Produto inativo"
            )
        );

        checkbox.addEventListener("change", () => {
            if (checkbox.checked) {
                const id = String(produto.id);
                if (!estado.destaques.includes(id)) {
                    estado.destaques.push(id);
                }
            } else {
                estado.destaques = estado.destaques.filter(
                    id => id !== String(produto.id)
                );
            }

            marcarAlteracao();
        });

        controles.appendChild(label);
        item.append(imagem, informacoes, controles);

        return item;
    }

    function criarProdutoPromocao(produto) {
        const item = document.createElement("article");
        item.className = "config-product-item";

        const imagem = criarImagemProduto(produto);

        const informacoes = criarInformacoesProduto(
            produto,
            `Código: ${produto.id} · Preço original: ${formatarPreco(produto.preco)}`
        );

        const controles = document.createElement("div");
        controles.className = "config-product-controls";

        const promocaoAtual = estado.promocoes.find(
            promocao => promocao.id === String(produto.id)
        );

        const label = document.createElement("label");
        const checkbox = document.createElement("input");

        checkbox.type = "checkbox";
        checkbox.checked = Boolean(promocaoAtual);
        checkbox.disabled = !produto.ativo || produto.estoque <= 0;

        label.append(
            checkbox,
            document.createTextNode("Em promoção")
        );

        const campoPreco = document.createElement("input");

        campoPreco.type = "number";
        campoPreco.min = "0.01";
        campoPreco.step = "0.01";
        campoPreco.placeholder = "Preço promocional";
        campoPreco.disabled = !checkbox.checked;
        campoPreco.setAttribute(
            "aria-label",
            `Preço promocional de ${produto.nome}`
        );

        if (promocaoAtual) {
            campoPreco.value = promocaoAtual.preco;
        }

        checkbox.addEventListener("change", () => {
            if (checkbox.checked) {
                estado.promocoes.push({
                    id: String(produto.id),
                    preco: ""
                });
            } else {
                estado.promocoes = estado.promocoes.filter(
                    promocao => promocao.id !== String(produto.id)
                );

                campoPreco.value = "";
                campoPreco.setCustomValidity("");
            }

            campoPreco.disabled = !checkbox.checked;

            marcarAlteracao();
        });

        campoPreco.addEventListener("input", () => {
            const promocao = estado.promocoes.find(
                item => item.id === String(produto.id)
            );

            if (!promocao) return;

            promocao.preco = campoPreco.value;

            const valor = Number(campoPreco.value);
            const valido =
                campoPreco.value !== "" &&
                Number.isFinite(valor) &&
                valor > 0 &&
                valor < produto.preco;

            campoPreco.setCustomValidity(
                valido
                    ? ""
                    : "Informe um preço maior que zero e menor que o preço original."
            );

            marcarAlteracao();
        });

        controles.append(label, campoPreco);
        item.append(imagem, informacoes, controles);

        return item;
    }

    function renderizarListaVazia(container, titulo, descricao) {
        const mensagem = document.createElement("div");
        mensagem.className = "config-empty-state";

        const icone = document.createElement("i");
        icone.className = "fa-solid fa-box-open";

        const cabecalho = document.createElement("h4");
        cabecalho.textContent = titulo;

        const texto = document.createElement("p");
        texto.textContent = descricao;

        mensagem.append(icone, cabecalho, texto);
        container.appendChild(mensagem);
    }

    function renderizarListaProdutos(container, buscaInput, status, criarItem) {
        if (!container) return;

        container.replaceChildren();
        const termo = normalizarBuscaProduto(buscaInput?.value);
        const correspondencias = termo
            ? estado.produtos.filter(produto =>
                normalizarBuscaProduto(produto.nome).includes(termo) ||
                normalizarBuscaProduto(produto.id).includes(termo)
            )
            : estado.produtos.slice(0, 5);

        if (status) {
            status.textContent = termo
                ? `${correspondencias.length} produto(s) encontrado(s).`
                : `Exibindo ${correspondencias.length} de ${estado.produtos.length}. Digite o nome ou código para buscar outros produtos.`;
        }

        if (correspondencias.length === 0) {
            renderizarListaVazia(
                container,
                termo ? "Nenhum produto encontrado" : "Nenhum produto cadastrado",
                termo
                    ? "Tente outro nome ou código de produto."
                    : "Confira se há produtos cadastrados e se as permissões de leitura estão corretas."
            );
            return;
        }

        correspondencias.forEach(produto => {
            container.appendChild(criarItem(produto));
        });
    }

    function renderizarListasProdutos() {
        renderizarListaProdutos(
            listaDestaques,
            buscaProdutoDestaque,
            resultadoBuscaDestaque,
            criarProdutoDestaque
        );
        renderizarListaProdutos(
            listaPromocoes,
            buscaProdutoPromocao,
            resultadoBuscaPromocao,
            criarProdutoPromocao
        );
    }

    buscaProdutoDestaque?.addEventListener("input", renderizarListasProdutos);
    buscaProdutoPromocao?.addEventListener("input", renderizarListasProdutos);

    function formatarDetalhesCupom(cupom) {
        const detalhes = [`${cupom.percentual}% de desconto`];

        if (cupom.validade) {
            const [ano, mes, dia] = cupom.validade.split("-");
            detalhes.push(`válido até ${dia}/${mes}/${ano}`);
        }

        if (cupom.pedidoMinimo > 0) {
            detalhes.push(`pedido mínimo ${formatarPreco(cupom.pedidoMinimo)}`);
        }

        if (cupom.limiteUso) {
            detalhes.push(`limite de ${cupom.limiteUso} uso(s)`);
        }

        return detalhes.join(" · ");
    }

    function renderizarCupons() {
        if (!listaCupons) return;

        listaCupons.replaceChildren();

        if (estado.cupons.length === 0) {
            renderizarListaVazia(
                listaCupons,
                "Nenhum cupom cadastrado",
                "Adicione um código e o percentual de desconto para começar."
            );
            return;
        }

        estado.cupons.forEach(cupom => {
            const item = document.createElement("article");
            item.className = "config-coupon-item";

            const informacoes = document.createElement("div");
            const codigo = document.createElement("h4");
            codigo.textContent = cupom.codigo;

            const detalhes = document.createElement("p");
            detalhes.textContent = formatarDetalhesCupom(cupom);
            informacoes.append(codigo, detalhes);

            const remover = document.createElement("button");
            remover.type = "button";
            remover.className = "config-coupon-remove";
            remover.textContent = "Remover";
            remover.setAttribute("aria-label", `Remover cupom ${cupom.codigo}`);
            remover.addEventListener("click", () => {
                estado.cupons = estado.cupons.filter(
                    itemAtual => itemAtual.codigo !== cupom.codigo
                );
                renderizarCupons();
                marcarAlteracao();
            });

            item.append(informacoes, remover);
            listaCupons.appendChild(item);
        });
    }

    function configurarFormularioCupom() {
        if (!formCupom) return;

        formCupom.addEventListener("submit", evento => {
            evento.preventDefault();

            const codigoInput = document.querySelector("#cupom-codigo");
            const percentualInput =
                document.querySelector("#cupom-percentual");
            const validadeInput = document.querySelector("#cupom-validade");
            const pedidoMinimoInput =
                document.querySelector("#cupom-pedido-minimo");
            const limiteUsoInput =
                document.querySelector("#cupom-limite-uso");

            const codigo = normalizarCodigoCupom(codigoInput?.value);
            const percentualTexto = normalizarTexto(percentualInput?.value);
            const percentual = percentualTexto ? Number(percentualTexto) : NaN;
            const validade = normalizarTexto(validadeInput?.value);
            const pedidoMinimoTexto =
                normalizarTexto(pedidoMinimoInput?.value);
            const limiteUsoTexto = normalizarTexto(limiteUsoInput?.value);
            const pedidoMinimo = pedidoMinimoTexto
                ? Number(pedidoMinimoTexto)
                : 0;
            const limiteUso = limiteUsoTexto
                ? Number(limiteUsoTexto)
                : null;

            if (!/^[A-Z0-9_-]{3,30}$/.test(codigo)) {
                mostrarNotificacao(
                    "Use de 3 a 30 caracteres no código: letras, números, hífen ou sublinhado.",
                    "erro"
                );
                codigoInput?.focus();
                return;
            }

            if (
                !Number.isFinite(percentual) ||
                percentual <= 0 ||
                percentual > 100
            ) {
                mostrarNotificacao(
                    "O desconto percentual deve ser maior que 0 e no máximo 100.",
                    "erro"
                );
                percentualInput?.focus();
                return;
            }

            if (validade && !validarDataCupom(validade)) {
                mostrarNotificacao("Informe uma data de validade válida.", "erro");
                validadeInput?.focus();
                return;
            }

            if (!Number.isFinite(pedidoMinimo) || pedidoMinimo < 0) {
                mostrarNotificacao(
                    "O valor mínimo do pedido deve ser zero ou maior.",
                    "erro"
                );
                pedidoMinimoInput?.focus();
                return;
            }

            if (
                limiteUso !== null &&
                (!Number.isInteger(limiteUso) || limiteUso < 1)
            ) {
                mostrarNotificacao(
                    "O limite de usos deve ser um número inteiro maior que zero.",
                    "erro"
                );
                limiteUsoInput?.focus();
                return;
            }

            if (estado.cupons.some(item => item.codigo === codigo)) {
                mostrarNotificacao("Já existe um cupom com esse código.", "erro");
                codigoInput?.focus();
                return;
            }

            estado.cupons.push({
                codigo,
                percentual,
                validade,
                pedidoMinimo,
                limiteUso
            });

            formCupom.reset();
            renderizarCupons();
            marcarAlteracao();
            mostrarNotificacao(
                "Cupom adicionado. Salve as configurações para publicá-lo.",
                "sucesso"
            );
        });
    }

    function configurarFrete() {
        const campos = [
            freteCepOrigem,
            freteRetiradaAtiva,
            freteEnderecoRetirada,
            freteMotoboyAtivo,
            freteWhatsapp
        ];

        campos.forEach(campo => {
            campo?.addEventListener("input", marcarAlteracao);
            campo?.addEventListener("change", marcarAlteracao);
        });

        freteCepOrigem?.addEventListener("input", () => {
            const cep = normalizarCep(freteCepOrigem.value);
            freteCepOrigem.value = cep.length > 5
                ? `${cep.slice(0, 5)}-${cep.slice(5)}`
                : cep;
        });
    }

    function carregarFrete(configuracaoFrete) {
        const frete = configuracaoFrete &&
            typeof configuracaoFrete === "object"
            ? configuracaoFrete
            : {};
        const retirada = frete.retirada &&
            typeof frete.retirada === "object"
            ? frete.retirada
            : {};
        const motoboy = frete.motoboy &&
            typeof frete.motoboy === "object"
            ? frete.motoboy
            : {};

        estado.frete = {
            provedor: "melhor_envio",
            cepOrigem: normalizarCep(frete.cepOrigem) || "57800000",
            retirada: {
                ativa: retirada.ativa === true,
                endereco: normalizarTexto(retirada.endereco)
            },
            motoboy: {
                ativo: motoboy.ativo === true,
                whatsapp: normalizarTexto(motoboy.whatsapp)
            }
        };

        if (freteCepOrigem) {
            const cep = estado.frete.cepOrigem;
            freteCepOrigem.value = cep.length > 5
                ? `${cep.slice(0, 5)}-${cep.slice(5)}`
                : cep;
        }
        if (freteRetiradaAtiva) {
            freteRetiradaAtiva.checked = estado.frete.retirada.ativa;
        }
        if (freteEnderecoRetirada) {
            freteEnderecoRetirada.value = estado.frete.retirada.endereco;
        }
        if (freteMotoboyAtivo) {
            freteMotoboyAtivo.checked = estado.frete.motoboy.ativo;
        }
        if (freteWhatsapp) {
            freteWhatsapp.value = estado.frete.motoboy.whatsapp;
        }
    }

    function validarFrete() {
        const cepOrigem = normalizarCep(freteCepOrigem?.value);
        const retiradaAtiva = Boolean(freteRetiradaAtiva?.checked);
        const enderecoRetirada =
            normalizarTexto(freteEnderecoRetirada?.value);
        const motoboyAtivo = Boolean(freteMotoboyAtivo?.checked);
        const whatsapp = normalizarTexto(freteWhatsapp?.value);

        if (cepOrigem.length !== 8) {
            mostrarNotificacao("Informe um CEP de origem válido.", "erro");
            freteCepOrigem?.focus();
            return false;
        }

        if (retiradaAtiva && enderecoRetirada.length < 10) {
            mostrarNotificacao(
                "Informe o endereço completo antes de disponibilizar a retirada.",
                "erro"
            );
            freteEnderecoRetirada?.focus();
            return false;
        }

        if (motoboyAtivo && whatsapp.replace(/\D/g, "").length < 12) {
            mostrarNotificacao(
                "Informe o WhatsApp com código do país e DDD antes de disponibilizar motoboy.",
                "erro"
            );
            freteWhatsapp?.focus();
            return false;
        }

        estado.frete = {
            provedor: "melhor_envio",
            cepOrigem,
            retirada: {
                ativa: retiradaAtiva,
                endereco: enderecoRetirada
            },
            motoboy: {
                ativo: motoboyAtivo,
                whatsapp
            }
        };

        return true;
    }

    /* =====================================================
       8. CARREGAR CONFIGURAÇÕES SALVAS
       ===================================================== */

    async function carregarConfiguracoes() {
        const { data, error } = await supabaseClient
            .from("configuracoes_nova")
            .select("id, configuracoes")
            .eq("id", "loja")
            .maybeSingle();

        if (error) {
            throw error;
        }

        if (!data || !data.configuracoes) {
            return;
        }

        const configuracoes = data.configuracoes;
        if (
            typeof configuracoes !== "object" ||
            Array.isArray(configuracoes)
        ) {
            throw new Error(
                "As configurações salvas da loja têm um formato inválido."
            );
        }

        estado.configuracoesSalvas = { ...configuracoes };
        carregarFrete(configuracoes.frete);

        // Ignora a paleta antiga até o administrador salvar explicitamente o novo tema.
        if (
            configuracoes.temaVisual === "personalizado" &&
            configuracoes.cores
        ) {
            camposCores.forEach(campo => {
                const valorSalvo = configuracoes.cores[campo.nome];
                const cor = converterParaHex(valorSalvo);

                if (!cor) return;

                const seletor = document.querySelector(campo.seletor);
                const texto = document.querySelector(campo.texto);

                if (seletor) seletor.value = cor;
                if (texto) texto.value = cor;

                estado.cores[campo.nome] = cor;
            });
        }
        atualizarPreviaTema();

        // Banner
        const bannerSalvo = validarUrlImagem(configuracoes.banner);

        if (bannerSalvo) {
            estado.banner = bannerSalvo;
            visualizarBanner(bannerSalvo, false);
        }

        // IDs de produtos em destaque
        estado.destaques = Array.isArray(configuracoes.destaques)
            ? configuracoes.destaques.map(String)
            : [];

        // Promoções
        estado.promocoes = Array.isArray(configuracoes.promocoes)
            ? configuracoes.promocoes
                .filter(item =>
                    item &&
                    item.id !== undefined &&
                    Number.isFinite(Number(item.preco)) &&
                    Number(item.preco) > 0
                )
                .map(item => ({
                    id: String(item.id),
                    preco: Number(item.preco).toFixed(2)
                }))
            : [];

        estado.cupons = Array.isArray(configuracoes.cupons)
            ? configuracoes.cupons.map(cupom => {
                const codigo = normalizarCodigoCupom(cupom?.codigo);
                const percentual = Number(cupom?.percentual);
                const validade = normalizarTexto(cupom?.validade);
                const pedidoMinimo = Number(cupom?.pedidoMinimo ?? 0);
                const limiteUso = cupom?.limiteUso === null ||
                    cupom?.limiteUso === undefined ||
                    cupom?.limiteUso === ""
                    ? null
                    : Number(cupom.limiteUso);

                if (
                    !/^[A-Z0-9_-]{3,30}$/.test(codigo) ||
                    !Number.isFinite(percentual) ||
                    percentual <= 0 ||
                    percentual > 100 ||
                    (validade && !validarDataCupom(validade)) ||
                    !Number.isFinite(pedidoMinimo) ||
                    pedidoMinimo < 0 ||
                    (limiteUso !== null &&
                        (!Number.isInteger(limiteUso) || limiteUso < 1))
                ) {
                    throw new Error(
                        `O cupom "${codigo || "sem código"}" salvo nas configurações é inválido.`
                    );
                }

                return {
                    codigo,
                    percentual,
                    validade,
                    pedidoMinimo,
                    limiteUso
                };
            })
            : [];

        if (new Set(estado.cupons.map(cupom => cupom.codigo)).size !== estado.cupons.length) {
            throw new Error("Há códigos de cupom duplicados nas configurações salvas.");
        }

        renderizarCupons();
        renderizarListasProdutos();
    }

    /* =====================================================
       9. VALIDAÇÃO ANTES DE SALVAR
       ===================================================== */

    function validarPromocoes() {
        for (const promocao of estado.promocoes) {
            const produto = estado.produtos.find(
                item => String(item.id) === String(promocao.id)
            );

            if (!produto) {
                mostrarNotificacao(
                    "Um produto selecionado para promoção não foi encontrado.",
                    "erro"
                );
                return false;
            }

            const valor = Number(promocao.preco);

            if (
                promocao.preco === "" ||
                !Number.isFinite(valor) ||
                valor <= 0 ||
                valor >= produto.preco
            ) {
                mostrarNotificacao(
                    `O preço promocional de "${produto.nome}" deve ser menor que ${formatarPreco(produto.preco)}.`,
                    "erro"
                );
                return false;
            }
        }

        return true;
    }

    /* =====================================================
       10. AUTORIZAÇÃO DO ADMINISTRADOR
       ===================================================== */

    async function verificarPermissaoAdmin() {
        if (typeof window.verificarAdmin !== "function") {
            throw new Error(
                "A função verificarAdmin não foi encontrada. Confira admin/js/supabase.js."
            );
        }

        const autorizado = await window.verificarAdmin();

        if (!autorizado) {
            estado.administradorAutorizado = false;

            throw new Error(
                "Sua sessão não está autorizada. Entre novamente no painel administrativo."
            );
        }

        estado.administradorAutorizado = true;
    }

    /* =====================================================
       11. SALVAR CONFIGURAÇÕES NO SUPABASE
       ===================================================== */

    async function salvarConfiguracoes() {
        if (!estado.administradorAutorizado) {
            mostrarNotificacao(
                "Você precisa estar autenticado como administrador para salvar.",
                "erro"
            );
            return;
        }

        if (!validarCamposCores()) {
            return;
        }

        if (!validarFrete()) {
            return;
        }

        if (estado.enviandoBanner) {
            mostrarNotificacao(
                "Aguarde o envio do banner terminar antes de salvar.",
                "erro"
            );
            return;
        }

        if (!validarPromocoes()) {
            return;
        }

        const configuracoes = {
            ...estado.configuracoesSalvas,
            cores: { ...estado.cores },
            temaVisual: "personalizado",
            banner: estado.banner || "",
            destaques: estado.destaques,
            promocoes: estado.promocoes.map(item => ({
                id: item.id,
                preco: Number(item.preco)
            })),
            cupons: estado.cupons.map(cupom => ({ ...cupom })),
            frete: { ...estado.frete }
        };

        estado.carregando = true;
        if (bannerArquivo) {
            bannerArquivo.disabled = true;
        }

        if (botaoSalvar) {
            botaoSalvar.disabled = true;
            botaoSalvar.innerHTML =
                '<i class="fa-solid fa-spinner fa-spin"></i> Salvando...';
        }

        try {
            // Verifica novamente a sessão imediatamente antes
            // da gravação. O RLS continua sendo a proteção final.
            await verificarPermissaoAdmin();

            const { error } = await supabaseClient
                .from("configuracoes_nova")
                .upsert(
                    {
                        id: "loja",
                        configuracoes,
                        updated_at: new Date().toISOString()
                    },
                    {
                        onConflict: "id"
                    }
                );

            if (error) {
                throw error;
            }

            estado.configuracoesSalvas = configuracoes;
            estado.alteracoesPendentes = false;

            mostrarNotificacao(
                "Configurações salvas no Supabase com sucesso!",
                "sucesso"
            );

        } catch (erro) {
            console.error(
                "[Vértice Config] Erro ao salvar:",
                erro
            );

            mostrarNotificacao(
                erro.message ||
                    "Não foi possível salvar as configurações.",
                "erro"
            );

        } finally {
            estado.carregando = false;
            if (bannerArquivo) {
                bannerArquivo.disabled = false;
            }

            if (botaoSalvar) {
                botaoSalvar.disabled =
                    !estado.administradorAutorizado ||
                    estado.enviandoBanner;

                botaoSalvar.innerHTML =
                    '<i class="fa-solid fa-cloud-arrow-up"></i> Salvar configurações';
            }
        }
    }

    /* =====================================================
       12. EVENTOS
       ===================================================== */

    function configurarBotaoSalvar() {
        if (!botaoSalvar) return;

        botaoSalvar.addEventListener("click", salvarConfiguracoes);
    }

    function configurarBotaoRestaurarTema() {
        botaoRestaurarTema?.addEventListener("click", restaurarTemaNova);
    }

    /* =====================================================
       13. INICIALIZAÇÃO
       ===================================================== */

    configurarCamposCores();
    configurarBotaoRestaurarTema();
    configurarBanner();
    configurarFormularioCupom();
    configurarFrete();
    configurarBotaoSalvar();
    renderizarCupons();

    if (botaoSalvar) {
        botaoSalvar.disabled = true;
    }

    if (!supabaseClient) {
        mostrarNotificacao(
            "Supabase não inicializado. Confira a ordem dos scripts em config.html.",
            "erro"
        );

        console.error("[Vértice Config] window.supabaseClient não existe.");
        return;
    }

    try {
        // Confirma a autenticação sem impedir a leitura pública
        // caso o visitante não esteja autenticado.
        try {
            await verificarPermissaoAdmin();
        } catch (erroAuth) {
            console.warn("[Vértice Config] Verificação de administrador:", erroAuth.message);
        }

        // Carrega catálogo e configurações.
        // A leitura depende das políticas RLS da tabela.
        await carregarProdutos();
        await carregarConfiguracoes();

        // Atualiza o estado visual dos controles após o carregamento.
        renderizarListasProdutos();

        if (botaoSalvar) {
            botaoSalvar.disabled =
                !estado.administradorAutorizado;
        }

        if (!estado.administradorAutorizado) {
            mostrarNotificacao(
                "Você pode consultar as configurações, mas precisa entrar como administrador para salvar.",
                "erro"
            );
        }

        console.log(
            "[Vértice Config] Inicialização concluída.",
            {
                produtos: estado.produtos.length,
                administradorAutorizado:
                    estado.administradorAutorizado
            }
        );

    } catch (erro) {
        console.error(
            "[Vértice Config] Erro ao carregar dados:",
            erro
        );

        mostrarNotificacao(
            `Erro ao carregar os dados: ${erro.message}`,
            "erro"
        );
    }

    // Interface de acesso para futuras integrações.
    window.NovaConfig = {
        estado,
        recarregarProdutos: carregarProdutos,
        recarregarConfiguracoes: carregarConfiguracoes
    };
});
