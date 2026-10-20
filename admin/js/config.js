
/* =========================================================
   NØVA ADM — CONFIGURAÇÕES
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
    const bannerUrl = document.querySelector("#banner-url");
    const bannerPreview = document.querySelector("#banner-preview");
    const botaoVisualizarBanner =
        document.querySelector("#preview-banner");

    const listaDestaques =
        document.querySelector("#lista-produtos-destaque");

    const listaPromocoes =
        document.querySelector("#lista-produtos-promocao");

    const camposCores = [
        {
            nome: "Fundo",
            seletor: "#cor-fundo",
            texto: "#hex-fundo",
            valorInicial: "#0B0B0D"
        },
        {
            nome: "Superfície",
            seletor: "#cor-superficie",
            texto: "#hex-superficie",
            valorInicial: "#151519"
        },
        {
            nome: "Destaque",
            seletor: "#cor-destaque",
            texto: "#hex-destaque",
            valorInicial: "#FFFFFF"
        },
        {
            nome: "Texto",
            seletor: "#cor-texto",
            texto: "#hex-texto",
            valorInicial: "#F5F5F5"
        }
    ];

    /* =====================================================
       2. ESTADO
       ===================================================== */

    const estado = {
        cores: {},
        banner: "",
        destaques: [],
        promocoes: [],
        produtos: [],
        carregando: false,
        alteracoesPendentes: false,
        administradorAutorizado: false
    };

    /* =====================================================
       3. UTILITÁRIOS
       ===================================================== */

    function normalizarTexto(valor) {
        return String(valor ?? "").trim();
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
                background: "#17171b",
                color: "#f5f5f5",
                border: "1px solid #393940",
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
            "#393940";
    }

    function marcarAlteracao() {
        estado.alteracoesPendentes = true;

        if (botaoSalvar) {
            botaoSalvar.disabled =
                !estado.administradorAutorizado ||
                estado.carregando;
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
                    `[NØVA] Campo de cor ausente: ${campo.nome}`
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

    function visualizarBanner(urlRecebida) {
        if (!bannerPreview || !bannerUrl) return;

        const url = validarUrlImagem(
            urlRecebida ?? bannerUrl.value
        );

        if (!url) {
            mostrarPlaceholderBanner(
                "URL inválida",
                "Informe uma URL de imagem válida."
            );

            bannerUrl.setCustomValidity(
                "Informe uma URL de imagem começando com https:// ou http://."
            );

            bannerUrl.reportValidity();
            return;
        }

        bannerUrl.setCustomValidity("");
        mostrarPlaceholderBanner(
            "Carregando imagem...",
            "Aguarde a pré-visualização."
        );

        const imagem = new Image();
        imagem.alt = "Pré-visualização do banner da NØVA";

        imagem.onload = () => {
            bannerPreview.replaceChildren(imagem);
            bannerPreview.classList.add("has-image");

            estado.banner = url;
            marcarAlteracao();
        };

        imagem.onerror = () => {
            mostrarPlaceholderBanner(
                "Não foi possível carregar a imagem",
                "Verifique se a URL está correta e se a imagem é pública."
            );
        };

        imagem.src = url;
    }

    function configurarBanner() {
        if (botaoVisualizarBanner) {
            botaoVisualizarBanner.addEventListener("click", () => {
                visualizarBanner();
            });
        }

        if (bannerUrl) {
            bannerUrl.addEventListener("input", () => {
                bannerUrl.setCustomValidity();
                marcarAlteracao();
            });

            bannerUrl.addEventListener("keydown", evento => {
                if (evento.key === "Enter") {
                    evento.preventDefault();
                    visualizarBanner();
                }
            });
        }
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
            `${produto.categoria || "Sem categoria"} · ${formatarPreco(produto.preco)} · Estoque: ${produto.estoque}`
        );

        const controles = document.createElement("div");
        controles.className = "config-product-controls";

        const label = document.createElement("label");
        const checkbox = document.createElement("input");

        checkbox.type = "checkbox";
        checkbox.checked = estado.destaques.includes(produto.id);
        checkbox.disabled = !produto.ativo;

        label.append(
            checkbox,
            document.createTextNode(
                produto.ativo ? "Em destaque" : "Produto inativo"
            )
        );

        checkbox.addEventListener("change", () => {
            if (checkbox.checked) {
                if (!estado.destaques.includes(produto.id)) {
                    estado.destaques.push(produto.id);
                }
            } else {
                estado.destaques = estado.destaques.filter(
                    id => id !== produto.id
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
            `Preço original: ${formatarPreco(produto.preco)}`
        );

        const controles = document.createElement("div");
        controles.className = "config-product-controls";

        const promocaoAtual = estado.promocoes.find(
            promocao => promocao.id === produto.id
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
                    id: produto.id,
                    preco: ""
                });
            } else {
                estado.promocoes = estado.promocoes.filter(
                    promocao => promocao.id !== produto.id
                );

                campoPreco.value = "";
                campoPreco.setCustomValidity("");
            }

            campoPreco.disabled = !checkbox.checked;

            marcarAlteracao();
        });

        campoPreco.addEventListener("input", () => {
            const promocao = estado.promocoes.find(
                item => item.id === produto.id
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

    function renderizarListasProdutos() {
        if (listaDestaques) {
            listaDestaques.replaceChildren();

            if (estado.produtos.length === 0) {
                renderizarListaVazia(
                    listaDestaques,
                    "Nenhum produto encontrado",
                    "Confira se há produtos cadastrados e se as permissões de leitura estão corretas."
                );
            } else {
                estado.produtos.forEach(produto => {
                    listaDestaques.appendChild(
                        criarProdutoDestaque(produto)
                    );
                });
            }
        }

        if (listaPromocoes) {
            listaPromocoes.replaceChildren();

            if (estado.produtos.length === 0) {
                renderizarListaVazia(
                    listaPromocoes,
                    "Nenhum produto encontrado",
                    "Os produtos disponíveis para promoção aparecerão aqui."
                );
            } else {
                estado.produtos.forEach(produto => {
                    listaPromocoes.appendChild(
                        criarProdutoPromocao(produto)
                    );
                });
            }
        }
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

        // Cores
        if (configuracoes.cores) {
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

        // Banner
        const bannerSalvo = validarUrlImagem(configuracoes.banner);

        if (bannerSalvo && bannerUrl) {
            bannerUrl.value = bannerSalvo;
            estado.banner = bannerSalvo;
            visualizarBanner(bannerSalvo);
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

        renderizarListasProdutos();
    }

    /* =====================================================
       9. VALIDAÇÃO ANTES DE SALVAR
       ===================================================== */

    function validarPromocoes() {
        for (const promocao of estado.promocoes) {
            const produto = estado.produtos.find(
                item => item.id === promocao.id
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

        const bannerInformado = normalizarTexto(
            bannerUrl?.value
        );

        if (bannerInformado && !validarUrlImagem(bannerInformado)) {
            bannerUrl?.setCustomValidity(
                "Informe uma URL de imagem válida."
            );
            bannerUrl?.reportValidity();
            return;
        }

        if (bannerInformado && !estado.banner) {
            mostrarNotificacao(
                "Clique em Visualizar imagem e aguarde o carregamento do banner antes de salvar.",
                "erro"
            );
            return;
        }

        if (!validarPromocoes()) {
            return;
        }

        const configuracoes = {
            cores: { ...estado.cores },
            banner: estado.banner || "",
            destaques: estado.destaques,
            promocoes: estado.promocoes.map(item => ({
                id: item.id,
                preco: Number(item.preco)
            }))
        };

        estado.carregando = true;

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

            estado.alteracoesPendentes = false;

            mostrarNotificacao(
                "Configurações salvas no Supabase com sucesso!",
                "sucesso"
            );

        } catch (erro) {
            console.error(
                "[NØVA Config] Erro ao salvar:",
                erro
            );

            mostrarNotificacao(
                erro.message ||
                    "Não foi possível salvar as configurações.",
                "erro"
            );

        } finally {
            estado.carregando = false;

            if (botaoSalvar) {
                botaoSalvar.disabled =
                    !estado.administradorAutorizado;

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

    /* =====================================================
       13. INICIALIZAÇÃO
       ===================================================== */

    configurarCamposCores();
    configurarBanner();
    configurarBotaoSalvar();

    if (botaoSalvar) {
        botaoSalvar.disabled = true;
    }

    if (!supabaseClient) {
        mostrarNotificacao(
            "Supabase não inicializado. Confira a ordem dos scripts em config.html.",
            "erro"
        );

        console.error("[NØVA Config] window.supabaseClient não existe.");
        return;
    }

    try {
        // Confirma a autenticação sem impedir a leitura pública
        // caso o visitante não esteja autenticado.
        try {
            await verificarPermissaoAdmin();
        } catch (erroAuth) {
            console.warn("[NØVA Config] Verificação de administrador:", erroAuth.message);
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
            "[NØVA Config] Inicialização concluída.",
            {
                produtos: estado.produtos.length,
                administradorAutorizado:
                    estado.administradorAutorizado
            }
        );

    } catch (erro) {
        console.error(
            "[NØVA Config] Erro ao carregar dados:",
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
