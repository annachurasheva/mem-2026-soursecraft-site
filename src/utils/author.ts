import { getCollection } from 'astro:content'

/**
 * Author registry entry.
 * NOTE: the YAML registry file contains a LIST of entries, so the Astro
 * collection entry data is an array of these records. We flatten it and
 * work directly with AuthorData (no CollectionEntry wrapper).
 */
export interface AuthorData {
  id: string
  name: string
  type: 'персона' | 'библиотека' | 'сообщество' | 'организация' | 'редакция' | 'источник'
  // Internal fields
  credentials?: string
  access?: string
  license_note?: string
  link?: string
  note?: string
  // Schema.org common
  url?: string
  sameAs?: string[]
  image?: string
  // Schema.org for persons
  jobTitle?: string
  affiliation?: string
  // Schema.org for organizations
  schema_type?: string
  legal_name?: string
  alternate_name?: string[]
  founding_date?: string
  dissolution_date?: string
  successor?: string
  predecessor?: string[]
  parent_organization?: string
  location?: string
}

/**
 * Soft resolve of authors by ids.
 * Missing ids do NOT fail the build — they are skipped with a warning.
 * Empty / undefined array means "no author".
 */
export async function resolveAuthors(authorIds?: string[]): Promise<AuthorData[]> {
  if (!authorIds || authorIds.length === 0) {
    return []
  }

  const all = await getCollection('authors')
  // The YAML registry is a single list per file; flatten it into AuthorData[]
  const entries = all.flatMap(entry => (Array.isArray(entry.data) ? entry.data : [entry.data])) as AuthorData[]

  const map = new Map<string, AuthorData>()
  for (const item of entries) {
    if (item?.id && !map.has(item.id)) {
      map.set(item.id, item)
    }
  }

  const resolved: AuthorData[] = []
  for (const id of authorIds) {
    const author = map.get(id)
    if (author) {
      resolved.push(author)
    }
    else {
      // ⚠️ Warning only, never an error
      console.warn(`[authors] ⚠️ id "${id}" не найден в реестре. Пропущен.`)
    }
  }

  return resolved
}

/**
 * Generate Schema.org JSON-LD objects for an array of authors.
 * Empty array -> empty result (author is omitted from the schema).
 */
export function authorsToJsonLd(authors: AuthorData[]): object[] {
  return authors.map((a) => {
    const isPerson = a.type === 'персона'
    const schemaType = a.schema_type || (isPerson ? 'Person' : 'Organization')

    const base: Record<string, unknown> = {
      '@type': schemaType,
      name: a.name,
    }

    // Common fields
    if (a.url) base.url = a.url
    if (a.image) base.image = a.image
    if (a.sameAs?.length) base.sameAs = a.sameAs.filter(Boolean)

    // Person fields
    if (isPerson) {
      if (a.jobTitle) base.jobTitle = a.jobTitle
      if (a.credentials) base.hasCredential = a.credentials
      if (a.affiliation) {
        base.affiliation = { '@type': 'Organization', name: a.affiliation }
      }
    }

    // Organization fields
    if (!isPerson) {
      if (a.legal_name) base.legalName = a.legal_name
      if (a.alternate_name?.length) base.alternateName = a.alternate_name
      if (a.founding_date) base.foundingDate = a.founding_date
      if (a.dissolution_date) {
        base.dissolutionDate = a.dissolution_date
        // Explicitly mark as historical
        base.status = 'historical'
      }
      if (a.location) {
        base.location = { '@type': 'Place', name: a.location }
      }
      if (a.parent_organization) {
        base.parentOrganization = { '@type': 'Organization', name: a.parent_organization }
      }
      if (a.successor) {
        base.successor = { '@type': 'Organization', '@id': a.successor }
      }
      if (a.predecessor?.length) {
        base.predecessor = a.predecessor.map(id => ({
          '@type': 'Organization',
          '@id': id,
        }))
      }
    }

    return base
  })
}

/**
 * Build the author block for the Article JSON-LD.
 * Persons go into `author`, organizations into `sourceOrganization`.
 */
export function buildAuthorsJsonLdBlock(authors: AuthorData[]): {
  author?: object[]
  sourceOrganization?: object[]
} {
  if (authors.length === 0) return {}

  const persons = authors.filter(a => a.type === 'персона')
  const organizations = authors.filter(a => a.type !== 'персона')

  const block: { author?: object[], sourceOrganization?: object[] } = {}
  if (persons.length > 0) block.author = authorsToJsonLd(persons)
  if (organizations.length > 0) block.sourceOrganization = authorsToJsonLd(organizations)

  return block
}