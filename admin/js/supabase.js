
const SUPABASE_URL = "https://hvevfbbmqxxxiovcvraw.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_8Ded4K5fyNAyEkrFen8ZXA_2VGjZbCD";

const UID_ADMIN_AUTORIZADO = "8cdc142e-fce4-4fb6-975c-7cffa005d382";

// Inicializa o cliente Supabase
(function inicializarSupabase() {
    if (!window.supabase || typeof window.supabase.createClient !== "function") {
        console.error(
            "Biblioteca do Supabase ausente ou inválida. Verifique o script CDN."
        );
        return;
    }

    try {
        window.supabaseClient = window.supabase.createClient(
            SUPABASE_URL,
            SUPABASE_ANON_KEY,
            {
                auth: {
                    persistSession: true,
                    autoRefreshToken: true,
                    detectSessionInUrl: true
                }
            }
        );

        console.log("Cliente Supabase inicializado:", Boolean(window.supabaseClient));
    } catch (erro) {
        console.error("Falha ao inicializar o Supabase:", erro);
    }
})();

// Login do administrador autorizado
window.loginAdmin = async function (email, senha) {
    if (!window.supabaseClient) {
        throw new Error("O Supabase não foi inicializado.");
    }

    const { data, error } = await window.supabaseClient.auth.signInWithPassword({
        email: email.trim(),
        password: senha
    });

    if (error) throw error;

    if (data.user?.id !== UID_ADMIN_AUTORIZADO) {
        await window.supabaseClient.auth.signOut();
        throw new Error("Esta conta não tem permissão para acessar o painel.");
    }

    return data.user;
};

// Verifica se existe uma sessão válida do administrador
window.verificarAdmin = async function () {
    if (!window.supabaseClient) return false;

    const { data, error } = await window.supabaseClient.auth.getUser();

    if (error || !data.user) return false;

    return data.user.id === UID_ADMIN_AUTORIZADO;
};

// Encerra a sessão
window.sairAdmin = async function () {
    if (!window.supabaseClient) {
        throw new Error("O Supabase não foi inicializado.");
    }

    const { error } = await window.supabaseClient.auth.signOut();

    if (error) throw error;
};
