# Авторы — добавление схемы (реестр авторов, JSON-LD, скрипт new-author-post)

> **Статус:** черновик архитектурного отчёта. Работаем по этому документу.
> **Ветка:** первый коммит переводит проектирование на ветку `main-qwen3` (коммит выполняет владелец репозитория).

---

## 1. Цель

Реализовать в шаблоне **astro-theme-retypeset** реестр авторов (`authors.yaml`) с подключением через Astro Content Collections, выводом карточки автора на странице поста и генерацией Schema.org JSON-LD (`Article`) с учётом требований **Яндекса** (Метрика, Вебмастер). Дополнительно — скрипт `new-author-post.ts` для создания поста с указанием авторов и регистрация его в `package.json`.

## 2. Контекст и жёсткие ограничения

- Мы работаем в **коммерческом шаблоне Tencent Cloud** (`astro-theme-retypeset`, автор radishzzz, репозиторий https://github.com/radishzzz/astro-theme-retypeset).
- **Главное правило: не разрушать шаблон.** Все изменения — минимально инвазивные, аддитивные, без изменения стиля, структуры и поведения существующих страниц, кроме явно указанных точек интеграции.
- Существующие коллекции `posts` и `about` **не ломаются**: новая коллекция `authors` добавляется отдельно.
- Существующие посты (`src/content/posts/examples`, `guides`) **не изменяются** (по решению владельца — пункт 5 «НЕТ»).

## 3. Фактическое состояние шаблона (по результатам осмотра)

| Пункт | Факт |
|---|---|
| Коллекции | `src/content.config.ts` — **новый API Astro Content Layer**: `loader: glob(...)`, коллекции `posts` и `about`. Старого `type: 'content' / 'data'` в шаблоне нет |
| Схема постов | `title`, `published` (`z.date()`), `description`, `updated`, `tags`, `draft`, `pin`, `toc`, `lang`, `abbrlink`. Поля `authorIds` **нет** |
| Страница поста | `src/pages/[...lang]/posts/[slug].astro` — рендер `post`, `PostDate`, `TOC`, `TagList`, `Comment` |
| Layout | `src/layouts/Layout.astro` — props: `postTitle`, `postDescription`, `postSlug`, `supportedLangs`; проброс в `<Head>` |
| Head | `src/layouts/Head.astro` — метаданные, Open Graph, верификации, аналитика. Блока JSON-LD **нет** |
| Каталог данных | `src/data` **отсутствует** — будет создан |
| Утилиты | `src/utils/` — `cache.ts`, `content.ts`, `description.ts`, `feed.ts`, `page.ts` |
| Скрипты | `scripts/new-post.ts` (без поля автора), `apply-lqip.ts`, `format-posts.ts`, `update-theme.ts` |
| package.json | скрипты `dev`, `build`, `preview`, `astro`, `lint`, `lint:fix`, `new-post`, `apply-lqip`, `format-posts`, `update-theme` |

> ⚠️ **Ключевое отличие от задач #2–#4:** тексты задач предполагали старый API (`src/content/config.ts`, `type: 'data'`). В шаблоне — **новый API** (`src/content.config.ts`, `loader`). Реализация выполняется строго по фактическому коду шаблона.

## 4. Архитектура (три слоя)

```
┌─────────────────────────────────────────────────────────────────────┐
│                    ПРЕДСТАВЛЕНИЕ (View Layer)                        │
│  [slug].astro → PostAuthor.astro (карточка)                          │
│  Head.astro → JSON-LD Article (для Google + Яндекс)                  │
└──────────────────────────┬──────────────────────────────────────────┘
                           │ resolveAuthors() / authorsToJsonLd()
┌──────────────────────────▼──────────────────────────────────────────┐
│                      ДОСТУП (Access Layer)                           │
│  src/content.config.ts → коллекция authors (Zod-схема)               │
│  src/utils/author.ts → хелперы: resolveAuthors, authorsToJsonLd      │
└──────────────────────────┬──────────────────────────────────────────┘
                           │ glob loader (YAML)
┌──────────────────────────▼──────────────────────────────────────────┐
│                        ДАННЫЕ (Data Layer)                           │
│  src/data/authors.yaml → реестр авторов и организаций                │
│  src/content/posts/*.md → frontmatter с authorIds                    │
└─────────────────────────────────────────────────────────────────────┘
```

Принципы:

1. **Единый источник правды.** Все авторы/организации/источники — в одном `authors.yaml`.
2. **Мягкий резолв** (по задаче #3). Отсутствующий `id` не роняет сборку: выдаётся предупреждение в консоли, автор пропускается. Статьи «по материалам интернет-издания», анонимные документы и переводы публикуются без автора.
3. **Не дублировать логику.** `authors.yaml` используется и для визуальной карточки, и для JSON-LD, и (в перспективе) для RSS/футера.

## 5. Карта файлов

### Новые файлы

| # | Файл | Назначение |
|---|------|------------|
| 1 | `src/data/authors.yaml` | Реестр авторов, организаций, источников (YAML) |
| 2 | `src/utils/author.ts` | Хелперы: `resolveAuthors`, `authorsToJsonLd` (мягкий резолв) |
| 3 | `src/components/PostAuthor.astro` | Визуальная карточка автора(ов) под датой поста |
| 4 | `scripts/new-author-post.ts` | Скрипт создания поста с полем `authorIds` (на базе `new-post.ts`) |

### Изменяемые файлы

| # | Файл | Что меняется |
|---|------|--------------|
| 5 | `src/content.config.ts` | Добавляется коллекция `authors` (YAML + Zod), в схему `posts` добавляется опциональное поле `authorIds` |
| 6 | `src/pages/[...lang]/posts/[slug].astro` | Импорт `PostAuthor` + `resolveAuthors`/`authorsToJsonLd`; резолв авторов; передача props в `Layout`; рендер карточки; передача текста для Яндекс.Метрики |
| 7 | `src/layouts/Layout.astro` | Новые props: `postAuthors`, `authorsJsonLd`, `postDateISO`, `postContentPreview`; проброс в `Head` |
| 8 | `src/layouts/Head.astro` | Блок JSON-LD `Article` (с `@id`, `text`, `sourceOrganization`, publisher) |
| 9 | `package.json` | Новый скрипт `new-author-post` |

## 6. Детали реализации

### 6.1. `src/data/authors.yaml`

Структура записи объединяет внутренние поля (из задач) и Schema.org-поля (для организаций — по задаче #4):

```yaml
- id: redaktsiya
  name: Редакция сайта
  type: редакция
  credentials: ''
  access: ''
  license_note: ''
  link: /about/
  note: материалы без внешнего автора
  url: ''
  sameAs: []
  image: ''
  jobTitle: ''
  affiliation: ''
  schema_type: Organization
  legal_name: ''
  alternate_name: []
  founding_date: ''
  dissolution_date: ''
  successor: ''
  predecessor: []
  parent_organization: ''
  location: ''
```

Типы (`type`): `персона`, `библиотека`, `сообщество`, `организация`, `редакция`, `источник`.

**Наполнение:** по решению владельца — **«Созданы и примеры и подлинные авторы»**:
- подлинные (реальные) записи из материалов владельца;
- по одному шаблону-примеру из каждой секции (типа), чтобы зафиксировать образец заполнения.

> ⚠️ Точный список подлинных авторов согласуется с владельцем на этапе заполнения.

### 6.2. `src/content.config.ts` — добавление коллекции `authors`

Адаптация под **новый API** Astro Content Layer. Существующие коллекции `posts` и `about` не удаляются и не меняются по смыслу — только дополняется схема `posts` полем `authorIds` (опциональным).

Примерный вид добавляемого блока (уточняется на этапе реализации):

```ts
const authors = defineCollection({
  loader: glob({ pattern: '**/*.yaml', base: './src/data' }),
  schema: z.object({
    id: z.string(),
    name: z.string(),
    type: z.enum(['персона', 'библиотека', 'сообщество', 'организация', 'редакция', 'источник']),
    // внутренние поля
    credentials: z.string().optional(),
    access: z.string().optional(),
    license_note: z.string().optional(),
    link: z.string().optional(),
    note: z.string().optional(),
    // Schema.org общие
    url: z.string().url().optional().or(z.literal('')),
    sameAs: z.array(z.string()).optional(),
    image: z.string().optional(),
    // Schema.org для персон
    jobTitle: z.string().optional(),
    affiliation: z.string().optional(),
    // Schema.org для организаций
    schema_type: z.string().optional(),
    legal_name: z.string().optional(),
    alternate_name: z.array(z.string()).optional(),
    founding_date: z.string().optional(),
    dissolution_date: z.string().optional(),
    successor: z.string().optional(),
    predecessor: z.array(z.string()).optional(),
    parent_organization: z.string().optional(),
    location: z.string().optional(),
  }),
})
```

В схему `posts` добавляется:

```ts
authorIds: z.array(z.string()).optional(),
```

> Мягкое поведение (по задаче #3): поле опционально; пустой массив = «без автора»; не указано = статья публикуется без автора (без дефолта).

### 6.3. `src/utils/author.ts` — мягкий резолв

```ts
export async function resolveAuthors(authorIds?: string[]): Promise<Author[]> {
  if (!authorIds || authorIds.length === 0) return []
  const all = await getCollection('authors')
  const map = new Map(all.map(a => [a.id, a]))
  const resolved: Author[] = []
  for (const id of authorIds) {
    const author = map.get(id)
    if (author) resolved.push(author)
    else console.warn(`[authors] ⚠️ id "${id}" не найден в реестре. Пропущен.`)
  }
  return resolved
}

export function authorsToJsonLd(authors: Author[]): object[] {
  // @type: schema_type ?? (Person | Organization)
  // персоны: jobTitle, hasCredential, affiliation
  // организации: legalName, alternateName, foundingDate, dissolutionDate (+status: 'historical'),
  //             location, successor, predecessor, parentOrganization
}
```

### 6.4. `src/components/PostAuthor.astro`

Карточка автора(ов) с аватаром (если есть `image`), именем, credentials, типом; ссылка — если есть `link`. Рендерится только при `authors.length > 0`.

### 6.5. `src/pages/[...lang]/posts/[slug].astro`

- Резолв: `const authors = await resolveAuthors(post.data.authorIds)`
- JSON-LD: `const authorsJsonLd = authorsToJsonLd(authors)`
- Дата ISO: `const postDateISO = post.data.published.toISOString()`
- Текст для Яндекса: `const postContentPreview = ...` (первые ~1000 символов, минимум 500)
- Рендер: `{authors.length > 0 && <PostAuthor authors={authors} />}` после блока даты
- Новые props в `Layout`: `postAuthors`, `authorsJsonLd`, `postDateISO`, `postContentPreview`

### 6.6. `src/layouts/Layout.astro`

Добавляются props `postAuthors = []`, `authorsJsonLd = []`, `postDateISO`, `postContentPreview` и проброс в `<Head>` (тип `CollectionEntry<'authors'>` импортируется).

### 6.7. `src/layouts/Head.astro` — JSON-LD с требованиями Яндекса

Блок вставляется после Open Graph. Ключевые требования (по задаче #4, раздел «Яндекс»):

| Требование | Реализация |
|---|---|
| `@id` | `Astro.url.href` (обязателен для Яндекс.Метрики) |
| `headline` | `postTitle` |
| `text` | `postContentPreview` (≥500 символов) |
| `datePublished` | `postDateISO` (ISO 8601) |
| `author` | только если `authorsJsonLd.length > 0` |
| `sourceOrganization` | организации-источники (`@type !== 'Person'`) |
| `publisher` | `siteTitle` + logo |
| `mainEntityOfPage` | `Astro.url.href` |

## 7. Скрипт `new-author-post.ts` и `package.json`

- Копия логики `scripts/new-post.ts` с добавлением поля `authorIds` во frontmatter.
- Параметры: `pnpm new-author-post <title> --authors="id1,id2"` (или интерактивный ввод).
- При отсутствии `--authors` поле `authorIds` не добавляется (статья без автора).
- В `package.json` добавляется скрипт: `"new-author-post": "tsx scripts/new-author-post.ts"`.
- Остальные скрипты и зависимости не меняются.

## 8. Чек-лист внедрения

| # | Действие | Файл | Тип |
|---|----------|------|-----|
| 1 | Создать реестр авторов (примеры + подлинные) | `src/data/authors.yaml` | Новый |
| 2 | Создать хелперы (мягкий резолв) | `src/utils/author.ts` | Новый |
| 3 | Создать карточку автора | `src/components/PostAuthor.astro` | Новый |
| 4 | Добавить коллекцию `authors` + поле `authorIds` | `src/content.config.ts` | Изменить |
| 5 | Резолв авторов + рендер карточки + текст для Яндекса | `src/pages/[...lang]/posts/[slug].astro` | Изменить |
| 6 | Проброс новых props | `src/layouts/Layout.astro` | Изменить |
| 7 | JSON-LD `Article` (Google + Яндекс) | `src/layouts/Head.astro` | Изменить |
| 8 | Скрипт создания поста с авторами | `scripts/new-author-post.ts` | Новый |
| 9 | Регистрация скрипта | `package.json` | Изменить |
| 10 | Проверка: `pnpm build` / `astro check` не ломают существующие страницы | — | Валидация |

## 9. Риски и правила безопасности

1. **Не разрушать шаблон**: никаких изменений существующих постов, стилей, конфигурации темы (`src/config.ts`), публичных страниц вне точек интеграции.
2. **Новый API Astro**: реализация только через `loader`/Content Layer; не переносить устаревший синтаксис из задач.
3. **Мягкий резолв**: сборка не падает из-за отсутствующих id авторов.
4. **YAML-гигиена**: даты и заголовки в кавычках (валидный YAML 1.2).
5. **Обратная совместимость**: старые посты без `authorIds` продолжают работать (поле опционально).

## 10. Статусы и следующие шаги

- [ ] Согласовать список подлинных авторов для `authors.yaml`
- [ ] Выполнить пункты 1–9 чек-листа
- [ ] Проверить сборку
- [ ] Заполнить раздел «Созданы и примеры и подлинные авторы» отчёта по факту