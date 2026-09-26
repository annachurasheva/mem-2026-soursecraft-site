# Авторы — добавление схемы (реестр авторов, JSON-LD, скрипт new-author-post)

> **Статус:** реализация выполнена (черновик — финальная коррекция за владельцем).
> **Ветка:** проектирование ведётся в ветке `main-qwen3`.

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

> ⚠️ **Ключевое отличие от задач #2–#4:** тексты задач предполагали старый API (`src/content/config.ts`, `type: 'data'`). В шаблоне — **новый API** (`src/content.config.ts`, `loader`). Реализация выполнена строго по фактическому коду шаблона.

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

| # | Файл | Назначение | Статус |
|---|------|------------|--------|
| 1 | `src/data/authors.yaml` | Реестр авторов, организаций, источников (YAML) | ✅ создан |
| 2 | `src/utils/author.ts` | Хелперы: `resolveAuthors`, `authorsToJsonLd` (мягкий резолв) | ✅ создан |
| 3 | `src/components/PostAuthor.astro` | Визуальная карточка автора(ов) под датой поста | ✅ создан |
| 4 | `scripts/new-author-post.ts` | Скрипт создания поста с полем `authorIds` (на базе `new-post.ts`) | ✅ создан |

### Изменяемые файлы

| # | Файл | Что меняется | Статус |
|---|------|--------------|--------|
| 5 | `src/content.config.ts` | Добавлена коллекция `authors` (YAML + Zod), в схему `posts` добавлено опциональное поле `authorIds` | ✅ изменён |
| 6 | `src/pages/[...lang]/posts/[slug].astro` | Импорт `PostAuthor` + `resolveAuthors`/`buildAuthorsJsonLdBlock`; резолв авторов; передача props в `Layout`; рендер карточки; передача текста для Яндекс.Метрики | ✅ изменён |
| 7 | `src/layouts/Layout.astro` | Новые props: `postAuthors`, `authorsJsonLd`, `postDateISO`, `postContentPreview`; проброс в `Head` | ✅ изменён |
| 8 | `src/layouts/Head.astro` | Блок JSON-LD `Article` (с `@id`, `text`, `author`/`sourceOrganization`, publisher) | ✅ изменён |
| 9 | `package.json` | Новый скрипт `new-author-post` | ✅ изменён |

## 6. Детали реализации

### 6.1. `src/data/authors.yaml` — ✅ создан

