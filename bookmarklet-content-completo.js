(function carregarAjaAssistantContentCompleto() {
    const LOADER_ID = 'aja-assistant-content-loader';
    const SCRIPT_URL = 'https://kingoffjoss.github.io/AjaExtension/content.js';

    const antigo = document.getElementById(LOADER_ID);
    if (antigo) antigo.remove();

    const script = document.createElement('script');
    script.id = LOADER_ID;
    script.src = `${SCRIPT_URL}?v=${Date.now()}`;
    script.onload = () => alert('Aja Assistant completo carregado pelo favorito.');
    script.onerror = () => alert('Nao consegui carregar content.js. Confira se ele foi publicado no GitHub Pages.');

    document.documentElement.appendChild(script);
})();
