(function carregarAjaExtension() {
    const SCRIPT_ID = 'aja-extension-content-loader';
    const SCRIPT_URL = 'https://kingoffjoss.github.io/AjaExtension/content.js';

    const antigo = document.getElementById(SCRIPT_ID);
    if (antigo) antigo.remove();

    const script = document.createElement('script');
    script.id = SCRIPT_ID;
    script.src = `${SCRIPT_URL}?v=${Date.now()}`;
    script.onload = () => console.log('[AjaExtension] content.js carregado pelo GitHub Pages.');
    script.onerror = () => alert('Nao consegui carregar o AjaExtension pelo GitHub Pages.');

    document.documentElement.appendChild(script);
})();
