import { getCollection, type CollectionEntry } from 'astro:content'

export type Author = CollectionEntry<'authors'>

/**
 * Soft resolve of authors by ids.
 * Missing ids do NOT fail the build — they are skipped with a warning.
 * Empty / undefined array means "no author".
 */
export async function resolveAuthors(authorIds?: string[]): Promise<Author[]> {
  if (!authorIds || authorIds.length === 0) {
    return []
  }

  const all = await getCollection('authors')
  // The YAML registry is a single list entry per file; flatten it
  const entries = all.flatMap(entry => (Array.isArray(entry.data) ? entry.data : [entry.data]))

  const map = new Map<string, typeof entries[number]>()
  for (const item of entries) {
    if (item?.id && !map.has(item.id)) {
      map.set(item.id, item)
    }
  }

  const resolved: typeof entries = []
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

  return resolved as Author[]
}

/**
 * Generate Schema.org JSON-LD objects for an array of authors.
 * Empty array -> empty result (author is omitted from the schema).
 */
export function authorsToJsonLd(authors: Author[]): object[] {
  return authors.map((a) => {
    const d = a.data
    const isPerson = d.type === 'персона'
    const schemaType = d.schema_type || (isPerson ? 'Person' : 'Organization')

    const base: Record<string, unknown> = {
      '@type': schemaType,
      name: d.name,
    }

    // Common fields
    if (d.url) base.url = d.url
    if (d.image) base.image = d.image
    if (d.sameAs?.length) base.sameAs = d.sameAs.filter(Boolean)

    // Person fields
    if (isPerson) {
      if (d.jobTitle) base.jobTitle = d.jobTitle
      if (d.credentials) base.hasCredential = d.credentials
      if (d.affiliation) {
        base.affiliation = { '@type': 'Organization', name: d.affiliation }
      }
    }

    // Organization fields
    if (!isPerson) {
      if (d.legal_name) base.legalName = d.legal_name
      if (d.alternate_name?.length) base.alternateName = d.alternate_name
      if (d.founding_date) base.foundingDate = d.founding_date
      if (d.dissolution_date) {
        base.dissolutionDate = d.dissolution_date
        // Explicitly mark as historical
        base.status = 'historical'
      }
      if (d.location) {
        base.location = { '@type': 'Place', name: d.location }
      }
      if (d.parent_organization) {
        base.parentOrganization = { '@type': 'Organization', name: d.parent_organization }
      }
      if (d.successor) {
        base.successor = { '@type': 'Organization', '@id': d.successor }
      }
      if (d.predecessor?.length) {
        base.predecessor = d.predecessor.map(id => ({
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
export function buildAuthorsJsonLdBlock(authors: Author[]): {
  author?: object[]
  sourceOrganization?: object[]
} {
  if (authors.length === 0) return {}

  const persons = authors.filter(a => a.data.type === 'персона')
  const organizations = authors.filter(a => a.data.type !== 'персона')

  const block: { author?: object[], sourceOrganization?: object[] } = {}
  if (persons.length > 0) block.author = authorsToJsonLd(persons)
  if (organizations.length > 0) block.sourceOrganization = authorsToJsonLd(organizations)

  return block
}