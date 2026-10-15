// scripts/fix-authors.mjs
// БАЗОВЫЙ скрипт для проверок перед публикациями.
// Восстанавливает корректный синтаксис массива authorIds в YAML frontmatter
// и проставляет автора по умолчанию (DEFAULT_AUTHOR — ID из src/data/authors.yaml).
//
// По умолчанию DRY-RUN: только показывает, ЧТО планирует исправить, НИЧЕГО не пишет.
// Реальная запись — только с флагом --apply.
//
// Запуск:
//   node scripts/fix-authors.mjs "src/content/posts"           <- сухой прогон (рекомендуется перед публикацией)
//   node scripts/fix-authors.mjs "src/content/posts" --apply   <- реальная запись

import { readdir, readFile, writeFile, stat } from 'node:fs/promises'
import { basename, extname, join } from 'node:path'
import process from 'node:process'

const ROOT = process.argv[2]
const APPLY = process.argv.includes('--apply')
// Автор по умолчанию: ID записи 'wikipedia' из src/data/authors.yaml
const DEFAULT_AUTHOR = 'wikipedia'

if (!ROOT) {
  console.error('❌ Укажите папку: node scripts/fix-authors.mjs "путь" [--apply]')
  console.error('   Пример: node scripts/fix-authors.mjs "src/content/posts" --apply')
  process.exit(1)
}

// Регулярное выражение ищет сломанный authorIds:
//   1. "authorIds:" в начале строки + перевод строки
//   2. следующая строка НЕ является элементом YAML-массива ("- item", т.е. "- " с пробелом)
// и захватывает эту строку, чтобы решить, что с ней делать (закрывающий "---" сохраняем).
const RX_BROKEN_AUTHOR_IDS = /(^authorIds:\s*\r?\n)(?!\s*-[ 	])([^\r\n]*)(\r?\n|$)/gm

let totalFixed = 0

async function processFile(filePath) {
  let content
  try {
    content = await readFile(filePath, 'utf8')
  } catch (err) {
    console.error(`[IO] Ошибка чтения ${filePath}: ${err.message}`)
    return
  }

  const matches = [...content.matchAll(RX_BROKEN_AUTHOR_IDS)]
  if (!matches.length) {
    return // Файл уже корректен (authorIds — массив) или не содержит authorIds
  }

  console.log(`\n== ${basename(filePath)} — найдено проблемных authorIds: ${matches.length}`)

  // Показываем, ЧТО планируется исправить (для прозрачности)
  matches.slice(0, 3).forEach((m) => {
    console.log(`   Было:   "${m[0].replace(/\n/g, '\\n')}"`)
    console.log(`   Станет: "authorIds:\\n  - ${DEFAULT_AUTHOR}\\n"`)
  })
  if (matches.length > 3) {
    console.log(`   … и ещё ${matches.length - 3} совпадение(й)`)
  }

  // Заменяем на корректный YAML-массив с отступом в 2 пробела.
  // Закрывающий разделитель frontmatter "---" при этом сохраняется.
  const fixedContent = content.replace(
    RX_BROKEN_AUTHOR_IDS,
    (match, header, brokenLine, lineEnd) => {
      const isFrontmatterTerminator = /^---+$/.test(brokenLine.trim())
      if (isFrontmatterTerminator) {
        return `${header}  - ${DEFAULT_AUTHOR}\n${brokenLine}${lineEnd}`
      }
      return `${header}  - ${DEFAULT_AUTHOR}\n`
    },
  )

  if (APPLY) {
    try {
      await writeFile(filePath, fixedContent, 'utf8')
      console.log('   -> ✅ записано')
    } catch (err) {
      console.error(`[IO] Ошибка записи ${filePath}: ${err.message}`)
      return
    }
  } else {
    console.log('   -> ⏸️ пропущено (DRY-RUN)')
  }

  totalFixed += matches.length
}

async function walk(dir) {
  let entries
  try {
    entries = await readdir(dir, { withFileTypes: true })
  } catch (err) {
    console.error(`[IO] Ошибка чтения директории ${dir}: ${err.message}`)
    return
  }

  for (const entry of entries) {
    const p = join(dir, entry.name)
    if (entry.isDirectory()) {
      await walk(p)
      continue
    }

    const fileStat = await stat(p).catch(() => null)
    if (!fileStat || !fileStat.isFile()) continue
    if (extname(entry.name).toLowerCase() !== '.md') continue

    await processFile(p)
  }
}

console.log(`🔍 Сканирование папки: ${ROOT}`)
console.log(`👤 Автор по умолчанию: ${DEFAULT_AUTHOR} (см. src/data/authors.yaml)`)
await walk(ROOT)

console.log(`\n📊 Итого: обработано файлов с ошибками: ${totalFixed}`)
if (!APPLY) {
  console.log('⚠️  Режим DRY-RUN: файлы не были изменены.')
  console.log('💡 Для реального исправления запустите: node scripts/fix-authors.mjs "src/content/posts" --apply')
} else {
  console.log('✅ Изменения успешно записаны на диск.')
}