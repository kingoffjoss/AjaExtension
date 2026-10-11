(function forcarAberturaConfiguracoesCorretor() {
    'use strict';

    const FLAG = '__AJA_CORRETOR_SETTINGS_FORCE_VERSION__';
    const VERSION = 'force-modal-2026-10-11-1';
    const STYLE_ID = 'aja-corretor-settings-force-style';
    const MODAL_ID = 'aja-corretor-settings-force-modal';
    const KEY_CUSTOM_GEMINI = 'aja_voice_gemini_api_key';
    const KEY_THEME = 'aja_voice_panel_theme';
    const CURRENT_STABLE_VERSION = 'modal-cheio-2026-10-11-3';

    if (window[FLAG] === VERSION) return;
    window[FLAG] = VERSION;

    function mountPoint() {
        return document.body || document.documentElement;
    }

    function escapeHtml(value) {
        return String(value ?? '').replace(/[&<>"']/g, (char) => ({
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            '"': '&quot;',
            "'": '&#39;'
        }[char]));
    }

    function getPanel() {
        return window.spellCheckerModule?.panel || document.getElementById('spell-main-panel');
    }

    function getKey() {
        try {
            return localStorage.getItem(KEY_CUSTOM_GEMINI) || '';
        } catch (error) {
            return '';
        }
    }

    function setKey(value) {
        try {
            const cleaned = String(value || '').trim();
            if (cleaned) localStorage.setItem(KEY_CUSTOM_GEMINI, cleaned);
            else localStorage.removeItem(KEY_CUSTOM_GEMINI);
        } catch (error) {
            console.warn('[Aja Corretor] Nao consegui salvar a chave da IA:', error);
        }
    }

    function getTheme() {
        try {
            return localStorage.getItem(KEY_THEME) || 'dark';
        } catch (error) {
            return 'dark';
        }
    }

    function setTheme(theme) {
        try {
            localStorage.setItem(KEY_THEME, theme);
        } catch (error) {
            console.warn('[Aja Corretor] Nao consegui salvar o tema:', error);
        }
        applyTheme();
    }

    function maskKey(value) {
        const text = String(value || '').trim();
        if (!text) return 'nao configurada';
        if (text.length <= 10) return `${text.slice(0, 3)}...`;
        return `${text.slice(0, 6)}...${text.slice(-4)}`;
    }

    function listPossibleKeys() {
        const found = [];
        try {
            for (let index = 0; index < localStorage.length; index += 1) {
                const key = localStorage.key(index);
                if (!key || !/(gemini|api.*key|key.*api|ia.*key|google.*key)/i.test(key)) continue;
                const value = localStorage.getItem(key) || '';
                if (value.length < 8) continue;
                found.push({ key, value });
            }
        } catch (error) {
            return found;
        }
        return found.slice(0, 10);
    }

    async function askGeminiWithSavedKey(prompt) {
        const apiKey = getKey();
        if (!apiKey) throw new Error('Chave Gemini nao configurada.');

        const body = {
            contents: [{ parts: [{ text: String(prompt || '') }] }],
            generationConfig: { temperature: 0.2, maxOutputTokens: 2048 }
        };
        const models = ['gemini-2.0-flash', 'gemini-1.5-flash', 'gemini-1.5-flash-latest'];
        let lastError = null;

        for (const model of models) {
            try {
                const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(apiKey)}`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(body)
                });
                const data = await response.json().catch(() => ({}));
                if (!response.ok) {
                    lastError = new Error(data?.error?.message || `Gemini ${response.status}`);
                    continue;
                }
                const text = (data?.candidates?.[0]?.content?.parts || []).map((part) => part.text || '').join('\n').trim();
                if (text) return text;
                lastError = new Error('Gemini respondeu sem texto.');
            } catch (error) {
                lastError = error;
            }
        }

        throw lastError || new Error('Nao consegui consultar o Gemini.');
    }

    function installGeminiBridge() {
        if (!window.__ajaVoiceOriginalAskGemini && window.askGemini && !window.askGemini.__ajaForceGemini && !window.askGemini.__ajaStableGemini && !window.askGemini.__ajaVoiceGemini) {
            window.__ajaVoiceOriginalAskGemini = window.askGemini;
        }

        window.ajaVoiceForceAskGemini = async (prompt) => askGeminiWithSavedKey(prompt);
        window.ajaVoiceForceAskGemini.__ajaForceGemini = true;

        if (getKey()) {
            window.askGemini = window.ajaVoiceForceAskGemini;
            window.askGemini.__ajaForceGemini = true;
        } else if (window.__ajaVoiceOriginalAskGemini && window.askGemini?.__ajaForceGemini) {
            window.askGemini = window.__ajaVoiceOriginalAskGemini;
        }
    }

    function sourceLabel() {
        if (getKey()) return `Chave salva no tradutor (${KEY_CUSTOM_GEMINI})`;
        if (window.__ajaVoiceOriginalAskGemini || (window.askGemini && !window.askGemini.__ajaForceGemini && !window.askGemini.__ajaStableGemini && !window.askGemini.__ajaVoiceGemini)) {
            return 'Assistente IA principal do Aja';
        }
        return 'Nenhuma chave ativa';
    }

    function ensureStyle() {
        let style = document.getElementById(STYLE_ID);
        if (!style) {
            style = document.createElement('style');
            style.id = STYLE_ID;
            (document.head || document.documentElement).appendChild(style);
        }

        style.textContent = `
            #spell-main-panel {
                width: min(720px, calc(100vw - 28px)) !important;
                min-width: min(560px, calc(100vw - 28px)) !important;
                max-height: min(820px, calc(100vh - 28px)) !important;
            }
            #spell-main-panel #panel-content-area {
                min-height: 430px !important;
                max-height: calc(100vh - 210px) !important;
                overflow: auto !important;
            }
            #spell-main-panel #voice-transcript-box {
                min-height: 210px !important;
            }
            #spell-main-panel > #aja-voice-settings-modal,
            #spell-main-panel > #aja-voice-settings-modal.is-open,
            #aja-corretor-settings-stable-modal,
            #aja-corretor-settings-stable-modal.is-open {
                display: none !important;
                visibility: hidden !important;
                pointer-events: none !important;
            }
            #${MODAL_ID} {
                position: fixed !important;
                z-index: 2147483647 !important;
                top: 50% !important;
                left: 50% !important;
                transform: translate(-50%, -50%) !important;
                width: min(680px, calc(100vw - 30px)) !important;
                min-width: min(470px, calc(100vw - 30px)) !important;
                min-height: min(520px, calc(100vh - 34px)) !important;
                max-height: calc(100vh - 34px) !important;
                display: none !important;
                grid-template-rows: auto auto auto auto 1fr auto !important;
                gap: 14px !important;
                padding: 20px !important;
                overflow: hidden !important;
                border-radius: 18px !important;
                box-sizing: border-box !important;
                font-family: Arial, sans-serif !important;
                box-shadow: 0 30px 80px rgba(15, 39, 66, .58) !important;
                opacity: 1 !important;
                visibility: visible !important;
                pointer-events: auto !important;
            }
            #${MODAL_ID}.is-open { display: grid !important; }
            #${MODAL_ID}.dark {
                background: #102a47 !important;
                color: #fff !important;
                border: 1px solid #2b5f93 !important;
            }
            #${MODAL_ID}.light {
                background: #fff !important;
                color: #0f2742 !important;
                border: 1px solid #d6e4f2 !important;
            }
            #${MODAL_ID} * { box-sizing: border-box !important; }
            #${MODAL_ID} .modal-title {
                font-size: 20px !important;
                font-weight: 900 !important;
                line-height: 1.15 !important;
            }
            #${MODAL_ID} .muted {
                font-size: 12px !important;
                opacity: .86 !important;
                line-height: 1.45 !important;
            }
            #${MODAL_ID} label {
                display: block !important;
                margin-bottom: 7px !important;
                font-size: 12px !important;
                font-weight: 900 !important;
                color: #ff8200 !important;
                text-transform: uppercase !important;
            }
            #${MODAL_ID} input {
                width: 100% !important;
                min-height: 44px !important;
                border-radius: 12px !important;
                border: 1px solid #2b5f93 !important;
                padding: 10px 12px !important;
                outline: none !important;
                font-size: 13px !important;
            }
            #${MODAL_ID}.dark input {
                background: #173b63 !important;
                color: #fff !important;
            }
            #${MODAL_ID}.light input {
                background: #fff !important;
                color: #0f2742 !important;
                border-color: #d6e4f2 !important;
            }
            #${MODAL_ID} .row {
                display: grid !important;
                grid-template-columns: repeat(3, minmax(0, 1fr)) !important;
                gap: 10px !important;
            }
            #${MODAL_ID} button {
                min-height: 40px !important;
                border: 1px solid rgba(255,130,0,.75) !important;
                border-radius: 11px !important;
                background: linear-gradient(135deg,#0057b8,#ff8200) !important;
                color: #fff !important;
                font-weight: 900 !important;
                cursor: pointer !important;
                text-align: center !important;
                white-space: normal !important;
            }
            #${MODAL_ID} .card {
                border-radius: 13px !important;
                border: 1px solid rgba(0,87,184,.30) !important;
                background: rgba(0,87,184,.14) !important;
                padding: 11px !important;
                font-size: 12px !important;
                line-height: 1.45 !important;
                overflow-wrap: anywhere !important;
            }
            #${MODAL_ID} .scroll-area {
                min-height: 0 !important;
                overflow: auto !important;
                display: grid !important;
                gap: 12px !important;
                padding-right: 4px !important;
            }
            #${MODAL_ID} .key-grid {
                display: grid !important;
                grid-template-columns: repeat(auto-fit, minmax(190px, 1fr)) !important;
                gap: 9px !important;
                margin-top: 8px !important;
            }
            @media (max-width: 760px) {
                #spell-main-panel {
                    min-width: 0 !important;
                    width: calc(100vw - 20px) !important;
                    left: 10px !important;
                    right: auto !important;
                }
                #${MODAL_ID} {
                    width: calc(100vw - 22px) !important;
                    min-width: 0 !important;
                    padding: 16px !important;
                }
                #${MODAL_ID} .row { grid-template-columns: 1fr !important; }
            }
        `;
    }

    function hideOldModals() {
        document.querySelectorAll('#spell-main-panel > #aja-voice-settings-modal, #aja-corretor-settings-stable-modal').forEach((modal) => {
            modal.classList.remove('is-open');
            modal.style.setProperty('display', 'none', 'important');
            modal.style.setProperty('visibility', 'hidden', 'important');
            modal.style.setProperty('pointer-events', 'none', 'important');
        });
    }

    function applyTheme() {
        const theme = getTheme();
        const panel = getPanel();
        if (panel) {
            panel.classList.toggle('aja-voice-dark', theme === 'dark');
            panel.classList.toggle('aja-voice-light', theme !== 'dark');
        }
        const themeButton = document.getElementById('btn-voice-theme');
        if (themeButton) {
            themeButton.textContent = theme === 'dark' ? '☀' : '🌙';
            themeButton.title = theme === 'dark' ? 'Mudar para tema claro' : 'Mudar para tema escuro';
        }
        const modal = document.getElementById(MODAL_ID);
        if (modal) {
            modal.classList.toggle('dark', theme === 'dark');
            modal.classList.toggle('light', theme !== 'dark');
        }
    }

    function protectModal(modal) {
        if (modal.dataset.ajaForceProtected === VERSION) return;
        modal.dataset.ajaForceProtected = VERSION;
        ['pointerdown', 'mousedown', 'mouseup', 'click', 'dblclick', 'focusin', 'keydown', 'keyup', 'input'].forEach((eventName) => {
            modal.addEventListener(eventName, (event) => event.stopPropagation(), false);
        });
    }

    function buildModal() {
        let modal = document.getElementById(MODAL_ID);
        if (!modal) {
            modal = document.createElement('div');
            modal.id = MODAL_ID;
            mountPoint().appendChild(modal);
        } else if (modal.parentElement !== mountPoint()) {
            mountPoint().appendChild(modal);
        }
        protectModal(modal);

        const candidates = listPossibleKeys();
        const cards = candidates.length
            ? candidates.map((item) => `<div class="card"><strong>${escapeHtml(item.key)}</strong><br>${escapeHtml(maskKey(item.value))}</div>`).join('')
            : '<div class="card">Nenhuma outra chave parecida foi encontrada.</div>';

        modal.innerHTML = `
            <div style="display:flex; align-items:flex-start; justify-content:space-between; gap:12px;">
                <div>
                    <div class="modal-title">Configurações do Tradutor</div>
                    <div class="muted">Fonte da IA: ${escapeHtml(sourceLabel())}</div>
                </div>
                <button id="aja-force-close" style="width:44px !important; min-width:44px !important;">×</button>
            </div>
            <div>
                <label>Chave Gemini usada pelo tradutor</label>
                <input id="aja-force-key" type="password" placeholder="${escapeHtml(maskKey(getKey()))}" autocomplete="off">
                <div class="muted" style="margin-top:7px;">Ela fica salva só neste navegador em <strong>${KEY_CUSTOM_GEMINI}</strong>. Se salvar uma chave aqui, o tradutor passa a usar ela.</div>
            </div>
            <div class="row">
                <button id="aja-force-save">Salvar chave</button>
                <button id="aja-force-test">Testar IA</button>
                <button id="aja-force-clear">Limpar chave</button>
            </div>
            <div class="row">
                <button id="aja-force-dark">Tema escuro</button>
                <button id="aja-force-light">Tema claro</button>
                <button id="aja-force-close2">Fechar</button>
            </div>
            <div class="scroll-area">
                <div>
                    <label>Onde ele procura chave</label>
                    <div class="card">Primeiro usa <strong>${KEY_CUSTOM_GEMINI}</strong>. Se ela estiver vazia, tenta usar o Assistente IA principal do Aja, quando ele estiver ativo.</div>
                </div>
                <div>
                    <label>Chaves parecidas encontradas</label>
                    <div class="key-grid">${cards}</div>
                </div>
            </div>
            <div id="aja-force-status" class="muted" style="min-height:18px;"></div>
        `;

        modal.querySelector('#aja-force-close').onclick = closeModal;
        modal.querySelector('#aja-force-close2').onclick = closeModal;
        modal.querySelector('#aja-force-dark').onclick = () => setTheme('dark');
        modal.querySelector('#aja-force-light').onclick = () => setTheme('light');
        modal.querySelector('#aja-force-save').onclick = () => {
            const input = modal.querySelector('#aja-force-key');
            const status = modal.querySelector('#aja-force-status');
            const value = input.value.trim();
            if (!value) {
                status.textContent = 'Cole uma chave antes de salvar.';
                return;
            }
            setKey(value);
            installGeminiBridge();
            status.textContent = `Chave salva: ${maskKey(value)}.`;
            input.value = '';
        };
        modal.querySelector('#aja-force-clear').onclick = () => {
            setKey('');
            installGeminiBridge();
            buildModal();
            openModal();
            const status = document.getElementById('aja-force-status');
            if (status) status.textContent = 'Chave do tradutor removida.';
        };
        modal.querySelector('#aja-force-test').onclick = async () => {
            const status = modal.querySelector('#aja-force-status');
            status.textContent = 'Testando IA...';
            try {
                const response = await (getKey() ? askGeminiWithSavedKey('Responda somente com: OK') : (window.askGemini ? window.askGemini('Responda somente com: OK') : Promise.reject(new Error('Sem IA ativa'))));
                status.textContent = `IA respondeu: ${String(response || '').slice(0, 90)}`;
            } catch (error) {
                status.textContent = `Falha no teste: ${error.message || error}`;
            }
        };

        applyTheme();
    }

    function openModal(event) {
        if (event) {
            event.preventDefault();
            event.stopPropagation();
        }
        ensureStyle();
        hideOldModals();
        buildModal();
        document.getElementById(MODAL_ID)?.classList.add('is-open');
        applyTheme();
    }

    function closeModal(event) {
        if (event) {
            event.preventDefault();
            event.stopPropagation();
        }
        document.getElementById(MODAL_ID)?.classList.remove('is-open');
    }

    function createSettingsButton(panel) {
        const actions = panel?.querySelector('.panel-header-top > div:last-child');
        if (!actions) return null;
        const button = document.createElement('button');
        button.className = 'btn-fix-all';
        button.id = 'btn-voice-settings';
        button.textContent = '⚙';
        button.title = 'Configurações do tradutor e IA';
        const closeButton = panel.querySelector('#btn-spell-close');
        actions.insertBefore(button, closeButton || actions.firstChild);
        return button;
    }

    function forceSettingsButton() {
        const panel = getPanel();
        let button = document.getElementById('btn-voice-settings');
        if (!button && panel) button = createSettingsButton(panel);
        if (!button || button.dataset.ajaForceSettings === VERSION) return;

        const clone = button.cloneNode(true);
        clone.id = 'btn-voice-settings';
        clone.textContent = '⚙';
        clone.title = 'Configurações do tradutor e IA';
        clone.dataset.ajaForceSettings = VERSION;
        clone.dataset.ajaStableSettings = '1';
        clone.dataset.ajaStableSettingsVersion = CURRENT_STABLE_VERSION;
        clone.onclick = null;
        clone.addEventListener('click', openModal, true);
        button.replaceWith(clone);
    }

    function enhance() {
        ensureStyle();
        installGeminiBridge();
        applyTheme();
        hideOldModals();
        forceSettingsButton();
    }

    ensureStyle();
    installGeminiBridge();
    window.__AJA_CORRETOR_SETTINGS_FORCE_OPEN__ = openModal;
    setInterval(enhance, 100);
    enhance();
})();