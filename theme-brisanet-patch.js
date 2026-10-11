(function aplicarTemaBrisanetPatch() {
    'use strict';

    const STYLE_ID = 'aja-brisanet-theme-patch';
    const VERSION = 'brisanet-blue-orange-white-dark-v2';
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

        style.textContent = `
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
                background: #FFFFFF !important;
                border: 1px solid #0057B8 !important;
                color: #0057B8 !important;
            }

            .purecloud-script-custom-btn:hover {
                background: #FF8200 !important;
                border-color: #D96B00 !important;
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

            #uni-menu-container .uni-fab-main {
                background: linear-gradient(135deg, #0057B8, #FF8200) !important;
                color: #FFFFFF !important;
            }

            #uni-menu-container .uni-fab-main.active,
            #uni-btn-bar,
            #uni-btn-mon,
            #uni-btn-tools {
                background: linear-gradient(135deg, #FF8200, #D96B00) !important;
                color: #FFFFFF !important;
            }

            #uni-btn-id,
            #uni-btn-car,
            #uni-btn-ia {
                background: linear-gradient(135deg, #003B7A, #0057B8) !important;
                color: #FFFFFF !important;
            }

            #uni-btn-qr,
            #uni-btn-calc {
                background: linear-gradient(135deg, #0057B8, #0072CE) !important;
                color: #FFFFFF !important;
            }

            #uni-btn-central {
                background: linear-gradient(135deg, #0057B8, #FF8200) !important;
                color: #FFFFFF !important;
            }

            #uni-btn-pr,
            #uni-btn-copy {
                background: linear-gradient(135deg, #FFFFFF, #EAF4FF) !important;
                color: #0057B8 !important;
                border: 1px solid #D6E4F2 !important;
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
                background: linear-gradient(135deg, #FFFFFF, #EAF4FF) !important;
                color: #0057B8 !important;
                border: 1px solid #D6E4F2 !important;
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
                background: linear-gradient(135deg, #FFFFFF, #EAF4FF) !important;
                color: #0057B8 !important;
                border: 1px solid #D6E4F2 !important;
            }
        `;
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
        recolorInlineElements();
    }

    applyPatch();
    setInterval(recolorInlineElements, 1000);

    const observer = new MutationObserver(applyPatch);
    observer.observe(document.documentElement, { childList: true, subtree: true });

    console.log('[AjaExtension] Tema Brisanet aplicado.');
})();
