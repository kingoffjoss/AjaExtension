(function aplicarTemaBrisanetPatch() {
    'use strict';

    const STYLE_ID = 'aja-brisanet-theme-patch';
    const VERSION = 'brisanet-blue-orange-white-dark-v3';
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
        error: '#d93b3b',
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

        const themeCss = `
            :root {
                --brisanet-blue: #0057B8 !important;
                --brisanet-blue-dark: #003B7A !important;
                --brisanet-orange: #FF8200 !important;
                --brisanet-orange-dark: #D96B00 !important;
                --brisanet-white: #FFFFFF !important;
                --purecloud-script-bg-primary: #FFFFFF !important;
                --purecloud-script-bg-secondary: #EAF4FF !important;
                --purecloud-script-text-primary: #0F2742 !important;
                --purecloud-script-text-secondary: #52667A !important;
                --purecloud-script-border-color: #D6E4F2 !important;
                --purecloud-script-accent-color: #0057B8 !important;
                --purecloud-script-accent-text: #FFFFFF !important;
                --purecloud-script-success-color: #0057B8 !important;
                --purecloud-script-warn-color: #FF8200 !important;
                --purecloud-script-info-color: #0057B8 !important;
                --purecloud-script-bubble-bg-normal: #003B7A !important;
                --purecloud-script-bubble-text-normal: #FFFFFF !important;
                --mini-dashboard-progress-color: #FF8200 !important;
            }

            .gcp-tema-escuro,
            .cc-escurinho {
                --purecloud-script-bg-primary: #0F2742 !important;
                --purecloud-script-bg-secondary: #173B63 !important;
                --purecloud-script-text-primary: #FFFFFF !important;
                --purecloud-script-text-secondary: #D6E4F2 !important;
                --purecloud-script-border-color: #2B5F93 !important;
                --purecloud-script-header-bg: #0057B8 !important;
                --purecloud-script-accent-color: #FF8200 !important;
                --purecloud-script-accent-text: #FFFFFF !important;
                --purecloud-script-bubble-bg-normal: #003B7A !important;
                --purecloud-script-bubble-text-normal: #FFFFFF !important;
            }

            .local-light-mode {
                --purecloud-script-bg-primary: #F8FBFF !important;
                --purecloud-script-bg-secondary: #EAF4FF !important;
                --purecloud-script-text-primary: #0F2742 !important;
                --purecloud-script-text-secondary: #52667A !important;
                --purecloud-script-border-color: #D6E4F2 !important;
                --purecloud-script-header-bg: #0057B8 !important;
                --purecloud-script-accent-color: #FF8200 !important;
                --purecloud-script-accent-text: #FFFFFF !important;
            }

            #purecloud-script-tools-panel.cc-escurinho,
            #purecloud-script-mini-dashboard.cc-escurinho,
            #central-dashboard.cc-escurinho,
            .purecloud-script-popup.gcp-tema-escuro,
            .qr-script-popup.cc-escurinho,
            .pr-script-base-popup.cc-escurinho,
            #gemini-wrapper.cc-escurinho {
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
                --cor-fundo-hover: rgba(255, 130, 0, 0.16) !important;
                --cor-texto-primario: #FFFFFF !important;
                --cor-texto-secundario: #D6E4F2 !important;
                --cor-texto-desabilitado: #8FB3D8 !important;
                --cor-borda: #2B5F93 !important;
                --cor-acento-primario: #FF8200 !important;
                --cor-acento-hover: #0057B8 !important;
                --cor-acento-texto: #FFFFFF !important;
                --cor-perigo: #D96B00 !important;
                --cor-sucesso: #0057B8 !important;
                --cor-info: #FF8200 !important;
                --pr-bg-primary: #0F2742 !important;
                --pr-bg-secondary: #173B63 !important;
                --pr-bg-tertiary: #214D7E !important;
                --pr-text-primary: #FFFFFF !important;
                --pr-text-secondary: #D6E4F2 !important;
                --pr-border-color: #2B5F93 !important;
                --pr-accent-color: #FF8200 !important;
                --pr-accent-hover: #0057B8 !important;
                --pr-danger-color: #D96B00 !important;
            }

            #purecloud-script-tools-panel.local-light-mode,
            #purecloud-script-mini-dashboard.local-light-mode,
            #central-dashboard.local-light-mode,
            .purecloud-script-popup.local-light-mode,
            .qr-script-popup.local-light-mode,
            .pr-script-base-popup.local-light-mode,
            #gemini-wrapper.local-light-mode {
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
                --cor-fundo-hover: rgba(255, 130, 0, 0.14) !important;
                --cor-texto-primario: #0F2742 !important;
                --cor-texto-secundario: #52667A !important;
                --cor-texto-desabilitado: #6F8396 !important;
                --cor-borda: #D6E4F2 !important;
                --cor-acento-primario: #FF8200 !important;
                --cor-acento-hover: #0057B8 !important;
                --cor-acento-texto: #FFFFFF !important;
                --cor-perigo: #D96B00 !important;
                --cor-sucesso: #0057B8 !important;
                --cor-info: #0057B8 !important;
                --pr-bg-primary: #F8FBFF !important;
                --pr-bg-secondary: #EAF4FF !important;
                --pr-bg-tertiary: #D6E4F2 !important;
                --pr-text-primary: #0F2742 !important;
                --pr-text-secondary: #52667A !important;
                --pr-border-color: #D6E4F2 !important;
                --pr-accent-color: #FF8200 !important;
                --pr-accent-hover: #0057B8 !important;
                --pr-danger-color: #D96B00 !important;
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

            .purecloud-script-button {
                background: linear-gradient(135deg, #0057B8, #0072CE) !important;
                color: #FFFFFF !important;
                border: 1px solid #003B7A !important;
                box-shadow: 0 4px 10px rgba(0, 87, 184, 0.22) !important;
                letter-spacing: 0 !important;
            }

            .purecloud-script-button:hover {
                background: linear-gradient(135deg, #FF8200, #D96B00) !important;
                border-color: #D96B00 !important;
                box-shadow: 0 6px 14px rgba(255, 130, 0, 0.28) !important;
            }

            .purecloud-script-custom-btn {
                background: linear-gradient(135deg, #0057B8 0%, #006AC8 45%, #FF8200 100%) !important;
                border: 1px solid #FF8200 !important;
                color: #FFFFFF !important;
                box-shadow: 0 4px 10px rgba(0, 87, 184, 0.24) !important;
            }

            .purecloud-script-custom-btn:hover {
                background: linear-gradient(135deg, #FF8200 0%, #0057B8 100%) !important;
                border-color: #FFFFFF !important;
                color: #FFFFFF !important;
            }

            #purecloud-script-tools-panel,
            #purecloud-script-mini-dashboard,
            #central-dashboard,
            .purecloud-script-popup,
            .qr-script-popup,
            .pr-script-base-popup {
                border-color: var(--purecloud-script-border-color) !important;
            }

            #purecloud-script-tools-panel .panel-header,
            #purecloud-script-mini-dashboard.expanded .mini-dashboard-header,
            .purecloud-script-settings-panel .panel-header,
            .qr-script-popup .panel-header,
            .pr-script-base-popup .panel-header,
            #central-dashboard .central-topbar {
                background: #0057B8 !important;
                color: #FFFFFF !important;
            }

            #purecloud-script-tools-panel .panel-header.orange,
            #purecloud-script-tools-panel .panel-header-btn:hover {
                background: #FF8200 !important;
                color: #FFFFFF !important;
            }

            .progress-bar-compact,
            .progress-fill,
            .dashboard-progress-fill {
                background: linear-gradient(90deg, #0057B8, #FF8200) !important;
            }

            #uni-menu-container .uni-fab-main,
            #uni-menu-container .uni-fab-btn,
            #qr-trigger-button,
            #pr-trigger-button,
            #bau-trigger-button,
            #gemini-float-btn,
            #monitor-trigger-btn,
            #central-trigger-btn,
            #car-float-btn {
                background: linear-gradient(135deg, #0057B8 0%, #006AC8 42%, #FF8200 100%) !important;
                color: #FFFFFF !important;
                border: 1px solid rgba(255, 130, 0, 0.85) !important;
                box-shadow: 0 8px 18px rgba(0, 87, 184, 0.32), 0 4px 12px rgba(255, 130, 0, 0.24) !important;
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
                background: linear-gradient(135deg, #FF8200 0%, #0057B8 100%) !important;
                color: #FFFFFF !important;
                border-color: #FFFFFF !important;
            }

            #uni-menu-container .uni-fab-main.active,
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
                background: linear-gradient(135deg, #0057B8 0%, #006AC8 42%, #FF8200 100%) !important;
                color: #FFFFFF !important;
                border: 1px solid rgba(255, 255, 255, 0.22) !important;
            }

            #uni-menu-container .uni-fab-btn::after {
                background: #0F2742 !important;
                color: #FFFFFF !important;
                border: 1px solid #FF8200 !important;
            }

            .qr-script-button,
            .pr-script-button,
            .bau-tab-content button,
            .bau-copy-btn,
            #purecloud-script-tools-panel .purecloud-script-button,
            #purecloud-script-tools-panel button:not(.panel-header-btn),
            #spell-main-panel button,
            #central-dashboard button:not(#btn-close-dashboard):not(#btn-central-theme),
            .central-modal button,
            #modal .btn.action {
                background: linear-gradient(135deg, #0057B8 0%, #006AC8 45%, #FF8200 100%) !important;
                color: #FFFFFF !important;
                border: 1px solid rgba(255, 130, 0, 0.72) !important;
                box-shadow: 0 4px 10px rgba(0, 87, 184, 0.22) !important;
            }

            .qr-script-button:hover,
            .pr-script-button:hover,
            .bau-tab-content button:hover,
            .bau-copy-btn:hover,
            #purecloud-script-tools-panel .purecloud-script-button:hover,
            #purecloud-script-tools-panel button:not(.panel-header-btn):hover,
            #spell-main-panel button:hover,
            #central-dashboard button:not(#btn-close-dashboard):not(#btn-central-theme):hover,
            .central-modal button:hover,
            #modal .btn.action:hover {
                background: linear-gradient(135deg, #FF8200 0%, #0057B8 100%) !important;
                color: #FFFFFF !important;
                border-color: #FFFFFF !important;
            }

            #pausa-script-container {
                --ger-bg-primary: #0F2742 !important;
                --ger-bg-hover: #173B63 !important;
                --ger-border: #2B5F93 !important;
                --ger-text-primary: #FFFFFF !important;
                --ger-header-bg: #0057B8 !important;
                --ger-header-text: #FFFFFF !important;
                background: #0F2742 !important;
                color: #FFFFFF !important;
                border-color: #2B5F93 !important;
            }

            #pausa-script-container.local-light-mode {
                --ger-bg-primary: #FFFFFF !important;
                --ger-bg-hover: #EAF4FF !important;
                --ger-border: #D6E4F2 !important;
                --ger-text-primary: #0F2742 !important;
            }

            #pausa-script-header {
                background: #0057B8 !important;
                color: #FFFFFF !important;
            }

            #status-display {
                background: rgba(0, 87, 184, 0.14) !important;
                border: 1px solid #2B5F93 !important;
                color: #FFFFFF !important;
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

            #btn-toggle-agendamento,
            #btn-disponivel,
            #btn-na-fila,
            #btn-treinamento,
            #btn-particular,
            #btn-reuniao {
                background: linear-gradient(135deg, #0057B8, #003B7A) !important;
                color: #FFFFFF !important;
                border-color: #003B7A !important;
            }

            #btn-refeicao,
            #btn-pausa-out,
            #btn-feedback,
            #btn-pause-resume-agendamento {
                background: linear-gradient(135deg, #FF8200, #D96B00) !important;
                color: #FFFFFF !important;
                border-color: #D96B00 !important;
            }

            #btn-descanso,
            #btn-backoffice,
            #btn-saude,
            #btn-logoff {
                background: linear-gradient(135deg, #0057B8 0%, #006AC8 45%, #FF8200 100%) !important;
                color: #FFFFFF !important;
                border: 1px solid rgba(255, 130, 0, 0.72) !important;
                text-shadow: none !important;
            }

            #pausa-script-config-container {
                --gerconfig-bg: #0F2742 !important;
                --gerconfig-text: #FFFFFF !important;
                --gerconfig-text-muted: #D6E4F2 !important;
                --gerconfig-border: #2B5F93 !important;
                --gerconfig-card-bg: #173B63 !important;
                --gerconfig-card-hover: #214D7E !important;
                --gerconfig-accent: #FF8200 !important;
                --gerconfig-input-bg: #0F2742 !important;
                --gerconfig-header-bg: #0057B8 !important;
                --gerconfig-header-text: #FFFFFF !important;
                background: #0F2742 !important;
                color: #FFFFFF !important;
                border-color: #2B5F93 !important;
            }

            #pausa-script-config-header {
                background: #0057B8 !important;
                color: #FFFFFF !important;
            }

            #pausa-script-config-container details {
                background: #173B63 !important;
                border-color: #2B5F93 !important;
            }

            #pausa-script-config-container summary,
            #pausa-script-config-container .section-label,
            #pausa-script-config-container #agendamento-lista button {
                color: #FF8200 !important;
            }

            #btn-exportar-config,
            #btn-verificar-seletores,
            #btn-adicionar-horario {
                background: linear-gradient(135deg, #0057B8, #003B7A) !important;
                color: #FFFFFF !important;
            }

            #btn-importar-config {
                background: linear-gradient(135deg, #0057B8 0%, #006AC8 45%, #FF8200 100%) !important;
                color: #FFFFFF !important;
                border: 1px solid rgba(255, 130, 0, 0.72) !important;
            }
        `;

        if (style.textContent !== themeCss) {
            style.textContent = themeCss;
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
            { selector: '#gemini-wrapper', button: '#btn-theme' }
        ];

        targets.forEach(({ selector, key, button }) => {
            document.querySelectorAll(selector).forEach(element => {
                const hasLight = element.classList.contains('local-light-mode');
                const hasDark = element.classList.contains('cc-escurinho') || element.classList.contains('gcp-tema-escuro');
                let savedTheme = '';

                try {
                    savedTheme = key ? localStorage.getItem(key) || '' : '';
                } catch (error) {
                    savedTheme = '';
                }

                if (hasLight && hasDark) {
                    if (savedTheme === 'light') {
                        element.classList.remove('cc-escurinho', 'gcp-tema-escuro');
                    } else {
                        element.classList.remove('local-light-mode');
                    }
                } else if (!hasLight && !hasDark) {
                    element.classList.add(savedTheme === 'light' ? 'local-light-mode' : 'cc-escurinho');
                }

                const themeButton = button ? element.querySelector(button) || document.querySelector(button) : null;
                if (themeButton) {
                    const isLight = element.classList.contains('local-light-mode');
                    themeButton.textContent = isLight ? '☀️' : '🌗';
                    themeButton.title = isLight ? 'Mudar para Tema Escuro' : 'Mudar para Tema Claro';
                }
            });
        });
    }

    function recolorInlineElements() {
        const status = document.getElementById('current-status');
        if (status) status.style.color = '#FF8200';

        const headerClock = document.getElementById('pausa-script-header-clock');
        if (headerClock) {
            headerClock.style.color = '#FF8200';
            headerClock.style.textShadow = '0 0 5px rgba(255, 130, 0, 0.5)';
        }

        const floatClock = document.getElementById('top-bar-time');
        if (floatClock) {
            floatClock.style.color = '#FF8200';
            floatClock.style.textShadow = '0 0 5px rgba(255, 130, 0, 0.5)';
        }
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

    console.log('[AjaExtension] Tema Brisanet aplicado.');
})();
