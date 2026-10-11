document.addEventListener('DOMContentLoaded', () => {
    const els = {
        token: document.getElementById('github-token'),
        repoUser: document.getElementById('repo-user'),
        repoName: document.getElementById('repo-name'),
        fileSelector: document.getElementById('file-selector'),
        status: document.getElementById('status-msg'),
        editorUi: document.getElementById('editor-ui'),
        hotkeyGroup: document.getElementById('hotkey-group'),
        list: document.getElementById('lista-itens'),
        filter: document.getElementById('filter-input'),
        title: document.getElementById('edit-title'),
        text: document.getElementById('edit-text'),
        favorite: document.getElementById('edit-favorite'),
        hotkey: document.getElementById('edit-hotkey'),
        tags: document.getElementById('edit-tags'),
        btnLoad: document.getElementById('btn-load'),
        btnSaveGithub: document.getElementById('btn-save-github'),
        btnNewItem: document.getElementById('btn-new-item'),
        btnDeleteItem: document.getElementById('btn-delete-item'),
        btnApplyLocal: document.getElementById('btn-apply-local')
    };

    let dadosAtuais = [];
    let shaAtual = '';
    let itemSelecionadoIndex = -1;
    let arquivoAtual = '';

    const tokenStore = {
        get(callback) {
            if (typeof chrome !== 'undefined' && chrome.storage?.session) {
                chrome.storage.session.get(['gh_token'], result => {
                    callback(result.gh_token || localStorage.getItem('gh_token') || '');
                });
                return;
            }
            callback(localStorage.getItem('gh_token') || '');
        },
        set(token) {
            if (typeof chrome !== 'undefined' && chrome.storage?.session) {
                chrome.storage.session.set({ gh_token: token });
                localStorage.removeItem('gh_token');
                return;
            }
            localStorage.setItem('gh_token', token);
        }
    };

    function setStatus(text, color) {
        els.status.innerText = text;
        els.status.style.color = color;
    }

    function decodeBase64Utf8(content) {
        const binary = atob(content.replace(/\s/g, ''));
        const bytes = Uint8Array.from(binary, char => char.charCodeAt(0));
        return new TextDecoder().decode(bytes);
    }

    function encodeBase64Utf8(text) {
        const bytes = new TextEncoder().encode(text);
        let binary = '';
        bytes.forEach(byte => {
            binary += String.fromCharCode(byte);
        });
        return btoa(binary);
    }

    function normalizeTags(value) {
        return value
            .split(',')
            .map(tag => tag.trim().toUpperCase().replace(/ /g, '_'))
            .filter(Boolean);
    }

    function renderizarLista(filtro = '') {
        const termo = filtro.trim().toLowerCase();
        els.list.innerHTML = '';

        dadosAtuais.forEach((item, index) => {
            const title = String(item.title || '');
            if (termo && !title.toLowerCase().includes(termo)) return;

            const btn = document.createElement('button');
            btn.className = `item-list-btn ${index === itemSelecionadoIndex ? 'active' : ''}`;
            btn.innerText = `${item.isFavorite ? '⭐ ' : ''}${title || '(sem título)'}`;
            btn.addEventListener('click', () => selecionarItem(index));
            els.list.appendChild(btn);
        });
    }

    function selecionarItem(index) {
        itemSelecionadoIndex = index;
        const item = dadosAtuais[index] || {};
        els.title.value = item.title || '';
        els.text.value = item.text || '';
        els.favorite.checked = Boolean(item.isFavorite);
        els.hotkey.value = item.hotkey || '';
        els.tags.value = (item.requiredData || []).join(', ');
        renderizarLista(els.filter.value);
    }

    async function carregarDados() {
        const token = els.token.value.trim();
        const user = els.repoUser.value.trim();
        const repo = els.repoName.value.trim();
        arquivoAtual = els.fileSelector.value;

        if (!token) {
            alert('Por favor, insira o Token do GitHub.');
            return;
        }

        tokenStore.set(token);
        setStatus('Baixando...', 'yellow');

        try {
            const url = `https://api.github.com/repos/${encodeURIComponent(user)}/${encodeURIComponent(repo)}/contents/${encodeURIComponent(arquivoAtual)}`;
            const response = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });

            if (!response.ok) throw new Error(`Falha ao acessar GitHub (${response.status}).`);

            const json = await response.json();
            shaAtual = json.sha;
            const parsedData = JSON.parse(decodeBase64Utf8(json.content));

            if (Array.isArray(parsedData)) {
                dadosAtuais = parsedData;
            } else if (parsedData.protocols) {
                dadosAtuais = parsedData.protocols;
            } else {
                dadosAtuais = [];
            }

            itemSelecionadoIndex = -1;
            els.editorUi.style.display = 'grid';
            els.hotkeyGroup.style.visibility = arquivoAtual.includes('protocolos') ? 'hidden' : 'visible';
            setStatus('Pronto!', '#0057B8');
            renderizarLista(els.filter.value);
        } catch (error) {
            console.error(error);
            setStatus('Erro!', 'red');
            alert(`Erro: ${error.message}`);
        }
    }

    function novoItem() {
        const novo = { title: 'NOVO - Título', text: '', isFavorite: false, requiredData: [] };
        dadosAtuais.unshift(novo);
        selecionarItem(0);
        els.title.focus();
    }

    function limparFormulario() {
        els.title.value = '';
        els.text.value = '';
        els.favorite.checked = false;
        els.hotkey.value = '';
        els.tags.value = '';
    }

    function deletarItemAtual() {
        if (itemSelecionadoIndex === -1) return;
        if (!confirm('Tem certeza?')) return;

        dadosAtuais.splice(itemSelecionadoIndex, 1);
        itemSelecionadoIndex = -1;
        limparFormulario();
        renderizarLista(els.filter.value);
    }

    function aplicarEdicaoLocal() {
        if (itemSelecionadoIndex === -1) return;

        const original = dadosAtuais[itemSelecionadoIndex] || {};
        const atualizado = {
            ...original,
            title: els.title.value,
            text: els.text.value,
            isFavorite: els.favorite.checked,
            hotkey: els.hotkey.value,
            requiredData: normalizeTags(els.tags.value)
        };

        if (arquivoAtual.includes('protocolos')) {
            atualizado.category = atualizado.category || 'GERAL';
        }

        dadosAtuais[itemSelecionadoIndex] = atualizado;
        renderizarLista(els.filter.value);

        const originalText = els.btnApplyLocal.innerText;
        els.btnApplyLocal.innerText = 'Editado!';
        setTimeout(() => {
            els.btnApplyLocal.innerText = originalText;
        }, 1000);
    }

    async function salvarNoGithub() {
        if (!confirm('Salvar alterações no GitHub?')) return;

        const token = els.token.value.trim();
        const user = els.repoUser.value.trim();
        const repo = els.repoName.value.trim();

        setStatus('Enviando...', 'yellow');

        const conteudoFinal = arquivoAtual.includes('protocolos')
            ? {
                protocols: dadosAtuais,
                blocks: [],
                version: `1.9_Editor_Web_${Date.now()}`,
                exported: new Date().toISOString()
            }
            : dadosAtuais;

        const body = {
            message: 'Atualização via Painel O Cérebro',
            content: encodeBase64Utf8(JSON.stringify(conteudoFinal, null, 2)),
            sha: shaAtual
        };

        try {
            const url = `https://api.github.com/repos/${encodeURIComponent(user)}/${encodeURIComponent(repo)}/contents/${encodeURIComponent(arquivoAtual)}`;
            const response = await fetch(url, {
                method: 'PUT',
                headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
                body: JSON.stringify(body)
            });

            if (!response.ok) throw new Error(`GitHub recusou a gravação (${response.status}).`);

            const json = await response.json();
            shaAtual = json.content.sha;
            setStatus('Salvo!', '#0057B8');
            alert('Sucesso!');
        } catch (error) {
            console.error(error);
            setStatus('Erro', 'red');
            alert(`Erro: ${error.message}`);
        }
    }

    tokenStore.get(token => {
        if (token) els.token.value = token;
    });

    els.btnLoad.addEventListener('click', carregarDados);
    els.btnSaveGithub.addEventListener('click', salvarNoGithub);
    els.btnNewItem.addEventListener('click', novoItem);
    els.btnDeleteItem.addEventListener('click', deletarItemAtual);
    els.btnApplyLocal.addEventListener('click', aplicarEdicaoLocal);
    els.filter.addEventListener('input', event => renderizarLista(event.target.value));
});
