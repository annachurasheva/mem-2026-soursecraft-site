/**
 * ФАЙЛ: new-csv-to-markdown__v3.mjs (ВЕРСИЯ 3)
 * СТАТУС: новая реализация для ЧИСТОГО шаблона Retypeset (Astro, модифицированная сборка)
 *
 * ОТЛИЧИЯ ОТ ВЕРСИИ 2 (new-csv-to-markdown-v2.mjs):
 *  1. Захоронения — новый порядок и подписи:
 *     - **Первичное место захоронения (по данным портала obd-memorial)** ← primary_burial
 *     - **Захоронен**                                                ← current_burial (фактическое)
 *     - **Страна и регион захоронения** Россия, Крым                ← ЖЁСТКО (проект узкий)
 *     - **Откуда перезахоронен**                                     ← rebural_from
 *     ПРАВИЛО: строка появляется ТОЛЬКО если значение есть в CSV (нет позиции — нет строки).
 *  2. normalizeWarUnit() — заглушка с комментарием «ТУТ ВСТАВЬТЕ ЭТО»:
 *     расшифровка шифрограмм войсковых частей («398 сд 821 сп» →
 *     «821-й стрелковый полк, 398-я стрелковая дивизия, 44-я Армия,
 *     Северо-Кавказский Фронт. Краткий обзор боевого пути.»).
 *  3. Теги (Frontmatter) — поле tags (YAML-список, как у автора шаблона):
 *     заполняется из warunit / primary_burial / current_burial.
 *     Комментарий «ТУТ ЗАПОЛНИТЕ ТЕГИ».
 *     Теги нужны для секции АСТРО-сборки: нажатие создаёт представление всех
 *     карточек «сослуживцы»; для этой секции настраивается отдельная RSS-лента
 *     (в Дзен отправляется принудительно, а не всё подряд).
 *  4. published — обязательное поле схемы (z.date()); берётся из колонки «Дата»
 *     CSV, иначе — текущая дата (ISO YYYY-MM-DD). Без него RSS pubDate невалиден.
 *
 * АНОНС: что делает этот скрипт
 *  1. Читает ВСЕ файлы *.csv из папки data/csv/ (включая вложенные каталоги).
 *  2. Из КАЖДОЙ строки CSV создаёт ОДИН .md файл — карточку (страницу) в src/content/posts/.
 *  3. Frontmatter каждой карточки:
 *     - title:     ФИО из строки (колонка «Заголовок» / last_name + first_name + middle_name)
 *     - slug:      bitva-za-krym-1942-<document_id>
 *     - published: дата из CSV (колонка «Дата») или текущая дата
 *     - tags:      YAML-список тегов (warunit, primary_burial, current_burial)
 *  4. Тело карточки (наименование поля — жирной кириллицей, содержание — простым шрифтом):
 *     - # <ФИО>                        — Главный заголовок (SEO)
 *     - **Погиб** <date_death>
 *     - **Звание** <rank>
 *     - **Воинская часть** — <warunit> — через normalizeWarUnit() (заглушка)
 *     - **Дата рождения** <date_birth>            — только если есть в CSV
 *     - **Место рождения** <place_birth>          — только если есть в CSV
 *     - **Первичное место захоронения (по данным портала obd-memorial)** <primary_burial>
 *     - **Захоронен** <current_burial>
 *     - **Страна и регион захоронения** Россия, Крым
 *     - **Откуда перезахоронен** <rebural_from>
 *     - **Призывной пункт** <conscription_location>           — только если есть в CSV
 *     - **Источник** <primary_url>
 *     ПРАВИЛО: если позиции нет в CSV — строки в карточке НЕТ вообще.
 *     cause_of_death — НЕ выводится (осознанно пропущен).
 *  5. Логирование (принципы из scripts/csv-to-fallen.mjs):
 *     - scripts/logs/run.log       — основной лог прогона
 *     - scripts/logs/refused.log   — ВТОРОЙ ЛОГ: «отказано — причина — список»
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

// ══════════════════════════════════════════════════════════════════
// ТУТ ВСТАВЬТЕ ЭТО — расшифровка шифрограмм войсковых частей
// Пример: "398 сд 821 сп" →
//   "821-й стрелковый полк, 398-я стрелковая дивизия,
//    44-я Армия, Северо-Кавказский Фронт. Краткий обзор боевого пути."
// Механизм: словарь data/dictionaries/units_dict.json (или аналог).
// Пока возвращаем значение КАК ЕСТЬ.
// ══════════════════════════════════════════════════════════════════
function normalizeWarUnit(warunit) {
  // ТУТ ВСТАВЬТЕ ЭТО: подключить словарь подмен units_dict.json
  // и формировать полное наименование + краткий боевой путь.
  return warunit;
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
      result.push(current.trim().replace(/^"|"$/g, ''));
      current = '';
    } else {
      current += char;
    }
  }
  result.push(current.trim().replace(/^"|"$/g, ''));
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

// Формирование slug: bitva-za-krym-1942-<document_id>
// <slug> во frontmatter имеет ПРИОРИТЕТ №1: Astro generateIdDefault()
// сначала проверяет data.slug и возвращает его как post.id.
function buildSlug(documentId) {
  return `${SLUG_PREFIX}-${documentId}`;
}

// Дата публикации (published): из колонки «Дата» CSV (YYYY-MM-DD),
// иначе — текущая дата (ISO YYYY-MM-DD). Поле обязательно в схеме z.date().
function getPublishedDate(row) {
  const fromCsv = (row['Дата'] || '').trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(fromCsv)) return fromCsv;
  return new Date().toISOString().split('T')[0];
}

// Формирование Markdown-карточки
function buildCard(row) {
  const fullName = buildFullName(row);
  const documentId = extractDocumentId(row);
  const slug = buildSlug(documentId);
  const published = getPublishedDate(row);

  const lines = [];

  // Frontmatter
  lines.push('---');
  lines.push(`title: "${fullName}"`);
  lines.push(`slug: "${slug}"`);
  lines.push(`published: ${published}`);

  // ══════════════════════════════════════════════════════════════════
  // ТУТ ЗАПОЛНИТЕ ТЕГИ — для секции АСТРО-сборки «сослуживцы» и
  // отдельной RSS-ленты в Дзен (категории постов).
  // Источник требований: DZEN_RSS.md §3.5 + регламент автора шаблона.
  // Формат — YAML-список (как в примерах шаблона):
  //   tags:
  //     - Ху Ши
  //     - Современная литература
  // Сейчас подставляем сырые значения из CSV; после подключения словаря
  // теги будут строиться от нормализованных наименований.
  // ══════════════════════════════════════════════════════════════════
  const warunitTag = (row['warunit'] || '').trim();
  const primaryBurialTag = (row['primary_burial'] || '').trim();
  const currentBurialTag = (row['current_burial'] || '').trim();

  const tags = [];
  // ТУТ ЗАПОЛНИТЕ ТЕГИ: warunit, primary_burial, current_burial
  if (warunitTag) tags.push(warunitTag);
  if (primaryBurialTag) tags.push(primaryBurialTag);
  if (currentBurialTag) tags.push(currentBurialTag);

  if (tags.length > 0) {
    lines.push('tags:');
    for (const tag of tags) {
      // Экранируем кавычки, если попадут в тег
      lines.push(`  - "${tag.replace(/"/g, '\\"')}"`);
    }
  }

  lines.push('---');
  lines.push('');

  // Главный заголовок (SEO) — ФИО, единственный H1 на странице
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

  // ---------- Захоронения ----------
  // Первичное место захоронения — по данным портала obd-memorial
  const primaryBurial = (row['primary_burial'] || '').trim();
  if (primaryBurial) {
    lines.push(`**Первичное место захоронения (по данным портала obd-memorial)** ${primaryBurial}`);
    lines.push('');
  }

  // Фактическое место захоронения (если пусто — не выводим)
  const currentBurial = (row['current_burial'] || '').trim();
  if (currentBurial) {
    lines.push(`**Захоронен** ${currentBurial}`);
    lines.push('');
  }

  // Страна и регион захоронения — ЖЁСТКО «Россия, Крым» (проект узкий).
  // Строка появляется только если в CSV есть хоть одно поле захоронения.
  const country = (row['country_burial'] || '').trim();
  const region = (row['region_burial'] || '').trim();
  if (country || region || primaryBurial || currentBurial) {
    lines.push(`**Страна и регион захоронения** Россия, Крым`);
    lines.push('');
  }

  // Откуда перезахоронен
  const reburalFrom = (row['rebural_from'] || '').trim();
  if (reburalFrom) {
    lines.push(`**Откуда перезахоронен** ${reburalFrom}`);
    lines.push('');
  }

  const conscriptionLocation = (row['conscription_location'] || '').trim();
  if (conscriptionLocation) {
    lines.push(`**Призывной пункт** ${conscriptionLocation}`);
    lines.push('');
  }

  const primaryUrl = (row['primary_url'] || '').trim();
  if (primaryUrl) {
    lines.push(`**Источник** ${primaryUrl}`);
    lines.push('');
  }

  // cause_of_death — НЕ выводится (осознанно пропущен)

  return { content: lines.join('\n').replace(/\n{3,}/g, '\n\n'), slug, documentId, fullName };
}

// Основная функция конвертации
async function convert() {
  const isDryRun = process.argv.includes('--dry-run');
  console.log(`Запуск new-csv-to-markdown__v3.mjs ${isDryRun ? '(DRY-RUN)' : ''}...`);

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
      // Имя файла НЕ влияет на URL: <slug> во frontmatter имеет приоритет №1 (Astro).
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