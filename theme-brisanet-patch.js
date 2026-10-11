(function aplicarTemaBrisanetGlobal() {
    'use strict';

    const STYLE_ID = 'aja-brisanet-theme-patch';
    const VERSION = 'brisanet-global-force-v1';
    const themeColors = {
        bgPrimary: '#FFFFFF',
        bgSecondary: '#EAF4FF',
        textPrimary: '#0F2742',
        textSecondary: '#52667A',
        borderColor: '#D6E4F2',
        accent: '#0057B8',
        accentText: '#FFFFFF',
        timerBg: '#003B7A',
        timerNormalText: '#FFFFFF',
        timerActiveText: '#FFFFFF',
        timerPausedText: '#FF8200',
        timerInactiveClientText: '#FF8200',
        timerInactiveOperatorText: '#FF8200',
        timerCompletedBg: '#0057B8',
        timerCompletedText: '#FFFFFF',
        success: '#0057B8',
        error: '#D96B00',
        warn: '#FF8200',
        info: '#0057B8',
        miniDashboardProgress: '#FF8200'
    };

    try {
        if (localStorage.getItem('gcp_brand_theme_version') !== VERSION) {
            localStorage.setItem('gcp_themeColors_v2', JSON.stringify(themeColors));
            localStorage.setItem('gcp_brand_theme_version', VERSION);
        }
    } catch (error) {
        console.warn('[AjaExtension] Nao foi possivel gravar o tema Brisanet.', error);
    }

    function ensureStyle() {
        let style = document.getElementById(STYLE_ID);
        if (!style) {
            style = document.createElement('style');
            style.id = STYLE_ID;
            document.documentElement.appendChild(style);
        }

        const css = `
            :root {
                --aja-blue: #0057B8 !important;
                --aja-blue-2: #0072CE !important;
                --aja-blue-dark: #003B7A !important;
                --aja-orange: #FF8200 !important;
                --aja-orange-dark: #D96B00 !important;
                --aja-white: #FFFFFF !important;
                --aja-dark: #0F2742 !important;
                --aja-dark-2: #173B63 !important;
                --aja-dark-3: #214D7E !important;
                --aja-light: #F8FBFF !important;
                --aja-light-2: #EAF4FF !important;
                --aja-border-light: #D6E4F2 !important;
                --aja-border-dark: #2B5F93 !important;
                --aja-gradient: linear-gradient(135deg, #0057B8 0%, #0072CE 46%, #FF8200 100%) !important;
                --aja-gradient-hover: linear-gradient(135deg, #FF8200 0%, #0057B8 100%) !important;
                --purecloud-script-bg-primary: #FFFFFF !important;
                --purecloud-script-bg-secondary: #EAF4FF !important;
                --purecloud-script-text-primary: #0F2742 !important;
                --purecloud-script-text-secondary: #52667A !important;
                --purecloud-script-border-color: #D6E4F2 !important;
                --purecloud-script-header-bg: #0057B8 !important;
                --purecloud-script-accent-color: #FF8200 !important;
                --purecloud-script-accent-text: #FFFFFF !important;
                --purecloud-script-success-color: #0057B8 !important;
                --purecloud-script-warn-color: #FF8200 !important;
                --purecloud-script-info-color: #0057B8 !important;
                --mini-dashboard-progress-color: #FF8200 !important;
            }

            .local-light-mode,
            .car-light-mode {
                --purecloud-script-bg-primary: #F8FBFF !important;
                --purecloud-script-bg-secondary: #EAF4FF !important;
                --purecloud-script-text-primary: #0F2742 !important;
                --purecloud-script-text-secondary: #52667A !important;
                --purecloud-script-border-color: #D6E4F2 !important;
                --purecloud-script-header-bg: #0057B8 !important;
                --purecloud-script-accent-color: #FF8200 !important;
                --purecloud-script-accent-text: #FFFFFF !important;
                --cor-fundo-primario: #F8FBFF !important;
                --cor-fundo-secundario: #EAF4FF !important;
                --cor-fundo-terciario: #D6E4F2 !important;
                --cor-texto-primario: #0F2742 !important;
                --cor-texto-secundario: #52667A !important;
                --cor-borda: #D6E4F2 !important;
                --cor-acento-primario: #FF8200 !important;
                --cor-acento-hover: #0057B8 !important;
            }

            .cc-escurinho,
            .gcp-tema-escuro,
            #car-panel.dark-mode {
                --purecloud-script-bg-primary: #0F2742 !important;
                --purecloud-script-bg-secondary: #173B63 !important;
                --purecloud-script-text-primary: #FFFFFF !important;
                --purecloud-script-text-secondary: #D6E4F2 !important;
                --purecloud-script-border-color: #2B5F93 !important;
                --purecloud-script-header-bg: #0057B8 !important;
                --purecloud-script-accent-color: #FF8200 !important;
                --purecloud-script-accent-text: #FFFFFF !important;
                --cor-fundo-primario: #0F2742 !important;
                --cor-fundo-secundario: #173B63 !important;
                --cor-fundo-terciario: #214D7E !important;
                --cor-texto-primario: #FFFFFF !important;
                --cor-texto-secundario: #D6E4F2 !important;
                --cor-borda: #2B5F93 !important;
                --cor-acento-primario: #FF8200 !important;
                --cor-acento-hover: #0057B8 !important;
            }

            #uni-menu-container .uni-fab-main,
            #uni-menu-container .uni-fab-btn,
            #qr-trigger-button,
            #pr-trigger-button,
            #bau-trigger-button,
            #gemini-float-btn,
            #monitor-trigger-btn,
            #central-trigger-btn,
            #car-float-btn,
            #uni-btn-id,
            #uni-btn-bar,
            #uni-btn-pr,
            #uni-btn-qr,
            #uni-btn-ia,
            #uni-btn-mon,
            #uni-btn-central,
            #uni-btn-copy,
            #uni-btn-car,
            #uni-btn-calc,
            #uni-btn-tools {
                background: var(--aja-gradient) !important;
                color: #FFFFFF !important;
                border: 1px solid rgba(255, 130, 0, 0.85) !important;
                box-shadow: 0 8px 18px rgba(0, 87, 184, 0.32), 0 4px 12px rgba(255, 130, 0, 0.22) !important;
            }

            #uni-menu-container .uni-fab-main:hover,
            #uni-menu-container .uni-fab-btn:hover,
            #qr-trigger-button:hover,
            #pr-trigger-button:hover,
            #bau-trigger-button:hover,
            #gemini-float-btn:hover,
            #monitor-trigger-btn:hover,
            #central-trigger-btn:hover,
            #car-float-btn:hover {
                background: var(--aja-gradient-hover) !important;
                border-color: #FFFFFF !important;
                color: #FFFFFF !important;
            }

            #uni-menu-container .uni-fab-btn::after {
                background: #0F2742 !important;
                color: #FFFFFF !important;
                border: 1px solid #FF8200 !important;
            }

            .purecloud-script-button,
            .purecloud-script-custom-btn,
            .qr-script-button,
            .pr-script-button,
            #purecloud-script-tools-panel button:not(.panel-header-btn),
            #spell-main-panel button,
            #central-dashboard button:not(#btn-close-dashboard):not(#btn-central-theme),
            .central-modal button,
            #modal .btn.action,
            #pausa-script-container .script-btn,
            #pausa-script-config-container button,
            #gemini-wrapper .gemini-btn,
            #gemini-wrapper .btn-primary,
            #gemini-wrapper .btn-action,
            #gemini-wrapper #btn-login,
            #gemini-wrapper #btn-gen-report,
            #gemini-wrapper #btn-copy-result,
            #gemini-wrapper #btn-copy-result-top,
            #gemini-wrapper #btn-save-cfg,
            #gemini-wrapper #btn-send-chat,
            .queue-monitor-container .tab-btn.active,
            #car-panel .btn-save,
            #car-panel .btn-settings-action,
            #car-panel .toggle-import,
            #bau-rede .os-btn.active,
            #bau-rede .bau-sidebar-btn.active,
            #bau-rede .bau-tab-content button,
            #bau-rede .bau-copy-btn {
                background: var(--aja-gradient) !important;
                color: #FFFFFF !important;
                border: 1px solid rgba(255, 130, 0, 0.78) !important;
                box-shadow: 0 6px 14px rgba(0, 87, 184, 0.24), 0 2px 8px rgba(255, 130, 0, 0.18) !important;
                text-shadow: none !important;
                letter-spacing: 0 !important;
            }

            .purecloud-script-button:hover,
            .purecloud-script-custom-btn:hover,
            .qr-script-button:hover,
            .pr-script-button:hover,
            #purecloud-script-tools-panel button:not(.panel-header-btn):hover,
            #spell-main-panel button:hover,
            #central-dashboard button:not(#btn-close-dashboard):not(#btn-central-theme):hover,
            .central-modal button:hover,
            #modal .btn.action:hover,
            #pausa-script-container .script-btn:hover,
            #pausa-script-config-container button:hover,
            #gemini-wrapper .gemini-btn:hover,
            #gemini-wrapper .btn-primary:hover,
            .queue-monitor-container .tab-btn.active:hover,
            #car-panel .btn-save:hover,
            #car-panel .btn-settings-action:hover,
            #car-panel .toggle-import:hover,
            #bau-rede .os-btn.active:hover,
            #bau-rede .bau-sidebar-btn.active:hover,
            #bau-rede .bau-tab-content button:hover,
            #bau-rede .bau-copy-btn:hover {
                background: var(--aja-gradient-hover) !important;
                color: #FFFFFF !important;
                border-color: #FFFFFF !important;
                filter: none !important;
            }

            #purecloud-script-tools-panel,
            #purecloud-script-mini-dashboard,
            #central-dashboard,
            .purecloud-script-popup,
            .qr-script-popup,
            .qr-script-settings-panel,
            .pr-script-base-popup,
            .pr-script-settings-panel,
            #spell-main-panel,
            #modal {
                background: var(--purecloud-script-bg-primary) !important;
                color: var(--purecloud-script-text-primary) !important;
                border-color: var(--purecloud-script-border-color) !important;
            }

            #purecloud-script-tools-panel .panel-header,
            #purecloud-script-mini-dashboard.expanded .mini-dashboard-header,
            .purecloud-script-settings-panel .panel-header,
            .qr-script-popup .panel-header,
            .qr-script-settings-panel .panel-header,
            .pr-script-base-popup .panel-header,
            .pr-script-settings-panel .panel-header,
            #central-dashboard .central-topbar,
            #spell-main-panel .panel-header-top {
                background: var(--aja-gradient) !important;
                color: #FFFFFF !important;
                border-color: rgba(255, 255, 255, 0.18) !important;
            }

            .progress-bar-compact,
            .progress-fill,
            .dashboard-progress-fill {
                background: linear-gradient(90deg, #0057B8, #FF8200) !important;
            }

            #purecloud-script-btn-endCustomer {
                width: 34px !important;
                min-width: 34px !important;
                justify-content: center !important;
                padding: 0 !important;
                background: linear-gradient(135deg, #FF8200, #D96B00) !important;
                color: #FFFFFF !important;
                border-color: #0057B8 !important;
                font-size: 17px !important;
                font-weight: 700 !important;
            }

            #pausa-script-container {
                background: #0F2742 !important;
                color: #FFFFFF !important;
                border-color: #2B5F93 !important;
            }

            #pausa-script-container.local-light-mode {
                background: #F8FBFF !important;
                color: #0F2742 !important;
                border-color: #D6E4F2 !important;
                box-shadow: 0 14px 34px rgba(0, 87, 184, 0.18) !important;
            }

            #pausa-script-header,
            #pausa-script-config-header,
            #pausa-script-container.local-light-mode #pausa-script-header,
            #pausa-script-container.cc-escurinho #pausa-script-header,
            #pausa-script-config-container.local-light-mode #pausa-script-config-header,
            #pausa-script-config-container.cc-escurinho #pausa-script-config-header {
                background: var(--aja-gradient) !important;
                color: #FFFFFF !important;
            }

            #pausa-script-container #status-display {
                background: rgba(0, 87, 184, 0.16) !important;
                border: 1px solid #2B5F93 !important;
                color: #FFFFFF !important;
            }

            #pausa-script-container.local-light-mode #status-display {
                background: #EAF4FF !important;
                border-color: #D6E4F2 !important;
                color: #0F2742 !important;
            }

            #current-status,
            #top-bar-time,
            #pausa-script-header-clock {
                color: #FF8200 !important;
                text-shadow: 0 0 5px rgba(255, 130, 0, 0.5) !important;
            }

            #pausa-script-clock-dot {
                background: #FF8200 !important;
                box-shadow: 0 0 5px #FF8200, 0 0 10px #FF8200 !important;
            }

            #pausa-script-clock-dot.status-ok {
                background: #0057B8 !important;
                box-shadow: 0 0 5px #0057B8, 0 0 10px #0057B8 !important;
            }

            #pausa-script-config-container {
                background: #0F2742 !important;
                color: #FFFFFF !important;
                border-color: #2B5F93 !important;
            }

            #pausa-script-config-container.local-light-mode {
                background: #F8FBFF !important;
                color: #0F2742 !important;
                border-color: #D6E4F2 !important;
            }

            #pausa-script-config-container details,
            #pausa-script-config-container input,
            #pausa-script-config-container select,
            #pausa-script-config-container textarea {
                background: #173B63 !important;
                color: #FFFFFF !important;
                border-color: #2B5F93 !important;
            }

            #pausa-script-config-container.local-light-mode details,
            #pausa-script-config-container.local-light-mode input,
            #pausa-script-config-container.local-light-mode select,
            #pausa-script-config-container.local-light-mode textarea {
                background: #FFFFFF !important;
                color: #0F2742 !important;
                border-color: #D6E4F2 !important;
            }

            #pausa-script-config-container summary,
            #pausa-script-config-container .section-label,
            #pausa-script-config-container #agendamento-lista button {
                color: #FF8200 !important;
            }

            #gemini-wrapper {
                --ia-primary: #0057B8 !important;
                --ia-primary-hover: #FF8200 !important;
            }

            #gemini-wrapper.local-light-mode {
                --ia-bg: #F8FBFF !important;
                --ia-surface: #EAF4FF !important;
                --ia-card: #FFFFFF !important;
                --ia-border: #D6E4F2 !important;
                --ia-text: #0F2742 !important;
                --ia-text-muted: #52667A !important;
                --ia-input: #FFFFFF !important;
                color: #0F2742 !important;
            }

            #gemini-wrapper.cc-escurinho {
                --ia-bg: #0F2742 !important;
                --ia-surface: #173B63 !important;
                --ia-card: #173B63 !important;
                --ia-border: #2B5F93 !important;
                --ia-text: #FFFFFF !important;
                --ia-text-muted: #D6E4F2 !important;
                --ia-input: #0F2742 !important;
                color: #FFFFFF !important;
            }

            #gemini-wrapper #gemini-modal,
            #gemini-wrapper .gemini-input,
            #gemini-wrapper #gemini-result,
            #gemini-wrapper .history-item,
            #gemini-wrapper .chat-ai {
                background: var(--ia-bg) !important;
                color: var(--ia-text) !important;
                border-color: var(--ia-border) !important;
            }

            #gemini-wrapper #gemini-drag-handle,
            #gemini-wrapper #ia-nav-tabs {
                background: var(--ia-surface) !important;
                color: var(--ia-text) !important;
                border-color: var(--ia-border) !important;
            }

            #gemini-wrapper .gemini-label,
            #gemini-wrapper .nav-tab,
            #gemini-wrapper a {
                color: #FF8200 !important;
            }

            #gemini-wrapper .nav-tab.active {
                color: #FFFFFF !important;
                border-bottom-color: #FF8200 !important;
            }

            #gemini-wrapper #btn-theme,
            #gemini-wrapper #btn-close,
            #gemini-wrapper [style*="#d946ef"],
            #gemini-wrapper [style*="139,92,246"] {
                background: var(--aja-gradient) !important;
                color: #FFFFFF !important;
                border-color: rgba(255, 130, 0, 0.78) !important;
                box-shadow: 0 6px 14px rgba(0, 87, 184, 0.24) !important;
            }

            .queue-monitor-container {
                background: #0F2742 !important;
                border-color: #2B5F93 !important;
                color: #FFFFFF !important;
                box-shadow: 0 22px 48px rgba(15, 39, 66, 0.48) !important;
            }

            .queue-monitor-container .monitor-header,
            .queue-monitor-container .header-top {
                background: var(--aja-gradient) !important;
                border-color: rgba(255, 255, 255, 0.18) !important;
            }

            .queue-monitor-container .clock-area,
            .queue-monitor-container .tabs-container,
            .queue-monitor-container .search-container,
            .queue-monitor-container .monitor-content {
                background: #0F2742 !important;
                border-color: #2B5F93 !important;
            }

            .queue-monitor-container #monitor-search,
            .queue-monitor-container .queue-card {
                background: #173B63 !important;
                color: #FFFFFF !important;
                border-color: #2B5F93 !important;
            }

            .queue-monitor-container .queue-card {
                border-left-color: #FF8200 !important;
            }

            .queue-monitor-container .tab-btn {
                background: #173B63 !important;
                color: #D6E4F2 !important;
                border: 1px solid #2B5F93 !important;
                border-radius: 8px 8px 0 0 !important;
            }

            .queue-monitor-container .digital-clock,
            .queue-monitor-container .q-title,
            .queue-monitor-container .header-title {
                color: #FFFFFF !important;
            }

            .queue-monitor-container .date-display,
            .queue-monitor-container .q-header,
            .queue-monitor-container .q-time {
                color: #FF8200 !important;
            }

            .queue-monitor-container .count-badge.green {
                background: #0057B8 !important;
                color: #FFFFFF !important;
            }

            .queue-monitor-container .count-badge.red {
                background: #FF8200 !important;
                color: #FFFFFF !important;
            }

            #car-panel,
            #car-panel.car-light-mode {
                --bg-panel: #F8FBFF !important;
                --text-main: #0F2742 !important;
                --text-sec: #52667A !important;
                --bg-input: #FFFFFF !important;
                --border-input: #D6E4F2 !important;
                --bg-item: #FFFFFF !important;
                --accent: #FF8200 !important;
                --accent-grad: var(--aja-gradient) !important;
                --box-bg: #EAF4FF !important;
                --box-border: #D6E4F2 !important;
                --box-text: #0F2742 !important;
                background: #F8FBFF !important;
                color: #0F2742 !important;
                border-color: #D6E4F2 !important;
            }

            #car-panel.dark-mode {
                --bg-panel: #0F2742 !important;
                --text-main: #FFFFFF !important;
                --text-sec: #D6E4F2 !important;
                --bg-input: #173B63 !important;
                --border-input: #2B5F93 !important;
                --bg-item: #173B63 !important;
                --accent: #FF8200 !important;
                --accent-grad: var(--aja-gradient) !important;
                --box-bg: #173B63 !important;
                --box-border: #2B5F93 !important;
                --box-text: #FFFFFF !important;
                background: #0F2742 !important;
                color: #FFFFFF !important;
                border-color: #2B5F93 !important;
            }

            #car-panel .car-header,
            #car-panel .btn-save {
                background: var(--aja-gradient) !important;
                color: #FFFFFF !important;
            }

            #car-panel .btn-icon-header {
                background: rgba(255, 255, 255, 0.18) !important;
                color: #FFFFFF !important;
                border: 1px solid rgba(255, 255, 255, 0.22) !important;
            }

            #car-panel .car-body,
            #car-panel .car-item,
            #car-panel .info-box,
            #car-panel .car-input,
            #car-panel .area-bulk {
                background: var(--bg-input) !important;
                color: var(--text-main) !important;
                border-color: var(--border-input) !important;
            }

            #car-panel .car-body {
                background: var(--bg-panel) !important;
            }

            #car-panel .item-key {
                color: #FF8200 !important;
            }

            #bau-rede {
                --cor-fundo-primario: #0F2742 !important;
                --cor-fundo-secundario: #173B63 !important;
                --cor-fundo-terciario: #214D7E !important;
                --cor-fundo-hover: rgba(255, 130, 0, 0.16) !important;
                --cor-texto-primario: #FFFFFF !important;
                --cor-texto-secundario: #D6E4F2 !important;
                --cor-borda: #2B5F93 !important;
                --cor-acento-primario: #FF8200 !important;
                --cor-acento-hover: #0057B8 !important;
                --cor-acento-texto: #FFFFFF !important;
                --cor-perigo: #FF8200 !important;
                background: #0F2742 !important;
                color: #FFFFFF !important;
                border-color: #2B5F93 !important;
            }

            #bau-rede-header {
                background: var(--aja-gradient) !important;
                color: #FFFFFF !important;
                border-color: rgba(255, 255, 255, 0.18) !important;
            }

            #bau-rede-body,
            #bau-rede .bau-content-wrapper,
            #bau-rede .bau-content-area {
                background: #0F2742 !important;
                color: #FFFFFF !important;
            }

            #bau-rede .bau-sidebar,
            #bau-rede .bau-installer-box,
            #bau-rede .bau-warning-box,
            #bau-rede .registro-box,
            #bau-rede .teste-interno-output,
            #bau-rede #import-json-area,
            #bau-rede .bau-tab-content input[type="text"],
            #bau-rede .bau-tab-content code {
                background: #173B63 !important;
                color: #FFFFFF !important;
                border-color: #2B5F93 !important;
            }

            #bau-rede .bau-sidebar-btn,
            #bau-rede .os-btn {
                background: transparent !important;
                color: #D6E4F2 !important;
                border-color: #2B5F93 !important;
            }

            #bau-rede .bau-sidebar-btn:hover,
            #bau-rede .os-btn:hover {
                background: rgba(255, 130, 0, 0.16) !important;
                color: #FFFFFF !important;
            }

            #bau-rede .bau-tab-content h3,
            #bau-rede .bau-tab-content h4,
            #bau-rede .bau-tab-content label {
                color: #FFFFFF !important;
            }

            #bau-rede .bau-tab-content p,
            #bau-rede .bau-tab-content li,
            #bau-rede .command-block p {
                color: #D6E4F2 !important;
            }
        `;

        if (style.textContent !== css) {
            style.textContent = css;
        }
    }

    function syncThemeDefaults() {
        const targets = [
            { selector: '#purecloud-script-tools-panel', key: 'TOOLS_THEME', button: '#tools-btn-theme' },
            { selector: '#purecloud-script-mini-dashboard', key: 'DASHBOARD_THEME', button: '#mini-dashboard-btn-theme' },
            { selector: '.pr-script-popup', key: 'PR_THEME', button: '#pr-btn-theme' },
            { selector: '.pr-script-settings-panel', key: 'PR_THEME' },
            { selector: '.qr-script-popup', key: 'QR_THEME', button: '#qr-btn-theme' },
            { selector: '.qr-script-settings-panel', key: 'QR_THEME' },
            { selector: '#pausa-script-container', key: 'GERENCIADOR_THEME', button: '#btn-tema-gerenciador' },
            { selector: '#pausa-script-config-container', key: 'GERCONFIG_THEME', button: '#config-btn-theme' },
            { selector: '#central-dashboard', key: 'CENTRAL_THEME', button: '#btn-central-theme' },
            { selector: '#gemini-wrapper', button: '#btn-theme', defaultTheme: 'light' },
            { selector: '#car-panel', key: 'car_theme_v8', button: '#car-theme-btn', darkClass: 'dark-mode', lightClass: 'car-light-mode', defaultTheme: 'light', legacyDarkClass: '' }
        ];

        targets.forEach((target) => {
            const {
                selector,
                key,
                button,
                darkClass = 'cc-escurinho',
                lightClass = 'local-light-mode',
                defaultTheme = 'dark',
                legacyDarkClass = 'gcp-tema-escuro'
            } = target;
            const darkClasses = [darkClass, legacyDarkClass].filter(Boolean);

            document.querySelectorAll(selector).forEach((element) => {
                const hasLight = Boolean(lightClass && element.classList.contains(lightClass));
                const hasDark = darkClasses.some((className) => element.classList.contains(className));
                let savedTheme = '';

                try {
                    savedTheme = key ? localStorage.getItem(key) || '' : '';
                } catch (error) {
                    savedTheme = '';
                }

                const preferLight = savedTheme === 'light' || (!savedTheme && hasLight && !hasDark);
                if (hasLight && hasDark) {
                    if (preferLight) {
                        darkClasses.forEach((className) => element.classList.remove(className));
                    } else {
                        element.classList.remove(lightClass);
                    }
                } else if (!hasLight && !hasDark) {
                    const themeToApply = savedTheme || defaultTheme;
                    if (themeToApply === 'light' && lightClass) {
                        element.classList.add(lightClass);
                    } else if (themeToApply === 'dark' && darkClass) {
                        element.classList.add(darkClass);
                    }
                }

                const themeButton = button ? element.querySelector(button) || document.querySelector(button) : null;
                if (themeButton) {
                    const isLight = Boolean(lightClass && element.classList.contains(lightClass));
                    themeButton.textContent = isLight ? '☀️' : '🌗';
                    themeButton.title = isLight ? 'Mudar para Tema Escuro' : 'Mudar para Tema Claro';
                }
            });
        });
    }

    function recolorInlineElements() {
        const inlineTargets = [
            ['current-status', '#FF8200'],
            ['top-bar-time', '#FF8200'],
            ['pausa-script-header-clock', '#FF8200']
        ];

        inlineTargets.forEach(([id, color]) => {
            const element = document.getElementById(id);
            if (!element) return;
            element.style.color = color;
            element.style.textShadow = '0 0 5px rgba(255, 130, 0, 0.5)';
        });
    }

    function applyPatch() {
        ensureStyle();
        syncThemeDefaults();
        recolorInlineElements();
    }

    applyPatch();
    setInterval(recolorInlineElements, 1000);

    let patchScheduled = false;
    const observer = new MutationObserver(() => {
        if (patchScheduled) return;
        patchScheduled = true;
        requestAnimationFrame(() => {
            patchScheduled = false;
            applyPatch();
        });
    });

    observer.observe(document.documentElement, { childList: true, subtree: true });
    console.log('[AjaExtension] Tema Brisanet global aplicado:', VERSION);
})();