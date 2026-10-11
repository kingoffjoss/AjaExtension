(function carregarAjaExtension() {
    const CLEANUP_KEY = '__AJA_EXTENSION_FRAME_LOADER_CLEANUP__';
    const SCRIPT_ID = 'aja-extension-content-loader';
    const THEME_ID = 'aja-extension-theme-loader';
    const CORRETOR_PATCH_ID = 'aja-extension-corretor-menu-patch-loader';
    const SCRIPT_URL = 'https://kingoffjoss.github.io/AjaExtension/content.js';
    const THEME_URL = 'https://kingoffjoss.github.io/AjaExtension/theme-brisanet-patch.js';
    const CORRETOR_PATCH_URL = 'https://kingoffjoss.github.io/AjaExtension/corretor-menu-patch.js';

    if (typeof window[CLEANUP_KEY] === 'function') {
        try {
            window[CLEANUP_KEY]();
        } catch (error) {
            console.warn('[AjaExtension] Nao consegui limpar o carregador anterior.', error);
        }
    }

    const injectedDocuments = new WeakSet();
    const watchedDocuments = new WeakSet();
    const watchedIframes = new WeakSet();
    const observers = [];
    let scanTimer = null;

    function withCache(url) {
        return `${url}?v=${Date.now()}`;
    }

    function getMountPoint(doc) {
        return doc.documentElement || doc.head || doc.body;
    }

    function removeOldScript(doc, id) {
        const antigo = doc.getElementById(id);
        if (antigo) antigo.remove();
    }

    function appendScript(doc, id, url, onload, onerror) {
        const mountPoint = getMountPoint(doc);
        if (!mountPoint) return false;

        removeOldScript(doc, id);

        const script = doc.createElement('script');
        script.id = id;
        script.src = withCache(url);
        if (onload) script.onload = onload;
        if (onerror) script.onerror = onerror;
        mountPoint.appendChild(script);
        return true;
    }

    function appendSupportScripts(doc, origem) {
        appendScript(
            doc,
            THEME_ID,
            THEME_URL,
            null,
            () => console.warn(`[AjaExtension] Nao consegui carregar o tema Brisanet (${origem}).`)
        );

        appendScript(
            doc,
            CORRETOR_PATCH_ID,
            CORRETOR_PATCH_URL,
            null,
            () => console.warn(`[AjaExtension] Nao consegui carregar o patch do corretor (${origem}).`)
        );
    }

    function scheduleFrameScan() {
        if (scanTimer) clearTimeout(scanTimer);
        scanTimer = setTimeout(() => scanFrames(window, 'top'), 500);
    }

    function watchWindow(win, origem) {
        let doc;
        try {
            doc = win.document;
        } catch (error) {
            return;
        }

        if (!doc || watchedDocuments.has(doc)) return;

        const mountPoint = getMountPoint(doc);
        if (!mountPoint) return;

        watchedDocuments.add(doc);
        watchIframes(win, origem);

        const Observer = win.MutationObserver || window.MutationObserver;
        if (!Observer) return;

        const observer = new Observer(() => {
            watchIframes(win, origem);
            scheduleFrameScan();
        });

        observer.observe(mountPoint, { childList: true, subtree: true });
        observers.push(observer);
    }

    function injectIntoWindow(win, origem) {
        let doc;
        try {
            doc = win.document;
        } catch (error) {
            console.warn(`[AjaExtension] Frame inacessivel para o favorito (${origem}).`, error);
            return;
        }

        if (!doc || injectedDocuments.has(doc)) return;

        if (!getMountPoint(doc)) {
            setTimeout(() => injectIntoWindow(win, origem), 300);
            return;
        }

        injectedDocuments.add(doc);
        appendScript(
            doc,
            SCRIPT_ID,
            SCRIPT_URL,
            () => {
                console.log(`[AjaExtension] content.js carregado pelo GitHub Pages (${origem}).`);
                appendSupportScripts(doc, origem);
            },
            () => {
                const message = `[AjaExtension] Nao consegui carregar content.js (${origem}).`;
                if (win === window) {
                    alert('Nao consegui carregar o AjaExtension pelo GitHub Pages.');
                } else {
                    console.warn(message);
                }
            }
        );

        watchWindow(win, origem);
    }

    function watchIframes(win, origem) {
        let iframes;
        try {
            iframes = Array.from(win.document.querySelectorAll('iframe'));
        } catch (error) {
            return;
        }

        iframes.forEach((iframe, index) => {
            if (watchedIframes.has(iframe)) return;
            watchedIframes.add(iframe);

            iframe.addEventListener('load', () => {
                setTimeout(() => {
                    if (!iframe.contentWindow) return;
                    const frameOrigem = `${origem}.iframe${index}`;
                    injectIntoWindow(iframe.contentWindow, frameOrigem);
                    scanFrames(iframe.contentWindow, frameOrigem);
                }, 400);
            }, true);
        });
    }

    function scanFrames(win, origem) {
        try {
            watchWindow(win, origem);
        } catch (error) {
            return;
        }

        let frameCount = 0;
        try {
            frameCount = win.frames.length;
        } catch (error) {
            return;
        }

        for (let index = 0; index < frameCount; index += 1) {
            let childWindow;
            try {
                childWindow = win.frames[index];
            } catch (error) {
                continue;
            }

            if (!childWindow || childWindow === win) continue;

            const frameOrigem = `${origem}.frame${index}`;
            injectIntoWindow(childWindow, frameOrigem);
            scanFrames(childWindow, frameOrigem);
        }
    }

    window[CLEANUP_KEY] = function cleanupAjaExtensionFrameLoader() {
        observers.forEach((observer) => observer.disconnect());
        if (scanTimer) clearTimeout(scanTimer);
    };

    injectIntoWindow(window, 'top');
    scanFrames(window, 'top');
    setTimeout(() => scanFrames(window, 'top'), 1200);
    setTimeout(() => scanFrames(window, 'top'), 3000);
})();