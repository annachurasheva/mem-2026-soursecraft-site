// fix-glue.mjs — восстанавливает границы абзацев в стыках вида «оккупантов.В».
// По умолчанию DRY-RUN: только печатает найденное, НИЧЕГО не пишет.
// Запись — только с флагом --apply.
// Запуск:
//   node scripts/fix-glue.mjs "путь\к\posts"            <- сухой прогон
//   node scripts/fix-glue.mjs "путь\к\posts" --apply    <- запись
//   node scripts/fix-glue.mjs "путь\к\posts" --apply --git --report json

import { execSync } from 'node:child_process'
import { lstat, readdir, readFile, writeFile } from 'node:fs/promises'
import { basename, extname, join } from 'node:path'
import process from 'node:process'
import { detect } from 'detect-character-encoding' // npm i detect-character-encoding

const ROOT = process.argv[2]
const APPLY = process.argv.includes('--apply')
const USE_GIT = process.argv.includes('--git')
const REPORT_FMT = process.argv.find(arg => arg.startsWith('--report='))?.split('=')[1] || null

if (!ROOT) {
  console.error('Укажите папку: node scripts/fix-glue.mjs "путь" [--apply] [--git] [--report=json]')
  process.exit(1)
}

// Список защищаемых сокращений (без точки). Легко редактировать под новые архивы.
const ABBREVS = new Set([
  'г',
  'ул',
  'пер',
  'пр',
  'пос',
  'с',
  'дер',
  'ст',
  'им',
  'р-н',
  'обл',
  'кап',
  'лейт',
  'ген',
  'мл',
  'ст',
  'серж',
  'ефр',
  'кр арм',
  'гв',
  'див',
  'полк',
  'бат',
  'стр',
  'арт',
  'кав',
  'мед',
  'сан',
  'п/п',
  'в/ч',
])

// Собираем негативный просмотр из сокращений (до 4 букв/цифр + точка)
const abbrevPattern = Array.from(ABBREVS).map(a => a.replace(/[-/\\^$*+?.()|[{}]/g, '\\$&')).join('|')

// Стык: ≥3 строчных/цифр + точка + заглавная, после которой строчная или пробел.
// Защита: «С.В.» (заглавная перед точкой), сокращения из списка, "big3059.JPG" (после заглавной — заглавная).
const RX = new RegExp(
  `(?<=[\\u0430-\\u044f\\u04510-9]{3,}\\.)(?<!\\b(?:${abbrevPattern})\\.)(?![\\u0410-\\u042f\\u0401A-Z\\u00ab])([\\u0410-\\u042f\\u0401A-Z\\u00ab])(?=[\\u0430-\\u044f\\u0451a-z\\s\\u00A0])`,
  'g',
)

let total = 0
const report = []

async function processFile(filePath) {
  let rawBuffer
  try {
    rawBuffer = await readFile(filePath)
  }
  catch (err) {
    console.error(`[IO] Ошибка чтения ${filePath}: ${err.message}`)
    return
  }

  const encoding = detect(rawBuffer) || 'utf-8'
  const before = rawBuffer.toString(encoding)
  const matches = [...before.matchAll(RX)]
  if (!matches.length)
    return

  const fixed = before.replace(RX, '\n\n$1')
  // Нормализация неразрывных пробелов, если они остались перед буквой
  const finalContent = fixed.replace(/\u00A0+/g, ' ')

  total += matches.length
  console.log(`\n== ${basename(filePath)} — стыков: ${matches.length}`)
  matches.slice(0, 6).forEach((m) => {
    const s = Math.max(0, m.index - 40)
    console.log(`   …${before.slice(s, m.index + 40).replace(/\n/g, ' ')}…`)
  })

  if (APPLY) {
    try {
      await writeFile(filePath, finalContent, 'utf8')
      console.log('   -> записано')
      if (USE_GIT) {
        try {
          execSync(`git add "${filePath}"`, { stdio: 'ignore' })
          execSync(`git commit -m "fix(glue): ${matches.length} стыков в ${basename(filePath)}"`, { stdio: 'ignore' })
        }
        catch (e) {
          console.error(`[Git] Ошибка фиксации ${filePath}: ${e.message}`)
        }
      }
    }
    catch (err) {
      console.error(`[IO] Ошибка записи ${filePath}: ${err.message}`)
      return
    }
  }

  if (REPORT_FMT) {
    report.push({
      file: filePath,
      matches: matches.length,
      encoding,
    })
  }
}

async function walk(dir) {
  let entries
  try {
    entries = await readdir(dir, { withFileTypes: true })
  }
  catch (err) {
    console.error(`[IO] Ошибка чтения директории ${dir}: ${err.message}`)
    return
  }

  for (const entry of entries) {
    const p = join(dir, entry.name)
    if (entry.isDirectory()) {
      await walk(p)
      continue
    }
    // Проверяем и обычные файлы, и симлинки на файлы
    const stat = await lstat(p).catch(() => null)
    if (!stat || !stat.isFile())
      continue
    if (extname(entry.name).toLowerCase() !== '.md')
      continue

    await processFile(p)
  }
}

await walk(ROOT)

if (REPORT_FMT === 'json') {
  console.log('\nREPORT:', JSON.stringify(report, null, 2))
}

console.log(`\nВсего стыков: ${total}${APPLY ? ' (записано)' : ' (DRY-RUN: ничего не записано. Повтор с --apply)'}`)
