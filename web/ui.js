'use strict'

/** 各畫面共用：常數、格式化、半形轉換、畫面掛載、提示、歷史與設定儲存 */

import { TRIGRAMS } from './core/hexagrams.js'
import { DEFAULT_ITEMS } from './core/scoring.js'
import { ACHIEVEMENTS, summarize } from './core/progress.js'
import { validItems } from './core/share.js'

export const VERSION = 'V3.02'
export const LINE_POS = ['初爻', '二爻', '三爻', '四爻', '五爻', '上爻']
export const LINE_KIND = { 6: '老陰（變）', 7: '少陽', 8: '少陰', 9: '老陽（變）' }
export const COIN_FACE = { 2: '正', 3: '背' }
export const LEVEL = { good: '上佳', fair: '一般', bad: '不宜' }
export const KIND_LABEL = { daily: '今日一卦', new: '另問一事', again: '再問', profane: '再三瀆', shared: '朋友分享' }
const METHOD = { coin: '三錢法', manual: '手動六爻' }
export const methodName = m => METHOD[m] || METHOD.coin
const WEEKDAY = ['日', '一', '二', '三', '四', '五', '六']

const HISTORY_KEY = 'yaonomad.history'
const ITEMS_KEY = 'yaonomad.items'
const HISTORY_MAX = 200

export const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)')

// ---------- 資料 ----------

let hexagramsPromise = null

/** 64 卦資料；單檔版（artifact）內嵌在 #hexagrams-data */
export function loadHexagrams() {
  if (hexagramsPromise === null) {
    const embedded = document.getElementById('hexagrams-data')
    hexagramsPromise = embedded
      ? Promise.resolve(JSON.parse(embedded.textContent))
      : fetch('./data/hexagrams.json').then(res => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        return res.json()
      })
    hexagramsPromise.catch(() => { hexagramsPromise = null })
  }
  return hexagramsPromise
}

// ---------- 文字 ----------

/** 全站文字一律半形：全形標點轉成半形，資料檔維持原樣，只在顯示時轉換 */
const HALF = {
  '，': ', ', '。': '. ', '、': ', ', '：': ': ', '；': '; ', '！': '! ', '？': '? ',
  '（': '(', '）': ')', '「': '"', '」': '"', '『': "'", '』': "'", '　': ' ', '…': '...', '—': '-', '～': '~', '／': '/',
}
const HALF_RE = new RegExp(`[${Object.keys(HALF).join('')}]`, 'g')
export const hw = s => String(s).replace(HALF_RE, c => HALF[c])

/** HTML 跳脫；「」『』先轉成引號再跳脫，避免之後 hw() 轉出的引號破壞屬性 */
export function esc(s) {
  return String(s)
    .replace(/[「」『』]/g, c => HALF[c])
    .replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c])
}

const pad = n => String(n).padStart(2, '0')

export function formatDay(d) {
  return `${d.getMonth() + 1}/${d.getDate()}（週${WEEKDAY[d.getDay()]}）`
}

export function formatDate(ms) {
  const d = new Date(ms)
  return `${d.getFullYear()}/${pad(d.getMonth() + 1)}/${pad(d.getDate())}（週${WEEKDAY[d.getDay()]}）`
}

export function formatTime(ms) {
  const d = new Date(ms)
  return `${d.getFullYear()}/${pad(d.getMonth() + 1)}/${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`
}

/** 1–64 轉中文數字，如 44 → 四十四 */
export function cnNum(n) {
  const d = ['', '一', '二', '三', '四', '五', '六', '七', '八', '九']
  if (n < 10) return d[n]
  if (n < 20) return '十' + d[n % 10]
  return d[Math.floor(n / 10)] + '十' + d[n % 10]
}

export function trigramPair(hex) {
  const up = TRIGRAMS[hex.upper]
  const low = TRIGRAMS[hex.lower]
  return `${up.name}${up.image}上 · ${low.name}${low.image}下`
}

export const sleep = ms => new Promise(r => setTimeout(r, reduceMotion.matches ? Math.min(ms, 120) : ms))

// ---------- 畫面 ----------

let navToken = 0
/** 每次換頁取得新權杖；非同步渲染完成前若已換頁，isStale 為 true */
export const nextToken = () => ++navToken
export const isStale = token => token !== navToken

