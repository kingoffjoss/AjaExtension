(function encerrarClienteNativo() {
    const BUTTON_ID = 'btn-encerrar-cliente-nativo';
    const TEST_END_BUTTON_ID = 'call-control-end-sms-button';
    const END_BUTTON_SELECTORS = ['#call-control-end-sms-button'];
    const TOOLBAR_SELECTORS = [
        'div.interaction-controls-primary',
        'div[data-qa-id="interaction-controls-primary"]',
        '.actions-container',
        'div[role="toolbar"]'
    ];

    function findEl(selectors, parent = document) {
        for (const selector of selectors) {
            const el = parent.querySelector(selector);
            if (el) return el;
        }
        return null;
    }

    function notify(message) {
        const existing = document.getElementById('encerrar-cliente-native-toast');
        if (existing) existing.remove();

        const toast = document.createElement('div');
        toast.id = 'encerrar-cliente-native-toast';
        toast.textContent = message;
        toast.style.cssText = [
            'position:fixed',
            'right:20px',
            'bottom:20px',
            'z-index:2147483647',
            'background:#181825',
            'color:#fff',
            'border:1px solid #333352',
            'border-radius:8px',
            'padding:10px 14px',
            'font:600 12px Segoe UI, sans-serif',
            'box-shadow:0 8px 24px rgba(0,0,0,.35)'
        ].join(';');
        document.body.appendChild(toast);
        setTimeout(() => toast.remove(), 2500);
    }

    function encerrarCliente() {
        const endButton = document.getElementById(TEST_END_BUTTON_ID);
        if (!endButton) {
            notify('Botão de teste sem avaliação não encontrado no Genesys.');
            return;
        }

        endButton.click();
        notify('Encerramento de teste acionado sem abrir avaliação.');
    }

    function createButton() {
        document.getElementById(BUTTON_ID)?.remove();

        const button = document.createElement('button');
        button.id = BUTTON_ID;
        button.type = 'button';
        button.textContent = '🌶️';
        button.title = 'Encerrar cliente';
        button.style.cssText = [
            'background:#d93b3b',
            'color:#fff',
            'border:1px solid #b02a2a',
            'width:34px',
            'height:34px',
            'padding:0',
            'font:700 17px Segoe UI, sans-serif',
            'border-radius:6px',
            'cursor:pointer',
            'display:inline-flex',
            'align-items:center',
            'justify-content:center',
            'white-space:nowrap'
        ].join(';');
        button.addEventListener('click', encerrarCliente);

        return button;
    }

    function mount() {
        const toolbar = findEl(TOOLBAR_SELECTORS);
        const button = createButton();
        const nativeEndButton = toolbar ? findEl(END_BUTTON_SELECTORS, toolbar) : null;

        if (nativeEndButton?.parentNode) {
            nativeEndButton.parentNode.insertBefore(button, nativeEndButton);
            return true;
        }

        if (toolbar) {
            toolbar.prepend(button);
            return true;
        }

        return false;
    }

    if (!mount()) {
        const observer = new MutationObserver(() => {
            if (mount()) observer.disconnect();
        });
        observer.observe(document.body, { childList: true, subtree: true });
    }
})();
