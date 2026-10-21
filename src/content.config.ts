import { glob } from 'astro/loaders'
import { z } from 'astro/zod'
import { defineCollection } from 'astro:content'
import { allLocales, themeConfig } from '@/config'

const posts = defineCollection({
  loader: glob({ pattern: '**/*.{md,mdx}', base: './src/content/posts' }),
  schema: z.object({
    // required
    title: z.string(),
    published: z.date(),
    // optional
    description: z.string().optional().default(''),
    updated: z.preprocess(
      val => val === '' ? undefined : val,
      z.date().optional(),
    ),
    tags: z.array(z.string()).optional().default([]),
    // Advanced
    draft: z.boolean().optional().default(false),
    pin: z.number().int().min(0).max(99).optional().default(0),
    toc: z.boolean().optional().default(themeConfig.global.toc),
    lang: z.enum(['', ...allLocales]).optional().default(''),
    abbrlink: z.string().optional().default('').refine(
      abbrlink => !abbrlink || /^[a-z0-9\-]*$/.test(abbrlink),
      { message: 'Abbrlink can only contain lowercase letters, numbers and hyphens' },
    ),
    // Authors (soft resolve: optional, empty array = no author)
    authorIds: z.array(z.string()).optional(),
  }),
})

const about = defineCollection({
  loader: glob({ pattern: '**/*.{md,mdx}', base: './src/content/about' }),
  schema: z.object({
    lang: z.enum(['', ...allLocales]).optional().default(''),
  }),
})

// Author registry schema (single YAML file with a list of entries)
const authorSchema = z.object({
  id: z.string(),
  name: z.string(),
  type: z.enum(['персона', 'библиотека', 'сообщество', 'организация', 'редакция', 'источник']),
  // Internal fields
  credentials: z.string().optional(),
  access: z.string().optional(),
  license_note: z.string().optional(),
  link: z.string().optional(),
  note: z.string().optional(),
  // Schema.org common
  url: z.string().optional(),
  sameAs: z.array(z.string()).optional(),
  image: z.string().optional(),
  // Schema.org for persons
  jobTitle: z.string().optional(),
  affiliation: z.string().optional(),
  // Schema.org for organizations
  schema_type: z.string().optional(),
  legal_name: z.string().optional(),
  alternate_name: z.array(z.string()).optional(),

  // ИСПРАВЛЕНИЕ ДАТ (автоматический перевод Date-объектов в строки):
  founding_date: z.preprocess((val) => {
    if (val instanceof Date)
      return val.toISOString().split('T')[0]
    return val
  }, z.string().optional()),

  dissolution_date: z.preprocess((val) => {
    if (val instanceof Date)
      return val.toISOString().split('T')[0]
    return val
  }, z.string().optional()),

  successor: z.string().optional(),
  predecessor: z.array(z.string()).optional(),
  parent_organization: z.string().optional(),
  location: z.string().optional(),
})

const authors = defineCollection({
  loader: glob({ pattern: 'authors.yaml', base: './src/data' }),
  schema: z.array(authorSchema),
})

// ============================================================
// РЕЕСТРЫ units / cemeteries — ИЗОЛИРОВАННЫЙ АДДОН (non-destructive)
// Оригинальные коллекции шаблона (posts/about) и реестр authors НЕ затронуты.
// helper дат переиспользуется; схемы и коллекции добавлены отдельным блоком.
// ============================================================

// Общий helper: YAML «умный парсинг» превращает дату без кавычек в Date-объект —
// возвращаем её к каноничной строке YYYY-MM-DD (тот же паттерн, что в authorSchema).
function isoDate() {
  return z.preprocess((val) => {
    if (val instanceof Date)
      return val.toISOString().split('T')[0]
    return val
  }, z.string().optional())
}

// --- Реестр войсковых соединений: src/data/units.yaml ---
const unitSchema = z.object({
  id: z.string(),
  name: z.string(),
  type: z.enum([
    'армия',
    'фронт',
    'корпус',
    'дивизия',
    'бригада',
    'полк',
    'батальон',
    'рота',
    'батарея',
    'станция',
    'прочее',
  ]),
  // Внутренние поля сайта
  alternate_names: z.array(z.string()).optional(),
  short_name: z.string().optional(),
  parent_unit: z.string().optional(),
  front: z.string().optional(),
  army: z.string().optional(),
  commander: z.string().optional(),
  formation_date: isoDate(),
  disbandment_date: isoDate(),
  battles: z.array(z.string()).optional(),
  obd_source_doc: z.string().optional(),
  // Schema.org и служебное
  schema_type: z.string().optional(),
  url: z.string().optional(),
  sameAs: z.array(z.string()).optional(),
  image: z.string().optional(),
  license_note: z.string().optional(),
  access: z.string().optional(),
  note: z.string().optional(),
})

// --- Реестр мемориальных кладбищ: src/data/cemeteries.yaml ---
const cemeterySchema = z.object({
  id: z.string(),
  name: z.string(),
  type: z.string(), // открытое значение: братская могила | некрополь | кладбище | могила и памятный знак | ...
  country: z.string().optional(),
  region: z.string().optional(),
  location: z.string().optional(),
  coordinates: z.string().optional(),
  protection_status: z.string().optional(),
  // Документальные позиции НЕ меняем: ВМС-номер с слэшем ('82-289/2023') храним как есть.
  passport_number: z.preprocess(
    val => (typeof val === 'number' ? String(val) : val),
    z.string().optional(),
  ),
  obd_document_id: z.preprocess(
    val => (typeof val === 'number' ? String(val) : val),
    z.string().optional(),
  ),
  primary_burial_object: z.string().optional(),
  rebural_from: z.string().optional(), // орфография источника OBD сохранена намеренно
  date_created: isoDate(),
  date_last_burial: isoDate(),
  burial_state: z.string().optional(),
  // OBD отдаёт текстовые позиции («неизвестно», «более 3000») — допускаем строку ИЛИ число.
  graves_count: z.preprocess(
    val => (typeof val === 'number' ? String(val) : val),
    z.union([z.string(), z.number().int()]).optional(),
  ),
  buried_total: z.preprocess(
    val => (typeof val === 'number' ? String(val) : val),
    z.union([z.string(), z.number().int()]).optional(),
  ),
  buried_known: z.preprocess(
    val => (typeof val === 'number' ? String(val) : val),
    z.string().optional(),
  ),
  buried_unknown: z.preprocess(
    val => (typeof val === 'number' ? String(val) : val),
    z.string().optional(),
  ),
  sponsor: z.string().optional(),
  units: z.array(z.string()).optional(), // id из units.yaml
  sources_authors: z.array(z.string()).optional(), // id из authors.yaml
  url: z.string().optional(),
  schema_type: z.string().optional(),
  sameAs: z.array(z.string()).optional(),
  image: z.string().optional(),
  license_note: z.string().optional(),
  access: z.string().optional(),
  note: z.string().optional(),
})

const units = defineCollection({
  loader: glob({ pattern: 'units.yaml', base: './src/data' }),
  schema: z.array(unitSchema),
})

const cemeteries = defineCollection({
  loader: glob({ pattern: 'cemeteries.yaml', base: './src/data' }),
  schema: z.array(cemeterySchema),
})

export const collections = { posts, about, authors, units, cemeteries }