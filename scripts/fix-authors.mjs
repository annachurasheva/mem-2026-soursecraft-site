// scripts/fix-authors.mjs
// Восстанавливает корректный синтаксис массива для authorIds в YAML frontmatter.
// По умолчанию DRY-RUN: только печатает найденное, НИЧЕГО не пишет.
// Запись — только с флагом --apply.
// Запуск:
//   node scripts/fix-authors.mjs "src/content/posts"            <- сухой прогон
//   node scripts/fix-authors.mjs "src/content/posts" --apply    <- реальная запись

import { readdir, readFile, writeFile, stat } from 'node:fs/promises'
import { basename, extname, join } from 'node:path'
import process from 'node:process'

const ROOT = process.argv[2]
const APPLY = process.argv.includes('--apply')
const DEFAULT_AUTHOR = 'wikipedia' // Можно заменить на 'redaktsiya', если нужно

if (!ROOT) {
  console.error('❌ Укажите папку: node scripts/fix-authors.mjs "путь" [--apply]')
  console.error('   Пример: node scripts/fix-authors.mjs "src/content/posts" --apply')
  process.exit(1)
}

// Регулярное выражение ищет:
// 1. "authorIds:" в начале строки
// 2. Перенос строки
// 3. Следующая строка НЕ начинается с тире и пробела (признак валидного YAML-массива)
const RX_BROKEN_AUTHOR_IDS = /(^authorIds:\s*\r?\n)(?!\s*-)([^\r\n]+)/gm

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
    return // Файл уже корректен (имеет тире) или не содержит authorIds
  }

  console.log(`\n== ${basename(filePath)} — найдено проблемных authorIds: ${matches.length}`)
  
  // Показываем контекст найденного для прозрачности
  matches.slice(0, 3).forEach((m) => {
    console.log(`   Было: "${m[0].replace(/\n/g, '\\n')}"`)
  })

  // Заменяем на корректный YAML-массив с отступом в 2 пробела
  const fixedContent = content.replace(RX_BROKEN_AUTHOR_IDS, `$1  - ${DEFAULT_AUTHOR}\n`)

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
await walk(ROOT)

console.log(`\n📊 Итого: обработано файлов с ошибками: ${totalFixed}`)
if (!APPLY) {
  console.log('⚠️  Режим DRY-RUN: файлы не были изменены.')
  console.log('💡 Для реального исправления запустите: node scripts/fix-authors.mjs "src/content/posts" --apply')
} else {
  console.log('✅ Изменения успешно записаны на диск.')
}