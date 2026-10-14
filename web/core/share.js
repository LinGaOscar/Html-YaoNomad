'use strict'

import { DEFAULT_ITEMS } from './scoring.js'

/**
 * 分享碼（規格見 core-spec/README.md「分享碼」）：v-<六爻值>-<yyyymmdd>[-<自訂事項 base64url>]
 * 只用 [A-Za-z0-9_-]，可放進 artifact 連結的 #anchor
 */

const pad = n => String(n).padStart(2, '0')

function toB64url(text) {
  const bytes = new TextEncoder().encode(text)
  return btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function fromB64url(code) {
  const b64 = code.replace(/-/g, '+').replace(/_/g, '/')
  const bin = atob(b64 + '='.repeat((4 - (b64.length % 4)) % 4))
  return new TextDecoder().decode(Uint8Array.from(bin, c => c.charCodeAt(0)))
}

const isDefaultItems = items =>
  items.length === DEFAULT_ITEMS.length && items.every((it, i) => it.name === DEFAULT_ITEMS[i].name && it.type === DEFAULT_ITEMS[i].type)

/** 檢查自訂事項：6 項，名稱 1–12 字，事類 0–5 */
export function validItems(items) {
  return Array.isArray(items) && items.length === 6 && items.every(it =>
    it && typeof it.name === 'string' && it.name.trim().length > 0 && it.name.length <= 12
    && Number.isInteger(it.type) && it.type >= 0 && it.type <= 5)
}

/**
 * @param {{ values: number[], time: number, items?: {name: string, type: number}[]|null }} cast
 * @returns {string}
 */
export function encodeShare({ values, time, items = null }) {
  const d = new Date(time)
  let code = `v-${values.join('')}-${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}`
  if (items && !isDefaultItems(items)) code += '-' + toB64url(JSON.stringify(items.map(it => [it.name, it.type])))
  return code
}

/**
 * @param {string} code - 分享碼（可含開頭的 # 或 #/）
 * @returns {{ values: number[], time: number, items: {name: string, type: number}[]|null }|null} 無效時為 null
 */
export function decodeShare(code) {
  const m = String(code).replace(/^#?\/?/, '').match(/^v-([6-9]{6})-(\d{4})(\d{2})(\d{2})(?:-([A-Za-z0-9_-]+))?$/)
  if (!m) return null
  const [, digits, y, mo, d, enc] = m
  const date = new Date(Number(y), Number(mo) - 1, Number(d), 12)
  if (date.getMonth() !== Number(mo) - 1) return null
  let items = null
  if (enc) {
    try {
      items = JSON.parse(fromB64url(enc)).map(([name, type]) => ({ name, type }))
    } catch {
      return null
    }
    if (!validItems(items)) return null
  }
  return { values: [...digits].map(Number), time: date.getTime(), items }
}