Структура записи объединяет внутренние поля (из задач) и Schema.org-поля (для организаций — по задаче #4).

Типы (`type`): `персона`, `библиотека`, `сообщество`, `организация`, `редакция`, `источник`.

**Наполнение — «Созданы и примеры и подлинные авторы»:**

✅ **Подлинные записи** (по данным владельца):
- `redaktsiya` — Редакция (интернет-издание Bospor.com.ua), тип `редакция`, link http://www.bospor.com.ua
- `nevzorov-b-i` — Невзоров Борис Ильич, тип `персона` (кандидат исторических наук, доцент, Почетный профессор Европейского Университета, полковник в отставке, г.р. 1926)
- `ak-monay` — Поисковый отряд «Ак-Монай» (Феодосия), тип `сообщество`, link https://vk.ru/akmonai
- `sinderovich-kirill` — Синдерович Кирилл, тип `персона` (руководитель отряда), link https://vk.ru/id32202743
- `neb` — Национальная электронная библиотека (НЭБ), тип `библиотека` (документ «Московская битва 1941–1942», Невзоров Б.И., 2006, Москва)
- `naumenko-v-g` — Науменко Валентина Георгиевна, тип `персона` (историк, профессор; книга «Просто фронт…», «Прометей», 2006)
- `kodeks` — Информационная компания «Кодекс», тип `организация` (АО, Санкт-Петербург, spp@kodeks.ru)
- `tkachenko-s-n` — Ткаченко С.Н., тип `персона` (крымский военный историк; монография «Хроника и военно-исторические очерки», Симферополь, 2018)
- `kosova-a-m` — Косова Анна Михайловна, тип `персона` (координатор проекта «Крымский виртуальный некрополь», Севастополь)

✅ **Примеры-шаблоны** (по одному на секцию, помечены в `note` как «ПРИМЕР-ШАБЛОН»):
- `hu-shi` — персона (образец персоны)
- `rsl` — библиотека (Российская государственная библиотека; Library, founding_date)
- `nii-istorii-sssr` — организация (расформированный НИИ; ResearchOrganization, dissolution_date, status historical)
- `xxx-2008` — источник (интернет-издание «по материалам»)

### 6.2. `src/content.config.ts` — ✅ изменён

Адаптация под **новый API** Astro Content Layer. Существующие коллекции `posts` и `about` не удалены и не изменены по смыслу — только дополнена схема `posts` полем `authorIds` (опциональным).

Добавлено:

```ts
// Author registry schema (single YAML file with a list of entries)
const authorSchema = z.object({ ... })

const authors = defineCollection({
  loader: glob({ pattern: '**/*.yaml', base: './src/data' }),
  schema: z.array(authorSchema),
})

export const collections = { posts, about, authors }
```

В схему `posts` добавлено:

```ts
// Authors (soft resolve: optional, empty array = no author)
authorIds: z.array(z.string()).optional(),
```

> Мягкое поведение (по задаче #3): поле опционально; пустой массив = «без автора»; не указано = статья публикуется без автора (без дефолта).

### 6.3. `src/utils/author.ts` — ✅ создан

- `resolveAuthors(authorIds?)` — мягкий резолв: отсутствующий `id` → `console.warn`, пропуск; пустой/undefined → `[]`.
- `authorsToJsonLd(authors)` — генерация JSON-LD: `@type` = `schema_type` ?? (Person | Organization); персоны → `jobTitle`, `hasCredential`, `affiliation`; организации → `legalName`, `alternateName`, `foundingDate`, `dissolutionDate` (+`status: 'historical'`), `location`, `parentOrganization`, `successor`/`predecessor`.
- `buildAuthorsJsonLdBlock(authors)` — разделяет на `author` (персоны) и `sourceOrganization` (организации).

### 6.4. `src/components/PostAuthor.astro` — ✅ создан

Карточка автора(ов): аватар (если `image`), имя, credentials, тип; ссылка — если `link` (внешние ссылки открываются в новой вкладке). Рендерится только при `authors.length > 0`. Оформление — UnoCSS-классами в стилистике шаблона.

### 6.5. `src/pages/[...lang]/posts/[slug].astro` — ✅ изменён

- Резолв: `const authors = await resolveAuthors(post.data.authorIds)`
- JSON-LD: `const authorsJsonLdBlock = buildAuthorsJsonLdBlock(authors)`
- Дата ISO: `const postDateISO = post.data.published.toISOString()`
- Текст для Яндекса: `postContentPreview` (первые ~1000 символов, минимум 500)
- Рендер: `{authors.length > 0 && <PostAuthor authors={authors} />}` после блока даты
- Новые props в `Layout`: `postAuthors`, `authorsJsonLd`, `postDateISO`, `postContentPreview`

### 6.6. `src/layouts/Layout.astro` — ✅ изменён

Добавлены props `postAuthors = []`, `authorsJsonLd = {}`, `postDateISO`, `postContentPreview` и проброс в `<Head>`. Импортирован тип `CollectionEntry<'authors'>` из `astro:content`.

### 6.7. `src/layouts/Head.astro` — ✅ изменён (JSON-LD с требованиями Яндекса)

Блок вставлен после Open Graph. Ключевые требования (по задаче #4, раздел «Яндекс»):

| Требование | Реализация |
|---|---|
| `@id` | `Astro.url.href` (обязателен для Яндекс.Метрики) |
| `headline` | `postTitle` |
| `text` | `postContentPreview`, включается только при длине ≥ 500 символов |
| `datePublished` | `postDateISO` (ISO 8601) |
| `author` | персоны (`authorsJsonLd.author`), только если не пусто |
| `sourceOrganization` | организации (`authorsJsonLd.sourceOrganization`), только если не пусто |
| `publisher` | `siteTitle` + logo |
| `mainEntityOfPage` | `Astro.url.href` |

## 7. Скрипт `new-author-post.ts` и `package.json` — ✅ выполнено

- Создан `scripts/new-author-post.ts` на базе `new-post.ts` с поддержкой `--authors="id1,id2"`.
- Использование: `pnpm new-author-post <title> [--authors="id1,id2"]`.
- При отсутствии `--authors` поле `authorIds` не добавля��тся (статья без автора).
- В `package.json` добавлен скрипт: `"new-author-post": "tsx scripts/new-author-post.ts"`.
- Остальные скрипты и зависимости не менялись.

## 8. Чек-лист внедрения

| # | Действие | Файл | Тип | Статус |
|---|----------|------|-----|--------|
| 1 | Создать реестр авторов (примеры + подлинные) | `src/data/authors.yaml` | Новый | ✅ |
| 2 | Создать хелперы (мягкий резолв) | `src/utils/author.ts` | Новый | ✅ |
| 3 | Создать карточку автора | `src/components/PostAuthor.astro` | Новый | ✅ |
| 4 | Добавить коллекцию `authors` + поле `authorIds` | `src/content.config.ts` | Изменить | ✅ |
| 5 | Резолв авторов + рендер карточки + текст для Яндекса | `src/pages/[...lang]/posts/[slug].astro` | Изменить | ✅ |
| 6 | Проброс новых props | `src/layouts/Layout.astro` | Изменить | ✅ |
| 7 | JSON-LD `Article` (Google + Яндекс) | `src/layouts/Head.astro` | Изменить | ✅ |
| 8 | Скрипт создания поста с авторами | `scripts/new-author-post.ts` | Новый | ✅ |
| 9 | Регистрация скрипта | `package.json` | Изменить | ✅ |
| 10 | Проверка: `pnpm build` / `astro check` не ломают существующие страницы | — | Валидация | ⏳ за владельцем |

## 9. Риски и правила безопасности

1. **Не разрушать шаблон**: никаких изменений существующих постов, стилей, конфигурации темы (`src/config.ts`), публичных страниц вне точек интеграции. ✅ соблюдено.
2. **Новый API Astro**: реализация выполнена через `loader`/Content Layer; устаревший синтаксис из задач не переносился. ✅
3. **Мягкий резолв**: сборка не падает из-за отсутствующих id авторов. ✅
4. **YAML-гигиена**: даты и строки со спецсимволами в кавычках (валидный YAML 1.2). ✅
5. **Обратная совместимость**: старые посты без `authorIds` продолжают работать (поле опционально). ✅

> ⚠️ **Требует проверки сборкой (`pnpm build` / `astro check`):**
> - коллекция `authors` через `glob` + `z.array(authorSchema)` — нужно убедиться, что Astro корректно читает YAML-массив как единую запись и валидирует элементы;
> - типы `CollectionEntry<'authors'>` в `Layout.astro` и `[slug].astro`;
> - поведение `astro check` с новым кодом.

## 10. Статусы и следующие шаги

- [x] Согласован и заполнен список авторов для `authors.yaml` (подлинные + примеры)
- [x] Выполнены пункты 1–9 чек-листа
- [ ] Проверить сборку (`pnpm build` / `astro check`) — за владельцем (запуск команд вне моих полномочий)
- [x] Раздел «Созданы и примеры и подлинные авторы» отчёта заполнен по факту
- [ ] Финальная коррекция (при необходимости) и коммит в `main-qwen3` — за владельцем