const ALLOWED_FETCH_HOSTS = new Set([
    'api.github.com',
    'api.ipify.org',
    'api.languagetool.org',
    'cachefly.cachefly.net',
    'generativelanguage.googleapis.com',
    'open.er-api.com',
    'script.google.com',
    'script.googleusercontent.com',
    'kingoffjoss.github.io',
    'www.soundjay.com'
]);

const ALLOWED_METHODS = new Set(['GET', 'POST', 'PUT']);

function buildSafeFetchOptions(options = {}) {
    const method = String(options.method || 'GET').toUpperCase();
    if (!ALLOWED_METHODS.has(method)) {
        throw new Error(`Método não permitido: ${method}`);
    }

    const safeOptions = { method };
    if (options.headers && typeof options.headers === 'object') {
        safeOptions.headers = options.headers;
    }
    if (Object.prototype.hasOwnProperty.call(options, 'body')) {
        safeOptions.body = options.body;
    }
    return safeOptions;
}

function assertAllowedUrl(rawUrl) {
    const parsedUrl = new URL(rawUrl);
    if (parsedUrl.protocol !== 'https:' || !ALLOWED_FETCH_HOSTS.has(parsedUrl.hostname)) {
        throw new Error(`Host não permitido: ${parsedUrl.hostname}`);
    }
}

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action !== 'fetchAPI') return false;

    try {
        assertAllowedUrl(request.url);
        const fetchOptions = buildSafeFetchOptions(request.options);

        // Google Apps Script redireciona (302), e o fetch segue por padrão.
        fetch(request.url, fetchOptions)
            .then(async response => {
                const text = await response.text();
                sendResponse({
                    success: true,
                    text,
                    status: response.status,
                    ok: response.ok
                });
            })
            .catch(error => {
                sendResponse({ success: false, error: error.toString() });
            });
    } catch (error) {
        sendResponse({ success: false, error: error.toString() });
    }

    return true;
});
