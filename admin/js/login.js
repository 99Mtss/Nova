
document.addEventListener("DOMContentLoaded", () => {
    "use strict";

    // =====================================================
    // ELEMENTOS
    // =====================================================

    const form = document.getElementById("loginForm");
    const campoEmail = document.getElementById("email");
    const campoSenha = document.getElementById("senha");
    const botao = document.getElementById("btnLogin");
    const mensagem = document.getElementById("mensagem");

    if (!form || !campoEmail || !campoSenha || !botao || !mensagem) {
        console.error("Não foi possível localizar os elementos do login.");
        return;
    }

    const textoOriginalBotao =
        '<i class="fa-solid fa-right-to-bracket"></i> Entrar no painel';

    // =====================================================
    // MENSAGENS
    // =====================================================

    function mostrarMensagem(texto, tipo) {
        mensagem.textContent = texto;
        mensagem.className = tipo;
    }

    function limparMensagem() {
        mensagem.textContent = "";
        mensagem.className = "";
    }

    function definirCarregamento(carregando) {
        botao.disabled = carregando;

        if (carregando) {
            botao.textContent = "Verificando acesso...";
        } else {
            botao.innerHTML = textoOriginalBotao;
        }
    }

    // =====================================================
    // VERIFICAR CONFIGURAÇÃO DO SUPABASE
    // =====================================================

    function verificarFuncoesSupabase() {
        if (
            typeof window.loginAdmin !== "function" ||
            typeof window.verificarAdmin !== "function"
        ) {
            mostrarMensagem(
                "Não foi possível conectar o sistema de autenticação. Confira os arquivos e a configuração do Supabase.",
                "erro"
            );

            console.error(
                "As funções loginAdmin() e verificarAdmin() não estão disponíveis. Confira js/supabase.js."
            );

            return false;
        }

        return true;
    }

    // =====================================================
    // VERIFICAR SESSÃO EXISTENTE
    // =====================================================

    async function verificarSessao() {
        if (!verificarFuncoesSupabase()) return;

        definirCarregamento(true);

        try {
            const autorizado = await window.verificarAdmin();

            if (autorizado) {
                window.location.replace("index.html");
                return;
            }
        } catch (erro) {
            console.error("Erro ao verificar sessão:", erro);
        } finally {
            definirCarregamento(false);
        }
    }

    // =====================================================
    // REALIZAR LOGIN
    // =====================================================

    form.addEventListener("submit", async event => {
        event.preventDefault();

        limparMensagem();

        const email = campoEmail.value.trim();
        const senha = campoSenha.value;

        if (!email || !senha) {
            mostrarMensagem(
                "Preencha o e-mail e a senha.",
                "erro"
            );
            return;
        }

        if (!verificarFuncoesSupabase()) return;

        definirCarregamento(true);

        try {
            await window.loginAdmin(email, senha);

            // Confirma que a conta autenticada tem autorização
            // para acessar o painel administrativo.
            const autorizado = await window.verificarAdmin();

            if (!autorizado) {
                if (typeof window.sairAdmin === "function") {
                    await window.sairAdmin();
                }

                mostrarMensagem(
                    "Esta conta não tem autorização para acessar o painel administrativo.",
                    "erro"
                );

                return;
            }

            mostrarMensagem(
                "Login realizado! Abrindo o painel...",
                "sucesso"
            );

            window.location.replace("index.html");
        } catch (erro) {
            console.error("Falha no login:", erro);

            mostrarMensagem(
                "Não foi possível entrar. Confira seu e-mail e senha e tente novamente.",
                "erro"
            );
        } finally {
            definirCarregamento(false);
        }
    });

    // =====================================================
    // INICIALIZAÇÃO
    // =====================================================

    verificarSessao();
});
