# Usar pelo GitHub do zero

Repositorio novo:

```txt
https://github.com/kingoffjoss/AjaExtension
```

GitHub Pages esperado:

```txt
https://kingoffjoss.github.io/AjaExtension/
```

## Favorito recomendado

Crie um favorito no Chrome com o nome:

```txt
Aja Completo
```

Cole este codigo no campo URL:

```js
javascript:(()=>{const LOADER_ID='aja-assistant-content-loader';const SCRIPT_URL='https://kingoffjoss.github.io/AjaExtension/content.js';const old=document.getElementById(LOADER_ID);if(old)old.remove();const s=document.createElement('script');s.id=LOADER_ID;s.src=SCRIPT_URL+'?v='+Date.now();s.onload=()=>alert('Aja Assistant completo carregado pelo favorito.');s.onerror=()=>alert('Nao consegui carregar content.js. Confira se ele foi publicado no GitHub Pages.');document.documentElement.appendChild(s);})();
```

## Favorito alternativo

Este carrega o `Loader.js`, que por sua vez carrega o `content.js`:

```js
javascript:(()=>{const LOADER_ID='aja-assistant-bookmarklet-loader';const SCRIPT_URL='https://kingoffjoss.github.io/AjaExtension/Loader.js';const old=document.getElementById(LOADER_ID);if(old)old.remove();const s=document.createElement('script');s.id=LOADER_ID;s.src=SCRIPT_URL+'?v='+Date.now();s.onload=()=>alert('Aja Assistant carregado pelo favorito.');s.onerror=()=>alert('Nao consegui carregar o loader completo. Confira se o GitHub Pages do repositorio AjaExtension esta ativo.');document.documentElement.appendChild(s);})();
```

## Publicar arquivos

O script abaixo publica neste novo repositorio:

```powershell
.\publicar-no-github.ps1
```

Ele usa:

```txt
https://github.com/kingoffjoss/AjaExtension.git
```

Se o Git pedir login, autentique na conta `kingoffjoss`.

## Ativar GitHub Pages

No GitHub, abra:

```txt
Settings > Pages
```

Configure:

```txt
Source: Deploy from a branch
Branch: main
Folder: / (root)
```

Depois de salvar, aguarde alguns minutos e teste:

```txt
https://kingoffjoss.github.io/AjaExtension/content.js
https://kingoffjoss.github.io/AjaExtension/Loader.js
```
