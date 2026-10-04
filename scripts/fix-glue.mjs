// fix-glue.mjs — восстанавливает границы абзацев в стыках вида «оккупантов.В».
// По умолчанию DRY-RUN: только печатает найденное, НИЧЕГО не пишет.
// Запись — только с флагом --apply.
// Запуск:
//   node scripts/fix-glue.mjs "путь\к\posts"            <- сухой прогон
//   node scripts/fix-glue.mjs "путь\к\posts" --apply    <- запись

import { readdir, readFile, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import process from 'node:process'

const ROOT = process.argv[2]
const APPLY = process.argv.includes('--apply')

if (!ROOT) {
  console.error('Укажите папку: node scripts/fix-glue.mjs "путь" [--apply]')
  process.exit(1)
}

const RX = /(?<=[\u0430-\u044F\u04510-9]{2}\.)(?<!\b(?:\u0433\u043E\u0440|\u0434\u0435\u0440|\u0441\u0435\u043B|\u043F\u043E\u0441|\u0443\u043B|\u043F\u0435\u0440|\u0441\u0442|\u0442\u043E\u0432|\u0438\u043C|\u0433\u043E\u0441|\u043A\u0430\u043F|\u043B\u0435\u0439\u0442|\u0433\u0435\u043D|\u043A\u043E\u043C|\u0440\u0435\u0434|\u0438\u0437\u0434|\u0441\u0442\u0440|\u0433\u043B)\.)([\u0410-\u042F\u0401A-Z\u00AB])(?=[\u0430-\u044F\u0451a-z\s])/g

let total = 0

async function walk(dir) {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const p = join(dir, entry.name)
    if (entry.isDirectory()) {
      await walk(p)
      continue
    }
    if (!/\.md$/i.test(entry.name)) {
      continue
    }
    const before = await readFile(p, 'utf8')
    const matches = [...before.matchAll(RX)]
    if (!matches.length) {
      continue
    }
    total += matches.length
    console.log(`\n== ${entry.name} — стыков: ${matches.length}`)
    matches.slice(0, 6).forEach((m) => {
      const s = Math.max(0, m.index - 40)
      console.log(`   …${before.slice(s, m.index + 40).replace(/\n/g, ' ')}…`)
    })
    if (APPLY) {
      await writeFile(p, before.replace(RX, '\n\n$1'), 'utf8')
      console.log('   -> записано')
    }
  }
}

await walk(ROOT)
console.log(`\nВсего стыков: ${total}${APPLY ? ' (записано)' : ' (DRY-RUN: ничего не записано. Повтор с --apply)'}`)
