(function protegerAbaTraducaoCorretor() {
    'use strict';

    const FLAG = '__AJA_CORRETOR_VOICE_FIX_VERSION__';
    const VERSION = 'textarea-keep-open-2026-10-11';
    if (window[FLAG] === VERSION) return;
    window[FLAG] = VERSION;

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

    function keepPanelOpen(checker, panel) {
        if (checker) checker.__ajaKeepPanelOpenUntil = Date.now() + 2500;
        if (panel) panel.style.display = 'flex';
    }

    function releasePanel(checker) {
        if (checker) checker.__ajaKeepPanelOpenUntil = 0;
    }

    function protectOcultarTudo(checker) {
        if (!checker || checker.__ajaVoiceFixOcultarProtegidoV3) return;

        const originalOcultarTudo = typeof checker.ocultarTudo === 'function'
            ? checker.ocultarTudo.bind(checker)
            : null;

        checker.__ajaVoiceFixOcultarProtegidoV3 = true;
        checker.ocultarTudo = function ocultarTudoProtegido() {
            const panel = getPanel(this);
            const keepOpen = this.__ajaKeepPanelOpenUntil && this.__ajaKeepPanelOpenUntil > Date.now();
            const focusInside = isInsidePanel(document.activeElement, panel) && !isCloseButton(document.activeElement);

            if ((keepOpen || focusInside) && panel?.style.display !== 'none') {
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
        if (!panel || !textarea || textarea.__ajaVoiceFixTextareaV3) return;

        textarea.__ajaVoiceFixTextareaV3 = true;

        ['pointerdown', 'mousedown', 'mouseup', 'click', 'dblclick', 'focus', 'focusin'].forEach((eventName) => {
            textarea.addEventListener(eventName, (event) => {
                keepPanelOpen(checker, panel);
                event.stopPropagation();
            }, true);
        });

        ['input', 'keydown', 'keyup', 'selectionchange'].forEach((eventName) => {
            textarea.addEventListener(eventName, () => keepPanelOpen(checker, panel), true);
        });
    }

    function protectPanelFocus(checker) {
        const panel = getPanel(checker);
        if (!panel || panel.__ajaVoiceFixPanelFocusV3) return;

        panel.__ajaVoiceFixPanelFocusV3 = true;

        panel.addEventListener('focusin', (event) => {
            if (isCloseButton(event.target)) return;
            keepPanelOpen(checker, panel);
        }, true);

        panel.addEventListener('pointerdown', (event) => {
            if (isCloseButton(event.target)) {
                releasePanel(checker);
                return;
            }

            if (isVoiceTextarea(event.target)) {
                keepPanelOpen(checker, panel);
                event.stopPropagation();
            }
        }, true);

        panel.addEventListener('mousedown', (event) => {
            if (isCloseButton(event.target)) {
                releasePanel(checker);
                return;
            }

            if (isVoiceTextarea(event.target)) {
                keepPanelOpen(checker, panel);
                event.stopPropagation();
            }
        }, true);
    }

    function installStableDrag(checker) {
        const panel = getPanel(checker);
        const header = panel?.querySelector('.panel-header-top');
        if (!panel || !header || header.__ajaStableDragReadyV3) return;

        header.__ajaStableDragReadyV3 = true;
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

            pending = {
                x: event.clientX,
                y: event.clientY,
                rect: panel.getBoundingClientRect()
            };
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

    function protectDocumentEvents() {
        if (document.__ajaVoiceFixDocumentProtegidoV3) return;
        document.__ajaVoiceFixDocumentProtegidoV3 = true;

        ['pointerdown', 'mousedown', 'click', 'focusin'].forEach((eventName) => {
            document.addEventListener(eventName, (event) => {
                const checker = getChecker();
                const panel = getPanel(checker);
                if (!isInsidePanel(event.target, panel) || isCloseButton(event.target)) return;
                keepPanelOpen(checker, panel);

                if (isVoiceTextarea(event.target)) {
                    event.stopPropagation();
                }
            }, true);
        });
    }

    function enhanceVoiceTab() {
        const checker = getChecker();
        const panel = getPanel(checker);
        if (!panel) return;

        protectOcultarTudo(checker);
        protectPanelFocus(checker);
        protectVoiceTextarea(checker);
        installStableDrag(checker);

        const status = panel.querySelector('#voice-status');
        if (status && !window.askGemini && !status.__ajaVoiceFixIaHintV3) {
            status.__ajaVoiceFixIaHintV3 = true;
            const baseText = status.textContent.trim();
            if (!/chave de IA/i.test(baseText)) {
                status.textContent = `${baseText} Dica: com a chave de IA ativa, as virgulas e a pontuacao ficam mais naturais.`;
            }
        }

        const fixButton = panel.querySelector('#btn-voice-fix');
        if (fixButton && !fixButton.__ajaVoiceFixTitleV3) {
            fixButton.__ajaVoiceFixTitleV3 = true;
            fixButton.title = 'Com a IA ativa, esta correcao entende melhor contexto, virgulas e frases longas.';
        }
    }

    protectDocumentEvents();
    setInterval(enhanceVoiceTab, 200);
})();