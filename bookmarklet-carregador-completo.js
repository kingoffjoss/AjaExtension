(function carregarAjaAssistantCompleto() {
    const LOADER_ID = 'aja-assistant-bookmarklet-loader';
    const SCRIPT_URL = 'https://kingoffjoss.github.io/AjaExtension/Loader.js';

    function avisar(message) {
        alert(message);
    }

    const antigo = document.getElementById(LOADER_ID);
    if (antigo) antigo.remove();

    const script = document.createElement('script');
    script.id = LOADER_ID;
    script.src = `${SCRIPT_URL}?v=${Date.now()}`;
    script.onload = () => avisar('Aja Assistant carregado pelo favorito.');
    script.onerror = () => avisar('Nao consegui carregar o loader completo. Confira se o GitHub Pages do repositorio AjaExtension esta ativo.');

    document.documentElement.appendChild(script);
})();
