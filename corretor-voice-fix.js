(function protegerAbaTraducaoCorretor() {
    'use strict';

    const FLAG = '__AJA_CORRETOR_VOICE_FIX_VERSION__';
    const VERSION = 'settings-dark-wide-2026-10-11';
    const STYLE_ID = 'aja-corretor-voice-style';
    const KEY_CUSTOM_GEMINI = 'aja_voice_gemini_api_key';
    const KEY_THEME = 'aja_voice_panel_theme';
    const KEY_LAST_SOURCE = 'aja_voice_gemini_source';

    if (window[FLAG] === VERSION) return;
    window[FLAG] = VERSION;

    if (!window.__ajaVoiceOriginalAskGemini && window.askGemini && !window.askGemini.__ajaVoiceGemini) {
        window.__ajaVoiceOriginalAskGemini = window.askGemini;
    }

    function getChecker() {
        return window.spellCheckerModule || null;
    }

    function getPanel(checker) {
        return checker?.panel || document.getElementById('spell-main-panel') || null;
    }

    function isInsidePanel(target, panel) {
        return Boolean(panel && target instanceof Node && panel.contains(target));
    }

    function isVoiceTextarea(target) {
        return Boolean(target instanceof Element && target.closest('#voice-transcript-box'));
    }

    function isCloseButton(target) {
        return Boolean(target instanceof Element && target.closest('#btn-spell-close'));
    }

    function isInteractiveDragTarget(target) {
        return Boolean(target instanceof Element && target.closest('button,input,textarea,select,a,[contenteditable="true"]'));
    }

    function clamp(value, min, max) {
        return Math.min(Math.max(value, min), max);
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

    function getSavedTheme() {
        try {
            return localStorage.getItem(KEY_THEME) || 'dark';
        } catch (error) {
            return 'dark';
        }
    }

    function setSavedTheme(theme) {
        try {
            localStorage.setItem(KEY_THEME, theme);
        } catch (error) {
            console.warn('[Aja Corretor] Nao consegui salvar o tema:', error);
        }
    }

    function getCustomGeminiKey() {
        try {
            return localStorage.getItem(KEY_CUSTOM_GEMINI) || '';
        } catch (error) {
            return '';
        }
    }

    function setCustomGeminiKey(value) {
        const key = String(value || '').trim();
        try {
            if (key) {
                localStorage.setItem(KEY_CUSTOM_GEMINI, key);
                localStorage.setItem(KEY_LAST_SOURCE, 'tradutor');
            } else {
                localStorage.removeItem(KEY_CUSTOM_GEMINI);
                localStorage.removeItem(KEY_LAST_SOURCE);
            }
        } catch (error) {
            console.warn('[Aja Corretor] Nao consegui salvar a chave Gemini:', error);
        }
    }

    function maskKey(value) {
        const text = String(value || '').trim();
        if (!text) return 'nao configurada';
        if (text.length <= 10) return `${text.slice(0, 3)}...`;
        return `${text.slice(0, 6)}...${text.slice(-4)}`;
    }

    function findStoredKeyCandidates() {
        const found = [];
        try {
            for (let index = 0; index < localStorage.length; index += 1) {
                const key = localStorage.key(index);
                if (!key || !/(gemini|api.*key|key.*api|ia.*key|google.*key)/i.test(key)) continue;
                const value = localStorage.getItem(key) || '';
                if (!value || value.length < 8) continue;
                found.push({ key, value });
            }
        } catch (error) {
            return found;
        }
        return found.slice(0, 8);
    }

    async function callGeminiWithKey(prompt) {
        const apiKey = getCustomGeminiKey();
        if (!apiKey) throw new Error('Chave Gemini nao configurada no tradutor.');

        const body = {
            contents: [{ parts: [{ text: String(prompt || '') }] }],
            generationConfig: {
                temperature: 0.2,
                topP: 0.9,
                maxOutputTokens: 2048
            }
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

                const parts = data?.candidates?.[0]?.content?.parts || [];
                const text = parts.map((part) => part.text || '').join('\n').trim();
                if (text) return text;
                lastError = new Error('Gemini respondeu sem texto.');
            } catch (error) {
                lastError = error;
            }
        }

        throw lastError || new Error('Nao consegui consultar o Gemini.');
    }

    function installGeminiBridge() {
        const customKey = getCustomGeminiKey();
        window.ajaVoiceAskGemini = async function ajaVoiceAskGemini(prompt) {
            return callGeminiWithKey(prompt);
        };
        window.ajaVoiceAskGemini.__ajaVoiceGemini = true;

        if (customKey) {
            window.askGemini = window.ajaVoiceAskGemini;
            window.askGemini.__ajaVoiceGemini = true;
        } else if (window.__ajaVoiceOriginalAskGemini && window.askGemini?.__ajaVoiceGemini) {
            window.askGemini = window.__ajaVoiceOriginalAskGemini;
        } else if (!window.askGemini) {
            window.askGemini = window.ajaVoiceAskGemini;
            window.askGemini.__ajaVoiceGemini = true;
        }
    }

    function getGeminiSourceLabel() {
        if (getCustomGeminiKey()) return 'Chave do Tradutor';
        if (window.__ajaVoiceOriginalAskGemini || (window.askGemini && !window.askGemini.__ajaVoiceGemini)) return 'Assistente IA principal';
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
            #spell-main-panel {
                width: min(620px, calc(100vw - 36px)) !important;
                min-width: min(520px, calc(100vw - 36px)) !important;
                max-height: min(780px, calc(100vh - 36px)) !important;
                overflow: hidden !important;
                border-radius: 16px !important;
                resize: both !important;
            }
            #spell-main-panel .panel-header-top {
                min-height: 70px !important;
                padding: 14px 18px !important;
                box-sizing: border-box !important;
            }
            #spell-main-panel .panel-title {
                max-width: 330px !important;
                line-height: 1.18 !important;
                font-size: 16px !important;
            }
            #spell-main-panel .panel-tabs {
                display: grid !important;
                grid-template-columns: repeat(3, minmax(0, 1fr)) !important;
                min-height: 54px !important;
            }
            #spell-main-panel .tab-btn-p {
                display: flex !important;
                align-items: center !important;
                justify-content: center !important;
                text-align: center !important;
                padding: 10px 8px !important;
                line-height: 1.15 !important;
                white-space: normal !important;
            }
            #spell-main-panel #panel-content-area {
                min-height: 390px !important;
                max-height: calc(100vh - 210px) !important;
                overflow: auto !important;
            }
            #spell-main-panel #voice-transcript-box {
                min-height: 190px !important;
                font-size: 14px !important;
                line-height: 1.5 !important;
            }
            #spell-main-panel #btn-voice-settings,
            #spell-main-panel #btn-voice-theme {
                min-width: 38px !important;
                width: 38px !important;
                height: 34px !important;
                padding: 0 !important;
                display: inline-flex !important;
                align-items: center !important;
                justify-content: center !important;
                font-size: 16px !important;
            }
            #spell-main-panel.aja-voice-dark {
                background: #0f2742 !important;
                color: #ffffff !important;
                border: 1px solid #2b5f93 !important;
                box-shadow: 0 24px 60px rgba(15, 39, 66, 0.55) !important;
            }
            #spell-main-panel.aja-voice-dark .panel-tabs,
            #spell-main-panel.aja-voice-dark #panel-content-area,
            #spell-main-panel.aja-voice-dark .panel-body {
                background: #0f2742 !important;
                color: #ffffff !important;
            }
            #spell-main-panel.aja-voice-dark .tab-btn-p {
                background: #173b63 !important;
                color: #d6e4f2 !important;
                border-color: #2b5f93 !important;
            }
            #spell-main-panel.aja-voice-dark .tab-btn-p.active {
                color: #ff8200 !important;
                background: #0f2742 !important;
                border-bottom-color: #ff8200 !important;
            }
            #spell-main-panel.aja-voice-dark #voice-transcript-box,
            #spell-main-panel.aja-voice-dark input,
            #spell-main-panel.aja-voice-dark textarea,
            #spell-main-panel.aja-voice-dark select {
                background: #173b63 !important;
                color: #ffffff !important;
                border-color: #2b5f93 !important;
            }
            #spell-main-panel.aja-voice-dark #voice-status,
            #spell-main-panel.aja-voice-dark .aja-voice-muted {
                color: #d6e4f2 !important;
            }
            #spell-main-panel.aja-voice-light {
                background: #f8fbff !important;
                color: #0f2742 !important;
                border: 1px solid #d6e4f2 !important;
            }
            #aja-voice-settings-modal {
                position: absolute !important;
                inset: 84px 18px 18px 18px !important;
                z-index: 999999 !important;
                display: none;
                flex-direction: column;
                gap: 12px;
                padding: 16px;
                border-radius: 14px;
                box-shadow: 0 20px 48px rgba(15, 39, 66, 0.32);
                box-sizing: border-box;
                overflow: auto;
            }
            #spell-main-panel.aja-voice-dark #aja-voice-settings-modal {
                background: #102a47 !important;
                color: #ffffff !important;
                border: 1px solid #2b5f93 !important;
            }
            #spell-main-panel.aja-voice-light #aja-voice-settings-modal {
                background: #ffffff !important;
                color: #0f2742 !important;
                border: 1px solid #d6e4f2 !important;
            }
            #aja-voice-settings-modal.is-open {
                display: flex !important;
            }
            #aja-voice-settings-modal label {
                font-size: 12px;
                font-weight: 800;
                color: #ff8200;
            }
            #aja-voice-settings-modal input {
                width: 100%;
                min-height: 38px;
                border-radius: 10px;
                padding: 8px 10px;
                box-sizing: border-box;
                outline: none;
            }
            #aja-voice-settings-modal .settings-row {
                display: grid;
                grid-template-columns: repeat(3, minmax(0, 1fr));
                gap: 8px;
            }
            #aja-voice-settings-modal .settings-card {
                border-radius: 12px;
                padding: 10px;
                border: 1px solid rgba(0, 87, 184, 0.22);
                background: rgba(0, 87, 184, 0.08);
                font-size: 12px;
                line-height: 1.4;
            }
            @media (max-width: 680px) {
                #spell-main-panel {
                    width: calc(100vw - 20px) !important;
                    min-width: 0 !important;
                    left: 10px !important;
                    right: auto !important;
                }
                #spell-main-panel .panel-title {
                    max-width: 220px !important;
                }
                #aja-voice-settings-modal .settings-row {
                    grid-template-columns: 1fr !important;
                }
            }
        `;
    }

    function forceDisplay(checker, panel) {
        if (!panel || panel.dataset.ajaAllowClose === '1') return;
        const focusInPanel = isInsidePanel(document.activeElement, panel);
        const focusInVoice = isVoiceTextarea(document.activeElement);
        const keepOpen = checker?.__ajaKeepPanelOpenUntil && checker.__ajaKeepPanelOpenUntil > Date.now();

        if (focusInPanel || focusInVoice || keepOpen) panel.style.display = 'flex';
    }

    function keepPanelOpen(checker, panel) {
        if (checker) checker.__ajaKeepPanelOpenUntil = Date.now() + 3000;
        if (panel) panel.dataset.ajaAllowClose = '0';
        forceDisplay(checker, panel);
        [0, 80, 220, 500].forEach((delay) => setTimeout(() => forceDisplay(checker, panel), delay));
    }

    function releasePanel(checker, panel) {
        if (checker) checker.__ajaKeepPanelOpenUntil = 0;
        if (panel) panel.dataset.ajaAllowClose = '1';
    }

    function applyTheme(panel) {
        if (!panel) return;
        const theme = getSavedTheme();
        panel.classList.toggle('aja-voice-dark', theme === 'dark');
        panel.classList.toggle('aja-voice-light', theme !== 'dark');
        const themeButton = panel.querySelector('#btn-voice-theme');
        if (themeButton) {
            themeButton.textContent = theme === 'dark' ? '☀' : '🌙';
            themeButton.title = theme === 'dark' ? 'Mudar para tema claro' : 'Mudar para tema escuro';
        }
    }

    function protectOcultarTudo(checker) {
        if (!checker || checker.__ajaVoiceFixOcultarProtegidoV5) return;
        const originalOcultarTudo = typeof checker.ocultarTudo === 'function' ? checker.ocultarTudo.bind(checker) : null;

        checker.__ajaVoiceFixOcultarProtegidoV5 = true;
        checker.ocultarTudo = function ocultarTudoProtegido() {
            const panel = getPanel(this);
            const keepOpen = this.__ajaKeepPanelOpenUntil && this.__ajaKeepPanelOpenUntil > Date.now();
            const focusInside = isInsidePanel(document.activeElement, panel) && !isCloseButton(document.activeElement);

            if ((keepOpen || focusInside) && panel?.style.display !== 'none' && panel?.dataset.ajaAllowClose !== '1') {
                panel.style.display = 'flex';
                return;
            }

            if (originalOcultarTudo) return originalOcultarTudo();
            if (panel) panel.style.display = 'none';
        };
    }

    function protectVoiceTextarea(checker) {
        const panel = getPanel(checker);
        const textarea = panel?.querySelector('#voice-transcript-box');
        if (!panel || !textarea || textarea.__ajaVoiceFixTextareaV5) return;
        textarea.__ajaVoiceFixTextareaV5 = true;

        ['pointerdown', 'mousedown', 'mouseup', 'click', 'dblclick', 'focus', 'focusin'].forEach((eventName) => {
            textarea.addEventListener(eventName, (event) => {
                keepPanelOpen(checker, panel);
                event.stopPropagation();
                event.stopImmediatePropagation();
            }, true);
        });
        ['input', 'keydown', 'keyup', 'selectionchange'].forEach((eventName) => {
            textarea.addEventListener(eventName, () => keepPanelOpen(checker, panel), true);
        });
    }

    function installStableDrag(checker) {
        const panel = getPanel(checker);
        const header = panel?.querySelector('.panel-header-top');
        if (!panel || !header || header.__ajaStableDragReadyV5) return;
        header.__ajaStableDragReadyV5 = true;
        header.style.cursor = 'move';

        let pending = null;
        let dragging = false;

        function finishDrag(event) {
            document.removeEventListener('mousemove', moveDrag, true);
            document.removeEventListener('mouseup', finishDrag, true);
            document.removeEventListener('mouseleave', finishDrag, true);
            if (dragging) {
                event?.preventDefault();
                event?.stopPropagation();
            }
            pending = null;
            dragging = false;
            header.style.cursor = 'move';
        }

        function moveDrag(event) {
            if (!pending) return;
            const dx = event.clientX - pending.x;
            const dy = event.clientY - pending.y;
            const distance = Math.hypot(dx, dy);
            if (!dragging && distance < 8) return;
            if (!dragging) {
                dragging = true;
                panel.style.right = 'auto';
                panel.style.bottom = 'auto';
                panel.style.left = `${pending.rect.left}px`;
                panel.style.top = `${pending.rect.top}px`;
                header.style.cursor = 'grabbing';
            }
            const maxLeft = Math.max(8, window.innerWidth - panel.offsetWidth - 8);
            const maxTop = Math.max(8, window.innerHeight - panel.offsetHeight - 8);
            panel.style.left = `${clamp(pending.rect.left + dx, 8, maxLeft)}px`;
            panel.style.top = `${clamp(pending.rect.top + dy, 8, maxTop)}px`;
            keepPanelOpen(checker, panel);
            event.preventDefault();
            event.stopPropagation();
        }

        header.addEventListener('mousedown', (event) => {
            if (event.button !== 0 || isInteractiveDragTarget(event.target)) return;
            pending = { x: event.clientX, y: event.clientY, rect: panel.getBoundingClientRect() };
            dragging = false;
            keepPanelOpen(checker, panel);
            document.addEventListener('mousemove', moveDrag, true);
            document.addEventListener('mouseup', finishDrag, true);
            document.addEventListener('mouseleave', finishDrag, true);
            event.preventDefault();
            event.stopPropagation();
        }, true);

        window.addEventListener('blur', finishDrag, true);
    }

    function renderSettingsModal(panel) {
        let modal = panel.querySelector('#aja-voice-settings-modal');
        if (!modal) {
            modal = document.createElement('div');
            modal.id = 'aja-voice-settings-modal';
            panel.appendChild(modal);
        }

        const customKey = getCustomGeminiKey();
        const candidates = findStoredKeyCandidates();
        const candidateHtml = candidates.length
            ? candidates.map((item) => `<div class="settings-card"><strong>${escapeHtml(item.key)}</strong><br>${escapeHtml(maskKey(item.value))}</div>`).join('')
            : '<div class="settings-card">Nenhuma chave parecida foi encontrada no armazenamento local.</div>';

        modal.innerHTML = `
            <div style="display:flex; align-items:center; justify-content:space-between; gap:10px;">
                <div>
                    <div style="font-weight:900; font-size:16px;">Configurações do Tradutor</div>
                    <div class="aja-voice-muted" style="font-size:12px; margin-top:3px;">Fonte atual da IA: ${escapeHtml(getGeminiSourceLabel())}</div>
                </div>
                <button class="btn-fix-all" id="aja-voice-settings-close" style="width:38px; min-width:38px; height:34px; padding:0;">×</button>
            </div>
            <div>
                <label>Chave Gemini do tradutor</label>
                <input id="aja-voice-api-key" type="password" placeholder="${escapeHtml(customKey ? maskKey(customKey) : 'Cole sua chave Gemini aqui')}" autocomplete="off">
                <div class="aja-voice-muted" style="font-size:12px; margin-top:6px;">Salva em localStorage como <strong>${KEY_CUSTOM_GEMINI}</strong>. Quando preenchida, essa chave passa a ser usada pelo corretor/tradutor.</div>
            </div>
            <div class="settings-row">
                <button class="btn-fix-all" id="aja-voice-save-key">Salvar chave</button>
                <button class="btn-fix-all" id="aja-voice-test-key">Testar IA</button>
                <button class="btn-fix-all" id="aja-voice-clear-key">Limpar chave</button>
            </div>
            <div>
                <label>Chaves encontradas</label>
                <div style="display:grid; grid-template-columns:repeat(auto-fit,minmax(160px,1fr)); gap:8px; margin-top:8px;">${candidateHtml}</div>
            </div>
            <div id="aja-voice-settings-status" class="aja-voice-muted" style="font-size:12px; min-height:18px;"></div>
        `;

        modal.querySelector('#aja-voice-settings-close').onclick = (event) => {
            event.preventDefault();
            event.stopPropagation();
            modal.classList.remove('is-open');
        };

        modal.querySelector('#aja-voice-save-key').onclick = (event) => {
            event.preventDefault();
            event.stopPropagation();
            const input = modal.querySelector('#aja-voice-api-key');
            const value = input.value.trim();
            const status = modal.querySelector('#aja-voice-settings-status');
            if (!value) {
                status.textContent = 'Cole uma chave antes de salvar.';
                return;
            }
            setCustomGeminiKey(value);
            installGeminiBridge();
            status.textContent = `Chave salva: ${maskKey(value)}.`;
            input.value = '';
            renderSettingsModal(panel);
            modal.classList.add('is-open');
        };

        modal.querySelector('#aja-voice-clear-key').onclick = (event) => {
            event.preventDefault();
            event.stopPropagation();
            setCustomGeminiKey('');
            installGeminiBridge();
            renderSettingsModal(panel);
            modal.classList.add('is-open');
            const status = modal.querySelector('#aja-voice-settings-status');
            if (status) status.textContent = 'Chave do tradutor removida.';
        };

        modal.querySelector('#aja-voice-test-key').onclick = async (event) => {
            event.preventDefault();
            event.stopPropagation();
            const status = modal.querySelector('#aja-voice-settings-status');
            status.textContent = 'Testando IA...';
            try {
                const response = await (getCustomGeminiKey() ? window.ajaVoiceAskGemini('Responda somente com: OK') : (window.askGemini ? window.askGemini('Responda somente com: OK') : Promise.reject(new Error('Sem IA ativa'))));
                status.textContent = `IA respondeu: ${String(response || '').slice(0, 80)}`;
            } catch (error) {
                status.textContent = `Falha no teste: ${error.message || error}`;
            }
        };
    }

    function ensureHeaderButtons(checker) {
        const panel = getPanel(checker);
        if (!panel) return;
        const actions = panel.querySelector('.panel-header-top > div:last-child');
        if (!actions) return;

        if (!panel.querySelector('#btn-voice-theme')) {
            const button = document.createElement('button');
            button.className = 'btn-fix-all';
            button.id = 'btn-voice-theme';
            button.title = 'Alternar tema';
            button.onclick = (event) => {
                event.preventDefault();
                event.stopPropagation();
                const next = getSavedTheme() === 'dark' ? 'light' : 'dark';
                setSavedTheme(next);
                applyTheme(panel);
            };
            actions.insertBefore(button, actions.firstChild);
        }

        if (!panel.querySelector('#btn-voice-settings')) {
            const button = document.createElement('button');
            button.className = 'btn-fix-all';
            button.id = 'btn-voice-settings';
            button.textContent = '⚙';
            button.title = 'Configurações do tradutor e IA';
            button.onclick = (event) => {
                event.preventDefault();
                event.stopPropagation();
                renderSettingsModal(panel);
                panel.querySelector('#aja-voice-settings-modal')?.classList.add('is-open');
                keepPanelOpen(checker, panel);
            };
            const closeButton = panel.querySelector('#btn-spell-close');
            actions.insertBefore(button, closeButton || actions.firstChild);
        }

        applyTheme(panel);
    }

    function protectPanelFocus(checker) {
        const panel = getPanel(checker);
        if (!panel || panel.__ajaVoiceFixPanelFocusV5) return;
        panel.__ajaVoiceFixPanelFocusV5 = true;
        panel.addEventListener('focusin', (event) => {
            if (!isCloseButton(event.target)) keepPanelOpen(checker, panel);
        }, true);
        ['pointerdown', 'mousedown', 'click'].forEach((eventName) => {
            panel.addEventListener(eventName, (event) => {
                if (isCloseButton(event.target)) {
                    releasePanel(checker, panel);
                    return;
                }
                if (isVoiceTextarea(event.target)) {
                    keepPanelOpen(checker, panel);
                    event.stopPropagation();
                    event.stopImmediatePropagation();
                }
            }, true);
        });
    }

    function protectDocumentEvents() {
        if (document.__ajaVoiceFixDocumentProtegidoV5) return;
        document.__ajaVoiceFixDocumentProtegidoV5 = true;
        ['pointerdown', 'mousedown', 'click', 'focusin'].forEach((eventName) => {
            document.addEventListener(eventName, (event) => {
                const checker = getChecker();
                const panel = getPanel(checker);
                if (!isInsidePanel(event.target, panel) || isCloseButton(event.target)) return;
                keepPanelOpen(checker, panel);
                if (isVoiceTextarea(event.target)) {
                    event.stopPropagation();
                    event.stopImmediatePropagation();
                }
            }, true);
        });
    }

    function enhanceVoiceTab() {
        installGeminiBridge();
        ensureStyle();
        const checker = getChecker();
        const panel = getPanel(checker);
        if (!panel) return;

        panel.style.position = panel.style.position || 'fixed';
        protectOcultarTudo(checker);
        protectPanelFocus(checker);
        protectVoiceTextarea(checker);
        installStableDrag(checker);
        ensureHeaderButtons(checker);
        renderSettingsModal(panel);
        forceDisplay(checker, panel);

        const status = panel.querySelector('#voice-status');
        if (status && !status.__ajaVoiceFixIaHintV5) {
            status.__ajaVoiceFixIaHintV5 = true;
            const baseText = status.textContent.trim();
            if (!/chave de IA/i.test(baseText)) {
                status.textContent = `${baseText} IA: ${getGeminiSourceLabel()}.`;
            }
        }
    }

    installGeminiBridge();
    ensureStyle();
    protectDocumentEvents();
    setInterval(enhanceVoiceTab, 200);
})();