/** 以模板字串渲染畫面；所有外來字串皆須先經 esc() */
export function mount(html) {
  const tpl = document.createElement('template')
  tpl.innerHTML = hw(html.trim())
  const node = tpl.content.firstElementChild
  node.classList.add('view-enter')
  document.getElementById('view').replaceChildren(node)
  scrollTo({ top: 0 })
  return node
}

export function toast(msg, { ms = 1800, achievement = false } = {}) {
  const el = document.getElementById('toast')
  el.textContent = hw(msg)
  el.classList.toggle('toast-achv', achievement)
  el.classList.add('show')
  clearTimeout(toast.timer)
  toast.timer = setTimeout(() => el.classList.remove('show'), ms)
}

export async function copyToClipboard(text) {
  try {
    await navigator.clipboard.writeText(text)
  } catch {
    const ta = document.createElement('textarea')
    ta.value = text
    ta.style.cssText = 'position:fixed;opacity:0'
    document.body.appendChild(ta)
    ta.select()
    document.execCommand('copy')
    ta.remove()
  }
}

// ---------- 歷史紀錄 ----------

/**
 * @typedef {Object} CastRecord
 * @property {string} id
 * @property {number} time - 起卦時間（ms）
 * @property {'coin'|'manual'} method
 * @property {number[]} values - 六爻值，index 0 = 初爻
 * @property {number[][]|null} coins - 每爻三枚硬幣（2/3）；手動輸入時為 null
 * @property {string} [question] - 心中所問
 * @property {{name: string, type: number}[]} [items] - 起卦當時的自訂六事；預設六事時省略
 * @property {(boolean|null)[]} [feedback] - 應驗回饋，index 同六事
 */

/** @returns {CastRecord[]} 由新至舊 */
export function loadHistory() {
  try {
    const list = JSON.parse(localStorage.getItem(HISTORY_KEY) || '[]')
    return Array.isArray(list)
      ? list.filter(r => r && typeof r.id === 'string' && Array.isArray(r.values) && r.values.length === 6)
        .map(r => (r.items && !validItems(r.items) ? { ...r, items: undefined } : r))
      : []
  } catch {
    return []
  }
}

export function saveHistory(list) {
  try {
    localStorage.setItem(HISTORY_KEY, JSON.stringify(list.slice(0, HISTORY_MAX)))
  } catch {
    toast('無法保存紀錄（瀏覽器儲存空間不可用）')
  }
}

export function addRecord(method, values, coins, question = '') {
  const items = loadItems()
  const record = { id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6), time: Date.now(), method, values, coins }
  if (question.trim()) record.question = question.trim().slice(0, 40)
  if (!isDefaultItems(items)) record.items = items
  saveHistory([record, ...loadHistory()])
  return record
}

export function updateRecord(id, patch) {
  saveHistory(loadHistory().map(r => (r.id === id ? { ...r, ...patch } : r)))
}

// ---------- 自訂六事 ----------

export const isDefaultItems = items =>
  items.every((it, i) => it.name === DEFAULT_ITEMS[i].name && it.type === DEFAULT_ITEMS[i].type)

export function loadItems() {
  try {
    const items = JSON.parse(localStorage.getItem(ITEMS_KEY) || 'null')
    return validItems(items) ? items : DEFAULT_ITEMS
  } catch {
    return DEFAULT_ITEMS
  }
}

/** items 為 null 時還原預設 */
export function saveItems(items) {
  try {
    if (items === null) localStorage.removeItem(ITEMS_KEY)
    else localStorage.setItem(ITEMS_KEY, JSON.stringify(items))
    return true
  } catch {
    toast('無法保存設定（瀏覽器儲存空間不可用）')
    return false
  }
}

// ---------- 成就 ----------

export const unlockedNow = hexagrams => summarize(hexagrams, loadHistory()).unlocked

/** 比對動作前後的成就，有新解鎖就提示 */
export function announceUnlocks(hexagrams, before) {
  const after = unlockedNow(hexagrams)
  const fresh = ACHIEVEMENTS.filter(a => after.has(a.id) && !before.has(a.id))
  if (fresh.length) toast(`解鎖成就：${fresh.map(a => a.name).join('、')}`, { ms: 3600, achievement: true })
}
