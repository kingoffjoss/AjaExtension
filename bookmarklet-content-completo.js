(function carregarAjaAssistantContentCompleto() {
    const LOADER_ID = 'aja-assistant-content-loader';
    const THEME_ID = 'aja-assistant-theme-loader';
    const SCRIPT_URL = 'https://kingoffjoss.github.io/AjaExtension/content.js';
    const THEME_URL = 'https://kingoffjoss.github.io/AjaExtension/theme-brisanet-patch.js';

    const antigo = document.getElementById(LOADER_ID);
    if (antigo) antigo.remove();
    const temaAntigo = document.getElementById(THEME_ID);
    if (temaAntigo) temaAntigo.remove();

    const script = document.createElement('script');
    script.id = LOADER_ID;
    script.src = `${SCRIPT_URL}?v=${Date.now()}`;
    script.onload = () => {
        const themeScript = document.createElement('script');
        themeScript.id = THEME_ID;
        themeScript.src = `${THEME_URL}?v=${Date.now()}`;
        themeScript.onload = () => alert('Aja Assistant completo carregado pelo favorito.');
        themeScript.onerror = () => alert('Aja Assistant carregou, mas nao consegui aplicar o tema Brisanet.');
        document.documentElement.appendChild(themeScript);
    };
    script.onerror = () => alert('Nao consegui carregar content.js. Confira se ele foi publicado no GitHub Pages.');

    document.documentElement.appendChild(script);
})();
