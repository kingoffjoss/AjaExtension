(function aplicarPatchCorretorMenu() {
    'use strict';

    const PATCH_FLAG = '__AJA_CORRETOR_MENU_PATCH__';
    if (window[PATCH_FLAG]) return;
    window[PATCH_FLAG] = true;

    const SPELL_IDS = ['spell-overlay-layer', 'spell-badge', 'spell-inline-popup', 'spell-main-panel'];

    function escapeHtml(value) {
        return String(value ?? '').replace(/[&<>"']/g, (char) => ({
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            '"': '&quot;',
            "'": '&#39;'
        }[char]));
    }

    function desativarCorretorAntigo() {
        const checker = window.spellCheckerModule;
        if (!checker || Array.isArray(checker.dicionarioPessoal) || checker.__ajaModernSpell) return;

        ['sincronizarIlusao', 'posicionarBadge', 'configurarEventosDoCampo', 'verificarTextoNaAPI', 'atualizarLinhasOnduladas', 'atualizarBadge', 'verificarCursor'].forEach((method) => {
            checker[method] = function noopCorretorAntigo() {};
        });

        checker.ocultarTudo = function ocultarCorretorAntigo() {
            this.ultimoCampo = null;
        };

        SPELL_IDS.forEach((id) => document.getElementById(id)?.remove());
    }

    function configurarArrasteSeguro(checker) {
        if (!checker?.panel || checker.panel.__ajaDragReady) return;
        checker.panel.__ajaDragReady = true;

        let dragging = false;
        let offsetX = 0;
        let offsetY = 0;

        checker.panel.addEventListener('mousedown', (event) => {
            const header = event.target.closest('.panel-header-top');
            if (!header || event.target.closest('button')) return;

            dragging = true;
            const rect = checker.panel.getBoundingClientRect();
            offsetX = event.clientX - rect.left;
            offsetY = event.clientY - rect.top;
            checker.panel.style.right = 'auto';
            checker.panel.style.bottom = 'auto';
            header.style.cursor = 'grabbing';
            event.preventDefault();
        });

        document.addEventListener('mousemove', (event) => {
            if (!dragging) return;
            checker.panel.style.left = `${Math.max(8, event.clientX - offsetX)}px`;
            checker.panel.style.top = `${Math.max(8, event.clientY - offsetY)}px`;
        });

        document.addEventListener('mouseup', () => {
            if (!dragging) return;
            dragging = false;
            const header = checker.panel.querySelector('.panel-header-top');
            if (header) header.style.cursor = 'move';
        });
    }

    function renderizarPainelCorrigido() {
        if (!this.panel) return;

        const erros = Array.isArray(this.errosEncontrados) ? this.errosEncontrados : [];
        const dicionario = Array.isArray(this.dicionarioPessoal) ? this.dicionarioPessoal : [];

        this.panel.innerHTML = `
            <div class="panel-header-top">
                <div class="panel-title">
                    <div style="background:rgba(255,255,255,0.2); color:white; border-radius:50%; width:22px; height:22px; display:flex; align-items:center; justify-content:center; font-size:11px; font-weight:bold;">${erros.length}</div>
                    Corretor Ortográfico Aja Pro
                </div>
                <div style="display:flex; gap:6px; align-items:center;">
                    <button class="btn-fix-all" id="btn-ia-fix" title="Melhorar texto com IA">IA</button>
                    <button class="btn-fix-all" id="btn-fix-all" ${erros.length === 0 ? 'disabled' : ''}>Tudo</button>
                    <button class="btn-fix-all" id="btn-spell-close" title="Fechar">×</button>
                </div>
            </div>
            <div class="panel-tabs">
                <span class="tab-btn-p active" id="tab-errors" style="cursor:pointer;">Erros (${erros.length})</span>
                <span class="tab-btn-p" id="tab-dict" style="cursor:pointer;">Dicionário (${dicionario.length})</span>
            </div>
            <div class="panel-body" id="panel-content-area" style="background:#f8fafc; min-height:220px;"></div>
        `;

        const area = this.panel.querySelector('#panel-content-area');

        const renderErrors = () => {
            area.innerHTML = '';
            if (erros.length === 0) {
                area.innerHTML = '<div style="text-align:center; padding:40px; color:#64748b; font-size:13px;">Tudo certo com seu texto.</div>';
                return;
            }

            erros.forEach((err) => {
                const card = document.createElement('div');
                card.className = 'panel-card';
                const textoErro = err?.context?.text?.substr(err.context.offset, err.context.length) || 'Ponto/Vírgula';
                const sugestao = err?.replacements?.[0]?.value || '-';
                const categoria = err?.rule?.category?.name || 'Revisão sugerida';

                card.innerHTML = `
                    <span class="card-category">${escapeHtml(categoria)}</span>
                    <div class="card-change">
                        <span class="card-wrong">${escapeHtml(textoErro)}</span>
                        &rarr;
                        <span class="card-right" title="Clique para aplicar">${escapeHtml(sugestao)}</span>
                    </div>
                `;

                if (err?.replacements?.[0]) {
                    card.querySelector('.card-right').onclick = () => this.aplicarCorrecao(err, sugestao);
                }
                area.appendChild(card);
            });
        };

        const renderDict = () => {
            area.innerHTML = '';
            if (dicionario.length === 0) {
                area.innerHTML = '<div style="text-align:center; padding:40px; color:#64748b; font-size:13px;">Seu dicionário está vazio.</div>';
                return;
            }

            dicionario.forEach((word) => {
                const item = document.createElement('div');
                item.style.cssText = 'display:flex; justify-content:space-between; padding:8px 12px; background:#f8fafc; border-radius:6px; margin-bottom:5px; font-size:13px; color:#334155; border:1px solid #e2e8f0;';
                item.innerHTML = `<span>${escapeHtml(word)}</span><button style="background:none; border:none; color:#ef4444; cursor:pointer; font-weight:bold;">×</button>`;
                item.querySelector('button').onclick = () => {
                    this.dicionarioPessoal = this.dicionarioPessoal.filter((saved) => saved !== word);
                    localStorage.setItem('pcs_spell_dict', JSON.stringify(this.dicionarioPessoal));
                    this.verificarTextoNaAPI();
                    this.renderizarPainel();
                };
                area.appendChild(item);
            });
        };

        renderErrors();

        this.panel.querySelector('#tab-errors').onclick = (event) => {
            this.panel.querySelectorAll('.tab-btn-p').forEach((button) => button.classList.remove('active'));
            event.target.classList.add('active');
            renderErrors();
        };

        this.panel.querySelector('#tab-dict').onclick = (event) => {
            this.panel.querySelectorAll('.tab-btn-p').forEach((button) => button.classList.remove('active'));
            event.target.classList.add('active');
            renderDict();
        };

        this.panel.querySelector('#btn-spell-close').onclick = () => {
            this.panel.style.display = 'none';
        };

        this.panel.querySelector('#btn-fix-all').onclick = () => {
            if (!this.ultimoCampo) return;
            erros.forEach((err) => {
                if (err?.replacements?.[0]) this.aplicarCorrecaoMath(err, err.replacements[0].value);
            });
            this.dispararEventoDeMudanca();
            this.panel.style.display = 'none';
        };

        this.panel.querySelector('#btn-ia-fix').onclick = async () => {
            if (!this.ultimoCampo) {
                alert('Clique primeiro no campo de texto que deseja corrigir.');
                return;
            }

            if (!window.askGemini) {
                alert('IA não disponível. Ative o Assistente IA primeiro.');
                return;
            }

            const button = this.panel.querySelector('#btn-ia-fix');
            const textoOriginal = this.ultimoCampo.isContentEditable ? (this.ultimoCampo.innerText || this.ultimoCampo.textContent) : this.ultimoCampo.value;
            if (!textoOriginal.trim()) return;

            const originalText = button.textContent;
            button.textContent = '...';
            button.disabled = true;

            try {
                const prompt = `Corrija a gramática, pontuação e clareza deste texto de atendimento ao cliente, mantendo o sentido original e um tom profissional: "${textoOriginal}"`;
                const corrigido = await window.askGemini(prompt);
                if (corrigido && !/erro|error/i.test(corrigido)) {
                    if (this.ultimoCampo.isContentEditable) this.ultimoCampo.innerText = corrigido;
                    else this.ultimoCampo.value = corrigido;
                    this.dispararEventoDeMudanca();
                }
            } catch (error) {
                console.error('[Aja Corretor] Erro ao usar IA:', error);
            } finally {
                button.textContent = originalText;
                button.disabled = false;
            }
        };
    }

    function repararCorretorModerno() {
        const checker = window.spellCheckerModule;
        if (!checker || !Array.isArray(checker.dicionarioPessoal)) return null;

        checker.__ajaModernSpell = true;
        checker.renderizarPainel = renderizarPainelCorrigido;
        configurarArrasteSeguro(checker);

        checker.togglePainel = function togglePainelCorretor() {
            if (!this.panel) return;
            const abrir = this.panel.style.display !== 'flex';
            this.panel.style.display = abrir ? 'flex' : 'none';
            if (abrir) {
                this.renderizarPainel();
                if (this.ultimoCampo) this.verificarTextoNaAPI();
            }
        };

        window.toggleCorretorAja = () => checker.togglePainel();
        return checker;
    }

    function abrirCorretor() {
        const checker = repararCorretorModerno();
        if (!checker) {
            alert('Corretor ainda está carregando. Tente novamente em alguns segundos.');
            return;
        }
        checker.togglePainel();
    }

    function garantirBotaoMenu() {
        const actions = document.querySelector('#uni-menu-container .uni-fab-actions');
        if (!actions || document.getElementById('uni-btn-spell')) return;

        const button = document.createElement('button');
        button.className = 'uni-fab-btn';
        button.id = 'uni-btn-spell';
        button.dataset.label = 'Corretor';
        button.innerHTML = '<span style="font-size:23px; font-weight:800;">✓</span>';
        button.onclick = (event) => {
            event.preventDefault();
            event.stopPropagation();
            abrirCorretor();
        };

        const carButton = document.getElementById('uni-btn-car');
        if (carButton?.parentElement === actions) {
            actions.insertBefore(button, carButton.nextSibling);
        } else {
            actions.appendChild(button);
        }
    }

    desativarCorretorAntigo();
    setTimeout(desativarCorretorAntigo, 300);
    setTimeout(desativarCorretorAntigo, 900);
    setTimeout(repararCorretorModerno, 2300);
    setInterval(() => {
        garantirBotaoMenu();
        repararCorretorModerno();
    }, 800);
})();