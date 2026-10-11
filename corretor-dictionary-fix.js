(function instalarGerenciadorDicionarioCorretor() {
    'use strict';

    const FLAG = '__AJA_CORRETOR_DICTIONARY_FIX_VERSION__';
    const VERSION = 'dictionary-manager-2026-10-11-1';
    const STYLE_ID = 'aja-corretor-dictionary-style';
    const STORAGE_KEY = 'pcs_spell_dict';

    if (window[FLAG] === VERSION) return;
    window[FLAG] = VERSION;

    function escapeHtml(value) {
        return String(value ?? '').replace(/[&<>"']/g, (char) => ({
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            '"': '&quot;',
            "'": '&#39;'
        }[char]));
    }

    function getChecker() {
        return window.spellCheckerModule || null;
    }

    function getPanel() {
        const checker = getChecker();
        return checker?.panel || document.getElementById('spell-main-panel');
    }

    function ensureStyle() {
        let style = document.getElementById(STYLE_ID);
        if (!style) {
            style = document.createElement('style');
            style.id = STYLE_ID;
            (document.head || document.documentElement).appendChild(style);
        }

        style.textContent = `
            #spell-main-panel .aja-dict-wrap {
                padding: 18px;
                display: flex;
                flex-direction: column;
                gap: 14px;
                min-height: 360px;
                box-sizing: border-box;
            }
            #spell-main-panel .aja-dict-card {
                border-radius: 14px;
                border: 1px solid rgba(0, 87, 184, .32);
                background: rgba(0, 87, 184, .10);
                padding: 14px;
            }
            #spell-main-panel.aja-voice-dark .aja-dict-card {
                background: rgba(23, 59, 99, .88);
                border-color: #2b5f93;
                color: #fff;
            }
            #spell-main-panel .aja-dict-title {
                font-size: 15px;
                font-weight: 900;
                margin-bottom: 5px;
            }
            #spell-main-panel .aja-dict-muted {
                font-size: 12px;
                line-height: 1.45;
                color: #64748b;
            }
            #spell-main-panel.aja-voice-dark .aja-dict-muted {
                color: #d6e4f2;
            }
            #spell-main-panel .aja-dict-row {
                display: grid;
                grid-template-columns: minmax(0, 1fr) 148px;
                gap: 10px;
                align-items: stretch;
                margin-top: 12px;
            }
            #spell-main-panel #aja-dict-input {
                min-height: 42px;
                border-radius: 11px;
                border: 1px solid #cbd5e1;
                padding: 10px 12px;
                outline: none;
                font-size: 13px;
                box-sizing: border-box;
                width: 100%;
            }
            #spell-main-panel.aja-voice-dark #aja-dict-input {
                background: #102a47 !important;
                color: #fff !important;
                border-color: #2b5f93 !important;
            }
            #spell-main-panel .aja-dict-add {
                border: 1px solid rgba(255, 130, 0, .8);
                border-radius: 11px;
                background: linear-gradient(135deg, #0057b8, #ff8200);
                color: #fff;
                font-weight: 900;
                cursor: pointer;
                min-height: 42px;
            }
            #spell-main-panel .aja-dict-list {
                display: grid;
                grid-template-columns: repeat(auto-fit, minmax(170px, 1fr));
                gap: 9px;
                max-height: 250px;
                overflow: auto;
                padding-right: 4px;
            }
            #spell-main-panel .aja-dict-item {
                display: flex;
                align-items: center;
                justify-content: space-between;
                gap: 8px;
                padding: 9px 10px;
                border-radius: 11px;
                background: #fff;
                color: #0f2742;
                border: 1px solid #d6e4f2;
                font-size: 13px;
                font-weight: 700;
                min-width: 0;
            }
            #spell-main-panel.aja-voice-dark .aja-dict-item {
                background: #102a47;
                color: #fff;
                border-color: #2b5f93;
            }
            #spell-main-panel .aja-dict-word {
                overflow: hidden;
                text-overflow: ellipsis;
                white-space: nowrap;
            }
            #spell-main-panel .aja-dict-remove {
                border: 0;
                background: transparent;
                color: #ef4444;
                cursor: pointer;
                font-size: 18px;
                font-weight: 900;
                line-height: 1;
                padding: 2px 4px;
            }
            #spell-main-panel .aja-dict-empty {
                border: 1px dashed rgba(0, 87, 184, .42);
                border-radius: 12px;
                padding: 26px;
                text-align: center;
                color: #64748b;
                font-size: 13px;
            }
            #spell-main-panel.aja-voice-dark .aja-dict-empty {
                color: #d6e4f2;
                border-color: #2b5f93;
            }
            @media (max-width: 620px) {
                #spell-main-panel .aja-dict-row { grid-template-columns: 1fr; }
                #spell-main-panel .aja-dict-wrap { padding: 14px; }
            }
        `;
    }

    function ensureDictionary(checker) {
        if (!checker) return [];
        if (!Array.isArray(checker.dicionarioPessoal)) {
            try {
                checker.dicionarioPessoal = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
            } catch (error) {
                checker.dicionarioPessoal = [];
            }
        }
        return checker.dicionarioPessoal;
    }

    function saveDictionary(checker) {
        const dictionary = ensureDictionary(checker);
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(dictionary));
        } catch (error) {
            console.warn('[Aja Corretor] Nao consegui salvar o dicionario:', error);
        }
    }

    function normalizeEntries(value) {
        return String(value || '')
            .split(/[\n,;]+/)
            .map((word) => word.trim().replace(/\s+/g, ' '))
            .filter(Boolean);
    }

    function updateDictionaryCount(checker) {
        const tab = getPanel()?.querySelector('#tab-dict');
        if (tab) tab.textContent = `Dicionário (${ensureDictionary(checker).length})`;
    }

    function rerunChecker(checker) {
        try {
            if (typeof checker?.verificarTextoNaAPI === 'function') checker.verificarTextoNaAPI();
        } catch (error) {
            console.warn('[Aja Corretor] Nao consegui revalidar o texto:', error);
        }
    }

    function renderDictionaryManager() {
        ensureStyle();
        const checker = getChecker();
        const panel = getPanel();
        const area = panel?.querySelector('#panel-content-area');
        if (!checker || !panel || !area) return;

        const dictionary = ensureDictionary(checker);
        updateDictionaryCount(checker);

        const listHtml = dictionary.length
            ? `<div class="aja-dict-list">${dictionary.map((word) => `
                <div class="aja-dict-item" title="${escapeHtml(word)}">
                    <span class="aja-dict-word">${escapeHtml(word)}</span>
                    <button class="aja-dict-remove" data-word="${escapeHtml(word)}" title="Remover palavra">×</button>
                </div>
            `).join('')}</div>`
            : '<div class="aja-dict-empty">Seu dicionário está vazio. Adicione palavras que o corretor deve aceitar como corretas.</div>';

        area.innerHTML = `
            <div class="aja-dict-wrap">
                <div class="aja-dict-card">
                    <div class="aja-dict-title">Adicionar ao dicionário</div>
                    <div class="aja-dict-muted">Use para nomes, siglas, produtos ou palavras que o corretor costuma trocar errado. Pode adicionar várias separando por vírgula ou linha.</div>
                    <div class="aja-dict-row">
                        <input id="aja-dict-input" type="text" placeholder="Ex: Brisanet, Ktech, IXC">
                        <button class="aja-dict-add" id="aja-dict-add">Adicionar</button>
                    </div>
                    <div class="aja-dict-muted" id="aja-dict-status" style="min-height:18px; margin-top:8px;"></div>
                </div>
                ${listHtml}
            </div>
        `;

        const input = area.querySelector('#aja-dict-input');
        const status = area.querySelector('#aja-dict-status');
        const addButton = area.querySelector('#aja-dict-add');

        function addWords() {
            const words = normalizeEntries(input.value);
            if (!words.length) {
                status.textContent = 'Digite uma palavra antes de adicionar.';
                return;
            }

            const existing = new Set(dictionary.map((word) => word.toLocaleLowerCase('pt-BR')));
            const added = [];
            words.forEach((word) => {
                const key = word.toLocaleLowerCase('pt-BR');
                if (existing.has(key)) return;
                dictionary.push(word);
                existing.add(key);
                added.push(word);
            });

            saveDictionary(checker);
            rerunChecker(checker);
            renderDictionaryManager();

            const nextStatus = getPanel()?.querySelector('#aja-dict-status');
            if (nextStatus) {
                nextStatus.textContent = added.length
                    ? `Adicionado: ${added.join(', ')}.`
                    : 'Essa palavra já estava no dicionário.';
            }
        }

        addButton.onclick = addWords;
        input.addEventListener('keydown', (event) => {
            if (event.key === 'Enter') {
                event.preventDefault();
                addWords();
            }
        });

        area.querySelectorAll('.aja-dict-remove').forEach((button) => {
            button.onclick = () => {
                const word = button.dataset.word;
                checker.dicionarioPessoal = ensureDictionary(checker).filter((saved) => saved !== word);
                saveDictionary(checker);
                rerunChecker(checker);
                renderDictionaryManager();
            };
        });

        setTimeout(() => input.focus(), 50);
    }

    function activateDictionaryTab(event) {
        if (event) {
            event.preventDefault();
            event.stopPropagation();
            event.stopImmediatePropagation();
        }
        const panel = getPanel();
        if (!panel) return;
        panel.querySelectorAll('.tab-btn-p').forEach((button) => {
            button.classList.toggle('active', button.id === 'tab-dict');
        });
        renderDictionaryManager();
    }

    function enhancePanel() {
        ensureStyle();
        const checker = getChecker();
        const panel = getPanel();
        const tab = panel?.querySelector('#tab-dict');
        if (!checker || !panel || !tab) return;

        ensureDictionary(checker);
        updateDictionaryCount(checker);

        if (tab.dataset.ajaDictFix !== VERSION) {
            tab.dataset.ajaDictFix = VERSION;
            tab.addEventListener('click', activateDictionaryTab, true);
        }

        if (tab.classList.contains('active')) {
            const area = panel.querySelector('#panel-content-area');
            if (area && !area.querySelector('.aja-dict-wrap')) renderDictionaryManager();
        }
    }

    window.ajaRenderDictionaryManager = renderDictionaryManager;
    setInterval(enhancePanel, 200);
    enhancePanel();
})();