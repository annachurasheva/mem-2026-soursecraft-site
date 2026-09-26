/**
 * Create a new post with frontmatter (including authorIds)
 * Usage: pnpm new-author-post <title> [--authors="id1,id2"]
 * Example: pnpm new-author-post "Моя статья" --authors="nevzorov-b-i,rsl"
 */

import { existsSync, mkdirSync, writeFileSync } from 'node:fs'
import { basename, dirname, extname, join } from 'node:path'
import process from 'node:process'
import { themeConfig } from '../src/config'

// Process file path
const rawPath = process.argv[2] ?? 'new-post'
const baseName = basename(rawPath).replace(/\.(md|mdx)$/, '')
const targetFile = ['.md', '.mdx'].includes(extname(rawPath))
  ? rawPath
  : `${rawPath}.md`
const fullPath = join('src/content/posts', targetFile)

// Parse --authors="id1,id2" argument
const authorsArg = process.argv.find(arg => arg.startsWith('--authors='))
const authorIds = authorsArg
  ? authorsArg.replace(/^--authors=/, '').split(',').map(id => id.trim()).filter(Boolean)
  : []

// Check if file already exists
if (existsSync(fullPath)) {
  console.error(`❌ File already exists: ${fullPath}`)
  process.exit(1)
}

// Create directory structure
mkdirSync(dirname(fullPath), { recursive: true })

// Prepare file content
const authorBlock = authorIds.length > 0
  ? `\nauthorIds:\n${authorIds.map(id => `  - ${id}`).join('\n')}`
  : ''

const content = `---
title: ${baseName}
published: ${new Date().toISOString()}
description: ''
updated: ''
tags:
  - Tag
draft: false
pin: 0
toc: ${themeConfig.global.toc}
lang: ''
abbrlink: ''${authorBlock}
---
`

// Write to file
try {
  writeFileSync(fullPath, content)
  console.log(`✅ Post created: ${fullPath}`)
  if (authorIds.length > 0) {
    console.log(`   Authors: ${authorIds.join(', ')}`)
  }
  else {
    console.log('   No authors specified (article without author)')
  }
}
catch (error) {
  console.error('❌ Failed to create post:', error)
  process.exit(1)
}