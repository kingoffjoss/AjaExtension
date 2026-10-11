(function aplicarPatchCorretorMenu() {
    'use strict';

    const PATCH_FLAG = '__AJA_CORRETOR_MENU_PATCH__';
    const PATCH_VERSION = 'voice-tab-2026-10-10';
    if (window[PATCH_FLAG] === PATCH_VERSION) return;
    window[PATCH_FLAG] = PATCH_VERSION;

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

    function normalizarTranscricao(texto) {
        let resultado = String(texto || '')
            .replace(/\s+/g, ' ')
            .replace(/\s+([,.!?;:])/g, '$1')
            .replace(/([,.!?;:])([^\s])/g, '$1 $2')
            .replace(/\bvirgula\b/gi, ',')
            .replace(/\bponto final\b/gi, '.')
            .replace(/\bponto\b/gi, '.')
            .replace(/\binterrogacao\b/gi, '?')
            .replace(/\bexclamacao\b/gi, '!')
            .trim();

        if (!resultado) return '';
        resultado = resultado.charAt(0).toUpperCase() + resultado.slice(1);
        if (!/[.!?]$/.test(resultado)) resultado += '.';
        return resultado.replace(/([.!?]\s+)([a-záàâãéêíóôõúç])/g, (match, pontuacao, letra) => `${pontuacao}${letra.toUpperCase()}`);
    }

    function limparRespostaIA(texto) {
        return String(texto || '')
            .replace(/^```[\s\S]*?\n/, '')
            .replace(/```$/g, '')
            .replace(/^['"“”]+|['"“”]+$/g, '')
            .trim();
    }

    async function corrigirComIA(texto) {
        if (!window.askGemini) return null;

        const prompt = [
            'Corrija a transcricao abaixo em portugues do Brasil.',
            'Ajuste ortografia, acentos, pontuacao, virgulas, quebras naturais e clareza.',
            'Mantenha exatamente o sentido original, sem inventar informacoes e sem explicar nada.',
            'Responda somente com o texto final corrigido.',
            '',
            texto
        ].join('\n');

        const resposta = await window.askGemini(prompt);
        const limpa = limparRespostaIA(resposta);
        if (!limpa || /^(erro|error)\b/i.test(limpa)) return null;
        return limpa;
    }

    async function corrigirComLanguageTool(texto) {
        const params = new URLSearchParams();
        params.set('text', texto);
        params.set('language', 'pt-BR');
        params.set('enabledOnly', 'false');

        const response = await fetch('https://api.languagetool.org/v2/check', {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: params.toString()
        });

        if (!response.ok) throw new Error(`LanguageTool ${response.status}`);

        const data = await response.json();
        const matches = Array.isArray(data.matches) ? data.matches : [];
        let corrigido = texto;

        matches
            .filter((match) => match?.replacements?.[0]?.value)
            .sort((a, b) => b.offset - a.offset)
            .forEach((match) => {
                const sugestao = match.replacements[0].value;
                corrigido = `${corrigido.slice(0, match.offset)}${sugestao}${corrigido.slice(match.offset + match.length)}`;
            });

        return normalizarTranscricao(corrigido);
    }

    async function corrigirTranscricao(texto) {
        const base = String(texto || '').trim();
        if (!base) return '';

        try {
            const viaIA = await corrigirComIA(base);
            if (viaIA) return viaIA;
        } catch (error) {
            console.warn('[Aja Corretor] IA indisponivel para transcricao:', error);
        }

        try {
            return await corrigirComLanguageTool(base);
        } catch (error) {
            console.warn('[Aja Corretor] LanguageTool indisponivel para transcricao:', error);
        }

        return normalizarTranscricao(base);
    }

    function obterConstrutorReconhecimento() {
        return window.SpeechRecognition || window.webkitSpeechRecognition || null;
    }

    function mensagemErroReconhecimento(error) {
        const mensagens = {
            'not-allowed': 'Microfone bloqueado. Libere o microfone no Chrome e tente novamente.',
            'service-not-allowed': 'O reconhecimento de voz foi bloqueado pelo navegador.',
            'no-speech': 'Nao ouvi nenhuma fala. Tente gravar novamente.',
            audio-capture: 'Nao encontrei um microfone disponivel.',
            network: 'Falha de rede no reconhecimento de voz.'
        };
        return mensagens[error] || 'Nao consegui continuar a transcricao de voz.';
    }

    function copiarTexto(texto, textarea) {
        if (navigator.clipboard?.writeText) {
            return navigator.clipboard.writeText(texto);
        }

        textarea?.focus();
        textarea?.select();
        document.execCommand('copy');
        return Promise.resolve();
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
        const voiceState = this.__ajaVoiceState || {
            text: '',
            raw: '',
            finalTranscript: '',
            status: 'Pronto para ouvir sua voz.',
            isRecording: false,
            isCorrecting: false,
            copyReady: false,
            recognition: null
        };
        this.__ajaVoiceState = voiceState;

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
                <span class="tab-btn-p" id="tab-voice" style="cursor:pointer;">Tradução</span>
            </div>
            <div class="panel-body" id="panel-content-area" style="background:#f8fafc; min-height:260px;"></div>
        `;

        const area = this.panel.querySelector('#panel-content-area');

        const ativarAba = (id) => {
            this.panel.querySelectorAll('.tab-btn-p').forEach((button) => {
                button.classList.toggle('active', button.id === id);
            });
        };

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

        const renderVoice = () => {
            const SpeechRecognition = obterConstrutorReconhecimento();
            const temSuporte = Boolean(SpeechRecognition);
            const textoAtual = voiceState.text || voiceState.raw || '';
            const podeCopiar = voiceState.copyReady && textoAtual.trim() && !voiceState.isRecording && !voiceState.isCorrecting;

            area.innerHTML = `
                <div style="padding:14px; display:flex; flex-direction:column; gap:12px; min-height:260px; box-sizing:border-box;">
                    <div style="background:linear-gradient(135deg,#005bbb,#ff7a00); color:white; border-radius:10px; padding:12px 14px; box-shadow:0 10px 24px rgba(0,91,187,0.22);">
                        <div style="font-weight:800; font-size:14px; margin-bottom:4px;">🎙️ Voz para texto</div>
                        <div style="font-size:12px; line-height:1.4; opacity:0.92;">Fale normalmente. Ao parar, o Aja organiza a transcrição com correção, acentos, ponto e vírgula.</div>
                    </div>
                    <textarea id="voice-transcript-box" placeholder="Clique em Gravar e fale..." style="width:100%; min-height:130px; resize:vertical; box-sizing:border-box; border:1px solid #cbd5e1; border-radius:10px; padding:12px; font-size:13px; line-height:1.45; color:#0f172a; background:white; outline:none; box-shadow:inset 0 1px 2px rgba(15,23,42,0.06);">${escapeHtml(textoAtual)}</textarea>
                    <div id="voice-status" style="font-size:12px; color:#475569; min-height:18px;">${escapeHtml(temSuporte ? voiceState.status : 'Seu Chrome nao liberou reconhecimento de voz nesta tela.')}</div>
                    <div style="display:grid; grid-template-columns:repeat(4,minmax(0,1fr)); gap:8px;">
                        <button id="btn-voice-start" class="btn-fix-all" style="min-height:36px; background:linear-gradient(135deg,#005bbb,#00a3ff);" ${!temSuporte || voiceState.isRecording || voiceState.isCorrecting ? 'disabled' : ''}>Gravar</button>
                        <button id="btn-voice-stop" class="btn-fix-all" style="min-height:36px; background:linear-gradient(135deg,#ff7a00,#ff4d00);" ${!voiceState.isRecording ? 'disabled' : ''}>Parar</button>
                        <button id="btn-voice-fix" class="btn-fix-all" style="min-height:36px; background:linear-gradient(135deg,#005bbb,#ff7a00);" ${!textoAtual.trim() || voiceState.isRecording || voiceState.isCorrecting ? 'disabled' : ''}>Corrigir</button>
                        <button id="btn-voice-copy" class="btn-fix-all" style="min-height:36px; background:linear-gradient(135deg,#12b76a,#005bbb); display:${podeCopiar ? 'block' : 'none'};" ${!podeCopiar ? 'disabled' : ''}>Copiar</button>
                    </div>
                    <button id="btn-voice-clear" style="align-self:flex-start; border:none; background:transparent; color:#64748b; cursor:pointer; font-size:12px; padding:2px 0;">Limpar transcrição</button>
                </div>
            `;

            const textarea = area.querySelector('#voice-transcript-box');
            textarea.oninput = () => {
                voiceState.text = textarea.value;
                voiceState.raw = textarea.value;
                voiceState.copyReady = false;
            };

            async function corrigirVoz() {
                const textoBase = (voiceState.raw || voiceState.text || '').trim();
                if (!textoBase) {
                    voiceState.status = 'Nenhum texto foi transcrito ainda.';
                    voiceState.copyReady = false;
                    renderVoice();
                    return;
                }

                voiceState.isCorrecting = true;
                voiceState.status = 'Corrigindo e pontuando a transcrição...';
                renderVoice();

                try {
                    const corrigido = await corrigirTranscricao(textoBase);
                    voiceState.text = corrigido;
                    voiceState.raw = corrigido;
                    voiceState.copyReady = Boolean(corrigido.trim());
                    voiceState.status = voiceState.copyReady ? 'Texto corrigido. Agora pode copiar.' : 'Nao consegui gerar um texto final.';
                } catch (error) {
                    console.error('[Aja Corretor] Erro ao corrigir transcricao:', error);
                    voiceState.text = normalizarTranscricao(textoBase);
                    voiceState.raw = voiceState.text;
                    voiceState.copyReady = Boolean(voiceState.text.trim());
                    voiceState.status = 'Usei a correção básica porque a correção completa falhou.';
                } finally {
                    voiceState.isCorrecting = false;
                    renderVoice();
                }
            }

            function iniciarGravacao() {
                if (!SpeechRecognition) {
                    voiceState.status = 'Reconhecimento de voz indisponivel neste navegador.';
                    renderVoice();
                    return;
                }

                if (voiceState.recognition) {
                    try {
                        voiceState.recognition.stop();
                    } catch (error) {
                        console.warn('[Aja Corretor] Gravacao anterior ja estava parada.', error);
                    }
                }

                const recognition = new SpeechRecognition();
                voiceState.recognition = recognition;
                voiceState.text = '';
                voiceState.raw = '';
                voiceState.finalTranscript = '';
                voiceState.copyReady = false;
                voiceState.isRecording = true;
                voiceState.isCorrecting = false;
                voiceState.status = 'Ouvindo... fale normalmente.';

                recognition.lang = 'pt-BR';
                recognition.continuous = true;
                recognition.interimResults = true;
                recognition.maxAlternatives = 1;

                recognition.onresult = (event) => {
                    let interim = '';
                    for (let index = event.resultIndex; index < event.results.length; index += 1) {
                        const transcript = event.results[index][0]?.transcript || '';
                        if (event.results[index].isFinal) {
                            voiceState.finalTranscript += `${transcript} `;
                        } else {
                            interim += transcript;
                        }
                    }

                    voiceState.raw = `${voiceState.finalTranscript} ${interim}`.trim();
                    voiceState.text = voiceState.raw;
                    voiceState.status = interim ? 'Transcrevendo em tempo real...' : 'Ouvindo...';
                    renderVoice();
                };

                recognition.onerror = (event) => {
                    voiceState.status = mensagemErroReconhecimento(event.error);
                    voiceState.isRecording = false;
                    voiceState.copyReady = Boolean((voiceState.text || '').trim());
                    renderVoice();
                };

                recognition.onend = () => {
                    if (voiceState.isRecording) {
                        try {
                            recognition.start();
                        } catch (error) {
                            voiceState.isRecording = false;
                            voiceState.status = 'A gravação foi interrompida pelo navegador.';
                            renderVoice();
                        }
                        return;
                    }

                    if ((voiceState.raw || '').trim()) {
                        corrigirVoz();
                    } else {
                        voiceState.status = 'Gravação encerrada sem texto.';
                        renderVoice();
                    }
                };

                try {
                    recognition.start();
                    renderVoice();
                } catch (error) {
                    voiceState.isRecording = false;
                    voiceState.status = 'Nao consegui iniciar o microfone. Tente novamente.';
                    renderVoice();
                }
            }

            function pararGravacao() {
                if (!voiceState.isRecording) return;
                voiceState.isRecording = false;
                voiceState.status = 'Parando e preparando a correção...';
                renderVoice();
                try {
                    voiceState.recognition?.stop();
                } catch (error) {
                    corrigirVoz();
                }
            }

            area.querySelector('#btn-voice-start').onclick = iniciarGravacao;
            area.querySelector('#btn-voice-stop').onclick = pararGravacao;
            area.querySelector('#btn-voice-fix').onclick = () => {
                voiceState.raw = textarea.value;
                voiceState.text = textarea.value;
                corrigirVoz();
            };
            area.querySelector('#btn-voice-copy').onclick = async () => {
                try {
                    await copiarTexto(voiceState.text || '', textarea);
                    voiceState.status = 'Texto copiado.';
                } catch (error) {
                    voiceState.status = 'Nao consegui copiar automaticamente. Selecione e copie manualmente.';
                }
                renderVoice();
            };
            area.querySelector('#btn-voice-clear').onclick = () => {
                if (voiceState.isRecording) {
                    voiceState.isRecording = false;
                    try {
                        voiceState.recognition?.stop();
                    } catch (error) {
                        console.warn('[Aja Corretor] Gravacao ja estava parada.', error);
                    }
                }
                voiceState.text = '';
                voiceState.raw = '';
                voiceState.finalTranscript = '';
                voiceState.copyReady = false;
                voiceState.status = 'Pronto para ouvir sua voz.';
                renderVoice();
            };
        };

        renderErrors();

        this.panel.querySelector('#tab-errors').onclick = () => {
            ativarAba('tab-errors');
            renderErrors();
        };

        this.panel.querySelector('#tab-dict').onclick = () => {
            ativarAba('tab-dict');
            renderDict();
        };

        this.panel.querySelector('#tab-voice').onclick = () => {
            ativarAba('tab-voice');
            renderVoice();
        };

        this.panel.querySelector('#btn-spell-close').onclick = () => {
            if (voiceState.isRecording) {
                voiceState.isRecording = false;
                try {
                    voiceState.recognition?.stop();
                } catch (error) {
                    console.warn('[Aja Corretor] Gravacao ja estava parada.', error);
                }
            }
            this.panel.style.display = 'none';
        };

        this.panel.querySelector('#btn-fix-all').onclick = () => {
            if (!this.ultimoCampo) return;
            const aplicar = this.aplicarCorrecaoMath || this.aplicarCorrecao;
            erros.forEach((err) => {
                if (err?.replacements?.[0] && typeof aplicar === 'function') {
                    aplicar.call(this, err, err.replacements[0].value);
                }
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