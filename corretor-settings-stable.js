(function instalarConfiguracaoEstavelCorretor() {
    'use strict';

    const FLAG = '__AJA_CORRETOR_SETTINGS_STABLE__';
    const STYLE_ID = 'aja-corretor-settings-stable-style';
    const MODAL_ID = 'aja-corretor-settings-stable-modal';
    const KEY_CUSTOM_GEMINI = 'aja_voice_gemini_api_key';
    const KEY_THEME = 'aja_voice_panel_theme';

    if (window[FLAG]) return;
    window[FLAG] = true;

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
            console.warn('[Aja Corretor] Nao consegui salvar a chave:', error);
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
        const keys = [];
        try {
            for (let index = 0; index < localStorage.length; index += 1) {
                const key = localStorage.key(index);
                if (!key || !/(gemini|api.*key|key.*api|ia.*key|google.*key)/i.test(key)) continue;
                const value = localStorage.getItem(key) || '';
                if (value.length < 8) continue;
                keys.push({ key, value });
            }
        } catch (error) {
            return keys;
        }
        return keys.slice(0, 10);
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
            } catch (error) {
                lastError = error;
            }
        }

        throw lastError || new Error('Nao consegui consultar o Gemini.');
    }

    function installGeminiBridge() {
        if (!window.__ajaVoiceOriginalAskGemini && window.askGemini && !window.askGemini.__ajaStableGemini) {
            window.__ajaVoiceOriginalAskGemini = window.askGemini;
        }

        window.ajaVoiceAskGemini = async (prompt) => askGeminiWithSavedKey(prompt);
        window.ajaVoiceAskGemini.__ajaStableGemini = true;

        if (getKey()) {
            window.askGemini = window.ajaVoiceAskGemini;
            window.askGemini.__ajaStableGemini = true;
        } else if (window.__ajaVoiceOriginalAskGemini && window.askGemini?.__ajaStableGemini) {
            window.askGemini = window.__ajaVoiceOriginalAskGemini;
        }
    }

    function sourceLabel() {
        if (getKey()) return `Chave salva no tradutor (${KEY_CUSTOM_GEMINI})`;
        if (window.__ajaVoiceOriginalAskGemini || (window.askGemini && !window.askGemini.__ajaStableGemini)) return 'Assistente IA principal do Aja';
        return 'Nenhuma chave ativa';
    }

    function ensureStyle() {
        let style = document.getElementById(STYLE_ID);
        if (!style) {
            style = document.createElement('style');
            style.id = STYLE_ID;
            document.documentElement.appendChild(style);
        }

        style.textContent = `
            #spell-main-panel #aja-voice-settings-modal,
            #spell-main-panel #aja-voice-settings-modal.is-open {
                display: none !important;
            }
            #spell-main-panel {
                width: min(660px, calc(100vw - 32px)) !important;
                min-width: min(540px, calc(100vw - 32px)) !important;
                max-height: min(800px, calc(100vh - 32px)) !important;
                resize: both !important;
            }
            #spell-main-panel #panel-content-area {
                min-height: 410px !important;
                max-height: calc(100vh - 210px) !important;
                overflow: auto !important;
            }
            #spell-main-panel #voice-transcript-box {
                min-height: 210px !important;
            }
            #spell-main-panel.aja-voice-dark {
                background: #0f2742 !important;
                color: #fff !important;
                border-color: #2b5f93 !important;
            }
            #spell-main-panel.aja-voice-dark #panel-content-area,
            #spell-main-panel.aja-voice-dark .panel-tabs,
            #spell-main-panel.aja-voice-dark .panel-body {
                background: #0f2742 !important;
                color: #fff !important;
            }
            #spell-main-panel.aja-voice-dark textarea,
            #spell-main-panel.aja-voice-dark input {
                background: #173b63 !important;
                color: #fff !important;
                border-color: #2b5f93 !important;
            }
            #spell-main-panel.aja-voice-light {
                background: #f8fbff !important;
                color: #0f2742 !important;
            }
            #${MODAL_ID} {
                position: fixed;
                z-index: 2147483647;
                inset: 50%;
                transform: translate(-50%, -50%);
                width: min(560px, calc(100vw - 28px));
                max-height: calc(100vh - 40px);
                overflow: auto;
                display: none;
                flex-direction: column;
                gap: 12px;
                padding: 18px;
                border-radius: 16px;
                box-sizing: border-box;
                font-family: Arial, sans-serif;
                box-shadow: 0 28px 70px rgba(15, 39, 66, 0.46);
            }
            #${MODAL_ID}.is-open { display: flex; }
            #${MODAL_ID}.dark {
                background: #102a47;
                color: #fff;
                border: 1px solid #2b5f93;
            }
            #${MODAL_ID}.light {
                background: #fff;
                color: #0f2742;
                border: 1px solid #d6e4f2;
            }
            #${MODAL_ID} .modal-title { font-size: 18px; font-weight: 900; }
            #${MODAL_ID} .muted { font-size: 12px; opacity: .82; line-height: 1.4; }
            #${MODAL_ID} label { font-size: 12px; font-weight: 800; color: #ff8200; }
            #${MODAL_ID} input {
                width: 100%;
                min-height: 42px;
                border-radius: 10px;
                border: 1px solid #2b5f93;
                padding: 9px 11px;
                box-sizing: border-box;
                outline: none;
            }
            #${MODAL_ID}.dark input { background: #173b63; color: #fff; }
            #${MODAL_ID}.light input { background: #fff; color: #0f2742; border-color: #d6e4f2; }
            #${MODAL_ID} .row { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 8px; }
            #${MODAL_ID} button {
                min-height: 38px;
                border: 1px solid rgba(255,130,0,.75);
                border-radius: 10px;
                background: linear-gradient(135deg,#0057b8,#ff8200);
                color: #fff;
                font-weight: 800;
                cursor: pointer;
            }
            #${MODAL_ID} .card {
                border-radius: 12px;
                border: 1px solid rgba(0,87,184,.28);
                background: rgba(0,87,184,.12);
                padding: 10px;
                font-size: 12px;
                line-height: 1.4;
            }
            @media (max-width: 640px) {
                #spell-main-panel { min-width: 0 !important; width: calc(100vw - 20px) !important; left: 10px !important; right: auto !important; }
                #${MODAL_ID} .row { grid-template-columns: 1fr; }
            }
        `;
    }

    function applyTheme() {
        const panel = getPanel();
        const theme = getTheme();
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

    function buildModal() {
        let modal = document.getElementById(MODAL_ID);
        if (!modal) {
            modal = document.createElement('div');
            modal.id = MODAL_ID;
            document.documentElement.appendChild(modal);
        }

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
                <button id="aja-stable-close" style="width:42px; min-width:42px;">×</button>
            </div>
            <div>
                <label>Chave Gemini usada pelo tradutor</label>
                <input id="aja-stable-key" type="password" placeholder="${escapeHtml(maskKey(getKey()))}" autocomplete="off">
                <div class="muted" style="margin-top:6px;">Ela fica salva só neste navegador em <strong>${KEY_CUSTOM_GEMINI}</strong>. Se salvar uma chave aqui, o tradutor passa a usar ela.</div>
            </div>
            <div class="row">
                <button id="aja-stable-save">Salvar chave</button>
                <button id="aja-stable-test">Testar IA</button>
                <button id="aja-stable-clear">Limpar chave</button>
            </div>
            <div class="row">
                <button id="aja-stable-dark">Tema escuro</button>
                <button id="aja-stable-light">Tema claro</button>
                <button id="aja-stable-close2">Fechar</button>
            </div>
            <div>
                <label>Onde ele procura chave</label>
                <div class="card" style="margin-top:8px;">Primeiro usa <strong>${KEY_CUSTOM_GEMINI}</strong>. Se ela estiver vazia, tenta usar o Assistente IA principal do Aja, quando ele estiver ativo.</div>
            </div>
            <div>
                <label>Chaves parecidas encontradas</label>
                <div style="display:grid; grid-template-columns:repeat(auto-fit,minmax(170px,1fr)); gap:8px; margin-top:8px;">${cards}</div>
            </div>
            <div id="aja-stable-status" class="muted" style="min-height:18px;"></div>
        `;

        modal.querySelector('#aja-stable-close').onclick = closeModal;
        modal.querySelector('#aja-stable-close2').onclick = closeModal;
        modal.querySelector('#aja-stable-dark').onclick = () => setTheme('dark');
        modal.querySelector('#aja-stable-light').onclick = () => setTheme('light');
        modal.querySelector('#aja-stable-save').onclick = () => {
            const input = modal.querySelector('#aja-stable-key');
            const status = modal.querySelector('#aja-stable-status');
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
        modal.querySelector('#aja-stable-clear').onclick = () => {
            setKey('');
            installGeminiBridge();
            buildModal();
            openModal();
            const status = document.getElementById('aja-stable-status');
            if (status) status.textContent = 'Chave do tradutor removida.';
        };
        modal.querySelector('#aja-stable-test').onclick = async () => {
            const status = modal.querySelector('#aja-stable-status');
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

    function openModal() {
        ensureStyle();
        buildModal();
        const modal = document.getElementById(MODAL_ID);
        modal?.classList.add('is-open');
        applyTheme();
    }

    function closeModal() {
        document.getElementById(MODAL_ID)?.classList.remove('is-open');
    }

    function replaceSettingsButton() {
        const button = document.getElementById('btn-voice-settings');
        if (!button || button.dataset.ajaStableSettings === '1') return;

        const clone = button.cloneNode(true);
        clone.dataset.ajaStableSettings = '1';
        clone.onclick = (event) => {
            event.preventDefault();
            event.stopPropagation();
            openModal();
        };
        button.replaceWith(clone);
    }

    function enhance() {
        ensureStyle();
        installGeminiBridge();
        applyTheme();
        replaceSettingsButton();
    }

    ensureStyle();
    installGeminiBridge();
    setInterval(enhance, 250);
})();