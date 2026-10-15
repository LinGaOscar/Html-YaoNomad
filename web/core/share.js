'use strict'

/**
 * 分享碼（規格見 core-spec/README.md「分享碼」）：v-<六爻值>-<yyyymmdd>[-s<連續天數>][-q<所求>][-<事項選擇>]
 * 只用 [A-Za-z0-9._-]，可放進 artifact 連結的 #anchor。事項選擇的代號由介面解讀，這裡只檢查格式。
 */

const pad = n => String(n).padStart(2, '0')
const SEL_RE = /^[a-z]+(\.[a-z]+)*$/
const QUESTION_MAX = 40

/** 所求：UTF-8 → base64，+ 換成 _、/ 換成 .，去掉 =，只剩 [A-Za-z0-9_.] */
function packQuestion(q) {
  let bin = ''
  for (const b of new TextEncoder().encode(q)) bin += String.fromCharCode(b)
  return btoa(bin).replace(/\+/g, '_').replace(/\//g, '.').replace(/=+$/, '')
}

function unpackQuestion(s) {
  try {
    const bin = atob(s.replace(/_/g, '+').replace(/\./g, '/'))
    const q = new TextDecoder('utf-8', { fatal: true }).decode(Uint8Array.from(bin, c => c.charCodeAt(0))).trim()
    return q && q.length <= QUESTION_MAX ? q : null
  } catch {
    return null
  }
}

/**
 * @param {{ values: number[], time: number, streak?: number, sel?: string|null, question?: string }} cast
 *   streak：連續起卦天數，大於 1 才帶；question：求卦的所求；sel：樣板代號（或舊卦例的事項代號）以 . 連接
 * @returns {string}
 */
export function encodeShare({ values, time, streak = 0, sel = null, question = '' }) {
  const d = new Date(time)
  let code = `v-${values.join('')}-${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}`
  if (streak > 1) code += `-s${Math.min(streak, 999)}`
  const q = String(question || '').trim().slice(0, QUESTION_MAX)
  if (q) code += `-q${packQuestion(q)}`
  return sel ? `${code}-${sel}` : code
}

/**
 * @param {string} code - 分享碼（可含開頭的 # 或 #/）
 * @returns {{ values: number[], time: number, streak: number, sel: string|null, question: string }|null} 無效時為 null
 */
export function decodeShare(code) {
  const m = String(code).replace(/^#?\/?/, '').match(/^v-([6-9]{6})-(\d{4})(\d{2})(\d{2})(?:-s(\d{1,3}))?(?:-q([A-Za-z0-9_.]+))?(?:-([a-z.]+))?$/)
  if (!m) return null
  const [, digits, y, mo, d, streak, packed, sel] = m
  const date = new Date(Number(y), Number(mo) - 1, Number(d), 12)
  if (date.getMonth() !== Number(mo) - 1) return null
  if (sel && !SEL_RE.test(sel)) return null
  const question = packed ? unpackQuestion(packed) : ''
  if (question === null) return null
  return { values: [...digits].map(Number), time: date.getTime(), streak: streak ? Number(streak) : 0, sel: sel || null, question }
}
