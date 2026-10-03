// Text helpers for verify-site.mjs: rendered-text extraction from node-html-parser trees,
// whitespace normalisation, site.js string leaves and the TERMS_FILE reader.
import { readFileSync } from 'node:fs'

// Collapse whitespace runs; NBSP (and narrow/figure spaces) count as plain spaces.
export const norm = (s) =>
  String(s ?? '')
    .replace(/[   ]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

const BLOCK = new Set(
  (
    'address article aside blockquote body dd details dialog div dl dt fieldset figcaption figure footer ' +
    'form h1 h2 h3 h4 h5 h6 header hgroup hr li main nav ol p pre section summary table tbody thead tfoot ' +
    'tr td th ul br button option select textarea'
  ).split(' '),
)
export const DROP_TAGS = new Set(['script', 'template', 'noscript', 'style'])

export const tagOf = (n) => String((n && n.rawTagName) || '').toLowerCase()

// Text as a reader sees it: inline elements join directly, block elements are separated
// by a space, and script/template/noscript/style are dropped.
export function textOf(node) {
  if (!node) return ''
  let out = ''
  const walk = (n) => {
    if (n.nodeType === 3) {
      out += n.text
      return
    }
    if (n.nodeType !== 1) return
    const tag = tagOf(n)
    if (DROP_TAGS.has(tag)) return
    const block = BLOCK.has(tag)
    if (block) out += ' '
    for (const c of n.childNodes) walk(c)
    if (block) out += ' '
  }
  walk(node)
  return norm(out)
}

// Every string leaf of a value, with its dotted path and the key that holds it.
export function stringLeaves(value, path = '', key = '', out = []) {
  if (typeof value === 'string') out.push({ path, key, value })
  else if (Array.isArray(value)) value.forEach((v, i) => stringLeaves(v, `${path}[${i}]`, key, out))
  else if (value && typeof value === 'object')
    for (const [k, v] of Object.entries(value)) stringLeaves(v, path ? `${path}.${k}` : k, k, out)
  return out
}

const NON_COPY_KEYS = new Set(['href', 'id', 'url', 'src', '@id', '@type', '@context'])
export const isUrlish = (v) => /^(https?:|mailto:|tel:|\/|#)/i.test(String(v).trim())
export const isCopyLeaf = (leaf) => !NON_COPY_KEYS.has(leaf.key) && !isUrlish(leaf.value) && norm(leaf.value) !== ''

// TERMS_FILE: label<TAB>scope<TAB>regex; '#' lines are comments.
export function readTerms(file) {
  const raw = readFileSync(file, 'utf8').replace(/^﻿/, '')
  const terms = []
  const errors = []
  raw.split(/\r?\n/).forEach((line, i) => {
    if (!line.trim() || line.trimStart().startsWith('#')) return
    const parts = line.split('\t')
    if (parts.length < 3) {
      errors.push(`line ${i + 1}: expected label<TAB>scope<TAB>regex`)
      return
    }
    const [label, scope, ...rest] = parts
    const source = rest.join('\t')
    try {
      terms.push({ line: i + 1, label: label.trim(), scope: scope.trim(), re: new RegExp(source, 'iu') })
    } catch (e) {
      errors.push(`line ${i + 1}: invalid regex (${e.message.split(':').pop().trim()})`)
    }
  })
  return { terms, errors }
}

// Emoji, excluding the three typographic marks the site may use.
const EMOJI_RE = /\p{Emoji_Presentation}|️|\p{Extended_Pictographic}/gu
const ALLOWED_MARKS = new Set(['©', '®', '™'])
export function findEmoji(text) {
  const hits = []
  for (const m of String(text).matchAll(EMOJI_RE)) {
    if (ALLOWED_MARKS.has(m[0])) continue
    hits.push({ index: m.index, cp: 'U+' + m[0].codePointAt(0).toString(16).toUpperCase().padStart(4, '0') })
  }
  return hits
}

export function lineOf(text, index) {
  let n = 1
  for (let i = 0; i < index && i < text.length; i++) if (text.charCodeAt(i) === 10) n++
  return n
}

export function snippet(text, index, len = 0, pad = 30) {
  const s = Math.max(0, index - pad)
  const e = Math.min(text.length, index + len + pad)
  return (s > 0 ? '...' : '') + norm(text.slice(s, e)) + (e < text.length ? '...' : '')
}
