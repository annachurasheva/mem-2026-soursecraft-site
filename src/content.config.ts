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
  founding_date: z.string().optional(),
  dissolution_date: z.string().optional(),
  successor: z.string().optional(),
  predecessor: z.array(z.string()).optional(),
  parent_organization: z.string().optional(),
  location: z.string().optional(),
})

const authors = defineCollection({
  loader: glob({ pattern: '**/*.yaml', base: './src/data' }),
  schema: z.array(authorSchema),
})

export const collections = { posts, about, authors }