param(
    [string]$RepositoryUrl = "https://github.com/kingoffjoss/AjaExtension.git",
    [string]$Branch = "main"
)

$ErrorActionPreference = "Stop"

$Root = Split-Path -Parent $MyInvocation.MyCommand.Path
$PublishRoot = Join-Path $Root ".publish"
$CloneDir = Join-Path $PublishRoot "AjaExtension"

New-Item -ItemType Directory -Force -Path $PublishRoot | Out-Null

$resolvedPublishRoot = [System.IO.Path]::GetFullPath($PublishRoot)
$resolvedCloneDir = [System.IO.Path]::GetFullPath($CloneDir)
if (-not $resolvedCloneDir.StartsWith($resolvedPublishRoot, [System.StringComparison]::OrdinalIgnoreCase)) {
    throw "Diretorio de clone fora da pasta de publicacao esperada."
}

if ((Test-Path $CloneDir) -and -not (Test-Path (Join-Path $CloneDir ".git"))) {
    Remove-Item -LiteralPath $CloneDir -Recurse -Force
}

if (Test-Path (Join-Path $CloneDir ".git")) {
    git -C $CloneDir -c http.sslBackend=openssl fetch origin
} else {
    git -c http.sslBackend=openssl clone $RepositoryUrl $CloneDir
}

git -C $CloneDir checkout -B $Branch

git -C $CloneDir -c http.sslBackend=openssl pull --ff-only origin $Branch
if ($LASTEXITCODE -ne 0) {
    Write-Host "Branch remota ainda vazia ou sem historico. Continuando com primeiro commit."
}

$filesToPublish = @(
    "manifest.json",
    "content.js",
    "background.js",
    "popup.html",
    "popup.js",
    "admin.html",
    "admin.js",
    "encerrar-cliente-nativo.js",
    "Loader.js",
    "README.md",
    ".nojekyll",
    "respostas_COMPLETAS.json",
    "protocolos_brisanet_v1_9.json",
    "bookmarklet-carregador-completo.js",
    "bookmarklet-carregador-completo.txt",
    "bookmarklet-content-completo.js",
    "bookmarklet-content-completo.txt",
    "COMO_USAR_PELO_GITHUB.md"
)

foreach ($file in $filesToPublish) {
    $source = Join-Path $Root $file
    if (Test-Path $source) {
        Copy-Item -LiteralPath $source -Destination (Join-Path $CloneDir $file) -Force
    }
}

if (-not (git -C $CloneDir config user.name)) {
    git -C $CloneDir config user.name "Aja Assistant"
}

if (-not (git -C $CloneDir config user.email)) {
    git -C $CloneDir config user.email "aja-assistant@example.local"
}

git -C $CloneDir add $filesToPublish

$status = git -C $CloneDir status --short
if (-not $status) {
    Write-Host "Nada para publicar. O repositorio ja esta atualizado."
    exit 0
}

Write-Host "Arquivos alterados:"
Write-Host $status

git -C $CloneDir commit -m "Atualiza Aja Assistant para uso pelo GitHub Pages"
if ($LASTEXITCODE -ne 0) {
    throw "Commit falhou."
}

git -C $CloneDir -c http.sslBackend=openssl push origin $Branch
if ($LASTEXITCODE -ne 0) {
    throw "Push falhou. Autentique no GitHub e tente novamente."
}

Write-Host "Publicado com sucesso."
Write-Host "Favorito content.js: https://kingoffjoss.github.io/AjaExtension/content.js"
Write-Host "Favorito loader: https://kingoffjoss.github.io/AjaExtension/Loader.js"
