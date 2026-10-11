(function protegerAbaTraducaoCorretor() {
    'use strict';

    const FLAG = '__AJA_CORRETOR_VOICE_FIX__';
    if (window[FLAG]) return;
    window[FLAG] = true;

    function getChecker() {
        return window.spellCheckerModule || null;
    }

    function getPanel(checker) {
        return checker?.panel || document.getElementById('spell-main-panel') || null;
    }

    function isInsidePanel(target, panel) {
        return Boolean(panel && target instanceof Node && panel.contains(target));
    }

    function clamp(value, min, max) {
        return Math.min(Math.max(value, min), max);
    }

    function markKeepOpen(checker, panel) {
        if (checker) checker.__ajaKeepPanelOpenUntil = Date.now() + 2500;
        if (!panel) return;

        requestAnimationFrame(() => {
            const stillInside = isInsidePanel(document.activeElement, panel);
            if (stillInside || checker?.__ajaKeepPanelOpenUntil > Date.now()) {
                panel.style.display = 'flex';
            }
        });

        setTimeout(() => {
            const stillInside = isInsidePanel(document.activeElement, panel);
            if (stillInside || checker?.__ajaKeepPanelOpenUntil > Date.now()) {
                panel.style.display = 'flex';
            }
        }, 40);
    }

    function protectOcultarTudo(checker) {
        if (!checker || checker.__ajaVoiceFixOcultarProtegido) return;

        const originalOcultarTudo = typeof checker.ocultarTudo === 'function'
            ? checker.ocultarTudo.bind(checker)
            : null;

        checker.__ajaVoiceFixOcultarProtegido = true;
        checker.ocultarTudo = function ocultarTudoProtegido() {
            const panel = getPanel(this);
            const keepOpen = this.__ajaKeepPanelOpenUntil && this.__ajaKeepPanelOpenUntil > Date.now();
            const focusInside = isInsidePanel(document.activeElement, panel);

            if (keepOpen || focusInside) {
                if (panel) panel.style.display = 'flex';
                return;
            }

            if (originalOcultarTudo) {
                return originalOcultarTudo();
            }

            if (panel) panel.style.display = 'none';
        };
    }

    function protectPanelEvents(checker) {
        const panel = getPanel(checker);
        if (!panel || panel.__ajaVoiceFixEventsProtegidos) return;

        panel.__ajaVoiceFixEventsProtegidos = true;
        const events = [
            'pointerdown',
            'pointerup',
            'mousedown',
            'mouseup',
            'click',
            'dblclick',
            'focusin',
            'focusout',
            'keydown',
            'keyup',
            'input',
            'touchstart',
            'touchend'
        ];

        events.forEach((eventName) => {
            panel.addEventListener(eventName, (event) => {
                markKeepOpen(checker, panel);
                event.stopPropagation();
            }, true);
        });
    }

    function installStableDrag(checker) {
        const panel = getPanel(checker);
        const header = panel?.querySelector('.panel-header-top');
        if (!panel || !header || header.__ajaStableDragReady) return;

        header.__ajaStableDragReady = true;
        header.style.cursor = 'move';

        let pending = null;
        let dragging = false;

        function finishDrag(event) {
            document.removeEventListener('mousemove', moveDrag, true);
            document.removeEventListener('mouseup', finishDrag, true);
            if (dragging) {
                event?.preventDefault();
                event?.stopPropagation();
            }
            dragging = false;
            pending = null;
            header.style.cursor = 'move';
        }

        function moveDrag(event) {
            if (!pending) return;

            const dx = event.clientX - pending.x;
            const dy = event.clientY - pending.y;
            const distance = Math.hypot(dx, dy);

            if (!dragging && distance < 8) {
                event.stopPropagation();
                return;
            }

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
            markKeepOpen(checker, panel);
            event.preventDefault();
            event.stopPropagation();
        }

        header.addEventListener('mousedown', (event) => {
            if (event.button !== 0 || event.target.closest('button,input,textarea,select,a,[contenteditable="true"]')) return;

            pending = {
                x: event.clientX,
                y: event.clientY,
                rect: panel.getBoundingClientRect()
            };
            dragging = false;
            markKeepOpen(checker, panel);

            document.addEventListener('mousemove', moveDrag, true);
            document.addEventListener('mouseup', finishDrag, true);

            event.preventDefault();
            event.stopPropagation();
        }, true);

        window.addEventListener('blur', finishDrag, true);
        document.addEventListener('mouseleave', finishDrag, true);
    }

    function protectDocumentEvents() {
        if (document.__ajaVoiceFixDocumentProtegido) return;
        document.__ajaVoiceFixDocumentProtegido = true;

        ['pointerdown', 'mousedown', 'click', 'focusin'].forEach((eventName) => {
            document.addEventListener(eventName, (event) => {
                const checker = getChecker();
                const panel = getPanel(checker);
                if (!isInsidePanel(event.target, panel)) return;
                markKeepOpen(checker, panel);
            }, true);
        });

        ['mouseup', 'pointerup', 'mouseleave'].forEach((eventName) => {
            document.addEventListener(eventName, () => {
                const checker = getChecker();
                if (checker) checker.__ajaKeepPanelOpenUntil = Date.now() + 300;
            }, true);
        });
    }

    function enhanceVoiceTab() {
        const checker = getChecker();
        const panel = getPanel(checker);
        if (!panel) return;

        protectOcultarTudo(checker);
        protectPanelEvents(checker);
        installStableDrag(checker);

        const textarea = panel.querySelector('#voice-transcript-box');
        if (textarea && !textarea.__ajaVoiceFixInputProtegido) {
            textarea.__ajaVoiceFixInputProtegido = true;
            textarea.addEventListener('pointerdown', () => markKeepOpen(checker, panel), true);
            textarea.addEventListener('mousedown', () => markKeepOpen(checker, panel), true);
            textarea.addEventListener('focus', () => markKeepOpen(checker, panel), true);
            textarea.addEventListener('input', () => markKeepOpen(checker, panel), true);
        }

        const status = panel.querySelector('#voice-status');
        if (status && !window.askGemini && !status.__ajaVoiceFixIaHint) {
            status.__ajaVoiceFixIaHint = true;
            const baseText = status.textContent.trim();
            status.textContent = `${baseText} Dica: com a chave de IA ativa, as virgulas e a pontuacao ficam mais naturais.`;
        }

        const fixButton = panel.querySelector('#btn-voice-fix');
        if (fixButton && !fixButton.__ajaVoiceFixTitle) {
            fixButton.__ajaVoiceFixTitle = true;
            fixButton.title = 'Com a IA ativa, esta correcao entende melhor contexto, virgulas e frases longas.';
        }
    }

    protectDocumentEvents();
    setInterval(enhanceVoiceTab, 250);
})();