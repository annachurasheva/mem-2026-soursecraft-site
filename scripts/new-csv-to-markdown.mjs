/**
 * ФАЙЛ: new-csv-to-markdown.mjs
 * СТАТУС: новая реализация для ЧИСТОГО шаблона (ветка qwen3-new-clear в репо eo)
 *
 * АНОНС: что делает этот скрипт
 *  1. Читает ВСЕ файлы *.csv из папки data/csv/ (включая вложенные каталоги).
 *  2. Из КАЖДОЙ строки CSV создаёт ОДИН .md файл — карточку (страницу) в src/content/posts/.
 *     УМОЛЧАНИЕ: вывод в src/content/posts/ (при необходимости путь меняется здесь).
 *  3. Frontmatter каждой карточки:
 *     - title: ФИО из строки (колонка «Заголовок» / last_name + first_name + middle_name)
 *     - slug:  bitva-za-krym-1942-<транслит ФИО>-<document_id>
 *              (в НАЧАЛО slug добавляется bitva-za-krym-1942;
 *               цифры хвоста из адреса primary_url (id=...) уходят в КОНЕЦ slug)
 *     Согласно разобранным документам: если применён <slug>, остальные директивы
 *     на данную тему игнорируются (Astro берёт id из data.slug).
 *  4. Тело карточки (наименование поля — жирной кириллицей, содержание — простым шрифтом):
 *     - # <ФИО>                        — Главный заголовок (SEO)
 *     - **Погиб** <date_death>
 *     - **Звание** <rank>
 *     - **Воинская часть** — <warunit> — сейчас пишем КАК ЕСТЬ
 *       (КОММЕНТАРИЙ В КОДЕ: возможна такая логика — авто-замена через словарь,
 *        например "скф 398 сд 826 сп" → "Северо-Кавказский Фронт, 826-й стрелковый полк,
 *        398-я стрелковая дивизия, 44-я Армия"; словарь подключается позже)
 *     - **Дата рождения** <date_birth>            — только если есть в CSV
 *     - **Место рождения** <place_birth>          — только если есть в CSV
 *     - **Захоронен** <primary_burial>
 *     - **Современное захоронение** <current_burial>          — только если есть в CSV
 *     - **Призывной пункт** <conscription_location>           — только если есть в CSV
 *     - **Источник** <primary_url> — сейчас просто адрес
 *       (КОММЕНТАРИЙ В КОДЕ: позже кликабельная ссылка с попапом
 *        «да/нет перейти на сайт <имя сайта>» — потребуется отдельная инструкция)
 *     ПРАВИЛО: если позиции нет в CSV — строки в карточке НЕТ вообще.
 *     cause_of_death — НЕ выводится.
 *  5. Логирование (принципы из scripts/csv-to-fallen.mjs):
 *     - scripts/logs/run.log       — основной лог прогона (ход обработки, результат)
 *     - scripts/logs/refused.log   — ВТОРОЙ ЛОГ: «отказано — причина — список»
 *                                    (строки, которые не удалось обработать, с причиной)
 *     - scripts/logs/errors.json   — ошибки записи файлов
 *  6. Режим --dry-run: ничего не пишет (ни .md, ни логи), только показывает
 *     соответствие «строка CSV → файл» в консоли.
 */
import { readdir, readFile, writeFile, mkdir } from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

const DIRS = {
  // УМОЛЧАНИЕ: вывод в src/content/posts/
  csv: path.join(ROOT, 'data', 'csv'),
  output: path.join(ROOT, 'src', 'content', 'posts'),
  logs: path.join(ROOT, 'scripts', 'logs'),
};

const FILES = {
  runLog: path.join(DIRS.logs, 'run.log'),
  refusedLog: path.join(DIRS.logs, 'refused.log'),
  errorsJson: path.join(DIRS.logs, 'errors.json'),
};

// Префикс slug — добавляется в НАЧАЛО каждого slug
const SLUG_PREFIX = 'bitva-za-krym-1942';

