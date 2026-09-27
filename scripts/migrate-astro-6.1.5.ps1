#Requires -Version 7.0
<#
.SYNOPSIS
    Перенос файлов авторского функционала и контента из ветки main-qwen3
    в шаблон astro-theme-retypeset с версией Astro 6.1.5.

.DESCRIPTION
    1. Копирует файлы из отчёта reports/Author-Schema-yandex.md.
    2. Копирует папку src/content целиком.
    3. Обновляет package.json: astro -> ^6.1.5, добавляет скрипт new-author-post.
    4. Приводит tsconfig.json: paths "@/*" -> "./src/*".
    5. Запускает pnpm install для обновления pnpm-lock.yaml.

.PARAMETER Source
    Путь к папке с вашими правками (выгрузка/клон ветки main-qwen3).

.PARAMETER Target
    Путь к папке свежего шаблона astro-theme-retypeset (Astro 6.1.5).

.PARAMETER SkipInstall
    Пропустить pnpm install (обновление lock-файла вручную).

.EXAMPLE
    .\migrate-astro-6.1.5.ps1 -Source C:\work\main-qwen3 -Target C:\work\retypeset-6.1.5
#>
param(
    [Parameter(Mandatory = $true)]
    [string]$Source,

    [Parameter(Mandatory = $true)]
    [string]$Target,

    [switch]$SkipInstall
)

$ErrorActionPreference = 'Stop'

if (-not (Test-Path -LiteralPath $Source)) { throw "Папка Source не найдена: $Source" }
if (-not (Test-Path -LiteralPath $Target)) { throw "Папка Target не найдена: $Target" }

# --- 1. Файлы авторского функционала (отчёт Author-Schema-yandex.md) ---
$files = @(
    'src/data/authors.yaml'
    'src/utils/author.ts'
    'src/components/PostAuthor.astro'
    'scripts/new-author-post.ts'
    'src/content.config.ts'
    'src/pages/[...lang]/posts/[slug].astro'
    'src/layouts/Layout.astro'
    'src/layouts/Head.astro'
)

Write-Host "`n=== 1/5: Копирование файлов функционала авторов ===" -ForegroundColor Cyan
foreach ($rel in $files) {
    $src = Join-Path $Source $rel
    $dst = Join-Path $Target $rel
    if (-not (Test-Path -LiteralPath $src)) {
        Write-Warning "Пропуск: не найден в Source -> $rel"
        continue
    }
    $dstDir = Split-Path -Parent $dst
    New-Item -ItemType Directory -Path $dstDir -Force | Out-Null
    Copy-Item -LiteralPath $src -Destination $dst -Force
    Write-Host "  OK  $rel"
}

# --- 2. Папка src/content целиком ---
Write-Host "`n=== 2/5: Копирование src/content ===" -ForegroundColor Cyan
$srcContent = Join-Path $Source 'src/content'
$dstContent = Join-Path $Target 'src/content'
if (-not (Test-Path -LiteralPath $srcContent)) {
    Write-Warning "Пропуск: нет src/content в Source"
} else {
    New-Item -ItemType Directory -Path $dstContent -Force | Out-Null
    Copy-Item -LiteralPath (Join-Path $srcContent '*') -Destination $dstContent -Recurse -Force
    Write-Host "  OK  src/content (рекурсивно, включая about/posts/_images)"
}

# --- 3. package.json: astro 6.1.5 + скрипт new-author-post ---
Write-Host "`n=== 3/5: Обновление package.json ===" -ForegroundColor Cyan
$pkgPath = Join-Path $Target 'package.json'
if (-not (Test-Path -LiteralPath $pkgPath)) {
    Write-Warning "Пропуск: нет package.json в Target"
} else {
    $pkg = Get-Content -LiteralPath $pkgPath -Raw -Encoding utf8 | ConvertFrom-Json
    $pkg.dependencies.astro = '^6.1.5'
    if ($null -eq $pkg.scripts.'new-author-post') {
        $pkg.scripts | Add-Member -NotePropertyName 'new-author-post' -NotePropertyValue 'tsx scripts/new-author-post.ts' -Force
    }
    $pkg | ConvertTo-Json -Depth 20 | Set-Content -LiteralPath $pkgPath -Encoding utf8
    Write-Host "  OK  astro -> ^6.1.5, добавлен скрипт new-author-post"
}

# --- 4. tsconfig.json: paths -> ./src/* ---
Write-Host "`n=== 4/5: Проверка tsconfig.json ===" -ForegroundColor Cyan
$tsPath = Join-Path $Target 'tsconfig.json'
if (Test-Path -LiteralPath $tsPath) {
    $ts = Get-Content -LiteralPath $tsPath -Raw -Encoding utf8 | ConvertFrom-Json
    $changed = $false
    if ($ts.compilerOptions.paths.'@/*') {
        $ts.compilerOptions.paths.'@/*' = @('./src/*')
        $changed = $true
    }
    if ($changed) {
        $ts | ConvertTo-Json -Depth 20 | Set-Content -LiteralPath $tsPath -Encoding utf8
        Write-Host "  OK  paths '@/*' -> './src/*'"
    } else {
        Write-Host "  --  paths не менялся (уже корректен или отсутствует)"
    }
} else {
    Write-Warning "Пропуск: нет tsconfig.json в Target"
}

# --- 5. pnpm install ---
if (-not $SkipInstall) {
    Write-Host "`n=== 5/5: pnpm install (обновление pnpm-lock.yaml) ===" -ForegroundColor Cyan
    Push-Location $Target
    try {
        pnpm install
        if ($LASTEXITCODE -ne 0) { throw "pnpm install завершился с кодом $LASTEXITCODE" }
        Write-Host "  OK  lock-файл обновлён"
    } finally {
        Pop-Location
    }
} else {
    Write-Host "`n=== 5/5: пропущено (SkipInstall) — обновите pnpm-lock.yaml вручную ===" -ForegroundColor Yellow
}

Write-Host "`nГотово. Проверьте сборку: cd '$Target'; pnpm build" -ForegroundColor Green