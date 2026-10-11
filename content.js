
// ==UserScript==
// @name         Gerenciador de Contagem e Produtividade (v1.0.28_MASTER)
// @namespace    http://tampermonkey.net/
// @version      1.0.28.9
// @description  Script focado em Analytics. [Modo Foco + Anti-Caps Lock + Lembretes + Links]
// @author       Kingoffjoss Assess
// @match        https://apps.mypurecloud.com/*
// @match        https://apps.mypurecloud.de/*
// @match        https://apps.mypurecloud.jp/*
// @match        https://apps.mypurecloud.ie/*
// @match        https://apps.mypurecloud.com.au/*
// @grant        GM_xmlhttpRequest
// @connect      api.languagetool.org
// ==/UserScript==

(function () {
    'use strict';

    // --- URL DO CEREBRO (GOOGLE SCRIPT) ---
    const GOOGLE_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbxNMuoEKpFmzYbdJvC5gSOeCMQVvZ5iGgLJ1dca2Mh4SAjYsItSLRdmC57RzJDR_NPf0w/exec";
    const SCRIPT_VERSION = '1.0.28_MASTER';

    async function safeFetch(url, options = {}) {
        if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.sendMessage) {
            return new Promise((resolve, reject) => {
                chrome.runtime.sendMessage({ action: "fetchAPI", url: url, options: options }, response => {
                    if (chrome.runtime.lastError) {
                        reject(new Error(chrome.runtime.lastError.message));
                    } else if (!response || !response.success) {
                        reject(new Error(response ? response.error : "Unknown error"));
                    } else {
                        resolve({
                            status: response.status,
                            ok: response.status >= 200 && response.status < 300,
                            text: async () => response.text,
                            json: async () => JSON.parse(response.text)
                        });
                    }
                });
            });
        } else {
            return fetch(url, options);
        }
    }

    if (window[`PURECLOUD_SCRIPT_LOADED_FLAG_${SCRIPT_VERSION}`]) {
        console.log(`[NOVO SCRIPT] Script V${SCRIPT_VERSION} já está carregado e em execução.`);
        return;
    }

    if (typeof chrome !== 'undefined' && chrome.storage) {
        chrome.storage.local.get(['aja_extension_enabled'], function(result) {
            if (result.aja_extension_enabled === false) {
                console.log("[AJA ASSISTANT] Script desativado pelo usuário na extensão.");
                return;
            }
            startScript();
        });
    } else {
        startScript();
    }

    function startScript() {
        window[`PURECLOUD_SCRIPT_LOADED_FLAG_${SCRIPT_VERSION}`] = true;

    // [HOTFIX] Remover chaves antigas que causavam colisão violenta com o Genesys Cloud nativo
    try {
        localStorage.removeItem('darkMode');
        localStorage.removeItem('themeColors_v2');
        localStorage.removeItem('conversationTarget');
    } catch (e) { }


    const DEBUG_MODE = true;
    const log = (...args) => { if (DEBUG_MODE) console.log("[PURECLOUD SCRIPT]", ...args); };

    // --- SISTEMA DE SOM E CONFETES (GAMIFICAÇÃO) ---
    const effectsManager = {
        audioContext: null,
        init() {
            if (!this.audioContext && (window.AudioContext || window.webkitAudioContext)) {
                try { this.audioContext = new (window.AudioContext || window.webkitAudioContext)(); log("AudioContext inicializado."); } catch (e) { log("Erro ao inicializar AudioContext:", e); }
            }
        },
        playBeep(type = 'inactive') {
            if (!this.audioContext || !CONFIG.SOUND_ALERTS_ENABLED) return;
            try {
                const oscillator = this.audioContext.createOscillator(); const gainNode = this.audioContext.createGain();
                let frequency = 440, duration = 0.1;
                if (type === 'inactive_client') { frequency = 880; duration = 0.15; } else if (type === 'inactive_operator') { frequency = 660; duration = 0.1; }
                else if (type === 'reminder') { frequency = 1046.50; duration = 0.3; } // Som específico para o lembrete
                oscillator.type = 'sine'; oscillator.frequency.setValueAtTime(frequency, this.audioContext.currentTime);
                gainNode.gain.setValueAtTime(0.3, this.audioContext.currentTime); gainNode.gain.exponentialRampToValueAtTime(0.001, this.audioContext.currentTime + duration);
                oscillator.connect(gainNode); gainNode.connect(this.audioContext.destination);
                oscillator.start(this.audioContext.currentTime); oscillator.stop(this.audioContext.currentTime + duration);
            } catch (e) { }
        },
        playSuccess() {
            if (!this.audioContext || !CONFIG.SOUND_ALERTS_ENABLED) return;
            try {
                [440, 554, 659, 880].forEach((freq, i) => {
                    setTimeout(() => {
                        const osc = this.audioContext.createOscillator(); const gain = this.audioContext.createGain();
                        osc.type = 'sine'; osc.frequency.value = freq;
                        gain.gain.setValueAtTime(0.1, this.audioContext.currentTime); gain.gain.exponentialRampToValueAtTime(0.001, this.audioContext.currentTime + 0.5);
                        osc.connect(gain); gain.connect(this.audioContext.destination);
                        osc.start(); osc.stop(this.audioContext.currentTime + 0.5);
                    }, i * 100);
                });
            } catch (e) { }
        },
        triggerConfetti() {
            const colors = ['#10b981', '#3b82f6', '#fbbf24', '#ef4444', '#6366f1', '#ec4899'];
            for (let i = 0; i < 120; i++) {
                const confetti = document.createElement('div');
                confetti.style.position = 'fixed'; confetti.style.width = '10px'; confetti.style.height = '12px';
                confetti.style.backgroundColor = colors[Math.floor(Math.random() * colors.length)];
                confetti.style.left = Math.random() * 100 + 'vw'; confetti.style.top = '-20px';
                confetti.style.zIndex = '999999'; confetti.style.pointerEvents = 'none';
                confetti.style.borderRadius = Math.random() > 0.5 ? '50%' : '2px';
                document.body.appendChild(confetti);
                const duration = Math.random() * 3 + 2;
                confetti.animate([
                    { transform: `translate3d(0, 0, 0) rotate(0deg)`, opacity: 1 },
                    { transform: `translate3d(${Math.random() * 300 - 150}px, 100vh, 0) rotate(${Math.random() * 1080}deg)`, opacity: 0 }
                ], { duration: duration * 1000, easing: 'cubic-bezier(.37,0,.63,1)' });
                setTimeout(() => confetti.remove(), duration * 1000);
            }
        }
    };

    const LOCKDOWN_CONFIG = { REQUIRED_CLICKS: 5, END_CHAT_BUTTON_SELECTOR: ['#call-control-end-sms-button', 'button[aria-label="Mensagens de término"]'], TEST_END_BUTTON_SELECTOR: '#call-control-end-sms-button', BALAO_BUTTON_SELECTOR_V4: 'button[aria-label="Mensagens de término"]' };

    // --- VARIÁVEIS E LINKS ÚTEIS ---
    const initialQuickReplies = [
        { title: "👋 Saudação", text: "Olá, {primeiro_nome}! Tudo bem? Sou o agente e vou te ajudar hoje.", shortcut: "/oi" },
        { title: "📝 Pedir Dados", text: "{primeiro_nome}, para prosseguirmos, poderia me confirmar seu CPF ou número do pedido, por favor?", shortcut: "/cpf" },
        { title: "⏳ Aguardar", text: "Por favor, aguarde só um momento enquanto eu verifico essa informação, {primeiro_nome}.", shortcut: "/espera" },
        { title: "🔄 Transferir", text: "Vou precisar transferir o seu atendimento para o setor responsável. Por favor, aguarde um instante.", shortcut: "/transf" },
        { title: "⚠️ Cliente Inativo", text: "{primeiro_nome}, ainda está por aí? Como não tivemos mais retorno, encerrarei o atendimento em alguns minutos caso não haja resposta.", shortcut: "/inativo" },
        { title: "❌ Encerramento", text: "Como não tivemos mais retorno, estou encerrando este atendimento. Qualquer dúvida, estamos à disposição!", shortcut: "/enc" },
        { title: "✅ Resolução", text: "{primeiro_nome}, ficou mais alguma dúvida referente a este assunto ou posso te ajudar com algo mais?", shortcut: "/duvida" },
        { title: "👋 Despedida", text: "Foi um prazer te atender, {primeiro_nome}! Tenha um excelente dia!", shortcut: "/tchau" }
    ];

    const USEFUL_LINKS = [
        { title: "🌐 CRM Corporativo", url: "https://google.com", color: "#3b82f6" },
        { title: "📚 Base de Conhecimento", url: "https://wikipedia.org", color: "#10b981" },
        { title: "💳 Sistema de Faturamento", url: "https://yahoo.com", color: "#f59e0b" },
        { title: "📦 Rastreio de Pedidos", url: "https://bing.com", color: "#6366f1" }
    ];

    const defaultThemeColors = { bgPrimary: '#f8fafc', bgSecondary: '#f1f5f9', textPrimary: '#0f172a', textSecondary: '#475569', borderColor: '#e2e8f0', accent: '#6366f1', accentText: '#ffffff', timerBg: '#2d3748', timerNormalText: '#ffffff', timerActiveText: '#4ade80', timerPausedText: '#f87171', timerInactiveClientText: '#fbbf24', timerInactiveOperatorText: '#fbbf24', timerCompletedBg: '#2d3748', timerCompletedText: '#ffffff', success: '#10b981', error: '#ef4444', warn: '#f59e0b', info: '#3b82f6', miniDashboardProgress: '#0ea5e9' };


    function applyGenesysDarkMode() {
        let s = document.getElementById('genesys-forced-dark-style');
        if (typeof CONFIG === 'undefined' || !CONFIG.GENESYS_DARK_MODE) {
            if (s) s.remove();
            document.body.classList.remove('genesys-forced-dark');
            return;
        }
        const styleStr = `
        body.genesys-forced-dark { background-color: #121212 !important; color: #e2e8f0 !important; }
        body.genesys-forced-dark .app-body, body.genesys-forced-dark .sidebar, body.genesys-forced-dark .interaction-content-wrapper, body.genesys-forced-dark .navbar, body.genesys-forced-dark .topbar, body.genesys-forced-dark #main-content { background-color: #121212 !important; color: #e2e8f0 !important; border-color: #334155 !important; }
        body.genesys-forced-dark .interaction-list { background-color: #1a1a1a !important; }
        body.genesys-forced-dark div, body.genesys-forced-dark span { border-color: #334155 !important; color: inherit; }
        body.genesys-forced-dark input, body.genesys-forced-dark textarea { background-color: #1e1e1e !important; color: #e2e8f0 !important; border: 1px solid #334155 !important; }
    `;
        if (!s) { s = document.createElement('style'); s.id = 'genesys-forced-dark-style'; document.head.appendChild(s); }
        s.textContent = styleStr;
        document.body.classList.add('genesys-forced-dark');
    }
    window.applyGenesysDarkMode = applyGenesysDarkMode; // Ensure it's globally accessible just in case



    let CONFIG = {
        CHECKMARK_THRESHOLD_MS: 70 * 1000, TIMER_UPDATE_INTERVAL_MS: 500, MAIN_LOOP_THROTTLE_MS: 1000,
        INACTIVITY_CLIENT_ALERT_SECONDS: parseInt(localStorage.getItem('inactivityClientAlertSeconds') || '70', 10),
        INACTIVITY_OPERATOR_ALERT_SECONDS: parseInt(localStorage.getItem('inactivityOperatorAlertSeconds') || '30', 10),
        LONG_CONVO_ALERT_MIN: parseInt(localStorage.getItem('longConvoAlertMin') || '15', 10),
        CONVERSATION_TARGET: parseInt(localStorage.getItem('gcp_conversationTarget') || '45', 10),

        DARK_MODE: localStorage.getItem('gcp_darkMode') === 'true',
        SOUND_ALERTS_ENABLED: localStorage.getItem('soundAlertsEnabled') !== 'false',
        QUICK_REPLIES: JSON.parse(localStorage.getItem('quickReplies')) || initialQuickReplies,
        // --- NOVOS ATALHOS ADICIONADOS AQUI ---
        HOTKEYS: JSON.parse(localStorage.getItem('hotkeys')) || { copyInteraction: "Control+Shift+I", openSettings: "Control+Shift+S", toggleMiniDashboard: "Control+Shift+J", toggleLock: "Control+Shift+L", toggleDarkMode: "Control+Shift+D", quickGreeting: "Control+Shift+Q", exportData: "Control+Shift+E", toggleZenMode: "Control+Shift+Z", formatText: "Control+Shift+M" },
        THEME_COLORS: JSON.parse(localStorage.getItem('gcp_themeColors_v2')) || JSON.parse(localStorage.getItem('timerColors')) || defaultThemeColors,
        LAST_SCRIPT_VERSION: localStorage.getItem('lastScriptVersion') || '0', POPUP_POSITIONS: JSON.parse(sessionStorage.getItem('popupPositions') || '{}'),
        MINI_DASHBOARD_VISIBLE: sessionStorage.getItem('miniDashboardVisible') !== 'false', MINI_DASHBOARD_MAXIMIZED: sessionStorage.getItem('miniDashboardMaximized') === 'true', TOOLS_VISIBLE: sessionStorage.getItem('toolsVisible') === 'true',
        MESSAGES: { COPIED_SUCCESS: "Copiado com sucesso!", COPY_ERROR: "Erro ao copiar.", NOT_FOUND_INTERACTION_DATA: "Dados não encontrados.", INTERACTION_COPIED: "Interação (Nome, Telefone e Link) copiada!" },
        PURECLOUD_SELECTORS: {
            TOOLBAR: ['div.interaction-controls-primary', 'div[data-qa-id="interaction-controls-primary"]', '.actions-container', 'div[role="toolbar"]'], PARTICIPANT_NAME_BADGE: ['h3.participant-name', 'div.interaction-name-wrapper div.participant-name > span', 'p.participant-name', 'span[data-qa-id="participant-name"]', 'h2.participant-name'], NATIVE_COPY_BUTTON: ['button[aria-label="Copiar link da interação"]', '.copy-interaction-url-btn', 'button[data-qa-id="copy-interaction-link"]', '.copy-action-button'], INTERACTION_ID_EL: 'span[data-qa-id="interaction-id"], [data-qa-id="detail-value-interactionId"]', CONVERSATION_ROOT: '.interaction-content', CONVERSATION_CONTENT_WRAPPER: ['.interaction-content-wrapper', '.interaction-content'], SCRIPT_IFRAME: '.interaction-script-container.no-headers.non-call iframe', MESSAGING_GADGET_IFRAME: 'iframe[src*="messaging-gadget.html"]', INTERACTION_GROUP: ['div.interaction-group', 'div[data-qa-id="interaction-group-list-item"]'], SELECTED_INTERACTION_GROUP: ['div.interaction-group.is-selected', 'div[data-qa-id="interaction-group-list-item"].is-selected'], TRANSFER_BUTTON_SELECTOR: ['button[aria-label*="Transferir"]', 'button[data-qa-id="interaction-control-transfer"]'], EVALUATION_BUTTON_SELECTOR: ['button[aria-label*="Enviar avaliação"]', 'button[aria-label*="Enviar pesquisa"]', 'button[data-qa-id="interaction-control-disconnect"]', 'button.btn-main.container-inner'], CONVERSATION_LIST_CONTAINER: ['div.infrg-1_medium.purecloud-grid-layout-grid-cell.interaction-list-column', 'div.interaction-list', 'div[data-qa-id*="interaction-list-column"]'], NATIVE_TIMER_SELECTORS: ['.message-timestamp', '.duration', '.chat-message-group > div:last-child > span', '.chat-message-group > div:last-child > div', 'span[class*="timestamp"]', 'div[class*="time"]', 'span[class*="datetime"]', 'span[class*="date-time"]'], ICON_SELECTOR_CALL: 'gux-icon[icon-name="phone"]', ICON_SELECTOR_CHAT: 'gux-icon[icon-name="comments"]'
        },
        LAST_ENDED_INTERACTIONS: new Map()
    };

    const featureDescriptions = {
        copyInteraction: { title: "Copiar Interação", description: "Copia nome, telefone e link.", hotkey: CONFIG.HOTKEYS.copyInteraction }, openSettings: { title: "Configurações", description: "Abre o painel de configurações.", hotkey: CONFIG.HOTKEYS.openSettings }, toggleMiniDashboard: { title: "Alternar Dashboard", description: "Oculta ou mostra o dashboard.", hotkey: CONFIG.HOTKEYS.toggleMiniDashboard }, toggleLock: { title: "Trava de Encerramento", description: "Adiciona escudo contra encerramento.", hotkey: CONFIG.HOTKEYS.toggleLock }, toggleDarkMode: { title: "Modo Escuro (Script)", description: "Ativa o tema escuro nos cronômetros.", hotkey: CONFIG.HOTKEYS.toggleDarkMode }, quickGreeting: { title: "Saudação Rápida", description: "Cola sua primeira Resposta Rápida.", hotkey: CONFIG.HOTKEYS.quickGreeting }, exportData: { title: "Exportar Atendimentos", description: "Baixa os dados do dia.", hotkey: CONFIG.HOTKEYS.exportData },
        toggleZenMode: { title: "Modo Foco (Zen)", description: "Escurece a tela e foca apenas no chat atual.", hotkey: CONFIG.HOTKEYS.toggleZenMode }, formatText: { title: "Mágico Anti-Caps Lock", description: "Corrige texto MAIÚSCULO para Minúsculo.", hotkey: CONFIG.HOTKEYS.formatText }
    };

    let v4_counters = { balao: [] }; const V4_STORAGE_KEY = 'encerramentoCounters_v4_balao';
    function loadV4Counters() { const today = getBrazilTime(new Date()).toLocaleDateString('pt-BR'); const storedData = JSON.parse(localStorage.getItem(V4_STORAGE_KEY) || '{}'); if (storedData.date === today) { v4_counters.balao = storedData.balao || []; } else { v4_counters = { balao: [] }; } }
    function saveV4Counters() { const today = getBrazilTime(new Date()).toLocaleDateString('pt-BR'); const dataToSave = { date: today, balao: v4_counters.balao }; try { localStorage.setItem(V4_STORAGE_KEY, JSON.stringify(dataToSave)); } catch (e) { } }

    async function autoRestoreFromCloud() {
        const stats = analyticsManager.calculateStats();
        // Se localmente está vazio e ainda não tentamos restaurar nesta sessão
        if (stats.count === 0 && !sessionStorage.getItem('pcs_auto_restored')) {
            console.log("[PCS] Iniciando auto-restauração da nuvem...");
            try {
                const currentUserName = getAgentName();
                if (currentUserName === "Usuário Anônimo") return;

                const params = new URLSearchParams({ type: 'restore_agent', user: currentUserName });
                const response = await safeFetch(`${GOOGLE_SCRIPT_URL}?${params.toString()}`);
                if (!response.ok) return;
                const res = await response.json();

                if (res.status === 'success' && ((res.atendimentos && res.atendimentos.length > 0) || (res.encerrados && res.encerrados.length > 0))) {
                    const storedData = analyticsManager.getData();
                    storedData.conversations = [];
                    
                    if (res.atendimentos) {
                        res.atendimentos.forEach(a => {
                            const parts = a.horaFim.split(':');
                            const dt = new Date();
                            if (parts.length >= 2) dt.setHours(parseInt(parts[0]), parseInt(parts[1]), 0, 0);
                            storedData.conversations.push({
                                timestamp: dt.getTime(),
                                duration: (parseInt(a.duracaoSegundos) || 0) * 1000,
                                activeDuration: (parseInt(a.tmeSegundos) || 0) * 1000,
                                participantName: a.cliente || 'N/A',
                                phoneNumber: 'N/A',
                                isRecurrence: a.recorrencia === 'Sim',
                                endedByAgent: a.tipo || 'unknown',
                                interactionUrl: a.link || 'N/A',
                                interactionType: 'unknown'
                            });
                        });
                    }
                    
                    analyticsManager.saveData(storedData);
                    
                    if (res.encerrados && res.encerrados.length > 0) {
                        const novosEncerrados = res.encerrados.map(e => ({ timestamp: e.timestamp, participantName: e.participantName, interactionUrl: e.interactionUrl }));
                        v4_counters.balao = novosEncerrados;
                        localStorage.setItem(V4_STORAGE_KEY, JSON.stringify({ date: getBrazilTime(new Date()).toLocaleDateString('pt-BR'), balao: novosEncerrados }));
                    }
                    
                    sessionStorage.setItem('pcs_auto_restored', 'true');
                    console.log("[PCS] Dados restaurados automaticamente com sucesso!");
                    UI.createNotification("🔄 Dados sincronizados com a nuvem!", "success", 4000);
                    
                    // Atualiza o dashboard se estiver visível
                    if (document.getElementById('purecloud-script-mini-dashboard')) {
                        document.getElementById('purecloud-script-mini-dashboard')._updateStatsInternal();
                    }
                }
            } catch (e) {
                console.error("[PCS] Erro na auto-restauração:", e);
            }
        }
    }

    const validateConfigValue = (key, value) => {
        const parsed = parseInt(value, 10);
        switch (key) {
            case 'CONVERSATION_TARGET': return !isNaN(parsed) && parsed >= 1 ? parsed : 45; case 'INACTIVITY_CLIENT_ALERT_SECONDS': return !isNaN(parsed) && parsed >= 30 ? parsed : 70; case 'INACTIVITY_OPERATOR_ALERT_SECONDS': return !isNaN(parsed) && parsed >= 10 ? parsed : 30; case 'LONG_CONVO_ALERT_MIN': return !isNaN(parsed) && parsed >= 5 ? parsed : 15; case 'DARK_MODE': return value === true || value === 'true'; case 'SOUND_ALERTS_ENABLED': return value === true || value === 'true';
            case 'THEME_COLORS': if (typeof value !== 'object' || value === null) { return defaultThemeColors; } const validatedColors = { ...defaultThemeColors }; for (const colorKey in defaultThemeColors) { if (value.hasOwnProperty(colorKey)) { if (typeof value[colorKey] === 'string' && value[colorKey].match(/^#[0-9a-f]{6}$/i)) { validatedColors[colorKey] = value[colorKey]; } } } return validatedColors;
            case 'HOTKEYS': if (typeof value === 'object' && value !== null) { return { copyInteraction: value.copyInteraction || "Control+Shift+I", openSettings: value.openSettings || "Control+Shift+S", toggleMiniDashboard: value.toggleMiniDashboard || "Control+Shift+J", toggleLock: value.toggleLock || "Control+Shift+L", toggleDarkMode: value.toggleDarkMode || "Control+Shift+D", quickGreeting: value.quickGreeting || "Control+Shift+Q", exportData: value.exportData || "Control+Shift+E", toggleZenMode: value.toggleZenMode || "Control+Shift+Z", formatText: value.formatText || "Control+Shift+M" }; } return CONFIG.HOTKEYS;
            default: return value;
        }
    };
    const saveData = () => {
        try {
            const dataToSave = analyticsManager.getData();
            localStorage.setItem('gcp_conversationTarget', validateConfigValue('CONVERSATION_TARGET', CONFIG.CONVERSATION_TARGET)); localStorage.setItem('gcp_darkMode', validateConfigValue('DARK_MODE', CONFIG.DARK_MODE)); localStorage.setItem('soundAlertsEnabled', validateConfigValue('SOUND_ALERTS_ENABLED', CONFIG.SOUND_ALERTS_ENABLED)); localStorage.setItem('inactivityClientAlertSeconds', validateConfigValue('INACTIVITY_CLIENT_ALERT_SECONDS', CONFIG.INACTIVITY_CLIENT_ALERT_SECONDS)); localStorage.setItem('inactivityOperatorAlertSeconds', validateConfigValue('INACTIVITY_OPERATOR_ALERT_SECONDS', CONFIG.INACTIVITY_OPERATOR_ALERT_SECONDS)); localStorage.setItem('longConvoAlertMin', validateConfigValue('LONG_CONVO_ALERT_MIN', CONFIG.LONG_CONVO_ALERT_MIN)); localStorage.setItem('hotkeys', JSON.stringify(validateConfigValue('HOTKEYS', CONFIG.HOTKEYS))); localStorage.setItem('gcp_themeColors_v2', JSON.stringify(validateConfigValue('THEME_COLORS', CONFIG.THEME_COLORS))); localStorage.setItem('lastScriptVersion', SCRIPT_VERSION); localStorage.setItem('dailyAnalytics_v2_data', JSON.stringify(dataToSave)); sessionStorage.setItem('popupPositions', JSON.stringify(CONFIG.POPUP_POSITIONS)); sessionStorage.setItem('miniDashboardVisible', CONFIG.MINI_DASHBOARD_VISIBLE); sessionStorage.setItem('miniDashboardMaximized', CONFIG.MINI_DASHBOARD_MAXIMIZED); sessionStorage.setItem('toolsVisible', CONFIG.TOOLS_VISIBLE);
            saveV4Counters();
        } catch (e) { if (e.name === 'QuotaExceededError') { UI.createNotification("Erro: Espaço de armazenamento cheio.", 'error', 10000); } }
    };

    const findEl = (selectors, parent = document) => { if (!Array.isArray(selectors)) selectors = [selectors]; for (const selector of selectors) { let el = parent.querySelector(selector); if (el) return el; } return null; };
    const throttle = (func, limit) => { let inThrottle; return function (...args) { if (!inThrottle) { func.apply(this, args); inThrottle = true; setTimeout(() => inThrottle = false, limit); } }; };
    const formatTime = num => String(num).padStart(2, '0');
    const getBrazilTime = (date) => { try { const options = { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false, timeZone: 'America/Fortaleza' }; const formatter = new Intl.DateTimeFormat('en-US', options); const parts = formatter.formatToParts(date); const year = parseInt(parts.find(p => p.type === 'year').value); const month = parseInt(parts.find(p => p.type === 'month').value) - 1; const day = parseInt(parts.find(p => p.type === 'day').value); const hour = parseInt(parts.find(p => p.type === 'hour').value); const minute = parseInt(parts.find(p => p.type === 'minute').value); const second = parseInt(parts.find(p => p.type === 'second').value); const brazilDateString = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}T${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}:${String(second).padStart(2, '0')}`; return new Date(brazilDateString + '-03:00'); } catch (e) { return date; } };

    // --- UTILIDADES GERAIS ---
    const escapeHTML = (str) => {
        if (!str || typeof str !== 'string') return str;
        return str.replace(/[&<>'"]/g,
            tag => ({
                '&': '&amp;',
                '<': '&lt;',
                '>': '&gt;',
                "'": '&#39;',
                '"': '&quot;'
            }[tag] || tag)
        );
    };

    const buildSpellOverlayHTML = (textoOriginal, errosEncontrados) => {
        const texto = String(textoOriginal || '');
        const errosOrdenados = [...(errosEncontrados || [])]
            .sort((a, b) => (b.offset || 0) - (a.offset || 0));

        if (errosOrdenados.length === 0) return escapeHTML(texto);

        let htmlMarcado = '';
        let cursor = texto.length;

        errosOrdenados.forEach(err => {
            let offsetVis = Number(err.offset) || 0;
            let lengthVis = Number(err.length) || 0;
            let classeCSS = 'spell-wavy-error';

            if (lengthVis === 0 && offsetVis > 0) {
                offsetVis -= 1;
                lengthVis = 1;
                classeCSS = 'spell-wavy-punct';
            }

            const start = Math.max(0, Math.min(offsetVis, cursor));
            const end = Math.max(start, Math.min(start + lengthVis, cursor));
            htmlMarcado = escapeHTML(texto.substring(end, cursor)) + htmlMarcado;
            htmlMarcado = `<mark class="${classeCSS}">${escapeHTML(texto.substring(start, end))}</mark>` + htmlMarcado;
            cursor = start;
        });

        return escapeHTML(texto.substring(0, cursor)) + htmlMarcado;
    };

    function getAgentName() {
        const selectors = [
            'div.user-info .name', 
            '[data-qa-id="user-profile-name"]',
            'span.user-name',
            'div.name span.entry-value'
        ];
        for (let sel of selectors) {
            let el = document.querySelector(sel);
            if (el && el.innerText.trim()) {
                const name = el.innerText.trim();
                localStorage.setItem('purecloudScript_lastAgentName', name);
                return name;
            }
        }
        return localStorage.getItem('purecloudScript_lastAgentName') || "Usuário Anônimo";
    }

    // --- PROCESSADOR DE VARIÁVEIS (MÁGICAS) ---
    const templateProcessor = {
        process: (text) => {
            if (!text.includes('{')) return text;
            const selectedConvEl = findEl(CONFIG.PURECLOUD_SELECTORS.SELECTED_INTERACTION_GROUP);
            let { participantName } = documentExtractor.getNameAndNumber(selectedConvEl);
            if (!participantName || participantName === 'N/A') participantName = 'Cliente';
            let primeiroNome = participantName.split(' ')[0];

            const horaAtual = getBrazilTime(new Date()).getHours();
            let saudacao = "Bom dia";
            if (horaAtual >= 12 && horaAtual < 18) saudacao = "Boa tarde";
            else if (horaAtual >= 18 || horaAtual < 5) saudacao = "Boa noite";

            // Aplica escapeHTML para segurança caso os nomes sejam usados em HTML posteriormente. 
            // Para o chat de texto puro, escapeHTML pode injetar entities ampersand, 
            // então o processador de chat apenas troca.
            return text.replace(/{nome}/gi, participantName)
                .replace(/{primeiro_nome}/gi, primeiroNome)
                .replace(/{saudacao}/gi, saudacao);
        }
    };

    const makeDraggable = (popup, header, popupName) => {
        if (!header) header = popup;
        let isDragging = false, dragOffsetX = 0, dragOffsetY = 0;

        let enforceBounds = (top, left) => {
            const vpW = window.innerWidth, vpH = window.innerHeight;
            const pW = popup.offsetWidth || 300, pH = popup.offsetHeight || 300;
            let safeT = Math.max(5, Math.min(vpH - pH - 5, top));
            let safeL = Math.max(5, Math.min(vpW - pW - 5, left));
            if (pW > vpW) safeL = 0; if (pH > vpH) safeT = 0;
            return { top: safeT, left: safeL };
        };

        try {
            if (typeof CONFIG === 'undefined') window.CONFIG = { POPUP_POSITIONS: {} };
            if (!CONFIG.POPUP_POSITIONS) CONFIG.POPUP_POSITIONS = {};
            let saved = sessionStorage.getItem('qr_popupPositions') || sessionStorage.getItem('popupPositions') || '{}';
            CONFIG.POPUP_POSITIONS = JSON.parse(saved);
        } catch (e) { }

        popup.style.position = 'fixed';
        popup.style.margin = '0';
        popup.style.transform = 'none';

        // Initial Positioning logic
        if (popupName === 'quickReplyPopup') {
            const dW = '650px', dH = '75vh';
            popup.style.width = dW; popup.style.height = dH;
            setTimeout(() => {
                const safe = enforceBounds(Math.max(5, (window.innerHeight - popup.offsetHeight) / 2), Math.max(5, (window.innerWidth - popup.offsetWidth) / 2));
                popup.style.top = safe.top + 'px'; popup.style.left = safe.left + 'px';
            }, 50);
        } else if (CONFIG && CONFIG.POPUP_POSITIONS && CONFIG.POPUP_POSITIONS[popupName]?.top && CONFIG.POPUP_POSITIONS[popupName]?.left) {
            const safe = enforceBounds(parseFloat(CONFIG.POPUP_POSITIONS[popupName].top), parseFloat(CONFIG.POPUP_POSITIONS[popupName].left));
            popup.style.top = safe.top + 'px'; popup.style.left = safe.left + 'px';
            if (CONFIG.POPUP_POSITIONS[popupName].width) popup.style.width = CONFIG.POPUP_POSITIONS[popupName].width;
            if (CONFIG.POPUP_POSITIONS[popupName].height) popup.style.height = CONFIG.POPUP_POSITIONS[popupName].height;
        } else {
            popup.style.top = '10%'; popup.style.left = '10%';
        }

        const savePos = () => {
            if (popupName === 'quickReplyPopup' && !isDragging) return;
            const rect = popup.getBoundingClientRect();
            const safe = enforceBounds(rect.top, rect.left);
            if (typeof CONFIG !== 'undefined' && CONFIG.POPUP_POSITIONS) {
                CONFIG.POPUP_POSITIONS[popupName] = { top: safe.top + 'px', left: safe.left + 'px', width: popup.style.width, height: popup.style.height };
                try {
                    sessionStorage.setItem('qr_popupPositions', JSON.stringify(CONFIG.POPUP_POSITIONS));
                    sessionStorage.setItem('popupPositions', JSON.stringify(CONFIG.POPUP_POSITIONS));
                } catch (e) { }
            }
        };

        header.addEventListener('mousedown', (e) => {
            if (e.target.closest('button') || e.target.closest('.compact-btn') || e.target.closest('input') || e.target.classList.contains('os-btn') || e.button !== 0) return;
            e.preventDefault();
            isDragging = true;
            popup.style.transition = 'none';

            const rect = popup.getBoundingClientRect();
            popup.style.left = rect.left + 'px';
            popup.style.top = rect.top + 'px';
            popup.style.bottom = 'auto';
            popup.style.right = 'auto';

            dragOffsetX = e.clientX - rect.left;
            dragOffsetY = e.clientY - rect.top;
        }, { passive: false });

        document.addEventListener('mousemove', (e) => {
            if (!isDragging) return;
            e.preventDefault();
            const safe = enforceBounds(e.clientY - dragOffsetY, e.clientX - dragOffsetX);
            popup.style.top = safe.top + 'px';
            popup.style.left = safe.left + 'px';
        }, { passive: false });

        document.addEventListener('mouseup', () => {
            if (isDragging) {
                isDragging = false;
                savePos();
            }
        });

        try {
            const observer = new ResizeObserver(() => { if (!isDragging) savePos(); });
            observer.observe(popup);
        } catch (e) { }
    };

    const DataSyncer = {
        QUEUE_KEY: 'genesys_offline_queue_v1',
        async send(payload) { if (navigator.onLine) { try { await this._post(payload); } catch (e) { this._addToQueue(payload); } } else { this._addToQueue(payload); } this.updateIndicator(); },
        async _post(payload) { 
            return await safeFetch(GOOGLE_SCRIPT_URL, { 
                method: 'POST', 
                headers: { 'Content-Type': 'application/json' }, 
                body: JSON.stringify(payload) 
            }); 
        },
        _addToQueue(payload) { let queue = JSON.parse(localStorage.getItem(this.QUEUE_KEY) || "[]"); payload._queuedAt = Date.now(); queue.push(payload); localStorage.setItem(this.QUEUE_KEY, JSON.stringify(queue)); },
        async processQueue() { if (!navigator.onLine) return; let queue = JSON.parse(localStorage.getItem(this.QUEUE_KEY) || "[]"); if (queue.length === 0) return; let failedQueue = []; for (let item of queue) { try { await this._post(item); await new Promise(r => setTimeout(r, 500)); } catch (e) { failedQueue.push(item); } } localStorage.setItem(this.QUEUE_KEY, JSON.stringify(failedQueue)); if (failedQueue.length === 0 && typeof UI !== 'undefined') { UI.createNotification("Sincronização offline concluída!", "success"); } this.updateIndicator(); },
        updateIndicator() { let queue = JSON.parse(localStorage.getItem(this.QUEUE_KEY) || "[]"); let indicator = document.getElementById('offline-indicator'); if (queue.length > 0) { if (!indicator) { indicator = document.createElement('div'); indicator.id = 'offline-indicator'; indicator.style.cssText = "position:fixed; bottom:80px; right:20px; background:var(--purecloud-script-warn-color); color:#000; padding:8px 14px; border-radius:20px; font-size:12px; z-index:9999; box-shadow:0 4px 10px rgba(0,0,0,0.3); font-weight:bold; cursor:pointer;"; indicator.title = "Clique para tentar forçar o envio"; indicator.onclick = () => DataSyncer.processQueue(); document.body.appendChild(indicator); } indicator.innerText = `📡 ${queue.length} Pendentes`; indicator.style.display = 'block'; } else if (indicator) { indicator.style.display = 'none'; } }
    };

    const analyticsManager = {
        getData() { const today = getBrazilTime(new Date()).toLocaleDateString('pt-BR'); const storedData = JSON.parse(localStorage.getItem('dailyAnalytics_v2_data') || '{}'); if (storedData.date !== today) { return { date: today, conversations: [], docCopies: 0, hotkeysUsed: [], baloonClicks: 0, transferClicks: 0, evaluatedClicks: 0, diagnosticRepliesUsed: 0 }; } storedData.conversations = (storedData.conversations || []).map(conv => ({ ...conv, activeDuration: conv.activeDuration || 0, isRecurrence: conv.isRecurrence || false, participantName: conv.participantName || 'N/A', phoneNumber: conv.phoneNumber || 'N/A', endedByAgent: conv.endedByAgent || 'HIBERNADO', interactionUrl: conv.interactionUrl || 'N/A', timestamp: typeof conv.timestamp === 'string' ? (new Date(conv.timestamp).getTime() || Date.now()) : conv.timestamp, interactionType: conv.interactionType || 'unknown' })); return storedData; },
        saveData(data) { try { localStorage.setItem('dailyAnalytics_v2_data', JSON.stringify(data)); } catch (e) { log("Erro ao salvar dados:", e); } },
        getAchievements() { return JSON.parse(localStorage.getItem('achievements_v2') || '{}'); },
        logConversation(duration, activeDuration, participantName, phoneNumber, interactionUrl, classification, interactionType) {
            const previousStats = this.calculateStats();
            const data = this.getData();
            const isRecurrence = phoneNumber !== 'N/A' && data.conversations.some(conv => conv.phoneNumber === phoneNumber && conv.duration >= CONFIG.CHECKMARK_THRESHOLD_MS);
            data.conversations.push({ timestamp: Date.now(), duration: duration, activeDuration: activeDuration, participantName: participantName, phoneNumber: phoneNumber, isRecurrence: isRecurrence, endedByAgent: classification, interactionUrl: interactionUrl, interactionType: interactionType });
            this.saveData(data); this._updateDashboard();

            // --- CELEBRAÇÃO DE META VIRTUAL ---
            const newStats = this.calculateStats();
            if (previousStats.count < CONFIG.CONVERSATION_TARGET && newStats.count >= CONFIG.CONVERSATION_TARGET) {
                effectsManager.triggerConfetti();
                effectsManager.playSuccess();
                UI.createNotification("🎉 Parabéns! Você atingiu sua meta diária de atendimentos!", "success", 8000);
            }
        },
        logBaloonClick() { const data = this.getData(); data.baloonClicks = (data.baloonClicks || 0) + 1; this.saveData(data); this._updateDashboard(); },
        logTransferClick() { const data = this.getData(); data.transferClicks = (data.transferClicks || 0) + 1; this.saveData(data); this._updateDashboard(); },
        logEvaluatedClick() { const data = this.getData(); data.evaluatedClicks = (data.evaluatedClicks || 0) + 1; this.saveData(data); this._updateDashboard(); },
        _updateDashboard() { if (document.getElementById('purecloud-script-mini-dashboard')) { document.getElementById('purecloud-script-mini-dashboard')._updateStatsInternal(); } },
        calculateStats() { const data = this.getData(); const conversations = data.conversations; let completedConvos = conversations.filter(c => c.duration >= CONFIG.CHECKMARK_THRESHOLD_MS); const consolidatedConvos = completedConvos.filter(conv => !conv.isRecurrence); const uniqueCount = consolidatedConvos.length; const recurrenceCount = completedConvos.filter(conv => conv.isRecurrence).length; const baloonClicksCount = v4_counters.balao.length; if (completedConvos.length === 0) { return { count: 0, tma: '00:00', tme: '00:00', perHour: {}, first: 'N/A', last: 'N/A', docCopies: data.docCopies, hotkeysUsed: (data.hotkeysUsed || []).length, baloonClicks: baloonClicksCount, transferClicks: data.transferClicks, evaluatedClicks: data.evaluatedClicks, allConversations: conversations, endedByAgentCount: 0, recurrenceCount: 0, tmaSeconds: 0, tmeSeconds: 0 }; } const divisor = completedConvos.length > 0 ? completedConvos.length : 1; const totalDuration = completedConvos.reduce((sum, conv) => sum + conv.duration, 0); const tmaSeconds = Math.floor((totalDuration / divisor) / 1000); const totalActiveDuration = completedConvos.reduce((sum, conv) => sum + (conv.activeDuration || 0), 0); const tmeSeconds = Math.floor((totalActiveDuration / divisor) / 1000); const tma = `${formatTime(Math.floor(tmaSeconds / 60))}:${formatTime(tmaSeconds % 60)}`; const tme = `${formatTime(Math.floor(tmeSeconds / 60))}:${formatTime(tmeSeconds % 60)}`; const perHour = {}; for (let hour = 0; hour < 24; hour++) { perHour[hour] = 0; } completedConvos.forEach(conv => { const convDate = getBrazilTime(new Date(conv.timestamp)); const hour = convDate.getHours(); perHour[hour] = (perHour[hour] || 0) + 1; }); const sortedByTimestamp = [...completedConvos].sort((a, b) => b.timestamp - a.timestamp); const first = sortedByTimestamp.length > 0 ? getBrazilTime(new Date(sortedByTimestamp[0].timestamp)).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : 'N/A'; const last = sortedByTimestamp.length > 0 ? getBrazilTime(new Date(sortedByTimestamp[sortedByTimestamp.length - 1].timestamp)).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : 'N/A'; return { count: uniqueCount, tma, tme, perHour, first, last, docCopies: data.docCopies, hotkeysUsed: (data.hotkeysUsed || []).length, baloonClicks: baloonClicksCount, transferClicks: data.transferClicks, evaluatedClicks: data.evaluatedClicks, endedByAgentCount: 0, recurrenceCount: recurrenceCount, allConversations: conversations, tmaSeconds: tmaSeconds, tmeSeconds: tmeSeconds }; },
        clearAllData() { localStorage.removeItem('dailyAnalytics_v2_data'); localStorage.removeItem('achievements_v2'); v4_counters = { balao: [] }; saveV4Counters(); UI.createMiniDashboard(); }
    };


    const documentExtractor = {
        getNameAndNumber: (convEl = document) => { if (!convEl || convEl === document) { convEl = findEl(CONFIG.PURECLOUD_SELECTORS.SELECTED_INTERACTION_GROUP) || document; } const nameEl = findEl(CONFIG.PURECLOUD_SELECTORS.PARTICIPANT_NAME_BADGE, convEl); const rawText = nameEl?.textContent.trim() || 'N/A'; const match = rawText.match(/^(.*?)\s*\|\s*(\(\d{2}\)\s*\d{4,5}[-.\s]*\d{4,5}|\d{8,14})$/); let participantName = rawText; let phoneNumber = 'N/A'; if (match) { participantName = match[1].trim(); phoneNumber = match[2].replace(/\D/g, ''); } else { const numberMatch = rawText.match(/(\(\d{2}\)\s*\d{4,5}[-.\s]*\d{4,5}|\d{8,14})/); if (numberMatch) { phoneNumber = numberMatch[0].replace(/\D/g, ''); participantName = rawText.replace(numberMatch[0], '').replace(/|/g, '').trim() || 'N/A'; } } if (participantName.endsWith('|')) { participantName = participantName.slice(0, -1).trim(); } let formattedPhoneNumber = 'N/A'; if (phoneNumber.length === 11) { formattedPhoneNumber = `(${phoneNumber.substring(0, 2)}) ${phoneNumber.substring(2, 7)}-${phoneNumber.substring(7)}`; } else if (phoneNumber.length === 10) { formattedPhoneNumber = `(${phoneNumber.substring(0, 2)}) ${phoneNumber.substring(2, 6)}-${phoneNumber.substring(6)}`; } else if (phoneNumber !== 'N/A') { formattedPhoneNumber = phoneNumber; } return { participantName, phoneNumber: phoneNumber || 'N/A', formattedPhoneNumber: formattedPhoneNumber }; },
        getInteractionId: (parentEl = document) => { const el = findEl(CONFIG.PURECLOUD_SELECTORS.INTERACTION_ID_EL, parentEl); return el?.textContent.trim().replace(/#/g, ''); },
    };

    async function copyTextToClipboard(text) { try { await navigator.clipboard.writeText(text); return true; } catch (err) { return false; } }
    async function getNativeInteractionUrl() { const btn = findEl(CONFIG.PURECLOUD_SELECTORS.NATIVE_COPY_BUTTON); if (!btn) return null; let originalClipboard = ''; try { originalClipboard = await navigator.clipboard.readText(); } catch (e) { } btn.click(); return new Promise(resolve => { setTimeout(async () => { let url = null; try { url = await navigator.clipboard.readText(); if (!url || !(url.includes('interactions/') || url.includes('conversations/'))) { url = null; } } catch (e) { url = null; } if (originalClipboard && url) { try { await navigator.clipboard.writeText(originalClipboard); } catch (e) { } } resolve(url); }, 200); }); }

    // --- ENCONTRAR O CAMPO DE CHAT RAPIDAMENTE ---
    function getChatInput() {
        let chatInputField = null; const messagingIframe = document.querySelector(CONFIG.PURECLOUD_SELECTORS.MESSAGING_GADGET_IFRAME);
        if (messagingIframe && messagingIframe.contentDocument) { chatInputField = findEl('textarea[aria-label="Digitar uma mensagem"]', messagingIframe.contentDocument); }
        if (!chatInputField) { chatInputField = findEl('textarea[aria-label="Digitar uma mensagem"]'); }
        return chatInputField;
    }

    const actions = {
        copyInteraction: async () => {
            const selectedConvEl = findEl(CONFIG.PURECLOUD_SELECTORS.SELECTED_INTERACTION_GROUP);
            const { participantName, phoneNumber, formattedPhoneNumber } = documentExtractor.getNameAndNumber(selectedConvEl);
            if (participantName === 'N/A' || !findEl(CONFIG.PURECLOUD_SELECTORS.NATIVE_COPY_BUTTON)) { UI.createNotification(CONFIG.MESSAGES.NOT_FOUND_INTERACTION_DATA, 'error'); return; }
            const url = await getNativeInteractionUrl();
            if (url && (url.includes('interactions/') || url.includes('conversations/'))) {
                const tData = conversationTimers.get(selectedConvEl);
                if (tData) { tData.interactionUrl = url; tData.participantName = participantName; tData.phoneNumber = phoneNumber; UI.createNotification("Link salvo!", 'info', 1500); }
                const nameAndPhone = formattedPhoneNumber !== 'N/A' ? `${participantName} | ${formattedPhoneNumber}` : (participantName !== 'N/A' ? participantName : 'Nome Indisponível');
                const finalCopyText = `${nameAndPhone}\n${url}`;
                if (await copyTextToClipboard(finalCopyText)) { UI.createNotification(CONFIG.MESSAGES.INTERACTION_COPIED, 'success'); } else { UI.createNotification(CONFIG.MESSAGES.COPY_ERROR, 'error'); }
            } else {
                UI.createNotification("Link não encontrado.", 'warn');
                if (participantName !== 'N/A' && await copyTextToClipboard(participantName)) { UI.createNotification(`Nome (${participantName}) copiado.`, 'info'); }
            }
        },
        openSettings: () => UI.createSettingsPanel(),
        toggleMiniDashboard: () => { const dashboard = document.getElementById('purecloud-script-mini-dashboard'); if (dashboard) { clearInterval(dashboard._updateInterval); dashboard.remove(); CONFIG.MINI_DASHBOARD_VISIBLE = false; saveData(); } else { CONFIG.MINI_DASHBOARD_VISIBLE = true; saveData(); UI.createMiniDashboard(); } },
        toggleLock: () => { const selectedConvEl = findEl(CONFIG.PURECLOUD_SELECTORS.SELECTED_INTERACTION_GROUP); if (!selectedConvEl) { UI.createNotification("Selecione uma conversa para destravar.", "warn"); return; } conversationLockManager.toggleLock(selectedConvEl); },
        toggleDarkMode: () => {
            CONFIG.DARK_MODE = !CONFIG.DARK_MODE;
            saveData();
        },
        quickGreeting: () => { const chatInputField = getChatInput(); if (chatInputField) { chatInputField.value = templateProcessor.process(CONFIG.QUICK_REPLIES[0] ? CONFIG.QUICK_REPLIES[0].text : "Olá!"); chatInputField.dispatchEvent(new Event('input', { bubbles: true })); chatInputField.focus(); } else { UI.createNotification("Campo de chat não encontrado.", "warn"); } },
        exportData: () => { const dataToExport = analyticsManager.getData().conversations; if (!dataToExport || dataToExport.length === 0) { UI.createNotification("Não há dados para exportar.", "warn"); return; } const filename = `purecloud_script_attendances_${getBrazilTime(new Date()).toISOString().split('T')[0]}.json`; const blob = new Blob([JSON.stringify(dataToExport, null, 2)], { type: 'application/json' }); const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = filename; document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(url); UI.createNotification("Download iniciado!", "success"); },

        // --- NOVAS AÇÕES: MODO FOCO E FORMATADOR DE TEXTO ---
        toggleZenMode: () => {
            document.body.classList.toggle('sys-zen-active');
            const isActive = document.body.classList.contains('sys-zen-active');
            UI.createNotification(`Modo Foco ${isActive ? 'Ativado 🧘' : 'Desativado'}`, "info");
        },
        formatText: () => {
            const chatInputField = getChatInput();
            if (chatInputField && chatInputField.value) {
                // Transforma texto em minúsculo e capitaliza a primeira letra de cada frase
                let txt = chatInputField.value.toLowerCase().replace(/(^\s*\w|[.!?]\s*\w)/g, c => c.toUpperCase());
                chatInputField.value = txt;
                chatInputField.dispatchEvent(new Event('input', { bubbles: true }));
                UI.createNotification("Texto formatado e corrigido! ✨", "success");
            } else {
                UI.createNotification("Nenhum texto para formatar no campo de chat.", "warn");
            }
        }
    };

    async function handleBalaoClick(e) { const endChatButton = findEl(LOCKDOWN_CONFIG.END_CHAT_BUTTON_SELECTOR); if (endChatButton && endChatButton.disabled) return; const { participantName, phoneNumber } = documentExtractor.getNameAndNumber(document.body); let interactionUrl = 'N/A'; try { const urlFromButton = await getNativeInteractionUrl(); if (urlFromButton) { interactionUrl = urlFromButton; } else { const id = documentExtractor.getInteractionId(document.body); if (id && id !== 'N/A') { interactionUrl = `${window.location.origin}/directory/conversations/${id}`; } else { interactionUrl = window.location.href.includes('/conversations/') ? window.location.href : 'N/A'; } } } catch (error) { } v4_counters.balao.push({ timestamp: Date.now(), participantName: participantName, phoneNumber: phoneNumber, interactionUrl: interactionUrl }); saveV4Counters(); analyticsManager._updateDashboard(); }

    const conversationLockManager = {
        states: new Map(),
        toggleLock: (selectedConvEl) => { const convState = conversationLockManager.states.get(selectedConvEl); if (!convState || !convState.isLocked) return; const lockButton = document.getElementById('purecloud-script-btn-toggleLock'); if (lockButton) { lockButton.classList.add('btn-feedback-click'); setTimeout(() => lockButton.classList.remove('btn-feedback-click'), 200); } convState.unlockClicks++; const clicksRemaining = LOCKDOWN_CONFIG.REQUIRED_CLICKS - convState.unlockClicks; if (clicksRemaining > 0) { UI.createNotification(`Mais ${clicksRemaining} vez(es) para destravar.`, "info", 1500); setTimeout(() => { conversationLockManager.updateLockButton(selectedConvEl); }, 0); } else { convState.isLocked = false; UI.createNotification("Conversa destravada!", "success"); setTimeout(() => { conversationLockManager.updateLockButton(selectedConvEl); }, 0); } },
        updateLockButton: (conv) => { const currentConvState = conversationLockManager.states.get(conv); const endChatButton = findEl(LOCKDOWN_CONFIG.END_CHAT_BUTTON_SELECTOR); const lockButton = document.getElementById('purecloud-script-btn-toggleLock'); if (currentConvState && lockButton) { const ICON_SHIELD_LOCKED = '<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path>'; const ICON_SHIELD_UNLOCKED = '<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path><path d="M9 12l2 2 4-4"></path>'; lockButton.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${currentConvState.isLocked ? ICON_SHIELD_LOCKED : ICON_SHIELD_UNLOCKED}</svg>`; lockButton.disabled = !currentConvState.isLocked; lockButton.classList.toggle('lockdown-unlocked', !currentConvState.isLocked); lockButton.title = currentConvState.isLocked ? `Destravar Encerrar (Faltam ${LOCKDOWN_CONFIG.REQUIRED_CLICKS - currentConvState.unlockClicks} cliques)` : "Conversa Destravada."; if (endChatButton) { endChatButton.disabled = currentConvState.isLocked; endChatButton.classList.toggle('lockdown-disabled', currentConvState.isLocked); endChatButton.title = currentConvState.isLocked ? 'Bloqueado. Clique no escudo.' : 'Mensagens de término'; } } const getScriptIframeDoc = () => { const conversationRoot = findEl(CONFIG.PURECLOUD_SELECTORS.CONVERSATION_ROOT); if (!conversationRoot) return null; const scriptIframe = findEl(CONFIG.PURECLOUD_SELECTORS.SCRIPT_IFRAME, conversationRoot); if (scriptIframe && scriptIframe.contentDocument) { return scriptIframe.contentDocument; } return null; }; const scriptDoc = getScriptIframeDoc(); const addAnalyticsListener = (btn, type) => { if (btn.dataset.gmListenerAdded || !currentConvState) return; btn.addEventListener('click', (e) => { if (btn.disabled) return; const id = documentExtractor.getInteractionId(); if (!id || id === 'N/A') return; if (type === 'TRANSFERIDO') { analyticsManager.logTransferClick(); CONFIG.LAST_ENDED_INTERACTIONS.set(id, { type: 'TRANSFERIDO', timestamp: Date.now() }); } else if (type === 'AVALIACAO') { analyticsManager.logEvaluatedClick(); CONFIG.LAST_ENDED_INTERACTIONS.set(id, { type: 'AVALIACAO', timestamp: Date.now() }); } }, { signal: currentConvState.controller.signal }); btn.dataset.gmListenerAdded = true; }; const addBalaoListener = (btn) => { if (btn.dataset.gmBalaoListenerAdded || !currentConvState) return; btn.addEventListener('click', handleBalaoClick, { signal: currentConvState.controller.signal }); btn.dataset.gmBalaoListenerAdded = true; }; document.querySelectorAll(LOCKDOWN_CONFIG.END_CHAT_BUTTON_SELECTOR.join(',')).forEach(btn => addBalaoListener(btn)); document.querySelectorAll(CONFIG.PURECLOUD_SELECTORS.TRANSFER_BUTTON_SELECTOR.join(',')).forEach(btn => addAnalyticsListener(btn, 'TRANSFERIDO')); document.querySelectorAll(CONFIG.PURECLOUD_SELECTORS.EVALUATION_BUTTON_SELECTOR.join(',')).forEach(btn => addAnalyticsListener(btn, 'AVALIACAO')); if (scriptDoc) { scriptDoc.querySelectorAll(CONFIG.PURECLOUD_SELECTORS.EVALUATION_BUTTON_SELECTOR.join(',')).forEach(btn => addAnalyticsListener(btn, 'AVALIACAO')); } },
        initLockState: (conv) => { if (!conversationLockManager.states.has(conv)) { conversationLockManager.states.set(conv, { isLocked: true, unlockClicks: 0, controller: new AbortController() }); } }
    };

    const conversationTimers = new Map();
    let currentChatObserverInstance = null;
    let currentChatInputField = null;

    function updateTimerDisplay(timerData) {
        if (!timerData.div?.isConnected || !timerData.numDiv?.isConnected || !timerData.bubblesContainer?.isConnected) { return; }
        let currentElapsed; if (timerData.isPaused) { currentElapsed = timerData.pausedAt - timerData.startTime; } else { currentElapsed = Date.now() - timerData.startTime; }
        const secs = Math.floor(currentElapsed / 1000); timerData.div.textContent = `${formatTime(Math.floor(secs / 60))}:${formatTime(secs % 60)}`;
        timerData.div.classList.remove('paused-alert', 'inactive-client-alert', 'normal-timer', 'inactive-operator-alert'); timerData.div.style.removeProperty('animation');

        if (timerData.isPaused) { timerData.div.classList.add('paused-alert'); } else {
            const inactivityOperatorSeconds = (Date.now() - (timerData.lastOperatorActivityTimestamp || timerData.startTime)) / 1000;
            const inactivityClientSeconds = (Date.now() - (timerData.lastCustomerReplyTimestamp || timerData.startTime)) / 1000;
            if (inactivityOperatorSeconds >= CONFIG.INACTIVITY_OPERATOR_ALERT_SECONDS) {
                timerData.div.classList.add('inactive-operator-alert'); if (!timerData.operatorAlertPlayed) { effectsManager.playBeep('inactive_operator'); timerData.operatorAlertPlayed = true; }
            } else if (inactivityClientSeconds >= CONFIG.INACTIVITY_CLIENT_ALERT_SECONDS) {
                timerData.div.classList.add('inactive-client-alert'); if (!timerData.clientAlertPlayed) { effectsManager.playBeep('inactive_client'); timerData.clientAlertPlayed = true; }
            } else { timerData.div.classList.add('normal-timer'); timerData.operatorAlertPlayed = false; timerData.clientAlertPlayed = false; }
        }
        if (currentElapsed >= CONFIG.CHECKMARK_THRESHOLD_MS) {
            if (!timerData.completedVisual) {
                if (!timerData.checkmarkDiv) {
                    const existents = timerData.bubblesContainer.querySelectorAll('.injected-checkmark');
                    existents.forEach(e => e.remove());
                    timerData.checkmarkDiv = document.createElement('div');
                    timerData.checkmarkDiv.className = 'injected-element injected-checkmark';
                    timerData.checkmarkDiv.innerHTML = '✔️';
                    timerData.bubblesContainer.appendChild(timerData.checkmarkDiv);
                } timerData.checkmarkDiv.style.display = 'flex'; timerData.completedVisual = true;
            }
        } else { if (timerData.checkmarkDiv) { timerData.checkmarkDiv.style.display = 'none'; timerData.completedVisual = false; } }

        const longConvoMs = CONFIG.LONG_CONVO_ALERT_MIN * 60000;
        if (currentElapsed >= (longConvoMs - 60000) && currentElapsed < longConvoMs) {
            if (!timerData.div.classList.contains('warning-pulse-alert')) timerData.div.classList.add('warning-pulse-alert');
        } else {
            timerData.div.classList.remove('warning-pulse-alert');
        }

        if (currentElapsed > longConvoMs && !timerData.longConvoNotified) { UI.createNotification(`A conversa com ${timerData.participantName || 'o cliente'} está longa (${CONFIG.LONG_CONVO_ALERT_MIN} min).`, 'warn', 5000); timerData.longConvoNotified = true; }
    }

    const timerManager = {
        globalIntervalId: null,
        startGlobalTimer() {
            if (!this.globalIntervalId) {
                this.globalIntervalId = setInterval(() => {
                    conversationTimers.forEach((tData) => {
                        updateTimerDisplay(tData);
                    });
                }, CONFIG.TIMER_UPDATE_INTERVAL_MS);
            }
        },
        initTimer(convEl, index, total) {
            let tData = conversationTimers.get(convEl); if (!tData) {
                let bubblesContainer = convEl.querySelector('.injected-bubbles-container'); let tDiv = convEl.querySelector('.injected-conversation-timer'); let nDiv = convEl.querySelector('.injected-conversation-number'); let checkmarkDiv = convEl.querySelector('.injected-checkmark'); let recurrenceDiv = convEl.querySelector('.injected-recurrence-icon'); let iconDiv = convEl.querySelector('.injected-interaction-icon');
                if (!bubblesContainer) { bubblesContainer = document.createElement('div'); bubblesContainer.className = 'injected-bubbles-container'; nDiv = document.createElement('div'); nDiv.className = 'injected-element injected-conversation-number'; bubblesContainer.appendChild(nDiv); iconDiv = document.createElement('div'); iconDiv.className = 'injected-element injected-interaction-icon'; iconDiv.innerHTML = '❔'; bubblesContainer.appendChild(iconDiv); tDiv = document.createElement('div'); tDiv.className = 'injected-element injected-conversation-timer'; bubblesContainer.appendChild(tDiv); let contentWrapper = findEl(CONFIG.PURECLOUD_SELECTORS.CONVERSATION_CONTENT_WRAPPER, convEl); if (contentWrapper) { contentWrapper.appendChild(bubblesContainer); } else { convEl.appendChild(bubblesContainer); } setTimeout(() => { if (contentWrapper && !contentWrapper.contains(bubblesContainer)) { contentWrapper.appendChild(bubblesContainer); } else if (!convEl.contains(bubblesContainer)) { convEl.appendChild(bubblesContainer); } }, 100); } else { if (!nDiv) { nDiv = document.createElement('div'); nDiv.className = 'injected-element injected-conversation-number'; bubblesContainer.prepend(nDiv); } if (!iconDiv) { iconDiv = document.createElement('div'); iconDiv.className = 'injected-element injected-interaction-icon'; iconDiv.innerHTML = '❔'; if (nDiv && nDiv.nextSibling) { bubblesContainer.insertBefore(iconDiv, nDiv.nextSibling); } else { bubblesContainer.appendChild(iconDiv); } } if (!tDiv) { tDiv = document.createElement('div'); tDiv.className = 'injected-element injected-conversation-timer'; bubblesContainer.appendChild(tDiv); } }
                const { participantName, phoneNumber } = documentExtractor.getNameAndNumber(convEl); const interactionId = documentExtractor.getInteractionId(convEl);
                const isRecurrence = phoneNumber !== 'N/A' && analyticsManager.getData().conversations.some(conv => conv.phoneNumber === phoneNumber && conv.duration >= CONFIG.CHECKMARK_THRESHOLD_MS);
                if (isRecurrence) { if (!recurrenceDiv) { recurrenceDiv = document.createElement('div'); recurrenceDiv.className = 'injected-element injected-recurrence-icon'; recurrenceDiv.innerHTML = '🔁'; recurrenceDiv.title = 'Cliente recorrente hoje'; bubblesContainer.appendChild(recurrenceDiv); } recurrenceDiv.style.display = 'flex'; } else if (recurrenceDiv) { recurrenceDiv.style.display = 'none'; }
                tData = { div: tDiv, numDiv: nDiv, iconDiv: iconDiv, checkmarkDiv: checkmarkDiv, recurrenceDiv: recurrenceDiv, bubblesContainer: bubblesContainer, element: convEl, creationTime: Date.now(), startTime: Date.now(), pausedAt: Date.now(), isPaused: true, completedVisual: false, tmaLogged: false, activeDuration: 0, activeSessionStart: null, lastOperatorActivityTimestamp: Date.now(), lastCustomerReplyTimestamp: Date.now(), longConvoNotified: false, operatorAlertPlayed: false, clientAlertPlayed: false, participantName: participantName, phoneNumber: phoneNumber, interactionUrl: 'N/A', interactionId: interactionId, isRecurrence: isRecurrence, interactionType: 'unknown' };
                conversationTimers.set(convEl, tData);
            }
            tData.numDiv.textContent = total - index;
            if (tData.isRecurrence && tData.recurrenceDiv) { tData.recurrenceDiv.style.display = 'flex'; }
            return tData;
        },
        updateState(tData, isSelected) { if (isSelected) { if (tData.isPaused) { tData.startTime += (Date.now() - tData.pausedAt); tData.isPaused = false; tData.activeSessionStart = Date.now(); tData.lastOperatorActivityTimestamp = Date.now(); } } else { if (!tData.isPaused) { if (tData.activeSessionStart) { tData.activeDuration += (Date.now() - tData.activeSessionStart); tData.activeSessionStart = null; } tData.pausedAt = Date.now(); tData.isPaused = true; } } updateTimerDisplay(tData); },
        cleanupTimers(activeConversationElements) {
            const timersToDelete = []; const AGENT_END_WINDOW_MS = 5000;
            conversationTimers.forEach((timerData, convEl) => {
                if (!document.body.contains(convEl)) {
                    // clearInterval(timerData.intervalId); -> agora usamos o Global Timer
                    if (!timerData.tmaLogged) {
                        if (!timerData.isPaused && timerData.activeSessionStart) { timerData.activeDuration += (Date.now() - timerData.activeSessionStart); timerData.activeSessionStart = null; }
                        const duration = Date.now() - timerData.creationTime; const currentTime = Date.now();
                        const clickData = CONFIG.LAST_ENDED_INTERACTIONS.get(timerData.interactionId); let classification = 'HIBERNADO';
                        if (clickData && (currentTime - clickData.timestamp) < AGENT_END_WINDOW_MS) { if (clickData.type === 'BALAO') { classification = 'BALAO'; } else if (clickData.type === 'TRANSFERIDO') { classification = 'TRANSFERIDO'; } else if (clickData.type === 'AVALIACAO') { classification = 'AVALIACAO'; } CONFIG.LAST_ENDED_INTERACTIONS.delete(timerData.interactionId); }
                        analyticsManager.logConversation(duration, timerData.activeDuration, timerData.participantName, timerData.phoneNumber, timerData.interactionUrl, classification, timerData.interactionType);
                        timerData.tmaLogged = true; if (CONFIG.LAST_ENDED_INTERACTIONS.has(timerData.interactionId)) { CONFIG.LAST_ENDED_INTERACTIONS.delete(timerData.interactionId); }
                    }
                    timersToDelete.push(convEl); timerData.div?.remove(); timerData.numDiv?.remove(); timerData.iconDiv?.remove(); timerData.checkmarkDiv?.remove(); timerData.recurrenceDiv?.remove(); timerData.bubblesContainer?.remove();
                }
            });
            timersToDelete.forEach(convEl => { conversationTimers.delete(convEl); const lockState = conversationLockManager.states.get(convEl); if (lockState && lockState.controller) lockState.controller.abort(); conversationLockManager.states.delete(convEl); });
        }
    }

    function observeCurrentChatMessages(timerData) {
        if (currentChatObserverInstance) { currentChatObserverInstance.disconnect(); currentChatObserverInstance = null; } if (currentChatInputField) { currentChatInputField.removeEventListener('input', handleOperatorActivity); currentChatInputField.removeEventListener('keypress', handleOperatorActivity); currentChatInputField = null; } let chatMessagesContainer = null; let chatInputField = null; const messagingIframe = document.querySelector(CONFIG.PURECLOUD_SELECTORS.MESSAGING_GADGET_IFRAME); if (messagingIframe && messagingIframe.contentDocument) { try { chatMessagesContainer = findEl('.chat-messages-container', messagingIframe.contentDocument); chatInputField = findEl('textarea[aria-label="Digitar uma mensagem"]', messagingIframe.contentDocument); } catch (e) { } } if (!chatMessagesContainer) { chatMessagesContainer = findEl('.chat-messages-container'); chatInputField = findEl('textarea[aria-label="Digitar uma mensagem"]'); }

        const handleOperatorActivity = (e) => {
            if (timerData.lastOperatorActivityTimestamp !== Date.now()) { timerData.lastOperatorActivityTimestamp = Date.now(); updateTimerDisplay(timerData); }

            // --- LÓGICA DE SNIPPETS (AUTO-EXPANSÃO DE TEXTO) ---
            if (e && e.type === 'input' && chatInputField) {
                let val = chatInputField.value;
                let replaced = false;
                CONFIG.QUICK_REPLIES.forEach(qr => {
                    // Verifica se o operador digitou o atalho com um espaço no final
                    if (qr.shortcut && val.includes(qr.shortcut + ' ')) {
                        val = val.replace(qr.shortcut + ' ', templateProcessor.process(qr.text) + ' ');
                        replaced = true;
                    }
                });
                if (replaced) {
                    chatInputField.value = val;
                    chatInputField.dispatchEvent(new Event('input', { bubbles: true }));
                }
            }
        };

        if (chatMessagesContainer) { if (chatMessagesContainer.dataset.observedByScript === 'true') { if (chatInputField && currentChatInputField !== chatInputField) { chatInputField.addEventListener('input', handleOperatorActivity); chatInputField.addEventListener('keypress', handleOperatorActivity); currentChatInputField = chatInputField; } return; } currentChatObserverInstance = new MutationObserver((mutations) => { for (const mutation of mutations) { if (mutation.type === 'childList' && mutation.addedNodes.length > 0) { const newClientMessages = Array.from(mutation.addedNodes).filter(node => node.nodeType === 1 && node.matches('.chat-message-group.remote')); if (newClientMessages.length > 0) { timerData.lastCustomerReplyTimestamp = Date.now(); updateTimerDisplay(timerData); } } } }); currentChatObserverInstance.observe(chatMessagesContainer, { childList: true, subtree: true }); chatMessagesContainer.dataset.observedByScript = 'true'; if (chatInputField) { chatInputField.addEventListener('input', handleOperatorActivity); chatInputField.addEventListener('keypress', handleOperatorActivity); currentChatInputField = chatInputField; } }
    }

    function mainLoop() {
        const toolbar = findEl(CONFIG.PURECLOUD_SELECTORS.TOOLBAR); if (toolbar) { createToolbarUI(toolbar); }
        let conversationsNodeList = document.querySelectorAll(CONFIG.PURECLOUD_SELECTORS.INTERACTION_GROUP.join(', ')); const sortedConversationsArray = Array.from(conversationsNodeList).sort((a, b) => a.getBoundingClientRect().top - b.getBoundingClientRect().top);
        const activeConversationElements = new Set(sortedConversationsArray); timerManager.cleanupTimers(activeConversationElements); const selectedConvEl = findEl(CONFIG.PURECLOUD_SELECTORS.SELECTED_INTERACTION_GROUP);
        sortedConversationsArray.forEach((conv, index) => {
            const nativeTimeElementsInConv = conv.querySelectorAll(CONFIG.PURECLOUD_SELECTORS.NATIVE_TIMER_SELECTORS.join(', ')); nativeTimeElementsInConv.forEach(el => { if (el.classList.contains('injected-element') || el.classList.contains('injected-bubbles-container')) { return; } if (el.textContent.match(/\d+\s*(min|hr|seg|now|agora)/i) || el.matches('.duration, .message-timestamp')) { el.style.display = 'none'; } });
            const tData = timerManager.initTimer(conv, index, sortedConversationsArray.length);
            const isCall = conv.querySelector(CONFIG.PURECLOUD_SELECTORS.ICON_SELECTOR_CALL); const isChat = conv.querySelector(CONFIG.PURECLOUD_SELECTORS.ICON_SELECTOR_CHAT);
            if (tData.iconDiv) { if (isCall) { tData.iconDiv.innerHTML = '📞'; tData.iconDiv.title = 'Ligação'; tData.interactionType = 'call'; } else if (isChat) { tData.iconDiv.innerHTML = '💬'; tData.iconDiv.title = 'Chat'; tData.interactionType = 'chat'; } else { tData.iconDiv.innerHTML = '❔'; tData.iconDiv.title = 'Interação'; tData.interactionType = 'unknown'; } }
            const isSelected = conv === selectedConvEl; timerManager.updateState(tData, isSelected); conversationLockManager.initLockState(conv); if (isSelected) { observeCurrentChatMessages(tData); conversationLockManager.updateLockButton(conv); }
        });
        if (!selectedConvEl) { const pepperButton = document.getElementById('purecloud-script-btn-endCustomer'); if (pepperButton) pepperButton.title = 'Selecione uma conversa para encerrar'; }
        if (CONFIG.MINI_DASHBOARD_VISIBLE) { UI.createMiniDashboard(); }
        if (CONFIG.TOOLS_VISIBLE) { UI.createAgentToolsPanel(); }
    }

    const getHotkeyCombo = (e) => { const pressedKeys = []; if (e.ctrlKey) pressedKeys.push('Control'); if (e.shiftKey) pressedKeys.push('Shift'); if (e.altKey) pressedKeys.push('Alt'); const key = e.key === ' ' ? 'Space' : (e.key.length === 1 ? e.key.toUpperCase() : e.key); if (!['Control', 'Shift', 'Alt', 'Meta'].includes(key)) { pressedKeys.push(key); } const primaryKey = pressedKeys.pop(); pressedKeys.sort(); if (primaryKey) pressedKeys.push(primaryKey); return pressedKeys.join('+'); };
    const keyboardEventHandler = (e) => { if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.isContentEditable) { return; } const currentCombo = getHotkeyCombo(e); if (['Control', 'Shift', 'Alt', 'Meta'].includes(e.key)) { return; } for (const actionName in CONFIG.HOTKEYS) { if (CONFIG.HOTKEYS[actionName] === currentCombo) { e.preventDefault(); if (actions[actionName]) { actions[actionName](); UI.createNotification(featureDescriptions[actionName]?.title || actionName, 'info', 1000); return; } } } };

    function handleNativeEndCustomerClick() {
        const testEndButton = document.getElementById(LOCKDOWN_CONFIG.TEST_END_BUTTON_SELECTOR.slice(1));
        if (!testEndButton) {
            UI.createNotification('Botão de teste sem avaliação não encontrado no Genesys.', 'warn', 3000);
            return;
        }
        testEndButton.click();
        UI.createNotification('Encerramento de teste acionado sem abrir avaliação.', 'info', 1800);
    }

    function createToolbarUI(toolbar) {
        if (toolbar.dataset.scriptVersion === SCRIPT_VERSION) { return; } toolbar.querySelectorAll('.purecloud-script-custom-btn, #purecloud-script-toolbar-counter, .purecloud-script-menu-container').forEach(el => el.remove()); toolbar.dataset.scriptVersion = SCRIPT_VERSION;
        const createMainToolbarBtn = (id, title, svg, onClick) => { const btn = document.createElement("button"); btn.id = id; btn.className = 'purecloud-script-custom-btn'; btn.title = title; btn.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">${svg}</svg>`; btn.onclick = onClick; btn; toolbar.appendChild(btn); return btn; };
        createMainToolbarBtn('purecloud-script-btn-copyInteraction', featureDescriptions.copyInteraction.title, '<path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.72"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.72-1.72"/>', actions.copyInteraction);
        createMainToolbarBtn('purecloud-script-btn-openSettings', featureDescriptions.openSettings.title, '<circle cx="12" cy="12" r="3"></circle><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2 2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path>', actions.openSettings);
        const endCustomerButton = document.createElement("button"); endCustomerButton.id = 'purecloud-script-btn-endCustomer'; endCustomerButton.className = 'purecloud-script-custom-btn'; endCustomerButton.title = 'Encerrar cliente'; endCustomerButton.textContent = '🌶️'; endCustomerButton.style.cssText = 'width:34px; min-width:34px; justify-content:center; padding:0 !important; background:#d93b3b !important; color:#fff !important; border-color:#b02a2a !important; font-size:17px; font-weight:700; white-space:nowrap;'; endCustomerButton.onclick = handleNativeEndCustomerClick;
        const endChatButton = findEl(LOCKDOWN_CONFIG.END_CHAT_BUTTON_SELECTOR, toolbar); if (endChatButton) { endChatButton.parentNode.insertBefore(endCustomerButton, endChatButton); } else { toolbar.prepend(endCustomerButton); }
    }

    const UI = {
        createNotification(message, type = 'info', duration = 3000) {
            let c = document.getElementById('purecloud-script-notification-container');
            if (!c) { c = document.createElement('div'); c.id = 'purecloud-script-notification-container'; document.body.appendChild(c); }
            const n = document.createElement("div"); n.textContent = message; n.className = `purecloud-script-notification purecloud-script-notification-${type}`; c.prepend(n); const v = document.querySelectorAll('#purecloud-script-notification-container .purecloud-script-notification'); if (v.length > 5) { v[v.length - 1].remove(); } setTimeout(() => { n.style.opacity = '0'; n.style.transform = 'translateX(100%)'; setTimeout(() => n.remove(), 300); }, duration);
        },
        renderBarChart(container, perHourData) {
            container.innerHTML = ''; if (Object.keys(perHourData).length === 0) { container.innerHTML = '<div class="chart-placeholder">Nenhuma conversa para exibir gráfico.</div>'; return; } const maxCount = Math.max(...Object.values(perHourData)); const chartWrapper = document.createElement('div'); chartWrapper.className = 'chart-bars-wrapper'; for (let hour = 0; hour < 24; hour++) { const count = perHourData[hour] || 0; const height = (count / (maxCount || 1)) * 90; const barWrapper = document.createElement('div'); barWrapper.className = 'chart-bar-wrapper'; barWrapper.title = `${count} conversas às ${String(hour).padStart(2, '0')}h`; barWrapper.style.height = '100%'; barWrapper.style.position = 'relative'; barWrapper.innerHTML = `<div class="chart-bar building-bar" style="height: ${height}%; position: absolute; bottom: 0; width: 90%;"><span class="bar-count">${count > 0 ? count : ''}</span></div><span class="bar-label">${String(hour).padStart(2, '0')}h</span>`; chartWrapper.appendChild(barWrapper); } container.innerHTML = `<div class="chart-scroll-container">${chartWrapper.outerHTML}</div>`;
        },
        renderAnalyticsContent(container) {
            const stats = analyticsManager.calculateStats();
            container.innerHTML = `<div class="stats-grid"><div class="stat-item"><span>Conversas (Únicas)</span><strong id="analytics-total-count">${stats.count}</strong></div><div class="stat-item"><span>TMA (Geral)</span><strong id="analytics-tma">${stats.tma}</strong></div><div class="stat-item"><span>TME (Ativo)</span><strong id="analytics-tme">${stats.tme}</strong></div><div class="stat-item"><span>Balão (Término)</span><strong id="analytics-balao-clicks">${stats.baloonClicks}</strong></div> <div class="stat-item"><span>Início</span><strong id="analytics-first">${stats.first}</strong></div><div class="stat-item"><span>Última</span><strong id="analytics-last">${stats.last}</strong></div><div class="stat-item"><span>Meta</span><strong id="analytics-target">${CONFIG.CONVERSATION_TARGET}</strong></div><div class="stat-item"><span>Transferidos</span><strong id="analytics-transfer-count">${stats.transferClicks}</strong></div></div><div style="display:flex; justify-content:space-between; align-items:center;"><p style="font-size: 0.8em; color: var(--purecloud-script-text-secondary); margin-top: 5px;">* Balão (Término) usa o contador integrado (v4.0).</p><button id="export-shift-btn" class="purecloud-script-button" style="padding: 6px 12px; font-size: 0.85em;">📋 Copiar Resumo P/ Lua</button></div><h4>Conversas/Hora (Todas Completas)</h4><div class="analytics-chart-container-main"></div>`;
            UI.renderBarChart(container.querySelector('.analytics-chart-container-main'), stats.perHour);

            container.querySelector('#export-shift-btn').onclick = () => {
                const s = analyticsManager.calculateStats();
                const today = getBrazilTime(new Date()).toLocaleDateString('pt-BR');
                const text = `📊 RESUMO DE TURNO (${today})\nAtendimentos Únicos: ${s.count}\nTMA Geral: ${s.tma}\nTME Ativo: ${s.tme}\nTransferências: ${s.transferClicks}\nCliques Balão T.: ${s.baloonClicks}\nPrimeiro Chat: ${s.first}\nÚltimo Chat: ${s.last}`;
                copyTextToClipboard(text).then(() => UI.createNotification("Resumo do turno copiado!", "success"));
            };
        },
        renderDetailsContent(container) {
            const stats = analyticsManager.calculateStats(); const conversations = stats.allConversations.filter(c => c.duration >= CONFIG.CHECKMARK_THRESHOLD_MS).sort((a, b) => b.timestamp - a.timestamp);
            let detailsList = container.querySelector('#details-list'); if (!detailsList) { detailsList = document.createElement('div'); detailsList.id = 'details-list'; container.appendChild(detailsList); }
            if (conversations.length === 0) { detailsList.innerHTML = '<p>Nenhum atendimento completo registrado hoje.</p>'; return; }
            const conversationsAsc = conversations.reverse(); const totalCount = conversationsAsc.length; const recurrenceCount = stats.recurrenceCount;
            detailsList.innerHTML = `
                <div class="details-header" style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px;"><h4 style="margin:0; color: var(--purecloud-script-text-primary);">Total de Atendimentos Completos: ${totalCount}</h4><h4 style="margin:0; color: var(--purecloud-script-warn-color); font-weight: bold;">Recorrências Hoje: ${recurrenceCount}</h4></div>
                <table class="details-table"><thead><tr><th class="col-num">#</th><th class="col-type">Tipo</th><th>Hora Fim</th><th>Cliente</th><th>TME</th><th>Recorrência</th><th>Link</th></tr></thead><tbody>${conversationsAsc.map((conv, index) => { const time = getBrazilTime(new Date(conv.timestamp)).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }); const tmeSeconds = Math.floor(conv.activeDuration / 1000); const tme = `${formatTime(Math.floor(tmeSeconds / 60))}:${formatTime(tmeSeconds % 60)}`; const recurrenceLabel = conv.isRecurrence ? '<span class="recurrence-tag">Sim</span>' : '<span class="first-tag">Não</span>'; const urlLink = conv.interactionUrl && conv.interactionUrl !== 'N/A' ? `<a href="${escapeHTML(conv.interactionUrl)}" target="_blank" title="Abrir Interação">🔗</a>` : 'N/A'; let typeIcon = '❔'; if (conv.interactionType === 'call') { typeIcon = '📞'; } else if (conv.interactionType === 'chat') { typeIcon = '💬'; } return `<tr class="${conv.isRecurrence ? 'is-recurrence-row' : ''}"><td class="col-num">${index + 1}</td><td class="col-type" title="${conv.interactionType}">${typeIcon}</td><td>${time}</td><td>${escapeHTML(conv.participantName || 'N/A')}</td><td>${tme}</td><td>${recurrenceLabel}</td><td>${urlLink}</td></tr>`; }).join('')}</tbody></table><button id="export-details-btn" class="purecloud-script-button" style="margin-top: 15px;">Exportar Detalhes (JSON)</button>`;
            const exportDetailsBtn = container.querySelector('#export-details-btn'); if (exportDetailsBtn) { exportDetailsBtn.onclick = () => actions.exportData(); }
        },
        renderClosedDetailsContent(container) {
            const balaoRecords = v4_counters.balao.slice().reverse();
            container.innerHTML = `
                <h4 style="margin-top:0;">Histórico de Cliques: Balão (Mensagens de Término)</h4><p style="font-size: 0.85em; color: var(--purecloud-script-text-secondary); margin-bottom: 15px;">Total de Cliques de Balão Hoje: <strong style="color: var(--purecloud-script-error-color);">${balaoRecords.length}</strong></p>
                <div id="closed-interactions-list" class="details-table-wrapper" style="max-height: 400px; overflow-y: auto;">${balaoRecords.length === 0 ? '<p>Nenhum clique de Balão registrado hoje.</p>' : ''}<table class="details-table"><thead><tr><th style="width: 20%;">Hora</th><th style="width: 45%;">Cliente</th><th style="width: 25%;">Telefone</th><th style="width: 10%; text-align: center;">Link</th></tr></thead><tbody>${balaoRecords.map(item => { const time = getBrazilTime(new Date(item.timestamp)).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }); const urlLink = (item.interactionUrl && item.interactionUrl !== 'N/A') ? `<a href="${escapeHTML(item.interactionUrl)}" target="_blank" title="Abrir Interação">🔗</a>` : 'N/A'; return `<tr><td>${time}</td><td>${escapeHTML(item.participantName || 'N/A')}</td><td>${escapeHTML(item.phoneNumber || 'N/A')}</td><td style="text-align: center;">${urlLink}</td></tr>`; }).join('')}</tbody></table></div><button id="export-balao-details-btn" class="purecloud-script-button" style="margin-top: 15px;">Exportar Detalhes de Balão (JSON)</button>`;
            const exportDetailsBtn = container.querySelector('#export-balao-details-btn'); if (exportDetailsBtn) { exportDetailsBtn.onclick = () => { const dataToExport = v4_counters.balao; const filename = `purecloud_script_balao_closures_${getBrazilTime(new Date()).toISOString().split('T')[0]}.json`; const blob = new Blob([JSON.stringify(dataToExport, null, 2)], { type: 'application/json' }); const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = filename; document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(url); UI.createNotification("Dados exportados!", "success"); }; }
        },
        renderThemeContent(container, tempThemeColors) {
            const colorGroups = { "Interface Geral": { bgPrimary: "Fundo Principal", bgSecondary: "Fundo Secundário", textPrimary: "Texto Principal", textSecondary: "Texto Secundário", borderColor: "Cor da Borda", }, "Timers e Números (Bolhas)": { timerBg: "Fundo Padrão", accent: "Fundo (Selecionado)", timerNormalText: "Texto (Novo/Completo)", timerActiveText: "Texto (Contando)", timerPausedText: "Texto (Pausado)", timerInactiveClientText: "Texto (Cliente Inativo)", timerInactiveOperatorText: "Texto (Operador Inativo)", }, "Cores de Alerta e Status": { success: "Sucesso (Verde)", error: "Erro (Vermelho)", warn: "Aviso (Amarelo)", info: "Informação (Azul)", }, "Outros": { miniDashboardProgress: "Progresso (Mini Dashboard)" } };
            container.innerHTML = `<h3>Configurações de Tema</h3><p>Altere as cores da interface. As alterações serão aplicadas após salvar.</p><div id="theme-color-sections"></div><button id="reset-theme-btn" class="purecloud-script-button button-danger" style="margin-top: 25px;">Resetar Cores Padrão</button>`;
            const sectionsContainer = container.querySelector('#theme-color-sections'); for (const groupName in colorGroups) { const section = document.createElement('div'); section.className = 'theme-section'; section.innerHTML = `<h4>${groupName}</h4><div class="settings-group color-grid"></div>`; const grid = section.querySelector('.color-grid'); for (const key in colorGroups[groupName]) { if (tempThemeColors.hasOwnProperty(key)) { const label = colorGroups[groupName][key]; const color = tempThemeColors[key]; const pickerGroup = document.createElement('div'); pickerGroup.className = 'color-picker-group'; pickerGroup.innerHTML = `<label for="theme-color-${key}">${label}</label><input type="color" id="theme-color-${key}" data-key="${key}" value="${color}">`; grid.appendChild(pickerGroup); } } sectionsContainer.appendChild(section); }
            container.querySelectorAll('input[type="color"]').forEach(input => { input.addEventListener('input', (e) => { tempThemeColors[e.target.dataset.key] = e.target.value; }); });
            container.querySelector('#reset-theme-btn').onclick = () => { if (!confirm("Resetar todas as cores para o padrão?")) return; Object.assign(tempThemeColors, JSON.parse(JSON.stringify(defaultThemeColors))); container.querySelectorAll('input[type="color"]').forEach(input => { const key = input.dataset.key; if (tempThemeColors.hasOwnProperty(key)) { input.value = tempThemeColors[key]; } }); UI.createNotification("Cores resetadas para o padrão. Salve para confirmar.", "info"); };
        },
        createSettingsPanel() {
            document.querySelector('.purecloud-script-settings-panel')?.remove(); const panel = document.createElement('div'); panel.className = 'purecloud-script-settings-panel purecloud-script-popup'; if (CONFIG.DARK_MODE) panel.classList.add('gcp-tema-escuro'); let tempHotkeysConfig = { ...CONFIG.HOTKEYS }; let tempThemeColors = JSON.parse(JSON.stringify(CONFIG.THEME_COLORS));

            const iconAnalytics = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="20" x2="18" y2="10"></line><line x1="12" y1="20" x2="12" y2="4"></line><line x1="6" y1="20" x2="6" y2="14"></line></svg>`;
            const iconAtendimentos = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg>`;
            const iconEncerrados = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg>`;
            const iconGeral = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"></circle><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2 2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path></svg>`;
            const iconAparencia = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2.69l5.66 5.66a8 8 0 1 1-11.31 0z"></path></svg>`;
            const iconAtalhos = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="4" width="20" height="16" rx="2" ry="2"></rect><line x1="6" y1="8" x2="6.01" y2="8"></line><line x1="10" y1="8" x2="10.01" y2="8"></line><line x1="14" y1="8" x2="14.01" y2="8"></line><line x1="18" y1="8" x2="18.01" y2="8"></line><line x1="6" y1="12" x2="6.01" y2="12"></line><line x1="10" y1="12" x2="10.01" y2="12"></line><line x1="14" y1="12" x2="14.01" y2="12"></line><line x1="18" y1="12" x2="18.01" y2="12"></line><line x1="10" y1="16" x2="14" y2="16"></line></svg>`;

            panel.innerHTML = `
                <div class="panel-header" style="cursor: move;">
                    <h2>Config. Contador</h2>
                    <div class="panel-header-buttons">
                        <button class="panel-header-btn minimize-btn" title="Minimizar">-</button>
                        <button class="panel-header-btn purecloud-script-popup-close-btn" id="closeSettingsPanelBtn" title="Fechar">X</button>
                    </div>
                </div>
                <div class="purecloud-script-tabs">
                    <button class="purecloud-script-tab-button active" data-tab="analytics">${iconAnalytics} Analytics</button>
                    <button class="purecloud-script-tab-button" data-tab="details">${iconAtendimentos} Atendimentos</button>
                    <button class="purecloud-script-tab-button" data-tab="closed">${iconEncerrados} Encerrados</button>
                    <button class="purecloud-script-tab-button" data-tab="general">${iconGeral} Geral</button>
                    <button class="purecloud-script-tab-button" data-tab="theme">${iconAparencia} Aparência</button>
                    <button class="purecloud-script-tab-button" data-tab="hotkeys">${iconAtalhos} Atalhos</button>
                </div>
                <div class="panel-content">
                    <div class="purecloud-script-tab-content active" data-tab-content="analytics"></div>
                    <div class="purecloud-script-tab-content" data-tab-content="details"></div>
                    <div class="purecloud-script-tab-content" data-tab-content="closed"></div>
                    <div class="purecloud-script-tab-content" data-tab-content="general"></div>
                    <div class="purecloud-script-tab-content" data-tab-content="theme"></div>
                    <div class="purecloud-script-tab-content" data-tab-content="hotkeys"></div>
                </div>
                <div class="panel-footer">
                    <button id="save-settings-btn" class="purecloud-script-button">Salvar e Fechar</button>
                </div>`;

            document.body.appendChild(panel); makeDraggable(panel, panel.querySelector('.panel-header'), 'settingsPanel'); panel.querySelector('#closeSettingsPanelBtn').onclick = () => panel.remove();

            const renderHotkeys = (container) => {
                container.innerHTML = '<h3>Atalhos de Teclado</h3><p>Clique no campo de atalho e pressione a tecla desejada. Use ESC para cancelar a gravação.</p><div id="hotkey-list"></div>';
                const hotkeyList = container.querySelector('#hotkey-list');
                for (const actionKey in tempHotkeysConfig) {
                    const feature = featureDescriptions[actionKey];
                    if (!feature) continue;
                    const hotkeyGroup = document.createElement('div'); hotkeyGroup.className = 'settings-group hotkey-group';
                    hotkeyGroup.innerHTML = `<label for="hotkey-${actionKey}">${feature.title} <span style="display:block; font-size:0.8em; color:var(--purecloud-script-text-secondary); font-weight:normal;">${feature.description}</span></label><input type="text" id="hotkey-${actionKey}" data-action="${actionKey}" value="${tempHotkeysConfig[actionKey]}" readonly class="hotkey-input">`;
                    hotkeyList.appendChild(hotkeyGroup);
                }
                hotkeyList.querySelectorAll('.hotkey-input').forEach(input => {
                    document.removeEventListener('keydown', input._captureHotkey, true);
                    const captureHotkey = (e) => {
                        if (!input.classList.contains('listening')) return;
                        e.preventDefault(); e.stopPropagation();
                        if (e.key === 'Escape') { input.classList.remove('listening'); input.value = tempHotkeysConfig[input.dataset.action]; input.title = ''; document.removeEventListener('keydown', input._captureHotkey, true); return; }
                        const newCombo = getHotkeyCombo(e);
                        if (['Control', 'Shift', 'Alt'].includes(e.key) && newCombo.split('+').length < 2) { return; }
                        const existingAction = Object.keys(tempHotkeysConfig).find(key => tempHotkeysConfig[key] === newCombo && key !== input.dataset.action);
                        if (existingAction) { UI.createNotification(`Conflito! Já está em uso.`, 'error', 5000); input.value = tempHotkeysConfig[input.dataset.action]; }
                        else if (newCombo.split('+').length < 2) { UI.createNotification("Deve conter pelo menos um modificador (Ctrl, Shift, Alt).", 'warn', 4000); input.value = tempHotkeysConfig[input.dataset.action]; }
                        else { tempHotkeysConfig[input.dataset.action] = newCombo; input.value = newCombo; UI.createNotification(`Atalho salvo temporariamente.`, 'info', 3000); }
                        input.classList.remove('listening'); input.title = ''; document.removeEventListener('keydown', input._captureHotkey, true);
                    };
                    input._captureHotkey = captureHotkey;
                    input.addEventListener('click', () => {
                        if (input.classList.contains('listening')) { input.classList.remove('listening'); input.value = tempHotkeysConfig[input.dataset.action]; input.title = ''; document.removeEventListener('keydown', input._captureHotkey, true); return; }
                        hotkeyList.querySelectorAll('.hotkey-input.listening').forEach(i => { i.classList.remove('listening'); i.value = tempHotkeysConfig[i.dataset.action]; i.title = ''; document.removeEventListener('keydown', i._captureHotkey, true); });
                        input.classList.add('listening'); input.value = 'Pressione o atalho...'; input.title = 'Pressione ESC para cancelar'; document.addEventListener('keydown', input._captureHotkey, true);
                    });
                });
            };

            const switchTab = (tabId) => {
                panel.querySelectorAll('.purecloud-script-tab-button').forEach(btn => btn.classList.remove('active')); panel.querySelectorAll('.purecloud-script-tab-content').forEach(content => content.classList.remove('active'));
                const targetTabBtn = panel.querySelector(`.purecloud-script-tab-button[data-tab="${tabId}"]`); const targetTabContent = panel.querySelector(`[data-tab-content="${tabId}"]`);
                if (targetTabBtn) targetTabBtn.classList.add('active'); if (targetTabContent) targetTabContent.classList.add('active');
                if (tabId === 'general') { panel.querySelector('#conversation-target').value = CONFIG.CONVERSATION_TARGET; panel.querySelector('#dark-mode-toggle').checked = CONFIG.DARK_MODE; panel.querySelector('#sound-alerts-toggle').checked = CONFIG.SOUND_ALERTS_ENABLED; panel.querySelector('#inactivity-client-alert-seconds').value = CONFIG.INACTIVITY_CLIENT_ALERT_SECONDS; panel.querySelector('#inactivity-operator-alert-seconds').value = CONFIG.INACTIVITY_OPERATOR_ALERT_SECONDS; panel.querySelector('#long-convo-alert-min').value = CONFIG.LONG_CONVO_ALERT_MIN; } else if (tabId === 'analytics') { UI.renderAnalyticsContent(targetTabContent); } else if (tabId === 'details') { UI.renderDetailsContent(targetTabContent); } else if (tabId === 'closed') { UI.renderClosedDetailsContent(targetTabContent); } else if (tabId === 'hotkeys') { renderHotkeys(targetTabContent); } else if (tabId === 'theme') { UI.renderThemeContent(targetTabContent, tempThemeColors); }
                if (tabId !== 'hotkeys') { panel.querySelectorAll('.hotkey-input.listening').forEach(i => { i.classList.remove('listening'); i.value = tempHotkeysConfig[i.dataset.action]; i.title = ''; document.removeEventListener('keydown', i._captureHotkey, true); }); }
            };
            panel.querySelectorAll('.purecloud-script-tab-button').forEach(btn => { btn.onclick = () => switchTab(btn.dataset.tab); });
            const generalTab = panel.querySelector('[data-tab-content="general"]');
            generalTab.innerHTML = `<div class="settings-group"><label for="conversation-target">Meta Conversas Diárias:</label><input type="number" id="conversation-target" value="${CONFIG.CONVERSATION_TARGET}" min="1"></div><div class="settings-group"><label>Modo Escuro (Cronômetros):</label><label class="switch"><input type="checkbox" id="dark-mode-toggle" ${CONFIG.DARK_MODE ? 'checked' : ''}><span class="slider round"></span></label></div><div class="settings-group"><label>Sons e Confetes 🎉:</label><label class="switch"><input type="checkbox" id="sound-alerts-toggle" ${CONFIG.SOUND_ALERTS_ENABLED ? 'checked' : ''}><span class="slider round"></span></label></div><div class="settings-group"><label for="inactivity-client-alert-seconds">Alerta Inatividade CLIENTE (seg, min 30):</label><input type="number" id="inactivity-client-alert-seconds" value="${CONFIG.INACTIVITY_CLIENT_ALERT_SECONDS}" min="30"></div><div class="settings-group"><label for="inactivity-operator-alert-seconds">Alerta Inatividade OPERADOR (seg, min 10):</label><input type="number" id="inactivity-operator-alert-seconds" value="${CONFIG.INACTIVITY_OPERATOR_ALERT_SECONDS}" min="10"></div><div class="settings-group"><label for="long-convo-alert-min">Alerta Conversa Longa (min, min 5):</label><input type="number" id="long-convo-alert-min" value="${CONFIG.LONG_CONVO_ALERT_MIN}" min="5"></div><div class="settings-group"><h4>Sincronização & Dados:</h4><p style="font-size:0.85em; color:var(--purecloud-script-success-color);">✅ Sincronização automática ativa</p><button id="adjust-tma-btn" class="purecloud-script-button" style="margin-bottom:10px;">Ajustar TMA Manual</button><br><button id="reset-counter-btn" class="purecloud-script-button button-danger">Resetar Contadores/Dados do Dia</button></div>`;
            panel.querySelector('#reset-counter-btn').onclick = () => { if (confirm("Tem certeza? Isso apagará os dados de hoje localmente.")) { analyticsManager.clearAllData(); UI.renderDetailsContent(panel.querySelector('[data-tab-content="details"]')); UI.renderAnalyticsContent(panel.querySelector('[data-tab-content="analytics"]')); UI.renderClosedDetailsContent(panel.querySelector('[data-tab-content="closed"]')); } };
            
            panel.querySelector('#adjust-tma-btn').onclick = () => {
                const currentTma = analyticsManager.calculateStats().tma;
                const newTma = prompt("Insira o novo TMA desejado (formato MM:SS):", currentTma);
                if (!newTma || !/^\d{2}:\d{2}$/.test(newTma)) { if (newTma !== null) UI.createNotification("Formato inválido. Use MM:SS", "error"); return; }
                const parts = newTma.split(':');
                const targetSeconds = parseInt(parts[0], 10) * 60 + parseInt(parts[1], 10);
                
                let data = analyticsManager.getData();
                let completedConvos = data.conversations.filter(c => c.duration >= CONFIG.CHECKMARK_THRESHOLD_MS);
                if (completedConvos.length === 0) { UI.createNotification("Você precisa ter pelo menos 1 atendimento para ajustar o TMA.", "error"); return; }
                
                const currentTotalMs = completedConvos.reduce((sum, conv) => sum + conv.duration, 0);
                const targetTotalMs = (targetSeconds * completedConvos.length) * 1000;
                const diffMs = targetTotalMs - currentTotalMs;
                
                let firstCompletedIndex = data.conversations.findIndex(c => c.duration >= CONFIG.CHECKMARK_THRESHOLD_MS);
                if (firstCompletedIndex !== -1) {
                    data.conversations[firstCompletedIndex].duration += diffMs;
                    if (data.conversations[firstCompletedIndex].duration < 1000) data.conversations[firstCompletedIndex].duration = 1000;
                    analyticsManager.saveData(data);
                    
                    if (document.getElementById('purecloud-script-mini-dashboard')) { document.getElementById('purecloud-script-mini-dashboard')._updateStatsInternal(); }
                    
                    // Atualiza a tela de Analytics imediatamente se estiver aberta
                    const analyticsTab = panel.querySelector('[data-tab-content="analytics"]');
                    if (analyticsTab) UI.renderAnalyticsContent(analyticsTab);
                    
                    UI.createNotification("TMA ajustado com sucesso!", "success");
                }
            };
            panel.querySelector('[data-tab-content="analytics"]').innerHTML = `<div id="analytics-content-main"><button id="load-stats-btn" class="purecloud-script-button">Carregar Estatísticas</button></div>`; panel.querySelector('#load-stats-btn').onclick = () => { UI.renderAnalyticsContent(panel.querySelector('[data-tab-content="analytics"]')); };
            panel.querySelector('#save-settings-btn').onclick = () => {
                CONFIG.CONVERSATION_TARGET = validateConfigValue('CONVERSATION_TARGET', panel.querySelector('#conversation-target').value); CONFIG.INACTIVITY_CLIENT_ALERT_SECONDS = validateConfigValue('INACTIVITY_CLIENT_ALERT_SECONDS', panel.querySelector('#inactivity-client-alert-seconds').value); CONFIG.INACTIVITY_OPERATOR_ALERT_SECONDS = validateConfigValue('INACTIVITY_OPERATOR_ALERT_SECONDS', panel.querySelector('#inactivity-operator-alert-seconds').value); CONFIG.LONG_CONVO_ALERT_MIN = validateConfigValue('LONG_CONVO_ALERT_MIN', panel.querySelector('#long-convo-alert-min').value); CONFIG.SOUND_ALERTS_ENABLED = validateConfigValue('SOUND_ALERTS_ENABLED', panel.querySelector('#sound-alerts-toggle').checked);
                CONFIG.HOTKEYS = validateConfigValue('HOTKEYS', tempHotkeysConfig); CONFIG.THEME_COLORS = validateConfigValue('THEME_COLORS', tempThemeColors);
                saveData(); document.querySelectorAll('.purecloud-script-popup, .purecloud-script-custom-btn, #purecloud-script-notification-container, .injected-bubbles-container').forEach(el => el.classList.toggle('gcp-tema-escuro', CONFIG.DARK_MODE)); UI.createNotification("Configurações salvas!", "success"); panel.remove(); document.getElementById('purecloud-script-injected-style')?.remove(); injectCss(); const toolbarEl = findEl(CONFIG.PURECLOUD_SELECTORS.TOOLBAR); if (toolbarEl) { toolbarEl.dataset.scriptVersion = ''; createToolbarUI(toolbarEl); }
            };
            switchTab('analytics');
        },

        createAgentToolsPanel() {
            if (!CONFIG.TOOLS_VISIBLE) { document.getElementById('purecloud-script-tools-panel')?.remove(); return; }
            let panel = document.getElementById('purecloud-script-tools-panel');
            if (!panel) {
                panel = document.createElement('div');
                panel.id = 'purecloud-script-tools-panel';
                panel.className = 'purecloud-script-popup';

                const iconNotes = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width: 14px; height: 14px;"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>`;
                const iconForm = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width: 14px; height: 14px;"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg>`;
                const iconZap = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width: 14px; height: 14px;"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"></polygon></svg>`;
                const iconLink = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width: 14px; height: 14px;"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.72"></path><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.72-1.72"></path></svg>`;
                const iconBell = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width: 14px; height: 14px;"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"></path><path d="M13.73 21a2 2 0 0 1-3.46 0"></path></svg>`;

                panel.innerHTML = `
                    <div class="panel-header" style="cursor: move;">
                        <h2>🛠️ Ferramentas Rápidas</h2>
                        <div class="panel-header-buttons">
                            <button id="tools-btn-theme" class="panel-header-btn" title="Mudar Tema" style="cursor: pointer; font-size: 16px; margin-right: 8px; background: none; border: none; color: inherit;">🌗</button>
                            <button class="panel-header-btn purecloud-script-popup-close-btn" id="closeToolsBtn" title="Fechar">X</button>
                        </div>
                    </div>
                    <style>
                        #purecloud-script-tools-panel.cc-escurinho { --purecloud-script-bg-primary: #0f172a; --purecloud-script-bg-secondary: #1e293b; --purecloud-script-text-primary: #f8fafc; --purecloud-script-text-secondary: #cbd5e1; --purecloud-script-border-color: #334155; }
                        #purecloud-script-tools-panel.local-light-mode { --purecloud-script-bg-primary: #ffffff; --purecloud-script-bg-secondary: #f1f5f9; --purecloud-script-text-primary: #0f172a; --purecloud-script-text-secondary: #475569; --purecloud-script-border-color: #e2e8f0; }
                    </style>
                    <div class="purecloud-script-tabs" style="font-size: 0.85em; padding: 0 5px;">
                        <button class="purecloud-script-tab-button active" data-tab="notas">${iconNotes} Notas</button>
                        <button class="purecloud-script-tab-button" data-tab="respostas">${iconZap} Respostas</button>
                        <button class="purecloud-script-tab-button" data-tab="lembretes">${iconBell} Lembretes</button>
                        <button class="purecloud-script-tab-button" data-tab="links">${iconLink} Links</button>
                    </div>
                    <div class="panel-content" style="padding: 15px;">
                        <div class="purecloud-script-tab-content active" data-tab-content="notas">
                            <textarea id="tools-notepad" style="width:100%; height:200px; resize:none; border-radius:8px; padding:10px; background:var(--purecloud-script-bg-primary); color:var(--purecloud-script-text-primary); border:1px solid var(--purecloud-script-border-color);" placeholder="Digite suas anotações temporárias aqui... Salva automaticamente!"></textarea>
                        </div>
                        
                        <div class="purecloud-script-tab-content" data-tab-content="respostas">
                            <p style="font-size: 0.8em; color:var(--purecloud-script-text-secondary); margin-bottom: 10px;">Dica: Digite <strong>/oi</strong> (com espaço) no chat para usar os atalhos mágicos.</p>
                            <div id="quick-replies-list" style="display:flex; flex-direction:column; gap:8px;"></div>
                        </div>

                        <div class="purecloud-script-tab-content" data-tab-content="lembretes">
                            <p style="font-size: 0.85em; color:var(--purecloud-script-text-primary); margin-bottom: 15px;">O cliente pediu um minuto? Defina um alerta para não esquecer de retornar ao chat.</p>
                            <div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 10px;">
                                <button class="purecloud-script-button btn-lembrete" data-time="1">1 Min</button>
                                <button class="purecloud-script-button btn-lembrete" data-time="3">3 Min</button>
                                <button class="purecloud-script-button btn-lembrete" data-time="5">5 Min</button>
                            </div>
                        </div>

                        <div class="purecloud-script-tab-content" data-tab-content="links">
                            <div id="useful-links-list" style="display:flex; flex-direction:column; gap:8px;"></div>
                        </div>
                    </div>
                `;
                document.body.appendChild(panel); makeDraggable(panel, panel.querySelector('.panel-header'), 'toolsPanel');
                panel.querySelector('#closeToolsBtn').onclick = () => { CONFIG.TOOLS_VISIBLE = false; saveData(); panel.remove(); };

                const themeBtnTools = panel.querySelector('#tools-btn-theme');
                const savedThemeTools = localStorage.getItem('TOOLS_THEME');
                if (savedThemeTools === 'light') {
                    panel.classList.add('local-light-mode');
                    themeBtnTools.innerText = '☀️';
                } else if (savedThemeTools === 'dark') {
                    panel.classList.add('cc-escurinho');
                    themeBtnTools.innerText = '🌗';
                }
                themeBtnTools.onclick = () => {
                    const isLight = panel.classList.contains('local-light-mode');
                    if (isLight) {
                        panel.classList.remove('local-light-mode');
                        panel.classList.add('cc-escurinho');
                        localStorage.setItem('TOOLS_THEME', 'dark');
                        themeBtnTools.innerText = '🌗';
                    } else {
                        panel.classList.remove('cc-escurinho');
                        panel.classList.add('local-light-mode');
                        localStorage.setItem('TOOLS_THEME', 'light');
                        themeBtnTools.innerText = '☀️';
                    }
                };

                const switchToolsTab = (tabId) => {
                    panel.querySelectorAll('.purecloud-script-tab-button').forEach(btn => btn.classList.remove('active'));
                    panel.querySelectorAll('.purecloud-script-tab-content').forEach(content => content.classList.remove('active'));
                    panel.querySelector(`.purecloud-script-tab-button[data-tab="${tabId}"]`)?.classList.add('active');
                    panel.querySelector(`[data-tab-content="${tabId}"]`)?.classList.add('active');
                };
                panel.querySelectorAll('.purecloud-script-tab-button').forEach(btn => { btn.onclick = () => switchToolsTab(btn.dataset.tab); });

                const notepad = panel.querySelector('#tools-notepad'); notepad.value = localStorage.getItem('purecloudScript_notepad') || ''; notepad.addEventListener('input', (e) => { localStorage.setItem('purecloudScript_notepad', e.target.value); });

                // Populando Respostas Rápidas (Padrão)
                const qrList = panel.querySelector('#quick-replies-list');

                CONFIG.QUICK_REPLIES.forEach(qr => {
                    // Preenche a aba Respostas visuais (Lista)
                    const btn = document.createElement('button'); btn.className = 'purecloud-script-button';
                    btn.style.cssText = "text-align:left; padding: 8px 12px; background:var(--purecloud-script-bg-secondary); color:var(--purecloud-script-text-primary); border:1px solid var(--purecloud-script-border-color); box-shadow:none; position:relative;";
                    btn.innerHTML = `<strong>${escapeHTML(qr.title)}</strong> <span style="font-size:0.8em; color:var(--purecloud-script-accent-color); float:right; font-weight:bold;">${escapeHTML(qr.shortcut || '')}</span> <span style="display:block; font-size:0.8em; font-weight:normal; color:var(--purecloud-script-text-secondary); margin-top:4px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${escapeHTML(qr.text)}</span>`;
                    btn.onmouseover = () => { btn.style.borderColor = 'var(--purecloud-script-accent-color)'; }; btn.onmouseout = () => { btn.style.borderColor = 'var(--purecloud-script-border-color)'; };

                    const dispatchSnippet = async () => {
                        const chatInputField = getChatInput();
                        const textToInject = templateProcessor.process(qr.text);
                        if (chatInputField) {
                            chatInputField.value = textToInject; chatInputField.dispatchEvent(new Event('input', { bubbles: true })); chatInputField.focus();
                            UI.createNotification("Resposta inserida no chat!", "success");
                        } else {
                            if (await copyTextToClipboard(textToInject)) { UI.createNotification("Resposta copiada para o mouse!", "info"); }
                        }
                    };
                    btn.onclick = dispatchSnippet;
                    qrList.appendChild(btn);
                });

                // Populando Links Úteis
                const linksList = panel.querySelector('#useful-links-list');
                USEFUL_LINKS.forEach(link => {
                    const btn = document.createElement('button'); btn.className = 'purecloud-script-button';
                    btn.style.cssText = `text-align:center; padding: 10px; background:${link.color}; color:#fff; border:none; margin-bottom: 5px; font-weight: bold;`;
                    btn.textContent = link.title;
                    btn.onclick = () => window.open(link.url, '_blank');
                    linksList.appendChild(btn);
                });

                // Lógica dos Lembretes
                panel.querySelectorAll('.btn-lembrete').forEach(btn => {
                    btn.onclick = (e) => {
                        const minutes = parseInt(e.target.dataset.time);
                        const selectedConvEl = findEl(CONFIG.PURECLOUD_SELECTORS.SELECTED_INTERACTION_GROUP);
                        let { participantName } = documentExtractor.getNameAndNumber(selectedConvEl);
                        if (!participantName || participantName === 'N/A') participantName = 'o cliente';

                        UI.createNotification(`Alarme configurado! Avisarei sobre ${participantName} em ${minutes} minuto(s).`, "success");

                        setTimeout(() => {
                            effectsManager.playBeep('reminder');
                            UI.createNotification(`⏰ HORA DE RETORNAR!\nVerifique o chat do cliente: ${participantName}`, "error", 15000);
                        }, minutes * 60000);
                    };
                });

            }
        },

        createMiniDashboard() {
            if (!CONFIG.MINI_DASHBOARD_VISIBLE) { const dashboard = document.getElementById('purecloud-script-mini-dashboard'); if (dashboard && dashboard._updateInterval) { clearInterval(dashboard._updateInterval); } dashboard?.remove(); return; }
            let dashboard = document.getElementById('purecloud-script-mini-dashboard');
            if (!dashboard) {
                dashboard = document.createElement('div'); dashboard.id = 'purecloud-script-mini-dashboard'; dashboard.className = 'purecloud-script-popup'; document.body.appendChild(dashboard);

                const iconCheck = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="stat-icon" style="width: 14px; height: 14px; color: var(--purecloud-script-accent-color);"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg>`;
                const iconClock = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="stat-icon" style="width: 14px; height: 14px; color: var(--purecloud-script-accent-color);"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>`;
                const iconZap = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="stat-icon" style="width: 14px; height: 14px; color: var(--purecloud-script-accent-color);"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"></polygon></svg>`;
                const iconBaloon = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="stat-icon" style="width: 14px; height: 14px; color: var(--purecloud-script-accent-color);"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path></svg>`;
                const iconTarget = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width: 14px; height: 14px; color: var(--purecloud-script-accent-color);"><circle cx="12" cy="12" r="10"></circle><circle cx="12" cy="12" r="6"></circle><circle cx="12" cy="12" r="2"></circle></svg>`;
                const iconTools = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width: 14px; height: 14px;"><path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"></path></svg>`;

                dashboard.innerHTML = `
                    <div class="mini-dashboard-header">
                        <div class="counter-display">${iconTarget}<span class="counter-text">--/--</span><div class="progress-bar-container-compact"><div class="progress-bar-compact"></div></div></div>
                        <div class="mini-dashboard-controls">
                            <button id="mini-dashboard-btn-theme" class="compact-btn" title="Mudar Tema" style="font-size: 14px; background: none; border: none; color: inherit; padding: 0 4px; cursor: pointer;">🌗</button>
                            <button id="mini-dashboard-tools-btn" class="compact-btn" title="Ferramentas do Agente">${iconTools}</button>
                            <button id="mini-dashboard-adjust-attended-btn" class="compact-btn adjust-btn" title="Ajustar Contagem"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width: 14px; height: 14px;"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg></button>
                            <button class="compact-btn toggle-expand-btn" title="Expandir/Recolher"><svg class="expand-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width: 14px; height: 14px;"><path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3"></path></svg><svg class="collapse-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width: 14px; height: 14px; display: none;"><path d="M8 3v3a2 2 0 0 1-2 2H3m18 0h-3a2 2 0 0 1-2-2V3m0 18v-3a2 2 0 0 1 2-2h3M3 16h3a2 2 0 0 1 2 2v3"></path></svg></button>
                            <button class="compact-btn close-btn" id="closeMiniDashboardBtn" title="Fechar">X</button>
                        </div>
                    </div>
                    <div class="mini-dashboard-content">
                        <div class="stats-grid-original mini-dashboard-stats-grid">
                            <div class="stat-item-original"><span class="stat-label">${iconCheck} Únicas</span><strong id="dashboard-conv-count">--</strong></div>
                            <div class="stat-item-original"><span class="stat-label">${iconClock} TMA</span><strong id="dashboard-tma">--:--</strong></div>
                            <div class="stat-item-original"><span class="stat-label">${iconZap} TME</span><strong id="dashboard-tme">--:--</strong></div>
                            <div class="stat-item-original" title="Cliques no botão 'Mensagens de Término' (Balão)"><span class="stat-label">${iconBaloon} Balão</span><strong id="dashboard-balao-clicks">--</strong></div>
                        </div>
                    </div>
                `;
                const dashboardHeader = dashboard.querySelector('.mini-dashboard-header'); makeDraggable(dashboard, dashboardHeader, 'miniDashboard');

                const themeBtnDash = dashboard.querySelector('#mini-dashboard-btn-theme');
                const savedThemeDash = localStorage.getItem('DASHBOARD_THEME');
                if (savedThemeDash === 'light') {
                    dashboard.classList.add('local-light-mode');
                    themeBtnDash.innerText = '☀️';
                } else if (savedThemeDash === 'dark') {
                    dashboard.classList.add('cc-escurinho');
                    themeBtnDash.innerText = '🌗';
                }
                themeBtnDash.onclick = () => {
                    const isLight = dashboard.classList.contains('local-light-mode');
                    if (isLight) {
                        dashboard.classList.remove('local-light-mode');
                        dashboard.classList.add('cc-escurinho');
                        localStorage.setItem('DASHBOARD_THEME', 'dark');
                        themeBtnDash.innerText = '🌗';
                    } else {
                        dashboard.classList.remove('cc-escurinho');
                        dashboard.classList.add('local-light-mode');
                        localStorage.setItem('DASHBOARD_THEME', 'light');
                        themeBtnDash.innerText = '☀️';
                    }
                };

                // Estilos locais inseridos diretamente no documento se já não existirem
                if (!document.getElementById('dash-local-styles')) {
                    const st = document.createElement('style'); st.id = 'dash-local-styles';
                    st.innerHTML = `
                        #purecloud-script-mini-dashboard.cc-escurinho { --purecloud-script-bg-primary: #0f172a; --purecloud-script-bg-secondary: #1e293b; --purecloud-script-text-primary: #f8fafc; --purecloud-script-text-secondary: #cbd5e1; --purecloud-script-border-color: #334155; }
                        #purecloud-script-mini-dashboard.local-light-mode { --purecloud-script-bg-primary: #ffffff; --purecloud-script-bg-secondary: #f1f5f9; --purecloud-script-text-primary: #0f172a; --purecloud-script-text-secondary: #475569; --purecloud-script-border-color: #e2e8f0; }
                    `;
                    document.head.appendChild(st);
                }

                dashboard._lastRenderedStats = {};
                dashboard._updateStatsInternal = () => {
                    if (!dashboard.isConnected) { clearInterval(dashboard._updateInterval); return; }
                    const stats = analyticsManager.calculateStats();
                    const progress = (stats.count / CONFIG.CONVERSATION_TARGET) * 100;

                    const counterTextEl = dashboard.querySelector('.counter-text');
                    const newCounterText = `${stats.count}/${CONFIG.CONVERSATION_TARGET}`;
                    if (counterTextEl && dashboard._lastRenderedStats.counterText !== newCounterText) {
                        counterTextEl.textContent = newCounterText;
                        dashboard._lastRenderedStats.counterText = newCounterText;
                    }

                    const progressBarEl = dashboard.querySelector('.progress-bar-compact');
                    const newProgressWidth = `${Math.min(100, progress)}%`;
                    if (progressBarEl && dashboard._lastRenderedStats.progressWidth !== newProgressWidth) {
                        progressBarEl.style.width = newProgressWidth;
                        dashboard._lastRenderedStats.progressWidth = newProgressWidth;
                    }

                    if (CONFIG.MINI_DASHBOARD_MAXIMIZED) {
                        const currentTmaSeconds = Math.floor(stats.tma.split(':').reduce((acc, time) => (60 * acc) + +time, 0));
                        const targetTmaSeconds = CONFIG.LONG_CONVO_ALERT_MIN * 60;
                        let tmaIndicator = currentTmaSeconds > 0 ? (currentTmaSeconds < targetTmaSeconds * 0.9 ? '▲' : (currentTmaSeconds > targetTmaSeconds * 1.1 ? '▼' : '●')) : '';

                        const convCountElement = dashboard.querySelector('#dashboard-conv-count');
                        if (convCountElement && dashboard._lastRenderedStats.convCount !== stats.count) {
                            convCountElement.textContent = stats.count;
                            dashboard._lastRenderedStats.convCount = stats.count;
                        }

                        const tmaElement = dashboard.querySelector('#dashboard-tma');
                        const tmaHTML = `${stats.tma} <span style="font-size: 0.8em; color: ${tmaIndicator === '▲' ? 'var(--purecloud-script-success-color)' : tmaIndicator === '▼' ? 'var(--purecloud-script-error-color)' : 'var(--purecloud-script-warn-color)'};">${tmaIndicator}</span>`;
                        if (tmaElement && dashboard._lastRenderedStats.tmaHTML !== tmaHTML) {
                            tmaElement.innerHTML = tmaHTML;
                            dashboard._lastRenderedStats.tmaHTML = tmaHTML;
                        }

                        const tmeElement = dashboard.querySelector('#dashboard-tme');
                        if (tmeElement && dashboard._lastRenderedStats.tme !== stats.tme) {
                            tmeElement.textContent = stats.tme;
                            dashboard._lastRenderedStats.tme = stats.tme;
                        }

                        const baloonClicksElement = dashboard.querySelector('#dashboard-balao-clicks');
                        if (baloonClicksElement && dashboard._lastRenderedStats.baloonClicks !== stats.baloonClicks) {
                            baloonClicksElement.textContent = stats.baloonClicks;
                            dashboard._lastRenderedStats.baloonClicks = stats.baloonClicks;
                        }
                    }
                };

                const toggleButton = dashboard.querySelector('.toggle-expand-btn'); const expandIcon = dashboard.querySelector('.expand-icon'); const collapseIcon = dashboard.querySelector('.collapse-icon');
                const toggleFloatingDashboard = (forceState = null) => {
                    const shouldExpand = forceState !== null ? forceState : !CONFIG.MINI_DASHBOARD_MAXIMIZED;
                    CONFIG.MINI_DASHBOARD_MAXIMIZED = shouldExpand;
                    dashboard.classList.toggle('expanded', shouldExpand); dashboard.classList.toggle('collapsed', !shouldExpand);
                    expandIcon.style.display = shouldExpand ? 'none' : 'inline-block'; collapseIcon.style.display = shouldExpand ? 'inline-block' : 'none';
                    toggleButton.title = shouldExpand ? "Recolher" : "Expandir";

                    if (!shouldExpand) {
                        dashboard.style.width = ''; dashboard.style.height = ''; dashboard.style.resize = 'none';
                    } else {
                        const savedPosition = CONFIG.POPUP_POSITIONS['miniDashboard'];
                        if (savedPosition && savedPosition.top && savedPosition.top !== 'auto') {
                            dashboard.style.top = savedPosition.top; dashboard.style.left = savedPosition.left; dashboard.style.bottom = 'auto'; dashboard.style.right = 'auto'; dashboard.style.transform = 'none';
                        } else { dashboard.style.top = '50%'; dashboard.style.left = '50%'; dashboard.style.transform = 'translate(-50%, -50%)'; dashboard.style.bottom = 'auto'; dashboard.style.right = 'auto'; }
                        dashboard.style.width = '320px'; dashboard.style.height = 'auto'; dashboard.style.resize = 'none';
                    }
                    saveData(); dashboard._updateStatsInternal();
                };

                dashboard._toggleFloatingDashboard = toggleFloatingDashboard;
                dashboardHeader.onclick = (e) => { if (e.target.closest('.compact-btn, #mini-dashboard-adjust-attended-btn')) { return; } const wasDragging = dashboard.dataset.isDragging === 'true'; dashboard.dataset.isDragging = 'false'; if (!wasDragging && !CONFIG.MINI_DASHBOARD_MAXIMIZED) { toggleFloatingDashboard(true); } };
                toggleButton.onclick = (e) => { e.stopPropagation(); toggleFloatingDashboard(); };
                dashboard.querySelector('.close-btn').onclick = () => { clearInterval(dashboard._updateInterval); dashboard.remove(); CONFIG.MINI_DASHBOARD_VISIBLE = false; saveData(); };

                dashboard.querySelector('#mini-dashboard-tools-btn').onclick = (e) => {
                    e.stopPropagation(); CONFIG.TOOLS_VISIBLE = !CONFIG.TOOLS_VISIBLE; saveData(); UI.createAgentToolsPanel();
                };

                dashboard.querySelector('#mini-dashboard-adjust-attended-btn').onclick = (e) => {
                    e.stopPropagation(); const currentAttendedCount = analyticsManager.calculateStats().count; const newCount = prompt("Insira o novo número de conversas atendidas:", currentAttendedCount);
                    if (newCount !== null && !isNaN(newCount)) {
                        const parsedNewCount = parseInt(newCount, 10); if (parsedNewCount < 0) { UI.createNotification("O número deve ser positivo.", 'error', 4000); return; }
                        let data = analyticsManager.getData(); const currentUniqueCount = analyticsManager.calculateStats().count;
                        if (parsedNewCount < currentUniqueCount) { UI.createNotification("Use 'Resetar Contadores' nas Configurações para reduzir.", "warn", 7000); return; }
                        if (parsedNewCount > currentUniqueCount) {
                            const diff = parsedNewCount - currentUniqueCount;
                            for (let i = 0; i < diff; i++) { data.conversations.push({ timestamp: Date.now() - (i * 1000), duration: CONFIG.CHECKMARK_THRESHOLD_MS + 5000, activeDuration: CONFIG.CHECKMARK_THRESHOLD_MS + 2000, participantName: `Ajuste Manual ${Date.now()}`, phoneNumber: `000000000${i}`, isRecurrence: false, endedByAgent: 'AVALIACAO', interactionUrl: 'Ajuste Manual' }); }
                            analyticsManager.saveData(data);
                        }
                        dashboard._updateStatsInternal();
                    }
                };
                toggleFloatingDashboard(CONFIG.MINI_DASHBOARD_MAXIMIZED);
                if (dashboard._updateInterval) { clearInterval(dashboard._updateInterval); }
                dashboard._updateInterval = setInterval(dashboard._updateStatsInternal, 5000);
                dashboard._updateStatsInternal();
            } else {
                if (dashboard._updateStatsInternal) { dashboard._updateStatsInternal(); }
            }
        },
    };

    const defaultTheme = { bgPrimary: '#ffffff', bgSecondary: '#f8fafc', textPrimary: '#1e293b', textSecondary: '#64748b', borderColor: '#e2e8f0', accent: '#6366f1', accentText: '#ffffff', success: '#10b981', error: '#ef4444', warn: '#f59e0b', info: '#3b82f6', timerBg: '#f8fafc', timerNormalText: '#1e293b', timerActiveText: '#6366f1', timerPausedText: '#f59e0b', timerInactiveClientText: '#ef4444', timerCompletedBg: '#10b981', miniDashboardProgress: '#10b981' };
    let theme;
    try {
        theme = JSON.parse(localStorage.getItem('gcp_themeColors_v2')) || JSON.parse(localStorage.getItem('timerColors')) || defaultTheme;
    } catch (e) { theme = defaultTheme; }

    const CONFIG_CSS = {
        VARIAVEIS: `
            :root { 
                --purecloud-script-bg-primary: ${theme.bgPrimary}; --purecloud-script-bg-secondary: ${theme.bgSecondary}
            .gcp-tema-escuro { 
                --purecloud-script-bg-primary: #121212 !important; 
                --purecloud-script-bg-secondary: #1e1e1e !important; 
                --purecloud-script-text-primary: #e2e8f0 !important; 
                --purecloud-script-text-secondary: #94a3b8 !important; 
                --purecloud-script-border-color: #334155 !important; 
                --purecloud-script-header-bg: #0f172a !important; 
                --purecloud-script-bubble-bg-normal: #1e1e1e !important; 
                --purecloud-script-bubble-text-normal: #ffffff !important; 
                --purecloud-script-shadow-color: rgba(0,0,0,0.8) !important;
            }
            ; --purecloud-script-text-primary: ${theme.textPrimary}; --purecloud-script-text-secondary: ${theme.textSecondary}; --purecloud-script-border-color: ${theme.borderColor}; --purecloud-script-accent-color: ${theme.accent}; --purecloud-script-accent-text: ${theme.accentText}; --purecloud-script-success-color: ${theme.success}; --purecloud-script-error-color: ${theme.error}; --purecloud-script-warn-color: ${theme.warn}; --purecloud-script-info-color: ${theme.info}; --purecloud-script-bubble-bg-normal: ${theme.timerBg}; --purecloud-script-bubble-bg-selected: ${theme.accent}; --purecloud-script-bubble-text-normal: ${theme.timerNormalText}; --purecloud-script-bubble-text-active: ${theme.timerActiveText}; --purecloud-script-bubble-text-paused: ${theme.timerPausedText}; --purecloud-script-bubble-text-timer-inactive: ${theme.timerInactiveClientText}; --purecloud-script-shadow-color: rgba(0,0,0,0.08); --mini-dashboard-progress-color: ${theme.miniDashboardProgress}; --font-family-modern: 'Inter', 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
            }
            .hide-scrollbar::-webkit-scrollbar { display: none; }
            .hide-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
        `,
        ZEN_MODE: `
            body.sys-zen-active { background-color: #121212 !important; }
            body.sys-zen-active .sidebar, body.sys-zen-active .navbar, body.sys-zen-active .topbar, body.sys-zen-active header { opacity: 0.15; pointer-events: none; transition: opacity 0.4s ease; }
            body.sys-zen-active .interaction-list { opacity: 0.15; transition: opacity 0.4s ease; }
            body.sys-zen-active .interaction-list:hover { opacity: 1; }
            body.sys-zen-active .interaction-content-wrapper { box-shadow: 0 0 0 9999px rgba(0,0,0,0.85); z-index: 9999; position: relative; border-radius: 8px; }
        `,
        ANIMATIONS: `
            @keyframes alertPulseGlow { 0% { box-shadow: 0 0 0 0 rgba(251, 191, 36, 0.6); transform: scale(1); } 50% { transform: scale(1.02); } 70% { box-shadow: 0 0 0 6px rgba(251, 191, 36, 0); } 100% { box-shadow: 0 0 0 0 rgba(251, 191, 36, 0); transform: scale(1); } }
            @keyframes warningPulseGlow { 0% { box-shadow: 0 0 0 0 rgba(234, 179, 8, 0.7); } 70% { box-shadow: 0 0 0 8px rgba(234, 179, 8, 0); } 100% { box-shadow: 0 0 0 0 rgba(234, 179, 8, 0); } }
            .warning-pulse-alert { animation: warningPulseGlow 1.5s infinite !important; border-color: var(--purecloud-script-warn-color) !important; color: #000 !important; background-color: var(--purecloud-script-warn-color) !important; }
            @keyframes fadeInRight { from { opacity: 0; transform: translateX(120%); } to { opacity: 0.98; transform: translateX(0); } } 
            @keyframes fadeEffect { from {opacity: 0; transform: translateY(5px);} to {opacity: 1; transform: translateY(0);} }
        `,
        SCROLLBAR: `
            .purecloud-script-popup, .purecloud-script-notification, .injected-element { font-family: var(--font-family-modern); }
            .panel-content, .mini-dashboard-content, .details-table-wrapper, .chart-scroll-container, .hide-scrollbar { scrollbar-width: none; -ms-overflow-style: none; }
            .panel-content::-webkit-scrollbar, .mini-dashboard-content::-webkit-scrollbar, .details-table-wrapper::-webkit-scrollbar, .chart-scroll-container::-webkit-scrollbar, .hide-scrollbar::-webkit-scrollbar { display: none; }
            textarea::-webkit-scrollbar { width: 6px; height: 6px; }
            textarea::-webkit-scrollbar-track { background: transparent; }
            textarea::-webkit-scrollbar-thumb { background-color: var(--purecloud-script-border-color); border-radius: 10px; }
        `,
        BUTTONS: `
            .purecloud-script-button { background-color: var(--purecloud-script-accent-color); color: var(--purecloud-script-accent-text); border: none; padding: 10px 18px; border-radius: 8px; cursor: pointer; font-size: 0.9em; font-weight: 600; letter-spacing: 0.3px; transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1); box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1); } 
            .purecloud-script-button:hover { transform: translateY(-2px); box-shadow: 0 6px 12px rgba(0, 0, 0, 0.15); filter: brightness(1.05); }
            .purecloud-script-button:active { transform: translateY(0); box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
            .purecloud-script-button.button-danger { background-color: var(--purecloud-script-error-color); color: #fff; }
        `,
        NOTIFICATIONS: `
            .purecloud-script-notification { position: relative; z-index: 10005; width: 320px; padding: 16px 20px; margin: 12px; border-radius: 12px; box-shadow: 0 10px 25px var(--purecloud-script-shadow-color); font-size: 0.9em; font-weight: 500; backdrop-filter: blur(10px); -webkit-backdrop-filter: blur(10px); border: 1px solid rgba(255,255,255,0.1); opacity: 0.98; transition: opacity 0.3s, transform 0.3s; animation: fadeInRight 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275); background-color: var(--purecloud-script-bg-secondary); color: var(--purecloud-script-text-primary); } 
            #purecloud-script-notification-container { position: fixed; top: 15px; right: 15px; z-index: 10004; } 
            .purecloud-script-notification-success { border-left: 4px solid var(--purecloud-script-success-color); } .purecloud-script-notification-error { border-left: 4px solid var(--purecloud-script-error-color); } .purecloud-script-notification-info { border-left: 4px solid var(--purecloud-script-info-color); } .purecloud-script-notification-warn { border-left: 4px solid var(--purecloud-script-warn-color); }
        `,
        BUBBLES: `
            .injected-element { font-weight: 600; font-size: 11px !important; padding: 2px 8px !important; border-radius: 12px; display: flex; align-items: center; justify-content: center; height: 22px; line-height: 1; box-shadow: 0 2px 5px rgba(0,0,0,0.05); border: 1px solid rgba(0,0,0,0.05) !important; transition: all 0.3s ease; white-space: nowrap; background-color: var(--purecloud-script-bubble-bg-normal) !important; color: var(--purecloud-script-bubble-text-normal) !important; }
            .injected-bubbles-container { position: absolute; bottom: 6px; left: 12px; display: flex; gap: 6px; z-index: 10; pointer-events: none; user-select: none; } 
            .interaction-content-wrapper, .interaction-content { position: relative !important; padding-bottom: 28px !important; }
            .injected-conversation-number { min-width: 22px; } .injected-interaction-icon { font-size: 11px !important; }
            .injected-bubbles-container:has(.injected-conversation-timer.normal-timer) .injected-element { color: var(--purecloud-script-bubble-text-active) !important; }
            .injected-bubbles-container:has(.injected-conversation-timer.paused-alert) .injected-element { color: var(--purecloud-script-bubble-text-paused) !important; }
            .injected-bubbles-container:has(.injected-conversation-timer.inactive-client-alert) .injected-element, .injected-bubbles-container:has(.injected-conversation-timer.inactive-operator-alert) .injected-element { color: var(--purecloud-script-bubble-text-timer-inactive) !important; border-color: var(--purecloud-script-bubble-text-timer-inactive) !important; animation: alertPulseGlow 1.5s infinite ease-out; }
            .injected-checkmark { background-color: var(--purecloud-script-success-color) !important; color: #fff !important; }
            .injected-recurrence-icon { background-color: var(--purecloud-script-warn-color) !important; color: #000 !important; } 
            /* Regra removida para evitar o "bug do cronômetro roxo" ao selecionar a conversa */
            /* div.interaction-group.is-selected .injected-element { background-color: var(--purecloud-script-bubble-bg-selected) !important; color: var(--purecloud-script-accent-text) !important; border-color: rgba(255,255,255,0.2) !important; box-shadow: 0 4px 10px rgba(0,0,0,0.15); } */
        `,
        PANELS: `
            /* Paleta Customizada por Módulo */
            .purecloud-script-settings-panel { --purecloud-script-header-bg: #475569; --purecloud-script-header-text: #ffffff; }
            #purecloud-script-tools-panel { --purecloud-script-header-bg: #7c3aed; --purecloud-script-header-text: #ffffff; }
            
            .purecloud-script-popup { position: fixed; background: var(--purecloud-script-bg-primary); border-radius: 16px; box-shadow: 0 16px 40px var(--purecloud-script-shadow-color); z-index: 10002; display: flex; flex-direction: column; border: 1px solid var(--purecloud-script-border-color); transition: all 0.3s cubic-bezier(0.25, 0.8, 0.25, 1); margin: 0; overflow: hidden; } 
            .purecloud-script-settings-panel { resize: none; width: 90%; max-width: 850px; min-height: 550px; height: 85vh; } 
            #purecloud-script-tools-panel { width: 400px; height: auto; max-height: 85vh; resize: both; min-width: 280px; min-height: 250px; }
            .panel-header { cursor: move; background: var(--purecloud-script-header-bg, var(--purecloud-script-bg-secondary)); padding: 16px 20px; border-bottom: 1px solid var(--purecloud-script-border-color); display: flex; justify-content: space-between; align-items: center; } 
            .panel-header h2, .panel-header h3 { margin: 0; color: var(--purecloud-script-header-text, var(--purecloud-script-text-primary)); font-size: 16px; font-weight: 700; letter-spacing: -0.5px; } 
            .panel-header-buttons { display: flex; gap: 8px; } 
            .panel-header-btn { background: transparent; border: 1px solid rgba(255,255,255,0.2); border-radius: 50%; width: 28px; height: 28px; display: flex; align-items: center; justify-content: center; font-size: 0.9em; cursor: pointer; color: var(--purecloud-script-header-text, var(--purecloud-script-text-secondary)); transition: all 0.2s; } 
            .panel-header-btn:hover { color: #fff; background: rgba(255,255,255,0.1); transform: scale(1.1); } 
            .panel-content { padding: 24px; overflow-y: auto; flex-grow: 1; background: var(--purecloud-script-bg-primary); color: var(--purecloud-script-text-primary); } 
            .panel-footer { padding: 16px 24px; background: var(--purecloud-script-bg-secondary); border-top: 1px solid var(--purecloud-script-border-color); text-align: right; }
            .panel-content h4 { color: var(--purecloud-script-text-primary); font-size: 1.1em; margin-top: 15px; margin-bottom: 10px; border-bottom: 1px solid var(--purecloud-script-border-color); padding-bottom: 5px; }
            .purecloud-script-tabs { display: flex; flex-wrap: wrap; background: var(--purecloud-script-bg-secondary); border-bottom: 1px solid var(--purecloud-script-border-color); padding: 0 10px; overflow-x: hidden; } 
            .purecloud-script-tab-button { background-color: transparent; color: var(--purecloud-script-text-secondary); border: none; padding: 10px 14px; cursor: pointer; transition: all 0.2s ease; font-size: 0.95em; font-weight: 600; position: relative; display: flex; align-items: center; gap: 6px; white-space: nowrap; } 
            .purecloud-script-tab-button svg { width: 16px; height: 16px; transition: stroke 0.2s ease; }
            .purecloud-script-tab-button::after { content: ''; position: absolute; bottom: 0; left: 50%; transform: translateX(-50%); width: 0; height: 3px; background-color: var(--purecloud-script-accent-color); transition: width 0.3s ease; border-radius: 3px 3px 0 0; }
            .purecloud-script-tab-button.active { color: var(--purecloud-script-accent-color); } .purecloud-script-tab-button.active::after { width: 80%; }
            .purecloud-script-tab-button:hover:not(.active) { color: var(--purecloud-script-text-primary); } 
            .purecloud-script-tab-content { display: none; animation: fadeEffect 0.4s; flex-direction: column; flex-grow: 1; } 
            .purecloud-script-tab-content.active { display: flex; }
            .settings-group { margin-bottom: 24px; display: flex; flex-direction: column; } 
            .settings-group label { color: var(--purecloud-script-text-primary); font-size: 0.95em; margin-bottom: 8px; font-weight: 600; } 
            .settings-group input[type="number"], .settings-group input[type="text"], textarea { background: var(--purecloud-script-bg-primary); color: var(--purecloud-script-text-primary); border: 1px solid var(--purecloud-script-border-color); padding: 10px 14px; border-radius: 8px; transition: all 0.2s; width: 100%; box-sizing: border-box; font-size: 0.95em; font-family: inherit;} 
            .settings-group input:focus, textarea:focus { border-color: var(--purecloud-script-accent-color); outline: none; box-shadow: 0 0 0 3px rgba(99, 102, 241, 0.2); }
        `,
        TABLES_COLORS: `
            .details-table { width: 100%; border-collapse: collapse; margin-top: 10px; font-size: 0.85em; } 
            .details-table th, .details-table td { padding: 10px 12px; text-align: left; border-bottom: 1px solid var(--purecloud-script-border-color); } 
            .details-table th { background-color: var(--purecloud-script-bg-secondary); color: var(--purecloud-script-text-primary); font-weight: 600; } 
            .details-table tr:hover { background-color: rgba(0, 0, 0, 0.02); } 
            .recurrence-tag, .first-tag { padding: 3px 8px; border-radius: 4px; font-weight: 600; font-size: 0.8em; display: inline-block; } 
            .recurrence-tag { background-color: var(--purecloud-script-warn-color); color: #000; } .first-tag { background-color: var(--purecloud-script-success-color); color: #fff; } 
            .is-recurrence-row { opacity: 0.85; } 
            .details-table th.col-num, .details-table td.col-num { text-align: right; width: 40px; font-weight: bold; color: var(--purecloud-script-text-secondary); } 
            .details-table th.col-type, .details-table td.col-type { text-align: center; width: 40px; font-size: 1.2em; }
            .theme-section { margin-bottom: 24px; } .theme-section h4 { margin-bottom: 15px; padding-bottom: 8px; border-bottom: 1px solid var(--purecloud-script-border-color); color: var(--purecloud-script-text-primary); } 
            .settings-group.color-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 15px; } 
            .color-picker-group { display: flex; align-items: center; justify-content: space-between; padding: 10px 12px; background: var(--purecloud-script-bg-secondary); border: 1px solid var(--purecloud-script-border-color); border-radius: 8px; } 
            .color-picker-group label { margin-bottom: 0; font-size: 0.85em; color: var(--purecloud-script-text-secondary); margin-right: 10px; font-weight: 600; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; } 
            .color-picker-group input[type="color"] { min-width: 44px; height: 28px; padding: 2px; border: 1px solid var(--purecloud-script-border-color); cursor: pointer; background: var(--purecloud-script-bg-primary); border-radius: 4px; flex-shrink: 0; } 
        `,
        DASHBOARD: `
            .stats-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(130px, 1fr)); gap: 16px; margin-bottom: 24px; } 
            .stat-item { background: var(--purecloud-script-bg-secondary); padding: 18px; border-radius: 12px; border: 1px solid var(--purecloud-script-border-color); transition: transform 0.2s, box-shadow 0.2s; display: flex; flex-direction: column; align-items: center; justify-content: center; } 
            .stat-item:hover { transform: translateY(-3px); box-shadow: 0 8px 16px rgba(0,0,0,0.06); }
            .stat-item span { font-size: 0.85em; color: var(--purecloud-script-text-secondary); font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px;} 
            .stat-item strong { font-size: 1.8em; display: block; margin-top: 8px; color: var(--purecloud-script-accent-color); }
            .analytics-chart-container-main { padding: 15px 0 5px 0; } .chart-scroll-container { overflow-x: auto; width: 100%; padding-bottom: 5px; } 
            .chart-bars-wrapper { display: flex; align-items: flex-end; height: 150px; min-width: 800px; padding-bottom: 20px; border-bottom: 1px solid var(--purecloud-script-border-color); } 
            .chart-bar-wrapper { width: 4.1666%; margin-right: 1px; text-align: center; position: relative; font-size: 0.7em; height: 100%; flex-shrink: 0; } 
            .chart-bar { background-color: var(--purecloud-script-accent-color); border-radius: 4px 4px 0 0; transition: height 0.4s ease-out; } 
            .bar-count { position: absolute; top: -18px; left: 50%; transform: translateX(-50%); font-size: 0.9em; font-weight: bold; color: var(--purecloud-script-text-primary); } 
            .bar-label { position: absolute; bottom: -20px; left: 0; width: 100%; color: var(--purecloud-script-text-secondary); font-size: 1.1em; }
            div.interaction-group{position:relative!important;} 
            #purecloud-script-mini-dashboard { padding: 0; background-color: var(--purecloud-script-bg-primary) !important; border: 1px solid var(--purecloud-script-border-color); } 
            #purecloud-script-mini-dashboard.collapsed { border-radius: 50px; box-shadow: 0 6px 16px var(--purecloud-script-shadow-color); height: 42px; padding: 0 16px; width: auto; min-width: 80px; cursor: move; overflow: hidden; } 
            #purecloud-script-mini-dashboard.expanded { --purecloud-script-header-bg: #0284c7; --purecloud-script-header-text: #ffffff; border-radius: 16px; width: 320px; max-width: 320px; cursor: default; resize: none; bottom: auto; left: auto; } 
            .mini-dashboard-header { height: 100%; padding: 8px 16px; display: flex; align-items: center; justify-content: center; background-color: transparent; border-bottom: none; border-radius: inherit; transition: all 0.2s; } 
            #purecloud-script-mini-dashboard.collapsed .mini-dashboard-header { cursor: move; } 
            #purecloud-script-mini-dashboard.expanded .mini-dashboard-header { height: 46px; background-color: var(--purecloud-script-header-bg); border-bottom: 1px solid var(--purecloud-script-border-color); justify-content: space-between; cursor: move; }
            .mini-dashboard-content { padding: 15px; background-color: var(--purecloud-script-bg-primary); border-radius: 0 0 16px 16px; flex-grow: 1; overflow-y: auto; display: none; } 
            #purecloud-script-mini-dashboard.expanded .mini-dashboard-content { display: block; } 
            .counter-display { display: flex; align-items: center; flex-grow: 1; margin-right: 0; overflow: hidden; justify-content: center; gap: 8px; } 
            #purecloud-script-mini-dashboard.expanded .counter-display { justify-content: flex-start; margin-right: 10px; } 
            .counter-text { color: var(--purecloud-script-text-primary); font-weight: 700; font-size: 1.15em; white-space: nowrap; } 
            #purecloud-script-mini-dashboard.expanded .counter-text { color: var(--purecloud-script-header-text); }
            #purecloud-script-mini-dashboard.expanded .stat-icon { color: var(--purecloud-script-header-text) !important; }
            .progress-bar-container-compact { flex-grow: 1; height: 6px; border-radius: 3px; background-color: var(--purecloud-script-border-color); display: none; } 
            #purecloud-script-mini-dashboard.expanded .progress-bar-container-compact { display: block; overflow: visible; } 
            .progress-bar-compact { background: linear-gradient(90deg, var(--purecloud-script-accent-color), var(--mini-dashboard-progress-color)); border-radius: 3px; height: 100%; transition: width 0.5s cubic-bezier(0.4, 0, 0.2, 1); box-shadow: 0 0 8px rgba(14, 165, 233, 0.4); }
            .mini-dashboard-controls { display: flex; align-items: center; gap: 6px; } 
            #purecloud-script-mini-dashboard.collapsed .mini-dashboard-controls { display: none; } 
            #purecloud-script-mini-dashboard.expanded .mini-dashboard-controls { display: flex; } 
            .compact-btn { border-radius: 6px; width: 28px; height: 28px; background: var(--purecloud-script-bg-secondary); border: 1px solid var(--purecloud-script-border-color); color: var(--purecloud-script-text-secondary); display: flex; align-items: center; justify-content: center; cursor: pointer; transition: all 0.2s; padding: 0; } 
            .compact-btn:hover { background: var(--purecloud-script-border-color); color: var(--purecloud-script-accent-color); }
            #purecloud-script-mini-dashboard.expanded .compact-btn { background: transparent; border-color: rgba(255,255,255,0.2); color: rgba(255,255,255,0.8); }
            #purecloud-script-mini-dashboard.expanded .compact-btn:hover { background: rgba(255,255,255,0.15); color: #fff; }
            .stats-grid-original.mini-dashboard-stats-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 12px; margin: 0; } 
            .stat-label { display: flex; align-items: center; justify-content: center; gap: 6px; color: var(--purecloud-script-text-secondary); font-size: 0.8em; font-weight: 600; text-transform: uppercase; margin-bottom: 6px; } 
            .stat-icon { width: 14px; height: 14px; color: var(--purecloud-script-accent-color); stroke-width: 2px; }
            .stat-item-original strong { font-size: 1.4em; color: var(--purecloud-script-text-primary); font-weight: 700; }
            .stat-item-original { text-align: center; background: linear-gradient(145deg, var(--purecloud-script-bg-secondary), var(--purecloud-script-bg-primary)); padding: 14px 10px; border-radius: 12px; margin: 0; display: flex; flex-direction: column; align-items: center; justify-content: center; border: 1px solid var(--purecloud-script-border-color); box-shadow: 0 4px 6px rgba(0,0,0,0.02); transition: transform 0.2s, box-shadow 0.2s; } 
            .stat-item-original:hover { transform: translateY(-2px); box-shadow: 0 6px 12px rgba(0,0,0,0.05); border-color: var(--purecloud-script-accent-color); }
        `,
        TOOLBAR: `
            .purecloud-script-custom-btn { background: var(--purecloud-script-bg-secondary) !important; border: 1px solid var(--purecloud-script-border-color) !important; border-radius: 8px !important; margin: 0 4px !important; height: 34px; padding: 0 10px !important; transition: all 0.2s ease !important; cursor: pointer; display: inline-flex; align-items: center; color: var(--purecloud-script-text-secondary) !important; order: 3; position: relative; overflow: hidden; }
            .purecloud-script-custom-btn:hover { background: var(--purecloud-script-accent-color) !important; color: #fff !important; transform: translateY(-2px) !important; box-shadow: 0 4px 8px rgba(0,0,0,0.1) !important; border-color: transparent !important; }
            .purecloud-script-custom-btn:active { transform: translateY(0) !important; box-shadow: none !important; }
            .purecloud-script-custom-btn svg { stroke: currentColor !important; width: 18px; height: 18px; flex-shrink: 0; } 
        `,
        SPELL_PRO: `
            #spell-overlay-layer { position: absolute; pointer-events: none; color: transparent !important; background: transparent !important; z-index: 2147483640; overflow: hidden; white-space: pre-wrap; word-wrap: break-word; }
            .spell-wavy-error { text-decoration: underline wavy #ef4444;  text-decoration-skip-ink: none; text-underline-offset: 3px; }
            .spell-wavy-punct { border-bottom: 2px dashed #10b981;  display: inline-block; min-width: 4px; }
            #spell-badge { position: absolute; width: 22px; height: 22px; border-radius: 50%; color: white; display: none; align-items: center; justify-content: center; font-family: sans-serif; font-size: 11px; font-weight: bold; z-index: 2147483645; cursor: pointer; box-shadow: 0 2px 5px rgba(0,0,0,0.2); background: #ef4444; transition: all 0.2s ease; }
            #spell-badge.loading { background: #f59e0b; animation: spellPulse 1.5s infinite; }
            #spell-badge.clean { background: #10b981; }
            #spell-badge:hover { transform: scale(1.1); box-shadow: 0 3px 8px rgba(0,0,0,0.3); }
            @keyframes spellPulse { 0% { opacity: 1; transform: scale(1); } 50% { opacity: 0.6; transform: scale(0.95); } 100% { opacity: 1; transform: scale(1); } }
            
            #spell-inline-popup { position: absolute; background: white; border: 1px solid #e5e7eb; border-radius: 8px; box-shadow: 0 10px 25px rgba(0,0,0,0.1); width: 250px; display: none; flex-direction: column; z-index: 2147483648; font-family: sans-serif; overflow: hidden; animation: spellPopIn 0.2s cubic-bezier(0.16, 1, 0.3, 1); }
            @keyframes spellPopIn { from { opacity: 0; transform: translateY(-5px); } to { opacity: 1; transform: translateY(0); } }
            .popup-header { background: #f8fafc; padding: 10px 12px; font-size: 11px; color: #64748b; font-weight: 600; border-bottom: 1px solid #e5e7eb; text-transform: uppercase; letter-spacing: 0.5px; }
            .popup-body { padding: 12px; }
            .popup-sug-btn { width: 100%; text-align: left; padding: 8px 12px; background: #eff6ff; color: #1d4ed8; border: 1px solid #bfdbfe; border-radius: 6px; cursor: pointer; font-size: 13px; font-weight: 500; transition: all 0.2s; display: flex; align-items: center; gap: 8px; }
            .popup-sug-btn:hover { background: #dbeafe; border-color: #93c5fd; }
            .popup-footer { display: flex; gap: 5px; padding: 8px 12px; background: #f8fafc; border-top: 1px solid #e5e7eb; }
            .popup-action-btn { flex: 1; padding: 6px; font-size: 11px; border: 1px solid #e5e7eb; background: white; border-radius: 4px; cursor: pointer; color: #475569; transition: background 0.2s; }
            .popup-action-btn:hover { background: #f1f5f9; color: #0f172a; }
            #btn-rewrite { font-weight: 600; color: #8b5cf6; border-color: #ede9fe; background: #f5f3ff; }
            #btn-rewrite:hover { background: #ede9fe; }
            .ai-loading { background: linear-gradient(90deg, #f5f3ff, #ddd6fe, #f5f3ff); background-size: 200% 100%; animation: spellAILoading 1.5s infinite linear; pointer-events: none; }
            @keyframes spellAILoading { 0% { background-position: 100% 0; } 100% { background-position: -100% 0; } }

            #spell-main-panel { --purecloud-script-header-bg: #059669; --purecloud-script-header-text: #ffffff; position: fixed; top: 80px; right: 20px; width: 340px; max-height: 80vh; background: white; border-radius: 12px; box-shadow: 0 20px 40px rgba(0,0,0,0.15); border: 1px solid #e5e7eb; z-index: 2147483649; display: none; flex-direction: column; font-family: sans-serif; overflow: hidden; }
            .panel-header-top { display: flex; justify-content: space-between; align-items: center; padding: 15px 20px; background: var(--purecloud-script-header-bg, #f8fafc); border-bottom: 1px solid #e5e7eb; }
            .panel-title { font-weight: 700; color: var(--purecloud-script-header-text, #0f172a); display: flex; align-items: center; gap: 8px; }
            .btn-fix-all { background: white; color: var(--purecloud-script-header-bg, #3b82f6); border: none; padding: 6px 12px; border-radius: 6px; font-size: 12px; font-weight: 600; cursor: pointer; }
            .btn-fix-all:hover { background: #f1f5f9; }
            .panel-tabs { display: flex; border-bottom: 1px solid #e5e7eb; padding: 0 10px; }
            .tab-active { padding: 10px 15px; font-size: 12px; font-weight: 600; color: #10b981; border-bottom: 2px solid #10b981; cursor: default; }
            .panel-body { overflow-y: auto; padding: 10px; background: #f1f5f9; flex: 1; display: flex; flex-direction: column; gap: 10px; }
            .panel-card { background: white; border: 1px solid #e5e7eb; border-radius: 8px; padding: 12px; box-shadow: 0 2px 4px rgba(0,0,0,0.02); }
            .card-category { font-size: 10px; text-transform: uppercase; color: #64748b; font-weight: 700; margin-bottom: 6px; display: block; }
            .card-change { font-size: 14px; color: #0f172a; line-height: 1.5; }
            .card-wrong { text-decoration: line-through; color: #ef4444; background: #fef2f2; padding: 2px 4px; border-radius: 4px; }
            .card-right { color: #10b981; background: #ecfdf5; padding: 2px 4px; border-radius: 4px; font-weight: 500; cursor: pointer; transition: background 0.2s; border: 1px dashed #6ee7b7; margin-left: 5px; }
            .card-right:hover { background: #d1fae5; border-style: solid; }
        `
    };

    function injectCss() {
        document.getElementById('purecloud-script-injected-style')?.remove();
        const theme = validateConfigValue('THEME_COLORS', CONFIG.THEME_COLORS);
        const css = Object.values(CONFIG_CSS).join('\n');

        // Substituindo as variáveis lidas do theme no texto do CSS
        const processedCss = css.replace(/\$\{theme\.([a-zA-Z]+)\}/g, (match, p1) => theme[p1]);

        const style = document.createElement('style');
        style.id = 'purecloud-script-injected-style';
        document.head.appendChild(style);
        style.textContent = processedCss;
    }

    function initializeDailyCounters(forceReset = false) {
        const todayKey = getBrazilTime(new Date()).toLocaleDateString('pt-BR');
        const lastSavedDate = localStorage.getItem('purecloudScript_lastActivityDate');
        if (lastSavedDate !== todayKey || forceReset) { 
            localStorage.setItem('purecloudScript_lastActivityDate', todayKey); 
            analyticsManager.clearAllData(); 
        } else { 
            analyticsManager.getData(); 
            loadV4Counters(); 
        }
    }

    // --- MÓDULO CORRETOR PRO ---
    const spellCheckerModule = {
        ultimoCampo: null, errosEncontrados: [], tempoDigitacao: null,
        camadaIlusao: null, badge: null, popup: null, panel: null,
        init() {
            window.spellCheckerModule = this;
            if (document.getElementById('spell-badge')) return;
            this.camadaIlusao = document.createElement('div'); this.camadaIlusao.id = 'spell-overlay-layer'; document.body.appendChild(this.camadaIlusao);
            this.badge = document.createElement('div'); this.badge.id = 'spell-badge'; document.body.appendChild(this.badge);
            this.popup = document.createElement('div'); this.popup.id = 'spell-inline-popup'; document.body.appendChild(this.popup);
            this.panel = document.createElement('div'); this.panel.id = 'spell-main-panel'; document.body.appendChild(this.panel);

            this.badge.addEventListener('click', () => {
                if (this.errosEncontrados.length > 0) {
                    this.panel.style.display = this.panel.style.display === 'flex' ? 'none' : 'flex';
                    this.renderizarPainel();
                }
            });
            document.addEventListener('mousedown', (e) => { if (!this.popup.contains(e.target) && this.ultimoCampo !== e.target) this.popup.style.display = 'none'; });

            this.rastrearCampos();
        },
        rastrearCampos() {
            document.addEventListener('focusin', (e) => {
                const el = e.target;
                if (el.tagName === 'TEXTAREA' || (el.tagName === 'INPUT' && el.type === 'text') || el.isContentEditable) {
                    this.ultimoCampo = el;
                    this.sincronizarIlusao(); this.posicionarBadge(); this.configurarEventosDoCampo(); this.verificarTextoNaAPI();
                }
            }, { passive: true });

            window.addEventListener('resize', () => { this.sincronizarIlusao(); this.posicionarBadge(); });
            window.addEventListener('scroll', () => { this.sincronizarIlusao(); this.posicionarBadge(); }, true);

            const observer = new MutationObserver(throttle(() => {
                if (this.ultimoCampo && document.contains(this.ultimoCampo)) {
                    this.sincronizarIlusao();
                    this.posicionarBadge();
                } else {
                    this.ocultarTudo();
                }
            }, 500));
            observer.observe(document.body, { childList: true, subtree: true });
        },
        ocultarTudo() { if (this.badge) this.badge.style.display = 'none'; if (this.popup) this.popup.style.display = 'none'; if (this.camadaIlusao) this.camadaIlusao.innerHTML = ''; this.ultimoCampo = null; },
        sincronizarIlusao() {
            if (!this.ultimoCampo) return;
            const rect = this.ultimoCampo.getBoundingClientRect();
            if (rect.width === 0 || rect.height === 0) return;

            const estilos = window.getComputedStyle(this.ultimoCampo);
            this.camadaIlusao.style.top = (rect.top + window.scrollY) + 'px';
            this.camadaIlusao.style.left = (rect.left + window.scrollX) + 'px';
            this.camadaIlusao.style.width = rect.width + 'px'; this.camadaIlusao.style.height = rect.height + 'px';
            this.camadaIlusao.style.font = estilos.font; this.camadaIlusao.style.padding = estilos.padding;
            this.camadaIlusao.style.lineHeight = estilos.lineHeight; this.camadaIlusao.style.letterSpacing = estilos.letterSpacing;
            this.camadaIlusao.style.border = estilos.border; this.camadaIlusao.style.borderColor = 'transparent';
            this.camadaIlusao.scrollTop = this.ultimoCampo.scrollTop; this.camadaIlusao.scrollLeft = this.ultimoCampo.scrollLeft;
        },
        posicionarBadge() {
            if (!this.ultimoCampo) return;
            const rect = this.ultimoCampo.getBoundingClientRect();
            if (rect.width === 0) return;

            this.badge.style.left = (rect.right + window.scrollX - 30) + 'px';
            this.badge.style.top = (rect.bottom + window.scrollY - 30) + 'px';
            this.badge.style.display = 'flex';
        },
        configurarEventosDoCampo() {
            if (this.ultimoCampo._spellConfigured) return; this.ultimoCampo._spellConfigured = true;
            this.ultimoCampo.addEventListener('input', () => {
                this.badge.className = 'loading'; this.badge.innerHTML = ''; this.popup.style.display = 'none'; this.camadaIlusao.innerHTML = '';
                clearTimeout(this.tempoDigitacao); this.tempoDigitacao = setTimeout(() => this.verificarTextoNaAPI(), 800);
            });
            this.ultimoCampo.addEventListener('scroll', () => this.sincronizarIlusao());
            this.ultimoCampo.addEventListener('click', (e) => this.verificarCursor(e));
            this.ultimoCampo.addEventListener('keyup', (e) => { if (["ArrowLeft", "ArrowRight"].includes(e.key)) this.verificarCursor(e); });
        },
        verificarTextoNaAPI() {
            if (!this.ultimoCampo) return; const isCE = this.ultimoCampo.isContentEditable; const texto = isCE ? (this.ultimoCampo.innerText || this.ultimoCampo.textContent) : this.ultimoCampo.value;
            if (!texto.trim()) { this.badge.className = ''; this.badge.innerHTML = '0'; this.badge.style.display = 'none'; this.errosEncontrados = []; this.camadaIlusao.innerHTML = ''; return; }

            const params = `text=${encodeURIComponent(texto)}&language=pt-BR`;

            // Prioridade para Chrome Extension Message (Background Bridge) para evitar CSP
            if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.sendMessage) {
                chrome.runtime.sendMessage({
                    action: "fetchAPI",
                    url: 'https://api.languagetool.org/v2/check',
                    options: {
                        method: 'POST',
                        headers: { "Content-Type": "application/x-www-form-urlencoded" },
                        body: params
                    }
                }, response => {
                    if (response && response.success) {
                        try {
                            const data = JSON.parse(response.text);
                            this.errosEncontrados = data.matches.reverse();
                            this.atualizarLinhasOnduladas(texto); this.atualizarBadge();
                            if (this.panel.style.display === 'flex') this.renderizarPainel();
                        } catch (e) { log("Erro JSON via Extension:", e); }
                    }
                });
                return;
            }

            if (typeof GM_xmlhttpRequest !== 'undefined') {
                GM_xmlhttpRequest({
                    method: 'POST',
                    url: 'https://api.languagetool.org/v2/check',
                    headers: { "Content-Type": "application/x-www-form-urlencoded" },
                    data: params,
                    onload: (response) => {
                        try {
                            const data = JSON.parse(response.responseText);
                            this.errosEncontrados = data.matches.reverse();
                            this.atualizarLinhasOnduladas(texto); this.atualizarBadge();
                            if (this.panel.style.display === 'flex') this.renderizarPainel();
                        } catch (e) { log("Erro JSON CSP:", e); }
                    }
                });
            }
        },
        atualizarLinhasOnduladas(textoOriginal) {
            this.camadaIlusao.innerHTML = buildSpellOverlayHTML(textoOriginal, this.errosEncontrados);
            this.sincronizarIlusao();
        },
        atualizarBadge() {
            const qtd = this.errosEncontrados.length;
            if (qtd === 0) {
                this.badge.className = 'clean'; this.badge.innerHTML = '✓';
                setTimeout(() => { if (this.errosEncontrados.length === 0) this.badge.style.display = 'none'; }, 2000);
            } else { this.badge.className = ''; this.badge.innerHTML = qtd; this.badge.style.display = 'flex'; }
        },
        verificarCursor(eventoMouse) {
            if (!this.ultimoCampo || this.errosEncontrados.length === 0) return;
            const cursor = this.ultimoCampo.selectionStart;
            const erroNoCursor = this.errosEncontrados.find(err => cursor >= (err.offset - 1) && cursor <= (err.offset + err.length + 1));
            if (erroNoCursor) {
                let top = eventoMouse.pageY ? eventoMouse.pageY + 15 : (this.ultimoCampo.getBoundingClientRect().bottom + window.scrollY);
                let left = eventoMouse.pageX ? eventoMouse.pageX : (this.ultimoCampo.getBoundingClientRect().left + window.scrollX + 20);
                this.popup.style.left = left + 'px'; this.popup.style.top = top + 'px';
                this.mostrarPopupCorrecao(erroNoCursor);
            } else { this.popup.style.display = 'none'; }
        },
        mostrarPopupCorrecao(erro) {
            const sugestaoPrincipal = erro.replacements[0] ? erro.replacements[0].value : "";
            const categoria = erro.rule.category.name || "Revisão sugerida";
            let labelSugestao = sugestaoPrincipal;
            if (sugestaoPrincipal === "." || sugestaoPrincipal === ",") { labelSugestao = `Adicionar [ ${sugestaoPrincipal} ]`; }
            let html = `<div class="popup-header">${categoria}</div><div class="popup-body">`;
            if (sugestaoPrincipal) { html += `<button class="popup-sug-btn" id="sug-btn-main">➔ ${labelSugestao}</button>`; }
            else { html += `<div style="font-size:12px; color:#ef4444;">${erro.message}</div>`; }
            html += `</div><div class="popup-footer"><button class="popup-action-btn" id="btn-rewrite">✨ Melhorar Frase (IA)</button><button class="popup-action-btn" id="btn-ignore">🗑️ Ignorar erro</button></div>`;
            this.popup.innerHTML = html;
            if (sugestaoPrincipal) { this.popup.querySelector('#sug-btn-main').onclick = () => this.aplicarCorrecao(erro, sugestaoPrincipal); }
            this.popup.querySelector('#btn-ignore').onclick = () => {
                this.errosEncontrados = this.errosEncontrados.filter(e => e !== erro);
                this.atualizarLinhasOnduladas(this.ultimoCampo.isContentEditable ? (this.ultimoCampo.innerText || this.ultimoCampo.textContent) : this.ultimoCampo.value); this.atualizarBadge(); this.popup.style.display = 'none';
            };
            this.popup.querySelector('#btn-rewrite').onclick = () => {
                const btnIA = this.popup.querySelector('#btn-rewrite'); btnIA.innerHTML = `⏳ A IA processando...`; btnIA.classList.add('ai-loading');
                setTimeout(() => { alert("Como sou seu Parceiro de Programação, deixei a interface prontinha para o futuro."); this.popup.style.display = 'none'; }, 1500);
            };
            this.popup.style.display = 'flex';
        },
        aplicarCorrecao(erro, sugestao) { this.aplicarCorrecaoMath(erro, sugestao); this.dispararEventoDeMudanca(); this.popup.style.display = 'none'; if (this.panel.style.display === 'flex') this.panel.style.display = 'none'; },
        aplicarCorrecaoMath(erro, sugestao) {
            if (!this.ultimoCampo) return; const isCE = this.ultimoCampo.isContentEditable; const texto = isCE ? (this.ultimoCampo.innerText || this.ultimoCampo.textContent) : this.ultimoCampo.value;
            const novoTexto = texto.substring(0, erro.offset) + sugestao + texto.substring(erro.offset + erro.length);
            if (this.ultimoCampo.isContentEditable) {
                this.ultimoCampo.focus();
                document.execCommand('selectAll', false, null);
                document.execCommand('insertText', false, novoTexto);
            } else {
                this.ultimoCampo.value = novoTexto;
            }
        },
        dispararEventoDeMudanca() { this.ultimoCampo.dispatchEvent(new Event('input', { bubbles: true })); this.verificarTextoNaAPI(); },
        renderizarPainel() {
            this.panel.innerHTML = `
                <div class="panel-header-top"><div class="panel-title"><div style="background:#ef4444; color:white; border-radius:50%; width:20px; height:20px; display:flex; align-items:center; justify-content:center; font-size:10px;">${this.errosEncontrados.length}</div> Erros encontrados</div><button class="btn-fix-all" id="btn-fix-all">Fix all</button></div>
                <div class="panel-tabs"><span class="tab-active">Tudo (${this.errosEncontrados.length})</span></div><div class="panel-body" id="panel-cards-area"></div>`;
            const area = this.panel.querySelector('#panel-cards-area');
            this.errosEncontrados.forEach(err => {
                const card = document.createElement('div'); card.className = 'panel-card';
                const erroTexto = err.context.text.substr(err.context.offset, err.context.length) || "Falta Pontuação";
                const sugTexto = err.replacements[0] ? err.replacements[0].value : "-";
                card.innerHTML = `<span class="card-category">${err.rule.category.name}</span><div class="card-change"><span class="card-wrong">${erroTexto}</span> ➔ <span class="card-right" title="Clique para aplicar">${sugTexto}</span></div>`;
                if (err.replacements[0]) { card.querySelector('.card-right').onclick = () => { this.aplicarCorrecao(err, sugTexto); }; }
                area.appendChild(card);
            });
            this.panel.querySelector('#btn-fix-all').onclick = () => { this.errosEncontrados.forEach(err => { if (err.replacements[0]) this.aplicarCorrecaoMath(err, err.replacements[0].value); }); this.dispararEventoDeMudanca(); this.panel.style.display = 'none'; };
        }
    };

    function sincronizarDadosComPlanilha() {
        if (typeof analyticsManager === 'undefined' || typeof v4_counters === 'undefined') return;
        let currentUserName = getAgentName(); 
        const stats = analyticsManager.calculateStats();
        const analyticsPayload = { conversasUnicas: stats.count, tmaGeral: stats.tma, tmeAtivo: stats.tme, encAgente: stats.baloonClicks, inicio: stats.last, ultima: stats.first, meta: CONFIG.CONVERSATION_TARGET, transferidos: stats.transferClicks, tmaGeralSegundos: stats.tmaSeconds || 0, tmeAtivoSegundos: stats.tmeSeconds || 0 };
        DataSyncer.send({ type: 'analytics', user: currentUserName, stats: analyticsPayload });
        const atendimentosPayload = analyticsManager.getData().conversations.map(conv => ({ tipo: conv.interactionType || 'unknown', horaFim: new Date(conv.timestamp).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }), cliente: conv.participantName, tme: (() => { const s = Math.floor(conv.activeDuration / 1000); return `${Math.floor(s / 60).toString().padStart(2, '0')}:${(s % 60).toString().padStart(2, '0')}` })(), tmeSegundos: Math.floor(conv.activeDuration / 1000), duracaoSegundos: Math.floor((conv.duration || 0) / 1000), recorrencia: conv.isRecurrence ? 'Sim' : 'Não', link: conv.interactionUrl || 'N/A' }));
        DataSyncer.send({ type: 'atendimento', user: currentUserName, atendimentos: atendimentosPayload });
        if (v4_counters.balao.length > 0) { DataSyncer.send({ type: 'encerrados', user: currentUserName, encerrados: v4_counters.balao }); }
    }

    const isMainFrame = (window.self === window.top);

    const initialize = () => {
        if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
            chrome.storage.local.get(['SHOW_AGENT_TOOLS'], function (result) {
                iniciarScript(result.SHOW_AGENT_TOOLS !== false);
            });
        } else {
            iniciarScript(true);
        }
    };

    function iniciarScript(mostrarFerramentas) {
        // Inicialização em TODOS OS FRAMES (CAR e Corretor)
        spellCheckerModule.init();
        
        // Inicialização APENAS NO TOP FRAME (Dashboards, Menus, IA)
        if (isMainFrame) {
            effectsManager.init();
            timerManager.startGlobalTimer();

            // --- SISTEMA DE INTEGRAÇÃO MODULAR (EXTENSÃO CHROME) ---
            window.PCScript = window.PCScript || {};
            window.PCScript.Integrador = {
                Config: CONFIG,
                UI: {
                    notificar: UI.createNotification,
                    alternarDarkMode: actions.toggleDarkMode
                },
                Estilo: {
                    geradorCSS: CONFIG_CSS
                },
                Audio: {
                    tocarSom: (tipo) => effectsManager.playBeep(tipo),
                    sucesso: () => effectsManager.playSuccess()
                },
                Estado: {
                    conversasAtivas: timerManager.activeTimers,
                    getMétricas: () => analyticsManager.getData()
                }
            };

            setInterval(() => DataSyncer.processQueue(), 60000);
            setTimeout(() => DataSyncer.updateIndicator(), 3000);
            setTimeout(sincronizarDadosComPlanilha, 15000); // Sincroniza mais cedo ao iniciar
            setInterval(sincronizarDadosComPlanilha, 5 * 60 * 1000); // Sincroniza a cada 5 min em vez de 10

            if (mostrarFerramentas) {
                initializeDailyCounters();
                saveData();
                injectCss();
                document.addEventListener('keydown', keyboardEventHandler);
                document.addEventListener('click', () => effectsManager.init(), { once: true });
                let targetNode = findEl(CONFIG.PURECLOUD_SELECTORS.CONVERSATION_LIST_CONTAINER);
                if (!targetNode) { targetNode = document.body; }
                const mainObserver = new MutationObserver(throttle(mainLoop, CONFIG.MAIN_LOOP_THROTTLE_MS));
                setTimeout(() => { mainObserver.observe(targetNode, { childList: true, subtree: true, attributes: true }); }, 500);
                setTimeout(mainLoop, 100);
                setTimeout(autoRestoreFromCloud, 2000); // Tenta restaurar 2s após carregar
                if (CONFIG.MINI_DASHBOARD_VISIBLE) {
                    setTimeout(() => {
                        UI.createMiniDashboard();
                        if (CONFIG.TOOLS_VISIBLE) UI.createAgentToolsPanel();
                    }, 4000);
                }
            }
        }
    }

    if (document.readyState === 'loading') { document.addEventListener('DOMContentLoaded', initialize); } else { initialize(); }


    /* ============================================================== 
       ⬇️ INJEÇÃO DOS MÓDULOS DA EXTENSÃO ⬇️ 
       (Limpeza e conversão automática de estilos) 
       ============================================================== */


    /* --- MÓDULO ANEXADO: COMPATIBILITY.JS --- */
    try {
        // compatibility.js
        // Configuração Centralizada

        console.log("[Compatibility] Carregando configurações globais...");

        window.GENESYS_CONFIG = {
            // URL do teu Google Apps Script
            API_URL: "https://script.google.com/macros/s/AKfycbyBkz1XED-bMLDrPX19VMPoHmMB2_WovBb-Pn2HN1MG0P3lQOl6MkVCkcI6_Yo6WiGsEg/exec",

            // Configurações do Repositório GitHub (Para o Admin.js)
            REPO_USER: "kingoffjoss",
            REPO_NAME: "AjaExtension",

            VERSION: "6.8-Stable"
        };

        // Adaptadores para funcionar como Extensão
        window.GM_addStyle = function (css) {
            const style = document.createElement('style');
            style.textContent = css;
            (document.head || document.body).appendChild(style);
        };

        window.GM_setClipboard = function (text) {
            if (navigator.clipboard) {
                navigator.clipboard.writeText(text).catch(e => console.error(e));
            }
        };

        window.GM_openInTab = function (url) {
            window.open(url, '_blank');
        };

        // Polyfill global para storage (resolve erro do gerente.js e ia.js no Tampermonkey)
        window.GM_storage = {
            local: {
                get: function (keys, callback) {
                    let result = {};
                    if (typeof keys === 'string') keys = [keys];
                    if (Array.isArray(keys)) {
                        keys.forEach(k => {
                            let val = localStorage.getItem(k);
                            result[k] = val !== null ? JSON.parse(val) : undefined;
                        });
                    } else if (typeof keys === 'object' && keys !== null) {
                        Object.keys(keys).forEach(k => {
                            let val = localStorage.getItem(k);
                            result[k] = val !== null ? JSON.parse(val) : keys[k];
                        });
                    }
                    if (callback) callback(result);
                },
                set: function (obj, callback) {
                    if (obj && typeof obj === 'object') {
                        Object.keys(obj).forEach(k => {
                            localStorage.setItem(k, JSON.stringify(obj[k]));
                        });
                    }
                    if (callback) callback();
                },
                remove: function (keys, callback) {
                    if (typeof keys === 'string') keys = [keys];
                    if (Array.isArray(keys)) {
                        keys.forEach(k => localStorage.removeItem(k));
                    }
                    if (callback) callback();
                }
            },
            onChanged: {
                addListener: function (listener) {
                    // Dummy listener to avoid "undefined" errors
                    console.log("[Polyfill] GM_storage.onChanged addListener mock chamado.");
                }
            }
        };

        window.unsafeWindow = window;

    } catch (e) { console.error('[BUILDER] Erro fatal no módulo compatibility.js:', e); }

    /* --- MÓDULO ANEXADO: BAR.JS --- */
    try {
        (function () {
            // --- 0. BANCO DE DADOS DE COMANDOS (ORIGINAL V19.0) ---
            window.commandDatabase = [
                {
                    "title": "Rede (Diagnóstico e Atalhos)",
                    "commands": [
                        { "id": "cmd-ncpa", "label": "Conexões de Rede (Painel de Controle)", "desc": "Abre a pasta \"Conexões de Rede\" (Painel de Controle)", "os": { "win": "ncpa.cpl" } },
                        { "id": "cmd-firewall", "label": "Firewall do Windows", "desc": "Abre o Firewall com Segurança Avançada", "os": { "win": "wf.msc" } },
                        { "id": "cmd-inetcpl", "label": "Propriedades de Internet", "desc": "Abre as Propriedades de Internet (Cache, Segurança, etc)", "os": { "win": "inetcpl.cpl" } },
                        { "id": "cmd-mac-net", "label": "Definições de Rede (GUI)", "desc": "Abre as Preferências de Rede do Sistema", "os": { "mac": "open /System/Library/PreferencePanes/Network.prefPane" } },
                        { "id": "cmd-lin-nm", "label": "Editor de Conexão (GUI)", "desc": "Abre o editor de conexões do NetworkManager", "os": { "linux": "nm-connection-editor" } },
                        { "id": "cmd-getmac", "label": "Ver Endereços MAC", "desc": "Mostra os endereços físicos (MAC) de todas as placas", "os": { "win": "getmac /v", "mac": "ifconfig | grep ether", "linux": "ip link show | grep ether" } },
                        { "id": "cmd-firewall-status", "label": "Verificar Status do Firewall (Terminal)", "desc": "Verifica se o firewall está ativo", "os": { "win": "netsh advfirewall show allprofiles state", "mac": "sudo /usr/libexec/ApplicationFirewall/socketfilterfw --getglobalstate", "linux": "sudo ufw status" } }
                    ]
                },
                {
                    "title": "Rede (Configuração e Admin)",
                    "commands": [
                        { "id": "cmd-flushdns", "label": "Limpar Cache DNS (Admin)", "desc": "Força a limpeza do cache de resolução de DNS", "os": { "win": "ipconfig /flushdns", "mac": "sudo dscacheutil -flushcache; sudo killall -HUP mDNSResponder", "linux": "sudo systemd-resolve --flush-caches" } },
                        { "id": "cmd-releaseip", "label": "Libertar IP (Admin)", "desc": "Liberta o endereço IP atual do DHCP", "os": { "win": "ipconfig /release", "mac": "sudo ipconfig set en0 BOOTP && sudo ipconfig set en0 DHCP", "linux": "sudo dhclient -r" } },
                        { "id": "cmd-renewip", "label": "Renovar IP (Admin)", "desc": "Pede um novo endereço IP ao DHCP", "os": { "win": "ipconfig /renew", "mac": "sudo ipconfig set en0 BOOTP && sudo ipconfig set en0 DHCP", "linux": "sudo dhclient" } },
                        { "id": "cmd-netsh-show-wifi", "label": "Ver Perfis Wi-Fi Guardados (Admin)", "desc": "Mostra todas as redes Wi-Fi que o Windows guardou", "os": { "win": "netsh wlan show profiles" } },
                        { "id": "cmd-netsh-show-wifikey", "label": "Ver Chave Wi-Fi Específica (Admin)", "desc": "Substitua NOME_DA_REDE pelo nome do Wi-Fi", "os": { "win": "netsh wlan show profile name=\"NOME_DA_REDE\" key=clear" } },
                        { "id": "cmd-netsh-reset", "label": "Resetar Catálogo Winsock (Admin)", "desc": "Repara problemas de conectividade de software", "os": { "win": "netsh winsock reset" } },
                        { "id": "cmd-netsh-reset-ip", "label": "Resetar Stack TCP/IP (Admin)", "desc": "Repara problemas de conectividade de IP", "os": { "win": "netsh int ip reset" } },
                        { "id": "cmd-wifi-off", "label": "Desativar Wi-Fi (Admin)", "desc": "Nome \"Wi-Fi\" (Win) ou \"wlan0\" (Lin) pode variar", "os": { "win": "powershell -Command \"Disable-NetAdapter -Name 'Wi-Fi' -Confirm:$false\"", "mac": "sudo networksetup -setnetworkserviceenabled Wi-Fi off", "linux": "sudo ip link set wlan0 down" } },
                        { "id": "cmd-wifi-on", "label": "Ativar Wi-Fi (Admin)", "desc": "Nome \"Wi-Fi\" (Win) ou \"wlan0\" (Lin) pode variar", "os": { "win": "powershell -Command \"Enable-NetAdapter -Name 'Wi-Fi'\"", "mac": "sudo networksetup -setnetworkserviceenabled Wi-Fi on", "linux": "sudo ip link set wlan0 up" } },
                        { "id": "cmd-mac-airport", "label": "Scan Wi-Fi (Terminal)", "desc": "Mostra todas as redes Wi-Fi visíveis e a sua força", "os": { "mac": "/System/Library/PrivateFrameworks/Apple80211.framework/Versions/Current/Resources/airport -s" } },
                        { "id": "cmd-lin-iwlist", "label": "Scan Wi-Fi (Terminal)", "desc": "Mostra todas as redes Wi-Fi visíveis", "os": { "linux": "sudo iwlist wlan0 scan" } }
                    ]
                },
                {
                    "title": "Sistema (Info e Desempenho)",
                    "commands": [
                        { "id": "cmd-taskmgr", "label": "Gestor de Tarefas", "desc": null, "os": { "win": "taskmgr" } },
                        { "id": "cmd-services", "label": "Serviços do Windows", "desc": null, "os": { "win": "services.msc" } },
                        { "id": "cmd-msinfo", "label": "Informação do Sistema", "desc": null, "os": { "win": "msinfo32" } },
                        { "id": "cmd-devmgmt", "label": "Gestor de Dispositivos", "desc": "Ver drivers e hardware", "os": { "win": "devmgmt.msc" } },
                        { "id": "cmd-msconfig", "label": "Configuração do Sistema", "desc": "Ver programas de arranque e serviços", "os": { "win": "msconfig" } },
                        { "id": "cmd-dxdiag", "label": "Diagnóstico do DirectX", "desc": "Verificar drivers de vídeo e áudio", "os": { "win": "dxdiag" } },
                        { "id": "cmd-resmon", "label": "Monitor de Recursos", "desc": "Ver uso de CPU, disco, rede e memória em detalhe", "os": { "win": "resmon" } },
                        { "id": "cmd-perfmon", "label": "Monitor de Desempenho", "desc": "Analisar performance e gerar relatórios", "os": { "win": "perfmon" } },
                        { "id": "cmd-powercfg", "label": "Opções de Energia (Avançado)", "desc": "Gerar relatório de saúde da bateria", "os": { "win": "powercfg /batteryreport" } },
                        { "id": "cmd-wmic-cpu", "label": "Info CPU (Terminal)", "desc": null, "os": { "win": "wmic cpu get name, MaxClockSpeed, L3CacheSize", "mac": "sysctl -n machdep.cpu.brand_string", "linux": "lscpu | grep 'Model name'" } },
                        { "id": "cmd-wmic-mem", "label": "Info Memória (Terminal)", "desc": "Lista os módulos de RAM instalados", "os": { "win": "wmic memorychip get Capacity, Speed, Manufacturer", "mac": "sysctl hw.memsize", "linux": "free -h" } },
                        { "id": "cmd-wmic-os", "label": "Info Sistema Operacional (Terminal)", "desc": null, "os": { "win": "wmic os get Caption, Version, OSArchitecture", "mac": "sw_vers", "linux": "lsb_release -a" } },
                        { "id": "cmd-mac-activity", "label": "Monitor de Atividade (GUI)", "desc": "Equivalente ao Gestor de Tarefas", "os": { "mac": "open /System/Applications/Utilities/Activity\\ Monitor.app" } },
                        { "id": "cmd-mac-sysinfo", "label": "Informação do Sistema (GUI)", "desc": null, "os": { "mac": "open /System/Applications/Utilities/System\\ Information.app" } },
                        { "id": "cmd-mac-console", "label": "Logs do Sistema (GUI)", "desc": "Equivalente ao Visualizador de Eventos", "os": { "mac": "open /System/Applications/Utilities/Console.app" } },
                        { "id": "cmd-lin-monitor", "label": "Monitor de Sistema (Terminal)", "desc": "(Requer htop: sudo apt install htop)", "os": { "linux": "htop" } },
                        { "id": "cmd-lin-lshw", "label": "Listar Hardware (Terminal)", "desc": "Lista detalhada de todo o hardware", "os": { "linux": "sudo lshw -short" } },
                        { "id": "cmd-lin-df", "label": "Ver Uso de Disco (Terminal)", "desc": "Mostra espaço livre em disco", "os": { "mac": "df -h", "linux": "df -h" } },
                        { "id": "cmd-lin-du", "label": "Ver Tamanho de Pastas (Terminal)", "desc": "Mostra o tamanho das pastas no diretório atual", "os": { "mac": "du -sh *", "linux": "du -sh *" } },
                        { "id": "cmd-lin-lspci", "label": "Listar Dispositivos PCI (Terminal)", "desc": "Ver placas (vídeo, rede, etc) ligadas", "os": { "linux": "lspci" } },
                        { "id": "cmd-uname", "label": "Ver Info do Sistema (Terminal)", "desc": "Mostra a versão do Kernel e SO", "os": { "mac": "uname -a", "linux": "uname -a" } },
                        { "id": "cmd-whoami", "label": "Ver Username (Terminal)", "desc": "Mostra o utilizador atual", "os": { "win": "whoami", "mac": "whoami", "linux": "whoami" } },
                        { "id": "cmd-uptime", "label": "Tempo de Atividade (Terminal)", "desc": "Há quanto tempo o sistema está ligado", "os": { "win": "systeminfo | find \"Tempo de Arranque\"", "mac": "uptime", "linux": "uptime" } }
                    ]
                },
                {
                    "title": "Gestão de Processos e Serviços",
                    "commands": [
                        { "id": "cmd-tasklist", "label": "Listar Processos (Terminal)", "desc": "Mostra todos os processos a correr", "os": { "win": "tasklist", "mac": "ps aux", "linux": "ps aux" } },
                        { "id": "cmd-taskkill", "label": "Matar Processo por PID (Admin)", "desc": "Substitua [PID] pelo número do processo", "os": { "win": "taskkill /PID [PID] /F", "mac": "sudo kill -9 [PID]", "linux": "sudo kill -9 [PID]" } },
                        { "id": "cmd-taskkill-name", "label": "Matar Processo por Nome (Admin)", "desc": "Substitua [NOME]", "os": { "win": "taskkill /IM [NOME.EXE] /F", "mac": "sudo killall [NOME]", "linux": "sudo killall [NOME]" } },
                        { "id": "cmd-net-start", "label": "Ver Serviços a Correr (Terminal)", "desc": null, "os": { "win": "net start", "mac": "sudo launchctl list", "linux": "sudo systemctl list-units --type=service --state=running" } },
                        { "id": "cmd-net-stop", "label": "Parar Serviço (Admin)", "desc": "Substitua \"NOME_SERVICO\"", "os": { "win": "net stop \"NOME_SERVICO\"", "mac": "sudo launchctl stop [NOME_SERVICO]", "linux": "sudo systemctl stop [NOME_SERVICO]" } },
                        { "id": "cmd-net-start-srv", "label": "Iniciar Serviço (Admin)", "desc": "Substitua \"NOME_SERVICO\"", "os": { "win": "net start \"NOME_SERVICO\"", "mac": "sudo launchctl start [NOME_SERVICO]", "linux": "sudo systemctl start [NOME_SERVICO]" } }
                    ]
                },
                {
                    "title": "Sistema (Reparação e Admin)",
                    "commands": [
                        { "id": "cmd-sfc", "label": "Verificar Ficheiros de Sistema (Admin)", "desc": "Repara ficheiros corrompidos do Windows", "os": { "win": "sfc /scannow" } },
                        { "id": "cmd-dism", "label": "Verificar Imagem do Windows (Admin)", "desc": "Repara a imagem do Windows", "os": { "win": "Dism /Online /Cleanup-Image /RestoreHealth" } },
                        { "id": "cmd-chkdsk", "label": "Verificar Disco (Admin)", "desc": "Verifica o disco C: (agenda para reiniciar)", "os": { "win": "chkdsk C: /f" } },
                        { "id": "cmd-cleanmgr", "label": "Limpeza de Disco (GUI)", "desc": "Abre a ferramenta de limpeza de disco", "os": { "win": "cleanmgr" } },
                        { "id": "cmd-control", "label": "Painel de Controle (GUI)", "desc": null, "os": { "win": "control" } },
                        { "id": "cmd-eventvwr", "label": "Visualizador de Eventos (GUI)", "desc": "Ver logs de erro do Windows", "os": { "win": "eventvwr.msc" } },
                        { "id": "cmd-gpedit", "label": "Editor de Política de Grupo (GUI)", "desc": "(Apenas Windows Pro/Enterprise)", "os": { "win": "gpedit.msc" } },
                        { "id": "cmd-regedit", "label": "Editor de Registo (GUI)", "desc": null, "os": { "win": "regedit" } },
                        { "id": "cmd-gpupdate", "label": "Forçar Atualização de Política (Admin)", "desc": "Aplica novas políticas de grupo imediatamente", "os": { "win": "gpupdate /force" } },
                        { "id": "cmd-shutdown-r", "label": "Reiniciar o PC (Terminal)", "desc": "Força o reinício em 1 minuto", "os": { "win": "shutdown /r /t 60", "mac": "sudo shutdown -r now", "linux": "sudo shutdown -r now" } },
                        { "id": "cmd-shutdown-s", "label": "Desligar o PC (Terminal)", "desc": "Força o desligamento em 1 minuto", "os": { "win": "shutdown /s /t 60", "mac": "sudo shutdown -h now", "linux": "sudo shutdown -h now" } },
                        { "id": "cmd-mac-diskutil", "label": "Verificar Disco (Terminal)", "desc": "Verifica a integridade do disco principal", "os": { "mac": "diskutil verifyVolume /" } },
                        { "id": "cmd-mac-repairperm", "label": "Reparar Permissões (Terminal)", "desc": "Repara permissões no disco de utilizador", "os": { "mac": "diskutil resetUserPermissions / `id -u`" } },
                        { "id": "cmd-mac-firstaid", "label": "Primeiros Socorros no Disco (Terminal)", "desc": "Tenta reparar o volume principal", "os": { "mac": "diskutil repairVolume /" } },
                        { "id": "cmd-lin-fsck", "label": "Verificar Disco (Terminal)", "desc": "Verifica /dev/sda1 (substituir)", "os": { "linux": "sudo fsck /dev/sda1" } },
                        { "id": "cmd-lin-logs", "label": "Ver Logs do Sistema (Terminal)", "desc": "Mostra os logs em tempo real", "os": { "linux": "journalctl -f" } },
                        { "id": "cmd-lin-dmesg", "label": "Ver Logs de Hardware (Terminal)", "desc": "Mostra mensagens do kernel (drivers, hardware)", "os": { "linux": "dmesg -H" } }
                    ]
                },
                {
                    "title": "Gestão de Pacotes e Software",
                    "commands": [
                        { "id": "cmd-appwiz", "label": "Adicionar/Remover Programas (GUI)", "desc": null, "os": { "win": "appwiz.cpl" } },
                        { "id": "cmd-winget-list", "label": "Listar Programas (Winget)", "desc": "Mostra todos os pacotes instalados via Winget", "os": { "win": "winget list" } },
                        { "id": "cmd-brew-list", "label": "Listar Programas (Brew)", "desc": "Mostra todos os pacotes instalados via Homebrew", "os": { "mac": "brew list" } },
                        { "id": "cmd-apt-list", "label": "Listar Programas (Apt)", "desc": "Mostra todos os pacotes instalados via Apt", "os": { "linux": "apt list --installed" } },
                        { "id": "cmd-snap-list", "label": "Listar Programas (Snap)", "desc": "Mostra todos os pacotes instalados via Snap", "os": { "linux": "snap list" } }
                    ]
                },
                {
                    "title": "Gestão de Ficheiros (Terminal)",
                    "commands": [
                        { "id": "cmd-dir", "label": "Listar Ficheiros", "desc": null, "os": { "win": "dir", "mac": "ls -la", "linux": "ls -la" } },
                        { "id": "cmd-cd", "label": "Mudar de Pasta", "desc": "Substitua 'NOME_DA_PASTA'", "os": { "win": "cd NOME_DA_PASTA", "mac": "cd NOME_DA_PASTA", "linux": "cd NOME_DA_PASTA" } },
                        { "id": "cmd-mkdir", "label": "Criar Pasta", "desc": "Substitua 'NOME_DA_PASTA'", "os": { "win": "mkdir NOME_DA_PASTA", "mac": "mkdir NOME_DA_PASTA", "linux": "mkdir NOME_DA_PASTA" } },
                        { "id": "cmd-del", "label": "Apagar Ficheiro", "desc": "Substitua 'NOME_DO_FICHEIRO'", "os": { "win": "del NOME_DO_FICHEIRO", "mac": "rm NOME_DO_FICHEIRO", "linux": "rm NOME_DO_FICHEIRO" } },
                        { "id": "cmd-rmdir", "label": "Apagar Pasta (Vazia)", "desc": "Substitua 'NOME_DA_PASTA'", "os": { "win": "rmdir NOME_DA_PASTA", "mac": "rmdir NOME_DA_PASTA", "linux": "rmdir NOME_DA_PASTA" } },
                        { "id": "cmd-del-force", "label": "Forçar Apagar Pasta (Admin)", "desc": "Apaga a pasta e tudo o que está dentro. CUIDADO!", "os": { "win": "rmdir /s /q NOME_DA_PASTA", "mac": "sudo rm -rf NOME_DA_PASTA", "linux": "sudo rm -rf NOME_DA_PASTA" } },
                        { "id": "cmd-find", "label": "Procurar Ficheiro (Terminal)", "desc": "Substitua [nome]", "os": { "win": "dir [nome] /s", "mac": "find . -name [nome]", "linux": "find . -name [nome]" } },
                        { "id": "cmd-chmod", "label": "Alterar Permissões (Admin)", "desc": "Exemplo: dar permissão de execução a um script", "os": { "mac": "chmod +x [script.sh]", "linux": "chmod +x [script.sh]" } }
                    ]
                }
            ];

            // --- 1. A LÓGICA DO "BAÚ" ---
            let currentOS = 'auto'; // 'auto', 'win', 'mac', 'linux'

            // VARIÁVEIS DE REDIMENSIONAMENTO
            const MIN_WIDTH = 300;
            const MIN_HEIGHT = 200;
            let resizeHandle;

            const ICONS = {
                COMPUTER: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" class="bau-svg-icon"><path d="M20 18c1.1 0 1.99-.9 1.99-2L22 6c0-1.1-.9-2-2-2H4c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2H0v2h24v-2h-4zM4 6h16v10H4V6z"/></svg>`,
                CLOSE: `<svg class="bau-svg-icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor"><path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12 19 6.41z"/></svg>`,
            };

            const DESIGN_COLORS = {
                '--cor-acento-primario': '#00BFFF', '--cor-acento-hover': '#40E0D0', '--cor-acento-texto': '#0D1117', '--cor-fundo-primario': '#0D1117', '--cor-fundo-secundario': '#161B22', '--cor-fundo-terciario': '#21262D', '--cor-fundo-hover': '#21262d55', '--cor-borda': '#30363D', '--cor-texto-primario': '#C9D1D9', '--cor-texto-secundario': '#8B949E', '--cor-texto-desabilitado': '#484F58', '--cor-perigo': '#F47067', '--cor-perigo-hover': '#FF8080', '--cor-sucesso': '#3FB950', '--cor-info': '#58A6FF', '--glow-color': 'rgba(0, 191, 255, 0.2)', '--glow-hover-color': 'rgba(64, 224, 208, 0.3)', '--sombra-popup': '0 0 15px rgba(0, 191, 255, 0.1), 0 4px 8px rgba(0,0,0,0.3)'
            };

            function applyThemeColors(colors) {
                const root = document.documentElement;
                if (!colors) return;
                for (const [key, value] of Object.entries(colors)) {
                    if (key.startsWith('--')) {
                        root.style.setProperty(key, value);
                    }
                }
            }

            function getActiveOS() {
                if (currentOS !== 'auto') {
                    return currentOS;
                }
                const platform = navigator.platform.toLowerCase();
                if (platform.includes('win')) return 'win';
                if (platform.includes('mac')) return 'mac';
                if (platform.includes('linux')) return 'linux';
                return 'unknown';
            }

            function openBauTab(evt, tabName) {
                let i, tabcontent, tablinks;
                tabcontent = document.getElementsByClassName("bau-tab-content");
                for (i = 0; i < tabcontent.length; i++) tabcontent[i].style.display = "none";

                tablinks = document.getElementsByClassName("bau-sidebar-btn"); // Original

                for (i = 0; i < tablinks.length; i++) tablinks[i].className = tablinks[i].className.replace(" active", "");
                document.getElementById(tabName).style.display = "block";
                evt.currentTarget.className += " active";
            }

            function copyCommand(inputId, buttonElement) {
                const inputElement = document.getElementById(inputId);
                const copyButton = buttonElement;

                inputElement.select();

                try {
                    navigator.clipboard.writeText(inputElement.value).then(() => {
                        const originalText = copyButton.textContent;
                        copyButton.textContent = 'Copiado!';
                        copyButton.style.backgroundColor = 'var(--cor-sucesso)';
                        setTimeout(() => {
                            copyButton.textContent = originalText;
                            if (copyButton.id.includes('install')) copyButton.style.backgroundColor = 'var(--cor-sucesso)';
                            else if (copyButton.id.includes('force-auto')) copyButton.style.backgroundColor = 'var(--cor-sucesso)';
                            else if (copyButton.id.includes('force-1g')) copyButton.style.backgroundColor = 'var(--cor-perigo)';
                            else if (copyButton.classList.contains('run-test')) copyButton.style.backgroundColor = 'var(--cor-info)';
                            else copyButton.style.backgroundColor = 'var(--cor-acento-primario)';
                        }, 2000);
                    });
                } catch (e) {
                    alert("Não foi possível copiar. Por favor, copie manualmente (Ctrl+C).");
                }
            }

            // ***
            // *** FUNÇÃO makeDraggable ATUALIZADA (ORIGINAL PARA A JANELA)
            // ***
            function makeDraggable(element, header, onClickCallback) {
                if (!header) header = element;
                let isDragging = false, dragOffsetX = 0, dragOffsetY = 0;

                let moveHandler = (e) => {
                    if (!isDragging) return;
                    e.preventDefault();

                    let newLeft = e.clientX - dragOffsetX;
                    let newTop = e.clientY - dragOffsetY;

                    const rect = element.getBoundingClientRect();
                    if (newLeft < 0) newLeft = 0;
                    if (newTop < 0) newTop = 0;
                    if (newLeft + rect.width > window.innerWidth) newLeft = window.innerWidth - rect.width;
                    if (newTop + rect.height > window.innerHeight) newTop = window.innerHeight - rect.height;

                    element.style.left = newLeft + 'px';
                    element.style.top = newTop + 'px';
                };

                let upHandler = () => {
                    if (isDragging) {
                        isDragging = false;
                    }
                };

                header.addEventListener('mousedown', (e) => {
                    if (e.target.tagName === 'BUTTON' || e.target.tagName === 'INPUT' || e.target.closest('.os-btn') || e.target.closest('button')) return;
                    e.preventDefault();
                    isDragging = true;

                    element.style.transition = 'none';
                    element.style.transform = 'none';
                    element.style.margin = '0';

                    const rect = element.getBoundingClientRect();
                    element.style.left = rect.left + 'px';
                    element.style.top = rect.top + 'px';
                    element.style.bottom = 'auto';
                    element.style.right = 'auto';

                    dragOffsetX = e.clientX - rect.left;
                    dragOffsetY = e.clientY - rect.top;
                }, { passive: false });

                // Ensure we don't bind multiple identical listeners if makeDraggable is called multiple times on the same element
                // A quick hack is just bind it globally, it naturally ignores when isDragging is false.
                document.addEventListener('mousemove', moveHandler, { passive: false });
                document.addEventListener('mouseup', upHandler);
            }

            // ***
            // *** FUNÇÃO makeResizable (ORIGINAL)
            // ***
            function makeResizable(element, handle) {
                let startX, startY, startWidth, startHeight;

                handle.onmousedown = function (e) {
                    e = e || window.event;
                    e.preventDefault();

                    startX = e.clientX;
                    startY = e.clientY;
                    startWidth = parseInt(document.defaultView.getComputedStyle(element).width, 10);
                    startHeight = parseInt(document.defaultView.getComputedStyle(element).height, 10);

                    element.style.transition = 'none';

                    document.onmousemove = resizeElement;
                    document.onmouseup = stopResize;
                };

                function resizeElement(e) {
                    e = e || window.event;
                    e.preventDefault();

                    let newWidth = startWidth + e.clientX - startX;
                    let newHeight = startHeight + e.clientY - startY;

                    // Aplicar limites mínimos
                    if (newWidth > MIN_WIDTH) {
                        element.style.width = newWidth + 'px';
                    }
                    if (newHeight > MIN_HEIGHT) {
                        element.style.height = newHeight + 'px';

                        // Ajustar a altura do body da janela para que o conteúdo preencha a nova altura
                        const headerHeight = parseInt(document.defaultView.getComputedStyle(document.getElementById('bau-rede-header')).height, 10);
                        const newBodyHeight = newHeight - headerHeight - 1; // 1px para a borda
                        document.getElementById('bau-rede-body').style.height = newBodyHeight + 'px';
                    }
                }

                function stopResize() {
                    element.style.transition = 'var(--transicao-padrao)';
                    document.onmousemove = null;
                    document.onmouseup = null;
                }
            }
            // *** FIM DAS FUNÇÕES PRINCIPAIS ***

            function escapeHTML(str) {
                if (str === null || str === undefined) return '';
                return str.replace(/[&<>"']/g, function (m) {
                    return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' }[m];
                });
            }

            // --- 2. O ESTILO (CSS) V20.1 (ORIGINAL) ---
            const styles = `
        :root {
            --raio-borda: 4px;
            --transicao-padrao: all 0.2s ease-in-out;
        }
        
        /* *** BOTÃO FLUTUANTE *** */
        #bau-trigger-button {
            position: fixed;
            width: 48px; /* Aumentado */
            height: 48px; /* Aumentado */
            bottom: 20px;
            right: 20px;
            background: linear-gradient(145deg, var(--cor-fundo-terciario), var(--cor-fundo-primario));
            color: var(--cor-acento-primario);
            border: 1px solid var(--cor-borda);
            border-radius: 50%;
            font-size: 24px; /* Aumentado */
            cursor: pointer;
            box-shadow: 0 5px 15px rgba(0,0,0,0.5), 0 0 5px var(--glow-color) inset;
            z-index: 2147483646;
            display: flex;
            align-items: center;
            justify-content: center;
            transition: var(--transicao-padrao);
            user-select: none;
        }
        #bau-trigger-button:hover {
            transform: scale(1.1);
            box-shadow: 0 8px 20px rgba(0,0,0,0.6), 0 0 15px var(--glow-color), 0 0 8px var(--glow-color) inset;
            border-color: var(--cor-acento-hover);
        }
        .bau-svg-icon { width: 1.2em; height: 1.2em; fill: currentColor; }
        
        #bau-rede { 
            position: fixed; 
            z-index: 2147483647; 
            background-color: var(--cor-fundo-primario); 
            border: 1px solid var(--cor-borda); 
            text-align: left; 
            top: 10%; 
            left: 10%; 
            width: 700px; /* Aumentado */
            height: 550px; /* Aumentado */
            font-family: 'Segoe UI', Tahoma, sans-serif; 
            box-shadow: var(--sombra-popup); 
            border-radius: 8px; 
            color: var(--cor-texto-primario); 
            overflow: hidden; 
            display: none; 
        }
        
        /* CABEÇALHO V20.1 */
        #bau-rede-header { 
            padding: 12px 18px; /* Aumentado */ 
            cursor: move; 
            z-index: 10; 
            background-color: var(--cor-fundo-secundario); 
            border-bottom: 1px solid var(--cor-borda); 
            line-height: 28px; /* Aumentado */
            display: flex; 
            justify-content: space-between; 
            align-items: center;
            flex-shrink: 0;
            height: 50px; /* Altura fixa para cálculo do redimensionamento */
        }
        #bau-rede-header h1 { 
            font-size: 18px; /* Aumentado */
            margin: 0; 
            padding: 0; 
            font-weight: 600;
            display: inline-block;
            vertical-align: middle;
        }
        /* Grupo de botões da direita */
        .header-controls-group {
            display: flex;
            align-items: center;
            gap: 15px; /* Aumentado */
        }
        .window-controls { }
        .window-controls span { cursor: pointer; font-weight: bold; font-size: 20px; /* Aumentado */ color: var(--cor-texto-secundario); margin-left: 10px; /* Aumentado */ transition: color 0.2s; font-family: monospace; vertical-align: middle; }
        .window-controls span:hover { color: var(--cor-perigo-hover); }
        
        /* *** CORREÇÃO DE LAYOUT: FORÇAR OS BOTÕES A FICAREM NA LINHA *** */
        .os-switcher { 
            display: flex; 
            align-items: center;
            vertical-align: middle;
        }
        .os-btn {
            background: var(--cor-fundo-primario);
            color: var(--cor-texto-secundario);
            border: 1px solid var(--cor-borda);
            padding: 4px 10px; /* Aumentado */
            font-size: 13px; /* Aumentado */
            border-radius: 5px; cursor: pointer; margin: 0 3px; transition: all 0.2s;
        }
        .os-btn:hover { background: var(--cor-fundo-hover); color: var(--cor-texto-primario); }
        .os-btn.active { background: var(--cor-acento-primario); color: var(--cor-acento-texto); border-color: var(--cor-acento-primario); font-weight: bold; }
        
        /* ALÇAS DE REDIMENSIONAMENTO */
        .bau-resizer-handle {
            position: absolute;
            z-index: 2147483649; 
            background: transparent;
        }
        .bau-resizer-se { 
            bottom: -5px; 
            right: -5px; 
            width: 15px; 
            height: 15px; 
            cursor: nwse-resize; 
        }

        /* Layout original (barra lateral) */
        #bau-rede-body { 
            display: flex; 
            height: calc(100% - 51px); /* 50px do header + 1px da borda */
            flex-grow: 1; 
        }
        
        .bau-sidebar { flex-basis: 160px; /* Aumentado */ flex-shrink: 0; background-color: var(--cor-fundo-secundario); padding: 10px 0; border-right: 1px solid var(--cor-borda); overflow-y: auto; }
        
        .bau-sidebar-btn { 
            background-color: transparent; 
            display: block; 
            width: 100%; 
            border: none; 
            outline: none; 
            cursor: pointer; 
            padding: 15px 20px; /* Aumentado */
            transition: 0.3s; 
            font-size: 15px; /* Aumentado */
            color: var(--cor-texto-secundario); 
            text-align: left; 
            border-left: 4px solid transparent; 
        }
        .bau-sidebar-btn:hover { color: var(--cor-texto-primario); background-color: var(--cor-fundo-hover); }
        .bau-sidebar-btn.active { 
            color: var(--cor-acento-primario); 
            background-color: var(--cor-fundo-primario); 
            border-left: 4px solid var(--cor-acento-primario); 
            font-weight: bold; 
        }
        .bau-sidebar-divider { height: 1px; background-color: var(--cor-borda); margin: 10px; /* Aumentado */ }
        .bau-sidebar-divider.testes-internos { border-top: 1px dashed var(--cor-borda); height: auto; margin: 10px 0; /* Aumentado */ }
        
        /* Wrapper de Conteúdo (Original) */
        .bau-content-wrapper { display: flex; flex-direction: column; flex-grow: 1; overflow: hidden; background: var(--cor-fundo-primario); }
        .bau-content-area { 
            flex-grow: 1; 
            padding: 20px; /* Aumentado */
            overflow-y: auto; 
        }

        .bau-tab-content { display: none; }
        .bau-tab-content p, .bau-tab-content label { font-size: 14px; /* Aumentado */ color: var(--cor-texto-secundario); margin-top: 0; margin-bottom: 8px; /* Aumentado */ display: block; }
        .bau-tab-content input[type="text"] { width: 95%; padding: 10px; /* Aumentado */ margin-bottom: 15px; /* Aumentado */ font-family: "Courier New", monospace; border: 1px solid var(--cor-borda); border-radius: var(--raio-borda); background-color: var(--cor-fundo-secundario); color: var(--cor-texto-primario); font-size: 16px; /* Aumentado */ }
        .input-group { display: flex; justify-content: space-between; }
        .input-half { width: 45% !important; }
        .bau-tab-content h3 { color: var(--cor-texto-primario); font-size: 18px; /* Aumentado */ margin-top: 20px; margin-bottom: 15px; /* Aumentado */ }
        .bau-tab-content h4 { color: var(--cor-texto-primario); border-bottom: 1px solid var(--cor-borda); padding-bottom: 5px; /* Aumentado */ margin-top: 25px; /* Aumentado */ font-size: 16px; /* Aumentado */ }
        .bau-tab-content ul { color: var(--cor-texto-secundario); padding-left: 20px; /* Aumentado */ font-size: 14px; /* Aumentado */ }
        .bau-tab-content li { margin-bottom: 5px; /* Aumentado */ }
        .bau-tab-content code { background: var(--cor-fundo-secundario); padding: 2px 5px; border-radius: 3px; font-family: "Courier New", monospace; }

        .bau-tab-content button { background-color: var(--cor-acento-primario); color: var(--cor-acento-texto); padding: 12px 15px; /* Aumentado */ border: none; border-radius: var(--raio-borda); cursor: pointer; font-size: 16px; /* Aumentado */ font-weight: bold; width: auto; transition: var(--transicao-padrao); }
        .bau-tab-content button:hover { background-color: var(--cor-acento-hover); box-shadow: 0 0 10px var(--glow-hover-color); }
        
        .command-block { margin-bottom: 15px; /* Aumentado */ }
        .command-block label { font-size: 14px; /* Aumentado */ color: var(--cor-texto-primario); }
        .command-block p { font-size: 12px; /* Aumentado */ color: var(--cor-texto-secundario); margin-bottom: 5px; /* Aumentado */ }
        .command-block input { margin-bottom: 8px; /* Aumentado */ }
        .command-block button { width: 95%; }

        .bau-installer-box { background-color: var(--cor-fundo-terciario); border: 1px solid var(--cor-borda); border-radius: var(--raio-borda); padding: 15px; /* Aumentado */ margin-top: 20px; /* Aumentado */ }
        .bau-installer-box label { font-size: 16px; /* Aumentado */ color: var(--cor-texto-primario); font-weight: bold; }
        .bau-installer-box p { font-size: 12px; /* Aumentado */ color: var(--cor-texto-secundario); margin-bottom: 10px; /* Aumentado */ }

        .bau-warning-box { background-color: var(--cor-fundo-terciario); border-left: 4px solid var(--cor-perigo); border-radius: var(--raio-borda); padding: 15px; /* Aumentado */ margin-top: 20px; /* Aumentado */ }
        .bau-warning-box h4 { font-size: 16px; /* Aumentado */ color: var(--cor-perigo); margin: 0 0 10px 0; /* Aumentado */ }
        .bau-warning-box p { font-size: 12px; /* Aumentado */ color: var(--cor-texto-secundario); margin-bottom: 10px; /* Aumentado */ }
        .bau-warning-box label { font-size: 14px; /* Aumentado */ color: var(--cor-texto-primario); font-weight: bold; }

        .registro-box { width: 95%; height: 60px; /* Aumentado */ background: var(--cor-fundo-secundario); color: var(--cor-texto-primario); border: 1px solid var(--cor-borda); border-radius: var(--raio-borda); font-family: "Courier New", monospace; margin-bottom: 10px; /* Aumentado */ padding: 8px; /* Aumentado */ font-size: 14px; /* Aumentado */ }
        .teste-interno-output { width: 95%; height: 100px; /* Aumentado */ background: var(--cor-fundo-secundario); color: var(--cor-texto-primario); border: 1px solid var(--cor-borda); border-radius: var(--raio-borda); font-family: "Courier New", monospace; padding: 10px; /* Aumentado */ white-space: pre-wrap; word-wrap: break-word; font-size: 16px; /* Aumentado */ }

        .bau-radio-group { margin-bottom: 15px; /* Aumentado */ }
        .bau-radio-group label { display: inline-block; margin-right: 20px; /* Aumentado */ color: var(--cor-texto-primario); cursor: pointer; font-size: 12px; /* Aumentado */ }
        .bau-radio-group input[type="radio"] { margin-right: 5px; /* Aumentado */ vertical-align: middle; accent-color: var(--cor-acento-primario); }
        .bau-divider-horizontal { height: 1px; background-color: var(--cor-borda); margin: 30px 0 20px 0; /* Aumentado */ }
        
        .os-commands-block { display: block !important; } /* CORREÇÃO FINAL DE VISIBILIDADE */
        
        #import-export-box { padding: 15px; margin-top: 20px; }
        #import-export-box button { margin-right: 10px; padding: 8px 12px; font-size: 13px; }
        #import-json-area { display: none; width: 95%; height: 150px; margin-top: 10px; background: var(--cor-fundo-secundario); color: var(--cor-texto-primario); font-size: 13px; padding: 8px; }
    `;

            // --- 3. O CONTEÚDO (HTML) V20.1 (Criado via DOM) ---

            const bauElement = document.createElement('div');
            bauElement.id = 'bau-rede';
            bauElement.style.display = 'none'; // Começa escondido

            // -- Header --
            const header = document.createElement('div');
            header.id = 'bau-rede-header';
            const title = document.createElement('h1');
            title.textContent = 'Baú de Acesso Remoto - BAR';
            header.appendChild(title);

            const headerControlsGroup = document.createElement('div');
            headerControlsGroup.className = 'header-controls-group';

            const osSwitcher = document.createElement('div');
            osSwitcher.className = 'os-switcher';
            const btnAuto = document.createElement('button');
            btnAuto.className = 'os-btn active';
            btnAuto.id = 'os-auto';
            btnAuto.textContent = 'Auto';
            osSwitcher.appendChild(btnAuto);
            const btnWin = document.createElement('button');
            btnWin.className = 'os-btn';
            btnWin.id = 'os-win';
            btnWin.textContent = 'Win';
            osSwitcher.appendChild(btnWin);
            const btnMac = document.createElement('button');
            btnMac.className = 'os-btn';
            btnMac.id = 'os-mac';
            btnMac.textContent = 'Mac';
            osSwitcher.appendChild(btnMac);
            const btnLin = document.createElement('button');
            btnLin.className = 'os-btn';
            btnLin.id = 'os-lin';
            btnLin.textContent = 'Lin';
            osSwitcher.appendChild(btnLin);
            headerControlsGroup.appendChild(osSwitcher);

            const controls = document.createElement('div');
            controls.className = 'window-controls';
            const closeBtn = document.createElement('span');
            closeBtn.id = 'bau-close-btn';
            closeBtn.title = 'Fechar Baú';
            closeBtn.innerHTML = ICONS.CLOSE;
            controls.appendChild(closeBtn);
            headerControlsGroup.appendChild(controls);

            header.appendChild(headerControlsGroup);
            bauElement.appendChild(header);

            // -- Body --
            const body = document.createElement('div');
            body.id = 'bau-rede-body';

            // -- Sidebar --
            const sidebar = document.createElement('div');
            sidebar.className = 'bau-sidebar';

            // Lista de abas
            const tabs = [
                { id: 'btn-tab-info', text: 'Info' },
                { id: 'btn-tab-ip-publico', text: 'IP Público' },
                { id: 'btn-tab-velocidade', text: 'Velocidade' },
                { id: 'divider-1', text: '' },
                { id: 'btn-tab-placa-rede', text: 'Placa de Rede' },
                { id: 'btn-tab-ping', text: 'Ping' },
                { id: 'btn-tab-traceroute', text: 'Traceroute' },
                { id: 'btn-tab-pathping', text: 'PathPing/MTR' },
                { id: 'btn-tab-dns', text: 'DNS' },
                { id: 'btn-tab-nmap', text: 'Nmap' },
                { id: 'btn-tab-test-port', text: 'Testar Porta' },
                { id: 'btn-tab-arp', text: 'ARP' },
                { id: 'btn-tab-route', text: 'Route' },
                { id: 'btn-tab-netstat', text: 'Netstat' },
                { id: 'btn-tab-atualizacoes', text: 'Atualizações' },
                { id: 'btn-tab-comandos', text: 'Comandos' },
                { id: 'divider-2', text: '' },
                { id: 'btn-tab-registro', text: 'Registro' }
            ];

            tabs.forEach(tab => {
                if (tab.id.startsWith('divider')) {
                    const divider = document.createElement('div');
                    divider.className = (tab.id === 'divider-1') ? 'bau-sidebar-divider testes-internos' : 'bau-sidebar-divider';
                    sidebar.appendChild(divider);
                } else {
                    const btn = document.createElement('button');
                    btn.className = 'bau-sidebar-btn';
                    btn.id = tab.id;
                    btn.textContent = tab.text;
                    sidebar.appendChild(btn);
                }
            });
            body.appendChild(sidebar); // Adicionado ao 'body'

            // -- Content Wrapper --
            const contentWrapper = document.createElement('div');
            contentWrapper.className = 'bau-content-wrapper';

            // -- Content Area --
            const contentArea = document.createElement('div');
            contentArea.className = 'bau-content-area';

            // *** ALÇA DE REDIMENSIONAMENTO (Handle) ***
            resizeHandle = document.createElement('div');
            resizeHandle.className = 'bau-resizer-handle bau-resizer-se';
            bauElement.appendChild(resizeHandle);
            // *** FIM DA ALÇA DE REDIMENSIONAMENTO ***

            // (Funções Helper de criação de elementos)
            function createTabContent(id, titleText) { const d = document.createElement('div'); d.id = id; d.className = 'bau-tab-content'; const h = document.createElement('h3'); h.textContent = titleText; d.appendChild(h); return d; }
            function createP(text) { const p = document.createElement('p'); p.textContent = text; return p; }
            function createH4(text) { const h = document.createElement('h4'); h.textContent = text; return h; }
            function createUL() { return document.createElement('ul'); }
            function createLI(text) { const l = document.createElement('li'); l.textContent = text; return l; }
            function createLabel(text) { const l = document.createElement('label'); l.textContent = text; return l; }
            function createInput(id, value, isReadOnly = false, className) { const i = document.createElement('input'); i.type = 'text'; i.id = id; if (value) i.value = value; if (isReadOnly) i.readOnly = true; if (className) i.className = className; return i; }
            function createButton(id, text, className) { const b = document.createElement('button'); b.id = id; b.textContent = text; if (className) b.className = className; return b; }
            function createTextarea(id, placeholder, className = 'registro-box') { const t = document.createElement('textarea'); t.id = id; t.className = className; t.placeholder = placeholder; return t; }
            function createPre(id, text) { const p = document.createElement('pre'); p.id = id; p.className = 'teste-interno-output'; if (text) p.textContent = text; return p; }
            function createCommandEntry(os, label, desc, cmd, id) {
                const div = document.createElement('div');
                div.className = 'command-block os-commands-block os-' + os;
                div.appendChild(createLabel(label));
                if (desc) div.appendChild(createP(desc));
                const inputId = `${os}-${id}`;
                div.appendChild(createInput(inputId, cmd, true));
                const btn = createButton('copy-' + id, 'Copiar Comando', 'bau-copy-btn');
                btn.setAttribute('data-input-id', inputId);
                div.appendChild(btn);
                return div;
            }
            function createInstallerBox(idPrefix, descId, inputId, btnId) {
                const box = document.createElement('div'); box.id = idPrefix + '-installer-box'; box.className = 'bau-installer-box';
                box.appendChild(createLabel('Instalação (Se necessário)'));
                const descP = document.createElement('p'); descP.id = descId; box.appendChild(descP);
                box.appendChild(createInput(inputId, '', true));
                const btn = createButton(btnId, 'Copiar Comando de Instalação', 'bau-copy-btn');
                btn.setAttribute('data-input-id', inputId);
                box.appendChild(btn);
                return box;
            }
            function createWarningBox(content) {
                const box = document.createElement('div'); box.className = 'bau-warning-box';
                const h4 = document.createElement('h4'); h4.textContent = 'Avançado: Forçar Velocidade (Risco)'; box.appendChild(h4);
                box.appendChild(createP('AVISO: Só use isto se souber o que está a fazer. Se forçar 1.0 Gbps e o seu cabo/router não suportar, a sua rede VAI FALHAR. Use o comando "Voltar ao Automático" para reverter.'));
                box.appendChild(createP('No Mac, o "Nome da Placa" é o "Service Name" (ex: "Ethernet"). Encontre-o com: networksetup -listallnetworkservices'));
                box.appendChild(createLabel('1. Nome da Placa (visto no teste acima):'));
                box.appendChild(createInput('placa-nome-input', '', false));
                box.appendChild(createLabel('2. Comando (Admin) para Forçar 1 Gbps Full:'));
                box.appendChild(createInput('placa-force-1g-cmd', '', true));
                const btn1g = createButton('copy-placa-force-1g-btn', 'Copiar Comando (Admin)', 'bau-copy-btn');
                btn1g.setAttribute('data-input-id', 'placa-force-1g-cmd');
                box.appendChild(btn1g);
                box.appendChild(createLabel('3. Comando (Admin) para Voltar ao Automático:'));
                box.appendChild(createInput('placa-force-auto-cmd', '', true));
                const btnAuto = createButton('copy-placa-force-auto-btn', 'Copiar Comando (Admin)', 'bau-copy-btn auto-btn');
                btnAuto.setAttribute('data-input-id', 'placa-force-auto-cmd');
                box.appendChild(btnAuto);
                return box;
            }

            // --- Aba de Informação ---
            const tabInfo = createTabContent('tab-info', 'Informações');
            tabInfo.appendChild(createP('Bem-vindo ao Baú de Acesso Remoto (BAR). Esta ferramenta ajuda-o a diagnosticar problemas de rede.'));
            tabInfo.appendChild(createH4('Como Usar'));
            const ulUse = createUL();
            ulUse.appendChild(createLI('Testes Internos (IP Público, Velocidade): São executados aqui no navegador. Clique no botão para iniciar.'));
            ulUse.appendChild(createLI('Testes Externos (Ping, Nmap, etc.): O "Baú" gera o comando. Você deve copiá-lo e colá-lo no seu terminal (CMD, PowerShell, etc.).'));
            ulUse.appendChild(createLI('Seletor de SO (Win/Mac/Lin): No topo, pode trocar o sistema para ver os comandos de outra pessoa.'));
            ulUse.appendChild(createLI('Registro: Cole os resultados dos seus testes do terminal nas caixas corretas e gere um relatório para imprimir/salvar.'));
            tabInfo.appendChild(ulUse);
            tabInfo.appendChild(createH4('Como Abrir o Terminal'));
            const ulTerm = createUL();
            ulTerm.appendChild(createLI('Windows: Pressione a tecla Windows + R, digite "cmd" (para Prompt) ou "powershell" (recomendado) e pressione Enter.'));
            ulTerm.appendChild(createLI('Mac: Pressione Cmd + Espaço, digite "Terminal" e pressione Enter.'));
            ulTerm.appendChild(createLI('Linux (Ubuntu): Pressione Ctrl + Alt + T.'));
            tabInfo.appendChild(ulTerm);

            // Caixa de Import/Export
            const ieBox = document.createElement('div');
            ieBox.id = 'import-export-box';
            ieBox.appendChild(createH4('Importar/Exportar Comandos'));
            ieBox.appendChild(createP('Guarde ou carregue o seu banco de dados de comandos em formato JSON.'));
            ieBox.appendChild(createButton('btn-export-json', 'Exportar JSON', 'run-test'));
            ieBox.appendChild(createButton('btn-import-json', 'Importar JSON', 'auto-btn'));
            const importArea = createTextarea('import-json-area', 'Cole o conteúdo do seu comandos.json aqui...');
            importArea.style.display = 'none'; // Começa escondido
            ieBox.appendChild(importArea);
            tabInfo.appendChild(ieBox);

            contentArea.appendChild(tabInfo);


            // --- Abas Internas ---
            const tabIpPublico = createTabContent('tab-ip-publico', 'Descobrir Meu IP Público');
            tabIpPublico.appendChild(createP('Este teste usa uma API (api.ipify.org) para descobrir o seu IP público.'));
            tabIpPublico.appendChild(createButton('btn-descobrir-ip-publico', 'Descobrir IP Público', 'run-test'));
            tabIpPublico.appendChild(createPre('meu-ip-publico-output', 'Clique no botão para iniciar...'));
            contentArea.appendChild(tabIpPublico);

            const tabVelocidade = createTabContent('tab-velocidade', 'Teste de Velocidade');
            tabVelocidade.appendChild(createLabel('Teste Interno (Navegador)'));
            tabVelocidade.appendChild(createP('Este teste baixa um ficheiro para estimar a sua velocidade de download.'));
            const radioGroup = document.createElement('div');
            radioGroup.className = 'bau-radio-group';
            radioGroup.appendChild(createLabel('Tamanho do Ficheiro de Teste:'));
            const sizes = ['10', '50', '100'];
            sizes.forEach(size => {
                const label = document.createElement('label');
                const radio = document.createElement('input');
                radio.type = 'radio'; radio.name = 'speedtest-size'; radio.value = size;
                if (size === '50') radio.checked = true;
                label.appendChild(radio); label.appendChild(document.createTextNode(` ${size} MB`));
                radioGroup.appendChild(label);
            });
            tabVelocidade.appendChild(radioGroup);
            tabVelocidade.appendChild(createButton('btn-teste-velocidade', 'Iniciar Teste de Velocidade', 'run-test'));
            tabVelocidade.appendChild(createPre('velocidade-output', 'Clique no botão para iniciar...'));
            const divider = document.createElement('div');
            divider.className = 'bau-divider-horizontal';
            tabVelocidade.appendChild(divider);
            tabVelocidade.appendChild(createLabel('Teste Externo (Terminal)'));
            tabVelocidade.appendChild(createP('Este comando usa o "speedtest-cli" no seu terminal para um teste mais preciso. Requer instalação.'));
            tabVelocidade.appendChild(createLabel('Comando de Teste:'));
            tabVelocidade.appendChild(createInput('speedtest-command-output', '', true));
            const btnSpdCmd = createButton('copy-speedtest-cmd-btn', 'Copiar Comando', 'bau-copy-btn');
            btnSpdCmd.setAttribute('data-input-id', 'speedtest-command-output');
            tabVelocidade.appendChild(btnSpdCmd);
            tabVelocidade.appendChild(createInstallerBox('speedtest', 'speedtest-installer-desc', 'speedtest-install-command', 'copy-speedtest-install-btn'));
            contentArea.appendChild(tabVelocidade);

            // --- Abas de Comando ---

            const tabPlacaRede = createTabContent('tab-placa-rede', 'Info da Placa de Rede');
            tabPlacaRede.appendChild(createP('Este comando verifica as suas placas de rede ativas, o tipo (Cabo/Wi-Fi) e a velocidade negociada (100/1000 Mbps).'));
            tabPlacaRede.appendChild(createP('NOTA: O comando do Windows deve ser colado no "Prompt de Comando" (CMD).'));
            tabPlacaRede.appendChild(createLabel('1. Comando de Diagnóstico:'));
            tabPlacaRede.appendChild(createInput('placa-rede-command-output', '', true));
            const btnPlaca = createButton('copy-placa-rede-btn', 'Copiar Comando', 'bau-copy-btn');
            btnPlaca.setAttribute('data-input-id', 'placa-rede-command-output');
            tabPlacaRede.appendChild(btnPlaca);
            tabPlacaRede.appendChild(createWarningBox());
            contentArea.appendChild(tabPlacaRede);

            const tabPing = createTabContent('tab-ping', 'Teste de Ping');
            tabPing.appendChild(createP('Este comando testa a latência para um host.'));
            tabPing.appendChild(createLabel('IP ou Host Alvo:'));
            tabPing.appendChild(createInput('ping-host-input', '8.8.8.8'));
            tabPing.appendChild(createLabel('Comando de Teste:'));
            tabPing.appendChild(createInput('ping-command-output', '', true));
            const btnPing = createButton('copy-ping-btn', 'Copiar Comando de Teste', 'bau-copy-btn');
            btnPing.setAttribute('data-input-id', 'ping-command-output');
            tabPing.appendChild(btnPing);
            contentArea.appendChild(tabPing);

            const tabTr = createTabContent('tab-traceroute', 'Teste de Traceroute');
            tabTr.appendChild(createP('Este comando mapeia a rota da sua rede até o host.'));
            tabTr.appendChild(createLabel('IP ou Host Alvo:'));
            tabTr.appendChild(createInput('tr-host-input', 'google.com'));
            tabTr.appendChild(createLabel('Comando de Teste:'));
            tabTr.appendChild(createInput('tr-command-output', '', true));
            const btnTr = createButton('copy-tr-btn', 'Copiar Comando de Teste', 'bau-copy-btn');
            btnTr.setAttribute('data-input-id', 'tr-command-output');
            tabTr.appendChild(btnTr);
            contentArea.appendChild(tabTr);

            const tabPp = createTabContent('tab-pathping', 'Teste de PathPing / MTR');
            tabPp.appendChild(createP('Combina Ping e Traceroute.'));
            tabPp.appendChild(createLabel('IP ou Host Alvo:'));
            tabPp.appendChild(createInput('pp-host-input', 'google.com'));
            tabPp.appendChild(createLabel('Comando de Teste:'));
            tabPp.appendChild(createInput('pp-command-output', '', true));
            const btnPp = createButton('copy-pp-btn', 'Copiar Comando de Teste', 'bau-copy-btn');
            btnPp.setAttribute('data-input-id', 'pp-command-output');
            tabPp.appendChild(btnPp);
            tabPp.appendChild(createInstallerBox('pp', 'pp-installer-desc', 'pp-install-command', 'copy-pp-install-btn'));
            contentArea.appendChild(tabPp);

            const tabNmap = createTabContent('tab-nmap', 'Scan de Portas (Nmap)');
            tabNmap.appendChild(createP('Escaneia portas abertas. Requer instalação prévia.'));
            tabNmap.appendChild(createLabel('IP Alvo (ex: 192.168.1.1):'));
            tabNmap.appendChild(createInput('nmap-host-input', '127.0.0.1'));
            tabNmap.appendChild(createLabel('Comando de Teste:'));
            tabNmap.appendChild(createInput('nmap-command-output', '', true));
            const btnNmap = createButton('copy-nmap-btn', 'Copiar Comando de Teste', 'bau-copy-btn');
            btnNmap.setAttribute('data-input-id', 'nmap-command-output');
            tabNmap.appendChild(btnNmap);
            tabNmap.appendChild(createInstallerBox('nmap', 'nmap-installer-desc', 'nmap-install-command', 'copy-nmap-install-btn'));
            contentArea.appendChild(tabNmap);

            const tabTestPort = createTabContent('tab-test-port', 'Testar Porta Única');
            tabTestPort.appendChild(createP('Verifica rapidamente se uma porta específica está aberta num host.'));
            const inputGroup = document.createElement('div');
            inputGroup.className = 'input-group';
            const hostGroup = document.createElement('div');
            hostGroup.className = 'input-half';
            hostGroup.appendChild(createLabel('IP ou Host Alvo:'));
            hostGroup.appendChild(createInput('port-host-input', 'google.com', false));
            inputGroup.appendChild(hostGroup);
            const portGroup = document.createElement('div');
            portGroup.className = 'input-half';
            portGroup.appendChild(createLabel('Porta (ex: 80, 443):'));
            portGroup.appendChild(createInput('port-num-input', '443', false));
            inputGroup.appendChild(portGroup);
            tabTestPort.appendChild(inputGroup);
            tabTestPort.appendChild(createLabel('Comando de Teste:'));
            tabTestPort.appendChild(createInput('port-command-output', '', true));
            const btnPort = createButton('copy-port-btn', 'Copiar Comando de Teste', 'bau-copy-btn');
            btnPort.setAttribute('data-input-id', 'port-command-output');
            tabTestPort.appendChild(btnPort);
            contentArea.appendChild(tabTestPort);

            const tabNetstat = createTabContent('tab-netstat', 'Conexões Ativas (Netstat)');
            tabNetstat.appendChild(createP('Mostra as conexões de rede ativas na sua máquina.'));
            tabNetstat.appendChild(createLabel('Comando de Teste:'));
            tabNetstat.appendChild(createInput('netstat-command-output', 'netstat -an', true));
            const btnNetstat = createButton('copy-netstat-btn', 'Copiar Comando de Teste', 'bau-copy-btn');
            btnNetstat.setAttribute('data-input-id', 'netstat-command-output');
            tabNetstat.appendChild(btnNetstat);
            contentArea.appendChild(tabNetstat);

            const tabDns = createTabContent('tab-dns', 'Teste de DNS (nslookup)');
            tabDns.appendChild(createP('Verifica a resolução de nomes de domínio para IP.'));
            tabDns.appendChild(createLabel('Domínio para consultar (ex: google.com):'));
            tabDns.appendChild(createInput('dns-host-input', 'google.com', false));
            tabDns.appendChild(createLabel('Comando de Teste:'));
            tabDns.appendChild(createInput('dns-command-output', '', true));
            const btnDns = createButton('copy-dns-btn', 'Copiar Comando de Teste', 'bau-copy-btn');
            btnDns.setAttribute('data-input-id', 'dns-command-output');
            tabDns.appendChild(btnDns);
            contentArea.appendChild(tabDns);

            const tabArp = createTabContent('tab-arp', 'Tabela ARP');
            tabArp.appendChild(createP('Mostra a cache ARP (mapeamento de IP para MAC) da rede local.'));
            tabArp.appendChild(createLabel('Comando de Teste:'));
            tabArp.appendChild(createInput('arp-command-output', 'arp -a', true));
            const btnArp = createButton('copy-arp-btn', 'Copiar Comando de Teste', 'bau-copy-btn');
            btnArp.setAttribute('data-input-id', 'arp-command-output');
            tabArp.appendChild(btnArp);
            contentArea.appendChild(tabArp);

            const tabRoute = createTabContent('tab-route', 'Tabela de Roteamento');
            tabRoute.appendChild(createP('Mostra as rotas de rede do seu sistema.'));
            tabRoute.appendChild(createLabel('Comando de Teste:'));
            tabRoute.appendChild(createInput('route-command-output', '', true));
            const btnRoute = createButton('copy-route-btn', 'Copiar Comando de Teste', 'bau-copy-btn');
            btnRoute.setAttribute('data-input-id', 'route-command-output');
            tabRoute.appendChild(btnRoute);
            contentArea.appendChild(tabRoute);

            const tabAtualizacoes = createTabContent('tab-atualizacoes', 'Atualização de Sistema e Pacotes');
            tabAtualizacoes.appendChild(createP('Manter o sistema e os pacotes atualizados é crucial para a segurança e performance.'));
            const winUpdates1 = document.createElement('div');
            winUpdates1.id = 'win-updates1-cmd';
            winUpdates1.className = 'os-commands-block os-win';
            winUpdates1.appendChild(createLabel('Comando 1 (Windows Update + Drivers):'));
            winUpdates1.appendChild(createInput('win-update-cmd', '', true));
            const btnWinUp = createButton('copy-win-update-cmd', 'Copiar Comando', 'bau-copy-btn');
            btnWinUp.setAttribute('data-input-id', 'win-update-cmd');
            winUpdates1.appendChild(btnWinUp);
            tabAtualizacoes.appendChild(winUpdates1);
            const winUpdates2 = document.createElement('div');
            winUpdates2.id = 'win-updates2-cmd';
            winUpdates2.className = 'os-commands-block os-win';
            winUpdates2.appendChild(createLabel('Comando 2 (Pacotes Winget):'));
            winUpdates2.appendChild(createInput('win-pkg-cmd', '', true));
            const btnWinPkg = createButton('copy-win-pkg-cmd', 'Copiar Comando', 'bau-copy-btn');
            btnWinPkg.setAttribute('data-input-id', 'win-pkg-cmd');
            winUpdates2.appendChild(btnWinPkg);
            tabAtualizacoes.appendChild(winUpdates2);
            const nixUpdates = document.createElement('div');
            nixUpdates.id = 'nix-updates-cmd';
            nixUpdates.className = 'os-commands-block os-mac os-linux';
            nixUpdates.appendChild(createLabel('Comando de Atualização (Mac/Linux):'));
            nixUpdates.appendChild(createInput('nix-update-cmd', '', true));
            const btnNixUp = createButton('copy-nix-update-cmd', 'Copiar Comando', 'bau-copy-btn');
            btnNixUp.setAttribute('data-input-id', 'nix-update-cmd');
            nixUpdates.appendChild(btnNixUp);
            tabAtualizacoes.appendChild(nixUpdates);
            contentArea.appendChild(tabAtualizacoes);

            // Aba Comandos (Container Vazio)
            const tabComandos = createTabContent('tab-comandos', 'Comandos de Acesso Rápido');
            tabComandos.appendChild(createP('Atalhos úteis para ferramentas de sistema (a maioria é para o "Executar" do Windows - Win+R).'));
            contentArea.appendChild(tabComandos);


            // Aba Registro (Atualizada)
            const tabRegistro = createTabContent('tab-registro', 'Registro de Testes');
            tabRegistro.appendChild(createP('Cole o resultado de cada teste na sua caixa correspondente.'));
            tabRegistro.appendChild(createLabel('Resultado do IP Público:'));
            tabRegistro.appendChild(createTextarea('registro-ip-publico-input', 'Cole o resultado do teste "IP Público" aqui...'));
            tabRegistro.appendChild(createLabel('Resultado da Velocidade (Navegador):'));
            tabRegistro.appendChild(createTextarea('registro-velocidade-input', 'Cole o resultado do "Teste de Velocidade" aqui...'));
            tabRegistro.appendChild(createLabel('Resultado da Placa de Rede:'));
            tabRegistro.appendChild(createTextarea('registro-placa-rede-input', 'Cole o resultado do teste da Placa de Rede aqui...'));
            tabRegistro.appendChild(createLabel('Resultado do Ping:'));
            tabRegistro.appendChild(createTextarea('registro-ping-input', 'Cole o resultado do Ping aqui...'));
            tabRegistro.appendChild(createLabel('Resultado do Traceroute:'));
            tabRegistro.appendChild(createTextarea('registro-tr-input', 'Cole o resultado do Traceroute aqui...'));
            tabRegistro.appendChild(createLabel('Resultado do PathPing/MTR:'));
            tabRegistro.appendChild(createTextarea('registro-pp-input', 'Cole o resultado do PathPing/MTR aqui...'));
            tabRegistro.appendChild(createLabel('Resultado do Nmap:'));
            tabRegistro.appendChild(createTextarea('registro-nmap-input', 'Cole o resultado do Nmap aqui...'));
            tabRegistro.appendChild(createLabel('Resultado do Teste de Porta:'));
            tabRegistro.appendChild(createTextarea('registro-test-port-input', 'Cole o resultado do "Teste de Porta" aqui...'));
            tabRegistro.appendChild(createLabel('Resultado do Netstat:'));
            tabRegistro.appendChild(createTextarea('registro-netstat-input', 'Cole o resultado do Netstat aqui...'));
            tabRegistro.appendChild(createLabel('Resultado do DNS (nslookup):'));
            tabRegistro.appendChild(createTextarea('registro-dns-input', 'Cole o resultado do "DNS" aqui...'));
            tabRegistro.appendChild(createLabel('Resultado da Tabela ARP:'));
            tabRegistro.appendChild(createTextarea('registro-arp-input', 'Cole o resultado do "ARP" aqui...'));
            tabRegistro.appendChild(createLabel('Resultado da Tabela de Roteamento:'));
            tabRegistro.appendChild(createTextarea('registro-route-input', 'Cole o resultado do "Route" aqui...'));
            tabRegistro.appendChild(createLabel('Resultado do Speedtest-CLI (Terminal):'));
            tabRegistro.appendChild(createTextarea('registro-speedtest-cli-input', 'Cole o resultado do "speedtest-cli" aqui...'));
            tabRegistro.appendChild(createLabel('Resultado das Atualizações:'));
            tabRegistro.appendChild(createTextarea('registro-updates-input', 'Cole o resultado das atualizações aqui...'));
            tabRegistro.appendChild(createLabel('Resultados dos Comandos:'));
            tabRegistro.appendChild(createTextarea('registro-comandos-input', 'Cole o resultado dos "Comandos" aqui...'));

            tabRegistro.appendChild(document.createElement('br'));
            tabRegistro.appendChild(document.createElement('br'));
            tabRegistro.appendChild(createButton('print-registro-btn', 'Gerar Relatório para Print'));
            contentArea.appendChild(tabRegistro);

            contentWrapper.appendChild(contentArea); // Adiciona a área de conteúdo ao wrapper
            body.appendChild(contentWrapper); // Adiciona o wrapper ao body
            bauElement.appendChild(body); // Adiciona o body ao elemento principal

            // *** ALÇA DE REDIMENSIONAMENTO (Handle) ***
            resizeHandle = document.createElement('div'); // <<< USADO A VARIÁVEL DECLARADA NO INÍCIO
            resizeHandle.className = 'bau-resizer-handle bau-resizer-se';
            bauElement.appendChild(resizeHandle);
            // *** FIM DA ALÇA DE REDIMENSIONAMENTO ***

            // --- 4. INJETAR O BAÚ E O BOTÃO ---
            const styleSheet = document.createElement("style");
            styleSheet.id = "bau-rede-styles";
            styleSheet.innerText = styles;
            document.head.appendChild(styleSheet);
            document.body.appendChild(bauElement);

            // --- 5. ATIVAR A LÓGICA V20.1 ---

            applyThemeColors(DESIGN_COLORS);

            // 2. Torna a janela principal arrastável (JANELA)
            makeDraggable(bauElement, header);

            // 4. Torna a janela redimensionável (usando a nova alça)
            makeResizable(bauElement, resizeHandle);

            // O closeBtn ainda precisa da sua própria função para fechar diretamente.
            closeBtn.onclick = function () {
                bauElement.style.display = 'none';
                if (triggerBtn && getComputedStyle(triggerBtn).opacity !== '0') { // VERIFICACAO NOVA
                    triggerBtn.style.display = 'flex';
                }
            };

            // Event Listener Único para todos os botões "Copiar"
            bauElement.addEventListener('click', function (e) {
                if (e.target.classList.contains('bau-copy-btn')) {
                    const inputId = e.target.getAttribute('data-input-id');
                    if (inputId) {
                        copyCommand(inputId, e.target);
                    }
                }
            });

            // --- Lógica dos Testes Internos ---
            document.getElementById('btn-descobrir-ip-publico').onclick = async function () {
                const btn = document.getElementById('btn-descobrir-ip-publico');
                const output = document.getElementById('meu-ip-publico-output');
                btn.disabled = true; btn.textContent = 'Aguarde...';
                output.textContent = 'A contactar api.ipify.org...';
                try {
                    const response = await safeFetch('https://api.ipify.org');
                    if (!response.ok) throw new Error(`Status da resposta: ${response.status}`);
                    const ip = await response.text();
                    output.textContent = `Seu IP Público é: ${ip}`;
                } catch (e) {
                    output.textContent = `Erro ao encontrar IP: ${e.message}`;
                } finally {
                    btn.disabled = false; btn.textContent = 'Descobrir IP Público';
                }
            };

            document.getElementById('btn-teste-velocidade').onclick = async function () {
                const btn = document.getElementById('btn-teste-velocidade');
                const output = document.getElementById('velocidade-output');
                btn.disabled = true; btn.textContent = 'A testar...';
                const sizeValue = document.querySelector('input[name="speedtest-size"]:checked').value;
                let testUrl, fileSizeInBytes;
                switch (sizeValue) {
                    case '10': testUrl = 'https://cachefly.cachefly.net/10mb.test'; fileSizeInBytes = 10 * 1024 * 1024; break;
                    case '100': testUrl = 'https://cachefly.cachefly.net/100mb.test'; fileSizeInBytes = 100 * 1024 * 1024; break;
                    case '50': default: testUrl = 'https://cachefly.cachefly.net/50mb.test'; fileSizeInBytes = 50 * 1024 * 1024;
                }
                output.textContent = `A iniciar download de ${fileSizeInBytes / 1024 / 1024}MB...`;
                try {
                    const startTime = performance.now();
                    const response = await safeFetch(testUrl + '?t=' + new Date().getTime());
                    if (!response.ok) throw new Error(`Erro no servidor: ${response.status}`);
                    await response.blob();
                    const endTime = performance.now();
                    const durationInSeconds = (endTime - startTime) / 1000;
                    const bitsPerSecond = (fileSizeInBytes * 8) / durationInSeconds;
                    const mbps = (bitsPerSecond / 1000000).toFixed(2);
                    output.textContent = `Velocidade de Download: ${mbps} Mbps\n(Tamanho: ${sizeValue}MB / Tempo: ${durationInSeconds.toFixed(2)}s)`;
                } catch (e) {
                    output.textContent = `Erro no teste: ${e.message}. Tente novamente.`;
                } finally {
                    btn.disabled = false; btn.textContent = 'Iniciar Teste de Velocidade';
                }
            };

            // --- Lógica dos Comandos (Funções de Atualização) ---
            const placaRedeCmdOutput = document.getElementById('placa-rede-command-output');
            const placaNomeInput = document.getElementById('placa-nome-input');
            const placaForce1gCmd = document.getElementById('placa-force-1g-cmd');
            const placaForceAutoCmd = document.getElementById('placa-force-auto-cmd');
            function updatePlacaRedeCmd() {
                const os = getActiveOS();
                if (os === 'win') {
                    placaRedeCmdOutput.value = "powershell -Command \"Get-NetAdapter -Physical | Where-Object Status -eq 'Up' | Format-Table Name, LinkSpeed, MediaType -AutoSize\"";
                } else if (os === 'mac') {
                    placaRedeCmdOutput.value = "system_profiler SPNetworkDataType | grep -E 'Interfaces:|Ethernet:|Type:|Speed:|Media Subtype:'";
                } else { // linux
                    placaRedeCmdOutput.value = "ip a | grep 'state UP' -A 2 && echo \"--- Velocidade Ethernet (1000=1Gbs) ---\" && cat /sys/class/net/e*/speed 2>/dev/null && echo \"--- Info Wi-Fi ---\" && iwconfig 2>/dev/null";
                }
            }
            function updatePlacaForceCmds() {
                const os = getActiveOS();
                const adapterName = placaNomeInput.value || 'NOME_DA_PLACA';
                if (os === 'win') {
                    placaForce1gCmd.value = `powershell -ExecutionPolicy Bypass -Command "Set-NetAdapter -Name '${adapterName}' -SpeedDuplex '1.0 Gbps Full Duplex'"`;
                    placaForceAutoCmd.value = `powershell -ExecutionPolicy Bypass -Command "Set-NetAdapter -Name '${adapterName}' -SpeedDuplex 'AutoNegotiation'"`;
                } else if (os === 'mac') {
                    placaForce1gCmd.value = `sudo networksetup -setmedia '${adapterName}' 1000baseT`;
                    placaForceAutoCmd.value = `sudo networksetup -setmedia '${adapterName}' autoselect`;
                } else { // linux
                    placaForce1gCmd.value = `sudo ethtool -s ${adapterName} speed 1000 duplex full autoneg off`;
                    placaForceAutoCmd.value = `sudo ethtool -s ${adapterName} autoneg on`;
                }
            }
            placaNomeInput.onkeyup = updatePlacaForceCmds;

            const pingHostInput = document.getElementById('ping-host-input');
            const pingCmdOutput = document.getElementById('ping-command-output');
            function updatePingCmd() { const os = getActiveOS(); pingCmdOutput.value = (os === 'win') ? `ping -n 4 ${pingHostInput.value}` : `ping -c 4 ${pingHostInput.value}`; }
            pingHostInput.onkeyup = updatePingCmd;

            const trHostInput = document.getElementById('tr-host-input');
            const trCmdOutput = document.getElementById('tr-command-output');
            function updateTrCmd() { const os = getActiveOS(); trCmdOutput.value = (os === 'win') ? `tracert ${trHostInput.value}` : `traceroute ${trHostInput.value}`; }
            trHostInput.onkeyup = updateTrCmd;

            const ppHostInput = document.getElementById('pp-host-input');
            const ppCmdOutput = document.getElementById('pp-command-output');
            const ppInstallerBox = document.getElementById('pp-installer-box');
            const ppInstallerDesc = document.getElementById('pp-installer-desc');
            const ppInstallCommand = document.getElementById('pp-install-command');
            function updatePpCmd() {
                const os = getActiveOS();
                const host = ppHostInput.value;
                if (os === 'win') {
                    ppCmdOutput.value = `pathping ${host}`;
                    ppInstallerBox.style.display = 'block';
                    ppInstallerDesc.textContent = "O 'pathping' já vem instalado por padrão no Windows.";
                    document.getElementById('copy-pp-install-btn').style.display = 'none';
                } else {
                    ppCmdOutput.value = `mtr -r -c 10 ${host}`;
                    ppInstallerBox.style.display = 'block';
                    document.getElementById('copy-pp-install-btn').style.display = 'block';
                    if (os === 'mac') {
                        ppInstallerDesc.textContent = "Se o 'mtr' não for encontrado, instale-o com Homebrew:";
                        ppInstallCommand.value = "brew install mtr";
                    } else { // linux
                        ppInstallerDesc.textContent = "Se o 'mtr' não for encontrado (Ubuntu/Debian):";
                        ppInstallCommand.value = "sudo apt update && sudo apt install mtr";
                    }
                }
            }
            ppHostInput.onkeyup = updatePpCmd;

            const nmapHostInput = document.getElementById('nmap-host-input');
            const nmapCmdOutput = document.getElementById('nmap-command-output');
            const nmapInstallerDesc = document.getElementById('nmap-installer-desc');
            const nmapInstallCommand = document.getElementById('nmap-install-command');
            function updateNmapCmd() {
                const os = getActiveOS();
                nmapCmdOutput.value = `nmap -sT ${nmapHostInput.value}`;
                if (os === 'win') {
                    nmapInstallerDesc.textContent = "O Nmap precisa de ser instalado. Use o Winget (Windows 10/11):";
                    nmapInstallCommand.value = "winget install Insecure.Nmap";
                } else if (os === 'mac') {
                    nmapInstallerDesc.textContent = "Instale o Nmap com Homebrew:";
                    nmapInstallCommand.value = "brew install nmap";
                } else { // linux
                    nmapInstallerDesc.textContent = "Instale o Nmap (Ubuntu/Debian):";
                    nmapInstallCommand.value = "sudo apt update && sudo apt install nmap";
                }
            }
            nmapHostInput.onkeyup = updateNmapCmd;

            const portHostInput = document.getElementById('port-host-input');
            const portNumInput = document.getElementById('port-num-input');
            const portCmdOutput = document.getElementById('port-command-output');
            function updatePortCmd() {
                const os = getActiveOS();
                const host = portHostInput.value || 'HOST';
                const port = portNumInput.value || 'PORTA';
                if (os === 'win') {
                    portCmdOutput.value = `powershell -Command "Test-NetConnection -ComputerName ${host} -Port ${port}"`;
                } else { // mac/linux
                    portCmdOutput.value = `nc -vz ${host} ${port}`;
                }
            }
            portHostInput.onkeyup = updatePortCmd;
            portNumInput.onkeyup = updatePortCmd;

            const dnsHostInput = document.getElementById('dns-host-input');
            const dnsCmdOutput = document.getElementById('dns-command-output');
            function updateDnsCmd() { dnsCmdOutput.value = `nslookup ${dnsHostInput.value}`; }
            dnsHostInput.onkeyup = updateDnsCmd;

            const arpCmdOutput = document.getElementById('arp-command-output');
            function updateArpCmd() { arpCmdOutput.value = "arp -a"; }

            const routeCmdOutput = document.getElementById('route-command-output');
            function updateRouteCmd() {
                const os = getActiveOS();
                routeCmdOutput.value = (os === 'win') ? "route print" : "netstat -r";
            }

            const speedtestCmdOutput = document.getElementById('speedtest-command-output');
            const speedtestInstallerDesc = document.getElementById('speedtest-installer-desc');
            const speedtestInstallCommand = document.getElementById('speedtest-install-command');
            function updateSpeedtestCmd() {
                const os = getActiveOS();
                speedtestCmdOutput.value = "speedtest.exe"; // Comando para Ookla
                if (os === 'win') {
                    speedtestInstallerDesc.textContent = "Instale com Winget (Windows 10/11):";
                    speedtestInstallCommand.value = "winget install Ookla.Speedtest.CLI";
                } else if (os === 'mac') {
                    speedtestInstallerDesc.textContent = "Instale com Homebrew:";
                    speedtestInstallCommand.value = "brew install speedtest";
                    speedtestCmdOutput.value = "speedtest";
                } else { // linux
                    speedtestInstallerDesc.textContent = "Instale com apt (Ubuntu/Debian):";
                    speedtestInstallCommand.value = "sudo apt update && sudo apt install speedtest-cli";
                    speedtestCmdOutput.value = "speedtest-cli";
                }
            }

            const winUp1 = document.getElementById('win-updates1-cmd');
            const winUp2 = document.getElementById('win-updates2-cmd');
            const nixUp = document.getElementById('nix-updates-cmd');
            const nixUpCmd = document.getElementById('nix-update-cmd');
            function updateAtualizacoesCmd() {
                const os = getActiveOS();
                if (os === 'win') {
                    winUp1.style.display = 'block';
                    winUp2.style.display = 'block';
                    nixUp.style.display = 'none';
                    document.getElementById('win-update-cmd').value = "UsoClient.exe StartScan";
                    document.getElementById('win-pkg-cmd').value = "winget upgrade --all";
                } else {
                    winUp1.style.display = 'none';
                    winUp2.style.display = 'none';
                    nixUp.style.display = 'block';
                    if (os === 'mac') {
                        nixUpCmd.value = "brew update && brew upgrade";
                    } else { // linux
                        nixUpCmd.value = "sudo apt update && sudo apt upgrade -y";
                    }
                }
            }

            // Lógica para a aba Comandos
            const tabComandosContainer = document.getElementById('tab-comandos');
            function populateCommandsTab() {
                const os = getActiveOS();
                while (tabComandosContainer.children.length > 2) { // Limpa mantendo o Título e P
                    tabComandosContainer.removeChild(tabComandosContainer.lastChild);
                }

                window.commandDatabase.forEach(category => {
                    const commandsForOS = category.commands.filter(cmd => cmd.os[os]);
                    if (commandsForOS.length > 0) {
                        tabComandosContainer.appendChild(createH4(category.title));
                        commandsForOS.forEach(cmd => {
                            tabComandosContainer.appendChild(
                                createCommandEntry(os, cmd.label, cmd.desc, cmd.os[os], cmd.id)
                            );
                        });
                    }
                });
            }

            // Lógica da Aba de Registro
            document.getElementById('print-registro-btn').onclick = function () {
                // Coletar dados
                const ipResult = document.getElementById('registro-ip-publico-input').value;
                const velResult = document.getElementById('registro-velocidade-input').value;
                const placaResult = document.getElementById('registro-placa-rede-input').value;
                const pingResult = document.getElementById('registro-ping-input').value;
                const trResult = document.getElementById('registro-tr-input').value;
                const ppResult = document.getElementById('registro-pp-input').value;
                const nmapResult = document.getElementById('registro-nmap-input').value;
                const portResult = document.getElementById('registro-test-port-input').value;
                const netstatResult = document.getElementById('registro-netstat-input').value;
                const dnsResult = document.getElementById('registro-dns-input').value;
                const arpResult = document.getElementById('registro-arp-input').value;
                const routeResult = document.getElementById('registro-route-input').value;
                const speedCliResult = document.getElementById('registro-speedtest-cli-input').value;
                const updatesResult = document.getElementById('registro-updates-input').value;
                const comandosResult = document.getElementById('registro-comandos-input').value;

                const reportWindow = window.open('', 'PrintWindow', 'width=800,height=600');
                reportWindow.document.write('<html><head><title>Relatório de Testes de Rede</title>');
                reportWindow.document.write(`
            <style>
                body { font-family: 'Segoe UI', Tahoma, sans-serif; margin: 20px; /*bg-removido*/; color: #000; }
                pre { font-family: "Courier New", monospace; /*bg-removido*/; padding: 15px; border: 1px solid #ccc; border-radius: 5px; white-space: pre-wrap; word-wrap: break-word; }
                h1 { border-bottom: 2px solid #666; padding-bottom: 5px; color: #333; }
                h2 { /*bg-removido*/; padding: 5px 10px; border-radius: 5px; color: #000; margin-top: 10px; }
                button { /*bg-removido*/; color: white; padding: 10px 15px; border: none; border-radius: 5px; cursor: pointer; font-size: 16px; }
                #report-container { display: flex; flex-wrap: wrap; justify-content: space-between; }
                .test-block { width: 48%; margin-bottom: 20px; vertical-align: top; display: inline-block; page-break-inside: avoid; }
                @media print { .no-print { display: none; } h1, h2 { page-break-after: avoid; } pre { page-break-inside: avoid; } }
            </style>
        `);
                reportWindow.document.write('</head><body>');
                reportWindow.document.write('<h1>Relatório de Testes de Rede</h1>');
                reportWindow.document.write('<p class="no-print">Resultados colados do terminal. Use Ctrl+P para imprimir ou salvar como PDF.</p>');
                reportWindow.document.write('<button class="no-print" onclick="window.print()">Imprimir Relatório / Salvar como PDF</button>');
                reportWindow.document.write('<div id="report-container">');

                if (ipResult) { reportWindow.document.write('<div class="test-block"><h2>Resultado do IP Público</h2><pre>' + escapeHTML(ipResult) + '</pre></div>'); }
                if (velResult) { reportWindow.document.write('<div class="test-block"><h2>Velocidade (Navegador)</h2><pre>' + escapeHTML(velResult) + '</pre></div>'); }
                if (placaResult) { reportWindow.document.write('<div class="test-block"><h2>Resultados da Placa de Rede</h2><pre>' + escapeHTML(placaResult) + '</pre></div>'); }
                if (pingResult) { reportWindow.document.write('<div class="test-block"><h2>Resultados do Ping</h2><pre>' + escapeHTML(pingResult) + '</pre></div>'); }
                if (trResult) { reportWindow.document.write('<div class="test-block"><h2>Resultados do Traceroute</h2><pre>' + escapeHTML(trResult) + '</pre></div>'); }
                if (ppResult) { reportWindow.document.write('<div class="test-block"><h2>Resultados do PathPing / MTR</h2><pre>' + escapeHTML(ppResult) + '</pre></div>'); }
                if (nmapResult) { reportWindow.document.write('<div class="test-block"><h2>Resultados do Nmap</h2><pre>' + escapeHTML(nmapResult) + '</pre></div>'); }
                if (portResult) { reportWindow.document.write('<div class="test-block"><h2>Resultados do Teste de Porta</h2><pre>' + escapeHTML(portResult) + '</pre></div>'); }
                if (netstatResult) { reportWindow.document.write('<div class="test-block"><h2>Resultados do Netstat</h2><pre>' + escapeHTML(netstatResult) + '</pre></div>'); }
                if (dnsResult) { reportWindow.document.write('<div class="test-block"><h2>Resultados do DNS (nslookup)</h2><pre>' + escapeHTML(dnsResult) + '</pre></div>'); }
                if (arpResult) { reportWindow.document.write('<div class="test-block"><h2>Resultados da Tabela ARP</h2><pre>' + escapeHTML(arpResult) + '</pre></div>'); }
                if (routeResult) { reportWindow.document.write('<div class="test-block"><h2>Resultados da Tabela de Roteamento</h2><pre>' + escapeHTML(routeResult) + '</pre></div>'); }
                if (speedCliResult) { reportWindow.document.write('<div class="test-block"><h2>Speedtest-CLI (Terminal)</h2><pre>' + escapeHTML(speedCliResult) + '</pre></div>'); }
                if (updatesResult) { reportWindow.document.write('<div class="test-block"><h2>Resultados das Atualizações</h2><pre>' + escapeHTML(updatesResult) + '</pre></div>'); }
                if (comandosResult) { reportWindow.document.write('<div class="test-block"><h2>Resultados dos Comandos</h2><pre>' + escapeHTML(comandosResult) + '</pre></div>'); }

                reportWindow.document.write('</div>'); // Fecha o container principal
                reportWindow.document.write('</body></html>');
                reportWindow.document.close();
            };

            // --- Lógica de Import/Export ---
            document.getElementById('btn-export-json').onclick = function () {
                try {
                    const jsonString = JSON.stringify(window.commandDatabase, null, 2);
                    const reportWindow = window.open('', 'PrintWindow', 'width=800,height=600');
                    reportWindow.document.write('<html><head><title>Banco de Dados de Comandos JSON</title></head><body>');
                    reportWindow.document.write('<p>Copie este conteúdo ou use Ctrl+S para salvar como comandos.json</p>');
                    reportWindow.document.write('<pre>' + escapeHTML(jsonString) + '</pre>');
                    reportWindow.document.write('</body></html>');
                    reportWindow.document.close();
                } catch (e) {
                    alert('Erro ao exportar: ' + e.message);
                }
            };

            document.getElementById('btn-import-json').onclick = function () {
                const btn = document.getElementById('btn-import-json');
                const area = document.getElementById('import-json-area');

                if (area.style.display === 'none') {
                    area.style.display = 'block';
                    btn.textContent = 'Salvar Importação';
                    btn.style.backgroundColor = 'var(--cor-sucesso)';
                } else {
                    try {
                        const newDB = JSON.parse(area.value);
                        if (Array.isArray(newDB)) {
                            window.commandDatabase = newDB;
                            alert('Sucesso! Banco de dados de comandos importado.');
                            area.value = '';
                            area.style.display = 'none';
                            btn.textContent = 'Importar JSON';
                            btn.style.backgroundColor = 'var(--cor-sucesso)';
                            updateAllCommands();
                            document.getElementById('btn-tab-comandos').click();
                        } else {
                            throw new Error('O JSON não é um array.');
                        }
                    } catch (e) {
                        alert('Erro na importação: O JSON é inválido. ' + e.message);
                    }
                }
            };


            // --- Lógica das Abas (Inicialização) ---
            function updateAllCommands() {
                updatePlacaRedeCmd();
                updatePlacaForceCmds();
                updatePingCmd();
                updateTrCmd();
                updatePpCmd();
                updateNmapCmd();
                updatePortCmd();
                updateDnsCmd();
                updateArpCmd();
                updateRouteCmd();
                updateSpeedtestCmd();
                updateAtualizacoesCmd();
                populateCommandsTab();
            }

            function setOS(os) {
                currentOS = os;
                document.getElementById('os-auto').classList.toggle('active', os === 'auto');
                document.getElementById('os-win').classList.toggle('active', os === 'win');
                document.getElementById('os-mac').classList.toggle('active', os === 'mac');
                document.getElementById('os-lin').classList.toggle('active', os === 'linux');
                updateAllCommands();
            }

            document.getElementById('os-auto').onclick = () => setOS('auto');
            document.getElementById('os-win').onclick = () => setOS('win');
            document.getElementById('os-mac').onclick = () => setOS('mac');
            document.getElementById('os-lin').onclick = () => setOS('linux');

            document.getElementById('btn-tab-info').onclick = (e) => openBauTab(e, 'tab-info');
            document.getElementById('btn-tab-ip-publico').onclick = (e) => openBauTab(e, 'tab-ip-publico');
            document.getElementById('btn-tab-velocidade').onclick = (e) => openBauTab(e, 'tab-velocidade');
            document.getElementById('btn-tab-placa-rede').onclick = (e) => openBauTab(e, 'tab-placa-rede');
            document.getElementById('btn-tab-ping').onclick = (e) => openBauTab(e, 'tab-ping');
            document.getElementById('btn-tab-traceroute').onclick = (e) => openBauTab(e, 'tab-traceroute');
            document.getElementById('btn-tab-pathping').onclick = (e) => openBauTab(e, 'tab-pathping');
            document.getElementById('btn-tab-nmap').onclick = (e) => openBauTab(e, 'tab-nmap');
            document.getElementById('btn-tab-test-port').onclick = (e) => openBauTab(e, 'tab-test-port');
            document.getElementById('btn-tab-netstat').onclick = (e) => openBauTab(e, 'tab-netstat');
            document.getElementById('btn-tab-dns').onclick = (e) => openBauTab(e, 'tab-dns');
            document.getElementById('btn-tab-arp').onclick = (e) => openBauTab(e, 'tab-arp');
            document.getElementById('btn-tab-route').onclick = (e) => openBauTab(e, 'tab-route');
            document.getElementById('btn-tab-atualizacoes').onclick = (e) => openBauTab(e, 'tab-atualizacoes');
            document.getElementById('btn-tab-comandos').onclick = (e) => openBauTab(e, 'tab-comandos');
            document.getElementById('btn-tab-registro').onclick = (e) => openBauTab(e, 'tab-registro');

            // Abre a primeira aba (Info) e preenche todos os comandos
            document.getElementById('btn-tab-info').click();
            updateAllCommands(); // Função unificada

            console.log("Baú de Acesso Remoto (V20.5 - Original + Drag) carregado!");

            // --- 6. BOTÃO FLUTUANTE (MODIFICADO) ---

            // Cria o botão se não existir
            if (window.self === window.top) {
                let triggerBtn = document.getElementById('bau-trigger-button');
                if (!triggerBtn) {
                    triggerBtn = document.createElement('button');
                    triggerBtn.id = 'bau-trigger-button'; 
                    triggerBtn.innerHTML = ICONS.COMPUTER;
                    triggerBtn.title = "Abrir BAR";
                    document.body.appendChild(triggerBtn);
                }

                // 1. CLIQUE (Compatível com Menu Unificado)
                triggerBtn.onclick = function () {
                const janela = document.getElementById('bau-rede');
                if (janela.style.display === 'none' || !janela.style.display) {
                    janela.style.display = 'flex';
                    janela.style.flexDirection = 'column';

                    // Se o botão estiver visível (não controlado pelo Menu Unificado), esconde-o
                    if (getComputedStyle(triggerBtn).display !== 'none' && getComputedStyle(triggerBtn).opacity !== '0') {
                        triggerBtn.style.display = 'none';
                    }
                } else {
                    janela.style.display = 'none';
                    // Mostra o botão de volta (se não controlado pelo Menu Unificado)
                    if (getComputedStyle(triggerBtn).opacity !== '0') {
                        triggerBtn.style.display = 'flex';
                    }
                }
            };

            // 3. ARRASTAR (Lógica simples)
            let isBtnDrag = false;
            let bStartX, bStartY, bInitL, bInitT;

            triggerBtn.onmousedown = function (e) {
                if (e.button !== 0) return;
                isBtnDrag = false;
                bStartX = e.clientX; bStartY = e.clientY;
                const r = triggerBtn.getBoundingClientRect();
                bInitL = r.left; bInitT = r.top;
                triggerBtn.style.transition = 'none';

                function onMove(me) {
                    const dx = me.clientX - bStartX;
                    const dy = me.clientY - bStartY;
                    if (Math.abs(dx) > 5 || Math.abs(dy) > 5) {
                        isBtnDrag = true;
                        triggerBtn.onclick = null; // Desativa clique no arrasto
                        triggerBtn.style.left = (bInitL + dx) + 'px';
                        triggerBtn.style.top = (bInitT + dy) + 'px';
                        triggerBtn.style.right = 'auto'; triggerBtn.style.bottom = 'auto';
                    }
                }
                function onUp() {
                    document.removeEventListener('mousemove', onMove);
                    document.removeEventListener('mouseup', onUp);
                    triggerBtn.style.transition = '';
                    if (isBtnDrag) {
                        localStorage.setItem('bauTriggerPos', JSON.stringify({ left: triggerBtn.style.left, top: triggerBtn.style.top }));
                        setTimeout(() => {
                            triggerBtn.onclick = function () {
                                const j = document.getElementById('bau-rede');
                                if (j.style.display === 'none' || !j.style.display) {
                                    j.style.display = 'flex';
                                    j.style.flexDirection = 'column';
                                    if (getComputedStyle(triggerBtn).display !== 'none' && getComputedStyle(triggerBtn).opacity !== '0') triggerBtn.style.display = 'none';
                                } else {
                                    j.style.display = 'none';
                                    if (getComputedStyle(triggerBtn).opacity !== '0') triggerBtn.style.display = 'flex';
                                }
                            };
                        }, 100);
                    }
                }
                document.addEventListener('mousemove', onMove);
                document.addEventListener('mouseup', onUp);
            };

            // 4. Restaurar Posição
            const savedPos = localStorage.getItem('bauTriggerPos');
            if (savedPos) {
                const p = JSON.parse(savedPos);
                triggerBtn.style.left = p.left;
                triggerBtn.style.top = p.top;
                triggerBtn.style.right = 'auto';
                triggerBtn.style.bottom = 'auto';
            }
        }
    })();

    } catch (e) { console.error('[BUILDER] Erro fatal no módulo bar.js:', e); }

    /* --- MÓDULO ANEXADO: EXTRATOR.JS --- */
    try {
        // ==UserScript==
        // @name         Extrator Pro de CPF/CNPJ (V7.4 - Atalho F2)
        // @namespace    http://tampermonkey.net/
        // @version      7.4
        // @description  Varre Iframes e painéis para copiar CPFs/CNPJs pressionando F2.
        // @author       Parceiro de Programacao
        // @match        https://*.mypurecloud.*/*
        // @match        https://*.genesys.cloud/*
        // @grant        GM_setClipboard
        // ==/UserScript==

        (function () {
            'use strict';

            // --- 1. FUNÇÕES AUXILIARES (DEEP SCAN) ---
            function coletarTextoTotal() {
                let texto = document.body.innerText + " ";
                const iframes = document.getElementsByTagName('iframe');

                for (let i = 0; i < iframes.length; i++) {
                    try {
                        let docInterno = iframes[i].contentDocument || iframes[i].contentWindow.document;
                        if (docInterno) {
                            texto += " " + docInterno.body.innerText + " ";
                        }
                    } catch (e) {
                        // Ignora iframes bloqueados
                    }
                }
                return texto;
            }

            // --- 2. VALIDADORES MATEMÁTICOS ---
            function validarCPF(cpf) {
                cpf = cpf.replace(/[^\d]+/g, '');
                if (cpf.length !== 11 || /^(\d)\1+$/.test(cpf)) return false;

                let soma = 0, resto;
                for (let i = 1; i <= 9; i++) soma = soma + parseInt(cpf.substring(i - 1, i)) * (11 - i);
                resto = (soma * 10) % 11;
                if ((resto === 10) || (resto === 11)) resto = 0;
                if (resto !== parseInt(cpf.substring(9, 10))) return false;

                soma = 0;
                for (let i = 1; i <= 10; i++) soma = soma + parseInt(cpf.substring(i - 1, i)) * (12 - i);
                resto = (soma * 10) % 11;
                if ((resto === 10) || (resto === 11)) resto = 0;
                if (resto !== parseInt(cpf.substring(10, 11))) return false;

                return true;
            }

            function validarCNPJ(cnpj) {
                cnpj = cnpj.replace(/[^\d]+/g, '');
                if (cnpj.length !== 14 || /^(\d)\1+$/.test(cnpj)) return false;

                let tamanho = cnpj.length - 2;
                let numeros = cnpj.substring(0, tamanho);
                let digitos = cnpj.substring(tamanho);
                let soma = 0;
                let pos = tamanho - 7;

                for (let i = tamanho; i >= 1; i--) {
                    soma += numeros.charAt(tamanho - i) * pos--;
                    if (pos < 2) pos = 9;
                }
                let resultado = soma % 11 < 2 ? 0 : 11 - soma % 11;
                if (resultado != digitos.charAt(0)) return false;

                tamanho = tamanho + 1;
                numeros = cnpj.substring(0, tamanho);
                soma = 0;
                pos = tamanho - 7;
                for (let i = tamanho; i >= 1; i--) {
                    soma += numeros.charAt(tamanho - i) * pos--;
                    if (pos < 2) pos = 9;
                }
                resultado = soma % 11 < 2 ? 0 : 11 - soma % 11;
                if (resultado != digitos.charAt(1)) return false;

                return true;
            }

            // --- 3. SISTEMA DE BUSCA INTELIGENTE ---
            function buscarMelhorDocumento() {
                const textoTotal = coletarTextoTotal();
                const regexDoc = /(?<!\d)(\d{3}\.?\d{3}\.?\d{3}-?\d{2})(?!\d)|(?<!\d)(\d{2}\.?\d{3}\.?\d{3}\/?\d{4}-?\d{2})(?!\d)/g;

                const encontrados = textoTotal.match(regexDoc);
                if (!encontrados) return null;

                let melhorCandidato = null;
                let maiorPontuacao = -1000;

                encontrados.forEach(rawDoc => {
                    const docLimpo = rawDoc.replace(/\D/g, '');
                    let ehValido = false;

                    if (docLimpo.length === 11 && validarCPF(docLimpo)) ehValido = true;
                    if (docLimpo.length === 14 && validarCNPJ(docLimpo)) ehValido = true;

                    if (!ehValido) return;

                    let pontos = 0;
                    const index = textoTotal.indexOf(rawDoc);
                    const contexto = textoTotal.substring(Math.max(0, index - 60), index + rawDoc.length + 60).toLowerCase();

                    if (contexto.includes('cpf') || contexto.includes('cnpj') || contexto.includes('documento')) pontos += 200;
                    if (contexto.includes('cliente') || contexto.includes('titular')) pontos += 50;
                    if (rawDoc.includes('.') || rawDoc.includes('-')) pontos += 50;

                    if (contexto.includes('tel') || contexto.includes('cel') || contexto.includes('zap') || contexto.includes('contato')) pontos -= 1000;

                    if (contexto.includes('documento:')) pontos += 500;

                    pontos += 5;

                    if (pontos > maiorPontuacao) {
                        maiorPontuacao = pontos;
                        melhorCandidato = docLimpo;
                    }
                });

                if (melhorCandidato && maiorPontuacao > -500) {
                    return melhorCandidato;
                }
                return null;
            }

            // --- 4. EXECUTAR E VISUALIZAR ---
            window.executarExtracaoDocumento = function () {
                const documento = buscarMelhorDocumento();

                if (documento) {
                    const feedbackText = documento.length === 11 ? `CPF: ${documento}` : `CNPJ: ${documento}`;

                    navigator.clipboard.writeText(documento).then(() => {
                        mostrarFeedback(`Copiado! ${feedbackText}`, 'sucesso');
                    }).catch(() => {
                        if (typeof GM_setClipboard !== 'undefined') {
                            GM_setClipboard(documento);
                            mostrarFeedback(`Copiado (GM)! ${feedbackText}`, 'sucesso');
                        } else {
                            mostrarFeedback("Erro de Clipboard.", 'erro');
                        }
                    });
                } else {
                    mostrarFeedback("Nenhum CPF/CNPJ válido encontrado.", 'erro');
                }
            };

            function mostrarFeedback(texto, tipo) {
                const id = 'extrator-feedback-box';
                const old = document.getElementById(id);
                if (old) old.remove();

                const div = document.createElement('div');
                div.id = id;
                div.style.cssText = `
            position: fixed; bottom: 50px; left: 50%; transform: translateX(-50%); z-index: 999999;
            padding: 12px 24px; border-radius: 50px; font-family: 'Segoe UI', sans-serif; font-size: 14px; font-weight: 600;
            color: white; box-shadow: 0 10px 25px rgba(0,0,0,0.2);
            background: ${tipo === 'sucesso' ? '#2ecc71' : '#e74c3c'};
            display: flex; align-items: center; gap: 10px;
            animation: popIn 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275);
        `;
                div.innerHTML = `<span>${tipo === 'sucesso' ? '✔' : '✖'}</span> <span>${texto}</span>`;
                document.body.appendChild(div);

                setTimeout(() => {
                    div.style.opacity = '0';
                    div.style.transform = 'translateX(-50%) translateY(20px)';
                    setTimeout(() => div.remove(), 500);
                }, 3000);
            }

            const style = document.createElement('style');
            style.innerHTML = `@keyframes popIn { from { transform: translateX(-50%) scale(0.8); opacity: 0; } to { transform: translateX(-50%) scale(1); opacity: 1; } }`;
            document.head.appendChild(style);

            // --- 5. NOVO ATALHO (Apenas F2) ---
            document.addEventListener('keydown', (e) => {
                // Verifica se a tecla é APENAS o F2
                if (e.key === 'F2') {
                    e.preventDefault(); // Impede o comportamento padrão do navegador
                    e.stopPropagation();
                    window.executarExtracaoDocumento();
                }
            });

            console.log("[Extrator V7.4] Deep Scan Ativado. Pressione F2 para copiar.");

        })();

    } catch (e) { console.error('[BUILDER] Erro fatal no módulo extrator.js:', e); }

    /* --- MÓDULO ANEXADO: ESPELHO.JS --- */
    try {
        // ==UserScript==
        // @name         PureCloud - Copiar Chat Espelho (Módulo Extensão)
        // @description  Copia o chat EXATAMENTE como na tela (Shadow DOM deep scan).
        // ==/UserScript==

        (function () {
            'use strict';

            const CONFIG = {
                IFRAME_SELECTOR: 'iframe[src*="messaging-gadget.html"]'
            };

            // --- 1. LÓGICA DE BUSCA (Shadow DOM) ---
            function encontrarUltimoChat() {
                let todosIframes = [];

                // Função recursiva para mergulhar em Shadow Roots
                const buscaRecursiva = (no) => {
                    const iframesAqui = no.querySelectorAll(CONFIG.IFRAME_SELECTOR);
                    iframesAqui.forEach(iframe => todosIframes.push(iframe));

                    const elementos = no.querySelectorAll('*');
                    for (let i = 0; i < elementos.length; i++) {
                        if (elementos[i].shadowRoot) {
                            buscaRecursiva(elementos[i].shadowRoot);
                        }
                    }
                };

                buscaRecursiva(document.body);

                if (todosIframes.length > 0) {
                    // Pega o último iframe (geralmente o chat mais recente)
                    const alvo = todosIframes[todosIframes.length - 1];
                    try {
                        if (alvo.contentDocument && alvo.contentDocument.body) {
                            return alvo.contentDocument.body.innerText;
                        }
                    } catch (e) { console.warn("[Espelho] Erro de segurança no Iframe (Cross-Origin)."); }
                }
                return null;
            }

            // --- 2. CÓPIA FIEL (SEM FILTROS) ---
            function formatarEspelho(texto) {
                if (!texto) return "";
                // Remove excesso de quebras de linha (3 ou mais vira 2)
                return texto.replace(/\n\s*\n\s*\n/g, '\n\n');
            }

            // --- 3. FUNÇÃO GLOBAL (Para ser chamada pelo Menu.js) ---
            window.executarCopiaEspelho = async function () {
                const textoOriginal = encontrarUltimoChat();

                if (textoOriginal && textoOriginal.length > 20) {
                    const textoFinal = formatarEspelho(textoOriginal);

                    try {
                        await navigator.clipboard.writeText(textoFinal);
                        // Notificação visual simples usando a UI existente da extensão (se houver)
                        if (typeof UI !== 'undefined' && UI.createNotification) {
                            UI.createNotification("Chat copiado com sucesso! (Modo Espelho)", "success");
                        } else {
                            console.log("Chat copiado!"); // Fallback
                        }
                        return true;
                    } catch (err) {
                        console.error("Erro ao copiar:", err);
                        if (typeof UI !== 'undefined') UI.createNotification("Erro ao acessar Clipboard.", "error");
                        return false;
                    }
                } else {
                    if (typeof UI !== 'undefined') {
                        UI.createNotification("Não foi possível ler o chat. Clique na conversa primeiro.", "warn");
                    } else {
                        alert("Não foi possível ler o chat.\nClique na conversa para garantir que está ativa.");
                    }
                    return false;
                }
            };

            // --- 4. ATALHO DE TECLADO (Ctrl + Shift + C) ---
            document.addEventListener('keydown', (e) => {
                if (e.ctrlKey && e.shiftKey && e.code === 'KeyC') {
                    e.preventDefault();
                    e.stopPropagation();
                    window.executarCopiaEspelho();
                }
            });

            console.log("[Módulo Espelho] Carregado. Use Ctrl+Shift+C ou o Menu.");

        })();

    } catch (e) { console.error('[BUILDER] Erro fatal no módulo espelho.js:', e); }

    /* --- MÓDULO ANEXADO: PROTOCOLOS.JS --- */
    try {
        // ==UserScript==
        // @name         PureCloud - Protocolos Rápidos (v1.7.0 - Fixed)
        // @namespace    http://tampermonkey.net/protocolos-rapidos
        // @version      1.7.0
        // @description  Correção do erro de referência e layout ajustado.
        // @author       Parceiro de Programacao
        // @match        https://*.mypurecloud.*/*
        // @match        https://*.genesys.cloud/*
        // @grant        GM_addStyle
        // @run-at       document-idle
        // ==/UserScript==

        (function () {
            'use strict';

            // --- 🛡️ PORTEIRO DE MÓDULOS ---
            if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
                chrome.storage.local.get(['MOD_PROTOCOLOS'], function (result) {
                    if (result.MOD_PROTOCOLOS === false) {
                        console.log("⛔ [Genesys Admin] Módulo Protocolos DESATIVADO pelo usuário.");
                        return;
                    }
                    initProtocolos();
                });
            } else {
                initProtocolos();
            }

            function initProtocolos() {

                const SCRIPT_VERSION = '1.7.0_Fixed';
                const DEBUG_MODE = true;
                const log = (...args) => { if (DEBUG_MODE) console.log(`[Protocolos v${SCRIPT_VERSION}]`, ...args); };

                const PROTOCOLOS_JSON_URL = 'https://kingoffjoss.github.io/AjaExtension/protocolos_brisanet_v1_9.json';

                const ICONS = {
                    GEAR: `<svg viewBox="0 0 24 24" width="18" height="18" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"></circle><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2 2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path></svg>`,
                    CLOSE: `<svg viewBox="0 0 24 24" width="18" height="18" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>`,
                    BACK: `<svg viewBox="0 0 24 24" width="18" height="18" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"><line x1="19" y1="12" x2="5" y2="12"></line><polyline points="12 19 5 12 12 5"></polyline></svg>`,
                    TRASH: `<svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>`
                };

                const initialProtocolos = [];
                const requiredTagsMap = {};
                const categoryDisplayMap = { 'recent': '⏱️ Recentes', 'favorites': '⭐ Favoritos', 'all': 'Todos', 'AGENDAMENTO': 'Agendamento', 'ATIVO': 'Ativo', 'BRISATV': 'BrisaTV', 'CABO': 'Cabo', 'CANCELAMENTO': 'Cancelamento', 'DIALOGO': 'Diálogo', 'EQUIPAMENTO': 'Equipamento', 'FINANCEIRO': 'Financeiro', 'FWA': 'FWA', 'ID': 'ID (Dados)', 'INFO': 'Info', 'INSTABILIDADE': 'Instabilidade', 'INSTALACAO': 'Instalação', 'JOGOS': 'Jogos', 'LENTIDAO': 'Lentidão', 'LIGACAO': 'Ligação', 'PARTICULAR': 'Particular', 'QUEDAS': 'Quedas', 'ROTEADOR': 'Roteador', 'SEM_ACESSO': 'Sem Acesso', 'SEM_GERENCIA': 'Sem Gerência', 'SINAL': 'Sinal', 'SVA': 'SVA', 'TELEFONIA': 'Telefonia', 'VELOCIDADE': 'Velocidade', 'VISITA': 'Visita (Custo)', 'WIFI': 'Wi-Fi', };
                const sidebarCategoryOrder = ['recent', 'favorites', 'all', 'SEM_ACESSO', 'LENTIDAO', 'QUEDAS', 'INSTABILIDADE', 'SINAL', 'SEM_GERENCIA', 'CABO', 'WIFI', 'EQUIPAMENTO', 'ROTEADOR', 'FWA', 'BRISATV', 'TELEFONIA', 'JOGOS', 'PARTICULAR', 'FINANCEIRO', 'ID', 'VISITA', 'AGENDAMENTO', 'INSTALACAO', 'CANCELAMENTO', 'SVA', 'ATIVO', 'LIGACAO', 'DIALOGO', 'INFO'];

                let CONFIG = { PROTOCOLOS: [], LAST_COPIED_PROTOCOLO: '', RECENT_PROTOCOLOS: [], POPUP_POSITIONS: {}, PR_DARK_MODE: false };

                // --- Funções Utilitárias ---
                const findEl = (selectors, parent = document) => {
                    if (!Array.isArray(selectors)) selectors = [selectors];
                    for (const selector of selectors) {
                        try {
                            if (!parent?.querySelector) continue;
                            const el = parent.querySelector(selector);
                            if (el) return el;
                        } catch (e) { log("Erro sel:", selector, e); }
                    }
                    return null;
                };

                const copyTextToClipboard = async (text) => {
                    try {
                        await navigator.clipboard.writeText(text);
                        return true;
                    } catch (err) {
                        log('Falha copiar:', err);
                        return false;
                    }
                };

                const escapeRegExp = (string) => string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

                const throttle = (func, limit) => {
                    let inThrottle;
                    return function (...args) {
                        if (!inThrottle) {
                            func.apply(this, args);
                            inThrottle = true;
                            setTimeout(() => inThrottle = false, limit);
                        }
                    };
                };

                // --- Draggable Logic ---
                const makeDraggable = (popup, header, popupName) => {
                    if (!header) header = popup;
                    let isDragging = false, dragOffsetX = 0, dragOffsetY = 0;

                    let enforceBounds = (top, left) => {
                        const vpW = window.innerWidth, vpH = window.innerHeight;
                        const pW = popup.offsetWidth || 300, pH = popup.offsetHeight || 300;
                        let safeT = Math.max(5, Math.min(vpH - pH - 5, top));
                        let safeL = Math.max(5, Math.min(vpW - pW - 5, left));
                        if (pW > vpW) safeL = 0; if (pH > vpH) safeT = 0;
                        return { top: safeT, left: safeL };
                    };

                    try {
                        if (typeof CONFIG === 'undefined') window.CONFIG = { POPUP_POSITIONS: {} };
                        if (!CONFIG.POPUP_POSITIONS) CONFIG.POPUP_POSITIONS = {};
                        let saved = sessionStorage.getItem('qr_popupPositions') || sessionStorage.getItem('popupPositions') || '{}';
                        CONFIG.POPUP_POSITIONS = JSON.parse(saved);
                    } catch (e) { }

                    popup.style.position = 'fixed';
                    popup.style.margin = '0';
                    popup.style.transform = 'none';

                    // Initial Positioning logic
                    if (popupName === 'quickReplyPopup') {
                        const dW = '650px', dH = '75vh';
                        popup.style.width = dW; popup.style.height = dH;
                        setTimeout(() => {
                            const safe = enforceBounds(Math.max(5, (window.innerHeight - popup.offsetHeight) / 2), Math.max(5, (window.innerWidth - popup.offsetWidth) / 2));
                            popup.style.top = safe.top + 'px'; popup.style.left = safe.left + 'px';
                        }, 50);
                    } else if (CONFIG && CONFIG.POPUP_POSITIONS && CONFIG.POPUP_POSITIONS[popupName]?.top && CONFIG.POPUP_POSITIONS[popupName]?.left) {
                        const safe = enforceBounds(parseFloat(CONFIG.POPUP_POSITIONS[popupName].top), parseFloat(CONFIG.POPUP_POSITIONS[popupName].left));
                        popup.style.top = safe.top + 'px'; popup.style.left = safe.left + 'px';
                        if (CONFIG.POPUP_POSITIONS[popupName].width) popup.style.width = CONFIG.POPUP_POSITIONS[popupName].width;
                        if (CONFIG.POPUP_POSITIONS[popupName].height) popup.style.height = CONFIG.POPUP_POSITIONS[popupName].height;
                    } else {
                        popup.style.top = '10%'; popup.style.left = '10%';
                    }

                    const savePos = () => {
                        if (popupName === 'quickReplyPopup' && !isDragging) return;
                        const rect = popup.getBoundingClientRect();
                        const safe = enforceBounds(rect.top, rect.left);
                        if (typeof CONFIG !== 'undefined' && CONFIG.POPUP_POSITIONS) {
                            CONFIG.POPUP_POSITIONS[popupName] = { top: safe.top + 'px', left: safe.left + 'px', width: popup.style.width, height: popup.style.height };
                            try {
                                sessionStorage.setItem('qr_popupPositions', JSON.stringify(CONFIG.POPUP_POSITIONS));
                                sessionStorage.setItem('popupPositions', JSON.stringify(CONFIG.POPUP_POSITIONS));
                            } catch (e) { }
                        }
                    };

                    header.addEventListener('mousedown', (e) => {
                        if (e.target.closest('button') || e.target.closest('.compact-btn') || e.target.closest('input') || e.target.classList.contains('os-btn') || e.button !== 0) return;
                        e.preventDefault();
                        isDragging = true;
                        popup.style.transition = 'none';

                        const rect = popup.getBoundingClientRect();
                        popup.style.left = rect.left + 'px';
                        popup.style.top = rect.top + 'px';
                        popup.style.bottom = 'auto';
                        popup.style.right = 'auto';

                        dragOffsetX = e.clientX - rect.left;
                        dragOffsetY = e.clientY - rect.top;
                    }, { passive: false });

                    document.addEventListener('mousemove', (e) => {
                        if (!isDragging) return;
                        e.preventDefault();
                        const safe = enforceBounds(e.clientY - dragOffsetY, e.clientX - dragOffsetX);
                        popup.style.top = safe.top + 'px';
                        popup.style.left = safe.left + 'px';
                    }, { passive: false });

                    document.addEventListener('mouseup', () => {
                        if (isDragging) {
                            isDragging = false;
                            savePos();
                        }
                    });

                    try {
                        const observer = new ResizeObserver(() => { if (!isDragging) savePos(); });
                        observer.observe(popup);
                    } catch (e) { }
                };

                // --- Teclado (A função que faltava) ---
                const keyboardEventHandler = (e) => {
                    const target = e.target.tagName.toUpperCase();
                    const isPopupInput = e.target.closest('.pr-script-base-popup') && (target === 'INPUT' || target === 'TEXTAREA' || target === 'SELECT');
                    if (e.key !== 'Escape' && isPopupInput) return;

                    if (e.ctrlKey && e.shiftKey && e.key.toUpperCase() === 'U') {
                        e.preventDefault();
                        UI.createProtocoloPopup();
                    }
                    if (e.key === 'Escape') {
                        const p1 = document.querySelector('.pr-script-popup');
                        const p2 = document.querySelector('.pr-script-settings-panel');
                        if (p1) { p1.remove(); e.preventDefault(); }
                        else if (p2) { p2.remove(); e.preventDefault(); }
                    }
                };

                // --- DADOS ---
                const loadData = async () => {
                    let protocolsLoaded = false;
                    try {
                        const localProtocols = localStorage.getItem('pr_protocolos');
                        if (localProtocols) {
                            const parsed = JSON.parse(localProtocols);
                            if (Array.isArray(parsed) && parsed.length > 0) { CONFIG.PROTOCOLOS = parsed; protocolsLoaded = true; }
                        }
                    } catch (e) { localStorage.removeItem('pr_protocolos'); }

                    if (!protocolsLoaded) {
                        try {
                            const response = await safeFetch(PROTOCOLOS_JSON_URL + '?v=' + Date.now());
                            if (!response.ok) throw new Error('Network error');
                            const data = await response.json();
                            let newProtocolos = (Array.isArray(data)) ? data : (data && Array.isArray(data.protocols) ? data.protocols : null);
                            if (newProtocolos) {
                                CONFIG.PROTOCOLOS = newProtocolos;
                                try { localStorage.setItem('pr_protocolos', JSON.stringify(newProtocolos)); } catch (e) { }
                            }
                        } catch (fetchErr) { CONFIG.PROTOCOLOS = initialProtocolos; }
                    }

                    try {
                        CONFIG.LAST_COPIED_PROTOCOLO = localStorage.getItem('pr_lastCopiedProtocol') || '';
                        CONFIG.RECENT_PROTOCOLOS = JSON.parse(localStorage.getItem('pr_recentProtocols_v1')) || [];
                        CONFIG.POPUP_POSITIONS = JSON.parse(sessionStorage.getItem('pr_popupPositions') || '{}');
                        CONFIG.PR_DARK_MODE = localStorage.getItem('pr_darkMode') === 'true';
                    } catch (e) {
                        CONFIG.RECENT_PROTOCOLOS = [];
                        CONFIG.POPUP_POSITIONS = {};
                        CONFIG.PR_DARK_MODE = false;
                    }

                    CONFIG.PROTOCOLOS = CONFIG.PROTOCOLOS.map(r => ({ ...r, isFavorite: r.isFavorite || false, requiredData: r.requiredData || [] }));
                    CONFIG.PROTOCOLOS.forEach(reply => { requiredTagsMap[reply.title] = (Array.isArray(reply.requiredData) ? reply.requiredData : []).map(tag => typeof tag === 'string' ? tag.replace(/[{}]/g, '').replace(/ /g, '_').toUpperCase() : ''); });
                };

                const saveData = () => { try { localStorage.setItem('pr_protocolos', JSON.stringify(CONFIG.PROTOCOLOS)); localStorage.setItem('pr_lastCopiedProtocol', CONFIG.LAST_COPIED_PROTOCOLO); localStorage.setItem('pr_recentProtocols_v1', JSON.stringify(CONFIG.RECENT_PROTOCOLOS)); localStorage.setItem('pr_darkMode', CONFIG.PR_DARK_MODE); } catch (e) { } };

                const logUsedProtocolo = (title, text) => {
                    const MAX = 5;
                    const entry = { title, text };
                    CONFIG.RECENT_PROTOCOLOS = CONFIG.RECENT_PROTOCOLOS.filter(r => r.title !== title || r.text !== text);
                    CONFIG.RECENT_PROTOCOLOS.unshift(entry);
                    if (CONFIG.RECENT_PROTOCOLOS.length > MAX) CONFIG.RECENT_PROTOCOLOS.length = MAX;
                };

                const documentExtractor = {
                    getParticipantName: () => { const sels = ['h3.participant-name', 'div.interaction-name-wrapper div.participant-name > span', 'p.participant-name', 'span[data-qa-id="participant-name"]', 'h2.participant-name']; const el = findEl(sels); if (!el) return 'cliente'; const raw = el.textContent.trim(); const match = raw.match(/^([a-zA-Z\sáéíóúâêîôûãõçÁÉÍÓÚÂÊÎÔÛÃÕÇ.-]+)/); return (match?.[1]?.trim() || raw) || 'cliente'; },
                    getInteractionId: () => { const sels = ['span[data-qa-id="interaction-id"]', '[data-qa-id="detail-value-interactionId"]', '.interaction-id-value']; const el = findEl(sels); return el?.textContent.trim().replace(/#/g, '') || 'protocolo'; }
                };

                const UI = {
                    createNotification(message, type = 'info', duration = 3000) {
                        let cont = document.getElementById('pr-script-notification-container');
                        if (!cont) { cont = document.createElement('div'); cont.id = 'pr-script-notification-container'; document.body.appendChild(cont); }
                        const n = document.createElement("div"); n.textContent = message; n.className = `pr-script-notification pr-script-notification-${type}`;
                        cont.prepend(n);
                        setTimeout(() => n.remove(), duration);
                    },

                    createProtocoloPopup() {
                        document.querySelector('.pr-script-popup')?.remove();
                        document.querySelector('.pr-script-settings-panel')?.remove();

                        const popup = document.createElement("div");
                        popup.className = 'pr-script-popup pr-script-base-popup';

                        popup.innerHTML = `
                    <div class="panel-header">
                        <h4>Protocolos Rápidos</h4>
                        <div class="panel-header-buttons purecloud-script-button">
                            <button id="pr-btn-theme" class="panel-header-btn purecloud-script-button" title="Mudar Tema">🌗</button>
                            <button class="panel-header-btn settings-btn purecloud-script-button" title="Gerenciar Protocolos">${ICONS.GEAR}</button>
                            <button class="panel-header-btn pr-script-popup-close-btn purecloud-script-button" title="Fechar (Esc)">${ICONS.CLOSE}</button>
                        </div>
                    </div>
                    <div class="pr-popup-body">
                        <div id="pr-sidebar">
                            <div class="pr-sidebar-title">CATEGORIAS</div>
                            <ul id="pr-category-list"></ul>
                        </div>
                        <div id="pr-main-content">
                            <input type="text" id="pr-script-search" placeholder="Buscar por protocolo ou palavra-chave...">
                            <div id="pr-reply-tags" class="pr-tags-container-filter"></div>
                            <div id="pr-suggestion-filters" class="pr-suggestion-filters-container"></div>
                            <div id="pr-quick-filters" class="pr-quick-filters"></div>
                            <div id="pr-reply-results" class="pr-items-container"></div>
                        </div>
                        <div id="pr-editor-sidebar" style="display: none;">
                            <h5>Editor de Protocolo</h5>
                            <textarea id="pr-editor-original-text" readonly rows="4" style="display:none;"></textarea>

                            <div class="pr-editor-grid">
                                <div class="pr-editor-field"><label>Nome Titular:</label><input type="text" id="pr-editor-titular"></div>
                                <div class="pr-editor-field">
                                    <label>Gênero:</label>
                                    <select id="pr-editor-gender">
                                        <option value="neutro" selected>Neutro/Não Aplic.</option>
                                        <option value="masculino">Masculino</option>
                                        <option value="feminino">Feminino</option>
                                    </select>
                                </div>
                            </div>

                            <div class="pr-editor-field">
                                <label>Relação do Contato:</label>
                                <select id="pr-editor-relationship"> <option value="proprio" selected>Próprio Titular</option> <option value="filho">Filho(a)</option> <option value="conjuge">Cônjuge</option> <option value="pai_mae">Pai/Mãe</option> <option value="irmao">Irmão(ã)</option> <option value="amigo">Amigo(a)</option> <option value="outro_parente">Outro Parente</option> <option value="terceiro">Funcionário(a) / Terceiro</option> </select>
                            </div>
                            <div class="pr-editor-field" id="pr-editor-contact-name-group" style="display: none;"> <label>Nome Contato:</label> <input type="text" id="pr-editor-contact-name"> </div>
                            <div class="pr-editor-field"><label>Telefone Contato:</label><input type="tel" id="pr-editor-phone" placeholder="(XX) XXXXX-XXXX"></div>

                            <div class="pr-editor-grid">
                                <div class="pr-editor-field">
                                    <label>Data:</label>
                                    <input type="date" id="pr-editor-date">
                                </div>
                                <div class="pr-editor-field">
                                    <label>Período:</label>
                                    <select id="pr-editor-timeslot"> <option value="nao_definido" selected>--</option> <option value="manha">Manhã</option> <option value="tarde">Tarde</option> <option value="noite">Noite</option> </select>
                                </div>
                            </div>

                            <div class="pr-editor-field">
                                <label>Notas Rápidas:</label>
                                <textarea id="pr-editor-notes" rows="2" placeholder="Adicionar observação..."></textarea>
                            </div>

                            <button id="pr-editor-preview-btn" class="pr-script-button purecloud-script-button">Gerar Pré-visualização</button>
                            
                            <div style="margin-top:10px; margin-bottom:5px;">
                                <label style="color:#888; font-size:11px; font-weight:bold;">RESULTADO:</label>
                                <textarea id="pr-editor-preview" placeholder="O texto gerado aparecerá aqui..."></textarea>
                            </div>

                            <button id="pr-editor-copy-preview-btn" class="pr-script-button purecloud-script-button" style="/*bg-removido*/;">Copiar Texto</button>
                        </div>
                    </div>`;

                        document.body.appendChild(popup);
                        popup.style.width = '900px';
                        popup.style.height = '680px';

                        makeDraggable(popup, popup.querySelector('.panel-header'), 'protocoloPopup');

                        const themeBtnPR = popup.querySelector('#pr-btn-theme');
                        const savedThemePR = localStorage.getItem('PR_THEME');
                        if (savedThemePR === 'light') {
                            popup.classList.add('local-light-mode');
                            themeBtnPR.innerText = '☀️';
                        } else if (savedThemePR === 'dark') {
                            popup.classList.add('cc-escurinho');
                            themeBtnPR.innerText = '🌗';
                        }
                        themeBtnPR.onclick = () => {
                            const isLight = popup.classList.contains('local-light-mode');
                            if (isLight) {
                                popup.classList.remove('local-light-mode');
                                popup.classList.add('cc-escurinho');
                                localStorage.setItem('PR_THEME', 'dark');
                                themeBtnPR.innerText = '🌗';
                                themeBtnPR.title = 'Mudar para Tema Claro';
                            } else {
                                popup.classList.remove('cc-escurinho');
                                popup.classList.add('local-light-mode');
                                localStorage.setItem('PR_THEME', 'light');
                                themeBtnPR.innerText = '☀️';
                                themeBtnPR.title = 'Mudar para Tema Escuro';
                            }
                        };

                        popup.querySelector('.pr-script-popup-close-btn').onclick = () => popup.remove();
                        popup.querySelector('.settings-btn').onclick = () => UI.createSettingsPanel();

                        // Elementos
                        const searchInput = popup.querySelector('#pr-script-search');
                        const categoryListContainer = popup.querySelector('#pr-category-list');
                        const resultsContainer = popup.querySelector('#pr-reply-results');
                        const tagsContainer = popup.querySelector('#pr-reply-tags');
                        const suggestionsContainer = popup.querySelector('#pr-suggestion-filters');
                        const quickFiltersContainer = popup.querySelector('#pr-quick-filters');

                        const editorSidebar = popup.querySelector('#pr-editor-sidebar');
                        const originalTextArea = popup.querySelector('#pr-editor-original-text');
                        const titularInput = popup.querySelector('#pr-editor-titular');
                        const genderSelect = popup.querySelector('#pr-editor-gender');
                        const relationshipSelect = popup.querySelector('#pr-editor-relationship');
                        const contactNameGroup = popup.querySelector('#pr-editor-contact-name-group');
                        const contactNameInput = popup.querySelector('#pr-editor-contact-name');
                        const phoneInput = popup.querySelector('#pr-editor-phone');
                        const dateInput = popup.querySelector('#pr-editor-date');
                        const timeslotSelect = popup.querySelector('#pr-editor-timeslot');
                        const notesTextarea = popup.querySelector('#pr-editor-notes');
                        const previewBtn = popup.querySelector('#pr-editor-preview-btn');
                        const previewTextArea = popup.querySelector('#pr-editor-preview');
                        const copyPreviewBtn = popup.querySelector('#pr-editor-copy-preview-btn');

                        let currentCategory = 'favorites'; let currentSearchTerm = ''; let activeTagFilter = null; let activeQuickFilters = [];

                        const getReplyDataTags = (title) => { const r = CONFIG.PROTOCOLOS.find(p => p.title === title); return r?.requiredData || []; };
                        const highlightText = (text, keywords) => { if (!keywords || keywords.length === 0 || !text) { return text; } const regexKeywords = keywords.map(kw => escapeRegExp(kw)).join('|'); const regex = new RegExp(`(${regexKeywords})`, 'gi'); return text.replace(regex, '<span class="pr-highlight">$1</span>'); };

                        const populateReplies = (category, searchTerm, tagFilter) => {
                            const name = documentExtractor.getParticipantName(); const id = documentExtractor.getInteractionId(); resultsContainer.innerHTML = ''; let filteredReplies = []; let headerText = ''; const lowerSearch = searchTerm ? searchTerm.toLowerCase() : ''; const searchKeywords = lowerSearch ? lowerSearch.split(/\s+/).filter(k => k) : []; if (searchTerm) { const scored = []; CONFIG.PROTOCOLOS.forEach(reply => { const lt = reply.title.toLowerCase(); const ltxt = reply.text.toLowerCase(); let score = 0; if (lt.startsWith(lowerSearch)) { score += 1000; } else if (lt.includes(lowerSearch)) { score += 100; } let keywordsFoundCount = 0; searchKeywords.forEach(kw => { if (lt.includes(kw)) { score += 20; keywordsFoundCount++; } else if (ltxt.includes(kw)) { score += 5; keywordsFoundCount++; } }); if (searchKeywords.length > 1 && keywordsFoundCount === searchKeywords.length) { score += 50; } if (score > 0) scored.push({ ...reply, score }); }); scored.sort((a, b) => b.score - a.score || a.title.localeCompare(b.title)); filteredReplies = scored; headerText = `Busca por "${searchTerm}"`; } else if (tagFilter) { let base = CONFIG.PROTOCOLOS; if (category && !['all', 'favorites', 'recent', 'search'].includes(category)) { base = base.filter(r => r.title.startsWith(category + ' - ')); } filteredReplies = base.filter(r => getReplyDataTags(r.title).includes(tagFilter)); const catLabel = categoryDisplayMap[category] || category; headerText = `Filtro Tag: "${tagFilter.replace(/_/g, ' ')}"` + (category && !['all', 'search'].includes(category) ? ` em ${catLabel}` : ''); filteredReplies.sort((a, b) => a.title.localeCompare(b.title)); } else if (category === 'favorites') { filteredReplies = CONFIG.PROTOCOLOS.filter(r => r.isFavorite); headerText = categoryDisplayMap['favorites']; filteredReplies.sort((a, b) => a.title.localeCompare(b.title)); } else if (category === 'recent') { const titles = CONFIG.RECENT_PROTOCOLOS.map(r => r.title); filteredReplies = CONFIG.PROTOCOLOS.filter(r => titles.includes(r.title)).sort((a, b) => titles.indexOf(a.title) - titles.indexOf(b.title)); headerText = categoryDisplayMap['recent']; } else if (category && category !== 'all') { filteredReplies = CONFIG.PROTOCOLOS.filter(r => r.title.startsWith(category + ' - ')); headerText = categoryDisplayMap[category] || `Categoria: ${category}`; filteredReplies.sort((a, b) => a.title.localeCompare(b.title)); } else { filteredReplies = [...CONFIG.PROTOCOLOS]; headerText = categoryDisplayMap['all']; filteredReplies.sort((a, b) => a.title.localeCompare(b.title)); } if (activeQuickFilters.length > 0) { headerText += ` (Filtros: ${activeQuickFilters.join(', ')})`; filteredReplies = filteredReplies.filter(reply => { const lowerTextAndTitle = (reply.title + ' ' + reply.text).toLowerCase(); return activeQuickFilters.every(filterKeyword => lowerTextAndTitle.includes(filterKeyword)); }); } if (filteredReplies.length === 0) { resultsContainer.innerHTML = `<p class="pr-no-results">Nenhum protocolo encontrado.</p>`; return; } resultsContainer.innerHTML = `<h4 class="pr-results-header">${headerText} (${filteredReplies.length})</h4>`;

                            filteredReplies.forEach(reply => {
                                const code = reply.title.split(' - ')[0].trim();
                                let sub = reply.title.substring(code.length).replace(/^ - /, '').trim() || reply.title;
                                let textSnippet = reply.text.substring(0, 150) + (reply.text.length > 150 ? '...' : '');
                                if (searchKeywords.length > 0) { sub = highlightText(sub, searchKeywords); textSnippet = highlightText(textSnippet, searchKeywords); }
                                const tags = getReplyDataTags(reply.title);
                                const tagsHTML = tags.map(t => `<span class="pr-data-tag pr-tag-${t.replace(/[^a-zA-Z0-9]/g, '_')}" title="${t.replace(/_/g, ' ')}">${t.substring(0, Math.min(t.length, 4))}${t.length > 4 ? '.' : ''}</span>`).join('');
                                const reqClass = tags.length > 0 ? 'pr-requires-tags-highlight' : '';
                                const item = document.createElement('div');
                                item.className = `item pr-reply-item ${reqClass}`;
                                item.dataset.originalText = reply.text;
                                item.innerHTML = `<div class="pr-reply-header"><strong>${sub} ${reply.isFavorite ? '⭐' : ''}</strong><div class="pr-data-tags">${tagsHTML}</div></div><small>${textSnippet}</small>`;
                                item.title = reply.text;

                                item.onclick = async () => {
                                    const origTxt = item.dataset.originalText;
                                    logUsedProtocolo(reply.title, reply.text);

                                    // Preencher campos do editor
                                    originalTextArea.value = origTxt;
                                    titularInput.value = name;
                                    genderSelect.value = 'neutro';
                                    relationshipSelect.value = 'proprio';
                                    contactNameGroup.style.display = 'none';
                                    contactNameInput.value = '';
                                    phoneInput.value = '';
                                    dateInput.value = '';
                                    timeslotSelect.value = 'nao_definido';
                                    notesTextarea.value = '';
                                    previewTextArea.value = origTxt;

                                    // Mostrar Editor
                                    editorSidebar.style.display = 'flex';

                                    // Gera o preview inicial
                                    previewBtn.click();
                                    titularInput.focus();
                                };
                                resultsContainer.appendChild(item);
                            });
                            resultsContainer.scrollTop = 0;
                        };

                        relationshipSelect.addEventListener('change', () => { contactNameGroup.style.display = relationshipSelect.value === 'proprio' ? 'none' : 'block'; if (relationshipSelect.value !== 'proprio') contactNameInput.focus(); });

                        previewBtn.addEventListener('click', () => {
                            try {
                                let modifiedText = originalTextArea.value; if (!modifiedText) return;
                                const holderName = titularInput.value.trim() || 'Titular';
                                const gender = genderSelect.value;
                                const relationshipValue = relationshipSelect.value;
                                const relationshipText = relationshipSelect.options[relationshipSelect.selectedIndex].text;
                                const contactName = contactNameInput.value.trim();
                                const phoneNumber = phoneInput.value.trim();
                                const visitDateRaw = dateInput.value;
                                const timeslotValue = timeslotSelect.value;
                                const quickNotes = notesTextarea.value.trim();

                                let contactPerson = '';
                                let pronounEnding = gender === 'feminino' ? 'a' : 'o';
                                if (relationshipValue === 'proprio') {
                                    contactPerson = `Própri${pronounEnding} titular ${holderName}`;
                                    if (gender !== 'neutro') { modifiedText = modifiedText.replace(/\b(o|a)\s+mesm[oa]\b/gi, `${pronounEnding} mesm${pronounEnding}`); modifiedText = modifiedText.replace(/\bclient[ea]\b/gi, `client${gender === 'feminino' ? 'a' : 'e'}`); }
                                } else if (contactName) {
                                    contactPerson = `${relationshipText} ${contactName}`;
                                    if (gender !== 'neutro') { modifiedText = modifiedText.replace(/\b(o|a)\s+mesm[oa]\b/gi, `${pronounEnding} mesm${pronounEnding}`); }
                                } else { contactPerson = relationshipText; }

                                const contactRegex = /^(?:Própri[ao]\s+titular|Cliente)\b/i;
                                if (contactPerson && contactRegex.test(modifiedText.trimStart())) { modifiedText = modifiedText.replace(contactRegex, contactPerson); }
                                else if (contactPerson && !modifiedText.trimStart().toLowerCase().startsWith(contactPerson.toLowerCase())) { modifiedText = contactPerson + ". " + modifiedText.trimStart(); }

                                const phoneAddRegex = /(entrou em contato(?:\s+com o número(?:\s+[\d\s()+-]+)?)?)([.,;]?\s)?/i;
                                let phoneMatch = modifiedText.match(phoneAddRegex);
                                if (phoneNumber) {
                                    const phoneText = `entrou em contato com o número ${phoneNumber}${phoneMatch ? (phoneMatch[2] || '') : '.'}`;
                                    if (phoneMatch) { modifiedText = modifiedText.replace(phoneAddRegex, phoneText); }
                                    else { const nameEndRegex = new RegExp(`^${escapeRegExp(contactPerson)}(\\s*[.,;]?)`, 'i'); if (contactPerson && nameEndRegex.test(modifiedText.trim())) { modifiedText = modifiedText.replace(nameEndRegex, (match, p1) => `${contactPerson}, contato ${phoneNumber}${p1 || '.'}`); } else { modifiedText = `Contato ${phoneNumber}. ${modifiedText}`; } }
                                } else if (phoneMatch) { modifiedText = modifiedText.replace(phoneAddRegex, `entrou em contato${phoneMatch[2] || ''}`); }

                                let visitInfo = '';
                                if (visitDateRaw) { try { const [year, month, day] = visitDateRaw.split('-'); if (day && month && year && year.length === 4) { visitInfo += ` no dia ${day}/${month}/${year}`; } } catch (e) { log("Erro data", e) } }
                                if (timeslotValue !== 'nao_definido') { visitInfo += (visitInfo ? ', ' : ' no ') + `período da ${timeslotSelect.options[timeslotSelect.selectedIndex].text}`; }
                                if (visitInfo) {
                                    const visitPlaceholderRegex = /(receber a equipe no dia|disponibilidade para receber a equipe|visita no dia|agendamento no dia|passar no local no dia)(?:[\s\d\/,a-zA-Zà-úÀ-Ú.-]*?)?([.,!?;]?\s*)$/mi;
                                    let replacedDate = false;
                                    modifiedText = modifiedText.replace(visitPlaceholderRegex, (match, p1, p2) => { replacedDate = true; let finalPunctuation = (p2 && p2.trim().match(/[.,!?;]$/)) ? p2.trim() : '.'; return `${p1}${visitInfo}${finalPunctuation}`; });
                                    if (!replacedDate) { modifiedText = modifiedText.trimEnd().replace(/[.,!?;]$/, '') + visitInfo + '.'; }
                                }
                                if (quickNotes) { modifiedText = modifiedText.trimEnd(); modifiedText += `\n\nOBS: ${quickNotes}`; }

                                previewTextArea.value = modifiedText.trim();

                                // Efeito Visual no Botão
                                const originalText = previewBtn.innerText;
                                previewBtn.innerText = "Gerado!";
                                previewBtn.style.backgroundColor = "#28a745";
                                setTimeout(() => {
                                    previewBtn.innerText = originalText;
                                    previewBtn.style.backgroundColor = "";
                                }, 1000);

                            } catch (err) { UI.createNotification("Erro ao gerar.", "error"); previewTextArea.value = originalTextArea.value; }
                        });

                        copyPreviewBtn.addEventListener('click', async () => {
                            const textToCopy = previewTextArea.value;
                            if (!textToCopy) { UI.createNotification("Vazio.", 'warn'); return; }
                            if (await copyTextToClipboard(textToCopy)) { UI.createNotification("Copiado!", 'success'); }
                            else { UI.createNotification("Erro.", 'error'); }
                        });

                        // --- Listas ---
                        const buildTagFilters = () => { tagsContainer.innerHTML = ''; const tags = new Set(); CONFIG.PROTOCOLOS.forEach(r => getReplyDataTags(r.title).forEach(t => { if (t) tags.add(t); })); if (tags.size > 0) { tagsContainer.style.display = 'flex'; const arr = Array.from(tags).sort(); const clr = document.createElement('button'); clr.className = 'pr-tag-filter-btn pr-tag-clear-btn'; clr.textContent = 'Limpar'; clr.onclick = () => { activeTagFilter = null; currentSearchTerm = ''; searchInput.value = ''; buildTagFilters(); populateReplies(currentCategory, '', null); }; tagsContainer.appendChild(clr); arr.forEach(t => { const btn = document.createElement('button'); const cls = t.replace(/[^a-zA-Z0-9]/g, '_'); btn.className = `pr-tag-filter-btn pr-tag-${cls}`; btn.textContent = t.replace(/_/g, ' '); if (activeTagFilter === t) btn.classList.add('active'); btn.onclick = () => { activeTagFilter = (activeTagFilter === t) ? null : t; currentSearchTerm = ''; searchInput.value = ''; activeQuickFilters = []; buildQuickFilters(); buildTagFilters(); populateReplies(currentCategory === 'search' ? 'all' : currentCategory, '', activeTagFilter); }; tagsContainer.appendChild(btn); }); } else { tagsContainer.style.display = 'none'; } };
                        const buildSuggestionFilters = () => { suggestionsContainer.innerHTML = ''; const suggs = ['LOS', 'Rota', 'Lentidão', 'Sem Acesso', 'Quedas', 'Cabo', 'Wi-Fi', 'Senha', 'OS', 'FWA', 'Financeiro']; suggs.forEach(s => { const btn = document.createElement('button'); btn.className = 'pr-suggestion-btn'; btn.textContent = s; btn.onclick = () => { searchInput.value = s; searchInput.dispatchEvent(new Event('input', { bubbles: true })); }; suggestionsContainer.appendChild(btn); }); };
                        const buildQuickFilters = () => { quickFiltersContainer.innerHTML = '';['OS', 'Normalizado', 'Transferência'].forEach(keyword => { const label = document.createElement('label'); const checkbox = document.createElement('input'); checkbox.type = 'checkbox'; checkbox.value = keyword.toLowerCase(); checkbox.checked = activeQuickFilters.includes(keyword.toLowerCase()); checkbox.onchange = () => { if (checkbox.checked) activeQuickFilters.push(keyword.toLowerCase()); else activeQuickFilters = activeQuickFilters.filter(f => f !== keyword.toLowerCase()); populateReplies(currentCategory, currentSearchTerm, activeTagFilter); }; label.appendChild(checkbox); label.appendChild(document.createTextNode(keyword)); quickFiltersContainer.appendChild(label); }); };
                        const buildCategoriesSidebar = () => { categoryListContainer.innerHTML = ''; sidebarCategoryOrder.forEach(code => { const exists = ['recent', 'favorites', 'all'].includes(code) || CONFIG.PROTOCOLOS.some(r => r.title.startsWith(code + ' - ')); if (exists && categoryDisplayMap[code]) { const li = document.createElement('li'); li.className = 'pr-category-item'; li.textContent = categoryDisplayMap[code]; if (code === currentCategory) li.classList.add('active'); li.onclick = () => { currentCategory = code; currentSearchTerm = ''; activeTagFilter = null; searchInput.value = ''; buildTagFilters(); buildQuickFilters(); populateReplies(currentCategory, '', null); editorSidebar.style.display = 'none'; categoryListContainer.querySelectorAll('.pr-category-item').forEach(i => i.classList.remove('active')); li.classList.add('active'); }; categoryListContainer.appendChild(li); } }); };

                        searchInput.oninput = throttle(() => { currentSearchTerm = searchInput.value.trim(); activeTagFilter = null; buildTagFilters(); if (!currentSearchTerm) { populateReplies(currentCategory, '', null); } else { currentCategory = 'search'; populateReplies(null, currentSearchTerm, null); } editorSidebar.style.display = 'none'; }, 300);

                        buildCategoriesSidebar(); buildTagFilters(); buildSuggestionFilters(); buildQuickFilters(); populateReplies(currentCategory, '', null); searchInput.focus();
                    },

                    createSettingsPanel() {
                        document.querySelector('.pr-script-popup')?.remove(); document.querySelector('.pr-script-settings-panel')?.remove();
                        const panel = document.createElement('div'); panel.className = 'pr-script-settings-panel pr-script-base-popup';

                        panel.innerHTML = ` 
             <div class="panel-header">
                <div style="display:flex;align-items:center;gap:5px;">
                    <button class="panel-header-btn back-btn purecloud-script-button" title="Voltar">${ICONS.BACK}</button>
                    <h2>Gerenciar Protocolos</h2>
                </div>
                <div class="panel-header-buttons purecloud-script-button"><button class="panel-header-btn pr-script-popup-close-btn purecloud-script-button" title="Fechar">${ICONS.CLOSE}</button></div>
             </div> 
             <div class="panel-content"> 
                <div class="pr-reply-controls"> 
                    <button id="pr-add-reply-btn" class="pr-script-button purecloud-script-button">Add Protocolo</button> 
                    <button id="pr-restore-replies-btn" class="pr-script-button button-danger purecloud-script-button">Restaurar Padrão</button> 
                    <button id="pr-export-json-btn" class="pr-script-button purecloud-script-button" style="/*bg-removido*/;">Exportar JSON</button> 
                    <button id="pr-import-json-btn" class="pr-script-button purecloud-script-button" style="/*bg-removido*/;">Importar JSON</button> 
                </div> 
                <div id="pr-settings-replies-list" class="pr-settings-reply-list"></div> 
             </div> 
             <div class="panel-footer"> <button id="pr-save-settings-btn" class="pr-script-button purecloud-script-button">Salvar e Fechar</button> </div> `;

                        document.body.appendChild(panel); makeDraggable(panel, panel.querySelector('.panel-header'), 'settingsPanel');
                        // Herdar tema do popup principal
                        const savedThemePR = localStorage.getItem('PR_THEME');
                        if (savedThemePR === 'dark') panel.classList.add('cc-escurinho');
                        else if (savedThemePR === 'light') panel.classList.add('local-light-mode');
                        else panel.classList.add('cc-escurinho'); // fallback escuro
                        panel.querySelector('.pr-script-popup-close-btn').onclick = () => panel.remove();
                        panel.querySelector('.back-btn').onclick = () => { panel.remove(); UI.createProtocoloPopup(); };

                        const renderSettings = () => {
                            const list = panel.querySelector('#pr-settings-replies-list'); list.innerHTML = '';
                            [...CONFIG.PROTOCOLOS].sort((a, b) => a.title.localeCompare(b.title)).forEach(r => {
                                const item = document.createElement('div'); item.className = 'pr-reply-item';
                                const idx = CONFIG.PROTOCOLOS.findIndex(p => p.title === r.title && p.text === r.text);
                                item.dataset.originalIndex = idx;
                                item.innerHTML = `
                        <div class="pr-reply-row-top">
                            <input type="checkbox" class="pr-favorite-toggle" ${r.isFavorite ? 'checked' : ''} title="Favorito">
                            <input type="text" value="${r.title}" class="pr-reply-title" placeholder="CATEGORIA - Título">
                            <button class="pr-remove-reply-btn purecloud-script-button" title="Remover">${ICONS.TRASH}</button>
                        </div>
                        <div class="pr-reply-row-bottom">
                            <textarea class="pr-reply-text" rows="2">${r.text}</textarea>
                        </div>
                     `;
                                list.appendChild(item);
                            });
                            list.querySelectorAll('.pr-remove-reply-btn').forEach(btn => btn.onclick = (e) => { if (confirm('Remover protocolo?')) e.target.closest('.pr-reply-item').remove(); });
                        };

                        panel.querySelector('#pr-save-settings-btn').onclick = () => {
                            const newPs = [];
                            panel.querySelectorAll('.pr-reply-item').forEach(item => {
                                const title = item.querySelector('.pr-reply-title').value.trim();
                                const text = item.querySelector('.pr-reply-text').value.trim();
                                const isFavorite = item.querySelector('.pr-favorite-toggle').checked;
                                if (title && text) {
                                    let reqData = requiredTagsMap[title] || [];
                                    newPs.push({ title, text, isFavorite, requiredData: reqData });
                                }
                            });
                            CONFIG.PROTOCOLOS = newPs; saveData(); UI.createNotification("Salvo!", "success"); panel.remove(); UI.createProtocoloPopup();
                        };
                        panel.querySelector('#pr-add-reply-btn').onclick = () => {
                            const list = panel.querySelector('#pr-settings-replies-list');
                            const item = document.createElement('div'); item.className = 'pr-reply-item';
                            item.innerHTML = `
                    <div class="pr-reply-row-top">
                        <input type="checkbox" class="pr-favorite-toggle" title="Favorito">
                        <input type="text" value="NOVO - Título" class="pr-reply-title" placeholder="CATEGORIA - Título">
                        <button class="pr-remove-reply-btn purecloud-script-button" title="Remover">${ICONS.TRASH}</button>
                    </div>
                    <div class="pr-reply-row-bottom">
                        <textarea class="pr-reply-text" rows="2">Texto do protocolo...</textarea>
                    </div>
                `;
                            list.prepend(item);
                            item.querySelector('.pr-remove-reply-btn').onclick = (e) => { if (confirm('Remover protocolo?')) e.target.closest('.pr-reply-item').remove(); };
                        };
                        renderSettings();
                    },

                    createTriggerButton() {
                        let btn = document.getElementById('pr-trigger-button'); if (btn) return;
                        btn = document.createElement('button'); btn.id = 'pr-trigger-button'; btn.innerHTML = '📋'; btn.title = 'Protocolos (Ctrl+Shift+U)'; document.body.appendChild(btn);
                        let isDragging = false; const savedPos = localStorage.getItem('prTriggerButtonPos'); if (savedPos) { const p = JSON.parse(savedPos); btn.style.left = p.left; btn.style.top = p.top; } else { btn.style.right = '25px'; btn.style.bottom = '30px'; }
                        btn.onmousedown = (e) => { if (e.button !== 0) return; isDragging = false; const startX = e.clientX, startY = e.clientY; const rect = btn.getBoundingClientRect(); const initL = rect.left, initT = rect.top; btn.style.cursor = 'grabbing'; const move = (me) => { if (Math.abs(me.clientX - startX) > 5 || Math.abs(me.clientY - startY) > 5) { isDragging = true; btn.style.left = (initL + me.clientX - startX) + 'px'; btn.style.top = (initT + me.clientY - startY) + 'px'; btn.style.right = 'auto'; btn.style.bottom = 'auto'; } }; const up = () => { btn.style.cursor = 'pointer'; if (isDragging) localStorage.setItem('prTriggerButtonPos', JSON.stringify({ left: btn.style.left, top: btn.style.top })); document.removeEventListener('mousemove', move); document.removeEventListener('mouseup', up); }; document.addEventListener('mousemove', move); document.addEventListener('mouseup', up); };
                        btn.onclick = () => { if (!isDragging) UI.createProtocoloPopup(); };
                    }
                };

                const injectCss = () => {
                    const css = `
            .pr-script-base-popup { 
                position: fixed; z-index: 10001; display: flex; flex-direction: column; 
                min-width: 300px; min-height: 200px; resize: both; overflow: hidden; 
                font-family: 'Inter', 'Segoe UI', system-ui, sans-serif; font-size: 14px;
                border-radius: 12px;
                box-shadow: 0 10px 30px rgba(0,0,0,0.15), 0 0 0 1px var(--pr-border-color);
                background-color: var(--pr-bg-primary); color: var(--pr-text-primary); 
            }
            /* TEMA CLARO */
            .pr-script-base-popup:not(.cc-escurinho),
            .pr-script-base-popup.local-light-mode {
                --pr-bg-primary: #ffffff; --pr-bg-secondary: #f8fafc; --pr-bg-tertiary: #f1f5f9;
                --pr-border-color: #e2e8f0; --pr-text-primary: #1e293b; --pr-text-secondary: #64748b;
                --pr-accent-color: #0ea5e9; --pr-accent-hover: #0284c7;
                --pr-danger-color: #ef4444; --pr-success-color: #10b981;
            }
            /* TEMA ESCURO */
            .pr-script-base-popup.cc-escurinho {
                --pr-bg-primary: #0f172a; --pr-bg-secondary: #1e293b; --pr-bg-tertiary: #334155;
                --pr-border-color: #334155; --pr-text-primary: #f8fafc; --pr-text-secondary: #94a3b8;
                --pr-accent-color: #38bdf8; --pr-accent-hover: #0ea5e9;
                --pr-danger-color: #f87171; --pr-success-color: #34d399;
            }
            /* HEADER - ESCOPADO */
            .pr-script-base-popup .panel-header { 
                cursor: move; background-color: var(--pr-bg-secondary) !important; 
                padding: 10px 16px; border-bottom: 1px solid var(--pr-border-color) !important; 
                display: flex; justify-content: space-between; align-items: center; 
            } 
            .pr-script-base-popup .panel-header h4 { margin: 0; color: var(--pr-text-primary) !important; font-size: 15px; font-weight: 600; }
            .pr-script-base-popup .panel-header-buttons { display: flex; align-items: center; gap: 8px; flex-direction: row; background: transparent !important; }
            .pr-script-base-popup .panel-header-btn { 
                background: transparent !important; border: none; color: var(--pr-text-secondary) !important; 
                cursor: pointer; padding: 6px; border-radius: 6px; display: flex; align-items: center; justify-content: center;
                transition: all 0.2s; 
            }
            .pr-script-base-popup .panel-header-btn:hover { color: var(--pr-text-primary) !important; background-color: var(--pr-bg-tertiary) !important; }
            .pr-script-base-popup .panel-content { flex-grow: 1; overflow-y: auto; padding: 16px; background-color: var(--pr-bg-primary) !important; color: var(--pr-text-primary) !important; }
            .pr-script-base-popup .panel-footer { padding: 12px 16px; border-top: 1px solid var(--pr-border-color) !important; background-color: var(--pr-bg-secondary) !important; display: flex; justify-content: flex-end; }
            .pr-script-base-popup input, .pr-script-base-popup textarea, .pr-script-base-popup select { background-color: var(--pr-bg-secondary) !important; color: var(--pr-text-primary) !important; border-color: var(--pr-border-color) !important; }

            .pr-popup-body { display: flex; flex-grow: 1; overflow: hidden; height: calc(100% - 41px); } 
            
            #pr-sidebar { 
                width: 180px; flex-shrink: 0; background-color: var(--pr-bg-secondary); 
                border-right: 1px solid var(--pr-border-color); display: flex; flex-direction: column; 
            } 
            .pr-sidebar-title { 
                padding: 12px 16px; font-weight: 700; color: var(--pr-text-secondary); 
                font-size: 0.75em; text-transform: uppercase; letter-spacing: 0.5px;
            }
            #pr-category-list { list-style: none; padding: 0 8px; margin: 0 0 10px 0; overflow-y: auto; flex-grow: 1; }
            .pr-category-item { 
                padding: 8px 12px; margin-bottom: 4px; cursor: pointer; font-size: 0.9em; font-weight: 500;
                color: var(--pr-text-secondary); border-radius: 6px;
                transition: all 0.2s; user-select: none; 
            }
            .pr-category-item:hover { background-color: var(--pr-bg-tertiary); color: var(--pr-text-primary); }
            .pr-category-item.active { 
                background-color: var(--pr-accent-color); color: #fff; 
                box-shadow: 0 2px 6px rgba(14, 165, 233, 0.3);
            }

            #pr-main-content { flex-grow: 1; padding: 16px; overflow-y: auto; background-color: var(--pr-bg-primary); display: flex; flex-direction: column; min-width: 300px; }
            #pr-editor-sidebar { 
                width: 300px; flex-shrink: 0; background-color: var(--pr-bg-secondary); 
                padding: 16px; overflow-y: auto; display: flex; flex-direction: column; gap: 12px; 
                font-size: 0.9em; border-left: 1px solid var(--pr-border-color); 
            }
            
            #pr-editor-sidebar h5 { margin: 0 0 5px 0; color: var(--pr-text-primary); text-align: center; border-bottom: 1px solid var(--pr-border-color); padding-bottom: 10px; font-weight: 600; }
            .pr-editor-field { margin-bottom: 5px; } 
            .pr-editor-field label { display: block; margin-bottom: 6px; color: var(--pr-text-secondary); font-size: 0.85em; font-weight: 500;} 
            .pr-editor-field input, .pr-editor-field select, .pr-editor-field textarea { 
                width: 100%; padding: 8px 10px; border: 1px solid var(--pr-border-color) !important; 
                background-color: var(--pr-bg-primary) !important; color: var(--pr-text-primary) !important; 
                box-sizing: border-box; border-radius: 6px; transition: border 0.2s;
            }
            .pr-editor-field input:focus, .pr-editor-field select:focus, .pr-editor-field textarea:focus { border-color: var(--pr-accent-color) !important; outline: none; box-shadow: 0 0 0 2px rgba(14,165,233,0.15); }
            
            #pr-editor-preview {
                background-color: var(--pr-bg-tertiary) !important; 
                color: var(--pr-text-primary) !important; 
                border: 1px solid var(--pr-border-color) !important; 
                min-height: 150px !important; border-radius: 6px;
                font-family: 'Consolas', monospace; 
                margin-top: 5px; font-size: 13px; line-height: 1.4;
                resize: vertical; padding: 10px;
            }

            #pr-trigger-button { position: fixed; width: 50px; height: 50px; border-radius: 50%; background: var(--pr-bg-primary); color: var(--pr-text-primary); border: 2px solid var(--pr-border-color); font-size: 24px; cursor: pointer; z-index: 2147483647; display: flex; align-items: center; justify-content: center; box-shadow: 0 4px 10px rgba(0,0,0,0.15); transition: all 0.2s; }
            #pr-trigger-button:hover { border-color: var(--pr-accent-color); transform: scale(1.05); }
            
            .pr-items-container .item { 
                padding: 12px 16px; margin-bottom: 10px; background: var(--pr-bg-primary); 
                border-radius: 8px; cursor: pointer; border: 1px solid var(--pr-border-color); 
                transition: all 0.2s; box-shadow: 0 1px 3px rgba(0,0,0,0.05); 
            } 
            .pr-items-container .item:hover { border-color: var(--pr-accent-color); transform: translateY(-1px); box-shadow: 0 4px 8px rgba(0,0,0,0.08); }
            .pr-items-container .item strong { color: var(--pr-text-primary); display: block; margin-bottom: 6px; font-weight: 600; font-size: 14px; }
            .pr-items-container .item small { color: var(--pr-text-secondary); display: block; line-height: 1.4; }
            
            .pr-script-settings-panel { width: 750px; max-width: 95vw; height: 80vh; }
            .pr-settings-reply-list { display: flex; flex-direction: column; gap: 12px; padding-right: 10px; }
            .pr-reply-item { display: flex; flex-direction: column; gap: 10px; padding: 16px; background: var(--pr-bg-primary); border: 1px solid var(--pr-border-color); border-radius: 8px; box-shadow: 0 1px 4px rgba(0,0,0,0.05); }
            .pr-reply-row-top { display: flex; gap: 12px; align-items: center; }
            .pr-reply-title { flex-grow: 1; background: var(--pr-bg-secondary); border: 1px solid var(--pr-border-color); color: var(--pr-text-primary); padding: 8px 12px; border-radius: 6px; font-weight: 500;}
            .pr-reply-title:focus { outline:none; border-color: var(--pr-accent-color); }
            .pr-reply-text { width: 100%; background: var(--pr-bg-secondary); border: 1px solid var(--pr-border-color); color: var(--pr-text-primary); padding: 10px 12px; border-radius: 6px; min-height: 70px; resize: vertical; margin-top: 4px; font-family:inherit;}
            .pr-reply-text:focus { outline:none; border-color: var(--pr-accent-color); }
            .pr-remove-reply-btn { background: var(--pr-bg-tertiary); border: 1px solid var(--pr-border-color); border-radius: 6px; cursor: pointer; color: var(--pr-danger-color); padding: 6px 8px; display:flex; align-items:center; transition: background 0.2s;}
            .pr-remove-reply-btn:hover { background: var(--pr-danger-color); color: white; border-color: var(--pr-danger-color); }
            .pr-reply-controls { margin-bottom: 20px; display: flex; gap: 10px; }
            .pr-script-button { padding: 8px 16px; border-radius: 6px; border: none; cursor: pointer; background: var(--pr-accent-color); color: #fff; font-weight: 600; transition: all 0.2s; display:flex; align-items:center; justify-content:center; gap: 6px;}
            .pr-script-button:hover { background: var(--pr-accent-hover); transform: translateY(-1px); }
            .pr-script-button.button-danger { background: var(--pr-bg-tertiary); color: var(--pr-danger-color); border: 1px solid var(--pr-border-color); }
            .pr-script-button.button-danger:hover { background: var(--pr-danger-color); color: #fff; border-color: var(--pr-danger-color); }
            
            #pr-script-search { 
                width: 100%; padding: 12px 14px; background-color: var(--pr-bg-secondary) !important; 
                color: var(--pr-text-primary) !important; border: 1px solid var(--pr-border-color); 
                border-radius: 8px; margin-bottom: 12px; font-size: 14px; transition: all 0.2s;
            }
            #pr-script-search:focus { outline: none; border-color: var(--pr-accent-color); box-shadow: 0 0 0 3px rgba(14,165,233,0.15); }
            
            .pr-suggestion-btn { 
                background: var(--pr-bg-tertiary); border: 1px solid var(--pr-border-color); 
                color: var(--pr-text-secondary); padding: 4px 10px; font-size: 0.8em; 
                border-radius: 12px; cursor: pointer; transition: all .2s; margin: 2px;
            }
            .pr-suggestion-btn:hover { background: var(--pr-accent-color); border-color: var(--pr-accent-color); color: #fff; }
            
            .pr-quick-filters { display: flex; flex-wrap: wrap; gap: 12px; margin-bottom: 12px; margin-top: 8px; }
            .pr-quick-filters label { display: flex; align-items: center; gap: 6px; font-size: 0.85em; font-weight: 500; color: var(--pr-text-primary); cursor: pointer; }
        `;
                    const style = document.createElement('style'); style.textContent = css; document.head.appendChild(style);
                };

                const initialize = async () => {
                    await loadData(); injectCss();
                    setTimeout(() => { UI.createTriggerButton(); document.addEventListener('keydown', keyboardEventHandler); }, 2000);
                };

                if (window.self === window.top) {
                    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', initialize); else initialize();
                }
            }
        })();
    } catch (e) { console.error('[BUILDER] Erro fatal no módulo protocolos.js:', e); }

    /* --- MÓDULO ANEXADO: RESPOSTAS.JS --- */
    try {
        // ==UserScript==
        // @name         PureCloud - Respostas Rápidas Isoladas (v2.4.9 - Auto-Fetch)
        // @namespace    http://tampermonkey.net
        // @version      2.4.9
        // @description  Versão isolada (v2.4.4) com a lógica de Auto-Fetch (v1.5.17) adicionada.
        // @author       (Adaptado por Parceiro de Programacao)
        // @match        https://*.mypurecloud.*/*
        // @grant        GM_addStyle
        // @run-at       document-idle
        // ==/UserScript==

        // --- INÍCIO DO ISOLAMENTO (V5) ---
        // Esta "caixa" impede que este script colida com os outros (ex: Cronometros.js)
        (function () {
            'use strict';

            const SCRIPT_VERSION = '2.4.9-auto-fetch'; // Versão atualizada
            const DEBUG_MODE = true;

            // --- Log Helper ---
            const log = (...args) => { if (DEBUG_MODE) console.log(`[QR Script v${SCRIPT_VERSION}]`, ...args); };

            // --- NOVO (V2.4.9): URL para o ficheiro JSON de RESPOSTAS no GitHub Pages ---
            const RESPOSTAS_JSON_URL = 'https://kingoffjoss.github.io/AjaExtension/respostas_COMPLETAS.json';


            // --- CORES PADRÃO CYBERPUNK ELEGANTE ---
            const DEFAULT_CYBERPUNK_COLORS = { /* ... (igual v2.4.1) ... */
                '--cor-acento-primario': '#00BFFF', '--cor-acento-hover': '#40E0D0', '--cor-acento-texto': '#0D1117', '--cor-fundo-primario': '#0D1117', '--cor-fundo-secundario': '#161B22', '--cor-fundo-terciario': '#21262D', '--cor-borda': '#30363D', '--cor-texto-primario': '#C9D1D9', '--cor-texto-secundario': '#8B949E', '--cor-texto-desabilitado': '#484F58', '--cor-perigo': '#F47067', '--cor-perigo-hover': '#FF8080', '--cor-sucesso': '#3FB950', '--cor-info': '#58A6FF', '--glow-color': 'rgba(0, 191, 255, 0.2)', '--glow-hover-color': 'rgba(64, 224, 208, 0.3)'
            };
            const LIGHT_THEME_COLORS = { /* ... (igual v2.4.1) ... */
                '--cor-acento-primario': '#009999', '--cor-acento-hover': '#00CCCC', '--cor-acento-texto': '#FFFFFF', '--cor-fundo-primario': '#FFFFFF', '--cor-fundo-secundario': '#F7F7F9', '--cor-fundo-terciario': '#E8E8EE', '--cor-borda': '#D1D1D1', '--cor-texto-primario': '#1F1F1F', '--cor-texto-secundario': '#555555', '--cor-texto-desabilitado': '#AAAAAA', '--cor-perigo': '#D83A52', '--cor-perigo-hover': '#F85149', '--cor-sucesso': '#28A745', '--cor-info': '#17A2B8', '--glow-color': 'rgba(0, 153, 153, 0.1)', '--glow-hover-color': 'rgba(0, 204, 204, 0.2)'
            };

            // --- Respostas e Tags (Vazios) ---
            const initialQuickReplies = [];
            const requiredTagsMap = {};

            // --- ÍCONES SVG ---
            const ICONS = { /* ... (igual v2.4.1) ... */
                CHAT: `<svg class="panel-svg-icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm0 14H6l-2 2V4h16v12z"/></svg>`, SETTINGS: `<svg class="panel-svg-icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path d="M19.43 12.98c.04-.32.07-.64.07-.98s-.03-.66-.07-.98l2.11-1.65c.19-.15.24-.42.12-.64l-2-3.46c-.12-.22-.39-.3-.61-.22l-2.49 1c-.52-.4-1.08-.73-1.69-.98l-.38-2.65C14.46 2.18 14.25 2 14 2h-4c-.25 0-.46.18-.49.42l-.38 2.65c-.61.25-1.17.59-1.69.98l-2.49-1c-.23-.08-.49 0-.61.22l-2 3.46c-.13.22-.07.49.12.64l2.11 1.65c-.04.32-.07.65-.07.98s.03.66.07.98l-2.11 1.65c-.19.15-.24-.42-.12-.64l2 3.46c.12.22.39.3.61.22l2.49-1c.52.4 1.08.73 1.69.98l.38 2.65c.03.24.24.42.49.42h4c.25 0 .46-.18.49-.42l.38-2.65c.61.25 1.17.59 1.69.98l2.49 1c.23.08.49 0 .61.22l2-3.46c.12-.22-.07.49-.12-.64l-2.11-1.65zM12 15.5c-1.93 0-3.5-1.57-3.5-3.5s1.57-3.5 3.5-3.5 3.5 1.57 3.5 3.5-1.57 3.5-3.5 3.5z"/></svg>`, CLOSE: `<svg class="panel-svg-icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12 19 6.41z"/></svg>`, DELETE: `<svg class="panel-svg-icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/></svg>`, ADD: `<svg class="panel-svg-icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z"/></svg>`, IMPORT: `<svg class="panel-svg-icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path d="M9 16h6v-6h4l-8-8-8 8h4v6zm-4 2h14v2H5v-2z"/></svg>`, EXPORT: `<svg class="panel-svg-icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path d="M19 9h-4V3H9v6H5l7 7 7-7zM5 18v2h14v-2H5z"/></svg>`, FUNCTION: `<svg class="panel-svg-icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="4 17 10 11 4 5"></polyline><line x1="12" y1="19" x2="20" y2="19"></line></svg>`
            };

            // --- Mapeamento e Ordem das Categorias ---
            const categoryDisplayMap = { /* ... (igual v2.4.3) ... */
                'recent': '⏱️ Recentes', 'favorites': '⭐ Favoritos', 'all': 'Todas', 'INICIO_ENCERRAMENTO': 'Início/Fim', 'DADOS_ID': 'Dados/ID', 'ATIVO': 'Ativo', 'INSTABILIDADE': 'Instabilidade', 'DIAG_RAPIDO': 'Diag. Rápido', 'VELOCIDADE': 'Velocidade', 'SINAL_ROTA': 'Sinal/Rota', 'LOS_PON': 'LOS/PON (Fibra)', 'MANUTENCAO_SINAL': 'Manut. Sinal', 'ROTA_INOP': 'Rota Inop.', 'INSTALACAO': 'Instalação', 'EQUIPAMENTOS': 'Equipamentos', 'WIFI_SENHA': 'WiFi/Senha', 'AGENDAMENTO': 'Agendamento', 'COBRANCA': 'Cobrança', 'EQUIP_PART': 'Equip. Part.', 'APPS_IPTV': 'Apps/IPTV', 'SVA': 'SVA', 'JOGOS': 'Jogos', 'SITES_VPN': 'Sites/VPN', 'TELEFONIA': 'Telefonia', 'BRISATV': 'BrisaTV', 'FWA_5G': 'FWA (5G)', 'FWA_5G_INFO': 'FWA (Info)', 'INTERNOS': 'Internos', 'AVANCADOS': 'Avançados', 'CORDIAIS': 'Cordiais', 'SV_AVULSOS': 'Serv. Avulsos', 'INFO_TEC': 'Info Tec.', 'INATIVIDADE_ENC': 'Inatividade', 'CONFIG_TEC': 'Config. Téc.', 'IP_PORTAS': 'IP/Portas', 'FINANCEIRO': 'Financeiro', 'DIALOGO': 'Diálogo', 'I': 'I - Início', 'A': 'A - Ativo', 'E': 'E - Encerramento', 'C': 'C - Cordialidade', 'CL': 'CL - Contrato/Cli.', 'D': 'D - Diagnóstico', 'P': 'P - Procedimentos', 'PN': 'PN - Velocidade', 'AG': 'AG - Agendamento', 'CR': 'CR - Cobrança Cham.', 'SV': 'SV - Serv. Avulsos', 'L': 'L - LOS (Fibra)', 'PON': 'PON - PON (Fibra)', 'TP': 'TP - TP-Link', 'RTC': 'RTC - Rota Cobrança', 'RTA': 'RTA - Rota Abertura', 'PIS': 'PIS - Sist. Interno', 'INS': 'INS - Instalação', 'APP': 'APP - Aplicativos', 'T': 'T - Técnico/Wi-Fi', 'J': 'J - Jogos', 'S': 'S - Sites/VPN', 'TV': 'TV - BrisaTV', 'EQ': 'EQ - Equip. Part.', 'TRANSFERENCIA': 'Transf.'
            };
            const sidebarCategoryOrder = [ /* ... (igual v2.4.3) ... */
                'recent', 'favorites', 'all', 'INICIO_ENCERRAMENTO', 'DADOS_ID', 'ATIVO', 'INSTABILIDADE', 'DIAG_RAPIDO', 'VELOCIDADE', 'SINAL_ROTA', 'LOS_PON', 'MANUTENCAO_SINAL', 'ROTA_INOP', 'INSTALACAO', 'EQUIPAMENTOS', 'WIFI_SENHA', 'AGENDAMENTO', 'COBRANCA', 'EQUIP_PART', 'APPS_IPTV', 'SVA', 'JOGOS', 'SITES_VPN', 'TELEFONIA', 'BRISATV', 'FWA_5G', 'FWA_5G_INFO', 'INTERNOS', 'AVANCADOS', 'CORDIAIS', 'SV_AVULSOS', 'INFO_TEC', 'INATIVIDADE_ENC', 'CONFIG_TEC', 'IP_PORTAS', 'FINANCEIRO', 'DIALOGO', 'TRANSFERENCIA', 'I', 'CL', 'P', 'TP', 'RTC', 'RTA', 'PIS', 'T'
            ];

            // --- Configuração ---
            let CONFIG = {
                QUICK_REPLIES: [], LAST_COPIED_REPLY: '', RECENT_REPLIES: [],
                POPUP_POSITIONS: {}, DARK_MODE: true,
                customThemeColors: { ...DEFAULT_CYBERPUNK_COLORS }
            };

            // --- Funções Utilitárias (findEl, copyTextToClipboard, formatReplyText, makeDraggable) ---
            // (sem alterações)
            const findEl = (q, p = document) => { if (!Array.isArray(q)) q = [q]; for (const s of q) { try { if (p && typeof p.querySelector === 'function') { const e = p.querySelector(s); if (e) return e } } catch (e) {/* log("Selector error:",s,e) */ } } return null };
            const copyTextToClipboard = async (t) => { try { await navigator.clipboard.writeText(t); return !0 } catch (e) { log("Copy failed:", e); return !1 } };

            // --- FUNÇÃO formatReplyText COMPLETA (v2.4.4) ---
            const formatReplyText = (t, n = 'cliente', i = 'protocolo') => { const r = { 'NOME DO CLIENTE': n, 'NOME_DO_CLIENTE': n, NOME: n, 'NOME COMPLETO': n, NUMERO: i, PROTOCOLO: i, 'DATA NASC': '[Confirmar Data]', 'DATA_NASC': '[Confirmar Data]', ENDERECO: '[Confirmar Endereço]', CPF: '[Confirmar CPF]', CIDADE: '[Informar Cidade]', 'DIA E MÊS': '[Informar Dia/Mês]', 'DIA/MÊS': '[Informar Dia/Mês]', 'MANHÃ OU TARDE': '[Manhã/Tarde]', 'MANHA_OU_TARDE': '[Manhã/Tarde]', 'QUANTIDADE HORAS': '[X]', 'QUANTIDADE_HORAS': '[X]', 'QUANTIDADE DE CLIENTES': '[Y]', 'QUANTIDADE_DE_CLIENTES': '[Y]', EMAIL: '[Confirmar Email]', 'NÚMERO DE CONTATO': '[Confirmar Contato]', 'NUMERO DE CONTATO': '[Confirmar Contato]', OPERADORA: '[Operadora]', 'APARELHO ESPECÍFICO': '[Aparelho]', 'APARELHO_ESPECIFICO': '[Aparelho]', SETOR: '[Setor]' }; let o = t; for (const c in r) { const s = c.replace(/ /g, '[_\\s]*'), a = new RegExp(`\\[\\s*${s}\\s*\\]|\\{\\s*${s}\\s*\\}`, 'gi'); o = o.replace(a, r[c] || `[${c}]`) } return o };

            // (makeDraggable usa 'qr_popupPositions' - já está prefixado e correto)
            const makeDraggable = (popup, header, popupName) => {
                if (!header) header = popup;
                let isDragging = false, dragOffsetX = 0, dragOffsetY = 0;

                let enforceBounds = (top, left) => {
                    const vpW = window.innerWidth, vpH = window.innerHeight;
                    const pW = popup.offsetWidth || 300, pH = popup.offsetHeight || 300;
                    let safeT = Math.max(5, Math.min(vpH - pH - 5, top));
                    let safeL = Math.max(5, Math.min(vpW - pW - 5, left));
                    if (pW > vpW) safeL = 0; if (pH > vpH) safeT = 0;
                    return { top: safeT, left: safeL };
                };

                try {
                    if (typeof CONFIG === 'undefined') window.CONFIG = { POPUP_POSITIONS: {} };
                    if (!CONFIG.POPUP_POSITIONS) CONFIG.POPUP_POSITIONS = {};
                    let saved = sessionStorage.getItem('qr_popupPositions') || sessionStorage.getItem('popupPositions') || '{}';
                    CONFIG.POPUP_POSITIONS = JSON.parse(saved);
                } catch (e) { }

                popup.style.position = 'fixed';
                popup.style.margin = '0';
                popup.style.transform = 'none';

                // Initial Positioning logic
                if (popupName === 'quickReplyPopup') {
                    const dW = '650px', dH = '75vh';
                    popup.style.width = dW; popup.style.height = dH;
                    setTimeout(() => {
                        const safe = enforceBounds(Math.max(5, (window.innerHeight - popup.offsetHeight) / 2), Math.max(5, (window.innerWidth - popup.offsetWidth) / 2));
                        popup.style.top = safe.top + 'px'; popup.style.left = safe.left + 'px';
                    }, 50);
                } else if (CONFIG && CONFIG.POPUP_POSITIONS && CONFIG.POPUP_POSITIONS[popupName]?.top && CONFIG.POPUP_POSITIONS[popupName]?.left) {
                    const safe = enforceBounds(parseFloat(CONFIG.POPUP_POSITIONS[popupName].top), parseFloat(CONFIG.POPUP_POSITIONS[popupName].left));
                    popup.style.top = safe.top + 'px'; popup.style.left = safe.left + 'px';
                    if (CONFIG.POPUP_POSITIONS[popupName].width) popup.style.width = CONFIG.POPUP_POSITIONS[popupName].width;
                    if (CONFIG.POPUP_POSITIONS[popupName].height) popup.style.height = CONFIG.POPUP_POSITIONS[popupName].height;
                } else {
                    popup.style.top = '10%'; popup.style.left = '10%';
                }

                const savePos = () => {
                    if (popupName === 'quickReplyPopup' && !isDragging) return;
                    const rect = popup.getBoundingClientRect();
                    const safe = enforceBounds(rect.top, rect.left);
                    if (typeof CONFIG !== 'undefined' && CONFIG.POPUP_POSITIONS) {
                        CONFIG.POPUP_POSITIONS[popupName] = { top: safe.top + 'px', left: safe.left + 'px', width: popup.style.width, height: popup.style.height };
                        try {
                            sessionStorage.setItem('qr_popupPositions', JSON.stringify(CONFIG.POPUP_POSITIONS));
                            sessionStorage.setItem('popupPositions', JSON.stringify(CONFIG.POPUP_POSITIONS));
                        } catch (e) { }
                    }
                };

                header.addEventListener('mousedown', (e) => {
                    if (e.target.closest('button') || e.target.closest('.compact-btn') || e.target.closest('input') || e.target.classList.contains('os-btn') || e.button !== 0) return;
                    e.preventDefault();
                    isDragging = true;
                    popup.style.transition = 'none';

                    const rect = popup.getBoundingClientRect();
                    popup.style.left = rect.left + 'px';
                    popup.style.top = rect.top + 'px';
                    popup.style.bottom = 'auto';
                    popup.style.right = 'auto';

                    dragOffsetX = e.clientX - rect.left;
                    dragOffsetY = e.clientY - rect.top;
                }, { passive: false });

                document.addEventListener('mousemove', (e) => {
                    if (!isDragging) return;
                    e.preventDefault();
                    const safe = enforceBounds(e.clientY - dragOffsetY, e.clientX - dragOffsetX);
                    popup.style.top = safe.top + 'px';
                    popup.style.left = safe.left + 'px';
                }, { passive: false });

                document.addEventListener('mouseup', () => {
                    if (isDragging) {
                        isDragging = false;
                        savePos();
                    }
                });

                try {
                    const observer = new ResizeObserver(() => { if (!isDragging) savePos(); });
                    observer.observe(popup);
                } catch (e) { }
            };


            // --- Lógica de Dados (loadData, saveData, logUsedReply) ---
            // *** MODIFICADO v2.4.9 (Auto-Fetch Adicionado) ***
            const loadData = async () => {
                let repliesLoaded = false;

                // 1. Tentar carregar Respostas do LocalStorage
                try {
                    const localReplies = localStorage.getItem('qr_quickReplies'); // Prefixo 'qr_'
                    if (localReplies) {
                        const parsed = JSON.parse(localReplies);
                        if (Array.isArray(parsed) && parsed.length > 0) {
                            CONFIG.QUICK_REPLIES = parsed;
                            repliesLoaded = true;
                            log("Respostas Rápidas carregadas do LocalStorage.");
                        } else {
                            localStorage.removeItem('qr_quickReplies');
                            log("LocalStorage de Respostas Rápidas estava inválido. Removido.");
                        }
                    }
                } catch (e) {
                    log("Erro ao ler Respostas Rápidas do LocalStorage (será substituído):", e);
                    localStorage.removeItem('qr_quickReplies');
                }

                // 2. Se o LocalStorage estiver vazio, buscar do GitHub
                if (!repliesLoaded) {
                    log(`LocalStorage de Respostas Rápidas vazio. Puxando de: ${RESPOSTAS_JSON_URL}`);
                    try {
                        const response = await safeFetch(RESPOSTAS_JSON_URL + '?v=' + Date.now());
                        if (!response.ok) {
                            throw new Error(`Falha ao buscar: ${response.statusText} (status ${response.status})`);
                        }
                        const data = await response.json();

                        if (Array.isArray(data)) {
                            CONFIG.QUICK_REPLIES = data;
                            log(`Respostas Rápidas (${data.length}) puxadas com sucesso do GitHub.`);
                            // Salvar no LocalStorage para a próxima vez
                            try {
                                localStorage.setItem('qr_quickReplies', JSON.stringify(data)); // Prefixo 'qr_'
                                log("Respostas Rápidas do GitHub salvas no LocalStorage.");
                            } catch (saveErr) {
                                log("Erro ao salvar Respostas Rápidas no LocalStorage:", saveErr);
                                UI.createNotification("Respostas carregadas, mas falha ao salvar localmente.", 'warn', 4000);
                            }
                        } else {
                            throw new Error("Formato do JSON de Respostas Rápidas é inválido (esperado um Array []).");
                        }

                    } catch (fetchErr) {
                        log("ERRO CRÍTICO ao puxar Respostas Rápidas do GitHub:", fetchErr);
                        CONFIG.QUICK_REPLIES = initialQuickReplies;
                        try { UI.createNotification("Falha ao carregar Respostas Rápidas do GitHub.", 'error', 5000); } catch (e) { }
                    }
                }

                // 3. Carregar o resto das configurações (não-respostas)
                try {
                    CONFIG.LAST_COPIED_REPLY = localStorage.getItem('qr_lastCopiedReply') || '';
                    CONFIG.RECENT_REPLIES = JSON.parse(localStorage.getItem('qr_recentReplies_v3')) || [];
                    CONFIG.POPUP_POSITIONS = JSON.parse(sessionStorage.getItem('qr_popupPositions') || '{}');
                    const e = localStorage.getItem('qr_darkMode');
                    CONFIG.DARK_MODE = e !== 'false';
                    const t = localStorage.getItem('qr_customThemeColors');
                    CONFIG.customThemeColors = t ? JSON.parse(t) : { ...DEFAULT_CYBERPUNK_COLORS };
                    for (const o in DEFAULT_CYBERPUNK_COLORS) { if (!CONFIG.customThemeColors[o]) { CONFIG.customThemeColors[o] = DEFAULT_CYBERPUNK_COLORS[o] } }
                    log("Outras configs (Recentes, Posição, Tema) carregadas.");
                } catch (e) {
                    log("Erro ao carregar outras configs:", e); CONFIG.RECENT_REPLIES = []; CONFIG.POPUP_POSITIONS = {}; CONFIG.DARK_MODE = !0; CONFIG.customThemeColors = { ...DEFAULT_CYBERPUNK_COLORS }
                }

                // 4. Processar os dados carregados
                CONFIG.QUICK_REPLIES = CONFIG.QUICK_REPLIES.map(e => ({ ...e, isFavorite: e.isFavorite || !1, requiredData: e.requiredData || [], hotkey: e.hotkey || null }))
            };
            // --- FIM DA MODIFICAÇÃO (V2.4.9) ---

            const saveData = () => {
                try {
                    localStorage.setItem('qr_quickReplies', JSON.stringify(CONFIG.QUICK_REPLIES)); // PREFIXADO
                    localStorage.setItem('qr_lastCopiedReply', CONFIG.LAST_COPIED_REPLY); // PREFIXADO
                    localStorage.setItem('qr_recentReplies_v3', JSON.stringify(CONFIG.RECENT_REPLIES)); // PREFIXADO
                    localStorage.setItem('qr_darkMode', CONFIG.DARK_MODE); // (Já estava prefixado)
                    localStorage.setItem('qr_customThemeColors', JSON.stringify(CONFIG.customThemeColors)); // PREFIXADO
                    log("Data saved.")
                } catch (e) { log("Error saving data:", e); UI.createNotification("Error saving settings.", 'error') } applyThemeColors(CONFIG.DARK_MODE ? CONFIG.customThemeColors : LIGHT_THEME_COLORS); document.body.classList.toggle('rr-escurinho', CONFIG.DARK_MODE)
            };

            const logUsedReply = (e, t) => {
                const o = 5, n = { title: e, text: t }; CONFIG.RECENT_REPLIES = CONFIG.RECENT_REPLIES.filter(l => l.title !== e || l.text !== t); CONFIG.RECENT_REPLIES.unshift(n); if (CONFIG.RECENT_REPLIES.length > o) { CONFIG.RECENT_REPLIES.length = o } try {
                    localStorage.setItem('qr_recentReplies_v3', JSON.stringify(CONFIG.RECENT_REPLIES)) // PREFIXADO
                } catch (l) { log("Error saving recents:", l) }
            };
            // --- FIM DA MODIFICAÇÃO ---

            // --- Função para Aplicar Cores ---
            // Neutralizada para utilizar Variáveis Globais Unificadas do Cronômetros (v20)
            const applyThemeColors = (colors) => { /* Engine de tema customizado desativada em favor do tema global. */ };

            // --- Funções para Extrair Dados (documentExtractor) ---
            // (sem alterações)
            const documentExtractor = { getParticipantName: () => { const e = ['h3.participant-name', 'div.interaction-name-wrapper div.participant-name > span', 'p.participant-name', 'span[data-qa-id="participant-name"]', 'h2.participant-name', '.top-section-block .title-wrapper .title-text', '.conversation-header .participant-info .name'], t = findEl(e); if (!t) return 'cliente'; const o = t.textContent.trim(), n = o.match(/^([a-zA-Z\sáéíóúâêîôûãõçÁÉÍÓÚÂÊÎÔÛÃÕÇ'.-]+)(?:\s*[|•\-\s(]?\s*(?:\d{2,}|[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}))?/); return n && n[1] ? n[1].trim() : o || 'cliente' }, getInteractionId: () => { const e = ['span[data-qa-id="interaction-id"]', '[data-qa-id="detail-value-interactionId"]', '.interaction-id-value', '#interactionIdDisplay', '.conversation-id span'], t = findEl(e); return t?.textContent.trim().replace(/#/g, '') || 'protocolo' } };

            // --- Funções Throttle e escapeRegExp ---
            // (sem alterações)
            const throttle = (e, t) => { let o; return function (...n) { if (!o) { e.apply(this, n); o = !0; setTimeout(() => o = !1, t) } } };
            const escapeRegExp = e => e.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

            // --- Ouvinte de Eventos de Teclado (keyboardEventHandler) ---
            // *** MODIFICADO v2.4.4 (Conflict Fix) ***
            const keyboardEventHandler = (e) => {
                const t = e.target.tagName.toUpperCase();
                // PREFIXADO
                const o = e.target.closest('.qr-script-popup') && (t === 'INPUT' || t === 'TEXTAREA');
                if (e.key !== 'Escape' && o) { return }
                if (e.ctrlKey && e.shiftKey && (e.key === 'Ç' || e.key === 'ç' || e.code === 'Backslash')) { e.preventDefault(); log("Shortcut detected."); UI.createQuickReplyPopup() }
                if (e.key === 'Escape') {
                    const n = document.querySelector('.qr-script-quick-reply-popup'); // (Já prefixado)
                    const l = document.querySelector('.qr-script-settings-panel'); // PREFIXADO
                    if (n) { log("Closing QR Popup with ESC."); n.remove(); e.preventDefault() }
                    else if (l) { log("Closing Settings Popup with ESC."); l.remove(); e.preventDefault() }
                }
            };

            // --- FUNÇÕES PERSONALIZADAS ---
            function exampleCustomFunction() { log("Botão de Exemplo Clicado!"); const name = documentExtractor.getParticipantName(); alert(`Função de exemplo executada!\nCliente: ${name}`); }

            // --- Interface do Usuário (UI) ---
            // *** MODIFICADO v2.4.4 (Conflict Fix) ***
            const UI = {
                createNotification(message, type = 'info', duration = 3000) {
                    let container = document.getElementById('qr-script-notification-container'); // (ID já prefixado)
                    if (!container) { container = document.createElement('div'); container.id = 'qr-script-notification-container'; document.body.appendChild(container); }
                    const n = document.createElement("div"); n.textContent = message;
                    n.className = `qr-script-notification qr-script-notification-${type}`; // PREFIXADO
                    container.prepend(n);
                    const visibleNotifications = container.querySelectorAll('.qr-script-notification'); // PREFIXADO
                    if (visibleNotifications.length > 5) { visibleNotifications[visibleNotifications.length - 1].remove(); }
                    setTimeout(() => { n.style.opacity = '0'; n.style.transform = 'translateX(100%)'; setTimeout(() => n.remove(), 300); }, duration);
                },
                createQuickReplyPopup() {
                    document.querySelector('.qr-script-quick-reply-popup')?.remove(); // (Já prefixado)
                    document.querySelector('.qr-script-settings-panel')?.remove(); // PREFIXADO
                    const popup = document.createElement("div");
                    popup.className = 'qr-script-quick-reply-popup qr-script-popup'; // PREFIXADO
                    popup.innerHTML = `<div class="panel-header"><h4>Respostas Rápidas</h4><div class="panel-header-buttons purecloud-script-button"><button id="qr-btn-theme" class="panel-header-btn purecloud-script-button" title="Mudar Tema">🌗</button><button class="panel-header-btn settings-btn purecloud-script-button" title="Gerenciar Script">${ICONS.SETTINGS}</button><button class="panel-header-btn qr-script-popup-close-btn purecloud-script-button" title="Fechar (Esc)">${ICONS.CLOSE}</button></div></div><div class="qr-popup-body"><div id="qr-sidebar"><ul id="qr-category-list"></ul></div><div id="qr-main-content"><input type="text" id="purecloud-script-quick-reply-search" placeholder="Buscar..."><div id="quick-suggestion-filters" class="suggestion-filters-container"></div><div id="quick-reply-results" class="items-container"></div></div></div>`; // PREFIXADO qr-script-popup-close-btn
                    document.body.appendChild(popup);
                    makeDraggable(popup, popup.querySelector('.panel-header'), 'quickReplyPopup');
                    const themeBtnQR = popup.querySelector('#qr-btn-theme');
                    const savedThemeQR = localStorage.getItem('QR_THEME');
                    if (savedThemeQR === 'light') {
                        popup.classList.add('local-light-mode');
                        themeBtnQR.innerText = '☀️';
                    } else if (savedThemeQR === 'dark') {
                        popup.classList.add('cc-escurinho');
                        themeBtnQR.innerText = '🌗';
                    }
                    themeBtnQR.onclick = () => {
                        const isLight = popup.classList.contains('local-light-mode');
                        if (isLight) {
                            popup.classList.remove('local-light-mode');
                            popup.classList.add('cc-escurinho');
                            localStorage.setItem('QR_THEME', 'dark');
                            themeBtnQR.innerText = '🌗';
                            themeBtnQR.title = 'Mudar para Tema Claro';
                        } else {
                            popup.classList.remove('cc-escurinho');
                            popup.classList.add('local-light-mode');
                            localStorage.setItem('QR_THEME', 'light');
                            themeBtnQR.innerText = '☀️';
                            themeBtnQR.title = 'Mudar para Tema Escuro';
                        }
                    };

                    popup.querySelector('.qr-script-popup-close-btn').onclick = () => popup.remove(); // PREFIXADO
                    popup.querySelector('.settings-btn').onclick = () => UI.createSettingsPanel();
                    // ... (restante da lógica da função é interna e não precisa de prefixo)
                    const searchInput = popup.querySelector('#purecloud-script-quick-reply-search'); const categoryListContainer = popup.querySelector('#qr-category-list'); const resultsContainer = popup.querySelector('#quick-reply-results'); const suggestionsContainer = popup.querySelector('#quick-suggestion-filters'); let currentCategory = 'favorites'; let currentSearchTerm = ''; const getReplyDataTags = (title) => CONFIG.QUICK_REPLIES.find(r => r.title === title)?.requiredData || []; const populateReplies = (category, searchTerm) => {
                        const name = documentExtractor.getParticipantName(); const id = documentExtractor.getInteractionId(); resultsContainer.innerHTML = ''; let filteredReplies = CONFIG.QUICK_REPLIES; let headerText = ''; if (searchTerm) { const lower = searchTerm.toLowerCase(); const regex = new RegExp(`\\b${escapeRegExp(lower)}|${escapeRegExp(lower)}`, 'i'); filteredReplies = CONFIG.QUICK_REPLIES.filter(r => regex.test(r.title.replace(/ - /g, ' ')) || regex.test(r.text) || (r.hotkey && regex.test(r.hotkey))); headerText = `Busca por "${searchTerm}"`; currentCategory = 'search'; } else if (category === 'favorites') { filteredReplies = filteredReplies.filter(r => r.isFavorite); headerText = categoryDisplayMap['favorites']; } else if (category === 'recent') { const titles = CONFIG.RECENT_REPLIES.map(r => r.title); filteredReplies = titles.map(title => CONFIG.QUICK_REPLIES.find(r => r.title === title)).filter(Boolean); headerText = categoryDisplayMap['recent']; } else if (category && category !== 'all') { filteredReplies = filteredReplies.filter(r => r.title.startsWith(category + ' - ')); headerText = categoryDisplayMap[category] || `Categoria: ${category}`; } else { headerText = categoryDisplayMap['all']; } const headerEl = document.createElement('h4'); headerEl.className = 'qr-results-header'; headerEl.textContent = `${headerText} (${filteredReplies.length})`; resultsContainer.appendChild(headerEl);

                        // --- MODIFICAÇÃO (V2.4.9) ---
                        // Substituído o if (filteredReplies.length === 0...)
                        if (filteredReplies.length === 0 && CONFIG.QUICK_REPLIES.length === 0 && !searchTerm) {
                            resultsContainer.innerHTML += `<p class="qr-no-results">Nenhuma resposta. (Se for o primeiro uso, recarregue a página. Se o erro persistir, verifique o URL do JSON no script).</p>`; return;
                            // --- FIM DA MODIFICAÇÃO ---
                        } else if (filteredReplies.length === 0) { resultsContainer.innerHTML += `<p class="qr-no-results">Nenhuma resposta encontrada.</p>`; return; } if (category !== 'recent') { filteredReplies.sort((a, b) => a.title.localeCompare(b.title)); } filteredReplies.forEach(reply => { const match = reply.title.match(/^([A-Z0-9_]+)\s*-\s*/); const subTitle = match ? reply.title.substring(match[0].length).trim() : reply.title; const tags = getReplyDataTags(reply.title); const tagsHtml = tags.map(t => `<span class="data-tag tag-${t.replace(/[^a-zA-Z0-9]/g, '_')}" title="${t.replace(/_/g, ' ')}">${t.substring(0, Math.min(t.length, 4))}${t.length > 4 ? '.' : ''}</span>`).join(''); const reqClass = tags.length > 0 ? 'requires-tags-highlight' : ''; const item = document.createElement('div'); item.className = `item quick-reply-item ${reqClass}`; item.innerHTML = `<div class="reply-header"><strong>${subTitle} ${reply.isFavorite ? '<span title="Favorito" class="favorite-star">⭐</span>' : ''} ${reply.hotkey ? `<span class"reply-hotkey-display" title="Atalho">${reply.hotkey}</span>` : ''}</strong><div class="data-tags">${tagsHtml}</div></div><small>${reply.text.substring(0, 150)}${reply.text.length > 150 ? '...' : ''}</small>`; item.title = reply.text; item.onclick = async () => { const final = formatReplyText(reply.text, name, id); CONFIG.LAST_COPIED_REPLY = final; logUsedReply(reply.title, reply.text); if (await copyTextToClipboard(final)) { UI.createNotification("Copiado!", 'success', 1500); } else { UI.createNotification("Erro ao copiar.", 'error'); } }; resultsContainer.appendChild(item); }); resultsContainer.scrollTop = 0;
                    }; const buildSuggestionFilters = () => { suggestionsContainer.innerHTML = ''; const suggestions = ['LOS', 'PON', 'Instabilidade', 'Velocidade', 'Sem Gerência', 'TV', 'Wi-Fi', 'Senha', 'Agendamento', 'FWA', '5G']; suggestions.forEach(s => { const btn = document.createElement('button'); btn.className = 'suggestion-btn'; btn.textContent = s; btn.title = `Buscar por "${s}"`; btn.onclick = () => { searchInput.value = s; searchInput.dispatchEvent(new Event('input', { bubbles: true })); }; suggestionsContainer.appendChild(btn); }); }; const buildCategoriesSidebar = () => { categoryListContainer.innerHTML = ''; const cats = new Set(sidebarCategoryOrder); cats.forEach(code => { const hasReplies = CONFIG.QUICK_REPLIES.some(r => r.title.startsWith(code + ' - ')); const isSpecial = ['recent', 'favorites', 'all'].includes(code); if ((hasReplies || isSpecial) && categoryDisplayMap[code]) { const li = document.createElement('li'); li.className = 'qr-category-item'; li.dataset.category = code; li.textContent = categoryDisplayMap[code]; li.title = categoryDisplayMap[code]; if (code === currentCategory && !currentSearchTerm) { li.classList.add('active'); } li.onclick = () => { currentCategory = code; currentSearchTerm = ''; searchInput.value = ''; categoryListContainer.querySelectorAll('.qr-category-item').forEach(i => i.classList.remove('active')); li.classList.add('active'); buildSuggestionFilters(); populateReplies(currentCategory, ''); }; categoryListContainer.appendChild(li); } }); }; searchInput.oninput = throttle(() => { currentSearchTerm = searchInput.value.trim(); categoryListContainer.querySelectorAll('.qr-category-item').forEach(i => i.classList.remove('active')); if (!currentSearchTerm) { const prev = categoryListContainer.querySelector(`[data-category="${currentCategory}"]`); if (prev && currentCategory !== 'search') { prev.classList.add('active'); populateReplies(currentCategory, ''); } else { currentCategory = 'favorites'; categoryListContainer.querySelector(`[data-category="favorites"]`)?.classList.add('active'); populateReplies(currentCategory, ''); } } else { populateReplies(null, currentSearchTerm); } }, 300); buildCategoriesSidebar(); buildSuggestionFilters(); populateReplies(currentCategory, ''); searchInput.focus();
                },
                createSettingsPanel() {
                    document.querySelector('.qr-script-quick-reply-popup')?.remove(); // (Já prefixado)
                    document.querySelector('.qr-script-settings-panel')?.remove(); // PREFIXADO
                    const panel = document.createElement('div');
                    panel.className = 'qr-script-settings-panel qr-script-popup'; // PREFIXADO
                    // PREFIXADO classes: qr-script-popup-close-btn, qr-script-button, qr-button-danger, qr-button-secondary, qr-save-settings-btn (ID)
                    panel.innerHTML = `<div class="panel-header"><h2>Gerenciar Script</h2><div class="panel-header-buttons purecloud-script-button"><button class="panel-header-btn qr-script-popup-close-btn purecloud-script-button" title="Fechar (Esc)">${ICONS.CLOSE}</button></div></div><div class="panel-content-wrapper"><div class="settings-tabs"><button class="tab-button active purecloud-script-button" data-tab="replies">Respostas</button><button class="tab-button purecloud-script-button" data-tab="appearance">Aparência</button><button class="tab-button purecloud-script-button" data-tab="actions">Funções</button></div><div class="panel-content"><div class="settings-tab-content active" id="tab-content-replies"><input type="file" id="import-replies-input" accept=".json" style="display: none;"><div class="reply-controls"><button id="add-reply-btn" class="qr-script-button purecloud-script-button">${ICONS.ADD} Adicionar</button><button id="import-replies-btn" class="qr-script-button purecloud-script-button">${ICONS.IMPORT} Importar</button><button id="export-replies-btn" class="qr-script-button purecloud-script-button">${ICONS.EXPORT} Exportar</button><button id="restore-replies-btn" class="qr-script-button qr-button-danger purecloud-script-button">${ICONS.DELETE} Limpar Tudo</button></div><div id="settings-quick-replies-list" class="settings-reply-list"></div></div><div class="settings-tab-content" id="tab-content-appearance"><div class="settings-group-inline appearance-toggle"><label for="dark-mode-toggle">Modo Escuro:</label><label class="switch"><input type="checkbox" id="dark-mode-toggle" ${CONFIG.DARK_MODE ? 'checked' : ''}><span class="slider round"></span></label></div><div class="custom-colors-section"><h4>Personalizar Tema Cyberpunk (Modo Escuro)</h4><div class="color-picker-grid">${Object.entries(DEFAULT_CYBERPUNK_COLORS).map(([key, defaultValue]) => `<div class="color-picker-item"><label for="color-${key.replace(/--/g, '')}">${key.replace('--cor-', '').replace(/_/g, ' ').replace(/-/g, ' ')}:</label><input type="color" id="color-${key.replace(/--/g, '')}" data-color-key="${key}" value="${CONFIG.customThemeColors[key] || defaultValue}"></div>`).join('')}</div><button id="reset-colors-btn" class="qr-script-button qr-button-secondary purecloud-script-button">Resetar Cores</button></div></div><div class="settings-tab-content" id="tab-content-actions"><div class="custom-actions-section"><h4>Funções Personalizadas</h4><div class="custom-actions-buttons purecloud-script-button"><button id="custom-action-example-btn" class="qr-script-button qr-button-secondary purecloud-script-button">${ICONS.FUNCTION} Exemplo</button></div></div></div></div></div><div class="panel-footer"><button id="qr-save-settings-btn" class="qr-script-button purecloud-script-button">Salvar e Fechar</button></div>`;
                    document.body.appendChild(panel);
                    makeDraggable(panel, panel.querySelector('.panel-header'), 'settingsPanel');
                    // Herdar tema do popup principal
                    const savedThemeQR = localStorage.getItem('QR_THEME');
                    if (savedThemeQR === 'dark') panel.classList.add('cc-escurinho');
                    else if (savedThemeQR === 'light') panel.classList.add('local-light-mode');
                    else panel.classList.add('cc-escurinho'); // fallback escuro
                    panel.querySelector('.qr-script-popup-close-btn').onclick = () => panel.remove(); // PREFIXADO
                    // ... (restante da lógica da função é interna e não precisa de prefixo)
                    const tabs = panel.querySelectorAll('.tab-button'); const contents = panel.querySelectorAll('.settings-tab-content'); tabs.forEach(tab => { tab.addEventListener('click', () => { log(`Tab clicked: ${tab.dataset.tab}`); const targetId = `tab-content-${tab.dataset.tab}`; const targetContent = panel.querySelector(`#${targetId}`); tabs.forEach(t => t.classList.remove('active')); contents.forEach(c => c.classList.remove('active')); tab.classList.add('active'); if (targetContent) { targetContent.classList.add('active'); log(`Activated tab content: #${targetId}`); } else { log(`Error: Target content not found for id #${targetId}`); } }); }); const getReplyDataTags = (title) => CONFIG.QUICK_REPLIES.find(r => r.title === title)?.requiredData || []; const renderRepliesSettings = () => { const list = panel.querySelector('#settings-quick-replies-list'); list.innerHTML = ''; const sorted = [...CONFIG.QUICK_REPLIES].sort((a, b) => a.title.localeCompare(b.title)); sorted.forEach((reply) => { const idx = CONFIG.QUICK_REPLIES.findIndex(r => r.title === reply.title && r.text === reply.text); const item = document.createElement('div'); item.className = 'reply-item'; item.dataset.originalIndex = idx; const tags = getReplyDataTags(reply.title); const tagsHtml = tags.map(t => `<span class="data-tag tag-${t.replace(/[^a-zA-Z0-9]/g, '_')}">${t.replace(/_/g, ' ')}</span>`).join(' '); item.innerHTML = `<input type="checkbox" class="favorite-toggle" title="Favorito" ${reply.isFavorite ? 'checked' : ''}><input type="text" value="${reply.title}" class="reply-title" placeholder="CATEGORIA - Título"><input type="text" value="${reply.hotkey || ''}" class="reply-hotkey" placeholder="Atalho (ex: /i1)"><div class="data-tags">${tagsHtml}</div><textarea class="reply-text" rows="3" placeholder="Texto...">${reply.text}</textarea><button class="remove-reply-btn purecloud-script-button" title="Remover">${ICONS.DELETE}</button>`; list.appendChild(item); }); list.querySelectorAll('.remove-reply-btn').forEach(btn => { btn.onclick = (e) => { if (confirm('Remover esta resposta?')) { e.target.closest('.reply-item').remove(); } }; }); }; panel.querySelector('#add-reply-btn').onclick = () => { const list = panel.querySelector('#settings-quick-replies-list'); const item = document.createElement('div'); item.className = 'reply-item'; item.dataset.originalIndex = '-1'; item.innerHTML = `<input type="checkbox" class="favorite-toggle" title="Favorito"><input type="text" value="NOVA - Título" class="reply-title" placeholder="CATEGORIA - Título"><input type="text" value="" class="reply-hotkey" placeholder="Atalho (ex: /i1)"><div class="data-tags"></div><textarea class="reply-text" rows="3" placeholder="Texto..."></textarea><button class="remove-reply-btn purecloud-script-button" title="Remover">${ICONS.DELETE}</button>`; list.prepend(item); item.querySelector('.remove-reply-btn').onclick = (e) => { if (confirm('Remover esta resposta?')) { e.target.closest('.reply-item').remove(); } }; item.querySelector('.reply-title').focus(); item.querySelector('.reply-title').select(); }; panel.querySelector('#restore-replies-btn').onclick = () => { if (confirm("Limpar TODAS as respostas?")) { CONFIG.QUICK_REPLIES = []; renderRepliesSettings(); UI.createNotification("Respostas limpas. Salve para confirmar.", "info", 4000); } }; const fileInput = panel.querySelector('#import-replies-input'); panel.querySelector('#export-replies-btn').onclick = () => { try { if (CONFIG.QUICK_REPLIES.length === 0) { UI.createNotification("Nada para exportar.", 'warn'); return; } const json = JSON.stringify(CONFIG.QUICK_REPLIES, null, 2); const blob = new Blob([json], { type: 'application/json' }); const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = 'respostas_rapidas_backup.json'; document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(url); UI.createNotification(`Exportado (${CONFIG.QUICK_REPLIES.length})!`, 'success'); } catch (e) { log("Erro exportar:", e); UI.createNotification("Erro ao exportar.", 'error'); } }; panel.querySelector('#import-replies-btn').onclick = () => { fileInput.click(); }; fileInput.onchange = (event) => { const file = event.target.files[0]; if (!file) return; const reader = new FileReader(); reader.onload = (e) => { try { const imported = JSON.parse(e.target.result); if (!Array.isArray(imported) || (imported.length > 0 && (!imported[0].title || !imported[0].text))) { throw new Error('JSON inválido.'); } const msg = imported.length > 0 ? `Importar ${imported.length} respostas?` : "Arquivo vazio. Limpar atuais?"; if (confirm(`${msg}\n\nATENÇÃO: Substituirá as respostas atuais. Salve para confirmar.`)) { CONFIG.QUICK_REPLIES = imported.map(r => ({ title: r.title || "INVÁLIDO", text: r.text || "INVÁLIDO", isFavorite: r.isFavorite || false, requiredData: (Array.isArray(r.requiredData) ? r.requiredData : []).map(t => t.replace(/[{}]/g, '').replace(/ /g, '_').toUpperCase().replace(/[ÁÀÂÃÄ]/g, 'A').replace(/[ÉÈÊË]/g, 'E').replace(/[ÍÌÎÏ]/g, 'I').replace(/[ÓÒÔÕÖ]/g, 'O').replace(/[ÚÙÛÜ]/g, 'U').replace(/Ç/g, 'C').replace(/[^A-Z0-9_]/g, '')), hotkey: r.hotkey || null })); renderRepliesSettings(); UI.createNotification("Importado! Revise e Salve.", 'success', 4000); } } catch (err) { log("Erro importar:", err); UI.createNotification(err.message || "Erro ao ler JSON.", 'error'); } finally { event.target.value = null; } }; reader.readAsText(file, 'UTF-8'); }; panel.querySelector('#custom-action-example-btn').onclick = () => { exampleCustomFunction(); }; panel.querySelector('#reset-colors-btn').onclick = () => { if (confirm("Resetar as cores para o padrão Cyberpunk?")) { CONFIG.customThemeColors = { ...DEFAULT_CYBERPUNK_COLORS }; panel.querySelectorAll('.color-picker-grid input[type="color"]').forEach(input => { const key = input.dataset.colorKey; if (key && CONFIG.customThemeColors[key]) { input.value = CONFIG.customThemeColors[key]; } }); applyThemeColors(CONFIG.customThemeColors); UI.createNotification("Cores resetadas.", "info"); } }; panel.querySelector('#qr-save-settings-btn').onclick = () => { const newReplies = []; let hasError = false; const titles = new Set(); panel.querySelectorAll('#settings-quick-replies-list .reply-item').forEach(item => { const titleInput = item.querySelector('.reply-title'); const textInput = item.querySelector('.reply-text'); const hotkeyInput = item.querySelector('.reply-hotkey'); const title = titleInput.value.trim(); const text = textInput.value.trim(); const hotkey = hotkeyInput.value.trim() || null; const isFav = item.querySelector('.favorite-toggle').checked; const idx = parseInt(item.dataset.originalIndex, 10); titleInput.classList.remove('invalid-input'); titleInput.title = ''; textInput.classList.remove('invalid-input'); textInput.title = ''; let reqData = []; if (!isNaN(idx) && idx >= 0 && CONFIG.QUICK_REPLIES[idx]) { reqData = CONFIG.QUICK_REPLIES[idx].requiredData || []; } let titleError = ''; if (!title || !title.includes(' - ')) { titleError = 'Formato: CATEGORIA - Título'; } else if (titles.has(title.toLowerCase())) { titleError = 'Título duplicado.'; } if (titleError) { titleInput.classList.add('invalid-input'); titleInput.title = titleError; hasError = true; } else { titles.add(title.toLowerCase()); } if (!text) { textInput.classList.add('invalid-input'); textInput.title = 'Texto vazio.'; hasError = true; } if (!hasError) { newReplies.push({ title, text, isFavorite: isFav, requiredData: reqData, hotkey: hotkey }); } }); if (hasError) { UI.createNotification("Corrija os campos inválidos nas respostas.", 'error'); return; } CONFIG.QUICK_REPLIES = newReplies; panel.querySelectorAll('.color-picker-grid input[type="color"]').forEach(input => { const key = input.dataset.colorKey; if (key && CONFIG.customThemeColors.hasOwnProperty(key)) { CONFIG.customThemeColors[key] = input.value; } }); CONFIG.DARK_MODE = panel.querySelector('#dark-mode-toggle').checked; saveData(); UI.createNotification("Salvo!", "success"); panel.remove(); }; renderRepliesSettings();
                },
                createTriggerButton() { /* ... (igual v2.4.3 - usa ID #qr-trigger-button, já prefixado) ... */ let btn = document.getElementById('qr-trigger-button'); if (btn) return; btn = document.createElement('button'); btn.id = 'qr-trigger-button'; btn.innerHTML = ICONS.CHAT; btn.title = 'Abrir Respostas (Ctrl+Shift+Ç)'; document.body.appendChild(btn); let dragging = false, startX, startY, initialL, initialT; const saved = localStorage.getItem('qrTriggerButtonPos'); if (saved) { try { const pos = JSON.parse(saved); const w = 48, h = 48; const savedL = parseFloat(pos.left), savedT = parseFloat(pos.top); if (savedL >= 0 && savedL <= innerWidth - w && savedT >= 0 && savedT <= innerHeight - h) { btn.style.left = pos.left; btn.style.top = pos.top; btn.style.right = 'auto'; btn.style.bottom = 'auto'; } else { throw new Error("Fora dos limites."); } } catch (e) { log("Posição salva inválida (botão).", e); btn.style.right = '20px'; btn.style.bottom = '20px'; btn.style.left = 'auto'; btn.style.top = 'auto'; localStorage.removeItem('qrTriggerButtonPos'); } } else { btn.style.right = '20px'; btn.style.bottom = '20px'; btn.style.left = 'auto'; btn.style.top = 'auto'; } btn.onmousedown = (e) => { if (e.button !== 0) return; dragging = false; startX = e.clientX; startY = e.clientY; const rect = btn.getBoundingClientRect(); initialL = rect.left; initialT = rect.top; btn.style.cursor = 'grabbing'; e.preventDefault(); const threshold = 5; let moved = false; document.onmousemove = (me) => { const dX = me.clientX - startX; const dY = me.clientY - startY; if (!moved && (Math.abs(dX) > threshold || Math.abs(dY) > threshold)) { moved = true; dragging = true; } if (moved) { let nX = initialL + dX; let nY = initialT + dY; const bW = btn.offsetWidth, bH = btn.offsetHeight; nX = Math.max(5, Math.min(nX, innerWidth - bW - 5)); nY = Math.max(5, Math.min(nY, innerHeight - bH - 5)); btn.style.left = `${nX}px`; btn.style.top = `${nY}px`; btn.style.right = 'auto'; btn.style.bottom = 'auto'; } }; document.onmouseup = () => { btn.style.cursor = 'pointer'; if (moved) { localStorage.setItem('qrTriggerButtonPos', JSON.stringify({ left: btn.style.left, top: btn.style.top })); } document.onmousemove = null; document.onmouseup = null; setTimeout(() => { dragging = false; }, 0); }; }; btn.onclick = () => { if (!dragging) { UI.createQuickReplyPopup(); } }; }
            };

            // --- Injeção de CSS ---
            // *** MODIFICADO v2.4.4 (Conflict Fix) ***
            const injectCss = () => {
                // Tenta carregar a fonte Inter via @resource
                let fontCss = '';
                try {
                    if (typeof GM_getResourceText === 'function') {
                        fontCss = GM_getResourceText("INTER_FONT") || '';
                    }
                } catch (e) {
                    log("Erro ao carregar @resource da fonte. Usando fallback.", e);
                    fontCss = "@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;700&display=swap');"; // Fallback para @import
                }

                const C = DEFAULT_CYBERPUNK_COLORS; // Usa o padrão apenas definir a estrutura inicial
                // PREFIXADO todos os seletores de alto nível:
                const css = `
            ${fontCss} /* Injeta a fonte Inter */

             .qr-script-popup {
                 --font-main: 'Inter', system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, 'Open Sans', 'Helvetica Neue', sans-serif;
                 --raio-borda: 6px;
                 --transicao-padrao: all 0.15s ease-in-out;
                 
                 --cor-acento-primario: #0ea5e9;
                 --cor-acento-hover: #0284c7;
                 --cor-acento-texto: #ffffff;
                 --cor-fundo-primario: #ffffff;
                 --cor-fundo-secundario: #f8fafc;
                 --cor-fundo-terciario: #f1f5f9;
                 --cor-fundo-hover: #f1f5f9;
                 --cor-borda: #e2e8f0;
                 --cor-texto-primario: #1e293b;
                 --cor-texto-secundario: #64748b;
                 --cor-texto-desabilitado: #94a3b8;
                 --cor-perigo: #ef4444;
                 --cor-perigo-hover: #dc2626;
                 --cor-sucesso: #10b981;
                 --cor-info: #3b82f6;
                 --sombra-popup: 0 10px 30px rgba(0,0,0,0.12);
                 --glow-effect: none; --glow-effect-hover: none; --glow-effect-border: none;
             }
             .qr-script-popup.cc-escurinho {
                 --cor-acento-primario: #38bdf8; --cor-acento-hover: #0ea5e9;
                 --cor-fundo-primario: #0f172a; --cor-fundo-secundario: #1e293b; --cor-fundo-terciario: #334155; --cor-fundo-hover: #1e293b; --cor-borda: #334155; --cor-texto-primario: #f8fafc; --cor-texto-secundario: #94a3b8; --cor-texto-desabilitado: #64748b;
             }
             .qr-script-popup.local-light-mode {
                 --cor-acento-primario: #0ea5e9; --cor-acento-hover: #0284c7;
                 --cor-fundo-primario: #ffffff; --cor-fundo-secundario: #f8fafc; --cor-fundo-terciario: #f1f5f9; --cor-fundo-hover: #f1f5f9; --cor-borda: #e2e8f0; --cor-texto-primario: #1e293b; --cor-texto-secundario: #64748b; --cor-texto-desabilitado: #94a3b8;
             }
             body.rr-escurinho { /* Será preenchido por JS */ }

             /* Ícones */
             .qr-script-popup .panel-svg-icon { width: 1em; height: 1em; fill: currentColor; vertical-align: -0.15em; display: inline-block; } 
             .qr-script-button .panel-svg-icon { margin-right: 5px; } 
             .qr-script-popup .panel-header-btn .panel-svg-icon { width: 16px; height: 16px; fill: var(--cor-texto-secundario); transition: var(--transicao-padrao); } 
             .qr-script-popup .panel-header-btn:hover .panel-svg-icon { fill: var(--cor-acento-primario); filter: drop-shadow(0 0 2px var(--cor-acento-primario)); } 
             .qr-script-popup .panel-header-btn.qr-script-popup-close-btn:hover .panel-svg-icon { fill: var(--cor-perigo); filter: drop-shadow(0 0 2px var(--cor-perigo)); transform: rotate(90deg) scale(1.1); } 
             .qr-script-popup .remove-reply-btn .panel-svg-icon { width: 16px; height: 16px; fill: var(--cor-texto-desabilitado); transition: var(--transicao-padrao); } 
             .qr-script-popup .remove-reply-btn:hover .panel-svg-icon { fill: var(--cor-perigo); filter: drop-shadow(0 0 2px var(--cor-perigo)); transform: scale(1.1); }

             /* Geral & Popups */
             .qr-script-popup { font-family: var(--font-main); background: var(--cor-fundo-primario); color: var(--cor-texto-primario); border-radius: var(--raio-borda); box-shadow: var(--sombra-popup), inset 0 0 0 1px var(--cor-borda); z-index: 10002; display: flex; flex-direction: column; border: none; min-width: 300px; min-height: 200px; resize: both; overflow: hidden; font-size: 13.5px; transition: background-color 0.2s, color 0.2s, border-color 0.2s; position: fixed; }
             .qr-script-popup .panel-header { cursor: move; background: var(--cor-fundo-secundario); padding: 8px 12px; border-bottom: 1px solid var(--cor-borda); box-shadow: none; display: flex; justify-content: space-between; align-items: center; border-radius: var(--raio-borda) var(--raio-borda) 0 0; height: 42px; box-sizing: border-box; flex-shrink: 0; }
             .qr-script-popup .panel-header h2, .qr-script-popup .panel-header h3, .qr-script-popup .panel-header h4 { margin: 0 auto 0 0; padding-left: 5px; color: var(--cor-texto-primario); font-size: 1em; font-weight: 600; text-shadow: none; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; letter-spacing: 0.2px; }
             .qr-script-popup .panel-header-buttons { display: flex; gap: 4px; } .qr-script-popup .panel-header-btn { background: transparent; border: 1px solid transparent; cursor: pointer; color: var(--cor-texto-secundario); padding: 3px; border-radius: var(--raio-borda); display: flex; align-items: center; justify-content: center; transition: var(--transicao-padrao); } .qr-script-popup .panel-header-btn:hover { background-color: var(--cor-fundo-terciario); border-color: var(--cor-borda); color: var(--cor-texto-primario); }
             .qr-script-popup .panel-header-btn .panel-svg-icon { fill: currentColor !important; }

             .qr-script-popup .panel-content-wrapper { flex-grow: 1; display: flex; flex-direction: column; overflow: hidden; }
             .qr-script-popup .panel-content { padding: 8px; overflow-y: auto; flex-grow: 1; background: var(--cor-fundo-primario); }
             .qr-script-popup .panel-footer { padding: 6px 10px; background: var(--cor-fundo-secundario); border-top: 1px solid var(--cor-borda); text-align: right; border-radius: 0 0 var(--raio-borda) var(--raio-borda); flex-shrink: 0; }

             /* Botões */
             .qr-script-button { background-color: var(--cor-fundo-terciario); color: var(--cor-texto-secundario); border: 1px solid var(--cor-borda); padding: 6px 10px; border-radius: var(--raio-borda); cursor: pointer; font-size: 0.85em; font-weight: 500; transition: var(--transicao-padrao); margin-left: 6px; line-height: 1.2; display: inline-flex; align-items: center; justify-content: center; font-family: var(--font-main); text-transform: none; letter-spacing: 0; }
             .qr-script-button:hover { background-color: var(--cor-acento-primario); color: var(--cor-acento-texto); border-color: var(--cor-acento-primario); box-shadow: var(--glow-effect); /* Glow sutil */ transform: translateY(-1px); }
             .qr-script-button.qr-button-danger { color: var(--cor-perigo); border-color: var(--cor-perigo); background-color: transparent; }
             .qr-script-button.qr-button-danger:hover { background-color: var(--cor-perigo); color: #fff; box-shadow: 0 0 4px var(--cor-perigo), 0 0 6px var(--cor-perigo); } /* Glow perigo sutil */
             #qr-save-settings-btn { background-color: var(--cor-acento-primario); color: var(--cor-acento-texto); border-color: var(--cor-acento-primario); box-shadow: var(--glow-effect); }
             #qr-save-settings-btn:hover { background-color: var(--cor-acento-hover); border-color: var(--cor-acento-hover); box-shadow: var(--glow-effect-hover); transform: scale(1.02) translateY(-1px); }
             .qr-script-button.qr-button-secondary { color: var(--cor-texto-secundario); border-color: var(--cor-borda); background-color: transparent; }
             .qr-script-button.qr-button-secondary:hover { background-color: var(--cor-fundo-hover); color: var(--cor-texto-primario); border-color: var(--cor-texto-secundario); box-shadow: none; }

             /* Notificações */
             #qr-script-notification-container { position: fixed; top: 15px; right: 15px; display: flex; flex-direction: column; gap: 8px; z-index: 10003; max-width: 280px; }
             .qr-script-notification { font-family: var(--font-main); box-shadow: var(--sombra-popup); padding: 9px 14px; border-radius: var(--raio-borda); font-size: 0.85em; font-weight: 500; color: #000; border: 1px solid transparent; transition: opacity 0.3s ease-out, transform 0.3s ease-out; backdrop-filter: blur(2px); opacity: 0.95; }
             .qr-script-notification-info { background-color: var(--cor-info)cc; border-color: var(--cor-info); text-shadow: 0 0 2px #fff;}
             .qr-script-notification-success { background-color: var(--cor-sucesso)cc; border-color: var(--cor-sucesso); text-shadow: 0 0 2px #fff;}
             .qr-script-notification-error { background-color: var(--cor-perigo)cc; border-color: var(--cor-perigo); color: #fff; text-shadow: 0 0 2px #000;}

             /* Popup Principal Layout */
             .qr-script-popup .qr-popup-body { display: flex; flex-grow: 1; overflow: hidden; height: calc(100% - 38px); }
             .qr-script-popup #qr-sidebar { width: 160px; flex-shrink: 0; background: var(--cor-fundo-secundario); border-right: 1px solid var(--cor-borda); overflow-y: auto; padding: 0; }
             .qr-script-popup #qr-category-list { list-style: none; padding: 5px 0; margin: 0; }
             .qr-script-popup .qr-category-item { padding: 8px 10px; cursor: pointer; font-size: 0.85em; font-weight: 500; color: var(--cor-texto-secundario); border: none; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; transition: var(--transicao-padrao); border-left: 2px solid transparent; }
             .qr-script-popup .qr-category-item:hover { background-color: var(--cor-fundo-hover); color: var(--cor-acento-hover); border-left-color: var(--cor-acento-hover)55; }
             .qr-script-popup .qr-category-item.active { background-color: var(--cor-fundo-hover); color: var(--cor-acento-primario); font-weight: 500; border-left: 2px solid var(--cor-acento-primario); box-shadow: inset 2px 0 3px -2px var(--cor-acento-primario)55; }

             .qr-script-popup #qr-main-content { flex-grow: 1; display: flex; flex-direction: column; padding: 8px 12px; overflow: hidden; background-color: var(--cor-fundo-primario); }
             .qr-script-popup #purecloud-script-quick-reply-search { width: 100%; padding: 7px 5px; border: none; border-bottom: 1px solid var(--cor-borda); border-radius: 0; margin-bottom: 8px; box-sizing: border-box; font-size: 0.95em; flex-shrink: 0; background-color: transparent; color: var(--cor-texto-primario); transition: var(--transicao-padrao); font-family: var(--font-main); }
             .qr-script-popup #purecloud-script-quick-reply-search::placeholder { color: var(--cor-texto-secundario); opacity: 0.6; }
             .qr-script-popup #purecloud-script-quick-reply-search:focus { border-color: var(--cor-acento-primario); box-shadow: 0 2px 4px -2px var(--cor-acento-primario)66; outline: none; background-color: var(--cor-fundo-secundario); }

             /* Sugestões */
             .qr-script-popup .suggestion-filters-container { display: flex; flex-wrap: wrap; gap: 5px; margin-bottom: 8px; flex-shrink: 0; padding-bottom: 8px; border-bottom: 1px solid var(--cor-borda); }
             .qr-script-popup .suggestion-btn { background: transparent; border: 1px solid var(--cor-borda); color: var(--cor-texto-secundario); padding: 3px 7px; font-size: 0.75em; font-weight: 500; border-radius: var(--raio-borda); cursor: pointer; transition: var(--transicao-padrao); opacity: 0.8; }
             .qr-script-popup .suggestion-btn:hover { border-color: var(--cor-acento-primario); color: var(--cor-acento-primario); opacity: 1; box-shadow: var(--glow-effect-border); }

             /* Lista de Respostas */
             .qr-script-popup .items-container { flex-grow: 1; overflow-y: auto; padding-right: 4px; }
             .qr-script-popup .items-container .item { padding: 8px 10px; margin-bottom: 4px; background-color: transparent; border-radius: var(--raio-borda); cursor: pointer; border: 1px solid transparent; border-bottom: 1px solid var(--cor-borda); transition: var(--transicao-padrao); opacity: 0.95; }
             .qr-script-popup .items-container .item:hover { background-color: var(--cor-fundo-hover); border-color: var(--cor-fundo-hover); opacity: 1; transform: translateX(1px); box-shadow: inset 0 0 4px var(--cor-acento-primario)11; }
             .qr-script-popup .items-container .item strong { color: var(--cor-texto-primario); display: inline; font-size: 0.9em; font-weight: 500; } .qr-script-popup .items-container .item .favorite-star { display: inline-block; margin-left: 4px; filter: grayscale(1); opacity: 0.4; font-size: 0.9em; } .qr-script-popup .items-container .item strong .favorite-star { filter: none; opacity: 1; }
             .qr-script-popup .reply-hotkey-display { font-size: 0.8em; color: var(--cor-texto-secundario); background: var(--cor-fundo-terciario); padding: 0px 4px; border-radius: var(--raio-borda); border: 1px solid var(--cor-borda); margin-left: 5px; }
             .qr-script-popup .items-container .item small { color: var(--cor-texto-secundario); font-size: 0.8em; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; margin-top: 3px; line-height: 1.4; }
             .qr-script-popup .qr-results-header { margin: 0 0 6px 0; padding-bottom: 3px; border-bottom: 1px solid var(--cor-borda); color: var(--cor-texto-desabilitado); font-size: 0.7em; font-weight: 500; text-transform: uppercase; letter-spacing: 0.5px; }
             .qr-script-popup .qr-no-results { padding: 15px; color: var(--cor-texto-secundario); text-align: center; font-style: italic; opacity: 0.7; } .qr-script-popup .qr-no-results .panel-svg-icon { width: 1.1em; height: 1.1em; fill: var(--cor-texto-secundario); vertical-align: -0.2em; }
             .qr-script-popup .reply-header { display: flex; justify-content: space-between; align-items: flex-start; gap: 4px; flex-wrap: wrap; margin-bottom: 3px; } .qr-script-popup .data-tags { display: flex; gap: 3px; flex-wrap: wrap; margin-left: auto; padding-left: 4px;} .qr-script-popup .data-tag { font-size: 0.6em; padding: 1px 3px; border-radius: var(--raio-borda); font-weight: 500; color: #fff; text-transform: uppercase; white-space: nowrap; border: none; opacity: 0.8;} .qr-script-popup .tag-NOME, .qr-script-popup .tag-NOME_DO_CLIENTE, .qr-script-popup .tag-NOME_COMPLETO { /*bg-removido*/;} .qr-script-popup .tag-CPF { /*bg-removido*/;} .qr-script-popup .tag-ENDERECO { /*bg-removido*/; } .qr-script-popup .tag-PROTOCOLO, .qr-script-popup .tag-NUMERO { background-color: var(--cor-sucesso); color: #000;} .qr-script-popup .tag-DATA_NASC { /*bg-removido*/;} .qr-script-popup .tag-QUANTIDADE_HORAS, .qr-script-popup .tag-HORAS { /*bg-removido*/;} .qr-script-popup .tag-QUANTIDADE_DE_CLIENTES { /*bg-removido*/; color: #000;} .qr-script-popup .tag-CIDADE { background-color: var(--cor-info); color: #000;} .qr-script-popup .tag-DIA_E_MÊS, .qr-script-popup .tag-DIA_MES { /*bg-removido*/;} .qr-script-popup .tag-MANHÃ_OU_TARDE, .qr-script-popup .tag-MANHA_OU_TARDE { /*bg-removido*/; color: #000;} .qr-script-popup .tag-EMAIL { /*bg-removido*/;} .qr-script-popup .tag-NÚMERO_DE_CONTATO, .qr-script-popup .tag-NUMERO_DE_CONTATO { /*bg-removido*/; color:#000;} .qr-script-popup .tag-OPERADORA { /*bg-removido*/; } .qr-script-popup .tag-APARELHO_ESPECÍFICO { /*bg-removido*/; } .qr-script-popup .tag-SETOR { /*bg-removido*/; color: #000; } .qr-script-popup .data-tag { /*bg-removido*/; }
             .qr-script-popup .quick-reply-item.requires-tags-highlight { border: 1px solid var(--cor-acento-primario)44; background-color: var(--cor-fundo-terciario); }

             /* Painel Config */
             .qr-script-settings-panel { width: 90%; max-width: 800px; height: 85vh; max-height: 800px; min-width: 500px; min-height: 450px;}
             /* Abas */
             .qr-script-popup .settings-tabs { display: flex; border-bottom: 1px solid var(--cor-borda); margin: -8px -10px 10px -10px; padding: 0 10px; flex-shrink: 0; background-color: var(--cor-fundo-secundario); }
             .qr-script-popup .tab-button { background: none; border: none; border-bottom: 2px solid transparent; padding: 8px 12px; cursor: pointer; color: var(--cor-texto-secundario); font-family: var(--font-main); font-size: 0.9em; font-weight: 500; transition: var(--transicao-padrao); margin-bottom: -1px; text-transform: none; letter-spacing: 0; }
             .qr-script-popup .tab-button:hover { color: var(--cor-texto-primario); border-bottom-color: var(--cor-borda); }
             .qr-script-popup .tab-button.active { color: var(--cor-acento-primario); border-bottom-color: var(--cor-acento-primario); text-shadow: 0 0 3px var(--cor-acento-primario)55; }
             .qr-script-popup .settings-tab-content { display: none; flex-grow: 1; flex-direction: column; overflow: hidden; }
             .qr-script-popup .settings-tab-content.active { display: flex; }
             .qr-script-popup #tab-content-replies, .qr-script-popup #tab-content-appearance, .qr-script-popup #tab-content-actions { overflow-y: auto; height: 100%; padding: 5px; }
             .qr-script-popup #settings-quick-replies-list { flex-grow: 1; overflow-y: auto; padding-right: 5px; margin-top: 10px; border-top: 1px solid var(--cor-borda); padding-top: 10px; }
             /* Edição de Respostas */
             .qr-script-popup .reply-item { display: grid; grid-template-columns: auto 1fr 110px auto; gap: 5px 8px; align-items: center; border-bottom: 1px solid var(--cor-borda); padding: 8px 2px 12px 2px; transition: var(--transicao-padrao); } 
             .qr-script-popup .reply-item:hover { background-color: var(--cor-fundo-secundario); } 
             .qr-script-popup .reply-item .reply-title, .qr-script-popup .reply-item .reply-text, .qr-script-popup .reply-item .reply-hotkey { background-color: var(--cor-fundo-secundario); color: var(--cor-texto-primario); border: 1px solid var(--cor-borda); border-radius: var(--raio-borda); padding: 6px; font-family: var(--font-main); width: 100%; box-sizing: border-box; transition: var(--transicao-padrao); } 
             .qr-script-popup .reply-item .reply-title { grid-column: 2 / 3; grid-row: 1 / 2; font-size: 0.9em; font-weight: 500; } 
             .qr-script-popup .reply-item .reply-hotkey { grid-column: 3 / 4; grid-row: 1 / 2; font-size: 0.8em; }
             .qr-script-popup .reply-item .data-tags { grid-column: 2 / 5; grid-row: 2 / 3; margin-top: 2px; min-height: 1em; } 
             .qr-script-popup .reply-item .reply-text { grid-column: 1 / 5; grid-row: 3 / 4; margin-top: 3px; font-size: 0.85em; line-height: 1.4; resize: vertical; min-height: 45px; } 
             .qr-script-popup .reply-item .reply-title:focus, .qr-script-popup .reply-item .reply-text:focus, .qr-script-popup .reply-item .reply-hotkey:focus { border-color: var(--cor-acento-primario); box-shadow: 0 0 0 1px var(--cor-acento-primario)33, inset 0 0 3px var(--cor-acento-primario)22; outline: none; background-color: var(--cor-fundo-primario); } 
             .qr-script-popup .reply-item .remove-reply-btn { background: none; border: none; cursor: pointer; padding: 0; grid-column: 4 / 5; grid-row: 1 / 2; justify-self: end; line-height: 1; transition: var(--transicao-padrao); } 
             .qr-script-popup .reply-item .favorite-toggle { grid-column: 1 / 2; grid-row: 1 / 2; margin-right: 4px; transform: scale(1.1); cursor: pointer;} 
             .qr-script-popup .reply-controls { margin-bottom: 10px; display: flex; gap: 6px; flex-wrap: wrap; align-items: center; } 
             .qr-script-popup input.invalid-input, .qr-script-popup textarea.invalid-input { border-color: var(--cor-perigo) !important; box-shadow: 0 0 0 1px var(--cor-perigo)33, inset 0 0 3px var(--cor-perigo)22 !important; }
             
             /* Seção de Cores */ .qr-script-popup .custom-colors-section { padding-top: 10px; } .qr-script-popup .custom-colors-section h4 { margin: 0 0 8px 0; color: var(--cor-texto-secundario); font-size: 0.85em; font-weight: 500; text-transform: uppercase; letter-spacing: 0.5px; } .qr-script-popup .color-picker-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(180px, 1fr)); gap: 8px 12px; margin-bottom: 8px; } .qr-script-popup .color-picker-item { display: flex; align-items: center; gap: 6px; } .qr-script-popup .color-picker-item label { font-size: 0.75em; color: var(--cor-texto-secundario); text-transform: capitalize; } .qr-script-popup .color-picker-item input[type="color"] { width: 26px; height: 26px; border: 1px solid var(--cor-borda); border-radius: var(--raio-borda); padding: 2px; cursor: pointer; background-color: var(--cor-fundo-terciario); -webkit-appearance: none; -moz-appearance: none; appearance: none; } .qr-script-popup .color-picker-item input[type="color"]::-webkit-color-swatch-wrapper { padding: 0; } .qr-script-popup .color-picker-item input[type="color"]::-webkit-color-swatch { border: none; border-radius: calc(var(--raio-borda) - 1px); } .qr-script-popup .color-picker-item input[type="color"]::-moz-color-swatch { border: none; border-radius: calc(var(--raio-borda) - 1px); }
             /* Seção de Funções */ .qr-script-popup .custom-actions-section { padding-top: 10px; } .qr-script-popup .custom-actions-section h4 { margin: 0 0 8px 0; color: var(--cor-texto-secundario); font-size: 0.85em; font-weight: 500; text-transform: uppercase; letter-spacing: 0.5px; } .qr-script-popup .custom-actions-buttons { display: flex; gap: 8px; flex-wrap: wrap; }
             /* Botão Flutuante */
             #qr-trigger-button { position: fixed; width: 48px; height: 48px; border-radius: 50%; background-color: var(--cor-acento-primario); color: var(--cor-acento-texto); border: none; font-size: 22px; cursor: pointer; box-shadow: 0 0 8px var(--cor-acento-primario), 0 0 12px var(--cor-acento-primario), inset 0 0 3px rgba(255, 255, 255, 0.3); z-index: 9999; display: flex; align-items: center; justify-content: center; transition: var(--transicao-padrao), transform 0.1s ease, box-shadow 0.2s ease; user-select: none; }
             #qr-trigger-button .panel-svg-icon { width: 24px; height: 24px; fill: var(--cor-acento-texto); filter: drop-shadow(0 0 1px var(--cor-acento-texto)); }
             #qr-trigger-button:hover { background-color: var(--cor-acento-hover); transform: scale(1.08); box-shadow: 0 0 12px var(--cor-acento-hover), 0 0 18px var(--cor-acento-hover), inset 0 0 5px rgba(255, 255, 255, 0.4); }
             #qr-trigger-button:active { cursor: grabbing; transform: scale(1.03); }

             .qr-script-popup .settings-group-inline { display: flex; align-items: center; gap: 8px; margin-left: auto; } .qr-script-popup .settings-group-inline.appearance-toggle { margin-left: 0; margin-bottom: 10px; border-bottom: 1px solid var(--cor-borda); padding-bottom: 10px;} .qr-script-popup .settings-group-inline label { margin-bottom: 0; font-size: 0.8em; color: var(--cor-texto-primario); font-weight: 500; letter-spacing: 0.2px; } .qr-script-popup .switch { position: relative; display: inline-block; width: 36px; height: 18px; } .qr-script-popup .switch input { opacity: 0; width: 0; height: 0; } .qr-script-popup .slider { position: absolute; cursor: pointer; top: 0; left: 0; right: 0; bottom: 0; background-color: var(--cor-fundo-terciario); border: 1px solid var(--cor-borda); transition: .4s; } .qr-script-popup .slider:before { position: absolute; content: ""; height: 12px; width: 12px; left: 2px; bottom: 2px; background-color: white; transition: .4s; box-shadow: 0 1px 2px rgba(0,0,0,0.2); } body.rr-escurinho .qr-script-popup .slider:before { background-color: var(--cor-texto-desabilitado); } .qr-script-popup input:checked + .slider { background-color: var(--cor-acento-primario); border-color: var(--cor-acento-primario); box-shadow: 0 0 3px var(--cor-acento-primario)88; } body.rr-escurinho .qr-script-popup input:checked + .slider:before { /*bg-removido*/; } .qr-script-popup input:focus + .slider { box-shadow: 0 0 1px var(--cor-acento-primario); } .qr-script-popup input:checked + .slider:before { transform: translateX(18px); } .qr-script-popup .slider.round { border-radius: 18px; } .qr-script-popup .slider.round:before { border-radius: 50%; }
             .qr-script-popup ::-webkit-scrollbar { width: 6px; height: 6px; } .qr-script-popup ::-webkit-scrollbar-track { background: var(--cor-fundo-secundario); } .qr-script-popup ::-webkit-scrollbar-thumb { background: var(--cor-borda); border-radius: 3px; border: 1px solid var(--cor-fundo-secundario); } .qr-script-popup ::-webkit-scrollbar-thumb:hover { background: var(--cor-texto-desabilitado); }
        `;
                if (typeof GM_addStyle !== "undefined") { GM_addStyle(css); } else { let style = document.getElementById('qr-script-injected-style'); if (!style) { style = document.createElement('style'); style.id = 'qr-script-injected-style'; document.head.appendChild(style); } style.textContent = css; }
            };

            // --- Inicialização (MODIFICADA V2.4.9) ---
            const initialize = async () => { // <-- TORNAR ASYNC
                try {
                    log(`Initializing QR Script V${SCRIPT_VERSION}`);
                    await loadData(); // <-- ADICIONADO AWAIT
                    injectCss();
                    applyThemeColors(CONFIG.DARK_MODE ? CONFIG.customThemeColors : LIGHT_THEME_COLORS);
                    document.body.classList.toggle('rr-escurinho', CONFIG.DARK_MODE);
                    log("Data loaded & Theme applied. Dark Mode:", CONFIG.DARK_MODE);
                } catch (error) { log("ERROR loading data:", error); try { UI.createNotification("Error loading script data.", "error", 5000); } catch (e) { } return; }
                try { UI.createTriggerButton(); log("Trigger button created."); } catch (error) { log("ERROR creating trigger button:", error); UI.createNotification("Error creating script button.", "error", 5000); }
                try { document.removeEventListener('keydown', keyboardEventHandler); document.addEventListener('keydown', keyboardEventHandler); log("Keyboard listener registered."); } catch (error) { log("ERROR registering keyboard listener:", error); }
                log("Script ready.");
            };

            // --- Ponto de Entrada (MODIFICADO V2.4.9) ---
            const tryInitialize = async () => { // <-- TORNAR ASYNC
                if (findEl('body')) {
                    log("Body found. Initializing.");
                    await initialize(); // <-- ADICIONADO AWAIT
                } else {
                    log("Waiting for body...");
                    setTimeout(tryInitialize, 1500);
                }
            };
            if (window.self === window.top) {
                if (document.readyState === 'loading') { document.addEventListener('DOMContentLoaded', tryInitialize); } else { tryInitialize(); };
            }

        })(); // --- FIM DO ISOLAMENTO (V5) ---

    } catch (e) { console.error('[BUILDER] Erro fatal no módulo respostas.js:', e); }

    /* --- MÓDULO ANEXADO: PAUSAS.JS --- */
    try {
        // =================================================================
        // Parceiro de Programação: SCRIPT FINAL (V49.2 - MERGE)
        // Mudanças:
        // 1. MERGE (V49.1 + V48.4): Aplicadas todas as correções de
        //    "Pausa auricular" (V49.0) e do "Modal de Automação" (V49.1)
        //    na versão do usuário que contém o "Relógio no Cabeçalho" (V48.4).
        // 2. MANTIDO (V48.4): Relógio no cabeçalho do painel.
        // 3. MANTIDO (V49.1): Lógica de clique correta e correção do modal.
        // =================================================================

        (function () {

            // --- INÍCIO: KILL SWITCH (V48.2) ---
            // Remove à força qualquer UI antiga antes de construir a nova
            console.log("[GERENCIADOR V49.2] Forçando a remoção de UIs antigas...");
            try {
                const old_ui = document.getElementById('pausa-script-container');
                if (old_ui) old_ui.remove();
                const old_config = document.getElementById('pausa-script-config-container');
                if (old_config) old_config.remove();
                console.log("[GERENCIADOR V49.2] UIs antigas removidas com sucesso.");
            } catch (e) {
                console.warn("[GERENCIADOR V49.2] Erro ao limpar UI antiga:", e.message);
            }
            // --- FIM: KILL SWITCH ---


            // ----------------------------------------------------
            // CONSTANTES E CONFIGURAÇÕES
            // ----------------------------------------------------

            // ATUALIZADA V49.0
            const SELECTORES = {
                MENU_STATUS_TOGGLE: '#toggleUserDropdownTarget',
                DISPONIVEL: 'button.presence-available',
                REFEICAO: 'button.presence-meal',
                INTERVALO_MENU: 'button.presence-break',
                OCUPADO_MENU: 'button.presence-busy',
                LOGOFF: 'span.menu-label',
                NA_FILA_TOGGLE_HOST: 'gux-toggle#command-bar-queue-toggle',
                NA_FILA_DIRETO: 'gux-button.onQueueButton',
                VOLTAR_SUBMENU: 'button[title="Volte às presenças primárias"]',
                STATUS_LABEL_TEXT: 'span.presence-label-text',
                TREINAMENTO: 'button.presence-training',
                REUNIAO: 'button.presence-meeting',
            };

            // ATUALIZADA V48.8
            const PAUSAS_AGENDADAS_DEFAULT = [
                { hora: "17:40", status: "Na fila" }, { hora: "18:35", status: "Pausa out" },
                { hora: "18:40", status: "Pausa auricular" }, { hora: "18:50", status: "Na fila" },
                { hora: "19:45", status: "Pausa out" }, { hora: "19:50", status: "Refeição" },
                { hora: "20:10", status: "Na fila" }, { hora: "22:25", status: "Pausa out" },
                { hora: "22:30", status: "Pausa auricular" }, { hora: "22:40", status: "Na fila" },
                { hora: "00:00", status: "Logoff" }
            ];

            let estadoAtual = { tipo: 'Disponível', inicio: new Date(), ativa: false };
            let historicoPausas = [];
            let isAgendamentoAtivo = false;
            let schedulerInterval = null;
            let syncTimeout = null;
            let ultimoEventoProcessado = null;
            let isConfigPainelAberto = false;
            let dragElement = null;
            let offsetX = 0, offsetY = 0;
            let isDragging = false;
            let isAutomacaoPausada = false;
            let confirmModalTimeout = null;
            const STORAGE_KEY_HORARIOS = 'gerenciadorPausas_horarios';
            const STORAGE_KEY_POS_MAIN = 'gerenciadorPausas_posMain';
            const STORAGE_KEY_POS_CONFIG = 'gerenciadorPausas_posConfig';
            const STORAGE_KEY_NOTIF_CONFIG = 'gerenciadorPausas_notifConfig';

            const NOTIF_CONFIG_DEFAULT = { ativadas: true, somAtivado: false, antecedenciaSegundos: 15 };
            let configNotificacao = { ...NOTIF_CONFIG_DEFAULT };
            const SOM_NOTIFICACAO_URL = 'https://www.soundjay.com/button/sounds/beep-07a.mp3';
            let audioNotificacao = new Audio(SOM_NOTIFICACAO_URL);
            let audioDesbloqueado = false;

            // --- Funções de LocalStorage ---
            function salvarHorariosLocalStorage(h) { try { localStorage.setItem(STORAGE_KEY_HORARIOS, JSON.stringify(h)); console.log("[LS] Horários salvos.") } catch (e) { console.error("[LS] Erro save horários:", e) } }
            function carregarHorariosLocalStorage() { try { const h = localStorage.getItem(STORAGE_KEY_HORARIOS); if (h) { const p = JSON.parse(h); if (Array.isArray(p)) { if (p.every(i => typeof i.hora === 'string' && typeof i.status === 'string')) { console.log("[LS] Horários carregados."); return p } else { console.warn("[LS] Formato interno inválido."); localStorage.removeItem(STORAGE_KEY_HORARIOS) } } else { console.warn("[LS] Formato JSON inválido."); localStorage.removeItem(STORAGE_KEY_HORARIOS) } } } catch (e) { console.error("[LS] Erro load horários:", e); localStorage.removeItem(STORAGE_KEY_HORARIOS) } console.log("[LS] Nenhum horário salvo. Usando padrão."); return [...PAUSAS_AGENDADAS_DEFAULT] }
            function salvarPosicaoPainelLocalStorage(k, el) { if (!el) return; try { let p = {}; if (el.style.top && el.style.left) { p = { top: el.style.top, left: el.style.left } } else if (el.style.bottom && el.style.right) { p = { bottom: el.style.bottom, right: el.style.right } } else { const r = el.getBoundingClientRect(); p = { top: r.top + 'px', left: r.left + 'px' } } localStorage.setItem(k, JSON.stringify(p)) } catch (e) { console.error(`[LS] Erro save pos ${k}:`, e) } }
            function carregarPosicaoPainelLocalStorage(k) { try { const pS = localStorage.getItem(k); if (pS) { const p = JSON.parse(pS); if (p && (p.top || p.bottom)) return p } } catch (e) { console.error(`[LS] Erro load pos ${k}:`, e); localStorage.removeItem(k) } return null }
            function salvarConfiguracoesNotificacaoLocalStorage(c) { try { localStorage.setItem(STORAGE_KEY_NOTIF_CONFIG, JSON.stringify(c)); console.log("[LS] Config Notif salva.") } catch (e) { console.error("[LS] Erro save config notif:", e) } }
            function carregarConfiguracoesNotificacaoLocalStorage() { try { const cS = localStorage.getItem(STORAGE_KEY_NOTIF_CONFIG); if (cS) { const c = JSON.parse(cS); if (typeof c.ativadas === 'boolean' && typeof c.somAtivado === 'boolean' && typeof c.antecedenciaSegundos === 'number') { console.log("[LS] Config Notif carregada."); return { ...NOTIF_CONFIG_DEFAULT, ...c } } else { console.warn("[LS] Formato config notif inválido."); localStorage.removeItem(STORAGE_KEY_NOTIF_CONFIG) } } } catch (e) { console.error("[LS] Erro load config notif:", e); localStorage.removeItem(STORAGE_KEY_NOTIF_CONFIG) } console.log("[LS] Nenhuma config notif salva. Usando padrão."); return { ...NOTIF_CONFIG_DEFAULT } }

            let PAUSAS_AGENDADAS = carregarHorariosLocalStorage();
            configNotificacao = carregarConfiguracoesNotificacaoLocalStorage();

            // ----------------------------------------------------
            // FUNÇÕES DE UTILIDADE E INTERAÇÃO COM A PLATAFORMA
            // ----------------------------------------------------

            function tocarSomNotificacao() { if (!configNotificacao.somAtivado) return; if (!audioDesbloqueado) { console.warn("[Notif Som] Áudio não desbloqueado."); desbloquearAudio(true); return } audioNotificacao.currentTime = 0; audioNotificacao.play().catch(e => { console.error("[Notif Som] Erro:", e.message); audioDesbloqueado = !1; document.addEventListener('click', desbloquearAudio, { once: !0 }) }) }
            function desbloquearAudio(forcePlay = !1) { if (audioDesbloqueado && !forcePlay) return; let p = audioNotificacao.play(); if (p !== undefined) { p.then(() => { audioNotificacao.pause(); audioNotificacao.currentTime = 0; if (!audioDesbloqueado) { audioDesbloqueado = !0; console.log("[Audio] Contexto desbloqueado.") } }).catch(e => { }); } if (audioDesbloqueado) { document.removeEventListener('click', desbloquearAudio) } }
            async function mostrarNotificacao(evento) { if (!configNotificacao.ativadas) { console.log("[Notif] Desativadas."); return } if (!("Notification" in window)) { console.warn("[Notif] Navegador não suporta."); return } let p = Notification.permission; if (p === "granted") { tocarSomNotificacao(); new Notification("Gerenciador - Próxima Ação", { body: `${evento.status} às ${evento.hora}`, tag: `gdp-${evento.hora}-${evento.status}` }); console.log(`[Notif] Exibida: ${evento.status}`) } else if (p === "default") { console.log("[Notif] Pedindo permissão..."); try { p = await Notification.requestPermission(); if (p === "granted") { console.log("[Notif] Permissão OK!"); mostrarNotificacao(evento) } else { console.warn("[Notif] Permissão Negada."); localStorage.setItem('notif_negada', '1') } } catch (err) { console.error("[Notif] Erro ao pedir:", err) } } else { if (!localStorage.getItem('notif_negada')) { console.warn("[Notif] Permissão negada antes."); localStorage.setItem('notif_negada', '1') } } }

            // ATUALIZADA V49.0 (Revertida para V46.1)
            function clicarElemento(s, t = null) {
                let e = null;
                if (t) {
                    const l = document.querySelectorAll(s);
                    if (l.length === 0) {
                        console.warn(`[AÇÃO V49.2] Nenhum elemento encontrado com o seletor: ${s}`);
                    }
                    for (const o of l) {
                        if (o.textContent.trim().toLowerCase() === t.toLowerCase()) {
                            e = o;
                            // Lógica V46.1: Sobe até encontrar um <button>
                            while (e && e.parentElement && e.tagName !== 'BUTTON') {
                                e = e.parentElement;
                            }
                            if (e && e.tagName === 'BUTTON') break; // Encontramos
                            e = null; // Não é um botão, continua procurando
                        }
                    }
                } else {
                    e = document.querySelector(s);
                }

                if (e) {
                    console.log(`[AÇÃO V49.2] Clicando: ${s}` + (t ? ` (Texto: ${t})` : ''));
                    const c = new MouseEvent('click', { view: window, bubbles: true, cancelable: true });
                    e.dispatchEvent(c);
                    return true;
                }
                console.warn(`[AÇÃO V49.2] Não encontrado: ${s}` + (t ? ` (Texto: ${t})` : ''));
                return false;
            }

            function forcarCliquePorTexto(t) { const s = SELECTORES.STATUS_LABEL_TEXT; const e = document.querySelectorAll(s); for (const l of e) { if (l.textContent.trim() === t) { let o = l; while (o && o.parentElement && o.tagName !== 'BUTTON') { o = o.parentElement } if (o && o.tagName === 'BUTTON') { const c = new MouseEvent('click', { view: window, bubbles: !0, cancelable: !0 }); o.dispatchEvent(c); return !0 } } } return !1 }

            // ATUALIZADO V46.2
            function clicarVoltarSubmenu() { if (clicarElemento(SELECTORES.VOLTAR_SUBMENU)) { console.log("[AÇÃO] Clicado Voltar."); return !0 } console.warn("[AÇÃO] Voltar não encontrado."); return !1 }

            function formatarDuracao(s) { const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), c = Math.max(0, s % 60); const p = n => String(n).padStart(2, '0'); return `${p(h)}:${p(m)}:${p(c)}` }
            function converterDuracaoParaSegundos(d) { if (!d || typeof d !== 'string') return 0; const p = d.split(':'); if (p.length !== 3) return 0; const h = parseInt(p[0], 10) || 0, m = parseInt(p[1], 10) || 0, s = parseInt(p[2], 10) || 0; return (h * 3600) + (m * 60) + s }

            // ATUALIZADA V46.4
            function registrarPausa(n) {
                const a = new Date;
                console.log(`[PAUSA V46.4] Registrando: ${n}`);

                if (estadoAtual.ativa) {
                    const f = a;
                    const d = f.getTime() - estadoAtual.inicio.getTime();
                    if (d > 500) {
                        historicoPausas.push({
                            tipo: estadoAtual.tipo,
                            inicio: estadoAtual.inicio.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
                            fim: f.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
                            duracao: formatarDuracao(Math.round(d / 1000))
                        });
                        renderizarHistoricoLog();
                        renderizarEstatisticas();
                    } else {
                        console.log(`[PAUSA] Anterior (${estadoAtual.tipo}) muito curta. Descartada.`);
                    }
                }

                estadoAtual = {
                    tipo: n,
                    inicio: a,
                    ativa: (n !== 'Logoff')
                };

                atualizarUI();
            }

            function adicionarAtalho() { document.addEventListener('keydown', function (e) { const c = e.ctrlKey || e.metaKey, s = e.shiftKey, o = e.key === '1'; if (document.activeElement && ['INPUT', 'TEXTAREA'].includes(document.activeElement.tagName)) return; if (c && s && o) { e.preventDefault(); toggleVisibilidade() } }) }

            // --- Funções de Agendamento ---

            // ATUALIZADA V48.8
            function mapearEexecutarAcao(s) {
                console.log(`[AGENDAMENTO V49.2] Mapeando: ${s}`);
                const status = s.toLowerCase().trim();

                switch (status) {
                    case "na fila": iniciarNaFila(true); break;
                    case "disponível": voltarDisponivel(true); break;
                    case "pausa out": iniciarPausaOut(true); break;
                    case "pausa auricular": // NOVO NOME V48.8
                    case "pausa pessoal":   // NOME ANTIGO (Compatibilidade)
                    case "descanso":        // NOME ANTIGO (Compatibilidade)
                        iniciarDescanso(true); break;
                    case "refeição": iniciarRefeicao(true); break;
                    case "treinamento": iniciarTreinamento(true); break;
                    case "reunião": iniciarReuniao(true); break;
                    case "logoff": realizarLogoff(true); break;
                    case "atividade backoffice":
                    case "ativ. backoffice":
                    case "backoffice":
                        iniciarBackoffice(true); break;
                    case "feedback": iniciarFeedback(true); break;
                    case "particular": iniciarParticular(true); break;
                    case "questões de saúde":
                    case "questoes de saude":
                    case "saúde":
                    case "saude":
                        iniciarQuestoesSaude(true); break;
                    default:
                        console.warn(`[AGENDAMENTO V49.2] Status '${s}' não mapeado.`);
                }
            }

            // ATUALIZADA V48.0
            function verificarEExecutarAgendamentos() { if (!isAgendamentoAtivo || isAutomacaoPausada) { if (isAutomacaoPausada) console.log("[AGENDAMENTO CHECK V49.2] Pausado."); return } const a = new Date, h = `${String(a.getHours()).padStart(2, '0')}:${String(a.getMinutes()).padStart(2, '0')}`, s = a.getSeconds(); console.log(`[AGENDAMENTO CHECK V49.2] Verificando ${h}:${String(s).padStart(2, '0')}`); Object.keys(window).forEach(k => { if (k.startsWith('notif_')) { const e = k.split('_')[1]; if (e < h) { clearTimeout(window[k]); delete window[k]; } } }); const eA = PAUSAS_AGENDADAS.find(p => p.hora === h); if (eA && ultimoEventoProcessado !== h) { console.warn(`[AGENDAMENTO DISPARADO V49.2] EXECUTANDO: ${eA.status} às ${eA.hora}`); mapearEexecutarAcao(eA.status); ultimoEventoProcessado = h; if (eA.status.toLowerCase() === 'logoff') { setTimeout(() => { if (isAgendamentoAtivo) toggleAgendamento() }, 500) } return } if (!eA && ultimoEventoProcessado) { ultimoEventoProcessado = null; } if (s < 15) { const pM = new Date(a.getTime() + 6e4), hP = `${String(pM.getHours()).padStart(2, '0')}:${String(pM.getMinutes()).padStart(2, '0')}`; const eP = PAUSAS_AGENDADAS.find(p => p.hora === hP); if (eP) { const antecedencia = configNotificacao.antecedenciaSegundos; const sN = Math.max(0, (60 - antecedencia) - s), tId = `notif_${eP.hora}_${eP.status}`; if (sN > 0 && !window[tId]) { console.log(`[Notif V49.2] Agendando ${eP.status} às ${eP.hora} em ${sN} seg. (Antecedência: ${antecedencia}s)`); window[tId] = setTimeout(() => { mostrarNotificacao(eP); delete window[tId] }, sN * 1e3) } } } }
            function iniciarSchedulerSincronizado() { console.log("[Scheduler V49.2] Sincronizado!"); if (!isAgendamentoAtivo) { console.log("[Scheduler V49.2] Automação desligada pós-sinc."); return } verificarEExecutarAgendamentos(); schedulerInterval = setInterval(verificarEExecutarAgendamentos, 60000) }
            function sincronizarEIniciarScheduler() { if (schedulerInterval) clearInterval(schedulerInterval); if (syncTimeout) clearTimeout(syncTimeout); const sA = new Date().getSeconds(); const dMs = (60 - sA) * 1000; console.log(`[Scheduler V49.2] Aguardando ${dMs / 1000}s para sincronizar...`); syncTimeout = setTimeout(iniciarSchedulerSincronizado, dMs) }

            // ATUALIZADA V48.0
            function toggleAgendamento() {
                console.log("[AÇÃO V49.2] toggleAgendamento.");
                const b = document.getElementById('btn-toggle-agendamento'), p = document.getElementById('btn-pause-resume-agendamento');
                if (isAgendamentoAtivo) {
                    if (schedulerInterval) clearInterval(schedulerInterval); if (syncTimeout) clearTimeout(syncTimeout);
                    schedulerInterval = null; syncTimeout = null; isAgendamentoAtivo = !1; isAutomacaoPausada = !1;
                    console.warn("[AGENDAMENTO V49.2] OFF.");
                    if (b) { b.textContent = "Ligar Automação"; b.style.background = 'linear-gradient(135deg, #23a745, #2dc24f)'; }
                    if (p) p.style.display = 'none';
                } else {
                    PAUSAS_AGENDADAS = carregarHorariosLocalStorage();
                    console.log(`[AGENDAMENTO V49.2] ${PAUSAS_AGENDADAS.length} horários carregados.`);
                    ultimoEventoProcessado = null; isAutomacaoPausada = !1; isAgendamentoAtivo = !0;
                    console.info("[AGENDAMENTO V49.2] ON. Sincronizando...");
                    if (b) { b.textContent = "Desligar Automação"; b.style.background = 'linear-gradient(135deg, #dc3545, #e84a5f)'; }
                    if (p) {
                        p.textContent = "Pausar ⏸️";
                        p.style.background = 'linear-gradient(135deg, #ffc107, #ffd25a)';
                        p.style.color = '#000';
                        p.style.display = 'inline-block';
                    }
                    sincronizarEIniciarScheduler();
                }
            }
            // ATUALIZADA V48.0
            function togglePausaAutomacao() {
                if (!isAgendamentoAtivo) return;
                isAutomacaoPausada = !isAutomacaoPausada;
                const b = document.getElementById('btn-pause-resume-agendamento');
                if (isAutomacaoPausada) {
                    console.warn("[AGENDAMENTO] PAUSADO.");
                    if (b) {
                        b.textContent = "Retomar ▶️";
                        b.style.background = 'linear-gradient(135deg, #007FFF, #009cff)';
                        b.style.color = '#fff';
                    }
                } else {
                    console.info("[AGENDAMENTO] RETOMADO.");
                    if (b) {
                        b.textContent = "Pausar ⏸️";
                        b.style.background = 'linear-gradient(135deg, #ffc107, #ffd25a)';
                        b.style.color = '#000';
                    }
                    verificarEExecutarAgendamentos();
                }
            }

            // --- Funções de Edição ---
            function adicionarNovoHorario() { const iH = document.getElementById('novo-horario-hora'), iS = document.getElementById('novo-horario-status'); if (!iH || !iS) return; const h = iH.value, s = iS.value.trim(); if (!h) { alert("Insira hora."); iH.focus(); return } if (!s) { alert("Insira status."); iS.focus(); return } if (PAUSAS_AGENDADAS.some(p => p.hora === h)) { if (!confirm(`Já existe ${h}. Substituir?`)) return; PAUSAS_AGENDADAS = PAUSAS_AGENDADAS.filter(p => p.hora !== h) } PAUSAS_AGENDADAS.push({ hora: h, status: s }); PAUSAS_AGENDADAS.sort((a, b) => a.hora.localeCompare(b.hora)); salvarHorariosLocalStorage(PAUSAS_AGENDADAS); iH.value = ''; iS.value = ''; renderizarAgendamentos(); console.log(`Adicionado/Atualizado: ${h} - ${s}`); alert("Horário salvo! Desligue e Ligue a Automação para aplicar.") }
            function removerHorario(idx) { if (idx < 0 || idx >= PAUSAS_AGENDADAS.length) return; const item = PAUSAS_AGENDADAS[idx]; if (confirm(`Remover: ${item.hora} - ${item.status}?`)) { PAUSAS_AGENDADAS.splice(idx, 1); salvarHorariosLocalStorage(PAUSAS_AGENDADAS); renderizarAgendamentos(); console.log(`Removido: ${item.hora} - ${item.status}`); alert("Horário removido! Desligue e Ligue a Automação para aplicar.") } }
            function carregarHorarioParaEdicao(idx) { if (idx < 0 || idx >= PAUSAS_AGENDADAS.length) return; const item = PAUSAS_AGENDADAS[idx]; const iH = document.getElementById('novo-horario-hora'), iS = document.getElementById('novo-horario-status'); if (!iH || !iS) return; iH.value = item.hora; iS.value = item.status; console.log(`[Editor] Carregado: ${item.hora}`); iS.focus(); iS.select() }

            // --- Funções de Exportar/Importar ---
            function exportarConfiguracoes() { console.log("[Backup] Exportando..."); try { const c = { pausas: carregarHorariosLocalStorage(), notificacoes: carregarConfiguracoesNotificacaoLocalStorage(), posicoes: { main: carregarPosicaoPainelLocalStorage(STORAGE_KEY_POS_MAIN) || { bottom: '30px', right: '30px' }, config: carregarPosicaoPainelLocalStorage(STORAGE_KEY_POS_CONFIG) || { bottom: '30px', right: '340px' } } }; const d = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(c, null, 2)); const l = document.createElement('a'); l.setAttribute('href', d); l.setAttribute('download', 'config_gerenciador_pausas.json'); document.body.appendChild(l); l.click(); l.remove(); console.log("[Backup] Exportado.") } catch (e) { console.error("[Backup] Erro exportar:", e); alert("Erro ao exportar.") } }
            function importarConfiguracoes() { const i = document.getElementById('import-file-input'); if (i) i.click(); else console.error("[Backup] Input não encontrado.") }
            function handleArquivoImportado(event) { const a = event.target.files[0]; if (!a) { console.log("[Backup] Nenhum arquivo."); return } const r = new FileReader(); r.onload = function (e) { try { const c = JSON.parse(e.target.result); if (c && c.pausas && c.notificacoes && c.posicoes) { salvarHorariosLocalStorage(c.pausas); salvarConfiguracoesNotificacaoLocalStorage(c.notificacoes); salvarPosicaoPainelLocalStorage(STORAGE_KEY_POS_MAIN, c.posicoes.main); salvarPosicaoPainelLocalStorage(STORAGE_KEY_POS_CONFIG, c.posicoes.config); console.log("[Backup] Importado e salvo."); alert("Configurações importadas!\n\nRecarregue a página (F5) agora."); event.target.value = null } else { throw new Error("Arquivo inválido.") } } catch (err) { console.error("[Backup] Erro importar:", err.message); alert("Erro ao importar: arquivo inválido."); event.target.value = null } }; r.readAsText(a) }

            // ----------------------------------------------------
            // FUNÇÕES DE AÇÃO PRINCIPAIS
            // ----------------------------------------------------
            const DELAY_ABRIR_MENU = 700; const DELAY_ABRIR_SUBMENU = 500; const DELAY_FECHAR_MENU = 200;

            // ======================================================
            // MODAL DE CONFIRMAÇÃO GENÉRICO (ATUALIZADO V49.1)
            // ======================================================

            function exibirModalConfirmacao(statusNome, callbackFuncao) {
                removerModalConfirmacao();
                console.log(`[AÇÃO V49.2] Exibindo confirmação customizada para '${statusNome}'...`);

                const cId = 'pausa-script-confirm-modal';
                const dialog = document.createElement('div');
                dialog.id = cId;
                dialog.style.cssText = `
            position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%);
            width: 320px; background-color: rgba(20, 30, 45, 0.95); color: #FFFFFF;
            border: 2px solid #0FF; border-radius: 10px; padding: 20px;
            z-index: 2147483648; box-shadow: 0 0 25px rgba(0, 255, 255, 0.3), 0 5px 15px rgba(0, 0, 0, 0.6);
            font-family: 'Segoe UI', Tahoma, sans-serif; backdrop-filter: blur(8px); box-sizing: border-box;
        `;

                dialog.innerHTML = `
            <style>
                #${cId} h4 { color: #0FF; margin: 0 0 10px 0; font-size: 18px; text-shadow: 0 0 5px #0FF; }
                #${cId} p { margin: 0 0 20px 0; font-size: 14px; line-height: 1.5; }
                #${cId} strong { color: #f1fa8c; }
                #${cId} .confirm-buttons { display: flex; justify-content: space-between; gap: 10px; }
                #${cId} .confirm-btn {
                    flex-grow: 1; padding: 10px; border: none; border-radius: 6px; cursor: pointer;
                    font-size: 14px; font-weight: 700; transition: all .2s;
                }
                #${cId} #btn-confirm-permitir { /*bg-removido*/; color: white; }
                #${cId} #btn-confirm-permitir:hover { filter: brightness(1.15); }
                #${cId} #btn-confirm-cancelar { /*bg-removido*/; color: white; }
                #${cId} #btn-confirm-cancelar:hover { filter: brightness(1.15); }
            </style>
            <h4>🚨 Alerta de Automação</h4>
            <p>O script agendado quer alterar seu status para <strong>${statusNome}</strong>. Deseja permitir?</p>
            <div class="confirm-buttons purecloud-script-button">
                <button id="btn-confirm-cancelar" class="confirm-btn purecloud-script-button">Cancelar</button>
                <button id="btn-confirm-permitir" class="confirm-btn purecloud-script-button">Permitir</button>
            </div>
        `;

                document.body.appendChild(dialog);

                // --- INÍCIO DA CORREÇÃO V49.1 ---
                document.getElementById('btn-confirm-permitir').onclick = () => {
                    console.log(`[AÇÃO V49.2] Permissão concedida (custom) para '${statusNome}'.`);

                    // 1. Remove o modal PRIMEIRO.
                    removerModalConfirmacao();

                    // 2. Espera a UI estabilizar e DEPOIS executa a lógica de clique.
                    setTimeout(() => {
                        if (callbackFuncao) callbackFuncao();
                    }, 150); // 150ms de delay
                };
                // --- FIM DA CORREÇÃO V49.1 ---

                document.getElementById('btn-confirm-cancelar').onclick = () => {
                    console.warn(`[AÇÃO V49.2] Ação '${statusNome}' automática CANCELADA (custom).`);
                    removerModalConfirmacao();
                };

                const autoCloseTime = 30000;
                confirmModalTimeout = setTimeout(() => {
                    console.warn(`[AÇÃO V49.2] Confirmação '${statusNome}' expirou (sem resposta em ${autoCloseTime / 1000}s).`);
                    removerModalConfirmacao();
                }, autoCloseTime);
            }

            function removerModalConfirmacao() {
                if (confirmModalTimeout) {
                    clearTimeout(confirmModalTimeout);
                    confirmModalTimeout = null;
                }
                const dialog = document.getElementById('pausa-script-confirm-modal');
                if (dialog) {
                    dialog.remove();
                }
            }

            // ======================================================
            // FUNÇÕES DE LÓGICA DE CLIQUE (V46.3)
            // ======================================================

            function executarLogicaMenuSimples(seletorBotao, nomePausa, isAutomatico = false) {
                if (clicarElemento(SELECTORES.MENU_STATUS_TOGGLE)) {
                    setTimeout(() => {
                        if (clicarElemento(seletorBotao)) {
                            // V46.3: registrarPausa movido
                        } else {
                            console.warn(`[AÇÃO] Botão '${nomePausa}' (${seletorBotao}) não encontrado.`);
                            clicarElemento(SELECTORES.MENU_STATUS_TOGGLE);
                        }
                    }, DELAY_ABRIR_MENU);
                } else { console.warn("[AÇÃO] Botão Menu Status não encontrado."); }
            }

            // ATUALIZADA V49.0 (Usa o seletor correto)
            function executarLogicaSubMenu(seletorMenuTexto, seletorItemTexto, nomePausa, isAutomatico = false) {
                console.log(`[AÇÃO V49.2] Iniciando '${nomePausa}'...`);
                if (clicarElemento(SELECTORES.MENU_STATUS_TOGGLE)) {
                    setTimeout(() => {
                        // V49.0: Seletor correto
                        const seletorMenuBotao = SELECTORES.STATUS_LABEL_TEXT;

                        if (clicarElemento(seletorMenuBotao, seletorMenuTexto)) {
                            console.log(`[AÇÃO V49.2] Clicado em '${seletorMenuTexto}' (Menu Principal).`);
                            setTimeout(() => {
                                // V49.0: Seletor correto
                                if (clicarElemento(SELECTORES.STATUS_LABEL_TEXT, seletorItemTexto)) {
                                    console.log(`[AÇÃO V49.2] Clicado em '${seletorItemTexto}' (Submenu).`);
                                    console.log(`[AÇÃO V49.2] '${nomePausa}' ativado.`);
                                    setTimeout(clicarVoltarSubmenu, DELAY_FECHAR_MENU);
                                } else {
                                    console.warn(`[AÇÃO V49.2] Item de SUBMENU '${seletorItemTexto}' não encontrado (Seletor: ${SELECTORES.STATUS_LABEL_TEXT}).`);
                                    clicarElemento(SELECTORES.VOLTAR_SUBMENU);
                                    setTimeout(clicarElemento, DELAY_FECHAR_MENU, SELECTORES.MENU_STATUS_TOGGLE);
                                }
                            }, DELAY_ABRIR_SUBMENU);
                        } else {
                            console.warn(`[AÇÃO V49.2] Item de MENU PRINCIPAL '${seletorMenuTexto}' não encontrado (Seletor: ${seletorMenuBotao}).`);
                            clicarElemento(SELECTORES.MENU_STATUS_TOGGLE);
                        }
                    }, DELAY_ABRIR_MENU);
                }
            }

            // --- Lógica "Na Fila" ---
            function executarLogicaNaFila(isAutomatico = false) {
                let clicado = false;
                let elDireto = document.querySelector(SELECTORES.NA_FILA_DIRETO);
                if (elDireto && elDireto.offsetHeight !== 0) {
                    console.log("[AÇÃO V49.2] Clicando no botão 'Entrar na fila' (Direto)...");
                    try { elDireto.click(); clicado = true; }
                    catch (e) { clicado = clicarElemento(SELECTORES.NA_FILA_DIRETO); }
                } else {
                    console.log("[AÇÃO V49.2] Tentando clicar no toggle 'Na Fila' (Shadow DOM)...");
                    try {
                        const guxToggle = document.querySelector(SELECTORES.NA_FILA_TOGGLE_HOST);
                        if (guxToggle && guxToggle.shadowRoot) {
                            const shadowContent = guxToggle.shadowRoot;
                            const clickableSlider = shadowContent.querySelector('div[role="checkbox"]');
                            if (clickableSlider) { clickableSlider.click(); clicado = true; }
                            else { console.warn("[AÇÃO V49.2] 'gux-toggle' interno (div[role=checkbox]) não encontrado."); }
                        } else { console.warn("[AÇÃO V49.2] 'gux-toggle' (host) não encontrado ou sem shadowRoot."); }
                    } catch (e) { console.error("[AÇÃO V49.2] Erro ao tentar clicar no Shadow DOM do 'gux-toggle':", e); }
                }

                if (!clicado) console.warn("Ação 'Na Fila' falhou.");
            }

            // --- Lógica Ações Antigas ---
            function executarLogicaRefeicao(isAutomatico = false) { executarLogicaMenuSimples(SELECTORES.REFEICAO, 'Refeição', isAutomatico); }
            function executarLogicaDisponivel(isAutomatico = false) { executarLogicaMenuSimples(SELECTORES.DISPONIVEL, 'Disponível', isAutomatico); }
            function executarLogicaTreinamento(isAutomatico = false) { executarLogicaMenuSimples(SELECTORES.TREINAMENTO, 'Treinamento', isAutomatico); }
            function executarLogicaReuniao(isAutomatico = false) { executarLogicaMenuSimples(SELECTORES.REUNIAO, 'Reunião', isAutomatico); }
            // ATUALIZADA V48.8
            function executarLogicaDescanso(isAutomatico = false) { executarLogicaSubMenu("Intervalo", "Pausa auricular", "Pausa auricular", isAutomatico); }
            function executarLogicaPausaOut(isAutomatico = false) { executarLogicaSubMenu("Ocupado", "Pausa out", "Pausa out", isAutomatico); }

            // --- Lógica Ações NOVAS (V48.0) ---
            function executarLogicaBackoffice(isAutomatico = false) { executarLogicaSubMenu("Ocupado", "Atividade backoffice", "Backoffice", isAutomatico); }
            function executarLogicaFeedback(isAutomatico = false) { executarLogicaSubMenu("Ocupado", "Feedback", "Feedback", isAutomatico); }
            function executarLogicaParticular(isAutomatico = false) { executarLogicaSubMenu("Ausente", "Particular", "Particular", isAutomatico); }
            function executarLogicaQuestoesSaude(isAutomatico = false) { executarLogicaSubMenu("Ausente", "Questões de saúde", "Saúde", isAutomatico); }

            // --- Lógica Logoff (ATUALIZADA V48.3) ---
            function executarLogicaLogoff(isAutomatico = false) {
                if (!isAutomatico && !confirm("Tem certeza que deseja fazer logoff?\nO histórico será zerado.")) {
                    console.log("[AÇÃO] Logoff manual cancelado.");
                    return;
                }

                if (clicarElemento(SELECTORES.MENU_STATUS_TOGGLE)) {
                    setTimeout(() => {
                        // CORREÇÃO V48.3: Usa o seletor de texto correto
                        if (clicarElemento(SELECTORES.LOGOFF, "Fazer logoff")) {
                            historicoPausas = [];
                            estadoAtual = { tipo: 'Logoff', inicio: new Date, ativa: !1 };
                            atualizarUI(); renderizarHistoricoLog(); renderizarEstatisticas();
                            if (isAgendamentoAtivo) toggleAgendamento();
                            console.log("[AÇÃO] Logoff iniciado.");
                        } else {
                            console.warn("Botão 'Logoff' não encontrado.");
                            clicarElemento(SELECTORES.MENU_STATUS_TOGGLE);
                        }
                    }, DELAY_ABRIR_MENU);
                }
            }

            // ======================================================
            // FUNÇÕES ORQUESTRADORAS (V46.3)
            // ======================================================

            function iniciarNaFila(isAutomatico = false) {
                const status = "Na fila";
                if (isAutomatico) {
                    exibirModalConfirmacao(status, () => {
                        registrarPausa(status);
                        executarLogicaNaFila(true);
                    });
                } else {
                    registrarPausa(status);
                    executarLogicaNaFila(false);
                }
            }

            function iniciarRefeicao(isAutomatico = false) {
                const status = "Refeição";
                if (isAutomatico) {
                    exibirModalConfirmacao(status, () => {
                        registrarPausa(status);
                        executarLogicaRefeicao(true);
                    });
                } else {
                    registrarPausa(status);
                    executarLogicaRefeicao(false);
                }
            }

            function voltarDisponivel(isAutomatico = false) {
                const status = "Disponível";
                if (isAutomatico) {
                    exibirModalConfirmacao(status, () => {
                        registrarPausa(status);
                        executarLogicaDisponivel(true);
                    });
                } else {
                    registrarPausa(status);
                    executarLogicaDisponivel(false);
                }
            }

            function iniciarTreinamento(isAutomatico = false) {
                const status = "Treinamento";
                if (isAutomatico) {
                    exibirModalConfirmacao(status, () => {
                        registrarPausa(status);
                        executarLogicaTreinamento(true);
                    });
                } else {
                    registrarPausa(status);
                    executarLogicaTreinamento(false);
                }
            }

            function iniciarReuniao(isAutomatico = false) {
                const status = "Reunião";
                if (isAutomatico) {
                    exibirModalConfirmacao(status, () => {
                        registrarPausa(status);
                        executarLogicaReuniao(true);
                    });
                } else {
                    registrarPausa(status);
                    executarLogicaReuniao(false);
                }
            }

            // ATUALIZADA V48.8
            function iniciarDescanso(isAutomatico = false) {
                const status = "Pausa auricular"; // <-- MUDANÇA V48.8
                if (isAutomatico) {
                    exibirModalConfirmacao(status, () => {
                        registrarPausa(status);
                        executarLogicaDescanso(true);
                    });
                } else {
                    registrarPausa(status);
                    executarLogicaDescanso(false);
                }
            }

            function iniciarPausaOut(isAutomatico = false) {
                const status = "Pausa out";
                if (isAutomatico) {
                    exibirModalConfirmacao(status, () => {
                        registrarPausa(status);
                        executarLogicaPausaOut(true);
                    });
                } else {
                    registrarPausa(status);
                    executarLogicaPausaOut(false);
                }
            }

            // --- NOVAS Orquestradoras (V48.0) ---

            function iniciarBackoffice(isAutomatico = false) {
                const status = "Backoffice";
                if (isAutomatico) {
                    exibirModalConfirmacao(status, () => {
                        registrarPausa(status);
                        executarLogicaBackoffice(true);
                    });
                } else {
                    registrarPausa(status);
                    executarLogicaBackoffice(false);
                }
            }

            function iniciarFeedback(isAutomatico = false) {
                const status = "Feedback";
                if (isAutomatico) {
                    exibirModalConfirmacao(status, () => {
                        registrarPausa(status);
                        executarLogicaFeedback(true);
                    });
                } else {
                    registrarPausa(status);
                    executarLogicaFeedback(false);
                }
            }

            function iniciarParticular(isAutomatico = false) {
                const status = "Particular";
                if (isAutomatico) {
                    exibirModalConfirmacao(status, () => {
                        registrarPausa(status);
                        executarLogicaParticular(true);
                    });
                } else {
                    registrarPausa(status);
                    executarLogicaParticular(false);
                }
            }

            function iniciarQuestoesSaude(isAutomatico = false) {
                const status = "Saúde";
                if (isAutomatico) {
                    exibirModalConfirmacao(status, () => {
                        registrarPausa(status);
                        executarLogicaQuestoesSaude(true);
                    });
                } else {
                    registrarPausa(status);
                    executarLogicaQuestoesSaude(false);
                }
            }

            // --- Logoff (Especial) ---
            function realizarLogoff(isAutomatico = false) {
                if (isAutomatico) {
                    exibirModalConfirmacao("Logoff", () => {
                        executarLogicaLogoff(true);
                    });
                } else {
                    executarLogicaLogoff(false);
                }
            }


            // ----------------------------------------------------
            // FUNÇÕES DE VISIBILIDADE, ARRASTE E UI
            // ----------------------------------------------------

            function dragMouseDown(e) {
                dragElement = e.target.closest('#pausa-script-container, #pausa-script-config-container');
                if (!dragElement) return;
                const isHeaderMain = e.target.closest('#pausa-script-header');
                const isHeaderConfig = e.target.closest('#pausa-script-config-header');
                const isIcon = e.target.closest('#pausa-script-icone');
                if (!isHeaderMain && !isHeaderConfig && !isIcon) { dragElement = null; return; }
                e = e || window.event; if (e.button === 0) e.preventDefault(); else return;
                isDragging = false;
                offsetX = e.clientX - dragElement.offsetLeft; offsetY = e.clientY - dragElement.offsetTop;
                if (dragElement.style.bottom || dragElement.style.right) { const t = dragElement.getBoundingClientRect(); dragElement.style.left = t.left + 'px'; dragElement.style.top = t.top + 'px'; dragElement.style.right = ''; dragElement.style.bottom = '' }
                document.body.style.userSelect = 'none'; document.onmouseup = closeDragElement; document.onmousemove = elementDrag;
            }

            function elementDrag(e) { if (!dragElement) return; isDragging = true; e = e || window.event; e.preventDefault(); let t = e.clientY - offsetY, l = e.clientX - offsetX; const n = window.innerWidth - dragElement.offsetWidth, o = window.innerHeight - dragElement.offsetHeight; l = Math.max(0, Math.min(l, n)); t = Math.max(0, Math.min(t, o)); dragElement.style.top = t + "px"; dragElement.style.left = l + "px"; dragElement.style.cursor = 'grabbing'; }

            function closeDragElement() {
                document.body.style.userSelect = '';
                if (dragElement) {
                    if (dragElement.id === 'pausa-script-container') salvarPosicaoPainelLocalStorage(STORAGE_KEY_POS_MAIN, dragElement);
                    else if (dragElement.id === 'pausa-script-config-container') salvarPosicaoPainelLocalStorage(STORAGE_KEY_POS_CONFIG, dragElement);
                    const t = document.getElementById('pausa-script-conteudo');
                    if (dragElement.id === 'pausa-script-container' && t && t.style.display === 'none') dragElement.style.cursor = 'grab';
                    else { const e = dragElement.querySelector('#pausa-script-header') || dragElement.querySelector('#pausa-script-config-header'); if (e) e.style.cursor = 'move'; dragElement.style.cursor = 'default' }
                }
                document.onmouseup = null; document.onmousemove = null;
                setTimeout(() => { isDragging = false; }, 50);
                dragElement = null;
            }

            // ATUALIZADA V47.0
            function toggleVisibilidade() {
                const c = document.getElementById('pausa-script-container'), o = document.getElementById('pausa-script-conteudo'), i = document.getElementById('pausa-script-icone');
                if (!c || !o || !i) { console.error("UI Principal não encontrada."); return }
                const m = 15;
                if (o.style.display !== 'none') {
                    // --- MINIMIZAR ---
                    o.style.display = 'none';
                    i.style.display = 'flex';
                    c.style.width = 'auto';
                    c.style.height = 'auto';
                    c.style.cursor = 'grab';
                } else {
                    // --- MAXIMIZAR ---
                    o.style.display = 'block';
                    i.style.display = 'none';
                    c.style.width = 'auto';
                    c.style.height = 'auto';
                    c.style.cursor = 'default';

                    const h = c.querySelector('#pausa-script-header');
                    if (h) h.style.cursor = 'move';

                    if (c.style.top && c.style.left) { let cT = parseInt(c.style.top, 10), cL = parseInt(c.style.left, 10); setTimeout(() => { const hE = c.offsetHeight; const wE = c.offsetWidth; const mL = window.innerWidth - wE - m; if (cL > mL) { c.style.left = mL + 'px' } if (cL < m) { c.style.left = m + 'px' } const mT = window.innerHeight - hE - m; if (cT > mT) { c.style.top = mT + 'px' } if (cT < m) { c.style.top = m + 'px' } }, 10) }
                    else {
                        const r = c.getBoundingClientRect(); c.style.left = r.left + 'px'; c.style.top = r.top + 'px';
                        c.style.bottom = ''; c.style.right = '';
                    }
                }
            }

            function toggleVisibilidadeConfig() { const c = document.getElementById('pausa-script-config-container'); if (!c) { console.error("UI Config não encontrada."); return } isConfigPainelAberto = !isConfigPainelAberto; c.style.display = isConfigPainelAberto ? 'block' : 'none'; if (isConfigPainelAberto) { renderizarAgendamentos(); renderizarHistoricoLog(); renderizarEstatisticas() } }
            function renderizarAgendamentos() { const l = document.getElementById('agendamento-lista'); if (!l) return; l.innerHTML = ''; if (PAUSAS_AGENDADAS.length === 0) { l.innerHTML = '<p style="color:#999;margin:5px 0;font-size:11px;text-align:center;">Nenhum horário agendado.</p>' } else { const r = document.createDocumentFragment(); PAUSAS_AGENDADAS.forEach((p, idx) => { const i = document.createElement('div'); i.style.cssText = `display:flex;justify-content:space-between;align-items:center;border-bottom:1px dashed #ffffff15;padding:4px 2px;font-size:11px;`; const tD = document.createElement('div'); tD.style.flexGrow = '1'; tD.innerHTML = `<strong>${p.hora}</strong>: ${p.status}`; const bD = document.createElement('div'); bD.style.flexShrink = '0'; bD.style.marginLeft = '10px'; const bE = document.createElement('button'); bE.innerHTML = '✏️'; bE.title = `Editar ${p.hora} - ${p.status}`; bE.style.cssText = `background:0 0;border:none;color:#ffc107;cursor:pointer;font-size:14px;padding:0 4px;opacity:.7;transition:opacity .2s;`; bE.onmouseover = function () { this.style.opacity = '1' }; bE.onmouseout = function () { this.style.opacity = '.7' }; bE.onclick = () => carregarHorarioParaEdicao(idx); const bR = document.createElement('button'); bR.innerHTML = '❌'; bR.title = `Remover ${p.hora} - ${p.status}`; bR.style.cssText = `background:0 0;border:none;color:#ff6b6b;cursor:pointer;font-size:14px;padding:0 4px;margin-left:5px;opacity:.7;transition:opacity .2s;`; bR.onmouseover = function () { this.style.opacity = '1' }; bE.onmouseout = function () { this.style.opacity = '.7' }; bR.onclick = () => removerHorario(idx); bD.appendChild(bE); bD.appendChild(bR); i.appendChild(tD); i.appendChild(bD); r.appendChild(i) }); l.appendChild(r) } }
            function renderizarHistoricoLog() { const l = document.getElementById('historico-log'); if (!l) return; l.innerHTML = ''; if (historicoPausas.length === 0) { l.innerHTML = '<p style="color:#999;margin:5px 0;font-size:11px;">Nenhum registro.</p>'; return } const f = document.createDocumentFragment(); historicoPausas.slice().reverse().forEach(p => { const i = document.createElement('div'); i.style.cssText = `border-bottom:1px dashed #ffffff15;padding:4px 0;font-size:11px;line-height:1.4;`; i.innerHTML = `<strong>${p.tipo}</strong>: ${p.inicio} às ${p.fim} <span style="color:#00b0ff;">(Dur: ${p.duracao})</span>`; f.appendChild(i) }); l.appendChild(f); }
            function renderizarEstatisticas() { const s = document.getElementById('estatisticas-pausas'); if (!s) return; s.innerHTML = ''; if (historicoPausas.length === 0) { s.innerHTML = '<p style="color:#999;font-style:italic;margin:5px 0;font-size:11px;">Sem estatísticas.</p>'; return } const r = {}; historicoPausas.forEach(p => { const t = p.tipo; if (!r[t]) r[t] = { c: 0, s: 0 }; r[t].c++; r[t].s += converterDuracaoParaSegundos(p.duracao) }); const d = document.createElement('details'); d.style.marginTop = '10px'; d.open = !0; const m = document.createElement('summary'); m.style.cssText = 'cursor:pointer;color:#00b0ff;font-weight:700;margin-bottom:5px;'; m.textContent = 'Estatísticas'; d.appendChild(m); const c = document.createElement('div'); c.style.cssText = `/*bg-removido*/;padding:8px;border-radius:8px;font-size:11px;`; const f = document.createDocumentFragment(); const k = Object.keys(r).sort(); k.forEach((t, x) => { const o = r[t]; const u = formatarDuracao(o.s); const i = document.createElement('div'); i.style.cssText = `display:flex;justify-content:space-between;padding:3px 0;border-bottom:1px dashed #ffffff15;line-height:1.4;`; if (x === k.length - 1) i.style.borderBottom = 'none'; i.innerHTML = `<strong>${t} (x${o.c})</strong> <span style="color:#00b0ff;">${u}</span>`; f.appendChild(i) }); c.appendChild(f); d.appendChild(c); s.appendChild(d); }
            function criarUIRelogio() { /* Removido V44.0 */ }
            function verificarSeletoresEAtualizarUI() { const rD = document.getElementById('seletores-resultados'); if (!rD) { console.error("Div resultados não encontrado."); return } console.log("[Diagnóstico V49.2] Verificando..."); rD.innerHTML = '<p style="font-style:italic;color:#bbb;">Verificando...</p>'; let hR = '<ul style="list-style:none;padding:0;margin:5px 0 0 0;font-size:11px;">', tO = !0; setTimeout(() => { Object.keys(SELECTORES).forEach(k => { const s = SELECTORES[k]; if (k === 'CLOCK_CONTAINER_PARENT') return; const e = document.querySelector(s); const f = e !== null && (e.offsetParent !== null || e.tagName === 'DIV' || e.tagName === 'SPAN'); hR += `<li style="padding:3px 0;border-bottom:1px dashed #ffffff15;display:flex;justify-content:space-between;align-items:center;"><span style="color:#ccc; max-width: 80px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;" title="${k}">${k}:</span><span><code style="font-size:10px;background-color:rgba(0,255,255,.1);border:1px solid rgba(0,255,255,.2);color:#9fefef;padding:1px 3px;border-radius:3px; max-width: 120px; display: inline-block; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;" title="${s}">${s}</code><span style="margin-left:8px;font-weight:700;color:${f ? '#50fa7b' : '#ff5555'};">${f ? '✔️ Ok' : '❌ Falha'}</span></span></li>`; if (!f) { tO = !1; console.warn(`[Diagnóstico V49.2] Falha ${k}: ${s}`) } }); hR += '</ul>'; if (tO) { hR = '<p style="color:#50fa7b;font-weight:700;margin:5px 0;">✔️ Todos OK!</p>' + hR; console.log("[Diagnóstico V49.2] OK.") } else { hR = '<p style="color:#ff5555;font-weight:700;margin:5px 0;">❌ Atenção: Falha em um ou mais seletores!</p>' + hR; console.warn("[Diagnóstico V49.2] Falha(s) encontrada(s).") } rD.innerHTML = hR }, 50) }

            // --- CRIAR UI PRINCIPAL (ATUALIZADA V49.2 - MERGE) ---
            function criarUI() {
                const cId = 'pausa-script-container'; let cA = document.getElementById(cId); if (cA) cA.remove(); const c = document.createElement('div'); c.id = cId; document.body.appendChild(c);

                const pS = carregarPosicaoPainelLocalStorage(STORAGE_KEY_POS_MAIN);
                let cssPos = `position:fixed; ${pS ? (pS.top ? `top:${pS.top};left:${pS.left};` : `bottom:${pS.bottom};right:${pS.right};`) : 'bottom:30px;right:30px;'}`;

                c.style.cssText = `${cssPos} 
            width: auto; height: auto; 
            color: var(--ger-text-primary, #f8fafc);
            font-family: 'Segoe UI', Roboto, Helvetica, sans-serif;
            padding: 0;
            border-radius: 16px; 
            border: 1px solid var(--ger-border, #334155); 
            background: var(--ger-bg-primary, #0f172a); 
            box-shadow: 0 10px 25px rgba(0, 0, 0, 0.5);
            z-index: 2147483647; 
            cursor: grab; user-select: none; 
            transition: all .2s ease-out; 
            box-sizing: border-box;`;

                c.onmouseenter = (e) => { if (document.getElementById('pausa-script-conteudo').style.display !== 'none') c.style.background = 'var(--ger-bg-hover, #1e293b)' };
                c.onmouseleave = () => { if (document.getElementById('pausa-script-conteudo').style.display !== 'none') c.style.background = 'var(--ger-bg-primary, #0f172a)' };

                const savedTheme = localStorage.getItem('GERENCIADOR_THEME');
                if (savedTheme === 'light') c.classList.add('local-light-mode');
                else c.classList.add('cc-escurinho');

                // ======================================
                // INÍCIO: ESTILOS (V49.0 - DASHBOARD SYNC)
                // ======================================
                c.innerHTML = `<style>
            #${cId}.cc-escurinho {
                --ger-bg-primary: #0f172a;
                --ger-bg-hover: #1e293b;
                --ger-border: #334155;
                --ger-text-primary: #f8fafc;
                --ger-header-bg: #0284c7;
                --ger-header-text: #ffffff;
            }
            #${cId}.local-light-mode {
                --ger-bg-primary: #ffffff;
                --ger-bg-hover: #f1f5f9;
                --ger-border: #cbd5e1;
                --ger-text-primary: #0f172a;
                --ger-header-bg: #0284c7;
                --ger-header-text: #ffffff;
            }
            #${cId} * { box-sizing: border-box; }
            #${cId} .script-btn {
                display: flex; align-items: center; justify-content: center; 
                gap: 6px; padding: 10px 8px; border: none;
                border-radius: 8px; cursor: pointer;
                font-size: 12.5px; font-weight: 600; color: #FFFFFF;
                text-shadow: 0 1px 2px rgba(0,0,0,0.3);
                background-image: none; 
                box-shadow: 0 3px 5px rgba(0, 0, 0, 0.3), inset 0 1px 1px rgba(255, 255, 255, 0.1); 
                transition: all 0.15s ease-out;
                width: 100%;
                white-space: nowrap;
            }
            #${cId} .script-btn:hover {
                filter: brightness(1.1);
                transform: translateY(-2px); 
                box-shadow: 0 5px 12px rgba(0, 0, 0, 0.4), inset 0 1px 1px rgba(255, 255, 255, 0.1);
            }
            #${cId} .script-btn:active {
                transform: translateY(1px); 
                filter: brightness(0.95);
                box-shadow: inset 0 2px 4px rgba(0, 0, 0, 0.3); 
            }
            #${cId} #btn-disponivel, #${cId} #btn-toggle-agendamento[style*="background: linear-gradient(135deg, rgb(35, 167, 69)"] { background: linear-gradient(135deg, #23a745, #2dc24f); }
            #${cId} #btn-toggle-agendamento[style*="background: linear-gradient(135deg, rgb(220, 53, 69)"] { background: linear-gradient(135deg, #dc3545, #e84a5f); }
            #${cId} #btn-pause-resume-agendamento[style*="background: linear-gradient(135deg, rgb(255, 193, 7)"] { background: linear-gradient(135deg, #ffc107, #ffd25a); color: #000; }
            #${cId} #btn-pause-resume-agendamento[style*="background: linear-gradient(135deg, rgb(0, 127, 255)"] { background: linear-gradient(135deg, #007FFF, #009cff); color: #fff; }
            #${cId} #btn-na-fila { background: linear-gradient(135deg, #0096C7, #00bfff); }
            #${cId} #btn-refeicao { background: linear-gradient(135deg, #fd7e14, #ff9a40); }
            #${cId} #btn-descanso { background: linear-gradient(135deg, #ffc107, #ffd25a); color: #000; }
            #${cId} #btn-pausa-out { background: linear-gradient(135deg, #e63946, #f45b69); }
            #${cId} #btn-treinamento { background: linear-gradient(135deg, #6a00c9, #8e2de2); }
            #${cId} #btn-backoffice { background: linear-gradient(135deg, #c94b4b, #d46a6a); }
            #${cId} #btn-feedback { background: linear-gradient(135deg, #e85d04, #fa7e30); }
            #${cId} #btn-particular { background: linear-gradient(135deg, #8338ec, #9f60f0); }
            #${cId} #btn-saude { background: linear-gradient(135deg, #5e60ce, #7b7de0); }
            #${cId} #btn-reuniao { background: linear-gradient(135deg, #00c9c9, #30dede); color: #000; }
            #${cId} #btn-logoff { background: linear-gradient(135deg, #6c757d, #868e96); }
            #${cId} .automation-controls { display: flex; gap: 8px; }
            #${cId} .automation-controls .script-btn {
                width: auto; flex-grow: 1;
                font-size: 13px;
                justify-content: center;
                padding: 10px 8px;
            }
            #${cId} #pausa-script-header {
                display: flex; justify-content: space-between; align-items: center;
                margin: 0; padding: 12px 14px;
                background-color: var(--ger-header-bg, #0284c7);
                border-radius: 15px 15px 0 0;
                cursor: move;
            }
            #${cId} #pausa-script-header h3 {
                color: var(--ger-header-text, #ffffff); text-shadow: none;
                margin: 0; font-size: 14px; font-weight: 600;
            }
            #${cId} #pausa-script-header-clock { color: var(--ger-header-text, #ffffff) !important; text-shadow: none !important; }
            #${cId} #status-display { color: var(--ger-text-primary, #FFF); }
            #${cId} #pausa-script-header span { transition: color .2s; }
            #${cId} #pausa-script-header span#btn-abrir-config, #${cId} #pausa-script-header span#btn-tema-gerenciador { cursor: pointer; color: var(--ger-header-text, #ffffff); font-size: 16px; opacity: 0.8; }
            #${cId} #pausa-script-header span#btn-abrir-config:hover, #${cId} #pausa-script-header span#btn-tema-gerenciador:hover { opacity: 1; }
            #${cId} #pausa-script-header span#btn-minimizar { cursor: pointer; color: var(--ger-header-text, #ffffff); opacity: 0.9; font-size: 16px; font-weight: 700; margin-left: 4px; }
            #${cId} #pausa-script-header span#btn-minimizar:hover { color: #ff8080; opacity: 1; }
            #${cId} #status-display {
                background-color: rgba(0, 0, 0, 0.2);
                border: 1px solid rgba(0, 0, 0, 0.3);
                box-shadow: inset 0 1px 3px rgba(0, 0, 0, 0.4);
                color: #FFF;
                padding: 10px; border-radius: 8px;
                margin-bottom: 15px; text-align: center;
                font-size: 14px;
            }
            #${cId} #current-status { font-weight: 700; }
            #${cId} #current-status[style*="rgb(80, 250, 123)"] { color: #50fa7b; }
            #${cId} #current-status[style*="rgb(241, 250, 140)"] { color: #f1fa8c; }
            #${cId} #pausa-script-icone {
                display: flex; align-items: center; justify-content: center;
                width: 100%; height: 100%; cursor: grab;
            }
            #${cId} #top-bar-time {
                font-size: 1.5em;
                font-weight: 700; white-space: nowrap;
                color: #0FF;
                text-shadow: 0 0 5px rgba(0, 255, 255, 0.5);
            }
            #${cId} #pausa-script-clock-dot {
                width: 8px; height: 8px;
                /*bg-removido*/;
                border-radius: 50%;
                margin-right: 8px;
                box-shadow: 0 0 5px #f1fa8c, 0 0 10px #f1fa8c;
                animation: blink-animation 1.5s infinite ease-in-out;
            }
            #${cId} #pausa-script-clock-dot.status-ok {
                /*bg-removido*/;
                box-shadow: 0 0 5px #50fa7b, 0 0 10px #50fa7b;
            }
            @keyframes blink-animation {
                0% { opacity: 1; }
                50% { opacity: 0.3; }
                100% { opacity: 1; }
            }
            </style>
        
            <div id="pausa-script-icone" style="display:flex; padding: 10px 14px;">
                 <span id="pausa-script-clock-dot" style="display: none;"></span> 
                 <span id="top-bar-time">--:--:--</span>
            </div>
            
            <div id="pausa-script-conteudo" style="display:none; padding:0; min-width: 320px;">
                
                <div id="pausa-script-header">
                    <h3 style="font-size: 14px; margin: 0; white-space: nowrap;">🛠️ Gerenciador</h3>
                    
                    <div style="display: flex; align-items: center; gap: 6px;">
                        <span id="pausa-script-header-clock" style="
                            font-size: 13px; 
                            font-family: 'Courier New', Courier, monospace; 
                            color: #f1fa8c; 
                            text-shadow: 0 0 5px rgba(241, 250, 140, 0.5);
                            line-height: 1;
                        ">--:--:--</span>
                        
                        <div style="display: flex; align-items: center; gap: 6px; flex-shrink: 0;">
                            <span id="btn-tema-gerenciador" title="Mudar Tema" style="cursor: pointer; font-size: 16px;">${localStorage.getItem('GERENCIADOR_THEME') === 'light' ? '☀️' : '🌗'}</span>
                            <span id="btn-abrir-config" title="Configurações">⚙️</span>
                            <span id="btn-minimizar" title="Fechar Painel">[X]</span>
                        </div>
                    </div>
                </div>
                <div style="padding: 14px;">
                    <div id="status-display">Status: <strong id="current-status" style="color:#50fa7b;">${estadoAtual.tipo}</strong></div>
                    
                    <div class="automation-controls" style="margin-bottom:15px; text-align:center;">
                    <button id="btn-toggle-agendamento" class="script-btn" style="flex-basis:65%;">Ligar Automação</button>
                    <button id="btn-pause-resume-agendamento" class="script-btn" style="display:none;flex-basis:35%;">Pausar ⏸️</button>
                </div>
                
                <div id="buttons-container" style="display:grid;grid-template-columns:repeat(2, 1fr);gap:10px;margin-bottom:10px;">
                    <button id="btn-disponivel" class="script-btn purecloud-script-button">🟢 Disponível</button>
                    <button id="btn-na-fila" class="script-btn purecloud-script-button">🎧 Na Fila</button>
                    <button id="btn-refeicao" class="script-btn purecloud-script-button">🍔 Refeição</button>
                    <button id="btn-descanso" class="script-btn purecloud-script-button">☕ Pausa auricular</button>
                    <button id="btn-pausa-out" class="script-btn purecloud-script-button">⛔ Pausa Out</button>
                    <button id="btn-treinamento" class="script-btn purecloud-script-button">📚 Treinamento</button>
                    <button id="btn-backoffice" class="script-btn purecloud-script-button">📁 Backoffice</button>
                    <button id="btn-feedback" class="script-btn purecloud-script-button">📝 Feedback</button>
                    <button id="btn-particular" class="script-btn purecloud-script-button">🔒 Particular</button>
                    <button id="btn-saude" class="script-btn purecloud-script-button">🩺 Saúde</button>
                </div>
                
                <div id="buttons-extra" style="display:grid;grid-template-columns:1fr 1fr;gap:10px;">
                    <button id="btn-reuniao" class="script-btn purecloud-script-button">🧑‍🤝‍🧑 Reunião</button>
                    <button id="btn-logoff" class="script-btn purecloud-script-button">🚪 Fazer Logoff</button>
                </div>
            </div>
        `;

                const header = c.querySelector('#pausa-script-header');
                const icone = c.querySelector('#pausa-script-icone');
                if (header) header.onmousedown = dragMouseDown;
                if (icone) icone.onmousedown = dragMouseDown;

                c.addEventListener('click', function (e) {
                    if (isDragging) { isDragging = false; return; }
                    const t = e.target.closest('button'), n = e.target.closest('span#btn-minimizar, span#btn-abrir-config'), o = e.target.closest('div#pausa-script-icone'); let l = t || n || o; if (!l) return;
                    const d = document.getElementById('pausa-script-conteudo');
                    if (o && d && d.style.display === 'none') { toggleVisibilidade(); return; }
                    const a = document.getElementById('pausa-script-header');
                    if (d.style.display !== 'none' && a && a.contains(e.target) && !n && !t) return;

                    const i = l.id; switch (i) {
                        case 'btn-na-fila': iniciarNaFila(false); break;
                        case 'btn-refeicao': iniciarRefeicao(false); break;
                        case 'btn-descanso': iniciarDescanso(false); break;
                        case 'btn-pausa-out': iniciarPausaOut(false); break;
                        case 'btn-disponivel': voltarDisponivel(false); break;
                        case 'btn-logoff': realizarLogoff(false); break;
                        case 'btn-treinamento': iniciarTreinamento(false); break;
                        case 'btn-reuniao': iniciarReuniao(false); break;
                        case 'btn-backoffice': iniciarBackoffice(false); break;
                        case 'btn-feedback': iniciarFeedback(false); break;
                        case 'btn-particular': iniciarParticular(false); break;
                        case 'btn-saude': iniciarQuestoesSaude(false); break;
                        case 'btn-toggle-agendamento': toggleAgendamento(); break;
                        case 'btn-pause-resume-agendamento': togglePausaAutomacao(); break;
                        case 'btn-minimizar': toggleVisibilidade(); break;
                        case 'btn-abrir-config': toggleVisibilidadeConfig(); break;
                        case 'btn-tema-gerenciador':
                            const isLight = c.classList.contains('local-light-mode');
                            const themeBtn = document.getElementById('btn-tema-gerenciador');
                            if (isLight) {
                                c.classList.remove('local-light-mode');
                                c.classList.add('cc-escurinho');
                                localStorage.setItem('GERENCIADOR_THEME', 'dark');
                                if (themeBtn) themeBtn.innerText = '🌗';
                            } else {
                                c.classList.remove('cc-escurinho');
                                c.classList.add('local-light-mode');
                                localStorage.setItem('GERENCIADOR_THEME', 'light');
                                if (themeBtn) themeBtn.innerText = '☀️';
                            }
                            break;
                    }
                });

                const bTg = c.querySelector('#btn-toggle-agendamento'), bP = c.querySelector('#btn-pause-resume-agendamento');
                if (bTg && bP) {
                    if (isAgendamentoAtivo) {
                        bTg.textContent = "Desligar Automação";
                        bTg.style.background = 'linear-gradient(135deg, #dc3545, #e84a5f)';
                        bP.style.display = 'inline-block';
                        if (isAutomacaoPausada) {
                            bP.textContent = "Retomar ▶️";
                            bP.style.background = 'linear-gradient(135deg, #007FFF, #009cff)';
                            bP.style.color = '#fff';
                        } else {
                            bP.textContent = "Pausar ⏸️";
                            bP.style.background = 'linear-gradient(135deg, #ffc107, #ffd25a)';
                            bP.style.color = '#000';
                        }
                    } else {
                        bTg.textContent = "Ligar Automação";
                        bTg.style.background = 'linear-gradient(135deg, #23a745, #2dc24f)';
                        bP.style.display = 'none';
                    }
                }

                registrarPausa(estadoAtual.tipo);
                adicionarAtalho();
                setInterval(atualizarUI, 1000);
            }

            // --- CRIAR UI CONFIGURAÇÕES (ATUALIZADA REDESIGN) ---
            function criarUIConfiguracoes() {
                const cId = 'pausa-script-config-container'; let cA = document.getElementById(cId); if (cA) cA.remove(); const cC = document.createElement('div'); cC.id = cId; document.body.appendChild(cC); const pSC = carregarPosicaoPainelLocalStorage(STORAGE_KEY_POS_CONFIG);
                let cssPos = `position:fixed; ${pSC ? (pSC.top ? `top:${pSC.top};left:${pSC.left};` : `bottom:${pSC.bottom};right:${pSC.right};`) : 'bottom:30px;right:340px;'}`;

                // Injeta leitura de tema local
                const saveCfgTheme = localStorage.getItem('GERCONFIG_THEME');
                if (saveCfgTheme === 'light') cC.classList.add('local-light-mode');
                else cC.classList.add('cc-escurinho');

                cC.style.cssText = `${cssPos} 
            width:380px; 
            background: var(--gerconfig-bg, rgba(15, 23, 42, 0.95));
            color: var(--gerconfig-text, #f8fafc);
            border: 1px solid var(--gerconfig-border, #334155);
            border-radius:16px; padding:20px;
            z-index:2147483646;
            box-shadow: 0 15px 35px rgba(0, 0, 0, 0.3);
            font-family: 'Segoe UI', Roboto, Helvetica, sans-serif;
            font-size:13px; height:auto; max-height:calc(100vh - 60px);
            backdrop-filter: blur(12px);
            transition:all .3s ease-in-out; display:none; overflow-y:auto;
            box-sizing:border-box; cursor:default;`;

                // V48.0 -> Redesign UI CSS
                cC.innerHTML = `<style>
            #${cId}.cc-escurinho {
                --gerconfig-bg: #0f172a;
                --gerconfig-text: #f8fafc;
                --gerconfig-text-muted: #94a3b8;
                --gerconfig-border: #334155;
                --gerconfig-card-bg: #1e293b;
                --gerconfig-card-hover: #334155;
                --gerconfig-accent: #0ea5e9;
                --gerconfig-input-bg: #0f172a;
                --gerconfig-header-bg: #0284c7;
                --gerconfig-header-text: #ffffff;
            }
            #${cId}.local-light-mode {
                --gerconfig-bg: #ffffff;
                --gerconfig-text: #0f172a;
                --gerconfig-text-muted: #64748b;
                --gerconfig-border: #cbd5e1;
                --gerconfig-card-bg: #f8fafc;
                --gerconfig-card-hover: #f1f5f9;
                --gerconfig-accent: #0284c7;
                --gerconfig-input-bg: #ffffff;
                --gerconfig-header-bg: #0284c7;
                --gerconfig-header-text: #ffffff;
            }
            
            #${cId} * { box-sizing:border-box; }
            #${cId} ::-webkit-scrollbar { width: 6px; }
            #${cId} ::-webkit-scrollbar-thumb { background: var(--gerconfig-border); border-radius: 4px; }

            #${cId} .script-btn-config {
                padding: 10px 15px; border: none; border-radius: 8px; cursor: pointer;
                font-size: 13px; font-weight: 600; color: #fff;
                box-shadow: 0 2px 4px rgba(0,0,0,0.1); 
                transition: all .2s ease; width: 100%; box-sizing: border-box;
            }
            #${cId} .script-btn-config:hover { filter: brightness(1.1); transform: translateY(-1px); box-shadow: 0 4px 8px rgba(0,0,0,0.15); }
            #${cId} .script-btn-config:active { transform: translateY(1px); filter: brightness(.95); box-shadow: none; }
            
            #${cId} details {
                margin-top: 12px;
                border: 1px solid var(--gerconfig-border);
                border-radius: 10px;
                background-color: var(--gerconfig-card-bg);
                overflow: hidden;
                transition: all 0.2s ease;
            }
            #${cId} details[open] {
                box-shadow: 0 4px 12px rgba(0,0,0,0.05);
            }
            #${cId} summary {
                padding: 12px 14px; cursor: pointer; color: var(--gerconfig-accent); font-weight: 600; font-size: 14px;
                list-style: none; display: flex; align-items: center; user-select: none;
                transition: background-color 0.2s ease;
            }
            #${cId} summary:hover { background-color: var(--gerconfig-card-hover); }
            #${cId} summary::-webkit-details-marker { display: none; }
            #${cId} summary::before {
                content: '›'; margin-right: 12px; font-size: 20px; line-height: 1; 
                transition: transform 0.2s ease; color: var(--gerconfig-text-muted); display: inline-block;
            }
            #${cId} details[open] > summary::before { transform: rotate(90deg); }
            #${cId} details > div {
                padding: 14px; border-top: 1px solid var(--gerconfig-border);
                background-color: var(--gerconfig-bg);
            }
            
            #${cId} .add-schedule-form { display: flex; gap: 8px; margin-top: 10px; align-items: center; }
            #${cId} .add-schedule-form input[type=time], #${cId} .add-schedule-form input[type=text] {
                background-color: var(--gerconfig-input-bg);
                border: 1px solid var(--gerconfig-border);
                color: var(--gerconfig-text); padding: 10px; border-radius: 8px; font-size: 13px;
                outline: none; transition: border-color .2s;
            }
            #${cId} .add-schedule-form input[type=time]:focus, #${cId} .add-schedule-form input[type=text]:focus { border-color: var(--gerconfig-accent); }
            #${cId} .add-schedule-form input[type=time] { flex-basis: 90px; flex-shrink: 0; }
            #${cId} .add-schedule-form input[type=text] { flex-grow: 1; min-width: 0; width: 100%; }
            #${cId} .add-schedule-form button { 
                flex-shrink: 0; padding: 10px 16px!important; font-size: 16px!important; font-weight: 700!important;
                width: auto!important; background: linear-gradient(135deg, #10b981, #059669) !important;
            }

            #${cId} #agendamento-lista {
                max-height: 160px; overflow-y: auto; margin-bottom: 15px; border-radius: 8px; 
                padding: 8px; background-color: var(--gerconfig-input-bg); border: 1px solid var(--gerconfig-border);
            }
            #${cId} #agendamento-lista div button { background: none; border: none; cursor: pointer; font-size: 15px; padding: 0 4px; margin-left: 5px; opacity: 0.7; transition: opacity .2s; }
            #${cId} #agendamento-lista div button:hover { opacity: 1; }
            #${cId} #agendamento-lista button[title*=Editar]{color:#f59e0b}
            #${cId} #agendamento-lista button[title*=Remover]{color:#ef4444}
            
            #${cId} #historico-log div, #${cId} #seletores-resultados li { border-bottom: 1px dashed var(--gerconfig-border) !important; padding: 6px 0 !important; }
            
            #${cId} #pausa-script-config-header {
                display:flex; justify-content:space-between; align-items:center;
                background-color: var(--gerconfig-header-bg); padding: 12px 20px;
                cursor:move; border-bottom: 1px solid var(--gerconfig-border);
            }
            #${cId} #pausa-script-config-header h3 { color: var(--gerconfig-header-text); margin: 0; font-size: 15px; font-weight: 600; display: flex; align-items: center; gap: 8px; }
            #${cId} .panel-actions span { cursor: pointer; font-size: 16px; margin-left: 12px; transition: opacity 0.2s; color: var(--gerconfig-header-text); opacity: 0.8; }
            #${cId} .panel-actions span:hover { opacity: 1; }
            #${cId} #btn-fechar-config { font-weight: 700; margin-left: 14px!important; opacity: 0.9; }
            #${cId} #btn-fechar-config:hover { color: #ff8080; }
            
            #${cId} code { background-color: var(--gerconfig-border); color: var(--gerconfig-text); padding: 2px 5px; border-radius: 4px; font-size: 11px; }
            
            #${cId} .config-item { display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px; font-size: 13.5px; }
            #${cId} .config-item label { color: var(--gerconfig-text); }
            #${cId} .config-item input[type=checkbox] { width: 18px; height: 18px; accent-color: var(--gerconfig-accent); cursor: pointer; }
            #${cId} .config-item input[type=number] {
                width: 60px; background-color: var(--gerconfig-input-bg); border: 1px solid var(--gerconfig-border);
                color: var(--gerconfig-text); padding: 6px 8px; border-radius: 6px; font-size: 13px; outline: none; text-align: center;
            }

            #${cId} #btn-exportar-config { background: linear-gradient(135deg, #3b82f6, #2563eb); }
            #${cId} #btn-importar-config { background: linear-gradient(135deg, #64748b, #475569); }
            #${cId} #btn-verificar-seletores { background: linear-gradient(135deg, #8b5cf6, #7c3aed); }
            
            #${cId} .section-label { font-size: 11px; text-transform: uppercase; letter-spacing: 0.5px; color: var(--gerconfig-text-muted); font-weight: 700; margin: 0 0 8px 0; }
            </style>
            <div id="pausa-script-config-header">
                <h3>⚙️ Config & Histórico</h3>
                <div class="panel-actions" style="display:flex; align-items:center;">
                    <span id="config-btn-theme" title="Mudar Tema">${localStorage.getItem('GERCONFIG_THEME') === 'dark' ? '🌗' : '☀️'}</span>
                    <span id="btn-fechar-config" title="Fechar">[X]</span>
                </div>
            </div>
            
            <div style="padding: 20px; overflow-y: auto; max-height: calc(100vh - 120px);">
            <div id="estatisticas-pausas" style="margin-bottom:8px;"></div>
            
            <details><summary>🔔 Notificações</summary><div>
                <p class="section-label">Ajuste de Alertas</p>
                <div class="config-item"><label for="notif-ativadas">Alertas Visuais:</label><input type="checkbox" id="notif-ativadas"></div>
                <div class="config-item"><label for="notif-som">Avisos Sonoros:</label><input type="checkbox" id="notif-som"></div>
                <div class="config-item"><label for="notif-tempo">Aviso Antecipado (s):</label><input type="number" id="notif-tempo" min="5" max="55" step="5"></div>
            </div></details>
            
            <details open><summary>⏰ Editar Horários</summary><div>
                <p class="section-label" style="font-size:11px; margin-bottom: 8px;">Agendamentos Atuais</p>
                <div id="agendamento-edit">
                    <div id="agendamento-lista"></div>
                    <p class="section-label" style="margin-top: 15px;">Novo Agendamento</p>
                    <div class="add-schedule-form">
                        <input type="time" id="novo-horario-hora" required>
                        <input type="text" id="novo-horario-status" placeholder="Ex: Refeição, Pausa..." required>
                        <button id="btn-adicionar-horario" class="script-btn-config" title="Adicionar">+</button>
                    </div>
                </div>
            </div></details>
            
            <details open><summary>📋 Histórico Diário</summary><div>
                <div id="historico-log" style="max-height:160px; overflow-y:auto; background:transparent; padding:0;"></div>
            </div></details>
            
            <details><summary>🩺 Diagnóstico Téc.</summary><div>
                <p class="section-label">Verificador de Estrutura</p>
                <p style="font-size:12px; color:var(--gerconfig-text-muted); margin:0 0 12px 0;">Use isso se os botões não estiverem lendo o site corretamente.</p>
                <button id="btn-verificar-seletores" class="script-btn-config" style="margin-bottom:12px;">Fazer Varredura</button>
                <div id="seletores-resultados" style="max-height:150px; overflow-y:auto; background:var(--gerconfig-input-bg); border-radius: 8px; padding: 10px; border: 1px solid var(--gerconfig-border);">
                    <p style="color:var(--gerconfig-text-muted); font-style:italic; font-size:11px; margin:0; text-align:center;">Resultados aparecerão aqui.</p>
                </div>
            </div></details>
            
            <details><summary>💾 Backup de Dados</summary><div>
                <p class="section-label">Configurações Locais</p>
                <p style="font-size:12px; color:var(--gerconfig-text-muted); margin:0 0 12px 0;">Backup apenas das suas pausas agendadas e layout.</p>
                <div style="display:flex; gap:10px;">
                    <button id="btn-exportar-config" class="script-btn-config" style="flex:1;">📤 Exportar</button>
                    <button id="btn-importar-config" class="script-btn-config" style="flex:1;">📥 Importar</button>
                </div>
                <input type="file" id="import-file-input" accept=".json" style="display:none;">
            </div></details>
            </div>
        `;

                const hC = cC.querySelector('#pausa-script-config-header'); if (hC) hC.onmousedown = dragMouseDown;
                const bF = cC.querySelector('#btn-fechar-config'); if (bF) bF.onclick = toggleVisibilidadeConfig;
                const bV = cC.querySelector('#btn-verificar-seletores'); if (bV) bV.onclick = verificarSeletoresEAtualizarUI;
                const bA = cC.querySelector('#btn-adicionar-horario'); if (bA) bA.onclick = adicionarNovoHorario;
                const cN = cC.querySelector('#notif-ativadas'), cS = cC.querySelector('#notif-som'), iT = cC.querySelector('#notif-tempo'); if (cN) cN.checked = configNotificacao.ativadas; if (cS) cS.checked = configNotificacao.somAtivado; if (iT) iT.value = configNotificacao.antecedenciaSegundos;
                function sM() { configNotificacao.ativadas = cN.checked; configNotificacao.somAtivado = cS.checked; let t = parseInt(iT.value, 10); if (isNaN(t) || t < 5) t = 5; if (t > 55) t = 55; iT.value = t; configNotificacao.antecedenciaSegundos = t; salvarConfiguracoesNotificacaoLocalStorage(configNotificacao); console.log("[Config Notif] Salvas:", configNotificacao) }
                if (cN) cN.onchange = sM; if (cS) cS.onchange = sM; if (iT) iT.onchange = sM;
                const bE = cC.querySelector('#btn-exportar-config'); if (bE) bE.onclick = exportarConfiguracoes;
                const bI = cC.querySelector('#btn-importar-config'); if (bI) bI.onclick = importarConfiguracoes;
                const fI = cC.querySelector('#import-file-input'); if (fI) fI.onchange = handleArquivoImportado;

                renderizarAgendamentos(); renderizarHistoricoLog(); renderizarEstatisticas();
            }

            // ATUALIZADA V48.4 (Controla o novo relógio do cabeçalho)
            function atualizarUI() {
                const a = new Date, h = a.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });

                // Relógio minimizado
                const tFlutuante = document.getElementById('top-bar-time');
                const tDot = document.getElementById('pausa-script-clock-dot'); // V48.0

                // --- INÍCIO DA MODIFICAÇÃO V48.4 ---
                // Novo relógio do cabeçalho
                const tHeader = document.getElementById('pausa-script-header-clock');
                // --- FIM DA MODIFICAÇÃO V48.4 ---


                if (tFlutuante) {
                    tFlutuante.textContent = h;
                    // Lógica da Cor do Relógio
                    if (estadoAtual.tipo === 'Disponível' || estadoAtual.tipo === 'Na fila') tFlutuante.style.color = '#50fa7b';
                    else if (estadoAtual.tipo === 'Logoff') tFlutuante.style.color = '#999';
                    else tFlutuante.style.color = '#f1fa8c';
                }

                // --- INÍCIO DA MODIFICAÇÃO V48.4 ---
                // Atualiza o novo relógio do cabeçalho e aplica a mesma lógica de cor
                if (tHeader) {
                    tHeader.textContent = h;
                    if (estadoAtual.tipo === 'Disponível' || estadoAtual.tipo === 'Na fila') {
                        tHeader.style.color = '#50fa7b';
                        tHeader.style.textShadow = '0 0 5px rgba(80, 250, 123, 0.5)';
                    }
                    else if (estadoAtual.tipo === 'Logoff') {
                        tHeader.style.color = '#999';
                        tHeader.style.textShadow = 'none';
                    }
                    else {
                        tHeader.style.color = '#f1fa8c'; // Cor de pausa
                        tHeader.style.textShadow = '0 0 5px rgba(241, 250, 140, 0.5)';
                    }
                }
                // --- FIM DA MODIFICAÇÃO V48.4 ---

                // V48.0 - Lógica do Ponto Piscante
                if (tDot) {
                    if (estadoAtual.ativa) { // 'ativa' é true para tudo, exceto Logoff
                        tDot.style.display = 'block';
                        // Muda a cor do ponto para verde se estiver 'OK'
                        if (estadoAtual.tipo === 'Disponível' || estadoAtual.tipo === 'Na fila') {
                            tDot.className = 'status-ok';
                        } else {
                            tDot.className = ''; // Usa a cor amarela padrão
                        }
                    } else {
                        tDot.style.display = 'none'; // Esconde o ponto (Ex: Logoff)
                    }
                }

                const s = document.getElementById('current-status'); if (s) {
                    let e = '';

                    if (estadoAtual.ativa) {
                        const o = a.getTime() - estadoAtual.inicio.getTime();
                        const r = Math.max(0, Math.round(o / 1000));
                        e = ` (${formatarDuracao(r)})`;
                    }

                    s.textContent = `${estadoAtual.tipo}${e}`;

                    s.style.color = (estadoAtual.tipo === 'Disponível' || estadoAtual.tipo === 'Na fila') ? '#50fa7b' : '#f1fa8c';
                }
            }

            // ----------------------------------------------------
            // INÍCIO DO SCRIPT
            // ----------------------------------------------------
            console.log("[GERENCIADOR DE PAUSAS V49.2] Aguardando para injetar UI...");
            const delayInicial = 2800;

            setTimeout(() => {
                if (window.self !== window.top) return;
                try {
                    configNotificacao = carregarConfiguracoesNotificacaoLocalStorage();
                    PAUSAS_AGENDADAS = carregarHorariosLocalStorage();

                    console.log("[GERENCIADOR] Solicitando permissão para notificações...");
                    if (configNotificacao.ativadas && "Notification" in window && Notification.permission === 'default') { Notification.requestPermission().then(p => { if (p === 'granted') { console.log("[Notificação] Permissão OK!"); new Notification("Gerenciador", { body: "Notificações Ativadas!" }) } else { console.warn("[Notificação] Permissão Negada."); localStorage.setItem('notificacao_permissao_negada_aviso', 'true'); } }); }
                    else if (Notification.permission === 'denied') { console.warn("[Notificação] Permissão Negada Anteriormente."); localStorage.setItem('notificacao_permissao_negada_aviso', 'true'); }

                    console.log("[GERENCIADOR] Injetando UI...");
                    criarUI();
                    criarUIConfiguracoes(); // Esta é a função que foi corrigida
                    renderizarAgendamentos();
                    console.log("[GERENCIADOR] UI Injetada.");

                    audioNotificacao.volume = 0.5;
                    document.addEventListener('click', desbloquearAudio, { once: true });
                    console.log("[Audio] Pronto para desbloquear no próximo clique.");

                } catch (error) {
                    console.error("[GERENCIADOR] Erro crítico ao iniciar:", error);
                    alert("Erro grave ao iniciar o Gerenciador. Verifique o console (F12).");
                }
            }, delayInicial);

        })(); // Fim do IIFE

    } catch (e) { console.error('[BUILDER] Erro fatal no módulo pausas.js:', e); }

    /* --- MÓDULO ANEXADO: CAR.JS --- */
    try {
        // ==UserScript==
        // @name         PureCloud - CAR (Automação Rápida v3.1)
        // @description  Módulo de Automação Híbrido com Importador de Texto Restaurado.
        // ==/UserScript==

        (function () {
            'use strict';

            const STORAGE_KEY = 'car_data_v8_master';
            const THEME_KEY = 'car_theme_v8';

            // DETECTOR DE AMBIENTE
            const isExtension = typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.id;

            // COMANDOS PADRÃO
            const defaultScripts = {
                "ex1": "Exemplo de texto expandido automaticamente.",
                "ajuda": "Digite o atalho e aperte ESPAÇO para expandir."
            };

            let scripts = {};
            let isDark = true;

            // --- ARMAZENAMENTO HÍBRIDO ---
            const Storage = {
                get: (callback) => {
                    if (isExtension) {
                        chrome.storage.local.get([STORAGE_KEY, THEME_KEY], (res) => {
                            callback({ scripts: res[STORAGE_KEY] || defaultScripts, theme: res[THEME_KEY] || 'dark' });
                        });
                    } else {
                        const s = localStorage.getItem(STORAGE_KEY);
                        const t = localStorage.getItem(THEME_KEY);
                        callback({ scripts: s ? JSON.parse(s) : defaultScripts, theme: t || 'dark' });
                    }
                },
                set: (data) => {
                    if (isExtension) {
                        let saveObj = {};
                        if (data.scripts) saveObj[STORAGE_KEY] = data.scripts;
                        if (data.theme) saveObj[THEME_KEY] = data.theme;
                        chrome.storage.local.set(saveObj);
                    } else {
                        if (data.scripts) localStorage.setItem(STORAGE_KEY, JSON.stringify(data.scripts));
                        if (data.theme) localStorage.setItem(THEME_KEY, data.theme);
                    }
                    if (data.scripts) scripts = data.scripts;
                    if (data.theme) isDark = (data.theme === 'dark');
                }
            };

            function loadData() {
                Storage.get((data) => {
                    scripts = data.scripts;
                    isDark = (data.theme === 'dark');
                    if (isExtension && !data.scripts) Storage.set({ scripts: defaultScripts });
                });
            }

            // --- CSS CORRIGIDO (Importador Fixo) ---
            const styles = `
                #car-panel {
                    --bg-panel: #ffffff; --text-main: #1f2937; --text-sec: #6b7280;
                    --bg-input: #f3f4f6; --border-input: #e5e7eb; --bg-item: #ffffff;
                    --accent: #10b981; --accent-grad: linear-gradient(135deg, #10b981, #3b82f6);
                    --box-bg: #eff6ff; --box-border: #bfdbfe; --box-text: #1e40af;
                    
                    font-family: 'Segoe UI', sans-serif; position: fixed; bottom: 100px; right: 90px;
                    width: 360px; height: 650px; background: var(--bg-panel); border-radius: 16px;
                    box-shadow: 0 25px 50px -12px rgba(0,0,0,0.4); display: none; flex-direction: column;
                    z-index: 2147483648; border: 1px solid rgba(0,0,0,0.1); transition: opacity 0.2s;
                }
                #car-panel.dark-mode {
                    --bg-panel: #1f2937; --text-main: #f9fafb; --text-sec: #9ca3af;
                    --bg-input: #374151; --border-input: #4b5563; --bg-item: #111827;
                    --box-bg: #1e293b; --box-border: #334155; --box-text: #93c5fd;
                    border: 1px solid rgba(255,255,255,0.1);
                }
                .car-header { background: var(--accent-grad); padding: 15px; color: white; display: flex; justify-content: space-between; align-items: center; cursor: move; border-radius: 15px 15px 0 0; flex-shrink: 0; }
                .car-title { font-weight: 700; font-size: 15px; display: flex; align-items: center; gap: 8px; }
                .header-actions { display: flex; gap: 8px; }
                .btn-icon-header { background: rgba(255,255,255,0.2); border: none; color: white; width: 28px; height: 28px; border-radius: 50%; cursor: pointer; display: flex; align-items: center; justify-content: center; transition: 0.2s; font-size: 14px; }
                .btn-icon-header:hover { background: rgba(255,255,255,0.4); transform: scale(1.1); }
                
                .car-body { flex: 1; display: flex; flex-direction: column; padding: 15px; gap: 10px; overflow: hidden; background: var(--bg-panel); border-radius: 0 0 15px 15px; }
                
                .info-box { display: none; background: var(--box-bg); border: 1px solid var(--box-border); color: var(--box-text); padding: 12px; border-radius: 8px; font-size: 12px; margin-bottom: 5px; animation: fadeIn 0.3s; flex-shrink: 0; }
                @keyframes fadeIn { from { opacity: 0; transform: translateY(-5px); } to { opacity: 1; transform: translateY(0); } }
        
                .car-inputs { display: flex; gap: 8px; flex-shrink: 0; }
                .car-input { background: var(--bg-input); border: 1px solid var(--border-input); color: var(--text-main); padding: 10px; border-radius: 8px; font-size: 13px; outline: none; flex: 1; transition: 0.2s; }
                .car-input:focus { border-color: #3b82f6; box-shadow: 0 0 0 2px rgba(59, 130, 246, 0.2); }
                .input-key { flex: 0 0 30%; font-weight: bold; }
                
                .btn-save { background: var(--accent-grad); border: none; color: white; padding: 10px; border-radius: 8px; font-weight: 600; cursor: pointer; width: 100%; transition: 0.2s; flex-shrink: 0; }
                .btn-save:hover { filter: brightness(1.1); transform: translateY(-1px); }
                
                #car-list { flex: 1; overflow-y: auto; display: flex; flex-direction: column; gap: 8px; padding-right: 5px; margin-top: 5px; min-height: 100px; }
                .car-item { background: var(--bg-item); padding: 10px; border-radius: 8px; display: flex; justify-content: space-between; align-items: center; box-shadow: 0 2px 4px rgba(0,0,0,0.05); border-left: 3px solid transparent; border: 1px solid var(--border-input); transition: 0.2s; }
                .car-item:hover { border-left-color: #10b981; transform: translateX(2px); }
                
                .item-content { overflow: hidden; display:flex; gap:10px; align-items:center; }
                .item-key { font-weight: 800; color: #10b981; display: block; font-size: 13px; min-width: 50px;}
                .item-val { color: var(--text-sec); font-size: 12px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; display: block; max-width: 170px; }
                .item-actions button { background: none; border: none; cursor: pointer; font-size: 14px; opacity: 0.6; transition: 0.2s; padding: 4px; }
                .item-actions button:hover { opacity: 1; transform: scale(1.2); background: rgba(0,0,0,0.05); border-radius: 4px; }
        
                /* IMPORTADOR (Restaurado e Fixo) */
                .import-section { 
                    border-top: 1px solid var(--border-input); 
                    padding-top: 10px; 
                    margin-top: auto; /* Empurra para o fundo */
                    flex-shrink: 0; 
                }
                .toggle-import { 
                    font-size: 12px; color: var(--text-sec); text-align: center; cursor: pointer; 
                    padding: 8px; border-radius: 6px; transition: 0.2s; background: var(--bg-input); 
                    font-weight: 600; 
                }
                .toggle-import:hover { color: #10b981; background: var(--bg-item); border: 1px solid var(--border-input); }
                
                #import-area { display: none; flex-direction: column; gap: 8px; margin-top: 8px; }
                .area-bulk { 
                    width: 100%; height: 100px; background: var(--bg-input); color: var(--text-main); 
                    border: 1px solid var(--border-input); border-radius: 6px; padding: 8px; 
                    font-size: 11px; resize: none; font-family: monospace;
                }
                .btn-settings-action { width: 100%; padding: 8px; margin-top: 5px; border-radius: 6px; border: 1px solid var(--box-border); background: var(--bg-item); cursor: pointer; color: var(--text-main); display: flex; align-items: center; justify-content: center; gap: 8px; transition: 0.2s; }
                .btn-settings-action:hover { background: var(--box-bg); }
        
                #car-panel ::-webkit-scrollbar { width: 5px; }
                #car-panel ::-webkit-scrollbar-thumb { background: #ccc; border-radius: 10px; }
            `;

            function createUI() {
                if (window.self !== window.top || document.getElementById('car-panel')) return;

                const styleSheet = document.createElement("style");
                styleSheet.innerText = styles;
                document.head.appendChild(styleSheet);

                const container = document.createElement('div');
                container.id = 'car-panel';
                if (isDark) container.classList.add('dark-mode');

                container.innerHTML = `
                    <div class="car-header">
                        <div class="car-title"><span style="font-size:18px">💻</span> CAR Automação</div>
                        <div class="header-actions">
                            <button id="car-theme-btn" class="btn-icon-header" title="Alternar Tema">🌓</button>
                            <button id="car-settings-btn" class="btn-icon-header" title="Backup e Restaurar">⚙️</button>
                            <button id="car-help-btn" class="btn-icon-header" title="Ajuda">?</button>
                            <button id="car-close-btn" class="btn-icon-header" title="Fechar">✖</button>
                        </div>
                    </div>
                    <div class="car-body">
                        
                        <div id="car-settings-box" class="info-box">
                            <strong style="display:block; margin-bottom:5px; border-bottom:1px solid var(--box-border); padding-bottom:3px;">Gerenciar Backup</strong>
                            <button id="car-btn-export" class="btn-settings-action">⬇️ Exportar JSON</button>
                            <button id="car-btn-restore" class="btn-settings-action">⬆️ Importar JSON</button>
                            <input type="file" id="car-file-restore" style="display:none" accept=".json">
                        </div>
        
                        <div id="car-help-box" class="info-box">
                            <strong style="display:block; margin-bottom:5px; border-bottom:1px solid var(--box-border); padding-bottom:3px;">Como usar:</strong>
                            1. Digite o atalho no chat (ex: <b>ex1</b>)<br>
                            2. Aperte a tecla <b>ESPAÇO</b>.<br>
                            3. O texto será substituído magicamente! ✨
                        </div>
        
                        <div class="car-inputs">
                            <input id="car-new-key" class="car-input input-key" type="text" placeholder="Atalho">
                            <input id="car-new-val" class="car-input" type="text" placeholder="Texto da mensagem...">
                        </div>
                        <button id="car-btn-add" class="btn-save">💾 Salvar Comando</button>
        
                        <div id="car-list"></div>
        
                        <div class="import-section">
                            <div class="toggle-import" id="car-toggle-imp">📥 Importar Lista em Massa (Texto) ▼</div>
                            <div id="import-area">
                                <textarea id="car-bulk-text" class="area-bulk" placeholder="atalho texto da mensagem... (uma por linha)&#10;ex1 Olá Cliente&#10;ex2 Tudo bem?"></textarea>
                                <button id="car-btn-bulk" class="btn-save" style="font-size:12px; padding:6px;">Processar Lista</button>
                            </div>
                        </div>
                    </div>
                `;
                document.body.appendChild(container);

                // Drag Logic
                const header = container.querySelector('.car-header');
                let isDragging = false, startX, startY, initialLeft, initialTop;
                header.onmousedown = (e) => {
                    if (e.target.tagName === 'BUTTON') return;
                    e.preventDefault(); isDragging = true;
                    startX = e.clientX; startY = e.clientY;
                    const rect = container.getBoundingClientRect();
                    initialLeft = rect.left; initialTop = rect.top;
                    container.style.bottom = 'auto'; container.style.right = 'auto';
                    container.style.left = initialLeft + 'px'; container.style.top = initialTop + 'px';
                    document.onmousemove = (ev) => {
                        if (!isDragging) return;
                        container.style.left = (initialLeft + ev.clientX - startX) + 'px';
                        container.style.top = (initialTop + ev.clientY - startY) + 'px';
                    };
                    document.onmouseup = () => { isDragging = false; document.onmousemove = null; };
                };

                setupEvents(container);
                updateVisualList();
            }

            function setupEvents(container) {
                const listContainer = container.querySelector('#car-list');
                const inpKey = container.querySelector('#car-new-key');
                const inpVal = container.querySelector('#car-new-val');
                const settingsBox = container.querySelector('#car-settings-box');
                const helpBox = container.querySelector('#car-help-box');
                const importArea = container.querySelector('#import-area');

                // Tema
                container.querySelector('#car-theme-btn').onclick = () => {
                    isDark = !isDark;
                    if (isDark) container.classList.add('dark-mode'); else container.classList.remove('dark-mode');
                    Storage.set({ theme: isDark ? 'dark' : 'light' });
                };

                // Toggles
                container.querySelector('#car-help-btn').onclick = () => {
                    settingsBox.style.display = 'none';
                    helpBox.style.display = (helpBox.style.display === 'block') ? 'none' : 'block';
                };
                container.querySelector('#car-settings-btn').onclick = () => {
                    helpBox.style.display = 'none';
                    settingsBox.style.display = (settingsBox.style.display === 'block') ? 'none' : 'block';
                };
                container.querySelector('#car-close-btn').onclick = () => {
                    container.style.display = 'none';
                    if (window.spellCheckerModule) window.spellCheckerModule.ocultarTudo();
                };

                // --- LÓGICA DO IMPORTADOR EM MASSA ---
                container.querySelector('#car-toggle-imp').onclick = () => {
                    const isHidden = (importArea.style.display === 'none' || importArea.style.display === '');
                    importArea.style.display = isHidden ? 'flex' : 'none';
                    // Rola para baixo se abrir
                    if (isHidden) {
                        setTimeout(() => {
                            const body = container.querySelector('.car-body');
                            body.scrollTop = body.scrollHeight;
                        }, 100);
                    }
                };

                container.querySelector('#car-btn-bulk').onclick = () => {
                    const text = container.querySelector('#car-bulk-text').value;
                    if (!text.trim()) return alert("Cole a lista primeiro!");

                    const lines = text.split('\n');
                    let count = 0;

                    lines.forEach(l => {
                        l = l.trim();
                        if (!l) return;

                        // Tenta separar pelo separador '➡' ou pelo primeiro espaço
                        let k = '', v = '';
                        if (l.includes('➡')) {
                            const parts = l.split('➡');
                            k = parts[0].trim();
                            v = parts.slice(1).join('➡').trim();
                        } else {
                            const firstSpace = l.indexOf(' ');
                            if (firstSpace > 0) {
                                k = l.substring(0, firstSpace).trim();
                                v = l.substring(firstSpace).trim();
                            }
                        }

                        if (k && v) {
                            scripts[k] = v;
                            count++;
                        }
                    });

                    Storage.set({ scripts: scripts });
                    updateVisualList();
                    alert(`✅ ${count} comandos importados com sucesso!`);
                    container.querySelector('#car-bulk-text').value = '';
                    importArea.style.display = 'none'; // Fecha após importar
                };

                // Salvar Novo
                container.querySelector('#car-btn-add').onclick = () => {
                    const k = inpKey.value.trim(); const v = inpVal.value.trim();
                    if (k && v) {
                        scripts[k] = v;
                        Storage.set({ scripts: scripts });
                        inpKey.value = ''; inpVal.value = '';
                        updateVisualList();
                    }
                };

                // Exportar JSON
                container.querySelector('#car-btn-export').onclick = () => {
                    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(scripts, null, 2));
                    const a = document.createElement('a'); a.href = dataStr; a.download = "car_backup.json";
                    document.body.appendChild(a); a.click(); a.remove();
                };

                // Importar JSON
                const fileInput = container.querySelector('#car-file-restore');
                container.querySelector('#car-btn-restore').onclick = () => fileInput.click();
                fileInput.onchange = (e) => {
                    const file = e.target.files[0]; if (!file) return;
                    const reader = new FileReader();
                    reader.onload = (ev) => {
                        try {
                            const imported = JSON.parse(ev.target.result);
                            scripts = { ...scripts, ...imported };
                            Storage.set({ scripts: scripts });
                            updateVisualList();
                            alert('✅ Backup restaurado e mesclado!'); settingsBox.style.display = 'none';
                        } catch (err) { alert('❌ Arquivo inválido.'); }
                    };
                    reader.readAsText(file); fileInput.value = '';
                };

                // Atualizar Lista Visual
                window.updateVisualList = () => {
                    listContainer.innerHTML = '';
                    const keys = Object.keys(scripts).sort();
                    if (keys.length === 0) listContainer.innerHTML = '<div style="text-align:center; color:var(--text-sec); padding:20px;">Nenhum comando salvo.</div>';

                    keys.forEach(key => {
                        const item = document.createElement('div'); item.className = 'car-item';
                        item.innerHTML = `
                            <div class="item-content"><span class="item-key">${key}</span><span class="item-val" title="${scripts[key]}">${scripts[key]}</span></div>
                            <div class="item-actions"><button class="btn-edit" title="Editar">✏️</button><button class="btn-del" title="Excluir">🗑️</button></div>
                        `;
                        item.querySelector('.btn-edit').onclick = () => { inpKey.value = key; inpVal.value = scripts[key]; inpVal.focus(); };
                        item.querySelector('.btn-del').onclick = () => {
                            if (confirm(`Apagar atalho "${key}"?`)) {
                                delete scripts[key];
                                Storage.set({ scripts: scripts });
                                updateVisualList();
                            }
                        };
                        listContainer.appendChild(item);
                    });
                };
            }

            // --- MOTOR DE SUBSTITUIÇÃO ---
            function replaceText(element, trigger, fullText) {
                try {
                    element.focus();
                    for (let i = 0; i <= trigger.length; i++) document.execCommand('delete', false, null);
                    document.execCommand('insertText', false, fullText);
                } catch (e) { console.error("[CAR] Erro ao substituir:", e); }
            }

            document.addEventListener('keyup', (e) => {
                if (e.key === ' ' || e.code === 'Space' || e.keyCode === 32) {
                    const active = document.activeElement;
                    if (active && (active.tagName === 'INPUT' || active.tagName === 'TEXTAREA' || active.isContentEditable)) {
                        Storage.get((data) => {
                            scripts = data.scripts;
                            let text = active.value || active.innerText || active.textContent;
                            if (!text) return;
                            text = text.replace(/[\u00a0\u200b]/g, ' ');
                            const words = text.trimEnd().split(' ');
                            const lastWord = words[words.length - 1];
                            if (scripts[lastWord]) {
                                e.preventDefault(); e.stopPropagation();
                                replaceText(active, lastWord, scripts[lastWord]);
                            }
                        });
                    }
                }
            }, true);

            window.toggleCAR = function () {
                createUI();
                const p = document.getElementById('car-panel');
                if (p) {
                    p.style.display = (p.style.display === 'none' || p.style.display === '') ? 'flex' : 'none';
                    if (p.style.display === 'flex') window.updateVisualList();
                }
            };

            loadData();
            console.log("[CAR v3.1] Módulo Híbrido Carregado.");
        })();

    } catch (e) { console.error('[BUILDER] Erro fatal no módulo car.js:', e); }

    /* --- MÓDULO ANEXADO: IA.JS --- */
    try {
        // ==UserScript==
        // @name         PureCloud - Aja Assistente (v24.4 - Anti-Autofill Radical)
        // @description  Assistente Aja com proteção máxima contra gerenciadores de senha.
        // @author       Josias Queiroz - Kingoffjoss Assessoria
        // @version      24.4
        // @match        *://*/*
        // @grant        none
        // ==/UserScript==

        (function () {
            'use strict';

            // --- 1. CONFIGURAÇÃO E STORAGE ---
            const APP_PREFIX = "IA_V24_AJA_";

            const store = {
                get: (keys, cb) => {
                    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
                        chrome.storage.local.get(keys, cb);
                    } else {
                        let res = {};
                        keys.forEach(k => {
                            const val = localStorage.getItem(APP_PREFIX + k);
                            if (val) { try { res[k] = JSON.parse(val); } catch (e) { res[k] = val; } }
                        });
                        cb(res);
                    }
                },
                set: (obj, cb) => {
                    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
                        chrome.storage.local.set(obj, cb);
                    } else {
                        Object.keys(obj).forEach(k => localStorage.setItem(APP_PREFIX + k, JSON.stringify(obj[k])));
                        if (cb) cb();
                    }
                },
                remove: (keys, cb) => {
                    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
                        chrome.storage.local.remove(keys, cb);
                    } else {
                        keys.forEach(k => localStorage.removeItem(APP_PREFIX + k));
                        if (cb) cb();
                    }
                }
            };

            store.get(['MOD_IA'], function (result) {
                if (result.MOD_IA === false || window.self !== window.top) return;
                initIA();
            });

            function initIA() {
                console.log("[Aja] Assistente v24.4 (Blindada) Iniciada...");

                // --- VARIÁVEIS ---
                let currentModel = "gemini-1.5-flash";
                let userApiKey = '';
                let agentName = 'Atendente';
                let chatHistoryContext = [];

                function getBrazilGreeting() {
                    const h = new Date().getHours();
                    if (h >= 5 && h < 12) return "Bom dia";
                    if (h >= 12 && h < 18) return "Boa tarde";
                    return "Boa noite";
                }

                // --- 2. CSS ---
                const css = `
            #gemini-wrapper {
                --purecloud-script-header-bg: #8b5cf6; /* Identidade Aja (Roxo Claro) */
                --purecloud-script-header-text: #ffffff;
                --purecloud-script-accent-color: #8b5cf6;
                --ia-bg: var(--purecloud-script-bg-primary);
                --ia-card: var(--purecloud-script-bg-secondary); 
                --ia-border: var(--purecloud-script-border-color); 
                --ia-text: var(--purecloud-script-text-primary); 
                --ia-text-muted: var(--purecloud-script-text-secondary);
                --ia-input: var(--purecloud-script-bg-primary); 
                --ia-primary: var(--purecloud-script-accent-color); 
                --ia-primary-hover: var(--purecloud-script-accent-color);
                --ia-danger: var(--purecloud-script-error-color); 
                --ia-success: var(--purecloud-script-success-color);
                --ia-shadow: 0 8px 30px var(--purecloud-script-shadow-color);
                --ia-radius: 8px;
                font-family: 'Segoe UI', Roboto, sans-serif;
                box-sizing: border-box; font-size: 14px;
            }
            #gemini-wrapper.cc-escurinho {
                --ia-bg: #0f172a; --ia-card: #1e293b; --ia-border: #334155; --ia-text: #f8fafc; --ia-text-muted: #94a3b8; --ia-input: #0f172a;
            }
            #gemini-wrapper.local-light-mode {
                --ia-bg: #f8fafc; --ia-card: #f1f5f9; --ia-border: #e2e8f0; --ia-text: #0f172a; --ia-text-muted: #475569; --ia-input: #f8fafc;
            }
            #gemini-wrapper * { box-sizing: border-box; transition: background-color 0.2s, color 0.2s; }

            /* Botão Flutuante */
            #gemini-float-btn {
                position: fixed; bottom: 85px; right: 25px; width: 56px; height: 56px; 
                background: linear-gradient(135deg, var(--purecloud-script-header-bg), var(--purecloud-script-accent-color)); 
                color: white; border-radius: 50%; border: none; 
                box-shadow: 0 4px 15px rgba(139, 92, 246, 0.4); 
                cursor: pointer; font-size: 24px; z-index: 999999;
                display: flex; align-items: center; justify-content: center;
                transition: transform 0.2s;
            }
            #gemini-float-btn:hover { transform: scale(1.1); }

            /* Modal */
            #gemini-modal {
                display: none; position: fixed; z-index: 999999;
                width: 400px; height: 650px; 
                left: auto; top: 80px; transform: none; max-height: 90vh;
                background-color: var(--ia-bg); color: var(--ia-text);
                border-radius: var(--ia-radius); border: 1px solid var(--ia-border);
                box-shadow: var(--ia-shadow);
                flex-direction: column; overflow: hidden;
            }

            /* Header */
            .gemini-header { 
                padding: 14px 16px; border-bottom: 1px solid var(--ia-border); 
                display: flex; justify-content: space-between; align-items: center; 
                cursor: move; user-select: none; background: var(--purecloud-script-header-bg); color: var(--purecloud-script-header-text);
            }
            .gemini-header:active { cursor: grabbing; }
            .gemini-header h3 { margin: 0; font-size: 15px; font-weight: 600; display:flex; gap:8px; align-items:center; color: var(--purecloud-script-header-text); }
            .gh-actions { display: flex; gap: 6px; align-items: center; }
            .icon-btn { 
                background: transparent; border: 1px solid transparent; cursor: pointer; font-size: 15px; 
                color: var(--purecloud-script-header-text); padding: 5px; border-radius: 6px; 
                display: flex; align-items: center; justify-content: center;
                transition: all 0.2s;
            }
            .icon-btn:hover { color: #fff; background: rgba(255,255,255,0.15); border-color: rgba(255,255,255,0.2); }

            /* Abas */
            .nav-tabs { display: flex; border-bottom: 1px solid var(--ia-border); background: rgba(0,0,0,0.02); }
            .nav-tab { flex: 1; padding: 12px; text-align: center; cursor: pointer; font-size: 13px; font-weight: 500; color: var(--ia-text-muted); border-bottom: 2px solid transparent; }
            .nav-tab:hover { color: var(--ia-text); background: rgba(255,255,255,0.03); }
            .nav-tab.active { color: var(--ia-primary); border-bottom-color: var(--ia-primary); font-weight: 600; }

            /* Screens */
            .screen { padding: 20px; display: none; flex-direction: column; flex: 1; overflow-y: auto; }
            .screen.active { display: flex; }

            /* Inputs - CORREÇÃO DE ESTILO PARA TYPE=SEARCH */
            .gemini-input { width: 100%; padding: 12px; margin-bottom: 12px; border-radius: 8px; border: 1px solid var(--ia-border); background: var(--ia-input); color: var(--ia-text); font-size: 13px; font-family: inherit; resize: none; outline:none;}
            .gemini-input:focus { border-color: var(--ia-primary); box-shadow: 0 0 0 2px rgba(139, 92, 246, 0.2); }
            
            /* Remove o 'x' nativo do input type search */
            .gemini-input[type="search"]::-webkit-search-decoration,
            .gemini-input[type="search"]::-webkit-search-cancel-button,
            .gemini-input[type="search"]::-webkit-search-results-button,
            .gemini-input[type="search"]::-webkit-search-results-decoration { -webkit-appearance: none; }

            .gemini-label { font-size: 11px; font-weight: 700; color: var(--ia-text-muted); margin-bottom: 6px; display: block; text-transform: uppercase; letter-spacing: 0.5px; }

            /* Buttons */
            .gemini-btn { width: 100%; padding: 12px; border: none; border-radius: 8px; font-weight: 600; cursor: pointer; margin-top: 8px; display: flex; align-items: center; justify-content: center; gap: 8px; font-size: 13px; color: white; transition: filter 0.2s, transform 0.1s; }
            .gemini-btn:active { transform: scale(0.98); }
            .btn-primary { background: var(--ia-primary); }
            .btn-success { background: var(--ia-success); }
            .btn-danger { background: transparent; border: 1px solid var(--ia-danger); color: var(--ia-danger); }
            .btn-danger:hover { background: rgba(239, 68, 68, 0.1); }
            .btn-outline { background: transparent; border: 1px solid var(--ia-border); color: var(--ia-text); }

            /* Result */
            #gemini-result { margin-top: 15px; padding: 15px; background: var(--ia-card); border: 1px solid var(--ia-border); border-left: 4px solid var(--ia-primary); border-radius: 8px; font-size: 13px; line-height: 1.6; display:none; white-space: pre-wrap; word-wrap: break-word; }
            #gemini-result strong { color: var(--ia-primary); font-weight: 700; }
            
            /* History & Chat Styles */
            .history-item { background: var(--ia-card); border: 1px solid var(--ia-border); border-radius: 8px; padding: 12px; margin-bottom: 10px; }
            .history-meta { display: flex; justify-content: space-between; font-size: 11px; color: var(--ia-text-muted); margin-bottom: 6px; border-bottom: 1px dashed var(--ia-border); padding-bottom: 4px; }
            .history-preview { font-size: 12px; color: var(--ia-text); display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; margin-bottom: 8px; }
            .h-actions { display: flex; gap: 5px; justify-content: flex-end; }
            .h-btn { padding: 4px 10px; font-size: 11px; border-radius: 4px; cursor: pointer; border: none; }
            .chat-bubble { max-width: 85%; padding: 10px 14px; border-radius: 12px; font-size: 13px; line-height: 1.4; margin-bottom: 10px; }
            .chat-user { align-self: flex-end; background-color: var(--ia-primary); color: white; }
            .chat-ai { align-self: flex-start; background-color: var(--ia-card); border: 1px solid var(--ia-border); }
        `;

                const style = document.createElement('style'); style.textContent = css; document.head.appendChild(style);

                // --- 3. HTML (Com Blindagem Anti-Autofill) ---
                const widgetHTML = `
          <style>
            :root {
                --ia-bg: #ffffff;
                --ia-surface: #f8fafc;
                --ia-border: #e2e8f0;
                --ia-text: #1e293b;
                --ia-text-muted: #64748b;
                --ia-primary: #8b5cf6;
                --ia-primary-hover: #7c3aed;
                --ia-shadow: 0 10px 25px -5px rgba(0,0,0,0.1), 0 8px 10px -6px rgba(0,0,0,0.1);
            }
            .cc-escurinho {
                --ia-bg: #0f172a;
                --ia-surface: #1e293b;
                --ia-border: #334155;
                --ia-text: #f8fafc;
                --ia-text-muted: #94a3b8;
                --ia-shadow: 0 10px 25px -5px rgba(0,0,0,0.5), 0 8px 10px -6px rgba(0,0,0,0.5);
            }
            #gemini-wrapper { font-family: 'Inter', -apple-system, sans-serif; }
            .gemini-btn {
                padding: 10px 14px;
                border: none; border-radius: 8px; font-size: 13px; font-weight: 600; cursor: pointer;
                transition: all 0.2s ease; display: inline-flex; align-items: center; justify-content: center; gap: 6px;
            }
            .gemini-btn:disabled { opacity: 0.6; cursor: not-allowed; }
            .btn-primary { background: var(--ia-primary); color: white; }
            .btn-primary:hover:not(:disabled) { background: var(--ia-primary-hover); transform: translateY(-1px); }
            .btn-outline { background: transparent; border: 1px solid var(--ia-border); color: var(--ia-text); }
            .btn-outline:hover { background: var(--ia-surface); }
            .btn-danger { background: #ef4444; color: white; width: 100%; margin-top: 10px; }
            .btn-danger:hover { background: #dc2626; }
            .btn-action { background: var(--ia-surface); color: var(--ia-text); flex: 1; padding: 12px; }
            .btn-action:hover { background: var(--ia-border); }

            .gemini-input {
                width: 100%; box-sizing: border-box; padding: 10px 12px;
                border: 1px solid var(--ia-border); border-radius: 8px;
                background: var(--ia-surface); color: var(--ia-text); font-size: 13px; margin-bottom: 12px;
                outline: none; transition: border-color 0.2s;
            }
            .gemini-input:focus { border-color: var(--ia-primary); box-shadow: 0 0 0 2px rgba(139, 92, 246, 0.2); }
            
            textarea.gemini-input { resize: vertical; min-height: 80px; font-family: inherit; }

            .chat-bubble { max-width: 85%; padding: 10px 14px; border-radius: 12px; font-size: 13px; line-height: 1.5; margin-bottom: 10px; }
            .chat-user { background: var(--ia-primary); color: white; align-self: flex-end; border-bottom-right-radius: 2px; }
            .chat-ai { background: var(--ia-surface); color: var(--ia-text); border: 1px solid var(--ia-border); align-self: flex-start; border-bottom-left-radius: 2px; }
            .chat-ai p { margin: 0 0 8px 0; }
            .chat-ai p:last-child { margin: 0; }
            
            .screen { display: none; flex-direction: column; flex: 1; min-height: 0; }
            .screen.active { display: flex; }

            .nav-tabs { display: flex; border-bottom: 1px solid var(--ia-border); margin-bottom: 15px; }
            .nav-tab {
                flex: 1; padding: 10px 0; background: none; border: none; border-bottom: 2px solid transparent;
                color: var(--ia-text-muted); font-size: 13px; font-weight: 600; cursor: pointer; transition: all 0.2s;
            }
            .nav-tab:hover { color: var(--ia-text); }
            .nav-tab.active { color: var(--ia-primary); border-bottom-color: var(--ia-primary); }

            .history-item { document.createElement('div'); } /* fallback */
            .history-item { background: var(--ia-surface); border: 1px solid var(--ia-border); padding: 10px; border-radius: 8px; margin-bottom: 8px; font-size: 12px; color: var(--ia-text); }
            .history-meta { display: flex; justify-content: space-between; color: var(--ia-text-muted); font-size: 11px; margin-bottom: 4px; }
            .history-preview { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; margin-bottom: 8px; font-weight: 500;}
            .h-actions { display: flex; gap: 6px; }
            .h-btn { flex:1; padding:6px; font-size:11px; border-radius:4px; border:none; cursor:pointer; font-weight:600; }
            
            #gemini-result {
                background: var(--ia-surface); border: 1px solid var(--ia-border);
                border-radius: 8px; padding: 14px; font-size: 13px; color: var(--ia-text);
                line-height: 1.6; max-height: 250px; overflow-y: auto; display: none;
            }
            #gemini-result p { margin: 0 0 10px 0; }
            #gemini-result p:last-child { margin: 0; }
            #gemini-result strong { color: var(--ia-primary); }
            
            .gemini-label { display: block; font-size: 12px; font-weight: 600; color: var(--ia-text-muted); margin-bottom: 4px;}
            
            ::-webkit-scrollbar { width: 6px; }
            ::-webkit-scrollbar-track { background: transparent; }
            ::-webkit-scrollbar-thumb { background: var(--ia-border); border-radius: 3px; }
            ::-webkit-scrollbar-thumb:hover { background: var(--ia-text-muted); }
          </style>

          <div id="gemini-wrapper" class="local-light-mode">
            <button id="gemini-float-btn" class="purecloud-script-button" style="position:fixed; bottom:20px; right:20px; width:56px; height:56px; border-radius:50%; background:linear-gradient(135deg, #8b5cf6, #d946ef); color:white; border:none; box-shadow:0 4px 15px rgba(139,92,246,0.4); cursor:pointer; z-index:999999; display:flex; align-items:center; justify-content:center; hover{transform:scale(1.05)} transition:0.2s;">
              <svg viewBox="0 0 24 24" width="28" height="28" stroke="currentColor" stroke-width="2" fill="none"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path><polyline points="3.27 6.96 12 12.01 20.73 6.96"></polyline><line x1="12" y1="22.08" x2="12" y2="12"></line></svg>
            </button>

            <div id="gemini-modal" style="display:none; position:fixed; top:80px; right:30px; width:360px; height:600px; background:var(--ia-bg); box-shadow:var(--ia-shadow); border-radius:16px; border:1px solid var(--ia-border); z-index:1000000; flex-direction:column; overflow:hidden;">
              <div id="gemini-drag-handle" style="padding:16px; background:var(--ia-surface); border-bottom:1px solid var(--ia-border); display:flex; justify-content:space-between; align-items:center; cursor:move;">
                 <div style="display:flex; align-items:center; gap:8px;">
                    <div style="width:28px; height:28px; border-radius:8px; background:linear-gradient(135deg, #8b5cf6, #d946ef); display:flex; align-items:center; justify-content:center; color:white;">
                       <svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" stroke-width="2" fill="none"><path d="M12 2a10 10 0 1 0 10 10H12V2z"></path><path d="M12 12 2.1 12"></path><path d="M12 12 21.9 12"></path></svg>
                    </div>
                    <div>
                        <div style="font-weight:700; font-size:14px; color:var(--ia-text);">Aja Assistant</div>
                        <div style="font-size:10px; color:var(--ia-text-muted);">by Genesys Pro</div>
                    </div>
                 </div>
                 <div style="display:flex; gap:8px;">
                     <button id="btn-theme" class="purecloud-script-button" style="background:none; border:none; cursor:pointer; font-size:16px;" title="Mudar Tema">🌗</button>
                     <button id="btn-close" class="purecloud-script-button" style="background:none; border:none; color:var(--ia-text-muted); cursor:pointer; padding:4px;">
                        <svg viewBox="0 0 24 24" width="20" height="20" stroke="currentColor" stroke-width="2" fill="none"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                     </button>
                 </div>
              </div>

              <div id="ia-nav-tabs" class="nav-tabs" style="padding:0 16px; background:var(--ia-surface); display:none;">
                 <button class="nav-tab purecloud-script-button active" data-target="report">Relatório</button>
                 <button class="nav-tab purecloud-script-button" data-target="chat">Chat</button>
                 <button class="nav-tab purecloud-script-button" data-target="history">Histórico</button>
                 <button class="nav-tab purecloud-script-button" data-target="config" style="flex:0.3;">⚙️</button>
              </div>

              <!-- TELAS -->
              <div style="flex:1; display:flex; flex-direction:column; padding:16px; overflow-y:auto;">
                 
                 <div id="screen-login" class="screen active" style="justify-content:center; align-items:center; text-align:center; padding-bottom:40px;">
                    <div style="width:64px; height:64px; border-radius:16px; background:linear-gradient(135deg, #8b5cf6, #d946ef); display:flex; align-items:center; justify-content:center; color:white; margin:0 auto 20px auto; box-shadow:0 8px 20px rgba(139,92,246,0.3);">
                       <svg viewBox="0 0 24 24" width="32" height="32" stroke="currentColor" stroke-width="2" fill="none"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path></svg>
                    </div>
                    <h3 style="margin:0 0 8px 0; color:var(--ia-text); font-size:20px;">Bem-vindo à Aja</h3>
                    <p style="color:var(--ia-text-muted); font-size:13px; margin:0 0 24px 0; line-height:1.5;">Configure sua chave da API Google Gemini para ativar todos os recursos.</p>
                    
                    <div style="text-align:left; width:100%;">
                        <span class="gemini-label">Nome do Agente</span>
                        <input type="text" id="input-setup-name" class="gemini-input" placeholder="Ex: Josias">
                        
                        <div style="display:flex; justify-content:space-between; margin-bottom:4px;">
                            <span class="gemini-label" style="margin:0;">Sua API Key Gemini</span>
                            <a href="https://aistudio.google.com/app/apikey" target="_blank" style="font-size:11px; color:var(--ia-primary); text-decoration:none;">Obter Chave</a>
                        </div>
                        <input type="text" id="input-setup-key" class="gemini-input" placeholder="AIzaSy..." autocomplete="off" style="-webkit-text-security: disc;">
                        <button id="btn-login" class="gemini-btn btn-primary purecloud-script-button" style="width:100%; padding:12px; margin-top:10px;">Ativar Assistente</button>
                    </div>
                 </div>

                 <div id="screen-report" class="screen">
                    <div id="logged-in-tools" style="display:none; flex-direction:column; flex:1;">
                        
                        <div style="display:flex; justify-content:space-between; align-items:flex-end; margin-bottom:4px;">
                            <span class="gemini-label" style="margin:0;">O que aconteceu no atendimento?</span>
                            <button id="btn-clear-report-top" style="background:none; border:none; color:var(--ia-text-muted); cursor:pointer; font-size:11px;">Limpar Texto</button>
                        </div>
                        <textarea id="input-report" class="gemini-input" rows="4" placeholder="Ex: Cliente está sem acesso..."></textarea>
                        
                        <div id="result-actions-top" style="display:none; gap:10px; margin-bottom:12px;">
                             <button id="btn-copy-result-top" class="gemini-btn btn-primary purecloud-script-button" style="flex:1;">📋 Copiar Relatório</button>
                             <button id="btn-wipe-result-top" class="gemini-btn btn-outline purecloud-script-button" style="flex:1;">Limpar IA</button>
                        </div>

                        <button id="btn-gen-report" class="gemini-btn btn-primary purecloud-script-button" style="width:100%; padding:14px; font-size:14px;">⚡ Gerar Relatório</button>
                        
                        <div id="ia-tabulacao-box" style="display:none; margin-top:10px; padding:12px; border-radius:8px; border: 1px dashed var(--ia-primary); background: rgba(139, 92, 246, 0.05); user-select:none;">
                            <div style="font-size:11px; font-weight:700; color:var(--ia-primary); text-transform:uppercase; margin-bottom:4px; display:flex; gap:6px; align-items:center;">
                                <svg viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" stroke-width="2" fill="none"><path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"></path><line x1="7" y1="7" x2="7.01" y2="7"></line></svg>
                                Tabulação Sugerida
                            </div>
                            <div id="ia-tabulacao-text" style="font-size:13px; font-weight:600; color:var(--ia-text);"></div>
                        </div>

                        <div id="gemini-result" style="margin-top:10px;"></div>

                        <div id="result-actions" style="display:none; gap:10px; margin-top:12px;">
                             <button id="btn-copy-result" class="gemini-btn btn-primary purecloud-script-button" style="flex:1;">📋 Copiar Relatório</button>
                             <button id="btn-wipe-result" class="gemini-btn btn-outline purecloud-script-button" style="flex:1;">Limpar</button>
                        </div>
                    </div>
                 </div>

              <div id="screen-history" class="screen">
                 <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:15px;">
                     <h4 style="margin:0; color:var(--ia-text);">Seus Relatórios Salvos</h4>
                     <button id="btn-wipe-history" style="background:none; border:none; color:#ef4444; font-size:11px; cursor:pointer; font-weight:600;">Apagar Tudo</button>
                 </div>
                 <div id="history-list" style="flex:1; overflow-y:auto; display:flex; flex-direction:column;"></div>
                 <button id="btn-back-report-h" class="gemini-btn btn-outline purecloud-script-button" style="width:100%; margin-top:15px;">Voltar</button>
              </div>

              <div id="screen-chat" class="screen">
                 <div id="chat-container" style="flex:1; overflow-y:auto; display:flex; flex-direction:column;">
                    <div id="chat-welcome-msg" class="chat-bubble chat-ai">...</div>
                 </div>
                 <div style="display:flex; gap:8px; margin-top:10px; border-top:1px solid var(--ia-border); padding-top:10px;">
                    <input type="search" id="input-chat" class="gemini-input" style="margin:0; border-radius:20px;" placeholder="Converse com a Aja..." autocomplete="off">
                    <button id="btn-send-chat" class="gemini-btn btn-primary purecloud-script-button" style="width:40px; margin:0; border-radius:50%;">➤</button>
                 </div>
                 <button id="btn-clear-chat" style="background:none; border:none; color:var(--ia-text-muted); font-size:11px; cursor:pointer; align-self:flex-end; margin-top:5px;">Limpar Chat</button>
              </div>

              <div id="screen-config" class="screen">
                  <h4 style="margin-top:0;">Configurações</h4>
                  <span class="gemini-label">Nome:</span>
                  <input type="search" id="cfg-name" class="gemini-input" autocomplete="off" name="aja_cfg_name">
                  <span class="gemini-label">API Key:</span>
                  <input type="search" id="cfg-key" class="gemini-input" autocomplete="off" name="aja_cfg_key" style="-webkit-text-security: disc;">
                  <button id="btn-save-cfg" class="gemini-btn btn-primary purecloud-script-button" style="width:100%; margin-top:10px;">Salvar Alterações</button>
                  
                  <div style="margin-top:auto; border-top:1px dashed var(--ia-border); padding-top:15px;">
                      <button id="btn-back-report-c" class="gemini-btn btn-outline purecloud-script-button" style="margin-bottom:10px;">Voltar</button>
                      <button id="btn-logout" class="gemini-btn btn-danger purecloud-script-button">Sair e Bloquear</button>
                  </div>
              </div>

            </div>
          </div>
        `;

                if (window.self === window.top) {
                    const container = document.createElement('div'); container.innerHTML = widgetHTML; document.body.appendChild(container);
                }

                // --- 4. REFERÊNCIAS ---
                const getEl = (id) => document.getElementById(id);
                const modal = getEl('gemini-modal');
                const wrapper = getEl('gemini-wrapper');

                // --- 5. LÓGICA API ---
                async function findBestFreeModel(apiKey) {
                    try {
                        const response = await safeFetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`);
                        const data = await response.json();
                        if (data.models) {
                            const all = data.models.map(m => m.name.replace("models/", ""));
                            let best = all.find(m => m === "gemini-1.5-flash-8b");
                            if (!best) best = all.find(m => m === "gemini-1.5-flash");
                            if (!best) best = all.find(m => m.includes("flash"));
                            return best || "gemini-1.5-flash";
                        }
                    } catch (e) { }
                    return "gemini-1.5-flash";
                }

                const TABS_DB = `
LOS - FTTH	Cabo fibra rompido, problema nos conectores de fibra, problema na ONU.
Pon apagada - FTTH	ONU com problema de atualização.
Pon piscando - FTTH	Comando no TL1, passou por cancelamento ou reativação, clientes retornando sinal para OLT, pós falta de energia, inversão de rota
Rota inoperante - FTTH	Rompimento por acidentes, incendios em postes afeta todos os clientes.
Roteador sem gerencia - FTTH	Cabo de rede mal conectado, conectado na porta incorreta, comando no TL1, conector RJ45 com problema.
ONU sem IP - FTTH	Problema na ONU, Comando no TL1,VLAN incorreta.
PPPoE desconectado - FTTH	Senha PPPoE incorreta, login de autenticação incorreto, IP FIXO duplicado, sem VLAN.
Manutenção na rede brisanet - FTTH	Troca e atualização de OLTs, switch, MPLS, CPD.
Sistema interno indisponível	Yoda Indisponível, impossibilitado de realizar comandos.
Chamado imoc	Setor de Manutenção de Fibra solicita que o Suporte Interno abra reparo para cabo drop.
Sem acesso site ou sistema especifico - FTTH	Aplicativos, sites, VPNs, bloqueios de portas.
Equipamento desligado da energia  - FTTH	Roteador, receptor, CPE desligada da energia elétrica.
Equipamento desligado no botao POWER - FTTH	Botão POWER desativado.
Sem conexao a dispositivo especifico - FTTH	3 celulares navegando e TV não está navegando.
Dispositivo Conectado, mas sem Internet - FTTH	Apresenta a mensagem de falha na conexão, ponto de exclamação.
Wi-Fi padrao de fabrica - resetado - FTTH	Exibe rede TP-LNK, Brisadefault ou marca do roteador.
Baixo Alcance Wi-Fi - FTTH	Posição do roteador ruim, Interferências de parede.
Lentidão geral em todos dispositivo - FTTH	Todos lentos independentemente da aplicação.
Lentidão em dispositivos específicos - FTTH	Apenas alguns dispositivos estão lentos.
Lentidão em site específicos - FTTH	Apenas alguns sites específicos estão lentos.
Instabilidade em IPTV - FTTH	Serviços de IPTV não homologados instaveis.
Sem acesso a serviço IPTV - FTTH	Serviços de IPTV não homologados sem acesso.
Rota com sinal irregular - FTTH	Sinal de toda a ROTA (todos os clientes) irregular.
Sinal da fibra do cliente irregular - FTTH	Sinal apenas da fibra do cliente irregular.
Quedas na conexão - FTTH	Downloads demoram, lentidão intermitente.
Plano não chega o contratado  - FTTH	Plano 100Mbps mas atinge apenas 50Mbps.
Instabilidade massiva na rede brisanet - FTTH	Afeta mais de um cliente (OLT, CIDADE, ESTADO) culpa brisanet.
Instabilidade massiva na rede externa - FTTH	Afeta mais de um cliente, culpa de terceiros (Amazon, Google).
Problema em jogos online - FTTH	Latência para servidor do jogo, perca de pacote.
Agendamento de retorno	Cliente solicitar retorno em horário.
Ligação sem contato	Operador tentou retorno e não conseguiu.
Cliente desistiu da visita técnica	Problema resolvido remotamente, cancelou tecnico.
Ligação caiu	Ligação caiu antes de concluir.
Solicitação de atendimento voz/texto	Gravações de ligações e chat.
Solicitação de declaração	Declaração de instabilidade massiva.
Ligações escritório	Ligações do escritório para duvidas.
Atendimento encerrado por falta de cordialidade	Assédio, xingamentos do cliente.
Atendimento encerrado por falta de confirmação de dados	Cliente não confirma dados.
Transferencia para o Comercial	Deseja comprar plano.
Duvidas comercial	Dúvidas sobre planos sem transferir.
Transferencia para o Cobranca	Problemas de faturas.
Duvidas financeira	Dúvidas sobre fatura sem transferir.
Transferencia para o SAC	Problemas generalistas.
Duvidas sobre alteracao de endereco	Dúvidas de troca de endereco.
Duvidas sobre alteracao de titular	Dúvidas troca de titular.
Transferencia para o Retencao	Deseja cancelar a internet.
Duvidas sobre cancelamento	Dúvidas sobre multa de cancelamento.
Transferencia para o SAC 5G	Deseja suporte 5G.
Transferencia para o Suporte Corporativo B2B	Cliente CNPJ 0800 Varejo transfere B2B.
Transferencia para o Regional	Cliente transferido suporte regional.
Transferencia indevida para o suporte	Transferencia errada atendente.
Orientação sobre ocultar a rede wi-fi - FTTH	Quer ocultar rede wifi.
Transferencia para pausa	Operador transferiu o call pois vai pausar/descansar.
Orientação sobre como consultar a senha do wi-fi - FTTH	Quer ver a senha do wifi.
Orientação sobre rede unificada - FTTH	Dúvidas rede unificada TPLINK.
Informação sobre os canais de atendimento - FTTH	Quais canais empresa (whatsapp/0800).
Solicitação do número de IP - FTTH	Quer saber o numero IP.
Orientação de como contratar o IP FIXO - FTTH	Quer contratar IP Fixo.
Solicitação para separar a rede wi-fi - FTTH	Quer separar os WiFis 2.4/5.0.
Solicitação do cliente para desabilitar o wi-fi - FTTH	Quer desligar WiFi.
Solicitação de acesso ao equipamento da brisanet - FTTH	Quer entrar no roteador via admin.
Informações sobre valores dos serviços avulso - FTTH	Taxas de serviços.
Cliente com inadimplencia financeira - bloqueado - FTTH	Cliente bloqueado por divida mas caiu no suporte tecnico.
Dúvidas sobre a função do WPS - FTTH	Duvidas botão WPS.
Bloqueio IP - VPN - FTTH	VPN bloqueando.
Alterar senha PPPoE - FTTH	Técnico contata mudar senha pppoe.
Alterar login PPPoE - FTTH	Técnico contata mudar login pppoe.
Atualização de contato	Mudar numero de celular do cadatro.
Alteração de ip fixo - FTTH	Mudar IP fixo.
Alteração da senha do Wi-Fi - FTTH	Mudar senha wifi remotamente.
Altreração do canal da rede Wi-Fi - FTTH	Mudar canal wifi (ex: do 6 para 11).
Alteração do modo da rede Wi-Fi - FTTH	Mudar padrao wifi B/G/N/AC/AX.
Altreração da largura de banda da rede Wi-Fi - FTTH	Mudar largura de banda (20/40/80mhz).
Personalizar o nome da rede Wi-Fi - FTTH	Mudar nome do wifi.
Troca de cabo de rede	Cabo RJ45 danificado.
Troca de cabo fibra - FTTH	Cabo DROP rompido na casa do cliente.
Troca de fonte - FTTH	Fonte queimada choque eletrico.
Troca de onu - FTTH	ONU queimou.
Cabo de fibra baixo/remanejamento - FTTH	Cabo pendurado no poste do cliente.
Recolher roteador - FTTH	Pegar Tplink do cliente de volta.
Troca de roteador  - FTTH	Tplink pifou.
Instalação de roteador - FTTH	Instalar um Tplink na onu do cliente.
Suspeita de equipamento danificado	Equipamento aparente quebrado fisico.
Suporte a equipamento particular	Conectar dvr, smart tv, camera IP do cliente.
Alteração de cômodo	Mudar internet de lugar na casa.
Configuração estruturada de rede interna	Cliente tem switch, roteadores cascateados.
Sobrança de instalação fora do prazo	Instalacao atrasou (cobranca).
Cobrança de instalação dentro do prazo	Instalacao normal (cobranca).
Cobrança de reparo dentro do prazo	Reparo normal (cobranca).
Cobrança de reparo fora do prazo	Reparo atrasado (cobranca).
Cobrança de retorno interno	Retorno (cobranca).
Conecta+	Demandasecta+.
Cobrança de alt. De endereço dentro do prazo	Mudanca endereco prazo.
Cobrança de alt. De endereço fora do prazo	Mudanca endereco atrasou.
Alteração de titularidade (dentro do prazo)	Titularidade prazo.
Alteração de titularidade (fora do prazo)	Titularidade atrasada.
Instalação inadequada (local) - 7d	Comodo errado do tecnico inferior a 7 dias.
Instalação mal sucedida (sem acesso) - 7d	Instalou e ficou sem internet -7dias.
Configuração de roteador não realizada na instalação - 7d	Tecnico não configurou roteador TPlink.
Cabo de rede não disponibilizado no ato da instalação - até 7d	Tecnico nao deixou o amarelo de rede.
Insatisfeito com o equipamento instalado - 7d	Reclama equipamento usado ou sujo.
Conecta+ (cabo não deixado no ato da inst.) - 7d	Conecta+ mas sem cabo.
Alteração de endereço mal sucedida	Mudou de lugar e ficou sem internet.
Cliente ja atendido	Descobriu que o problema ja foi solucionado hoje.
CPE sem sinal - FWA	CPE sem sinal.
Falta de energia na torre - FWA	Torre sem sinal.
Torre inoperante - FWA	Torre parada FWA.
Sem acesso site ou sistema especifico - FWA	Apps VPN FWA travando.
Atingiu a franquia - FWA	Bateu franquia 100% gigas FWA limitou a velocidade.
Troca de receptor - TV	TV receptor quebrado.
Troca de controle TV - TV	Controle remoto quebrou TV.
Troca de cabo HDMI/RCA - TV	Cabo HDMI/RCA ruim TV.
Tela azul Brisanet - TV	Travado logomarca azul TV.
Suporte a TV com tela preta - TV	Tela super preta do receptor TV.
Suporte a canal indisponivel - TV	Canal 40 fora do ar TV.
Suporte a Canais Quadriculando - TV	Canais imagem bugando congelando TV.
Receptor bloqueado - TV	Mensagem de inadimplencia TV.
Problema no audio - TV	TV mudo.
Erro de NTP - TV	Erro hora/data TV.
Canais bloqueados - TV	Autocensura bloqueado TV.
Alteracao de senha TV - TV	Mudar senha autocensura TV.
Brisaplay - erro de login	Login Brisaplay Usuario Invalido.
Brisaplay - canais bloqueados	Brisaplay Cadeado.
Brisaplay - canais com código de erro	Brisaplay Erro 2.
Brisaplay - canais com tela preta	Brisaplay tela infinita negra.
Troca de telefone - Telefonia	Aparelho Fixo quebrado.
Telefonia fixa com as ligacoes falhando - Telefonia	Cortando voz no fixo.
Telefonia desativada - Telefonia	Telefone cortado.
Telefonia com falha de autenticacao - Telefonia	Falha registrar Voip.
Telefonia bloqueada por limite - Telefonia	Acabou os minutos de ligações telefone Fixo.
Telefone mudo - Telefonia	Telefone sem tom de discagem 100% inoperavel.
Problema no PABX do cliente - Telefonia	PABX Empresarial com problemas internos.
Problema na portabilidade - Telefonia	Número portado nao veio pro chip brisanet fixo.
Operadoras - falha massiva para receber/efetuar - Telefonia	Não consegue ligar para ninguem de celular Tim, Vivo etc.
Nao efetua/recebe ligacoes para operadora/numero especifico - Telefonia	Mudo so pra 1 pessoa.
Mudanca de numero da telefonia fixa - Telefonia	Trocar o numero.
Suporte a aplicativos SVAs	Qualifica, Skeelo, Hero, Exa SVAs suporte app.
Brisacliente	Brisacliente fatura APP erro.
Netflix	Netflix nao quer ativar conta email falha.
Globoplay	Globo play app assistindo filmes com problema ativação.
Premiere	Premiere APP ativação.
Paramount+	Paramount filmes bug.
Docway	Telemedicina Docway erro app.
Telecine	Telecine filmes erros APP app.
`;

                async function generateText(prompt) {
                    let model = currentModel;
                    const url = (m) => `https://generativelanguage.googleapis.com/v1beta/models/${m}:generateContent?key=${userApiKey}`;
                    const body = { contents: [{ parts: [{ text: prompt }] }] };

                    try {
                        let response = await safeFetch(url(model), {
                            method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body)
                        });
                        let data = await response.json();

                        if (data.error) {
                            model = await findBestFreeModel(userApiKey);
                            response = await safeFetch(url(model), {
                                method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body)
                            });
                            data = await response.json();
                        }

                        if (data.error) throw new Error(data.error.message);
                        return data.candidates[0].content.parts[0].text;

                    } catch (e) { throw e; }
                }

                function formatMarkdown(text) {
                    if (!text) return '';
                    return escapeHTML(String(text))
                        .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
                        .replace(/\*(.*?)\*/g, '<em>$1</em>')
                        .replace(/`(.*?)`/g, '<code style="background:rgba(255,255,255,0.1); padding:2px; border-radius:3px;">$1</code>');
                }
                // --- CONTROLE DE ESTADO ---
                function loadState() {
                    store.get(['geminiKey', 'agentName', 'IA_THEME'], (res) => {

                        if (res.IA_THEME === 'light') {
                            wrapper.classList.add('local-light-mode');
                            wrapper.classList.remove('cc-escurinho');
                            getEl('btn-theme').innerText = '☀️';
                            getEl('btn-theme').title = 'Mudar para Tema Escuro';
                        } else if (res.IA_THEME === 'dark') {
                            wrapper.classList.add('cc-escurinho');
                            wrapper.classList.remove('local-light-mode');
                            getEl('btn-theme').innerText = '🌗';
                            getEl('btn-theme').title = 'Mudar para Tema Claro';
                        }

                        if (res.geminiKey) {
                            userApiKey = res.geminiKey;
                            agentName = res.agentName || "Atendente";

                            getEl('cfg-key').value = userApiKey;
                            getEl('cfg-name').value = agentName;
                            getEl('input-setup-name').value = agentName;

                            const greeting = getBrazilGreeting();
                            getEl('chat-welcome-msg').innerHTML = `${greeting} <b>${agentName}</b>!<br>Eu sou a <b>Aja</b>. Como posso ajudar?`;

                            getEl('logged-in-tools').style.display = 'flex';
                            getEl('ia-nav-tabs').style.display = 'flex';
                            switchScreen('report');
                        } else {
                            getEl('logged-in-tools').style.display = 'none';
                            getEl('ia-nav-tabs').style.display = 'none';
                            switchScreen('login');
                        }
                    });
                }

                function switchScreen(id) {
                    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
                    document.querySelectorAll('.nav-tab').forEach(t => t.classList.remove('active'));
                    getEl('screen-' + id).classList.add('active');
                    const tab = document.querySelector(`.nav-tab[data-target="${id}"]`);
                    if (tab) tab.classList.add('active');
                    if (id === 'history') renderHistory();
                }

                // --- HISTÓRICO ---
                function saveToHistory(text) {
                    store.get(['geminiHistory'], (res) => {
                        let hist = res.geminiHistory || [];
                        hist.unshift({ id: Date.now(), date: new Date().toLocaleString(), text: text });
                        if (hist.length > 20) hist = hist.slice(0, 20);
                        store.set({ geminiHistory: hist });
                    });
                }

                function renderHistory() {
                    const list = getEl('history-list');
                    store.get(['geminiHistory'], (res) => {
                        const hist = res.geminiHistory || [];
                        list.innerHTML = hist.length ? '' : '<p style="text-align:center; color:var(--ia-text-muted); margin-top:20px;">Nenhum histórico.</p>';
                        hist.forEach(item => {
                            const div = document.createElement('div'); div.className = 'history-item';
                            div.innerHTML = `
                        <div class="history-meta"><span>${item.date}</span></div>
                        <div class="history-preview">${item.text}</div>
                        <div class="h-actions">
                             <button class="h-btn btn-primary h-copy purecloud-script-button" data-text="${encodeURIComponent(item.text)}">Copiar</button>
                             <button class="h-btn btn-danger h-del purecloud-script-button" data-id="${item.id}">🗑️</button>
                        </div>
                    `;
                            list.appendChild(div);
                        });
                        list.querySelectorAll('.h-copy').forEach(b => b.onclick = (e) => {
                            navigator.clipboard.writeText(decodeURIComponent(e.target.dataset.text));
                            e.target.innerText = "OK!"; setTimeout(() => e.target.innerText = "Copiar", 1500);
                        });
                        list.querySelectorAll('.h-del').forEach(b => b.onclick = (e) => {
                            const id = parseInt(e.target.dataset.id);
                            store.get(['geminiHistory'], r => {
                                store.set({ geminiHistory: (r.geminiHistory || []).filter(i => i.id !== id) }, renderHistory);
                            });
                        });
                    });
                }

                // --- EVENTOS ---

                if (getEl('btn-head-history')) getEl('btn-head-history').onclick = () => switchScreen('history');
                if (getEl('btn-head-config')) getEl('btn-head-config').onclick = () => switchScreen('config');
                getEl('btn-theme').onclick = () => {
                    const isLight = wrapper.classList.contains('local-light-mode');
                    if (isLight) {
                        wrapper.classList.remove('local-light-mode');
                        wrapper.classList.add('cc-escurinho');
                        store.set({ IA_THEME: 'dark' });
                        getEl('btn-theme').innerText = '🌗';
                        getEl('btn-theme').title = 'Mudar para Tema Claro';
                    } else {
                        wrapper.classList.remove('cc-escurinho');
                        wrapper.classList.add('local-light-mode');
                        store.set({ IA_THEME: 'light' });
                        getEl('btn-theme').innerText = '☀️';
                        getEl('btn-theme').title = 'Mudar para Tema Escuro';
                    }
                };
                getEl('btn-close').onclick = () => {
                    modal.style.display = 'none';
                    if (window.spellCheckerModule) window.spellCheckerModule.ocultarTudo();
                };
                getEl('gemini-float-btn').onclick = () => {
                    modal.style.display = modal.style.display === 'flex' ? 'none' : 'flex';
                    if (modal.style.display === 'none' && window.spellCheckerModule) {
                        window.spellCheckerModule.ocultarTudo();
                    }
                    if (modal.style.display === 'flex') {
                        const rect = modal.getBoundingClientRect();
                        if (rect.top < 0 || rect.left < 0 || rect.bottom > window.innerHeight || rect.right > window.innerWidth) {
                            modal.style.top = '80px';
                            modal.style.left = '';
                            modal.style.right = '30px';
                            modal.style.transform = 'none';
                        }
                    }
                    loadState();
                };

                const dragHandle = getEl('gemini-drag-handle');
                if (dragHandle) {
                    let isDragging = false, dragOffsetX = 0, dragOffsetY = 0;
                    dragHandle.addEventListener('mousedown', (e) => {
                        if (e.target.closest('button')) return;
                        isDragging = true;
                        const rect = modal.getBoundingClientRect();
                        dragOffsetX = e.clientX - rect.left;
                        dragOffsetY = e.clientY - rect.top;
                        modal.style.transition = 'none';
                    });
                    document.addEventListener('mousemove', (e) => {
                        if (!isDragging) return;
                        modal.style.left = (e.clientX - dragOffsetX) + 'px';
                        modal.style.top = (e.clientY - dragOffsetY) + 'px';
                        modal.style.right = 'auto'; 
                        modal.style.bottom = 'auto';
                    });
                    document.addEventListener('mouseup', () => { isDragging = false; });
                }

                document.querySelectorAll('.nav-tab').forEach(t => t.onclick = () => switchScreen(t.dataset.target));

                getEl('btn-login').onclick = () => {
                    const k = getEl('input-setup-key').value.trim();
                    const n = getEl('input-setup-name').value.trim();
                    if (k.length < 10) return alert("Chave inválida.");
                    store.set({ geminiKey: k, agentName: n || "Atendente" }, loadState);
                };
                getEl('btn-logout').onclick = () => { if (confirm("Sair e Bloquear?")) store.remove(['geminiKey', 'agentName'], () => { userApiKey = ''; loadState(); }); };
                getEl('btn-save-cfg').onclick = () => {
                    store.set({ geminiKey: getEl('cfg-key').value, agentName: getEl('cfg-name').value }, () => alert("Salvo!"));
                };
                getEl('btn-back-report-h').onclick = () => switchScreen('report');
                getEl('btn-back-report-c').onclick = () => switchScreen('report');

                // Relatório
                getEl('btn-gen-report').onclick = async () => {
                    const txt = getEl('input-report').value.trim();
                    if (!txt) return alert("Insira o texto.");

                    const btn = getEl('btn-gen-report');
                    const resDiv = getEl('gemini-result');
                    const actions = getEl('result-actions');

                    btn.innerHTML = "⏳ A gerar..."; btn.disabled = true;
                    resDiv.style.display = 'none'; actions.style.display = 'none';

                    const timeGreeting = getBrazilGreeting();
                    const prompt = `
            Contexto: Agora é ${timeGreeting}. Você é a Aja, assistente do agente ${agentName}.
            Gere um relatório técnico em PRIMEIRA PESSOA (${agentName}).
            REGRAS RÍGIDAS DE SAÍDA:
            1. NÃO DÊ BOM DIA, BOA TARDE OU BOA NOITE NO INÍCIO.
            2. NÃO ESCREVA "AQUI ESTÁ O RELATÓRIO" OU "SEGUE O RELATÓRIO".
            3. A SAÍDA DEVE COMEÇAR IMEDIATAMENTE PELO TÍTULO OU PELA INTRODUÇÃO.
            4. NÃO invente horários. Mantenha privacidade: Apenas Nome e Telefone do cliente.
            5. VOCÊ DEVE OBRIGATORIAMENTE ESCOLHER A TABULAÇÃO GENESYS MAIS ADEQUADA COM BASE NO RELATO, E INSERIR NO INÍCIO DA SUA RESPOSTA ENTRE <TAB> e </TAB>. Ex: <TAB>LOS - FTTH</TAB>
            ESTRUTURA: <TAB>SUA ESCOLHA DE TABULAÇÃO</TAB> Relatório Técnico de Atendimento -> 1. Introdução, 2. Relato, 3. Procedimentos, 4. Conclusão
            
            TABULAÇÕES DISPONÍVEIS (Escolha apenas uma):
            ${TABS_DB}
            Texto base: ${txt}`;

                    try {
                        const raw = await generateText(prompt);

                        let finalReport = raw;
                        let suggestedTab = "Nenhuma tabulação identificada";

                        const tabMatch = raw.match(/<TAB>\s*(.*?)\s*<\/TAB>/is);
                        if (tabMatch) {
                            suggestedTab = tabMatch[1].replace(/\*/g, '').trim();
                            finalReport = raw.replace(tabMatch[0], '').trim();
                        } else {
                            // Backup: Tenta buscar a ultima linha.
                            let lines = raw.split('\n').filter(l => l.trim().length > 0);
                            let lastLine = lines[lines.length - 1] || "";
                            if (!lastLine.toLowerCase().includes('conclusão') && lastLine.length < 100) {
                                suggestedTab = lastLine.replace(/<.*?>/g, '').replace(/\*/g, '').trim();
                                finalReport = raw.replace(lastLine, '').trim();
                            } else {
                                suggestedTab = "Não identificada automaticamente. Analise o relato.";
                            }
                        }

                        const tabBox = document.getElementById('ia-tabulacao-box');
                        const tabText = document.getElementById('ia-tabulacao-text');
                        if (tabBox && tabText) {
                            tabText.innerText = suggestedTab;
                            tabBox.style.display = 'block';
                        }

                        resDiv.innerHTML = formatMarkdown(finalReport);
                        resDiv.style.display = 'block';
                        actions.style.display = 'flex';
                        if (document.getElementById('result-actions-top')) document.getElementById('result-actions-top').style.display = 'flex';
                        actions.style.flexDirection = 'row';
                        saveToHistory(finalReport);
                    } catch (e) {
                        resDiv.innerText = "Erro: " + e.message;
                        resDiv.style.display = 'block';
                    } finally {
                        btn.innerHTML = "⚡ Gerar Relatório"; btn.disabled = false;
                    }
                };

                const copyFunc = () => {
                    navigator.clipboard.writeText(getEl('gemini-result').innerText);
                    const b1 = getEl('btn-copy-result');
                    const b2 = getEl('btn-copy-result-top');
                    if (b1) { b1.innerText = "Copiado! ✅"; setTimeout(() => b1.innerText = "📋 Copiar Relatório", 2000); }
                    if (b2) { b2.innerText = "Copiado! ✅"; setTimeout(() => b2.innerText = "📋 Copiar Relatório", 2000); }
                };
                getEl('btn-copy-result').onclick = copyFunc;
                if (getEl('btn-copy-result-top')) getEl('btn-copy-result-top').onclick = copyFunc;

                const clearFunc = () => {
                    getEl('input-report').value = '';
                    getEl('gemini-result').innerHTML = '';
                    getEl('gemini-result').style.display = 'none';
                    getEl('result-actions').style.display = 'none';
                    if (getEl('result-actions-top')) getEl('result-actions-top').style.display = 'none';
                    if (document.getElementById('ia-tabulacao-box')) document.getElementById('ia-tabulacao-box').style.display = 'none';
                };
                getEl('btn-clear-report-top').onclick = clearFunc;
                getEl('btn-wipe-result').onclick = clearFunc;
                if (getEl('btn-wipe-result-top')) getEl('btn-wipe-result-top').onclick = clearFunc;

                getEl('btn-wipe-history').onclick = () => { if (confirm("Apagar tudo?")) store.set({ geminiHistory: [] }, renderHistory); };

                // Chat
                const sendChat = async () => {
                    const inp = getEl('input-chat');
                    const txt = inp.value.trim();
                    if (!txt) return;

                    const c = getEl('chat-container');
                    c.innerHTML += `<div class="chat-bubble chat-user">${formatMarkdown(txt)}</div>`;
                    inp.value = ''; c.scrollTop = c.scrollHeight;

                    const tempId = "tmp-" + Date.now();
                    c.innerHTML += `<div id="${tempId}" class="chat-bubble chat-ai">...</div>`;
                    c.scrollTop = c.scrollHeight;

                    try {
                        const context = chatHistoryContext.slice(-6).map(m => `user: ${m.user}\\nmodel: ${m.ai}`).join("\\n");
                        const currentG = getBrazilGreeting();
                        const prompt = `Você é a Aja. Agora é ${currentG}. Responda de forma útil ao ${agentName}.\\nHistórico:\\n${context}\\nUsuário: ${txt}`;
                        const ans = await generateText(prompt);
                        document.getElementById(tempId).innerHTML = formatMarkdown(ans);
                        chatHistoryContext.push({ user: txt, ai: ans });
                    } catch (e) { document.getElementById(tempId).innerText = "Erro."; }
                };
                getEl('btn-send-chat').onclick = sendChat;
                getEl('input-chat').onkeypress = (e) => { if (e.key === 'Enter') sendChat(); };
                getEl('btn-clear-chat').onclick = () => {
                    const greeting = getBrazilGreeting();
                    getEl('chat-container').innerHTML = `<div id="chat-welcome-msg" class="chat-bubble chat-ai">${greeting} <b>${agentName}</b>!<br>Eu sou a <b>Aja</b>. Como posso ajudar?</div>`;
                    chatHistoryContext = [];
                };
                // --- ARRASTO LIVRE ---
                const handle = getEl('gemini-drag-handle');
                let isDragging = false;
                let dragOffsetX = 0;
                let dragOffsetY = 0;

                handle.onmousedown = (e) => {
                    if (e.target.closest('button')) return;
                    e.preventDefault();
                    isDragging = true;
                    handle.style.cursor = 'grabbing';
                    const rect = modal.getBoundingClientRect();
                    modal.style.transform = 'none';
                    modal.style.margin = '0';
                    modal.style.left = rect.left + 'px';
                    modal.style.top = rect.top + 'px';
                    dragOffsetX = e.clientX - rect.left;
                    dragOffsetY = e.clientY - rect.top;
                };

                document.onmousemove = (e) => {
                    if (!isDragging) return;
                    e.preventDefault();
                    const newLeft = e.clientX - dragOffsetX;
                    const newTop = e.clientY - dragOffsetY;
                    modal.style.left = newLeft + 'px';
                    modal.style.top = newTop + 'px';
                };

                document.onmouseup = () => {
                    if (isDragging) {
                        isDragging = false;
                        handle.style.cursor = 'move';
                    }
                };

                loadState();
            }
        })();

    } catch (e) { console.error('[BUILDER] Erro fatal no módulo ia.js:', e); }

    /* --- MÓDULO ANEXADO: MONITOR.JS --- */
    try {
        // ==UserScript==
        // @name         PureCloud - Monitor Pro (Módulo Extensão)
        // @description  Monitor de filas com Busca e Horários precisos.
        // ==/UserScript==

        (function () {
            'use strict';

            // --- 1. BASE DE DADOS COMPLETA (77 FILAS) ---
            const QUEUES_DB = [
                // --- AGENDAMENTO ---
                { label: "AGENDAMENTO INSTALAÇÃO DIGITAL", desc: "Agendamento via Chat.", channel: "Chat", sector: "Fibra", schedules: { wd: ["08:00", "17:00"], sat: ["08:00", "12:00"], sun: null } },
                { label: "AGENDAMENTO INSTALAÇÃO", desc: "Agendamento via Voz.", channel: "Voz", sector: "Fibra", schedules: { wd: ["08:00", "17:00"], sat: ["08:00", "12:00"], sun: null } },
                { label: "AGENDAMENTO REPARO DIGITAL", desc: "Reparo via Chat.", channel: "Chat", sector: "Fibra", schedules: { wd: ["08:00", "17:48"], sat: ["08:00", "17:48"], sun: ["08:00", "17:48"] } },
                { label: "AGENDAMENTO REPARO", desc: "Reparo via Voz.", channel: "Voz", sector: "Fibra", schedules: { wd: ["08:00", "17:48"], sat: ["08:00", "17:48"], sun: ["08:00", "17:48"] } },

                // --- BACKOFFICE ---
                { label: "BACKOFFICE 5G DIGITAL", desc: "N2 5G via Chat.", channel: "Chat", sector: "5G", schedules: { wd: ["08:00", "20:30"], sat: ["08:00", "20:30"], sun: null } },
                { label: "BACKOFFICE BRISAMOVEL", desc: "Suporte interno.", channel: "Voz", sector: "Fibra", schedules: { wd: ["08:00", "17:40"], sat: ["08:00", "14:00"], sun: null } },
                { label: "BACKOFFICE GC", desc: "Gestão de Carteira.", channel: "Voz", sector: "5G", schedules: { wd: ["08:00", "21:50"], sat: ["08:00", "21:50"], sun: null } },
                { label: "BACKOFFICE LOJA", desc: "Suporte Lojas.", channel: "Voz", sector: "Fibra", schedules: { wd: ["08:00", "20:40"], sat: ["08:00", "20:40"], sun: null } },
                { label: "BACKOFFICE MAPAS", desc: "Correção de Rede.", channel: "Voz", sector: "Fibra", schedules: { wd: ["08:00", "18:50"], sat: ["08:00", "18:50"], sun: null } },
                { label: "BACKOFFICE MAPAS DIGITAL", desc: "Correção via Chat.", channel: "Chat", sector: "Fibra", schedules: { wd: ["08:00", "18:50"], sat: ["08:00", "18:50"], sun: null } },
                { label: "BACKOFFICE MAPAS/CORREÇÃO", desc: "Ajustes de cadastro.", channel: "Voz", sector: "Fibra", schedules: { wd: ["08:00", "17:00"], sat: ["08:00", "17:00"], sun: null } },
                { label: "BACKOFFICE RETENCAO", desc: "Tratativa crítica.", channel: "Voz", sector: "Fibra", schedules: { wd: ["08:00", "18:20"], sat: ["08:00", "18:20"], sun: ["08:00", "18:20"] } },

                // --- COBRANÇA ---
                { label: "COBRANÇA", desc: "Negociação Voz.", channel: "Voz", sector: "Fibra", schedules: { wd: ["07:00", "21:50"], sat: ["07:00", "21:50"], sun: ["07:00", "20:40"] } },
                { label: "COBRANÇA 5G", desc: "Negociação 5G.", channel: "Voz", sector: "5G", schedules: { wd: ["08:00", "21:40"], sat: ["08:00", "21:40"], sun: ["08:00", "20:40"] } },
                { label: "COBRANCA 5G CALL BACK", desc: "Retorno Noturno.", channel: "Voz", sector: "5G", schedules: { wd: ["21:50", "08:00"], sat: ["21:50", "08:00"], sun: ["20:40", "08:00"] } },
                { label: "COBRANCA 5G DIGITAL", desc: "Negociação Chat.", channel: "Chat", sector: "5G", schedules: { wd: ["08:00", "21:50"], sat: ["08:00", "21:50"], sun: ["08:00", "20:40"] } },
                { label: "COBRANCA 5G DIGITAL FH", desc: "Plantão Cobrança.", channel: "Chat", sector: "5G", schedules: { wd: ["21:50", "08:00"], sat: ["21:50", "08:00"], sun: ["20:00", "08:00"] } },
                { label: "COBRANÇA CORPORATIVO", desc: "Cobrança B2B.", channel: "Voz", sector: "Fibra", schedules: { wd: ["08:00", "18:00"], sat: ["08:00", "18:00"], sun: null } },
                { label: "COBRANÇA CORPORATIVO DIGITAL", desc: "Cobrança B2B Chat.", channel: "Chat", sector: "Fibra", schedules: { wd: ["08:00", "18:00"], sat: ["08:00", "18:00"], sun: null } },
                { label: "COBRANCA DIGITAL", desc: "WhatsApp/Web.", channel: "Chat", sector: "Fibra", schedules: { wd: ["08:00", "21:50"], sat: ["08:00", "21:50"], sun: ["08:00", "20:40"] } },
                { label: "COBRANCA DIGITAL FH", desc: "Plantão Noturno.", channel: "Chat", sector: "Fibra", schedules: { wd: ["21:50", "08:00"], sat: ["21:50", "08:00"], sun: ["20:40", "08:00"] } },
                { label: "COBRANCA REVERSAO", desc: "Reversão Inadimplência.", channel: "Voz", sector: "Fibra", schedules: { wd: ["08:00", "18:00"], sat: ["08:00", "18:00"], sun: null } },

                // --- COMERCIAL ---
                { label: "COMERCIAL 5G", desc: "Vendas Voz.", channel: "Voz", sector: "5G", schedules: { wd: ["08:00", "21:50"], sat: ["08:00", "21:50"], sun: ["08:00", "21:50"] } },
                { label: "COMERCIAL 5G DIGITAL", desc: "Vendas Chat.", channel: "Chat", sector: "5G", schedules: { wd: ["08:00", "22:00"], sat: ["08:00", "22:00"], sun: ["08:00", "21:00"] } },
                { label: "COMERCIAL 5G DIGITAL FH", desc: "Vendas Plantão.", channel: "Chat", sector: "5G", schedules: { wd: ["22:00", "08:00"], sat: ["22:00", "08:00"], sun: ["21:00", "08:00"] } },
                { label: "COMERCIAL B2C", desc: "Vendas Fibra Voz.", channel: "Voz", sector: "Fibra", schedules: { wd: ["07:00", "21:50"], sat: ["07:00", "21:50"], sun: ["07:00", "21:50"] } },
                { label: "COMERCIAL CORPORATIVO (B2B) DIGITAL", desc: "Vendas B2B Chat.", channel: "Chat", sector: "Fibra", schedules: { wd: ["08:00", "18:00"], sat: ["08:00", "17:00"], sun: null } },
                { label: "COMERCIAL CORPORATIVO (B2B)", desc: "Vendas B2B Voz.", channel: "Voz", sector: "Fibra", schedules: { wd: ["08:00", "18:00"], sat: ["08:00", "16:00"], sun: null } },
                { label: "COMERCIAL CORPORATIVO GE DIGITAL", desc: "Grandes Empresas Chat.", channel: "Chat", sector: "Fibra", schedules: { wd: ["08:00", "18:00"], sat: null, sun: null } },
                { label: "COMERCIAL CORPORATIVO GE", desc: "Grandes Empresas Voz.", channel: "Voz", sector: "Fibra", schedules: { wd: ["08:00", "18:00"], sat: null, sun: null } },
                { label: "COMERCIAL DIGITAL B2C", desc: "Vendas Online.", channel: "Chat", sector: "Fibra", schedules: { wd: ["08:00", "21:40"], sat: ["08:00", "21:40"], sun: ["08:00", "20:40"] } },
                { label: "INDIQUE UM AMIGO DIGITAL", desc: "Indicação Chat.", channel: "Chat", sector: "Fibra", schedules: { wd: ["08:00", "21:40"], sat: ["08:00", "21:40"], sun: ["08:00", "20:40"] } },
                { label: "INDIQUE UM AMIGO", desc: "Indicação Voz.", channel: "Voz", sector: "Fibra", schedules: { wd: ["08:00", "21:50"], sat: ["08:00", "21:50"], sun: ["08:00", "21:50"] } },

                // --- OUTROS ---
                { label: "BRISA MÓVEL", desc: "Atendimento Móvel.", channel: "Voz", sector: "Fibra", schedules: { wd: ["08:00", "17:40"], sat: ["08:00", "14:00"], sun: null } },
                { label: "BRISAMOVEL BACKOFFICE RECEPTIVO", desc: "Suporte N2 Móvel.", channel: "Voz", sector: "5G", schedules: { wd: ["08:00", "21:50"], sat: ["08:00", "21:50"], sun: ["08:00", "20:30"] } },
                { label: "OUVIDORIA", desc: "Resolução Final.", channel: "Voz", sector: "Fibra", schedules: { wd: ["08:00", "18:00"], sat: ["08:00", "12:00"], sun: null } },
                { label: "PORTABILIDADE", desc: "Migração Voz.", channel: "Voz", sector: "5G", schedules: { wd: ["08:00", "20:40"], sat: ["08:00", "20:40"], sun: null } },
                { label: "PORTABILIDADE DIGITAL ATIVO", desc: "Migração Chat.", channel: "Chat", sector: "5G", schedules: { wd: ["08:00", "20:40"], sat: ["08:00", "20:40"], sun: null } },
                { label: "PORTABILIDADE DIGITAL ATIVO FH", desc: "Plantão Portabilidade.", channel: "Chat", sector: "5G", schedules: { wd: ["20:40", "08:00"], sat: ["20:40", "08:00"], sun: ["00:00", "23:59"] } },
                { label: "PÓS VENDAS", desc: "Acompanhamento.", channel: "Voz", sector: "Fibra", schedules: { wd: ["08:00", "17:00"], sat: ["08:00", "14:20"], sun: null } },

                // --- SUPORTE E REDE ---
                { label: "REDES FTTH DIGITAL", desc: "Suporte Rede Chat.", channel: "Chat", sector: "Fibra", schedules: { wd: ["07:00", "19:00"], sat: ["07:00", "18:00"], sun: ["08:00", "18:00"] } },
                { label: "REDES FTTH", desc: "Suporte Rede Voz.", channel: "Voz", sector: "Fibra", schedules: { wd: ["07:00", "19:00"], sat: ["07:00", "18:00"], sun: ["08:00", "18:00"] } },
                { label: "RENTABILIZAÇÃO", desc: "Ofertas e Upgrades.", channel: "Voz", sector: "Fibra", schedules: { wd: ["08:00", "21:50"], sat: ["08:00", "19:50"], sun: null } },
                { label: "RETENÇÃO", desc: "Anti-Cancelamento.", channel: "Voz", sector: "Fibra", schedules: { wd: ["08:00", "21:50"], sat: ["08:00", "21:50"], sun: null } },
                { label: "RETENCAO 5G DIGITAL", desc: "Retenção Chat.", channel: "Chat", sector: "5G", schedules: { wd: ["08:00", "20:20"], sat: ["08:00", "20:20"], sun: null } },
                { label: "RETENCAO 5G DIGITAL FH", desc: "Plantão Retenção.", channel: "Chat", sector: "5G", schedules: { wd: ["20:20", "08:00"], sat: ["20:20", "08:00"], sun: ["00:00", "23:59"] } },
                { label: "RETENÇÃO 5G E BACKOFFICE GC", desc: "Retenção Especializada.", channel: "Voz", sector: "5G", schedules: { wd: ["08:00", "21:40"], sat: ["08:00", "20:40"], sun: null } },
                { label: "RETENÇÃO LOJA E BACKOFFICE RETENÇÃO", desc: "Apoio Loja.", channel: "Voz", sector: "Fibra", schedules: { wd: ["08:00", "18:00"], sat: ["08:00", "17:00"], sun: null } },

                // --- SAC ---
                { label: "SAC", desc: "Atendimento Geral.", channel: "Voz", sector: "Fibra", schedules: { wd: ["08:00", "21:50"], sat: ["08:00", "21:50"], sun: ["08:00", "20:30"] } },
                { label: "SAC 5G DIGITAL ATIVO", desc: "Atendimento 5G.", channel: "Chat", sector: "5G", schedules: { wd: ["09:00", "19:20"], sat: ["09:00", "19:20"], sun: null } },
                { label: "SAC BRISAMOVEL", desc: "Atendimento Móvel.", channel: "Voz", sector: "5G", schedules: { wd: ["08:00", "18:00"], sat: ["08:00", "14:20"], sun: null } },
                { label: "SAC BRISAMOVEL DIGITAL", desc: "Móvel via Chat.", channel: "Chat", sector: "5G", schedules: { wd: ["08:00", "18:00"], sat: ["08:00", "14:20"], sun: null } },
                { label: "SAC BRISAMOVEL DIGITAL FH", desc: "Plantão Móvel.", channel: "Chat", sector: "5G", schedules: { wd: ["18:00", "08:00"], sat: ["14:20", "08:00"], sun: ["00:00", "23:59"] } },
                { label: "SAC COBRANCA", desc: "Dúvidas Financeiras.", channel: "Voz", sector: "Fibra", schedules: { wd: ["07:00", "21:50"], sat: ["07:00", "21:50"], sun: ["07:00", "21:50"] } },
                { label: "SAC COBRANÇA 5G", desc: "Financeiro 5G.", channel: "Voz", sector: "5G", schedules: { wd: ["08:00", "21:40"], sat: ["08:00", "21:40"], sun: ["08:00", "20:40"] } },
                { label: "SAC COBRANÇA 5G DIGITAL", desc: "Financeiro Chat.", channel: "Chat", sector: "5G", schedules: { wd: ["08:00", "21:40"], sat: ["08:00", "21:40"], sun: ["08:00", "20:40"] } },
                { label: "SAC COMERCIAL", desc: "Informações Planos.", channel: "Voz", sector: "Fibra", schedules: { wd: ["07:00", "21:50"], sat: ["07:00", "21:50"], sun: ["07:00", "20:40"] } },
                { label: "SAC/FINANCEIRO 5G", desc: "Atendimento Integrado.", channel: "Voz", sector: "5G", schedules: { wd: ["08:00", "21:40"], sat: ["08:00", "21:40"], sun: ["08:00", "20:40"] } },
                { label: "SAC/FINANCEIRO 5G CALL BACK", desc: "Retorno Noturno.", channel: "Voz", sector: "5G", schedules: { wd: ["21:40", "08:00"], sat: ["21:40", "08:00"], sun: ["20:40", "08:00"] } },
                { label: "SAC/FINANCEIRO 5G DIGITAL", desc: "Integrado Chat.", channel: "Chat", sector: "5G", schedules: { wd: ["08:00", "21:40"], sat: ["08:00", "21:40"], sun: ["08:00", "20:40"] } },
                { label: "SAC/FINANCEIRO 5G DIGITAL FH", desc: "Plantão Integrado.", channel: "Chat", sector: "5G", schedules: { wd: ["21:40", "08:00"], sat: ["21:40", "08:00"], sun: ["20:40", "08:00"] } },

                // --- SUPORTE TÉCNICO ---
                { label: "SUPORTE 5G N2", desc: "Nível 2.", channel: "Voz", sector: "5G", schedules: { wd: ["08:00", "17:00"], sat: ["08:00", "12:00"], sun: null } },
                { label: "SUPORTE ATIVO", desc: "Suporte Fibra N1.", channel: "Voz", sector: "Fibra", schedules: { wd: ["08:00", "20:40"], sat: ["08:00", "20:40"], sun: ["08:00", "20:40"] } },
                { label: "SUPORTE B2G (CFTV)", desc: "Governo/Câmeras.", channel: "Voz", sector: "Fibra", schedules: { wd: ["00:00", "23:59"], sat: ["00:00", "23:59"], sun: ["00:00", "23:59"] } },
                { label: "SUPORTE CORPORATIVO B2B", desc: "Empresarial 24h.", channel: "Voz", sector: "Fibra", schedules: { wd: ["00:00", "23:59"], sat: ["00:00", "23:59"], sun: ["00:00", "23:59"] } },
                { label: "SUPORTE ISP", desc: "Provedores 24h.", channel: "Voz", sector: "Fibra", schedules: { wd: ["00:00", "23:59"], sat: ["00:00", "23:59"], sun: ["00:00", "23:59"] } },
                { label: "SUPORTE REGIONAL DIGITAL", desc: "Regional Chat.", channel: "Chat", sector: "Fibra", schedules: { wd: ["07:00", "19:00"], sat: ["07:00", "19:00"], sun: ["08:00", "18:00"] } },
                { label: "SUPORTE REGIONAL", desc: "Regional Voz.", channel: "Voz", sector: "Fibra", schedules: { wd: ["07:00", "19:00"], sat: ["07:00", "19:00"], sun: ["08:00", "18:00"] } },
                { label: "SUPORTE TÉCNICO 5G", desc: "Suporte 5G Voz.", channel: "Voz", sector: "5G", schedules: { wd: ["08:00", "21:40"], sat: ["08:00", "21:40"], sun: ["08:00", "20:40"] } },
                { label: "SUPORTE TÉCNICO 5G CALL BACK", desc: "Retorno Noturno.", channel: "Voz", sector: "5G", schedules: { wd: ["21:40", "08:00"], sat: ["21:40", "08:00"], sun: ["20:40", "08:00"] } },
                { label: "SUPORTE TÉCNICO 5G DIGITAL", desc: "Suporte 5G Chat.", channel: "Chat", sector: "5G", schedules: { wd: ["08:00", "21:40"], sat: ["08:00", "21:40"], sun: ["08:00", "20:40"] } },
                { label: "SUPORTE TÉCNICO 5G FH", desc: "Plantão Suporte.", channel: "Chat", sector: "5G", schedules: { wd: ["21:40", "08:00"], sat: ["21:40", "08:00"], sun: ["20:40", "08:00"] } },
                { label: "SUPORTE VAREJO", desc: "Residencial 24h.", channel: "Voz", sector: "Fibra", schedules: { wd: ["00:00", "23:59"], sat: ["00:00", "23:59"], sun: ["00:00", "23:59"] } },
                { label: "SUPORTE VAREJO DIGITAL", desc: "Residencial Chat.", channel: "Chat", sector: "Fibra", schedules: { wd: ["08:00", "23:40"], sat: ["08:00", "23:40"], sun: ["08:00", "23:40"] } },
                { label: "SUPORTE VAREJO DIGITAL FH", desc: "Plantão Chat.", channel: "Chat", sector: "Fibra", schedules: { wd: ["23:40", "08:00"], sat: ["23:40", "08:00"], sun: ["23:40", "08:00"] } },

                // --- TELEVENDAS ---
                { label: "TELEVENDAS RECEPTIVO 5G", desc: "Venda Ativa/Rec.", channel: "Voz", sector: "5G", schedules: { wd: ["08:00", "22:00"], sat: ["08:00", "22:00"], sun: ["08:00", "21:00"] } },
                { label: "TELEVENDAS RECEPTIVO FIBRA", desc: "Venda Ativa/Rec.", channel: "Voz", sector: "FIBRA", schedules: { wd: ["08:00", "22:00"], sat: ["08:00", "22:00"], sun: ["08:00", "20:40"] } }
            ];

            const ICONS = {
                CLOSE: `<svg viewBox="0 0 24 24" width="20" height="20" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>`,
                MAIN: `<svg viewBox="0 0 24 24" width="24" height="24" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"></path></svg>`
            };

            function checkQueueStatus(schedule) {
                if (!schedule) return { isOpen: false, text: "SEM HORÁRIO", color: "#64748b", badge: "Indefinido" };
                const now = new Date();
                const day = now.getDay();
                const currentMinutes = (now.getHours() * 60) + now.getMinutes();
                let times = (day >= 1 && day <= 5) ? schedule.wd : (day === 6 ? schedule.sat : schedule.sun);
                if (!times) return { isOpen: false, text: "FECHADO HOJE", color: "#ef4444", badge: "Fechado", timeStr: "Não Abre" };
                const [startStr, endStr] = times;
                const startMin = (parseInt(startStr.split(':')[0]) * 60) + parseInt(startStr.split(':')[1]);
                const endMin = (parseInt(endStr.split(':')[0]) * 60) + parseInt(endStr.split(':')[1]);
                let isOpen = false;
                if (startMin < endMin) { if (currentMinutes >= startMin && currentMinutes < endMin) isOpen = true; }
                else { if (currentMinutes >= startMin || currentMinutes < endMin) isOpen = true; }
                if (isOpen) return { isOpen: true, text: `ABERTO (Fecha ${endStr})`, color: "#10b981", badge: "Aberto", timeStr: `${startStr} - ${endStr}` };
                return { isOpen: false, text: `FECHADO (Abre ${startStr})`, color: "#ef4444", badge: "Fechado", timeStr: `${startStr} - ${endStr}` };
            }

            function createInterface() {
                const existing = document.querySelector('.queue-monitor-container');
                if (existing) { existing.remove(); return; }

                const container = document.createElement("div");
                container.className = 'queue-monitor-container';
                container.innerHTML = `
            <div class="monitor-header">
                <div class="header-top">
                    <div class="header-title">${ICONS.MAIN}<span>Fila de Atendimento</span></div>
                    <button class="close-btn purecloud-script-button">${ICONS.CLOSE}</button>
                </div>
                <div class="clock-area">
                    <div class="digital-clock" id="monitor-clock">00:00:00</div>
                    <div class="date-display" id="monitor-date">--/--/----</div>
                </div>
                <div class="tabs-container">
                    <button class="tab-btn active purecloud-script-button" data-tab="open">ABERTAS <span id="count-open" class="count-badge green">0</span></button>
                    <button class="tab-btn purecloud-script-button" data-tab="closed">FECHADAS <span id="count-closed" class="count-badge red">0</span></button>
                </div>
                <div class="search-container">
                    <input type="text" id="monitor-search" placeholder="🔍 Pesquisar fila ou setor...">
                </div>
            </div>
            <div class="monitor-content" id="monitor-content-area"></div>
            <div class="resize-handle"></div>
        `;
                document.body.appendChild(container);
                makeDraggable(container, container.querySelector('.monitor-header'));

                container.querySelector('.close-btn').onclick = () => container.remove();
                const tabs = container.querySelectorAll('.tab-btn');
                tabs.forEach(tab => {
                    tab.onclick = () => {
                        tabs.forEach(t => t.classList.remove('active'));
                        tab.classList.add('active');
                        renderQueues();
                    };
                });

                document.getElementById('monitor-search').addEventListener('input', renderQueues);

                const update = () => { if (!document.body.contains(container)) return; updateTime(); renderQueues(); };
                update(); setInterval(update, 10000); setInterval(updateTime, 1000);
            }

            function updateTime() {
                const now = new Date();
                const clockEl = document.getElementById('monitor-clock');
                const dateEl = document.getElementById('monitor-date');
                if (clockEl) clockEl.innerText = now.toLocaleTimeString();
                if (dateEl) dateEl.innerText = now.toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' });
            }

            function renderQueues() {
                const contentArea = document.getElementById('monitor-content-area');
                if (!contentArea) return;
                let openList = [], closedList = [];
                QUEUES_DB.forEach(queue => {
                    const status = checkQueueStatus(queue.schedules);
                    const item = { ...queue, status };
                    if (status.isOpen) openList.push(item); else closedList.push(item);
                });
                document.getElementById('count-open').innerText = openList.length;
                document.getElementById('count-closed').innerText = closedList.length;

                const activeTab = document.querySelector('.tab-btn.active').dataset.tab;
                let currentList = (activeTab === 'open') ? openList : closedList;

                // Lógica de Pesquisa
                const searchTerm = document.getElementById('monitor-search')?.value.toLowerCase() || "";
                if (searchTerm) {
                    currentList = currentList.filter(q =>
                        q.label.toLowerCase().includes(searchTerm) ||
                        q.desc.toLowerCase().includes(searchTerm) ||
                        q.sector.toLowerCase().includes(searchTerm)
                    );
                }

                contentArea.innerHTML = '';
                if (currentList.length === 0) { contentArea.innerHTML = '<div style="text-align:center; padding:40px; color:#64748b;">Nenhuma fila encontrada.</div>'; return; }
                currentList.forEach(item => {
                    const card = document.createElement('div'); card.className = 'queue-card'; card.style.borderLeftColor = item.status.color;
                    card.innerHTML = `<div class="q-header"><span class="q-channel">${item.channel}</span><span class="q-sector">${item.sector}</span></div><div class="q-body"><div class="q-title">${item.label}</div><div class="q-desc">${item.desc}</div></div><div class="q-footer"><span class="status-pill" style="color:${item.status.color}; border:1px solid ${item.status.color}; background:${item.status.color}11;">${item.status.badge.toUpperCase()}</span><span class="q-time">${item.status.timeStr}</span></div>`;
                    contentArea.appendChild(card);
                });
            }

            // --- BOTÃO OCULTO (TRIGGER) ---
            function createTriggerButton() {
                let btn = document.getElementById('monitor-trigger-btn');
                if (btn) return;
                btn = document.createElement('button');
                btn.id = 'monitor-trigger-btn';
                btn.style.display = 'none'; // Invisível, só para ser clicado pelo Menu.js
                document.body.appendChild(btn);
                btn.onclick = createInterface;
            }

            function makeDraggable(el, handle) {
                if (!handle) handle = el;
                let isDragging = false, dragOffsetX = 0, dragOffsetY = 0;

                let moveHandler = (e) => {
                    if (!isDragging) return;
                    e.preventDefault();

                    let newLeft = e.clientX - dragOffsetX;
                    let newTop = e.clientY - dragOffsetY;

                    const rect = el.getBoundingClientRect();
                    if (newLeft < 0) newLeft = 0;
                    if (newTop < 0) newTop = 0;
                    if (newLeft + rect.width > window.innerWidth) newLeft = window.innerWidth - rect.width;
                    if (newTop + rect.height > window.innerHeight) newTop = window.innerHeight - rect.height;

                    el.style.left = newLeft + 'px';
                    el.style.top = newTop + 'px';
                };

                let upHandler = () => {
                    if (isDragging) {
                        isDragging = false;
                    }
                };

                handle.addEventListener('mousedown', (e) => {
                    if (e.target.tagName === 'BUTTON' || e.target.tagName === 'INPUT' || e.target.closest('.os-btn') || e.target.closest('button')) return;
                    e.preventDefault();
                    isDragging = true;

                    el.style.transition = 'none';
                    el.style.transform = 'none';
                    el.style.margin = '0';

                    const rect = el.getBoundingClientRect();
                    el.style.left = rect.left + 'px';
                    el.style.top = rect.top + 'px';
                    el.style.bottom = 'auto';
                    el.style.right = 'auto';

                    dragOffsetX = e.clientX - rect.left;
                    dragOffsetY = e.clientY - rect.top;
                }, { passive: false });

                // Ensure we don't bind multiple identical listeners if makeDraggable is called multiple times on the same element
                // A quick hack is just bind it globally, it naturally ignores when isDragging is false.
                document.addEventListener('mousemove', moveHandler, { passive: false });
                document.addEventListener('mouseup', upHandler);
            }

            function injectCss() {
                const css = `
            @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@500&display=swap');
            .queue-monitor-container { position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%); width: 420px; height: 600px; min-width: 320px; min-height: 400px; background: #0f172a; border-radius: 12px; box-shadow: 0 25px 50px rgba(0,0,0,0.6); z-index: 100000; display: flex; flex-direction: column; font-family: 'Inter', sans-serif; border: 1px solid #1e293b; overflow: hidden; resize: both; }
            .resize-handle { position: absolute; bottom: 0; right: 0; width: 15px; height: 15px; background: linear-gradient(135deg, transparent 50%, #475569 50%); cursor: nwse-resize; pointer-events: none; }
            .monitor-header { background: #1e293b; padding: 0; flex-shrink: 0; user-select: none; }
            .header-top { display: flex; justify-content: space-between; align-items: center; padding: 12px 15px; border-bottom: 1px solid #334155; }
            .header-title { font-weight: 700; color: #f8fafc; font-size: 16px; display: flex; align-items: center; gap: 10px; } .header-title svg { color: #6366f1; }
            .close-btn { background: none; border: none; color: #94a3b8; cursor: pointer; padding: 4px; border-radius: 4px; display: flex; } .close-btn:hover { background: #ef4444; color: white; }
            .clock-area { background: #0f172a; padding: 15px 0; border-bottom: 1px solid #1e293b; text-align: center; }
            .digital-clock { font-family: 'JetBrains Mono', monospace; font-size: 36px; font-weight: 700; color: #f8fafc; letter-spacing: 1px; line-height: 1; }
            .date-display { color: #6366f1; font-size: 13px; font-weight: 500; text-transform: capitalize; margin-top: 5px; opacity: 0.9; }
            .tabs-container { display: flex; background: #0f172a; padding: 0 5px; }
            .tab-btn { flex: 1; background: transparent; border: none; padding: 12px; color: #64748b; font-weight: 600; cursor: pointer; border-bottom: 2px solid transparent; transition: 0.2s; font-size: 13px; }
            .tab-btn:hover { color: #94a3b8; background: rgba(255,255,255,0.02); } .tab-btn.active { color: #f8fafc; border-bottom-color: #3b82f6; background: rgba(59, 130, 246, 0.05); }
            .count-badge { padding: 2px 6px; border-radius: 10px; font-size: 10px; margin-left: 6px; color: #000; font-weight: 800; min-width: 18px; display: inline-block; text-align: center; } .count-badge.green { background: #10b981; } .count-badge.red { background: #ef4444; }
            
            /* ESTILO DA PESQUISA */
            .search-container { padding: 10px; background: #1e293b; border-bottom: 1px solid #334155; }
            #monitor-search { width: 100%; background: #0f172a; border: 1px solid #334155; color: #f8fafc; padding: 8px 12px; border-radius: 6px; font-family: 'Inter', sans-serif; font-size: 13px; outline: none; transition: border-color 0.2s; box-sizing: border-box; }
            #monitor-search:focus { border-color: #3b82f6; }

            .monitor-content { flex: 1; overflow-y: auto; padding: 15px; display: flex; flex-direction: column; gap: 10px; background: #0f172a; } .monitor-content::-webkit-scrollbar { width: 6px; } .monitor-content::-webkit-scrollbar-thumb { background: #334155; border-radius: 3px; }
            .queue-card { background: #1e293b; padding: 12px; border-radius: 8px; border-left: 3px solid #64748b; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.2); transition: transform 0.2s; } .queue-card:hover { transform: scale(1.02); background: #334155; }
            .q-header { display: flex; justify-content: space-between; font-size: 10px; text-transform: uppercase; color: #94a3b8; font-weight: 700; margin-bottom: 6px; }
            .q-body { margin-bottom: 10px; } .q-title { font-weight: 600; color: #f1f5f9; font-size: 14px; margin-bottom: 3px; } .q-desc { font-size: 12px; color: #64748b; line-height: 1.3; font-style: italic; }
            .q-footer { display: flex; justify-content: space-between; align-items: center; font-size: 11px; padding-top: 8px; border-top: 1px solid #334155; } .status-pill { padding: 2px 8px; border-radius: 4px; font-weight: 700; font-size: 10px; } .q-time { color: #cbd5e1; font-family: 'JetBrains Mono', monospace; }
        `;
                const style = document.createElement('style'); style.textContent = css; document.head.appendChild(style);
            }

            injectCss();
            createTriggerButton();
        })();

    } catch (e) { console.error('[BUILDER] Erro fatal no módulo monitor.js:', e); }

    /* --- MÓDULO ANEXADO: CORRETOR.JS --- */
    try {
        // ==UserScript==
        // @name         Corretor Pro (Módulo)
        // @description  Módulo de Correção Ortográfica contínuo
        // ==/UserScript==

        (function () {
            'use strict';

            // Utilitário global se não existir
            window.log = window.log || console.log;

            // --- ESTILOS DO CORRETOR PRO ---
            const SPELL_PRO_CSS = `
        #spell-overlay-layer { position: absolute; pointer-events: none; color: transparent !important; background: transparent !important; z-index: 2147483640; overflow: hidden; white-space: pre-wrap; word-wrap: break-word; }
        #spell-overlay-layer mark { background: transparent !important; color: transparent !important; }
        .spell-wavy-error { text-decoration: underline wavy #ff4757; text-decoration-skip-ink: none; text-underline-offset: 3px; }
        .spell-wavy-punct { border-bottom: 2px dashed #2ed573; display: inline-block; min-width: 4px; }
        #spell-badge { position: absolute; width: 32px; height: 32px; border-radius: 50%; color: white; display: none; align-items: center; justify-content: center; font-family: 'Inter', sans-serif; font-size: 11px; font-weight: 800; z-index: 2147483645; cursor: pointer; box-shadow: 0 4px 12px rgba(0,0,0,0.3); background: #3b82f6; transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1); border: 2px solid rgba(255,255,255,0.2); overflow: visible; }
        #spell-badge.loading { background: #ffa502; animation: spellPulse 1s infinite; }
        #spell-badge.clean { background: #2ed573; }
        #spell-badge:hover { transform: scale(1.1); }
        .badge-dict-btn { position: absolute; bottom: -5px; right: -5px; width: 16px; height: 16px; background: #10b981; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 10px; border: 1px solid white; box-shadow: 0 2px 4px rgba(0,0,0,0.2); z-index: 10; }
        @keyframes spellPulse { 0% { opacity: 1; transform: scale(1); } 50% { opacity: 0.7; transform: scale(0.9); } 100% { opacity: 1; transform: scale(1); } }
        
        #spell-inline-popup { position: absolute; background: #ffffff; border: 1px solid #e2e8f0; border-radius: 12px; box-shadow: 0 10px 30px rgba(0,0,0,0.15); width: 260px; display: none; flex-direction: column; z-index: 2147483648; font-family: 'Inter', sans-serif; overflow: hidden; backdrop-filter: blur(10px); }
        .popup-header { background: #f8fafc; padding: 12px 15px; font-size: 10px; color: #64748b; font-weight: 700; border-bottom: 1px solid #f1f5f9; text-transform: uppercase; letter-spacing: 1px; }
        .popup-body { padding: 15px; }
        .popup-sug-btn { width: 100%; text-align: left; padding: 10px 14px; background: #eff6ff; color: #2563eb; border: 1px solid #dbeafe; border-radius: 8px; cursor: pointer; font-size: 14px; font-weight: 600; transition: all 0.2s; display: flex; align-items: center; gap: 10px; }
        .popup-sug-btn:hover { background: #dbeafe; transform: translateY(-1px); }
        .popup-footer { display: flex; flex-wrap: wrap; gap: 6px; padding: 10px 15px; background: #f8fafc; border-top: 1px solid #f1f5f9; }
        .popup-action-btn { flex: 1; padding: 8px; font-size: 11px; border: 1px solid #e2e8f0; background: white; border-radius: 6px; cursor: pointer; color: #475569; font-weight: 500; transition: all 0.2s; }
        .popup-action-btn:hover { background: #f1f5f9; color: #0f172a; border-color: #cbd5e1; }
        #btn-add-dict { color: #10b981; border-color: #d1fae5; }
        #btn-add-dict:hover { background: #ecfdf5; }
        #btn-rewrite { font-weight: 600; color: #8b5cf6; border-color: #ddd6fe; background: #f5f3ff; }
        #btn-rewrite:hover { background: #ede9fe; }
        .ai-loading { background: linear-gradient(90deg, #f5f3ff, #ddd6fe, #f5f3ff); background-size: 200% 100%; animation: spellAILoading 1.5s infinite linear; pointer-events: none; }
        @keyframes spellAILoading { 0% { background-position: 100% 0; } 100% { background-position: -100% 0; } }

        #spell-main-panel { position: fixed; top: 100px; right: 20px; width: 340px; background: #ffffff; border-radius: 16px; box-shadow: 0 20px 50px rgba(0,0,0,0.2); z-index: 2147483647; display: none; flex-direction: column; font-family: 'Inter', sans-serif; overflow: hidden; border: 1px solid #e2e8f0; }
        #spell-main-panel .panel-header-top { padding: 15px; background: #10b981; color: white; border-bottom: 1px solid #0d9488; display: flex; justify-content: space-between; align-items: center; cursor: move; }
        #spell-main-panel .panel-title { font-weight: 700; font-size: 16px; display: flex; align-items: center; gap: 10px; }
        .panel-tabs { display: flex; background: #fff; border-bottom: 1px solid #e2e8f0; padding: 0 10px; }
        .tab-btn-p { padding: 12px 15px; font-size: 13px; font-weight: 600; color: #64748b; border-bottom: 3px solid transparent; transition: all 0.2s; flex: 1; text-align: center; }
        .tab-btn-p.active { color: #10b981; border-bottom-color: #10b981; }
        .btn-fix-all { background: white !important; color: #10b981 !important; border-radius: 8px; padding: 6px 12px; font-weight: 700; font-size: 12px; border: none; cursor: pointer; }
    `;

            // Injeta CSS
            const blockStyle = document.createElement('style');
            blockStyle.textContent = SPELL_PRO_CSS;
            document.head.appendChild(blockStyle);

            // Utilitário para não inundar eventos
            function throttle(func, limit) {
                let inThrottle;
                return function () {
                    const args = arguments;
                    const context = this;
                    if (!inThrottle) {
                        func.apply(context, args);
                        inThrottle = true;
                        setTimeout(() => inThrottle = false, limit);
                    }
                }
            }

            // --- MÓDULO CORRETOR PRO ---
            const spellCheckerModule = {
                ultimoCampo: null, errosEncontrados: [], tempoDigitacao: null,
                camadaIlusao: null, badge: null, popup: null, panel: null,
                dicionarioPessoal: JSON.parse(localStorage.getItem('pcs_spell_dict') || '[]'),
                adicionarAoDicionario(palavra) {
                    const p = palavra.toLowerCase().trim();
                    if (p && !this.dicionarioPessoal.includes(p)) {
                        this.dicionarioPessoal.push(p);
                        localStorage.setItem('pcs_spell_dict', JSON.stringify(this.dicionarioPessoal));
                        this.verificarTextoNaAPI();
                    }
                },
                isVisible(el) {
                    if (!el) return false;
                    try {
                        const rect = el.getBoundingClientRect();
                        if (rect.width === 0 || rect.height === 0) return false;
                        let curr = el;
                        while (curr && curr !== document.body) {
                            const style = window.getComputedStyle(curr);
                            if (style.display === 'none' || style.visibility === 'hidden' || style.opacity === '0') return false;
                            curr = curr.parentElement;
                        }
                        return true;
                    } catch (e) { return false; }
                },
                prepararArraste(el) {
                    const header = el.querySelector('.panel-header-top');
                    let isDragging = false, offset = { x: 0, y: 0 };
                    header.addEventListener('mousedown', (e) => {
                        isDragging = true;
                        offset.x = e.clientX - el.offsetLeft;
                        offset.y = e.clientY - el.offsetTop;
                        header.style.cursor = 'grabbing';
                    });
                    document.addEventListener('mousemove', (e) => {
                        if (!isDragging) return;
                        el.style.left = (e.clientX - offset.x) + 'px';
                        el.style.top = (e.clientY - offset.y) + 'px';
                        el.style.right = 'auto';
                    });
                    document.addEventListener('mouseup', () => {
                        isDragging = false;
                        header.style.cursor = 'move';
                    });
                },
                init() {
                    if (document.getElementById('spell-badge')) return;
                    this.camadaIlusao = document.createElement('div'); this.camadaIlusao.id = 'spell-overlay-layer'; document.body.appendChild(this.camadaIlusao);
                    this.badge = document.createElement('div'); this.badge.id = 'spell-badge'; document.body.appendChild(this.badge);
                    this.popup = document.createElement('div'); this.popup.id = 'spell-inline-popup'; document.body.appendChild(this.popup);
                    this.panel = document.createElement('div'); this.panel.id = 'spell-main-panel'; document.body.appendChild(this.panel);

                    this.badge.addEventListener('click', (e) => {
                        if (e.target.closest('.badge-dict-btn')) {
                            this.panel.style.display = 'flex';
                            this.renderizarPainel();
                            this.panel.querySelector('#tab-dict').click();
                            return;
                        }
                        if (this.errosEncontrados.length > 0) {
                            this.panel.style.display = this.panel.style.display === 'flex' ? 'none' : 'flex';
                            this.renderizarPainel();
                        }
                    });
                    document.addEventListener('mousedown', (e) => { 
                        if (this.popup.style.display === 'flex' && !this.popup.contains(e.target) && this.ultimoCampo !== e.target) {
                            this.popup.style.display = 'none'; 
                        }
                    });

                    this.rastrearCampos();
                    window.spellCheckerModule = this; // Expoe para limpeza global
                    this.prepararArraste(this.panel);

                    // Loop de Segurança (Mão de Ferro) - Verifica a cada 300ms se o campo sumiu
                    setInterval(() => {
                        if (this.ultimoCampo && !this.isVisible(this.ultimoCampo)) {
                            this.ocultarTudo();
                        }
                    }, 300);
                },
                rastrearCampos() {
                    document.addEventListener('focusin', (e) => {
                        const el = e.target;
                        if (el.tagName === 'TEXTAREA' || (el.tagName === 'INPUT' && el.type === 'text') || el.isContentEditable) {
                            this.ultimoCampo = el; this.sincronizarIlusao(); this.posicionarBadge(); this.configurarEventosDoCampo(); this.verificarTextoNaAPI();
                        }
                    });
                    window.addEventListener('resize', () => { if(this.ultimoCampo) { this.sincronizarIlusao(); this.posicionarBadge(); } });
                    window.addEventListener('scroll', () => { if(this.ultimoCampo) { this.sincronizarIlusao(); this.posicionarBadge(); } }, true);

                    const observer = new MutationObserver(throttle(() => { 
                        if (this.ultimoCampo && this.isVisible(this.ultimoCampo)) { 
                            this.sincronizarIlusao(); this.posicionarBadge(); 
                        } else if (this.ultimoCampo) { 
                            this.ocultarTudo(); 
                        } 
                    }, 400));
                    observer.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['style', 'class', 'hidden'] });
                },
                ocultarTudo() { 
                    if (this.badge) this.badge.style.display = 'none'; 
                    if (this.popup) this.popup.style.display = 'none'; 
                    if (this.panel) this.panel.style.display = 'none';
                    if (this.camadaIlusao) this.camadaIlusao.innerHTML = ''; 
                    this.ultimoCampo = null; 
                },
                sincronizarIlusao() {
                    if (!this.ultimoCampo) return;
                    const rect = this.ultimoCampo.getBoundingClientRect();
                    if (rect.width === 0 || rect.height === 0) return;
                    const estilos = window.getComputedStyle(this.ultimoCampo);
                    this.camadaIlusao.style.top = (rect.top + window.scrollY) + 'px';
                    this.camadaIlusao.style.left = (rect.left + window.scrollX) + 'px';
                    this.camadaIlusao.style.width = rect.width + 'px'; this.camadaIlusao.style.height = rect.height + 'px';
                    this.camadaIlusao.style.font = estilos.font; this.camadaIlusao.style.padding = estilos.padding;
                    this.camadaIlusao.style.lineHeight = estilos.lineHeight; this.camadaIlusao.style.letterSpacing = estilos.letterSpacing;
                    this.camadaIlusao.style.border = estilos.border; this.camadaIlusao.style.borderColor = 'transparent';
                    this.camadaIlusao.scrollTop = this.ultimoCampo.scrollTop; this.camadaIlusao.scrollLeft = this.ultimoCampo.scrollLeft;
                },
                posicionarBadge() {
                    if (!this.ultimoCampo || this.errosEncontrados.length === 0) {
                        if (this.badge) this.badge.style.display = 'none';
                        return;
                    }
                    const rect = this.ultimoCampo.getBoundingClientRect();
                    if (rect.width === 0 || rect.bottom < 0 || rect.top > window.innerHeight) {
                        this.badge.style.display = 'none';
                        return;
                    }
                    this.badge.style.left = (rect.right + window.scrollX - 30) + 'px'; 
                    this.badge.style.top = (rect.bottom + window.scrollY - 30) + 'px'; 
                    this.badge.style.display = 'flex';
                },
                configurarEventosDoCampo() {
                    if (this.ultimoCampo._spellConfigured) return; this.ultimoCampo._spellConfigured = true;
                    this.ultimoCampo.addEventListener('input', () => {
                        this.badge.className = 'loading'; this.badge.innerHTML = ''; this.popup.style.display = 'none'; this.camadaIlusao.innerHTML = '';
                        clearTimeout(this.tempoDigitacao); this.tempoDigitacao = setTimeout(() => this.verificarTextoNaAPI(), 800);
                    });
                    this.ultimoCampo.addEventListener('scroll', () => this.sincronizarIlusao());
                    this.ultimoCampo.addEventListener('click', (e) => this.verificarCursor(e));
                    this.ultimoCampo.addEventListener('keyup', (e) => { if (["ArrowLeft", "ArrowRight"].includes(e.key)) this.verificarCursor(e); });
                },
                verificarTextoNaAPI() {
                    if (!this.ultimoCampo) return; const isCE = this.ultimoCampo.isContentEditable; const texto = isCE ? (this.ultimoCampo.innerText || this.ultimoCampo.textContent) : this.ultimoCampo.value;
                    if (!texto.trim()) { this.badge.className = ''; this.badge.innerHTML = '0'; this.badge.style.display = 'none'; this.errosEncontrados = []; this.camadaIlusao.innerHTML = ''; return; }

                    if (typeof GM_xmlhttpRequest !== 'undefined') {
                        GM_xmlhttpRequest({
                            method: 'POST',
                            url: 'https://api.languagetool.org/v2/check',
                            headers: { "Content-Type": "application/x-www-form-urlencoded" },
                            data: "text=" + encodeURIComponent(texto) + "&language=pt-BR",
                            onload: (response) => {
                                try {
                                    const data = JSON.parse(response.responseText);
                                    // Filtra pelo dicionário pessoal
                                    this.errosEncontrados = data.matches.filter(err => {
                                        const palavra = texto.substring(err.offset, err.offset + err.length).toLowerCase().trim();
                                        return !this.dicionarioPessoal.includes(palavra);
                                    }).reverse();
                                    this.atualizarLinhasOnduladas(texto); this.atualizarBadge();
                                    if (this.panel.style.display === 'flex') this.renderizarPainel();
                                } catch (e) { window.log("Erro JSON CSP:", e); }
                            },
                            onerror: (err) => { window.log("Erro GM_xmlhttpRequest", err); }
                        });
                    } else {
                        window.log("GM_xmlhttpRequest indisponível. Usando Fetch.");
                        // Fallback para fetch (pode falhar por CSP)
                        safeFetch('https://api.languagetool.org/v2/check', {
                            method: 'POST',
                            headers: { "Content-Type": "application/x-www-form-urlencoded" },
                            body: "text=" + encodeURIComponent(texto) + "&language=pt-BR"
                        })
                            .then(res => res.json())
                            .then(data => {
                                this.errosEncontrados = data.matches.reverse();
                                this.atualizarLinhasOnduladas(texto); this.atualizarBadge();
                                if (this.panel.style.display === 'flex') this.renderizarPainel();
                            }).catch(e => window.log("Fallback Fetch Falhou:", e));
                    }
                },
                atualizarLinhasOnduladas(textoOriginal) {
                    this.camadaIlusao.innerHTML = buildSpellOverlayHTML(textoOriginal, this.errosEncontrados);
                    this.sincronizarIlusao();
                },
                atualizarBadge() {
                    const qtd = this.errosEncontrados.length;
                    if (qtd === 0) {
                        this.badge.className = 'clean';
                        this.badge.innerHTML = '<div class="badge-dict-btn" style="bottom: 6px; right: 6px;" title="Dicionário Pessoal">📖</div>'; 
                        this.badge.style.display = 'flex';
                    } else { 
                        this.badge.className = ''; 
                        this.badge.innerHTML = `${qtd}<div class="badge-dict-btn" title="Dicionário Pessoal">📖</div>`; 
                        this.badge.style.display = 'flex'; 
                    }
                },
                verificarCursor(eventoMouse) {
                    if (!this.ultimoCampo || this.errosEncontrados.length === 0) return;
                    const cursor = this.ultimoCampo.selectionStart;
                    const erroNoCursor = this.errosEncontrados.find(err => cursor >= (err.offset - 1) && cursor <= (err.offset + err.length + 1));
                    if (erroNoCursor) {
                        let top = eventoMouse.pageY ? eventoMouse.pageY + 15 : (this.ultimoCampo.getBoundingClientRect().bottom + window.scrollY);
                        let left = eventoMouse.pageX ? eventoMouse.pageX : (this.ultimoCampo.getBoundingClientRect().left + window.scrollX + 20);
                        this.popup.style.left = left + 'px'; this.popup.style.top = top + 'px';
                        this.mostrarPopupCorrecao(erroNoCursor);
                    } else { this.popup.style.display = 'none'; }
                },
                mostrarPopupCorrecao(erro) {
                    const sugestaoPrincipal = erro.replacements[0] ? erro.replacements[0].value : "";
                    const categoria = erro.rule.category.name || "Revisão sugerida";
                    let labelSugestao = sugestaoPrincipal;
                    const palavraErro = erro.context.text.substring(erro.context.offset, erro.context.offset + erro.context.length);
                    let html = `<div class="popup-header">${categoria}</div><div class="popup-body">`;
                    if (sugestaoPrincipal) { html += `<button class="popup-sug-btn purecloud-script-button" id="sug-btn-main">➔ ${labelSugestao}</button>`; }
                    else { html += `<div style="font-size:12px; color:#ef4444; font-weight:500;">${erro.message}</div>`; }
                    html += `</div><div class="popup-footer">
                        <button class="popup-action-btn" id="btn-add-dict" title="Não marcar mais como erro">💾 Salvar</button>
                        <button class="popup-action-btn" id="btn-rewrite">✨ IA</button>
                        <button class="popup-action-btn" id="btn-ignore">🗑️ Ignorar</button>
                    </div>`;
                    this.popup.innerHTML = html;
                    if (sugestaoPrincipal) { this.popup.querySelector('#sug-btn-main').onclick = () => this.aplicarCorrecao(erro, sugestaoPrincipal); }
                    this.popup.querySelector('#btn-add-dict').onclick = () => { this.adicionarAoDicionario(palavraErro); this.popup.style.display = 'none'; };
                    this.popup.querySelector('#btn-ignore').onclick = () => {
                        this.errosEncontrados = this.errosEncontrados.filter(e => e !== erro);
                        this.atualizarLinhasOnduladas(this.ultimoCampo.isContentEditable ? (this.ultimoCampo.innerText || this.ultimoCampo.textContent) : this.ultimoCampo.value); this.atualizarBadge(); this.popup.style.display = 'none';
                    };
                    this.popup.querySelector('#btn-rewrite').onclick = async () => {
                        if (!window.askGemini) { alert("IA não disponível."); return; }
                        const btnIA = this.popup.querySelector('#btn-rewrite');
                        const originalHtml = btnIA.innerHTML;
                        btnIA.innerHTML = "⏳...";
                        btnIA.disabled = true;
                        
                        try {
                            const context = this.ultimoCampo.isContentEditable ? (this.ultimoCampo.innerText || this.ultimoCampo.textContent) : this.ultimoCampo.value;
                            const prompt = `Reescreva esta frase de atendimento ao cliente para torná-la mais profissional, clara e gramaticalmente correta, mantendo o sentido original: "${context}"`;
                            const res = await window.askGemini(prompt);
                            if (res && !res.includes("Erro") && !res.includes("error")) {
                                if (this.ultimoCampo.isContentEditable) this.ultimoCampo.innerText = res;
                                else this.ultimoCampo.value = res;
                                this.dispararEventoDeMudanca();
                                this.popup.style.display = 'none';
                            }
                        } catch (e) { console.error(e); }
                        
                        btnIA.innerHTML = originalHtml;
                        btnIA.disabled = false;
                    };
                    this.popup.style.display = 'flex';
                },
                aplicarCorrecao(erro, sugestao) { this.aplicarCorrecaoMath(erro, sugestao); this.dispararEventoDeMudanca(); this.popup.style.display = 'none'; if (this.panel.style.display === 'flex') this.panel.style.display = 'none'; },
                aplicarCorrecaoMath(erro, sugestao) {
                    if (!this.ultimoCampo) return; 
                    const isCE = this.ultimoCampo.isContentEditable; 
                    const textoAtual = isCE ? (this.ultimoCampo.innerText || this.ultimoCampo.textContent) : this.ultimoCampo.value;
                    
                    // Verifica se o texto ainda bate com o erro (evita duplicidade se o usuário já mudou algo)
                    if (erro.offset > textoAtual.length) return;

                    const novoTexto = textoAtual.substring(0, erro.offset) + sugestao + textoAtual.substring(erro.offset + (erro.length || 0));
                    
                    if (isCE) {
                        this.ultimoCampo.focus();
                        // Modo seguro para ContentEditable: Limpa e reinsere
                        this.ultimoCampo.innerText = novoTexto;
                    } else {
                        this.ultimoCampo.value = novoTexto;
                    }
                    this.camadaIlusao.innerHTML = ""; // Limpa rastro visual imediatamente
                },
                dispararEventoDeMudanca() { this.ultimoCampo.dispatchEvent(new Event('input', { bubbles: true })); this.verificarTextoNaAPI(); },
                renderizarPainel() {
                    this.panel.innerHTML = `
                <div class="panel-header-top">
                    <div class="panel-title">
                        <div style="background:rgba(255,255,255,0.2); color:white; border-radius:50%; width:22px; height:22px; display:flex; align-items:center; justify-content:center; font-size:11px; font-weight:bold;">${this.errosEncontrados.length}</div> 
                        Corretor Ortográfico Aja Pro
                    </div>
                    <button class="btn-fix-all" id="btn-fix-all" ${this.errosEncontrados.length === 0 ? 'disabled' : ''}>Fix all</button>
                </div>
                <div class="panel-tabs">
                    <span class="tab-btn-p active" id="tab-errors" style="cursor:pointer;">Tudo (${this.errosEncontrados.length})</span>
                    <span class="tab-btn-p" id="tab-dict" style="cursor:pointer;">Dicionário (${this.dicionarioPessoal.length})</span>
                </div>
                <div class="panel-body" id="panel-content-area" style="background:#f8fafc; min-height:220px;"></div>`;
                    
                    const area = this.panel.querySelector('#panel-content-area');
                    
                    const renderErrors = () => {
                        area.innerHTML = "";
                        if (this.errosEncontrados.length === 0) {
                            area.innerHTML = `<div style="text-align:center; padding:40px; color:#64748b; font-size:13px;">✨ Tudo certo com seu texto!</div>`;
                            return;
                        }
                        this.errosEncontrados.forEach(err => {
                            const card = document.createElement('div'); card.className = 'panel-card';
                            const erroTexto = err.context.text.substr(err.context.offset, err.context.length) || "Ponto/Vírgula";
                            const sugTexto = err.replacements[0] ? err.replacements[0].value : "-";
                            card.innerHTML = `<span class="card-category">${err.rule.category.name}</span><div class="card-change"><span class="card-wrong">${erroTexto}</span> ➔ <span class="card-right" title="Clique para aplicar">${sugTexto}</span></div>`;
                            if (err.replacements[0]) { card.querySelector('.card-right').onclick = () => { this.aplicarCorrecao(err, sugTexto); }; }
                            area.appendChild(card);
                        });
                    };

                    const renderDict = () => {
                        area.innerHTML = "";
                        if (this.dicionarioPessoal.length === 0) {
                            area.innerHTML = `<div style="text-align:center; padding:40px; color:#64748b; font-size:13px;">Seu dicionário está vazio.</div>`;
                            return;
                        }
                        this.dicionarioPessoal.forEach(word => {
                            const item = document.createElement('div');
                            item.style.cssText = "display:flex; justify-content:space-between; padding:8px 12px; background:#f8fafc; border-radius:6px; margin-bottom:5px; font-size:13px; color:#334155; border:1px solid #e2e8f0;";
                            item.innerHTML = `<span>${word}</span> <button style="background:none; border:none; color:#ef4444; cursor:pointer; font-weight:bold;">×</button>`;
                            item.querySelector('button').onclick = () => {
                                this.dicionarioPessoal = this.dicionarioPessoal.filter(w => w !== word);
                                localStorage.setItem('pcs_spell_dict', JSON.stringify(this.dicionarioPessoal));
                                renderDict();
                                this.verificarTextoNaAPI();
                            };
                            area.appendChild(item);
                        });
                    };

                    renderErrors();

                    this.panel.querySelector('#tab-errors').onclick = (e) => {
                        this.panel.querySelectorAll('.tab-btn-p').forEach(b => b.classList.remove('active'));
                        e.target.classList.add('active');
                        renderErrors();
                    };
                    this.panel.querySelector('#tab-dict').onclick = (e) => {
                        this.panel.querySelectorAll('.tab-btn-p').forEach(b => b.classList.remove('active'));
                        e.target.classList.add('active');
                        renderDict();
                    };

                    this.panel.querySelector('#btn-ia-fix').onclick = async () => {
                        if (!this.ultimoCampo) return;
                        const btn = this.panel.querySelector('#btn-ia-fix');
                        const textoOriginal = this.ultimoCampo.isContentEditable ? (this.ultimoCampo.innerText || this.ultimoCampo.textContent) : this.ultimoCampo.value;
                        
                        if (!textoOriginal.trim()) return;
                        
                        const originalBtnText = btn.innerText;
                        btn.innerText = '⌛...';
                        btn.disabled = true;

                        try {
                            if (window.askGemini) {
                                const prompt = `Atue como um revisor profissional. Corrija a gramática, melhore a fluidez e adicione a pontuação correta (vírgulas e pontos) para este texto de atendimento ao cliente, mantendo o tom profissional e o sentido original: "${textoOriginal}"`;
                                const corrigido = await window.askGemini(prompt);
                                
                                if (corrigido && !corrigido.includes("Erro") && !corrigido.includes("error")) {
                                    if (this.ultimoCampo.isContentEditable) this.ultimoCampo.innerText = corrigido;
                                    else this.ultimoCampo.value = corrigido;
                                    this.dispararEventoDeMudanca();
                                    this.verificarTextoNaAPI();
                                } else {
                                    alert("A IA não conseguiu processar o texto agora. Tente novamente.");
                                }
                            } else {
                                alert("O módulo de IA não está ativo.");
                            }
                        } catch (e) { console.error(e); }
                        
                        btn.innerText = originalBtnText;
                        btn.disabled = false;
                    };

                    this.panel.querySelector('#btn-fix-all').onclick = () => { 
                        this.errosEncontrados.forEach(err => { if (err.replacements[0]) this.aplicarCorrecaoMath(err, err.replacements[0].value); }); 
                        this.dispararEventoDeMudanca(); this.panel.style.display = 'none'; 
                    };
                }
            };

            // Inicializa o corretor após injetar o módulo.
            setTimeout(() => {
                window.log("[CORRETOR PRO] Iniciando tracker do corretor...");
                spellCheckerModule.init();
            }, 2000);

        })();

    } catch (e) { console.error('[BUILDER] Erro fatal no módulo corretor.js:', e); }

    /* --- MÓDULO ANEXADO: FERRAMENTAS.JS --- */
    try {
        // ==UserScript==
        // @name         Painel de Ferramentas (Módulo)
        // @description  Aba do Painel de Ferramentas do Agente
        // ==/UserScript==

        (function () {
            'use strict';

            // Cria as opções iniciais hardcoded se não houver um sistema dinâmico 
            // Igual ao 'QUICK_REPLIES' e 'USEFUL_LINKS' do Sistema Geral.txt
            const QUICK_REPLIES = [
                { title: "Saudação - Bom dia", text: "Olá! Bom dia, como posso ajudar?", shortcut: "/bd" },
                { title: "Encerramento Padrão", text: "Agradeço seu contato. Tenha um excelente dia!", shortcut: "/enc" }
            ];

            const USEFUL_LINKS = [
                { title: "Consulta Base de Conhecimento", url: "https://example.com/kb", color: "#4B5563" },
                { title: "Calculadora", url: "https://example.com/calc", color: "#3B82F6" }
            ];

            // Removed custom theme colors, using variables from Cronometros global injected CSS
            const FERRAMENTAS_CSS = `
        /* Leveraging .purecloud-script-popup and .purecloud-script-button from Cronometros */
        #purecloud-script-tools-panel { width: 400px; height: 480px; resize: none; background: var(--purecloud-script-bg-primary); border-radius: 8px; box-shadow: 0 8px 30px var(--purecloud-script-shadow-color); z-index: 10002; display: flex; flex-direction: column; border: 1px solid var(--purecloud-script-border-color); margin: 0; overflow: hidden; }
        #purecloud-script-tools-panel .panel-header { cursor: move; background: var(--purecloud-script-bg-secondary); padding: 10px 15px; border-bottom: 1px solid var(--purecloud-script-border-color); display: flex; justify-content: space-between; align-items: center; border-radius: 8px 8px 0 0; } 
        #purecloud-script-tools-panel .panel-header:active { cursor: grabbing; }
        #purecloud-script-tools-panel .panel-header h2, #purecloud-script-tools-panel .panel-header h3 { margin: 0; color: var(--purecloud-script-text-primary); font-size: 16px; font-weight: 600; display: flex; align-items: center; gap: 8px; } 
        #purecloud-script-tools-panel .panel-header-buttons { display: flex; gap: 5px; } 
        #purecloud-script-tools-panel .panel-header-btn { background: none; border: none; font-size: 1.2em; cursor: pointer; color: var(--purecloud-script-text-secondary); padding: 0 5px; } 
        #purecloud-script-tools-panel .panel-header-btn:hover { color: var(--purecloud-script-text-primary); } 
        #purecloud-script-tools-panel .panel-content { padding: 15px; overflow-y: auto; flex-grow: 1; background: var(--purecloud-script-bg-primary); color: var(--purecloud-script-text-primary); font-size: 14px;} 
        #purecloud-script-tools-panel .settings-group { margin-bottom: 20px; display: flex; flex-direction: column; } 
        #purecloud-script-tools-panel .settings-group label { color: var(--purecloud-script-text-secondary); font-size: 0.9em; margin-bottom: 5px; font-weight: 600; } 
        #purecloud-script-tools-panel textarea { background: var(--purecloud-script-bg-primary); color: var(--purecloud-script-text-primary); border: 1px solid var(--purecloud-script-border-color); padding: 8px 10px; border-radius: 4px; transition: border-color 0.2s; width: 100%; box-sizing: border-box; font-size: 13px; font-family: inherit; resize: none; outline: none; } 
        #purecloud-script-tools-panel textarea:focus { border-color: var(--purecloud-script-accent-color); box-shadow: 0 0 0 2px rgba(76, 175, 80, 0.2); }
        #purecloud-script-tools-panel .purecloud-script-tabs { display: flex; background: var(--purecloud-script-bg-secondary); border-bottom: 1px solid var(--purecloud-script-border-color); padding-left: 10px; flex-wrap: wrap;} 
        #purecloud-script-tools-panel .purecloud-script-tab-button { flex: 1; padding: 10px 15px; text-align: center; background-color: transparent; color: var(--purecloud-script-text-secondary); border: none; cursor: pointer; transition: color 0.2s ease, border-bottom 0.2s ease; font-size: 0.95em; font-weight: 500; display: flex; justify-content: center; align-items: center; gap: 6px; white-space: nowrap; border-bottom: 2px solid transparent; border-radius: 0; box-shadow: none; margin-right: 0px; } 
        #purecloud-script-tools-panel .purecloud-script-tab-button.active { color: var(--purecloud-script-text-primary); border-bottom: 2px solid var(--purecloud-script-accent-color); font-weight: bold; background-color: transparent;} 
        #purecloud-script-tools-panel .purecloud-script-tab-button:hover:not(.active) { color: var(--purecloud-script-text-primary); } 
        #purecloud-script-tools-panel .purecloud-script-tab-content { display: none; padding-top: 15px; flex-direction: column; flex-grow: 1; } 
        #purecloud-script-tools-panel .purecloud-script-tab-content.active { display: flex; }
    `;

            const blockStyle = document.createElement('style');
            blockStyle.textContent = FERRAMENTAS_CSS;
            document.head.appendChild(blockStyle);

            function makeDraggable(element, handle, keyName) {
                if (!handle) handle = element;
                let isDragging = false, dragOffsetX = 0, dragOffsetY = 0;

                let moveHandler = (e) => {
                    if (!isDragging) return;
                    e.preventDefault();

                    let newLeft = e.clientX - dragOffsetX;
                    let newTop = e.clientY - dragOffsetY;

                    const rect = element.getBoundingClientRect();
                    if (newLeft < 0) newLeft = 0;
                    if (newTop < 0) newTop = 0;
                    if (newLeft + rect.width > window.innerWidth) newLeft = window.innerWidth - rect.width;
                    if (newTop + rect.height > window.innerHeight) newTop = window.innerHeight - rect.height;

                    element.style.left = newLeft + 'px';
                    element.style.top = newTop + 'px';
                };

                let upHandler = () => {
                    if (isDragging) {
                        isDragging = false;
                    }
                };

                handle.addEventListener('mousedown', (e) => {
                    if (e.target.tagName === 'BUTTON' || e.target.tagName === 'INPUT' || e.target.closest('.os-btn') || e.target.closest('button')) return;
                    e.preventDefault();
                    isDragging = true;

                    element.style.transition = 'none';
                    element.style.transform = 'none';
                    element.style.margin = '0';

                    const rect = element.getBoundingClientRect();
                    element.style.left = rect.left + 'px';
                    element.style.top = rect.top + 'px';
                    element.style.bottom = 'auto';
                    element.style.right = 'auto';

                    dragOffsetX = e.clientX - rect.left;
                    dragOffsetY = e.clientY - rect.top;
                }, { passive: false });

                // Ensure we don't bind multiple identical listeners if makeDraggable is called multiple times on the same element
                // A quick hack is just bind it globally, it naturally ignores when isDragging is false.
                document.addEventListener('mousemove', moveHandler, { passive: false });
                document.addEventListener('mouseup', upHandler);
            }

            // Cria notificação via DOM
            function notify(message, type = "info", timeout = 5000) {
                // Pode linkar com a funcção de toast do cronometros ou gerar uma própria.
                // Vamos usar window.alert ou console para não perder.
                console.log(`[Painel Ferramentas] ${type}: ${message}`);
            }

            // Funcao exposta no window
            window.UI_tools = {
                createAgentToolsPanel: function () {
                    let panel = document.getElementById('purecloud-script-tools-panel');
                    if (!panel) {
                        panel = document.createElement('div');
                        panel.id = 'purecloud-script-tools-panel';
                        panel.className = 'purecloud-script-popup';
                        panel.innerHTML = `
                    <div class="panel-header">
                        <h2>🛠️ Ferramentas do Agente</h2>
                        <div class="panel-header-buttons">
                            <button class="panel-header-btn" id="closeToolsBtn" title="Minimizar">X</button>
                        </div>
                    </div>
                    <div class="purecloud-script-tabs">
                        <button class="purecloud-script-tab-button active" data-tab="notepad">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width: 18px; height: 18px;"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg> B. Notas
                        </button>

                        <button class="purecloud-script-tab-button" data-tab="reminders">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width: 18px; height: 18px;"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg> Lembretes
                        </button>
                        <button class="purecloud-script-tab-button" data-tab="historico">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width: 18px; height: 18px;"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg> Histórico
                        </button>
                        <button class="purecloud-script-tab-button" data-tab="links">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width: 18px; height: 18px;"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"></path><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"></path></svg> Links
                        </button>
                    </div>
                    <div class="panel-content" style="padding: 15px;">
                        <div class="purecloud-script-tab-content active" data-tab-content="notepad">
                            <div class="settings-group" style="height: 100%; margin: 0; display: flex; flex-direction: column;">
                                <textarea id="tools-notepad" placeholder="Faça anotações rápidas aqui..." style="flex-grow: 1; min-height: 160px; resize: none; border-bottom-left-radius: 0; border-bottom-right-radius: 0; margin-bottom: 0; border-bottom: none;"></textarea>
                                <div style="display: flex; background: var(--purecloud-script-bg-primary); border: 1px solid var(--purecloud-script-border-color); border-radius: 0 0 8px 8px; border-top: none; padding: 6px; gap: 6px;">
                                    <button id="btn-notepad-fetch" class="purecloud-script-button" style="flex: 1; padding: 6px; background: var(--purecloud-script-bg-secondary); color: var(--purecloud-script-text-primary); border: 1px solid var(--purecloud-script-border-color); font-size: 0.85em; box-shadow: none;" title="Puxar dados da tela">📎 Puxar</button>
                                    <button id="btn-notepad-copy" class="purecloud-script-button" style="flex: 1; padding: 6px; font-size: 0.85em; box-shadow: none;" title="Copiar anotações">📋 Copiar</button>
                                    <button id="btn-notepad-clear" class="purecloud-script-button" style="background: var(--purecloud-script-error-color, #ef4444); padding: 6px 12px; box-shadow: none;" title="Limpar tudo">🗑️</button>
                                </div>
                            </div>
                        </div>

                        <div class="purecloud-script-tab-content" data-tab-content="reminders">
                            <p style="font-size: 0.9em; margin-top:0; margin-bottom: 12px; color: var(--purecloud-script-text-secondary);">
                                Configura um alarme para voltar e falar com o cliente.
                            </p>
                            <div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 10px;">
                                <button class="purecloud-script-button btn-lembrete" data-time="1">1 Min</button>
                                <button class="purecloud-script-button btn-lembrete" data-time="3">3 Min</button>
                                <button class="purecloud-script-button btn-lembrete" data-time="5">5 Min</button>
                            </div>
                        </div>

                        <div class="purecloud-script-tab-content" data-tab-content="historico">
                            <p style="font-size: 0.85em; margin-top:0; margin-bottom: 8px; color: var(--purecloud-script-text-secondary);">Pressione <b>F2</b> para copiar CPF/CNPJ da tela e salvar aqui.</p>
                            <div id="historico-id-list" style="display:flex; flex-direction:column; gap:8px; max-height: 200px; overflow-y: auto;"></div>
                            <button id="btn-clear-history" class="purecloud-script-button" style="width: 100%; margin-top: 10px; padding: 6px; background: var(--purecloud-script-error-color, #ef4444); color: white; border: none; font-size: 0.85em;">🗑️ Limpar Histórico</button>
                        </div>

                        <div class="purecloud-script-tab-content" data-tab-content="links">
                            <div id="useful-links-list" style="display:flex; flex-direction:column; gap:8px;"></div>
                        </div>
                    </div>
                `;

                        document.body.appendChild(panel);
                        makeDraggable(panel, panel.querySelector('.panel-header'), 'toolsPanel');

                        // Recenter
                        panel.style.top = '100px';
                        panel.style.left = '100px';

                        panel.querySelector('#closeToolsBtn').onclick = () => { 
                            panel.style.display = 'none'; 
                            if (window.spellCheckerModule) window.spellCheckerModule.ocultarTudo();
                        };

                        const USEFUL_LINKS = [
                            { title: "Consulta Base de Conhecimento", url: "https://example.com/kb", color: "#4B5563" },
                            { title: "Calculadora", url: "https://example.com/calc", color: "#3B82F6" }
                        ];

                        // Lógica Extrator F2 e Histórico
                        const refreshHistoryUI = () => {
                            const list = panel.querySelector('#historico-id-list');
                            list.innerHTML = '';
                            let history = [];
                            try { history = JSON.parse(localStorage.getItem('purecloudScript_idHistory') || '[]'); } catch (e) { }

                            if (history.length === 0) {
                                list.innerHTML = '<span style="color:var(--purecloud-script-text-secondary); font-size:0.85em;">Nenhum documento salvo ainda.</span>';
                                return;
                            }

                            history.forEach((item, index) => {
                                const btn = document.createElement('button');
                                btn.className = 'purecloud-script-button';
                                btn.style.cssText = `text-align: left; padding: 8px; font-size: 0.85em; background: var(--purecloud-script-bg-secondary); color: var(--purecloud-script-text-primary); border: 1px solid var(--purecloud-script-border-color); display: flex; justify-content: space-between;`;
                                btn.innerHTML = `<span><strong>${item.doc}</strong> (${item.tipo})</span> <span style="color:var(--purecloud-script-text-secondary);">${item.hora}</span>`;
                                btn.onclick = () => {
                                    navigator.clipboard.writeText(item.doc);
                                    btn.innerHTML = `<span><strong>Copiado!</strong> ✅</span> <span style="color:var(--purecloud-script-text-secondary);">${item.hora}</span>`;
                                    setTimeout(() => refreshHistoryUI(), 1000);
                                };
                                list.appendChild(btn);
                            });
                        };

                        panel.querySelector('#btn-clear-history').onclick = () => {
                            localStorage.removeItem('purecloudScript_idHistory');
                            refreshHistoryUI();
                        };

                        refreshHistoryUI();

                        const switchToolsTab = (tabId) => {
                            panel.querySelectorAll('.purecloud-script-tab-button').forEach(btn => btn.classList.remove('active'));
                            panel.querySelectorAll('.purecloud-script-tab-content').forEach(content => content.classList.remove('active'));
                            panel.querySelector(`.purecloud-script-tab-button[data-tab="${tabId}"]`)?.classList.add('active');
                            panel.querySelector(`[data-tab-content="${tabId}"]`)?.classList.add('active');
                        };

                        panel.querySelectorAll('.purecloud-script-tab-button').forEach(btn => {
                            btn.onclick = () => switchToolsTab(btn.dataset.tab);
                        });

                        // ==== LÓGICA DO EXTRATOR DE DOCUMENTOS (F2) ====
                        function validarCPF_Ext(cpf) {
                            cpf = cpf.replace(/[^\d]+/g, '');
                            if (cpf.length !== 11 || /^(\d)\1+$/.test(cpf)) return false;
                            let soma = 0, resto;
                            for (let i = 1; i <= 9; i++) soma = soma + parseInt(cpf.substring(i - 1, i)) * (11 - i);
                            resto = (soma * 10) % 11; if (resto === 10 || resto === 11) resto = 0;
                            if (resto !== parseInt(cpf.substring(9, 10))) return false;
                            soma = 0;
                            for (let i = 1; i <= 10; i++) soma = soma + parseInt(cpf.substring(i - 1, i)) * (12 - i);
                            resto = (soma * 10) % 11; if (resto === 10 || resto === 11) resto = 0;
                            if (resto !== parseInt(cpf.substring(10, 11))) return false;
                            return true;
                        }

                        function validarCNPJ_Ext(cnpj) {
                            cnpj = cnpj.replace(/[^\d]+/g, '');
                            if (cnpj.length !== 14 || /^(\d)\1+$/.test(cnpj)) return false;
                            let tamanho = cnpj.length - 2, numeros = cnpj.substring(0, tamanho), digitos = cnpj.substring(tamanho), soma = 0, pos = tamanho - 7;
                            for (let i = tamanho; i >= 1; i--) { soma += numeros.charAt(tamanho - i) * pos--; if (pos < 2) pos = 9; }
                            let resultado = soma % 11 < 2 ? 0 : 11 - soma % 11;
                            if (resultado != digitos.charAt(0)) return false;
                            tamanho = tamanho + 1; numeros = cnpj.substring(0, tamanho); soma = 0; pos = tamanho - 7;
                            for (let i = tamanho; i >= 1; i--) { soma += numeros.charAt(tamanho - i) * pos--; if (pos < 2) pos = 9; }
                            resultado = soma % 11 < 2 ? 0 : 11 - soma % 11;
                            if (resultado != digitos.charAt(1)) return false;
                            return true;
                        }

                        function buscarMelhorDocumento() {
                            let textoTotal = document.body.innerText + " ";
                            document.querySelectorAll('iframe').forEach(ifr => {
                                try { textoTotal += " " + (ifr.contentDocument || ifr.contentWindow.document).body.innerText + " "; } catch (e) { }
                            });

                            const regexDoc = /(?<!\d)(\d{3}\.?\d{3}\.?\d{3}-?\d{2})(?!\d)|(?<!\d)(\d{2}\.?\d{3}\.?\d{3}\/?\d{4}-?\d{2})(?!\d)/g;
                            const encontrados = textoTotal.match(regexDoc);
                            if (!encontrados) return null;

                            let melhorCandidato = null, maiorPontuacao = -1000;
                            encontrados.forEach(rawDoc => {
                                const docLimpo = rawDoc.replace(/\D/g, '');
                                let ehValido = false;
                                if (docLimpo.length === 11 && validarCPF_Ext(docLimpo)) ehValido = true;
                                if (docLimpo.length === 14 && validarCNPJ_Ext(docLimpo)) ehValido = true;
                                if (!ehValido) return;

                                let pontos = 0;
                                const index = textoTotal.indexOf(rawDoc);
                                const contexto = textoTotal.substring(Math.max(0, index - 60), index + rawDoc.length + 60).toLowerCase();

                                if (contexto.includes('cpf') || contexto.includes('cnpj') || contexto.includes('documento')) pontos += 200;
                                if (contexto.includes('cliente') || contexto.includes('titular')) pontos += 50;
                                if (rawDoc.includes('.') || rawDoc.includes('-')) pontos += 50;
                                if (contexto.includes('tel') || contexto.includes('cel') || contexto.includes('zap')) pontos -= 1000;
                                if (contexto.includes('documento:')) pontos += 500;
                                pontos += 5;

                                if (pontos > maiorPontuacao) {
                                    maiorPontuacao = pontos;
                                    melhorCandidato = docLimpo;
                                }
                            });
                            return maiorPontuacao > -500 ? melhorCandidato : null;
                        }

                        // Substitui globalmente a funcao
                        window.executarExtracaoDocumento = function () {
                            const documento = buscarMelhorDocumento();
                            if (documento) {
                                const tipo = documento.length === 11 ? 'CPF' : 'CNPJ';
                                navigator.clipboard.writeText(documento).then(() => {
                                    notify(`📋 ${tipo} Copiado: ${documento}`, 'success');
                                    // Salva no histórico
                                    let history = [];
                                    try { history = JSON.parse(localStorage.getItem('purecloudScript_idHistory') || '[]'); } catch (e) { }
                                    // Adiciona no topo
                                    history.unshift({
                                        doc: documento,
                                        tipo: tipo,
                                        hora: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
                                    });
                                    if (history.length > 30) history.pop(); // Limita 30
                                    localStorage.setItem('purecloudScript_idHistory', JSON.stringify(history));
                                    refreshHistoryUI();
                                });
                            } else {
                                notify("Nenhum CPF/CNPJ válido encontrado.", 'error');
                            }
                        };

                        // Atalho global F2 APENAS SE AINDA NÃO EXISTIR
                        if (!window._f2ExtractorAttached) {
                            window._f2ExtractorAttached = true;
                            document.addEventListener('keydown', (e) => {
                                if (e.key === 'F2') {
                                    e.preventDefault(); e.stopPropagation();
                                    window.executarExtracaoDocumento();
                                }
                            });
                        }
                        // ============================================

                        // Notepad
                        const notepad = panel.querySelector('#tools-notepad');
                        notepad.value = localStorage.getItem('purecloudScript_notepad') || '';
                        notepad.addEventListener('input', (e) => { localStorage.setItem('purecloudScript_notepad', e.target.value); });

                        panel.querySelector('#btn-notepad-clear').onclick = () => { notepad.value = ''; notepad.dispatchEvent(new Event('input')); };
                        panel.querySelector('#btn-notepad-copy').onclick = async () => {
                            try {
                                await navigator.clipboard.writeText(notepad.value);
                                const btn = panel.querySelector('#btn-notepad-copy');
                                btn.innerText = '✅ Copiado';
                                setTimeout(() => btn.innerText = '📋 Copiar', 2000);
                            } catch (e) { notify("Erro ao copiar", "error"); }
                        };

                        panel.querySelector('#btn-notepad-fetch').onclick = () => {
                            let rawText = document.body.innerText + " ";
                            document.querySelectorAll('iframe').forEach(ifr => {
                                try { rawText += " " + (ifr.contentDocument || ifr.contentWindow.document).body.innerText + " "; } catch (e) { }
                            });

                            let nome = "Cliente", cpf = "Não encontrado", prot = "Não encontrado", tel = "Não encontrado";

                            const cpfMatch = rawText.match(/(?:CPF|CNPJ)[\s:]*([\d\.\-\/]+)/i) || rawText.match(/\d{3}\.\d{3}\.\d{3}\-\d{2}/);
                            if (cpfMatch) cpf = (cpfMatch[1] || cpfMatch[0]).replace(/[^\d\.\-\/]/g, '');

                            const protMatch = rawText.match(/(?:Protocolo)[\s:]*(\d{10,})/i) || rawText.match(/202[456]\d{8,}/);
                            if (protMatch) prot = protMatch[1] || protMatch[0];

                            const telMatch = rawText.match(/(?:Telefone|Celular|Contato)[\s:]*(\(?\d{2}\)?\s?\d{4,5}-?\d{4})/i);
                            if (telMatch) tel = (telMatch[1] || telMatch[0]).trim();

                            const nameMatch = rawText.match(/(?:Nome|Cliente|Titular)[\s:]*([A-ZÀ-Ú][a-zà-ú]+(?:[ ]+[A-ZÀ-Úa-zà-ú]+)+)/i);
                            if (nameMatch) nome = nameMatch[1].trim();

                            const contentToAppend = `👤 Nome: ${nome}\n🆔 CPF/CNPJ: ${cpf}\n📱 Tel: ${tel}\n🎫 Prot: ${prot}\n\n`;
                            notepad.value = contentToAppend + notepad.value;
                            notepad.dispatchEvent(new Event('input'));

                            const btn = panel.querySelector('#btn-notepad-fetch');
                            btn.innerText = '✅ Feito';
                            setTimeout(() => btn.innerText = '📎 Puxar', 2000);
                        };

                        // Populando Links Úteis
                        const linksList = panel.querySelector('#useful-links-list');
                        USEFUL_LINKS.forEach(link => {
                            const btn = document.createElement('button'); btn.className = 'purecloud-script-button';
                            btn.style.cssText = `text-align:center; padding: 10px; background:${link.color}; color:#fff; border:none; margin-bottom: 5px; font-weight: bold;`;
                            btn.textContent = link.title;
                            btn.onclick = () => window.open(link.url, '_blank');
                            linksList.appendChild(btn);
                        });

                        // Lógica dos Lembretes
                        panel.querySelectorAll('.btn-lembrete').forEach(btn => {
                            btn.onclick = (e) => {
                                const minutes = parseInt(e.target.dataset.time);
                                notify(`Alarme configurado! Avisarei em ${minutes} minuto(s).`, "success");

                                setTimeout(() => {
                                    // Play beep / alert
                                    if (window.audioNotificacao) { window.audioNotificacao.play().catch(e => { }); }
                                    alert(`⏰ HORA DE RETORNAR! Verifique o chat do cliente.`);
                                }, minutes * 60000);
                            };
                        });
                    } else {
                        panel.style.display = panel.style.display === 'none' ? 'flex' : 'none';
                    }
                }
            };
        })();

    } catch (e) { console.error('[BUILDER] Erro fatal no módulo ferramentas.js:', e); }

    /* --- MÓDULO ANEXADO: CENTRAL.JS --- */
    try {
        // ==UserScript==
        // @name         PureCloud - Central de Conhecimento (Módulo Extensão)
        // @description  Base completa de conhecimento integrada ao Menu Unificado.
        // ==/UserScript==

        (function () {
            'use strict';

            // ... (SEUS DADOS 'BRISA_DB' E OS TEMPLATES 'TPL' FICAM AQUI) ...
            // ... (Vou omitir os dados para economizar espaço, mas MANTENHA-OS) ...
            const TPL = {
                sistema: (t, s, c, l) => `<div class="wiki-content system-theme"><div class="wiki-header"><h3 style="color:#8be9fd;">🖥️ ${t}</h3><p class="wiki-subtitle">${s}</p></div><div class="wiki-body">${c}</div>${l && l !== '#' ? `<div class="wiki-footer"><a href="${l}" target="_blank" class="btn-acesso purecloud-script-button">Acessar Agora ↗</a></div>` : ''}</div>`,
                produto: (t, s, c) => `<div class="wiki-content product-theme"><div class="wiki-header"><h3 style="color:#f1fa8c;">📦 ${t}</h3><p class="wiki-subtitle">${s}</p></div><div class="wiki-body">${c}</div></div>`,
                tecnico: (t, r, c, l) => `<div class="wiki-content tech-theme"><div class="wiki-header"><h3 style="color:#ff79c6;">🛠️ ${t}</h3></div><div class="wiki-summary"><strong>RESUMO:</strong> ${r}</div><div class="wiki-body">${c}</div>${l ? `<div class="wiki-footer"><a href="${l}" target="_blank" class="btn-acesso purecloud-script-button">Abrir Documento/Link ↗</a></div>` : ''}</div>`
            };

            // 2. BANCO DE DADOS COMPLETO
            const BRISA_DB = {
                systems: [
                    { label: "YODA", icon: "🧙‍♂️", desc: "ERP Central", url: "https://revan-atendimento.brisanet.net.br/#/yoda/dashboard", details: TPL.sistema("YODA", "Gestão Integrada", `<h4>📌 Funções Principais:</h4><ul><li><b>Financeiro:</b> Verificação de faturas, desbloqueio em confiança e negociação.</li><li><b>Contratos:</b> Status do cliente (Ativo, Bloqueado, Cancelado).</li><li><b>Provisionamento:</b> Reenvio de comandos para a ONU/Modem.</li></ul><p><b>Dica:</b> Sempre verifique se há "OS em Aberto" antes de criar um novo atendimento.</p>`, "https://revan-atendimento.brisanet.net.br/#/yoda/dashboard") },
                    { label: "Genesys", icon: "☁️", desc: "Telefonia", url: "https://apps.sae1.pure.cloud/directory/", details: TPL.sistema("Genesys Cloud", "Contact Center", `<h4>📌 Status do Agente:</h4><ul><li><b>On Queue (Na Fila):</b> Pronto para receber chamadas.</li><li><b>ACW (Pós-atendimento):</b> Tempo para tabular o chamado anterior.</li></ul><p>Se o áudio falhar, pressione F5 ou limpe o cache.</p>`, "https://apps.sae1.pure.cloud/directory/") },
                    { label: "LTM (FWA)", icon: "⚙️", desc: "Gestão 5G", url: "https://mae-ltm.brisanet.net.br/unisso/login.action", details: TPL.tecnico("LTM (Axess)", "Gestão de Modems 5G/4G", `<h4>📡 Parâmetros de Sinal (RSRP):</h4><ul><li><b>-50 a -90 dBm:</b> Excelente.</li><li><b>-91 a -105 dBm:</b> Bom/Regular.</li><li><b>-110 dBm ou mais:</b> Sinal Crítico (Lentidão). Tentar reposicionar o equipamento.</li></ul>`, "https://mae-ltm.brisanet.net.br/unisso/login.action") },
                    { label: "PASTOR", icon: "🐑", desc: "Rede Externa", url: "https://pastor.brisanet.net.br/#/authentication/login", details: TPL.sistema("PASTOR", "Mapeamento", "<p>Georreferenciamento de rede, CTOs e viabilidade técnica.</p>", "https://pastor.brisanet.net.br/#/authentication/login") },
                    { label: "Raumil", icon: "📡", desc: "Campo", url: "https://raumil.brisanet.net.br/#/login", details: TPL.sistema("Raumil", "Field Service", "<p>Gestão de técnicos de campo e OS.</p>", "https://raumil.brisanet.net.br/#/login") },
                    { label: "SASKI", icon: "🧩", desc: "Estoque", url: "https://saski.brisanet.net.br/", details: TPL.sistema("SASKI", "Logística", "<p>Controle de patrimônio e equipamentos.</p>", "https://saski.brisanet.net.br/") },
                    { label: "Meu RH", icon: "👥", desc: "Colaborador", url: "https://brisanetservicos138386.rm.cloudtotvs.com.br/FrameHTML/web/app/RH/PortalMeuRH/#/login", details: TPL.sistema("Meu RH", "Autoatendimento", "<p>Contracheques, ponto e férias.</p>", "https://brisanetservicos138386.rm.cloudtotvs.com.br/FrameHTML/web/app/RH/PortalMeuRH/#/login") },
                    { label: "Jira", icon: "🎫", desc: "Chamados TI", url: "https://brisanet.atlassian.net/servicedesk/customer/portals", details: TPL.sistema("Jira Service", "Suporte Interno", "<p>Abertura de chamados para TI e Sistemas.</p>", "https://brisanet.atlassian.net/servicedesk/customer/portals") },
                    { label: "Looker", icon: "📊", desc: "Métricas", url: "https://lookerstudio.google.com/reporting/b16d26d9-a2c7-48d3-b595-d39737b610ca/page/p_icvajs4fjd?pli=1", details: TPL.sistema("Looker", "Dashboard", "<p>Acompanhamento de métricas (TMA, TME).</p>", "https://lookerstudio.google.com/reporting/b16d26d9-a2c7-48d3-b595-d39737b610ca/page/p_icvajs4fjd?pli=1") }
                ],
                materials: [
                    { label: "Mapa Cobertura 1", icon: "🗺️", desc: "Google Maps", details: TPL.sistema("Mapa 1", "Cobertura Técnica", "<p>Mapa operacional.</p>", "https://www.google.com/maps/d/viewer?mid=1rmfAe5YTRjsPeN9tnkZJzsj3fNGC7QI&femb=1&ll=-5.3780124559692535%2C-36.970868593510744&z=8") },
                    { label: "Mapa Cobertura 2", icon: "🗺️", desc: "Google Maps", details: TPL.sistema("Mapa 2", "Cobertura Técnica", "<p>Mapa operacional.</p>", "https://www.google.com/maps/d/u/0/viewer?hl=pt-BR&ll=-6.02942900614608%2C-38.38409606722841&z=12&mid=1ZaOEDR9_2xOACjZoip1xFkBstS_SSqo") },
                    { label: "Site Cobertura", icon: "🌐", desc: "Site Oficial", details: TPL.sistema("Site Brisanet", "Viabilidade", "<p>Consulta pública de cobertura.</p>", "https://www.brisanet.com.br/mapa-de-area-de-cobertura") },
                    { label: "Abertura IMOC", icon: "📝", desc: "Incidentes", details: TPL.sistema("IMOC", "Abertura de Chamado", "<p>Para eventos massivos e manutenção de rede.</p>", "https://docs.google.com/forms/d/e/1FAIpQLSdOStjaDN5FZ73EaIYCxvA5PA5S3uPqWWWdaOM4ltNzzAamFQ/viewform") },
                    { label: "Regularização Drop", icon: "➰", desc: "Manutenção", details: TPL.sistema("Cabo Drop", "Manutenção", "<p>Solicitar reparo de cabos baixos ou partidos.</p>", "https://docs.google.com/forms/d/e/1FAIpQLSezeLhFUVyh-3W1mkPAxUOBp623O5Yx6Re12vcH0jKpSUFE2g/viewform") },
                    { label: "Reagendamento", icon: "📆", desc: "Solicitação", details: TPL.sistema("Reagendamento", "Reporte", "<p>Quando o agendamento muda sem aviso.</p>", "https://docs.google.com/forms/d/e/1FAIpQLSfN-rzjuS2unjZiIhxfxIdyhlU_S7ypfqh_NwWWLeDTlIKQZg/viewform") },
                    { label: "Cobrança Prazo", icon: "⏰", desc: "SLA", details: TPL.sistema("Cobrança SLA", "Atraso", "<p>Cobrar chamados fora do prazo.</p>", "https://docs.google.com/forms/d/e/1FAIpQLSf7C6JvJW4O-0fodj2rsymzLauNDpMMZIA6Or7ZSri5jS18aQ/viewform") },
                    { label: "Planilha Apoio", icon: "📑", desc: "Geral", details: TPL.sistema("Planilha Apoio", "Controle", "<p>Planilha de apoio operacional.</p>", "https://docs.google.com/spreadsheets/d/1c0BbUVV7oI3f4v3hA-ONea_jJoeqvpBU8mandBEQeR0/edit?gid=1798580531#gid=1798580531") },
                    { label: "Códigos", icon: "🔢", desc: "Tabulação", details: TPL.sistema("Códigos", "Encerramento", "<p>Lista de códigos de tabulação.</p>", "https://docs.google.com/spreadsheets/d/108CeKc84WUCiP0Np6F8htHgwy7Y37jqlCq24LC0Y6no/edit?gid=769704755#gid=769704755") },
                    { label: "Escala", icon: "📅", desc: "Turnos", details: TPL.sistema("Escala", "Horários", "<p>Escala de trabalho da equipe.</p>", "https://docs.google.com/spreadsheets/d/1EKO1APFQXNAjdEzwpC1naoYR4wKUYqj6vYUGGDdihmM/edit?gid=0#gid=0") },
                    { label: "Ramais", icon: "☎️", desc: "Contatos", details: TPL.sistema("Lista de Ramais", "Interno", "<p>Lista de contatos corporativos.</p>", "https://docs.google.com/spreadsheets/d/1-QKtRfxW0EQWTFs967N6EYrvkMDUG4d7gfQNY-uiZ2g/edit?gid=1764454763#gid=1764454763") },
                    { label: "Vagas", icon: "💼", desc: "RH", details: TPL.sistema("Vagas", "Indicação", "<p>Planilha de indicação de vagas.</p>", "https://docs.google.com/spreadsheets/d/17Scc98dmXg8-9bSiSu4ujP1Ig_J51e5Deqj9CD42QiA/edit?gid=1615271674#gid=1615271674") }
                ],
                products_list: [
                    { label: "Netflix", icon: "🔴", desc: "Filmes e Séries", details: TPL.produto("Netflix", "Parceria via Fatura", `<h4>🔑 Como Ativar:</h4><p>O cliente recebe um <b>SMS ou E-mail</b> com o link de ativação após a instalação. Caso não encontre, pode acessar a área do cliente (App Brisanet).</p><h4>⚠️ Problemas Comuns:</h4><ul><li><b>"Atualize sua forma de pagamento":</b> O vínculo com a provedora caiu. Verifique no YODA se o contrato está ativo e peça para o cliente refazer o login pelo link da parceria.</li><li><b>Login em Smart TV:</b> O cliente deve usar o e-mail e senha cadastrados na Netflix, <b>NÃO</b> a senha da central do assinante.</li><li><b>Planos:</b> Padrão (2 telas, HD) | Premium (4 telas, 4K).</li></ul>`) },
                    { label: "Globoplay", icon: "🌍", desc: "Globo e Canais", details: TPL.produto("Globoplay", "Streaming + Canais Ao Vivo", `<h4>🔑 Regras de Acesso:</h4><p>Acesse <b>globoplay.globo.com</b> > Clique no ícone de perfil > "Entrar" > Selecione "Entrar com Operadora" > Escolha Brisanet.</p><h4>🛠️ Erros Conhecidos:</h4><ul><li><b>Erro "Não autorizado" (Canais ao vivo):</b> O cliente provavelmente tem o pacote "Padrão" (só VOD) e está tentando assistir Sportv/Premiere. Confirme a venda.</li><li><b>Erro de Geolocalização (Mobile):</b> O GPS deve estar ativo.</li><li><b>Smart TV:</b> Algumas TVs antigas (antes de 2017) não rodam canais ao vivo, apenas filmes gravados.</li></ul>`) },
                    { label: "Paramount+", icon: "🏔️", desc: "Séries Premium", details: TPL.produto("Paramount+", "Conteúdo CBS/Viacom", `<h4>🎬 O que inclui:</h4><p>Filmes blockbusters, séries exclusivas (Handmaid's Tale, Star Trek) e conteúdo MTV/Nickelodeon.</p><h4>🔑 Acesso:</h4><p>No site/app Paramount+, selecione "Fazer login com parceiro" (Sign in with Partner) e busque por Brisanet.</p>`) },
                    { label: "FWA 5G", icon: "📡", desc: "Internet Rural/Móvel", details: TPL.produto("FWA 5G (Internet Air)", "Sem Cabos / Plug & Play", `<h4>📌 Como Funciona:</h4><p>Um modem (CPE) que capta sinal 4G/5G da torre e cria um Wi-Fi. Ideal para zonas rurais ou onde não passa fibra.</p><h4>⚠️ Atenção à Franquia:</h4><p>Diferente da fibra, este plano possui <b>LIMITE DE DADOS</b> (ex: 400GB). Se o cliente assistir Netflix 4K o dia todo, a internet vai acabar e a velocidade será reduzida.</p><h4>💡 Dica de Sinal:</h4><p>O modem deve ficar próximo à janela ou em local alto. Paredes grossas bloqueiam o sinal 5G.</p>`) },
                    { label: "Fibra (FTTH)", icon: "⚡", desc: "Internet Fixa", details: TPL.produto("Brisa Fibra", "Fiber To The Home", `<h4>🚀 Características:</h4><p>Fibra óptica ponta a ponta (dentro da casa do cliente). Baixa latência (ping) e alta estabilidade.</p><h4>🐢 Cliente reclama de lentidão?</h4><ul><li><b>Teste no Wi-Fi:</b> Não garante velocidade contratada (interferências).</li><li><b>Teste no Cabo:</b> É o único que valida a entrega da banda.</li><li><b>Limitação de Hardware:</b> Celulares/PCs antigos não passam de 40Mbps mesmo em planos de 500Mbps.</li></ul>`) },
                    { label: "Brisafixo", icon: "☎️", desc: "Telefonia Fixa", details: TPL.produto("Brisafixo (VoIP)", "Voz sobre IP", `<h4>📞 Instalação:</h4><p>O aparelho telefônico é conectado na porta <b>TEL1</b> da ONU/Modem. Não usa fiação telefônica antiga da rua.</p><h4>🛠️ Diagnóstico:</h4><ul><li><b>Mudo:</b> Verifique se o LED "TEL" na ONU está aceso fixo. Se piscar ou apagar, há falha de registro (Provisionamento).</li><li><b>Chiado:</b> Geralmente é defeito no aparelho telefônico ou cabo espiral do cliente, não na linha.</li></ul>`) },
                    { label: "Móvel 5G", icon: "📱", desc: "Chips e Planos", details: TPL.produto("Brisa Móvel", "Telefonia Celular", `<h4>📲 Tipos de Chip:</h4><ul><li><b>SIM Card Físico:</b> Chip tradicional.</li><li><b>eSIM:</b> Chip virtual (ativado por QR Code). Exige celular compatível.</li></ul><h4>⚙️ Configuração (APN):</h4><p>Se a internet não funcionar, configure a APN: <b>nome: brisanet / apn: brisanet.br</b>.</p><p><b>Roaming:</b> Para usar fora da área de cobertura própria, ativar "Dados em Roaming" no celular.</p>`) },
                    { label: "Brisamusic", icon: "🎵", desc: "App de Música", details: TPL.produto("Brisamusic", "Streaming de Áudio", `<h4>🎧 O Produto:</h4><p>Concorrente do Spotify/Deezer. Permite baixar músicas para ouvir offline e não tem anúncios.</p><h4>🔑 Acesso:</h4><p>Baixar o app na loja (Play Store/App Store) e logar com as credenciais da Central do Assinante.</p>`) },
                    { label: "Premiere", icon: "⚽", desc: "Futebol", details: TPL.produto("Premiere", "Pay-per-view", "Campeonato Brasileiro.") },
                    { label: "Telecine", icon: "🍿", desc: "Filmes", details: TPL.produto("Telecine", "Cinema", "6 canais de filmes.") },
                    { label: "Saúde 24hs", icon: "🩺", desc: "Telemedicina", details: TPL.produto("Saúde 24hs", "Médico", "Consultas online sem carência.") },
                    { label: "Skeelo", icon: "📚", desc: "Ebooks", details: TPL.produto("Skeelo", "Livros", "Cliente ganha 1 livro digital por mês.") },
                    { label: "Taplingo", icon: "🗣️", desc: "Idiomas", details: TPL.produto("Taplingo", "Cursos", "App de aprendizado de inglês/espanhol.") },
                    { label: "Reforça", icon: "🎓", desc: "Escolar", details: TPL.produto("Reforça", "Educação", "Reforço escolar online.") },
                    { label: "EXA Segurança", icon: "🛡️", desc: "Antivírus", details: TPL.produto("EXA", "Proteção", "Antivírus e VPN para o cliente.") },
                    { label: "Max", icon: "🟣", desc: "HBO", details: TPL.produto("Max", "Streaming", "Antiga HBO Max. Filmes Warner e DC.") }
                ],
                manuals: [
                    { label: "Lentidão", icon: "🐢", desc: "Diagnóstico", details: TPL.tecnico("Lentidão", "Procedimento Obrigatório", `<h4>1. Como testar:</h4><p>O teste deve ser feito via <b>CABO DE REDE (RJ45)</b>. Testes via Wi-Fi não garantem banda contratada.</p><h4>2. Sites Homologados:</h4><p>Utilize <a href="https://fast.com/pt" target="_blank">Fast.com</a> ou <a href="https://www.speedtest.net/" target="_blank">Speedtest</a> (Servidor Brisanet).</p><h4>3. Conclusão:</h4><p>Se a velocidade bater no cabo e não no Wi-Fi, o problema é interferência ou limitação do dispositivo do cliente.</p>`, "https://docs.google.com/document/d/1ryKjpd4lKW1UttU_HxUlRZimCF6R5shqFOvi3b_E4B0/edit?usp=sharing") },
                    { label: "Sem Conexão", icon: "🚫", desc: "Queda Total", details: TPL.tecnico("Cliente sem Acesso", "Verificação de LEDs", `<h4>LED PON Piscando:</h4><p>Sinal atenuado (fibra suja ou dobrada). Agendar visita.</p><h4>LED LOS Vermelho:</h4><p>Rompimento de fibra. Verificar se há massiva na região antes de agendar.</p><h4>LEDs Normais (Verdes):</h4><p>Pode ser travamento do roteador (fazer reset elétrico) ou bloqueio financeiro.</p>`, "https://docs.google.com/document/d/18H0MsbCN6_mguf3zaG0eMUlAeu4RdE5N_xSvA9pSN8U/edit?usp=sharing") },
                    { label: "CGNAT / Jogos", icon: "🎮", desc: "NAT Estrito", details: TPL.tecnico("CGNAT e Jogos Online", "Portas Fechadas", `<h4>O Problema:</h4><p>O CGNAT compartilha IPs, impedindo abertura de portas (NAT Tipo 3/Estrito).</p><h4>A Solução:</h4><p>Ativar <b>IPv6</b> no roteador e no console do cliente. O IPv6 não possui NAT e resolve a conexão.</p>`, "https://docs.google.com/document/d/1evXyscMO_6hhkFQhghiykTWwwC_NhSxP0_4-g-pfxhA/edit?tab=t.0") },
                    { label: "Wi-Fi Oscilando", icon: "📶", desc: "Instabilidade", details: TPL.tecnico("Wi-Fi Caindo", "Melhoria de Sinal", `<h4>Causas:</h4><p>Canal congestionado (muitos vizinhos), espelhos, aquários ou roteador em local fechado.</p><h4>Ação:</h4><p>Alterar canal do Wi-Fi (1, 6, 11 no 2.4GHz) e fixar largura de banda em 20MHz para maior estabilidade.</p>`, "https://docs.google.com/presentation/d/1TUEanxohqbOruZ9OP4E_17x5-1nuew_oHpnKu8_GPG8/edit?slide=id.g1ee83cbd389_2_0") },
                    { label: "Diag. Velocidade", icon: "📘", desc: "Slide", details: TPL.tecnico("Procedimento Velocidade", "Slide Oficial", "<p>Ping, Tracert e Pathping.</p>", "https://docs.google.com/presentation/d/1sFq9AbsG4OXP-6DfpTNUGVUvtShWPInbMFB7us0vHuc/edit?slide=id.g203410fc01f_0_60#slide=id.g203410fc01f_0_60") },
                    { label: "Prob. Roteador", icon: "📘", desc: "Slide", details: TPL.tecnico("Roteador", "Configuração", "<p>Otimização de rede.</p>", "https://docs.google.com/presentation/d/1WMQFP_M8xklLzK9ExBSLUFFv-7DCPd3mWhYpgOmzzmk/edit?slide=id.g28dccbacb76_17_77#slide=id.g28dccbacb76_17_77") },
                    { label: "Rede Mesh", icon: "📘", desc: "Slide", details: TPL.tecnico("Mesh", "Diagnóstico", "<p>Problemas com EasyMesh.</p>", "https://docs.google.com/presentation/d/1EJLJGUKQWmeYOUAgLC12iyBxEzyMMDImnT4WjseUjWA/edit?slide=id.g2820d168d26_32_161#slide=id.g2820d168d26_32_161") },
                    { label: "Troca Equip.", icon: "📘", desc: "Slide", details: TPL.tecnico("Troca", "Política", "<p>Quando solicitar troca.</p>", "https://docs.google.com/presentation/d/136X85ywiAuc9kT4sfwkPwAOOXcSFyXbEsELhoZ9Tb7U/edit?slide=id.g2bca5b4418c_51_63#slide=id.g2bca5b4418c_51_63") },
                    { label: "Manual VPN", icon: "📄", desc: "Doc", details: TPL.tecnico("VPN", "Guia", "<p>Resolvendo problemas com VPN.</p>", "https://docs.google.com/document/d/1-G8z7iq6bKyiVdkVdmM54NkYM-aYH66iJBxZyVP27dQ/edit?tab=t.0") },
                    { label: "IPv6", icon: "📄", desc: "Doc", details: TPL.tecnico("IPv6", "Guia", "<p>Testar conectividade IPv6.</p>", "https://docs.google.com/document/d/1S3Q4wA_lQtolvlfAY09IoaeB6WUXqsMXtxxYfxv2UTs/edit?usp=sharing") },
                    { label: "Smart TVs", icon: "📺", desc: "Soluções de TV", details: TPL.tecnico("Smart TVs (Samsung/LG/TCL)", "Dicas e Resolução", `<h4>1. Ciclo de Energia (Power Cycle):</h4><p>TV travada ou sem rede? Retire da tomada por 2 minutos e ligue novamente. Isso limpa a memória cache e reinicia a placa de rede da TV.</p><h4>2. Problemas na Netflix/Apps:</h4><p>Netflix travada nos 25%? Pode ser falha no servidor deles. Em Android TV, vá em Configurações > Apps > Forçar Parada e "Limpar Cache".</p><h4>3. Wi-Fi x Cabo:</h4><p>Diga ao cliente que conectar o cabo direto na TV melhora 100% o carregamento do 4K. Algumas placas Wi-Fi de TV limitam a banda.</p>`) },
                    { label: "Videogames", icon: "🎮", desc: "Console Online", details: TPL.tecnico("PlayStation e Xbox", "Conexão de Jogos", `<h4>1. Lag e Queda de Partida:</h4><p>Videogame no Wi-Fi <b>SEMPRE</b> sofrerá lag e perda de pacotes (Packet Loss). Aconselhe sempre o uso de <b>Cabo de Rede (RJ45)</b>.</p><h4>2. NAT Tipo 3 / Estrito:</h4><p>Dificulta chats de voz (Party). A solução é ativar IPv6 ou colocar o aparelho em DMZ (Verifique procedimentos da provedora).</p><h4>3. Lentidão em Downloads da PSN/Xbox:</h4><p>Alterar o DNS na rede do videogame para <code>8.8.8.8</code> ou <code>1.1.1.1</code> destrava downloads travados na loja.</p>`) },
                    { label: "Computadores", icon: "💻", desc: "Suporte PC", details: TPL.tecnico("Computadores e Notebooks", "Problemas Comuns", `<h4>1. Conectado mas sem internet (Só no PC):</h4><p>Se o celular funciona e o PC não, rode no Prompt de Comando (CMD) como Administrador:<br><code>ipconfig /flushdns</code><br><code>netsh winsock reset</code><br>Reinicie o PC.</p><h4>2. Disco 100% ou Engasgos:</h4><p>Antivírus do Windows atualizando em segundo plano engole toda a banda de internet do PC.</p><h4>3. Placa Gigabit:</h4><p>Se o PC não passar de 90 Mbps no cabo, a placa de rede dele pode ser Fast Ethernet (antiga). Precisa ser "Gigabit" para passar os 100 Mega.</p>`) },
                    { label: "Smartphones", icon: "📱", desc: "Wi-Fi Celular", details: TPL.tecnico("Smartphones (Android/iPhone)", "Conectividade", `<h4>1. Erro "Senha Incorreta" do Nada:</h4><p>Toque na rede Wi-Fi, escolha "Esquecer a Rede" e reconecte digitando a senha devagar.</p><h4>2. Sinal 5Ghz sumindo:</h4><p>Celulares antigos ou mais básicos não enxergam a rede 5G. Ele deve usar a rede 2.4G normal.</p><h4>3. Troca de Rede Automática (Wi-Fi Assist / Apple):</h4><p>Se a internet oscilar no celular, o aparelho passa automaticamente para o 4G. Peça ao cliente para desativar esta opção nasConfigs de Wi-Fi.</p>`) },
                    { label: "Redes Sociais", icon: "💬", desc: "Mídias não carregam", details: TPL.tecnico("WhatsApp e Instagram", "Imagens/Vídeos Lentos", `<h4>1. IPv6 Falhando:</h4><p>Redes do meta (Facebook, Insta, Whats) dependem pesadamente do IPv6. Se os vídeos não abrem no Wi-Fi mas abrem no 4G, faça um reset ou reconfigure o IPv6 no roteador.</p><h4>2. Fuso Horário e Data Errada:</h4><p>Se o celular ou PC do cliente estiver com a data desatualizada, os certificados de segurança do Google/WhatsApp bloqueiam a conexão.</p>`) }
                ],
                equipment: [
                    { label: "Repetidor vs Mesh", icon: "📡", desc: "Qualidade Wi-Fi", details: TPL.tecnico("Extensores e Redes Mesh", "Arquitetura", `<h4>1. Repetidor de Tomada Padrão:</h4><p>O repetidor normal (geralmente branco com anteninhas curtas) "corta" a internet pela metade. Ele recebe via Wi-Fi e repassa via Wi-Fi, causando muito atraso e gargalo.</p><h4>2. Tecnologia EasyMesh:</h4><p>No Mesh (roteadores interligados), a rede é uma só. A transição do celular de um roteador para o outro é fluida (Roaming Ativo) e entrega a velocidade real. <b>Recomende sempre o Mesh em vez de repetidores velhos.</b></p>`) },
                    { label: "Rot. Particular", icon: "🔌", desc: "Equipamento do Cliente", details: TPL.tecnico("Roteador do Cliente", "Boas Práticas", `<h4>1. Onde espetar o cabo:</h4><p>O cabo que vem do nosso modem deve entrar na porta <b>WAN / Internet</b> (Geralmente de cor diferente, azul ou amarela sozinha) do roteador do cliente.</p><h4>2. Conflito de IP:</h4><p>Se a luz de WAN acende mas não navega, o IP do roteador dele pode ser o mesmo do nosso (Ex: 192.168.1.1). Ele terá que entrar nas configs do próprio roteador e mudar a LAN para 192.168.2.1 ou 192.168.10.1.</p>`) },
                    { label: "Intelbras GX3000", icon: "📡", desc: "Modem 5G", details: TPL.tecnico("Intelbras GX3000", "CPE 5G/Wi-Fi 6", `<h4>🚦 LEDs:</h4><ul><li><b>Azul/Branco:</b> Sinal Ótimo.</li><li><b>Amarelo:</b> Sinal Regular (Pode oscilar).</li><li><b>Vermelho:</b> Sem sinal (Verificar torre).</li></ul><p><b>Botão Wi-Fi:</b> Pressione por 3s se a rede sumir.</p>`) },
                    { label: "TP-Link NX620v", icon: "📡", desc: "Modem 5G", details: TPL.tecnico("NX620v", "FWA", "Suporta EasyMesh e possui botão físico On/Off.") },
                    { label: "ONU Padrão", icon: "📠", desc: "Huawei/Nokia", details: TPL.tecnico("ONU Fibra", "Status", `<h4>🚦 LEDs:</h4><ul><li><b>PON Fixo:</b> Conectado.</li><li><b>PON Piscando:</b> Tentando conectar (Sinal ruim).</li><li><b>LOS Vermelho:</b> Cabo rompido.</li></ul>`) },
                    { label: "Roteadores Wi-Fi 6", icon: "📶", desc: "AX1500/1800", details: TPL.tecnico("Wi-Fi 6", "Tecnologia", `<p>Equipamentos pretos (BSN/TP-Link). Trabalham com duas redes (2.4G e 5G) ou Smart Connect (nome único).</p><p><b>Atenção:</b> Celulares antigos podem não detectar a rede Wi-Fi 6.</p>`) }
                ],
                tools: [
                    { label: "Teste Velocidade", url: "https://fast.com/pt/", icon: "🚀", desc: "Fast.com", details: TPL.tecnico("Teste", "Instruções", "Sempre via CABO de rede.") },
                    { label: "Downdetector", url: "https://downdetector.com.br/", icon: "📉", desc: "Status", details: TPL.tecnico("Downdetector", "Massivas", "Verificar quedas globais (Whatsapp, Google, etc).") },
                    { label: "Anydesk", url: "https://anydesk.com/pt/downloads/windows", icon: "↔️", desc: "Remoto", details: TPL.tecnico("Anydesk", "Acesso", "Suporte remoto leve.") },
                    { label: "TeamViewer", url: "https://www.teamviewer.com/pt-br/download/windows/", icon: "💻", desc: "Remoto", details: TPL.tecnico("TeamViewer", "Acesso", "Suporte remoto robusto.") }
                ],
                contacts: [
                    { label: "Ouvidoria", icon: "📢", desc: "0800 281 4000", details: TPL.sistema("Ouvidoria", "2ª Instância", "<p>Canal para resolução de conflitos não resolvidos no suporte padrão.</p><h2>📞 0800 281 4000</h2>", "#") },
                    { label: "Suporte 10517", icon: "👤", desc: "Atendimento Geral", details: TPL.sistema("Suporte Técnico", "Canal Padrão", "<p>Atendimento geral ao cliente (Residencial).</p><h2>📞 10517</h2>", "#") },
                    { label: "Regional", icon: "🌍", desc: "0800 285 3917", details: TPL.sistema("Atendimento Regional", "Escritórios Locais", "<p>Dúvidas sobre lojas e atendimentos específicos de região.</p><h2>📞 0800 285 3917</h2>", "#") },
                    { label: "Corporativo", icon: "🏢", desc: "0800 282 3017", details: TPL.sistema("B2B / Empresas", "Atendimento VIP", "<p>Canal exclusivo para clientes CNPJ e Grandes Contas.</p><h2>📞 0800 282 3017</h2>", "#") },
                    { label: "Zap Suporte", icon: "💬", desc: "(84) 98111-8525", details: TPL.sistema("Suporte Digital", "WhatsApp Oficial", "<p>Atendimento automatizado e humano via chat.</p>", "https://wa.me/5584981118525") },
                    { label: "Zap Regional", icon: "📱", desc: "(88) 98122-3054", details: TPL.sistema("Regional Digital", "WhatsApp Regional", "<p>Atendimento de demandas regionais via chat.</p>", "https://wa.me/5588981223054") },
                    { label: "Zap Comercial", icon: "💻", desc: "Vendas Fibra", details: TPL.sistema("Comercial Fibra", "(88) 98182-0637", "<p>Canal de vendas para novos planos Fibra.</p>", "https://wa.me/5588981820637") },
                    { label: "Zap Vendas 5G", icon: "📶", desc: "Vendas Móvel", details: TPL.sistema("Comercial 5G", "(88) 98182-2574", "<p>Canal exclusivo para vendas de planos móveis 5G.</p>", "https://wa.me/5588981822574") },
                    { label: "Brisa Móvel", icon: "📵", desc: "(88) 98111-7600", details: TPL.sistema("Suporte Móvel", "Telefonia Celular", "<p>Dúvidas sobre chips, portabilidade e planos móveis.</p>", "https://wa.me/5588981117600") },
                    { label: "Móvel 5G", icon: "📶", desc: "(84) 98111-8525", details: TPL.sistema("Brisa Móvel 5G", "Suporte Avançado", "<p>Atendimento especializado em tecnologia 5G.</p>", "https://wa.me/5584981118525") },
                    { label: "RH Atende", icon: "👥", desc: "Colaborador", details: TPL.sistema("RH Atende", "(84) 98187-0438", "<p>Dúvidas sobre ponto, férias e contracheque.</p>", "https://wa.me/5584981870438") },
                    { label: "Benefícios", icon: "🏦", desc: "Vale/Plano", details: TPL.sistema("Setor Benefícios", "(88) 98140-6250", "<p>Dúvidas sobre Vale Alimentação, Plano de Saúde, etc.</p>", "https://wa.me/5588981406250") }
                ]
            };

            const ICONS = {
                CLOSE: `<svg viewBox="0 0 24 24" width="20" height="20" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>`,
                LINK_EXT: `<svg viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path><polyline points="15 3 21 3 21 9"></polyline><line x1="10" y1="14" x2="21" y2="3"></line></svg>`,
                MAIN_ICON: `💠`
            };

            function createDashboard() {
                if (document.getElementById('central-dashboard')) return;
                const oldOverlay = document.querySelector('.central-modal-overlay');
                if (oldOverlay) oldOverlay.remove();

                const dashboard = document.createElement('div');
                dashboard.id = 'central-dashboard';
                dashboard.innerHTML = `
                    <div class="central-sidebar">
                        <div class="central-logo"><span>${ICONS.MAIN_ICON}</span> Central</div>
                        <ul class="central-menu"></ul>
                        <div class="central-version">v34.2</div>
                    </div>
                    <div class="central-main">
                        <div class="central-topbar">
                            <h3 id="section-title">Início</h3>
                            <div style="flex:1;"></div>
                            <input type="text" id="central-search" placeholder="Pesquisar..." style="margin-right:10px;">
                            <button id="btn-central-theme" title="Mudar Tema">🌗</button>
                            <button id="btn-close-dashboard" title="Fechar">${ICONS.CLOSE}</button>
                        </div>
                        <div class="central-grid" id="central-content"></div>
                    </div>
                `;
                document.body.appendChild(dashboard);

                const themeBtn = dashboard.querySelector('#btn-central-theme');
                const savedTheme = localStorage.getItem('CENTRAL_THEME');
                if (savedTheme === 'light') {
                    dashboard.classList.add('local-light-mode');
                    themeBtn.innerText = '☀️';
                } else if (savedTheme === 'dark') {
                    dashboard.classList.add('cc-escurinho');
                    themeBtn.innerText = '🌗';
                }
                themeBtn.onclick = () => {
                    const isLight = dashboard.classList.contains('local-light-mode');
                    if (isLight) {
                        dashboard.classList.remove('local-light-mode');
                        dashboard.classList.add('cc-escurinho');
                        localStorage.setItem('CENTRAL_THEME', 'dark');
                        themeBtn.innerText = '🌗';
                    } else {
                        dashboard.classList.remove('cc-escurinho');
                        dashboard.classList.add('local-light-mode');
                        localStorage.setItem('CENTRAL_THEME', 'light');
                        themeBtn.innerText = '☀️';
                    }
                };

                dashboard.querySelector('#btn-close-dashboard').onclick = () => dashboard.remove();
                makeDraggable(dashboard, dashboard.querySelector('.central-logo'));

                // Renderização das Categorias ORIGINAIS
                const menuContainer = dashboard.querySelector('.central-menu');
                const contentContainer = dashboard.querySelector('#central-content');
                const searchInput = dashboard.querySelector('#central-search');
                const sectionTitle = dashboard.querySelector('#section-title');

                const CATEGORIES = [
                    { id: 'systems', icon: '🖥️', label: 'Sistemas', data: BRISA_DB.systems || [] },
                    { id: 'materials', icon: '📑', label: 'Materiais', data: BRISA_DB.materials || [] },
                    { id: 'products_list', icon: '📦', label: 'Produtos', data: BRISA_DB.products_list || [] },
                    { id: 'manuals', icon: '📘', label: 'Manuais', data: BRISA_DB.manuals || [] },
                    { id: 'equipment', icon: '📟', label: 'Equipamentos', data: BRISA_DB.equipment || [] },
                    { id: 'tools', icon: '🔧', label: 'Ferramentas', data: BRISA_DB.tools || [] },
                    { id: 'contacts', icon: '📞', label: 'Contatos', data: BRISA_DB.contacts || [] }
                ];

                function render(items, title) {
                    contentContainer.innerHTML = '';
                    sectionTitle.innerText = title;
                    contentContainer.style.opacity = '0';
                    setTimeout(() => contentContainer.style.opacity = '1', 50);

                    if (!items || items.length === 0) {
                        contentContainer.innerHTML = '<div class="empty-state">Nenhum resultado encontrado.</div>';
                        return;
                    }

                    items.forEach(item => {
                        const card = document.createElement('div');
                        card.className = 'central-card';
                        if (title.includes("Produtos")) card.classList.add('product-card-style');
                        if (title.includes("Manuais") || title.includes("Equipamentos")) card.classList.add('tech-card-style');

                        card.innerHTML = `
                            <div class="card-icon">${item.icon}</div>
                            <div class="card-body">
                                <div class="card-title">${item.label}</div>
                                <div class="card-desc">${item.desc || ''}</div>
                            </div>
                        `;
                        card.onclick = () => openModal({ label: item.label, icon: item.icon, details: item.details, url: item.url || '#' });
                        contentContainer.appendChild(card);
                    });
                }

                CATEGORIES.forEach(cat => {
                    const li = document.createElement('li');
                    li.innerHTML = `<span>${cat.icon}</span> ${cat.label}`;
                    li.onclick = () => {
                        dashboard.querySelectorAll('li').forEach(i => i.classList.remove('active'));
                        li.classList.add('active');
                        searchInput.value = '';
                        render(cat.data, cat.label);
                    };
                    menuContainer.appendChild(li);
                });

                searchInput.addEventListener('input', (e) => {
                    const term = e.target.value.toLowerCase();
                    if (!term) { dashboard.querySelector('li.active')?.click(); return; }
                    dashboard.querySelectorAll('li').forEach(i => i.classList.remove('active'));
                    let results = [];
                    CATEGORIES.forEach(cat => {
                        if (!cat.data) return;
                        const matches = cat.data.filter(item => item.label.toLowerCase().includes(term) || (item.desc && item.desc.toLowerCase().includes(term)));
                        results = results.concat(matches);
                    });
                    render(results, `🔍 Busca: "${term}"`);
                });

                if (menuContainer.firstChild) menuContainer.firstChild.click();
            }

            function openModal(item) {
                const oldOverlay = document.querySelector('.central-modal-overlay');
                if (oldOverlay) oldOverlay.remove();

                const overlay = document.createElement('div');
                overlay.className = 'central-modal-overlay';

                const modal = document.createElement('div');
                modal.className = 'central-modal';

                let btnLink = '';
                if (item.url && item.url !== "#") {
                    btnLink = `<a href="${item.url}" target="_blank" class="btn-modal-action purecloud-script-button">Acessar Link Externo ${ICONS.LINK_EXT}</a>`;
                }

                modal.innerHTML = `
            <div class="modal-header"><div class="modal-title"><span>${item.icon}</span> ${item.label}</div><button class="btn-close-modal purecloud-script-button">${ICONS.CLOSE}</button></div>
            <div class="modal-content">${item.details || "<p>Sem detalhes.</p>"}</div>
            <div class="modal-footer">${btnLink}</div>
        `;

                overlay.appendChild(modal);
                document.body.appendChild(overlay);

                const close = () => {
                    overlay.style.opacity = '0';
                    overlay.style.pointerEvents = 'none'; // Desbloqueia a tela imediatamente
                    setTimeout(() => overlay.remove(), 200);
                };

                modal.querySelector('.btn-close-modal').onclick = close;
                overlay.onclick = (e) => { if (e.target === overlay) close(); };

                requestAnimationFrame(() => { overlay.style.opacity = '1'; modal.style.transform = 'translate(-50%, -50%) scale(1)'; });
            }

            function makeDraggable(el, handle) {
                if (!handle) handle = el;
                let isDragging = false, dragOffsetX = 0, dragOffsetY = 0;

                let moveHandler = (e) => {
                    if (!isDragging) return;
                    e.preventDefault();

                    let newLeft = e.clientX - dragOffsetX;
                    let newTop = e.clientY - dragOffsetY;

                    const rect = el.getBoundingClientRect();
                    if (newLeft < 0) newLeft = 0;
                    if (newTop < 0) newTop = 0;
                    if (newLeft + rect.width > window.innerWidth) newLeft = window.innerWidth - rect.width;
                    if (newTop + rect.height > window.innerHeight) newTop = window.innerHeight - rect.height;

                    el.style.left = newLeft + 'px';
                    el.style.top = newTop + 'px';
                };

                let upHandler = () => {
                    if (isDragging) {
                        isDragging = false;
                    }
                };

                handle.addEventListener('mousedown', (e) => {
                    if (e.target.tagName === 'BUTTON' || e.target.tagName === 'INPUT' || e.target.closest('.os-btn') || e.target.closest('button')) return;
                    e.preventDefault();
                    isDragging = true;

                    el.style.transition = 'none';
                    el.style.transform = 'none';
                    el.style.margin = '0';

                    const rect = el.getBoundingClientRect();
                    el.style.left = rect.left + 'px';
                    el.style.top = rect.top + 'px';
                    el.style.bottom = 'auto';
                    el.style.right = 'auto';

                    dragOffsetX = e.clientX - rect.left;
                    dragOffsetY = e.clientY - rect.top;
                }, { passive: false });

                // Ensure we don't bind multiple identical listeners if makeDraggable is called multiple times on the same element
                // A quick hack is just bind it globally, it naturally ignores when isDragging is false.
                document.addEventListener('mousemove', moveHandler, { passive: false });
                document.addEventListener('mouseup', upHandler);
            }

            function injectCss() {
                const style = document.createElement('style');
                style.textContent = `
            @import url('https://fonts.googleapis.com/css2?family=Segoe+UI:wght@400;500;600;700&display=swap');
            #central-dashboard { --purecloud-script-header-bg: #0d9488; --purecloud-script-header-text: #ffffff; --purecloud-script-accent-color: #0d9488; position: fixed; top: 10vh; left: 10vw; width: 80vw; height: 80vh; background: var(--purecloud-script-bg-primary); display: flex; color: var(--purecloud-script-text-primary); z-index: 100000; border-radius: 8px; overflow: hidden; box-shadow: 0 8px 30px var(--purecloud-script-shadow-color); border: 1px solid var(--purecloud-script-border-color); font-family: 'Segoe UI', Roboto, sans-serif; }
            #central-dashboard.cc-escurinho { --purecloud-script-bg-primary: #0f172a; --purecloud-script-bg-secondary: #1e293b; --purecloud-script-border-color: #334155; --purecloud-script-text-primary: #f8fafc; --purecloud-script-text-secondary: #94a3b8; }
            #central-dashboard.local-light-mode { --purecloud-script-bg-primary: #f8fafc; --purecloud-script-bg-secondary: #f1f5f9; --purecloud-script-border-color: #e2e8f0; --purecloud-script-text-primary: #0f172a; --purecloud-script-text-secondary: #475569; }
            .central-sidebar { width: 220px; background: var(--purecloud-script-bg-secondary); padding: 20px 0; display: flex; flex-direction: column; border-right: 1px solid var(--purecloud-script-border-color); }
            .central-logo { padding: 0 20px 20px 20px; font-weight: 600; font-size: 16px; border-bottom: 1px solid var(--purecloud-script-border-color); display: flex; align-items: center; gap: 8px; cursor: move; color: var(--purecloud-script-text-primary); user-select: none; }
            .central-menu { list-style: none; padding: 10px 0; margin: 0; flex: 1; background: transparent; }
            .central-menu li { padding: 12px 20px; cursor: pointer; border-left: 3px solid transparent; transition: 0.2s; font-size: 13px; font-weight: 500; color: var(--purecloud-script-text-secondary); }
            .central-menu li:hover { background: rgba(0,0,0,0.03); color: var(--purecloud-script-text-primary); }
            .central-menu li.active { color: var(--purecloud-script-text-primary); border-left-color: var(--purecloud-script-accent-color); font-weight: bold; background: transparent; }
            .central-version { text-align: center; font-size: 11px; color: var(--purecloud-script-text-secondary); padding: 10px; }
            .central-main { flex: 1; display: flex; flex-direction: column; background: var(--purecloud-script-bg-primary); }
            .central-topbar { padding: 12px 16px; border-bottom: 1px solid var(--purecloud-script-border-color); display: flex; justify-content: space-between; align-items: center; background: var(--purecloud-script-header-bg); color: var(--purecloud-script-header-text); }
            .central-topbar h3 { margin: 0; font-size: 15px; font-weight: 600; color: var(--purecloud-script-header-text); }
            #central-search { background: var(--purecloud-script-bg-primary); border: 1px solid var(--purecloud-script-border-color); color: var(--purecloud-script-text-primary); padding: 8px 12px; border-radius: 4px; width: 250px; outline: none; font-size: 13px; transition: border-color 0.2s; }
            #central-search:focus { border-color: var(--purecloud-script-accent-color); box-shadow: 0 0 0 2px rgba(76, 175, 80, 0.2); }
            #btn-close-dashboard, #btn-central-theme { background: transparent; border: 1px solid transparent; cursor: pointer; font-size: 15px; color: var(--purecloud-script-header-text); padding: 6px; border-radius: 6px; display: flex; align-items: center; justify-content: center; transition: all 0.2s; }
            #btn-close-dashboard:hover, #btn-central-theme:hover { background: rgba(255,255,255,0.15); border-color: rgba(255,255,255,0.2); color: #fff; }
            .central-grid { flex: 1; overflow-y: auto; padding: 20px; display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: 15px; align-content: start; }
            .central-card { background: var(--purecloud-script-bg-secondary); border-radius: 8px; padding: 15px; cursor: pointer; transition: 0.2s; border-top: 3px solid var(--purecloud-script-accent-color); border-left: 1px solid var(--purecloud-script-border-color); border-right: 1px solid var(--purecloud-script-border-color); border-bottom: 1px solid var(--purecloud-script-border-color); }
            .central-card:hover { transform: translateY(-3px); box-shadow: 0 5px 15px var(--purecloud-script-shadow-color); }
            .central-card h4 { margin: 0; font-size: 14px; color: var(--purecloud-script-text-primary); font-weight: 600; }
            .border-sistema { border-top-color: var(--purecloud-script-accent-color); } .border-produto { border-top-color: var(--purecloud-script-success-color); } .border-tecnico { border-top-color: var(--purecloud-script-warn-color); }
            .central-modal-overlay { 
                position: fixed; inset: 0; background: rgba(0,0,0,0.6); 
                z-index: 100001; 
                display: flex; justify-content: center; align-items: center; 
                opacity: 0; transition: opacity 0.2s; 
                pointer-events: auto; 
            }
            .central-modal { background: var(--purecloud-script-bg-primary); border-radius: 8px; width: 600px; max-width: 90vw; max-height: 80vh; display: flex; flex-direction: column; overflow: hidden; transform: scale(0.9); transition: transform 0.2s; box-shadow: 0 8px 30px var(--purecloud-script-shadow-color); border: 1px solid var(--purecloud-script-border-color); font-family: 'Segoe UI', Roboto, sans-serif; color: var(--purecloud-script-text-primary); }
            .modal-header { padding: 12px 16px; background: var(--purecloud-script-bg-secondary); border-bottom: 1px solid var(--purecloud-script-border-color); display: flex; justify-content: space-between; align-items: center; user-select: none; border-radius: 8px 8px 0 0; }
            .modal-title { font-weight: 600; font-size: 15px; color: var(--purecloud-script-text-primary); display: flex; align-items: center; gap: 8px; }
            .modal-title span { color: var(--purecloud-script-text-primary); display: flex; }
            .btn-close-modal { background: transparent; border: none; cursor: pointer; font-size: 15px; color: var(--purecloud-script-text-secondary); padding: 6px; border-radius: 6px; display: flex; align-items: center; justify-content: center; transition: all 0.2s; }
            .btn-close-modal:hover { color: var(--purecloud-script-text-primary); }
            .modal-content { padding: 20px; flex: 1; overflow-y: auto; color: var(--purecloud-script-text-primary); font-size: 14px; line-height: 1.6; }
            .modal-footer { padding: 12px 16px; background: var(--purecloud-script-bg-secondary); border-top: 1px solid var(--purecloud-script-border-color); text-align: right; border-radius: 0 0 8px 8px; }
            .wiki-body { margin-top: 10px; } .wiki-body ul, .wiki-body ol { margin-left: 20px; margin-top: 5px; padding-left: 0; }

        `;
                document.head.appendChild(style);
            }

            // Injeção de CSS
            injectCss();

            // Trigger Global
            const createTriggerButton = () => {
                let btn = document.getElementById('central-trigger-btn');
                if (btn) return;
                btn = document.createElement('button');
                btn.id = 'central-trigger-btn';
                btn.style.display = 'none';
                document.body.appendChild(btn);
                btn.onclick = createDashboard;
            };
            createTriggerButton();
        })();

    } catch (e) { console.error('[BUILDER] Erro fatal no módulo central.js:', e); }

    /* --- MÓDULO ANEXADO: MENU.JS --- */
    try {
        // ==UserScript==
        // @name         PureCloud - Menu Unificado (V8.3 - Overlay Safety)
        // @namespace    http://tampermonkey.net/
        // @version      8.3
        // @description  Menu FAB com proteção absoluta contra bloqueio de tela.
        // @match        https://*.mypurecloud.*/*
        // @match        https://*.genesys.cloud/*
        // @grant        GM_addStyle
        // ==/UserScript==

        (function () {
            'use strict';

            if (window.self !== window.top) return;

            // --- CSS DE SEGURANÇA ---
            const css = `
        /* 1. Oculta botões originais para não poluir */
        #qr-trigger-button, #pr-trigger-button, #bau-trigger-button, 
        #gemini-float-btn, #monitor-trigger-btn, #central-trigger-btn, #car-float-btn {
            display: none !important; opacity: 0 !important; pointer-events: none !important;
        }

        /* 2. Container do Menu: TRANSPARENTE AO CLIQUE */
        #uni-menu-container { 
            position: fixed; z-index: 2147483640; 
            display: flex; flex-direction: column-reverse; align-items: center; gap: 12px; 
            width: 60px; height: auto; bottom: 20px; right: 20px;
            pointer-events: none !important; /* O SEGREDRO: Cliques atravessam a área vazia */
        }

        /* 3. Botões do Menu: REATIVAM O CLIQUE */
        .uni-fab-main, .uni-fab-btn { 
            pointer-events: auto !important; 
            box-shadow: 0 4px 15px rgba(0,0,0,0.3); 
        }

        .uni-fab-main { 
            width: 60px; height: 60px; border-radius: 50%; 
            background: linear-gradient(135deg, #FF5F6D, #FFC371); 
            color: white; border: none; cursor: pointer; font-size: 28px; 
            display: flex; align-items: center; justify-content: center; 
            transition: transform 0.3s, background 0.3s; user-select: none;
        }
        .uni-fab-main:hover { transform: scale(1.05); }
        .uni-fab-main.active { transform: rotate(45deg); background: linear-gradient(135deg, #ff4b1f, #ff9068); }
        
        .uni-fab-actions { 
            display: flex; flex-direction: column-reverse; gap: 10px; margin-bottom: 5px; 
            opacity: 0; visibility: hidden; transform: translateY(20px) scale(0.8); 
            transition: all 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275); 
            pointer-events: none !important; /* Garante que invisível não bloqueia */
        }
        
        #uni-menu-container.active .uni-fab-actions { 
            opacity: 1; visibility: visible; transform: translateY(0) scale(1); 
            pointer-events: auto !important; /* Ativa clique apenas quando visível */
        }
        
        .uni-fab-btn { 
            width: 48px; height: 48px; border-radius: 50%; border: none; color: white; cursor: pointer; 
            display: flex; align-items: center; justify-content: center; position: relative;
        }
        .uni-fab-btn:hover { transform: scale(1.15); z-index: 2; }
        
        /* Cores dos Botões */
        #uni-btn-id { background: linear-gradient(135deg, #667eea, #764ba2); }
        #uni-btn-bar { background: linear-gradient(135deg, #ff6b6b, #ee5253); }
        #uni-btn-pr { background: linear-gradient(135deg, #d4fc79, #96e6a1); color: #333; }
        #uni-btn-qr { background: linear-gradient(135deg, #00f260, #0575e6); }
        #uni-btn-ia { background: linear-gradient(135deg, #2563EB, #7C3AED); }
        #uni-btn-mon { background: linear-gradient(135deg, #F59E0B, #D97706); }
        #uni-btn-central { background: linear-gradient(135deg, #06B6D4, #3B82F6); }
        #uni-btn-copy { background: linear-gradient(135deg, #FF00CC, #333399); }
        #uni-btn-car { background: linear-gradient(135deg, #10b981, #059669); } 
        #uni-btn-calc { background: linear-gradient(135deg, #00c6ff, #0072ff); }
        #uni-btn-tools { background: linear-gradient(135deg, #ff9966, #ff5e62); } 
        

        .uni-fab-btn::after { 
            content: attr(data-label); position: absolute; right: 55px; 
            background: rgba(0,0,0,0.8); color: #fff; padding: 4px 8px; 
            border-radius: 4px; font-size: 11px; white-space: nowrap; 
            opacity: 0; visibility: hidden; transition: opacity 0.2s; pointer-events: none;
        }
        .uni-fab-btn:hover::after { opacity: 1; visibility: visible; }
        .uni-icon { width: 24px; height: 24px; fill: currentColor; }

        /* Calculadora usa Shadow DOM - sem CSS externo necessário */
    `;

            const style = document.createElement('style'); style.textContent = css; document.head.appendChild(style);

            // --- LIMPEZA DE LIXO E CONFLITOS ---
            if (document.getElementById('uni-menu-container')) document.getElementById('uni-menu-container').remove();

            // Remove calculadora anterior se existir
            const oldCalc = document.getElementById('calc-modal');
            if (oldCalc) oldCalc.remove();

            const div = document.createElement('div'); div.id = 'uni-menu-container';
            div.innerHTML = `
        <div class="uni-fab-actions">
            
            <button class="uni-fab-btn" id="uni-btn-calc" data-label="Calculadora"><span style="font-size:24px;">🧮</span></button>
            <button class="uni-fab-btn" id="uni-btn-ia" data-label="Assistente IA"><span style="font-size:24px;">🧑‍💻</span></button>
            <button class="uni-fab-btn" id="uni-btn-central" data-label="Central de Ajuda"><span style="font-size:26px;">💠</span></button>
            <button class="uni-fab-btn" id="uni-btn-mon" data-label="Monitor Filas"><svg class="uni-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"></path></svg></button>
            <button class="uni-fab-btn" id="uni-btn-copy" data-label="Copiar Chat"><svg class="uni-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"></path><rect x="8" y="2" width="8" height="4" rx="1" ry="1"></rect></svg></button>
            <button class="uni-fab-btn" id="uni-btn-car" data-label="Automação (CAR)"><span style="font-size:18px;">⌨️</span></button>
            <button class="uni-fab-btn" id="uni-btn-id" data-label="Copiar ID"><span style="font-size:20px;font-weight:800;">🆔</span></button>
            <button class="uni-fab-btn" id="uni-btn-bar" data-label="Ferramentas (Bar)"><svg class="uni-icon" viewBox="0 0 24 24"><path d="M20 18c1.1 0 1.99-.9 1.99-2L22 6c0-1.1-.9-2-2-2H4c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2H0v2h24v-2h-4zM4 6h16v10H4V6z"/></svg></button>
            <button class="uni-fab-btn" id="uni-btn-tools" data-label="Ferramentas"><svg class="uni-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"></path></svg></button>
            <button class="uni-fab-btn" id="uni-btn-pr" data-label="Protocolos"><svg class="uni-icon" viewBox="0 0 24 24"><path d="M14 17H4v2h10v-2zm6-8H4v2h16V9zM4 15h16v-2H4v2zM4 5v2h16V5H4z"/></svg></button>
            <button class="uni-fab-btn" id="uni-btn-qr" data-label="Respostas"><svg class="uni-icon" viewBox="0 0 24 24"><path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zM6 9h12v2H6zm8 5H6v-2h8zm4-6H6V6h12z"/></svg></button>
        </div>
        <button class="uni-fab-main" id="uni-fab-trigger" title="Menu Genesys">
            <svg class="uni-icon" viewBox="0 0 24 24"><path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z"/></svg>
        </button>
    `;
            document.body.appendChild(div);

            const container = document.getElementById('uni-menu-container');
            const trigger = document.getElementById('uni-fab-trigger');
            let isDragging = false, startX, startY, initialLeft, initialTop;

            trigger.addEventListener('mousedown', function (e) {
                if (e.button !== 0) return;
                e.preventDefault(); isDragging = false; startX = e.clientX; startY = e.clientY;
                const rect = container.getBoundingClientRect(); initialLeft = rect.left; initialTop = rect.top;
                document.addEventListener('mousemove', onMouseMove); document.addEventListener('mouseup', onMouseUp);
            });

            function onMouseMove(e) {
                const dx = e.clientX - startX; const dy = e.clientY - startY;
                if (!isDragging && (Math.abs(dx) > 5 || Math.abs(dy) > 5)) { isDragging = true; container.style.transition = 'none'; }
                if (isDragging) {
                    let newLeft = Math.max(0, Math.min(initialLeft + dx, window.innerWidth - container.offsetWidth));
                    let newTop = Math.max(0, Math.min(initialTop + dy, window.innerHeight - container.offsetHeight));
                    container.style.left = newLeft + 'px'; container.style.top = newTop + 'px';
                    container.style.bottom = 'auto'; container.style.right = 'auto';
                }
            }

            function onMouseUp(e) {
                document.removeEventListener('mousemove', onMouseMove); document.removeEventListener('mouseup', onMouseUp);
                if (isDragging) {
                    container.style.transition = 'all 0.3s';
                    localStorage.setItem('uniMenuPos', JSON.stringify({ left: container.style.left, top: container.style.top }));
                    setTimeout(() => { isDragging = false; }, 50);
                }
            }

            trigger.addEventListener('click', function (e) {
                if (isDragging) { e.stopImmediatePropagation(); e.preventDefault(); return; }
                container.classList.toggle('active'); trigger.classList.toggle('active');
            });

            try { const savedPos = localStorage.getItem('uniMenuPos'); if (savedPos) { const p = JSON.parse(savedPos); container.style.left = p.left; container.style.top = p.top; container.style.bottom = 'auto'; container.style.right = 'auto'; } } catch (e) { }

            // TRIGGERS
            function triggerModule(id) { const btn = document.getElementById(id); if (btn) btn.click(); else console.warn("Módulo não carregado: " + id); }

            document.getElementById('uni-btn-qr').onclick = () => triggerModule('qr-trigger-button');
            document.getElementById('uni-btn-pr').onclick = () => triggerModule('pr-trigger-button');
            document.getElementById('uni-btn-bar').onclick = () => triggerModule('bau-trigger-button');
            document.getElementById('uni-btn-ia').onclick = () => triggerModule('gemini-float-btn');
            document.getElementById('uni-btn-mon').onclick = () => triggerModule('monitor-trigger-btn');
            document.getElementById('uni-btn-central').onclick = () => triggerModule('central-trigger-btn');
            document.getElementById('uni-btn-tools').onclick = () => {
                if (typeof window.UI_tools !== 'undefined') window.UI_tools.createAgentToolsPanel();

            };

            document.getElementById('uni-btn-car').onclick = () => { if (typeof window.toggleCAR === 'function') window.toggleCAR(); };
            document.getElementById('uni-btn-id').onclick = () => { if (typeof window.executarExtracaoDocumento === 'function') window.executarExtracaoDocumento(); };
            document.getElementById('uni-btn-copy').onclick = () => {
                if (typeof window.executarCopiaEspelho === 'function') {
                    const btn = document.getElementById('uni-btn-copy'); btn.style.transform = 'scale(0.9)';
                    setTimeout(() => btn.style.transform = 'scale(1)', 150); window.executarCopiaEspelho();
                }
            };

            // --- SISTEMA MULTI-CALC PRO (Shadow DOM) ---
            (function initCalc() {
                const oldHost = document.getElementById('calc-ultimate-host');
                if (oldHost) oldHost.remove();

                const host = document.createElement('div');
                host.id = 'calc-ultimate-host';
                host.style.cssText = 'position:fixed; top:0; left:0; width:0; height:0; z-index:2147483647;';
                document.body.appendChild(host);

                const shadow = host.attachShadow({mode: 'open'});

                const style = document.createElement('style');
                style.textContent = `
                    :host { all: initial; }
                    #modal {
                        position: fixed; bottom: 90px; right: 20px; width: 360px;
                        background: #1a1a20; border-radius: 16px; border: 1px solid #333;
                        display: none; flex-direction: column; color: white;
                        box-shadow: 0 10px 50px rgba(0,0,0,0.8); overflow: hidden;
                        font-family: 'Segoe UI', Roboto, sans-serif;
                    }
                    #modal.calc-visible { display: flex !important; }
                    .header { 
                        display: flex; align-items: center; background: #24242e; 
                        padding: 8px 12px; cursor: move; border-bottom: 1px solid #333;
                    }
                    .header-title { flex: 1; font-size: 11px; color: #888; font-weight: bold; pointer-events: none; }
                    #close-btn { background: none; border: none; color: #ff4757; font-size: 22px; cursor: pointer; line-height: 1; }

                    .tabs { 
                        display: flex; flex-wrap: wrap; background: #24242e; 
                        border-bottom: 1px solid #333;
                    }
                    .tab { 
                        flex: 1 1 23%; padding: 8px 2px; text-align: center; font-size: 9px; 
                        cursor: pointer; color: #666; border-bottom: 2px solid transparent; 
                        font-weight: bold; text-transform: uppercase;
                    }
                    .tab:hover { background: rgba(255,255,255,0.05); color: #aaa; }
                    .tab.active { color: #00c6ff; border-bottom: 2px solid #00c6ff; }
                    
                    .body { padding: 15px; display: none; max-height: 420px; overflow-y: auto; }
                    .body.active { display: block; }
                    
                    #display-container { padding: 10px 15px; background: #1a1a20; }
                    #calc-display {
                        width: 100%; height: 55px; background: #24242e; border: 1px solid #444;
                        border-radius: 8px; color: #fff; font-size: 24px; text-align: right; 
                        padding: 10px; box-sizing: border-box; outline: none;
                    }
                    .grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; margin-top: 10px; }
                    .btn { 
                        background: #2f2f3c; border: none; color: white; padding: 12px 0; 
                        border-radius: 8px; cursor: pointer; font-size: 16px; transition: 0.2s;
                    }
                    .btn:hover { background: #3f3f4e; }
                    .btn.action { background: #0072ff; }
                    .btn.clear { background: #ff4757; }
                    
                    .input-group { margin-bottom: 10px; }
                    .input-group label { display: block; font-size: 11px; color: #aaa; margin-bottom: 4px; }
                    .input-group input, .input-group select { 
                        width: 100%; padding: 8px; background: #24242e; border: 1px solid #444; 
                        color: white; border-radius: 6px; box-sizing: border-box; outline: none;
                    }
                    .res-box { 
                        margin-top: 10px; padding: 12px; background: #24242e; border-radius: 8px; 
                        color: #00c6ff; text-align: center; font-weight: bold; border: 1px dashed #444;
                    }
                    .hist-item { 
                        padding: 8px; border-bottom: 1px solid #333; cursor: pointer; font-size: 13px; 
                    }
                    .hist-item:hover { background: rgba(0,198,255,0.1); }
                    
                    ::-webkit-scrollbar { width: 4px; }
                    ::-webkit-scrollbar-thumb { background: #444; border-radius: 10px; }
                `;
                shadow.appendChild(style);

                const main = document.createElement('div');
                main.innerHTML = `
                    <div id="modal">
                        <div class="header" id="drag-handle">
                            <span class="header-title">SISTEMA MULTI-CALC PRO</span>
                            <button id="close-btn" title="Fechar">&times;</button>
                        </div>
                        <div class="tabs">
                            <div class="tab active" data-t="t-base">BÁSICA</div>
                            <div class="tab" data-t="t-sci">CIENT.</div>
                            <div class="tab" data-t="t-fuel">VIAGEM</div>
                            <div class="tab" data-t="t-imc">IMC</div>
                            <div class="tab" data-t="t-med">MEDIDAS</div>
                            <div class="tab" data-t="t-r3">REGRA 3</div>
                            <div class="tab" data-t="t-curr">MOEDA</div>
                            <div class="tab" data-t="t-hist">HIST.</div>
                        </div>
                        <div id="display-container">
                            <input type="text" id="calc-display" readonly value="0">
                        </div>

                        <div class="body active" id="t-base">
                            <div class="grid">
                                <button class="btn clear" data-v="C">C</button>
                                <button class="btn" data-v="(">(</button>
                                <button class="btn" data-v=")">)</button>
                                <button class="btn action" data-v="/">÷</button>
                                <button class="btn" data-v="7">7</button><button class="btn" data-v="8">8</button><button class="btn" data-v="9">9</button>
                                <button class="btn action" data-v="*">×</button>
                                <button class="btn" data-v="4">4</button><button class="btn" data-v="5">5</button><button class="btn" data-v="6">6</button>
                                <button class="btn action" data-v="-">-</button>
                                <button class="btn" data-v="1">1</button><button class="btn" data-v="2">2</button><button class="btn" data-v="3">3</button>
                                <button class="btn action" data-v="+">+</button>
                                <button class="btn" data-v="0">0</button><button class="btn" data-v=".">.</button>
                                <button class="btn clear" data-v="del">⌫</button>
                                <button class="btn action" data-v="=">=</button>
                            </div>
                        </div>

                        <div class="body" id="t-sci">
                            <div class="grid">
                                <button class="btn" data-v="Math.sin(">sin</button>
                                <button class="btn" data-v="Math.cos(">cos</button>
                                <button class="btn" data-v="Math.tan(">tan</button>
                                <button class="btn action" data-v="**">x^y</button>
                                <button class="btn" data-v="Math.sqrt(">√</button>
                                <button class="btn" data-v="Math.PI">π</button>
                                <button class="btn" data-v="Math.log10(">log</button>
                                <button class="btn action" data-v="%">%</button>
                            </div>
                        </div>

                        <div class="body" id="t-fuel">
                            <div class="input-group"><label>Distância (km)</label><input type="number" id="f-d"></div>
                            <div class="input-group"><label>Consumo (km/l)</label><input type="number" id="f-c"></div>
                            <div class="input-group"><label>Preço</label><input type="number" id="f-p"></div>
                            <button id="btn-fuel" class="btn action" style="width:100%">Calcular</button>
                            <div id="res-fuel" class="res-box" style="display:none"></div>
                        </div>

                        <div class="body" id="t-imc">
                            <div class="input-group"><label>Peso (kg)</label><input type="number" id="imc-p"></div>
                            <div class="input-group"><label>Altura (m)</label><input type="number" id="imc-a" placeholder="Ex: 1.75"></div>
                            <button id="btn-imc" class="btn action" style="width:100%">Calcular IMC</button>
                            <div id="res-imc" class="res-box" style="display:none"></div>
                        </div>

                        <div class="body" id="t-med">
                            <div class="input-group">
                                <label>Conversão</label>
                                <select id="med-type">
                                    <option value="km_mi">Km -> Milhas</option>
                                    <option value="mi_km">Milhas -> Km</option>
                                    <option value="c_f">Celsius -> Fahr.</option>
                                    <option value="kg_lb">Kg -> Libras</option>
                                </select>
                            </div>
                            <div class="input-group"><label>Valor</label><input type="number" id="med-v"></div>
                            <button id="btn-med" class="btn action" style="width:100%">Converter</button>
                            <div id="res-med" class="res-box" style="display:none"></div>
                        </div>

                        <div class="body" id="t-r3">
                            <p style="font-size:10px; color:#888; margin-top:0;">Se A está para B, C está para X</p>
                            <div style="display:flex; gap:5px">
                                <input type="number" id="r3-a" placeholder="A" style="flex:1; padding:8px; background:#24242e; color:white; border:1px solid #444; border-radius:6px">
                                <span style="line-height:35px">➔</span>
                                <input type="number" id="r3-b" placeholder="B" style="flex:1; padding:8px; background:#24242e; color:white; border:1px solid #444; border-radius:6px">
                            </div>
                            <div style="display:flex; gap:5px; margin-top:10px">
                                <input type="number" id="r3-c" placeholder="C" style="flex:1; padding:8px; background:#24242e; color:white; border:1px solid #444; border-radius:6px">
                                <span style="line-height:35px">➔</span>
                                <input type="text" value="X" disabled style="flex:1; padding:8px; background:#1a1a20; color:#00c6ff; border:1px solid #444; border-radius:6px; text-align:center; font-weight:bold">
                            </div>
                            <button id="btn-r3" class="btn action" style="width:100%; margin-top:10px">Calcular X</button>
                            <div id="res-r3" class="res-box" style="display:none"></div>
                        </div>

                        <div class="body" id="t-curr">
                            <div style="display:flex; gap:5px">
                                <select id="cur-f" style="flex:1"><option value="USD">USD</option><option value="EUR">EUR</option><option value="BRL">BRL</option><option value="GBP">GBP</option></select>
                                <select id="cur-t" style="flex:1"><option value="BRL" selected>BRL</option><option value="USD">USD</option><option value="EUR">EUR</option></select>
                            </div>
                            <div class="input-group" style="margin-top:10px"><label>Valor (Real-time)</label><input type="number" id="cur-v" placeholder="0.00"></div>
                            <div id="res-curr" class="res-box">Digite para converter...</div>
                        </div>

                        <div class="body" id="t-hist">
                            <button id="btn-clear-h" class="btn clear" style="width:100%; font-size:12px; margin-bottom:10px">Limpar Tudo</button>
                            <div id="hist-list"></div>
                        </div>
                    </div>
                `;
                shadow.appendChild(main);

                const modal = shadow.getElementById('modal');
                const display = shadow.getElementById('calc-display');
                const tabs = shadow.querySelectorAll('.tab');
                const bodies = shadow.querySelectorAll('.body');
                let expr = "";

                // Bloqueio de propagação (Impede o site de reagir aos cliques)
                main.addEventListener('mousedown', (e) => e.stopPropagation());
                main.addEventListener('click', (e) => e.stopPropagation());

                // Abrir/Fechar via script interno
                shadow.getElementById('close-btn').onclick = () => modal.classList.remove('calc-visible');

                // Navegação entre Abas
                tabs.forEach(t => {
                    t.onclick = (e) => {
                        tabs.forEach(x => x.classList.remove('active'));
                        bodies.forEach(x => x.classList.remove('active'));
                        t.classList.add('active');
                        shadow.getElementById(t.dataset.t).classList.add('active');
                        const showDisp = (t.dataset.t === 't-base' || t.dataset.t === 't-sci');
                        shadow.getElementById('display-container').style.display = showDisp ? 'block' : 'none';
                    };
                });

                // Matemática Básica e Científica
                shadow.querySelectorAll('.btn[data-v]').forEach(b => {
                    b.onclick = () => {
                        const v = b.dataset.v;
                        if(v === 'C') { expr = ""; display.value = "0"; }
                        else if(v === 'del') { expr = expr.slice(0,-1); display.value = expr || "0"; }
                        else if(v === '=') {
                            try {
                                const r = eval(expr);
                                const rF = Number.isInteger(r) ? r : parseFloat(r.toFixed(4));
                                saveH(expr, rF);
                                expr = rF.toString(); display.value = rF;
                            } catch(e) { display.value = "Erro"; expr = ""; }
                        } else { expr += v; display.value = expr; }
                    };
                });

                // Viagem
                shadow.getElementById('btn-fuel').onclick = () => {
                    const d = parseFloat(shadow.getElementById('f-d').value), c = parseFloat(shadow.getElementById('f-c').value), p = parseFloat(shadow.getElementById('f-p').value);
                    if(!d || !c || !p) return;
                    const res = shadow.getElementById('res-fuel');
                    res.style.display = 'block'; res.innerHTML = `Total: R$ ${((d/c)*p).toFixed(2)}<br>Litros: ${(d/c).toFixed(1)}L`;
                };

                // IMC
                shadow.getElementById('btn-imc').onclick = () => {
                    const p = parseFloat(shadow.getElementById('imc-p').value), a = parseFloat(shadow.getElementById('imc-a').value);
                    if(!p || !a) return;
                    const imc = p / (a * a);
                    let s = imc < 18.5 ? "Abaixo" : imc < 25 ? "Normal" : imc < 30 ? "Sobrepeso" : "Obesidade";
                    const res = shadow.getElementById('res-imc');
                    res.style.display = 'block'; res.innerHTML = `IMC: ${imc.toFixed(1)}<br>${s}`;
                };

                // Medidas
                shadow.getElementById('btn-med').onclick = () => {
                    const t = shadow.getElementById('med-type').value, v = parseFloat(shadow.getElementById('med-v').value);
                    if(isNaN(v)) return;
                    let r = 0, unit = "";
                    if(t === 'km_mi') { r = v * 0.621; unit = "Mi"; }
                    else if(t === 'mi_km') { r = v / 0.621; unit = "Km"; }
                    else if(t === 'c_f') { r = (v * 9/5) + 32; unit = "°F"; }
                    else if(t === 'kg_lb') { r = v * 2.204; unit = "Lb"; }
                    const res = shadow.getElementById('res-med');
                    res.style.display = 'block'; res.innerHTML = `Res: ${r.toFixed(2)} ${unit}`;
                };

                // Regra de 3
                shadow.getElementById('btn-r3').onclick = () => {
                    const a = parseFloat(shadow.getElementById('r3-a').value), b = parseFloat(shadow.getElementById('r3-b').value), c = parseFloat(shadow.getElementById('r3-c').value);
                    if(isNaN(a) || isNaN(b) || isNaN(c)) return;
                    const x = (b * c) / a;
                    const res = shadow.getElementById('res-r3');
                    res.style.display = 'block'; res.innerHTML = `X = ${x.toFixed(2)}`;
                };

                // Moeda Live
                const curV = shadow.getElementById('cur-v');
                const updateCur = async () => {
                    const f = shadow.getElementById('cur-f').value, t = shadow.getElementById('cur-t').value, v = parseFloat(curV.value);
                    if(isNaN(v)) return;
                    try {
                        const r = await safeFetch('https://open.er-api.com/v6/latest/'+f);
                        const d = await r.json();
                        shadow.getElementById('res-curr').innerHTML = `<strong>${(v * d.rates[t]).toFixed(2)} ${t}</strong>`;
                    } catch(e) {}
                };
                curV.oninput = updateCur;

                // Histórico
                let hData = JSON.parse(localStorage.getItem('smart-ultimate-h')) || [];
                const saveH = (e, r) => {
                    hData.unshift({e, r}); hData = hData.slice(0,10);
                    localStorage.setItem('smart-ultimate-h', JSON.stringify(hData));
                    renderH();
                };
                const renderH = () => {
                    shadow.getElementById('hist-list').innerHTML = hData.map(x => `<div class="hist-item">${x.e} = <strong>${x.r}</strong></div>`).join('');
                };
                shadow.getElementById('btn-clear-h').onclick = () => { hData = []; localStorage.removeItem('smart-ultimate-h'); renderH(); };
                renderH();

                // Arrastar
                let isMoving = false, ox, oy;
                shadow.getElementById('drag-handle').onmousedown = (e) => {
                    isMoving = true; ox = e.clientX - modal.offsetLeft; oy = e.clientY - modal.offsetTop;
                };
                window.addEventListener('mousemove', (e) => {
                    if(!isMoving) return;
                    modal.style.left = (e.clientX - ox) + 'px';
                    modal.style.top = (e.clientY - oy) + 'px';
                    modal.style.right = 'auto'; modal.style.bottom = 'auto';
                });
                window.addEventListener('mouseup', () => isMoving = false);

                // Teclado
                window.addEventListener('keydown', (e) => {
                    if(!modal.classList.contains('calc-visible')) return;
                    if(/[0-9\.\+\-\*\/\(\)]/.test(e.key)) { expr += e.key; display.value = expr; }
                    else if(e.key === 'Enter') shadow.querySelector('.btn[data-v="="]').click();
                    else if(e.key === 'Backspace') { expr = expr.slice(0,-1); display.value = expr || "0"; }
                });

                // Integração com o botão do menu genesys original
                const calcBtn = document.getElementById('uni-btn-calc');
                if(calcBtn) {
                    calcBtn.onclick = (e) => {
                        e.stopPropagation();
                        e.preventDefault();
                        modal.classList.toggle('calc-visible');
                        // Fechar o menu FAB original para não ficar por cima
                        const cont = document.getElementById('uni-menu-container');
                        if (cont) { cont.classList.remove('active'); }
                        const trig = document.getElementById('uni-fab-trigger');
                        if (trig) { trig.classList.remove('active'); }
                    };
                }
            })();

        })();

    } catch (e) { console.error('[BUILDER] Erro fatal no módulo menu.js:', e); }

    /* --- MÓDULO ANEXADO: GERENTE.JS --- */
    try {
        // ==UserScript==
        // @name         Genesys - Gerente de Visibilidade (v2.5 - Game Added)
        // @description  Controla quem aparece na tela com base nas configurações.
        // ==/UserScript==

        (function () {
            'use strict';

            console.log("[Gerente] Iniciando serviço de camuflagem...");

            // Mapeamento: Nome do Módulo -> IDs dos Elementos para ESCONDER
            const MAPA = {
                'MOD_CRONOMETROS': ['#purecloud-script-mini-dashboard', '.injected-bubbles-container'],
                'MOD_PAUSAS': ['#pausa-script-container'],
                'MOD_PROTOCOLOS': ['#pr-trigger-button', '.pr-script-base-popup', '#uni-btn-pr'],
                'MOD_RESPOSTAS': ['#qr-trigger-button', '.qr-script-quick-reply-popup', '#uni-btn-qr'],
                'MOD_BAR': ['#bau-trigger-button', '#bau-rede', '#uni-btn-bar'],
                'MOD_IA': ['#gemini-float-btn', '#gemini-modal', '#uni-btn-ia'],
                'MOD_CAR': ['#car-panel', '#uni-btn-car'],
                'MOD_ID': ['#uni-btn-id'],
                'MOD_MENU': ['#uni-menu-container'],
                'MOD_CALC': ['#uni-btn-calc']
            };

            function aplicarRegras() {
                if (typeof chrome === 'undefined' || !chrome.storage || !chrome.storage.local) return;

                chrome.storage.local.get(Object.keys(MAPA), function (config) {
                    let css = "";

                    for (const [modulo, seletores] of Object.entries(MAPA)) {
                        if (config[modulo] === false) {
                            seletores.forEach(seletor => {
                                css += `${seletor} { display: none !important; opacity: 0 !important; pointer-events: none !important; }\n`;
                            });
                        }
                    }

                    if (config['MOD_MENU'] === false) {
                        // Se o menu estiver desligado, restauramos os botões flutuantes originais se os módulos estiverem ligados
                        if (config['MOD_IA'] !== false) css += `#gemini-float-btn { display: flex !important; visibility: visible !important; opacity: 1 !important; pointer-events: auto !important; top: auto !important; bottom: 85px !important; right: 25px !important; width: 50px !important; height: 50px !important; }\n`;
                        if (config['MOD_PROTOCOLOS'] !== false) css += `#pr-trigger-button { display: flex !important; visibility: visible !important; opacity: 1 !important; pointer-events: auto !important; top: auto !important; bottom: 30px !important; right: 25px !important; width: 50px !important; height: 50px !important; }\n`;
                        if (config['MOD_RESPOSTAS'] !== false) css += `#qr-trigger-button { display: flex !important; visibility: visible !important; opacity: 1 !important; pointer-events: auto !important; top: auto !important; bottom: 20px !important; right: 20px !important; width: 48px !important; height: 48px !important; }\n`;
                        if (config['MOD_BAR'] !== false) css += `#bau-trigger-button { display: flex !important; visibility: visible !important; opacity: 1 !important; pointer-events: auto !important; top: auto !important; bottom: 20px !important; right: 80px !important; width: 48px !important; height: 48px !important; }\n`;
                    }

                    let style = document.getElementById('estilo-gerente-visual');
                    if (!style) {
                        style = document.createElement('style');
                        style.id = 'estilo-gerente-visual';
                        document.head.appendChild(style);
                    }
                    if (style.textContent !== css) {
                        style.textContent = css;
                    }
                });
            }

            // chrome.storage.onChanged.addListener((changes, area) => { if (area === 'local') aplicarRegras(); });
            if (window.self === window.top) {
                setInterval(aplicarRegras, 500);
                aplicarRegras();
            }

        })();

    } catch (e) { console.error('[BUILDER] Erro fatal no módulo gerente.js:', e); }

    } // Fim startScript()
})();
// --- GESTOR DE JANELAS (Z-INDEX GLOBAL) ---
(function () {
    let baseZIndex = 10000;

    // Seletores dos popups
    const popupSelectors = [
        '.qr-script-popup',
        '.pr-script-popup',
        '.ia-script-container',
        '.bau-script-container',
        '.ferramentas-script-container',
        '.central-script-container',
        '#pausa-script-config-container',
        '#corretor-painel'
    ];

    document.addEventListener('mousedown', function (e) {
        let isPopup = false;
        let targetPopup = null;
        for (let sel of popupSelectors) {
            const popup = e.target.closest(sel);
            if (popup) {
                targetPopup = popup;
                break;
            }
        }

        if (targetPopup) {
            baseZIndex += 1;
            targetPopup.style.zIndex = baseZIndex;
        }
    }, true);
})();