// Транслитерация для slug (русский → латиница, нижний регистр, только a-z0-9-)
function translit(str) {
  const ru = 'А-а-Б-б-В-в-Ґ-ґ-Г-г-Д-д-Е-е-Ё-ё-Є-є-Ж-ж-З-з-И-и-І-і-Ї-ї-Й-й-К-к-Л-л-М-м-Н-н-О-о-П-п-Р-р-С-с-Т-т-У-у-Ф-ф-Х-х-Ц-ц-Ч-ч-Ш-ш-Щ-щ-Ъ-ъ-Ы-ы-Ь-ь-Э-э-Ю-ю-Я-я-.';
  const en = "A-a-B-b-V-v-G-g-G-g-D-d-E-e-E-e-E-e-ZH-zh-Z-z-I-i-I-i-I-i-J-j-K-k-L-l-M-m-N-n-O-o-P-p-R-r-S-s-T-t-U-u-F-f-H-h-TS-ts-CH-ch-SH-sh-SCH-sch-'-Y-y-'-E-e-YU-yu-YA-ya-";
  const arr = str.split('');
  for (let i = 0; i < arr.length; i++) {
    const index = ru.indexOf(arr[i]);
    if (index !== -1) {
      arr[i] = en.split('-')[index];
    }
  }
  return arr.join('').toLowerCase().replace(/[^a-z0-9\-]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');
}

// Логирование в файл (принцип из csv-to-fallen.mjs)
async function logMessage(logFile, message) {
  const timestamp = new Date().toISOString();
  const line = `[${timestamp}] ${message}\n`;
  try {
    await mkdir(path.dirname(logFile), { recursive: true });
    await writeFile(logFile, line, { flag: 'a' });
  } catch (e) {
    console.error(`Ошибка записи лога: ${e.message}`);
  }
}

// Парсинг CSV строки (с поддержкой кавычек — принцип из csv-to-fallen.mjs)
function parseCSVLine(line) {
  const result = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === ',' && !inQuotes) {
      result.push(current.trim().replace(/^\"|\"$/g, ''));
      current = '';
    } else {
      current += char;
    }
  }
  result.push(current.trim().replace(/^\"|\"$/g, ''));
  return result;
}

// Извлечение document_id: из колонки document_id, иначе цифры хвоста из primary_url (id=...)
function extractDocumentId(row) {
  const fromColumn = (row['document_id'] || '').trim();
  if (fromColumn) return fromColumn;

  const url = row['primary_url'] || '';
  const match = url.match(/id=(\d+)/);
  return match ? match[1] : '';
}

// Полное ФИО из строки (с fallback на колонку «Заголовок»)
function buildFullName(row) {
  let last = (row['last_name'] || '').trim();
  let first = (row['first_name'] || '').trim();
  let middle = (row['middle_name'] || '').trim();

  const header = (row['Заголовок'] || '').trim();
  if (!last && header) {
    const parts = header.split(/\s+/);
    last = parts[0] || '';
    first = parts[1] || '';
    middle = parts[2] || '';
  }

  return [last, first, middle].filter(Boolean).join(' ');
}

// Формирование slug: bitva-za-krym-1942-<транслит ФИО>-<document_id>
function buildSlug(fullName, documentId) {
  const namePart = translit(fullName);
  const tail = documentId ? `-${documentId}` : '';
  return `${SLUG_PREFIX}-${namePart}${tail}`;
}

// ВОЗМОЖНА ТАКАЯ ЛОГИКА (авто-замена warunit через словарь — подключается позже):
// Например: "скф 398 сд 826 сп" → "Северо-Кавказский Фронт, 826-й стрелковый полк,
// 398-я стрелковая дивизия, 44-я Армия".
// Сейчас, по решению пользователя, пишем значение КАК ЕСТЬ.
function normalizeWarUnit(warunit) {
  // TODO: словарь подмен (data/dictionaries/units_dict.json или аналог)
  return warunit;
}

// Формирование Markdown-карточки
function buildCard(row) {
  const fullName = buildFullName(row);
  const documentId = extractDocumentId(row);
  const slug = buildSlug(fullName, documentId);

  const lines = [];

  // Frontmatter
  lines.push('---');
  lines.push(`title: "${fullName}"`);
  lines.push(`slug: "${slug}"`);
  lines.push('---');
  lines.push('');

  // Главный заголовок (SEO)
  lines.push(`# ${fullName}`);
  lines.push('');

  // Поле выводится ТОЛЬКО если значение есть в CSV (нет позиции — нет строки)
  const dateDeath = (row['date_death'] || '').trim();
  if (dateDeath) {
    lines.push(`**Погиб** ${dateDeath}`);
    lines.push('');
  }

  const rank = (row['rank'] || '').trim();
  if (rank) {
    lines.push(`**Звание** ${rank}`);
    lines.push('');
  }

  const warunit = (row['warunit'] || '').trim();
  if (warunit) {
    lines.push(`**Воинская часть** — ${normalizeWarUnit(warunit)}`);
    lines.push('');
  }

  const dateBirth = (row['date_birth'] || '').trim();
  if (dateBirth) {
    lines.push(`**Дата рождения** ${dateBirth}`);
    lines.push('');
  }

  const placeBirth = (row['place_birth'] || '').trim();
  if (placeBirth) {
    lines.push(`**Место рождения** ${placeBirth}`);
    lines.push('');
  }

  const primaryBurial = (row['primary_burial'] || '').trim();
  if (primaryBurial) {
    lines.push(`**Захоронен** ${primaryBurial}`);
    lines.push('');
  }

  const currentBurial = (row['current_burial'] || '').trim();
  if (currentBurial) {
    lines.push(`**Современное захоронение** ${currentBurial}`);
    lines.push('');
  }

  const conscriptionLocation = (row['conscription_location'] || '').trim();
  if (conscriptionLocation) {
    lines.push(`**Призывной пункт** ${conscriptionLocation}`);
    lines.push('');
  }

  const primaryUrl = (row['primary_url'] || '').trim();
  if (primaryUrl) {
    // СЕЙЧАС просто адрес. ПОЗЖЕ: кликабельная ссылка с попапом «да/нет перейти на сайт»
    lines.push(`**Источник** ${primaryUrl}`);
    lines.push('');
  }

  // cause_of_death — НЕ выводится (осознанно пропущен)

  return { content: lines.join('\n').replace(/\n{3,}/g, '\n\n'), slug, documentId, fullName };
}

// Основная функция конвертации
async function convert() {
  const isDryRun = process.argv.includes('--dry-run');
  console.log(`Запуск new-csv-to-markdown.mjs ${isDryRun ? '(DRY-RUN)' : ''}...`);

  let processedCount = 0;
  let errorCount = 0;
  let refusedCount = 0;
  const errors = [];

  // Получение списка CSV файлов (включая вложенные каталоги)
  let csvFiles = [];
  try {
    const entries = await readdir(DIRS.csv, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.isFile() && entry.name.endsWith('.csv')) {
        csvFiles.push(path.join(DIRS.csv, entry.name));
      } else if (entry.isDirectory()) {
        const subEntries = await readdir(path.join(DIRS.csv, entry.name));
        for (const subEntry of subEntries) {
          if (subEntry.endsWith('.csv')) {
            csvFiles.push(path.join(DIRS.csv, entry.name, subEntry));
          }
        }
      }
    }
  } catch (e) {
    console.error(`Ошибка чтения папки CSV: ${e.message}`);
    return;
  }

  console.log(`Найдено CSV файлов: ${csvFiles.length}`);
  if (!isDryRun) {
    await logMessage(FILES.runLog, `Start: found ${csvFiles.length} CSV files`);
  }

  for (const csvFile of csvFiles) {
    console.log(`Обработка файла: ${csvFile}`);

    let content;
    try {
      content = await readFile(csvFile, 'utf-8');
    } catch (e) {
      console.error(`Ошибка чтения ${csvFile}: ${e.message}`);
      continue;
    }

    const lines = content.split('\n').filter(line => line.trim() && !line.startsWith('<!--'));
    if (lines.length < 2) continue;

    const headers = parseCSVLine(lines[0]);

    for (let i = 1; i < lines.length; i++) {
      const values = parseCSVLine(lines[i]);
      const row = {};
      headers.forEach((header, idx) => {
        row[header.trim()] = values[idx] !== undefined ? values[idx] : '';
      });

      const fullName = buildFullName(row);
      const documentId = extractDocumentId(row);

      // Проверки на «отказ»: причина + список (второй лог)
      let refuseReason = '';
      if (!fullName) {
        refuseReason = 'нет ФИО (пустые last_name/first_name/middle_name и Заголовок)';
      } else if (!documentId) {
        refuseReason = 'нет document_id и нет id= в primary_url (нельзя сформировать уникальный slug)';
      }

      if (refuseReason) {
        refusedCount++;
        const rawPreview = lines[i].slice(0, 200);
        if (isDryRun) {
          console.log(`[REFUSED] строка ${i + 1}: причина: ${refuseReason} | список: ${rawPreview}`);
        } else {
          await logMessage(FILES.refusedLog, `ОТКАЗАНО | причина: ${refuseReason} | список: ${rawPreview}`);
        }
        continue;
      }

      const { content: cardContent, slug, documentId: docId } = buildCard(row);
      const outputFile = path.join(DIRS.output, `${docId}.md`);

      if (isDryRun) {
        console.log(`CSV строка ${i + 1} → ${outputFile} (slug: ${slug})`);
        processedCount++;
        continue;
      }

      try {
        await mkdir(DIRS.output, { recursive: true });
        await writeFile(outputFile, cardContent, 'utf-8');
        processedCount++;
        await logMessage(FILES.runLog, `OK: ${outputFile} (slug: ${slug})`);
        console.log(`[OK] Создана карточка: ${outputFile}`);
      } catch (e) {
        errorCount++;
        errors.push({ file: outputFile, error: e.message });
        console.error(`[ERROR] ${outputFile}: ${e.message}`);
      }
    }
  }

  // Сохранение ошибок
  if (errors.length > 0 && !isDryRun) {
    try {
      await writeFile(FILES.errorsJson, JSON.stringify(errors, null, 2), 'utf-8');
    } catch (e) {
      console.error(`Ошибка записи errors.json: ${e.message}`);
    }
  }

  console.log(`\n=== Отчёт ===`);
  console.log(`Обработано карточек: ${processedCount}`);
  console.log(`Отказано: ${refusedCount}`);
  console.log(`Ошибок: ${errorCount}`);

  if (!isDryRun) {
    await logMessage(FILES.runLog, `Completed: ${processedCount} processed, ${refusedCount} refused, ${errorCount} errors`);
  }
}

convert().catch(console.error);