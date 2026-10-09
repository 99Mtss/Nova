
const SUPABASE_URL = "https://hvevfbbmqxxxiovcvraw.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_8Ded4K5fyNAyEkrFen8ZXA_2VGjZbCD";

if (!window.supabase) {
    console.error("A biblioteca do Supabase não foi carregada.");
} else {
    window.supabaseClient = window.supabase.createClient(
        SUPABASE_URL,
        SUPABASE_ANON_KEY
    );

    console.log("Cliente Supabase inicializado.");
}

/**
 * Faz login com e-mail e senha.
 */
window.loginAdmin = async function (email, senha) {
    const { data, error } =
        await window.supabaseClient.auth.signInWithPassword({
            email,
            password: senha
        });

    if (error) {
        throw error;
    }

    const uidAutorizado = "8cdc142e-fce4-4fb6-975c-7cffa005d382";

    if (data.user?.id !== uidAutorizado) {
        await window.supabaseClient.auth.signOut();
        throw new Error("Esta conta não tem permissão para acessar o painel.");
    }

    return data.user;
};

/**
 * Verifica se existe uma sessão do administrador autorizado.
 */
window.verificarAdmin = async function () {
    const { data, error } =
        await window.supabaseClient.auth.getUser();

    if (error || !data.user) {
        return false;
    }

    return data.user.id ===
        "8cdc142e-fce4-4fb6-975c-7cffa005d382";
};

/**
 * Encerra a sessão.
 */
window.sairAdmin = async function () {
    const { error } =
        await window.supabaseClient.auth.signOut();

    if (error) {
        throw error;
    }
};
