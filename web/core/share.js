'use strict'

/**
 * 分享碼（規格見 core-spec/README.md「分享碼」）：v-<六爻值>-<yyyymmdd>[-<事項選擇>]
 * 只用 [A-Za-z0-9._-]，可放進 artifact 連結的 #anchor。事項選擇的代號由介面解讀，這裡只檢查格式。
 */

const pad = n => String(n).padStart(2, '0')
const SEL_RE = /^[a-z]+(\.[a-z]+){5}$|^[a-z]+$/

/**
 * @param {{ values: number[], time: number, sel?: string|null }} cast - sel：樣板代號或六個事項代號以 . 連接；預設樣板時為 null
 * @returns {string}
 */
export function encodeShare({ values, time, sel = null }) {
  const d = new Date(time)
  const code = `v-${values.join('')}-${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}`
  return sel ? `${code}-${sel}` : code
}

/**
 * @param {string} code - 分享碼（可含開頭的 # 或 #/）
 * @returns {{ values: number[], time: number, sel: string|null }|null} 無效時為 null
 */
export function decodeShare(code) {
  const m = String(code).replace(/^#?\/?/, '').match(/^v-([6-9]{6})-(\d{4})(\d{2})(\d{2})(?:-([a-z.]+))?$/)
  if (!m) return null
  const [, digits, y, mo, d, sel] = m
  const date = new Date(Number(y), Number(mo) - 1, Number(d), 12)
  if (date.getMonth() !== Number(mo) - 1) return null
  if (sel && !SEL_RE.test(sel)) return null
  return { values: [...digits].map(Number), time: date.getTime(), sel: sel || null }
}
