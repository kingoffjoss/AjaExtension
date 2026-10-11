(function carregarAjaExtension() {
    const SCRIPT_ID = 'aja-extension-content-loader';
    const THEME_ID = 'aja-extension-theme-loader';
    const SCRIPT_URL = 'https://kingoffjoss.github.io/AjaExtension/content.js';
    const THEME_URL = 'https://kingoffjoss.github.io/AjaExtension/theme-brisanet-patch.js';

    const antigo = document.getElementById(SCRIPT_ID);
    if (antigo) antigo.remove();
    const temaAntigo = document.getElementById(THEME_ID);
    if (temaAntigo) temaAntigo.remove();

    const script = document.createElement('script');
    script.id = SCRIPT_ID;
    script.src = `${SCRIPT_URL}?v=${Date.now()}`;
    script.onload = () => {
        console.log('[AjaExtension] content.js carregado pelo GitHub Pages.');
        const themeScript = document.createElement('script');
        themeScript.id = THEME_ID;
        themeScript.src = `${THEME_URL}?v=${Date.now()}`;
        themeScript.onerror = () => console.warn('[AjaExtension] Nao consegui carregar o tema Brisanet.');
        document.documentElement.appendChild(themeScript);
    };
    script.onerror = () => alert('Nao consegui carregar o AjaExtension pelo GitHub Pages.');

    document.documentElement.appendChild(script);
})();
