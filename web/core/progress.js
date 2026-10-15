'use strict'

import { castFromLines } from './casting.js'
import { DEFAULT_ITEMS, ANALYZE, CREATE, ROUTINE, FORTUNE, REST, scoreActivities, scoreCategories } from './scoring.js'

/**
 * 使用者進度：今日一卦、連續天數、圖鑑、成就、應驗準度。
 * 輸入皆為歷史紀錄（CastRecord），純函式、不碰儲存。
 */

const pad = n => String(n).padStart(2, '0')

/** 當地日期鍵，如 2026-10-14 */
export function dayKey(ms) {
  const d = new Date(ms)
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

const questionKey = q => (typeof q === 'string' ? q.trim() : '')

/**
 * 一筆紀錄在當天的身分：
 * daily 今日一卦（當天第一卦）、new 另問一事（換了問題）、again 再問（同一問題第二次）、profane 再三瀆（第三次以上）
 * @returns {'daily'|'new'|'again'|'profane'}
 */
export function castKind(records, rec) {
  const day = dayKey(rec.time)
  const earlier = records.filter(r => r.id !== rec.id && r.time < rec.time && dayKey(r.time) === day)
  if (!earlier.length) return 'daily'
  const same = earlier.filter(r => questionKey(r.question) === questionKey(rec.question)).length
  if (same === 0) return 'new'
  return same === 1 ? 'again' : 'profane'
}

/** 今天的第一卦；沒有則為 null */
export function todayDaily(records, now = Date.now()) {
  const today = dayKey(now)
  const list = records.filter(r => dayKey(r.time) === today)
  return list.length ? list.reduce((a, b) => (a.time <= b.time ? a : b)) : null
}

const DAY = 86400000
const dayIndex = key => {
  const [y, m, d] = key.split('-').map(Number)
  return Math.round(Date.UTC(y, m - 1, d) / DAY)
}

/** 目前連續起卦天數：今天還沒起卦時，從昨天往回算 */
export function currentStreak(records, now = Date.now()) {
  const days = new Set(records.map(r => dayIndex(dayKey(r.time))))
  let day = dayIndex(dayKey(now))
  if (!days.has(day)) day--
  let count = 0
  while (days.has(day)) {
    count++
    day--
  }
  return count
}

/** 歷來最長連續天數 */
export function bestStreak(records) {
  const days = [...new Set(records.map(r => dayIndex(dayKey(r.time))))].sort((a, b) => a - b)
  let best = 0
  let run = 0
  days.forEach((d, i) => {
    run = i > 0 && d === days[i - 1] + 1 ? run + 1 : 1
    best = Math.max(best, run)
  })
  return best
}

/** 計算一筆紀錄的卦象、六類分數與事項評分；爻值不合法時回傳 null */
export function evaluate(hexagrams, rec) {
  try {
    const result = castFromLines(hexagrams, typeof rec.question === 'string' ? rec.question : '', rec.values)
    const date = new Date(rec.time)
    const categories = scoreCategories(result, { date, streak: rec.streak || 0 })
    const scores = scoreActivities(result, { items: rec.items || DEFAULT_ITEMS, categories })
    return { result, categories, scores }
  } catch {
    return null
  }
}

/** 應驗回饋統計；feedback[i] 為 true（準）、false（不準）或缺。byCat 依事項的主分類統計 */
export function accuracy(records) {
  const byName = new Map()
  const byCat = [0, 1, 2, 3, 4, 5].map(cat => ({ cat, hit: 0, miss: 0 }))
  let hit = 0
  let miss = 0
  let rated = 0
  for (const rec of records) {
    if (!Array.isArray(rec.feedback)) continue
    const items = rec.items || DEFAULT_ITEMS
    let any = false
    rec.feedback.forEach((v, i) => {
      if (typeof v !== 'boolean' || !items[i]) return
      any = true
      const row = byName.get(items[i].name) || { name: items[i].name, hit: 0, miss: 0 }
      const cat = byCat[items[i].cats?.[0]]
      if (v) { row.hit++; hit++ } else { row.miss++; miss++ }
      if (cat) cat[v ? 'hit' : 'miss']++
      byName.set(items[i].name, row)
    })
    if (any) rated++
  }
  const total = hit + miss
  return { hit, miss, total, rated, rate: total ? hit / total : null, byName: [...byName.values()], byCat }
}

/** 成就；test 收到 summary（見 summarize） */
export const ACHIEVEMENTS = [
  { id: 'first', name: '初入卦門', desc: '完成第一次起卦', test: s => s.count >= 1 },
  { id: 'streak7', name: '七日不輟', desc: '連續 7 天都有起卦', test: s => s.best >= 7 },
  { id: 'allMoving', name: '六爻皆動', desc: '六爻全是變爻（機率約 1/4096）', test: s => s.allMoving },
  { id: 'qian', name: '見龍在天', desc: '抽到乾為天', test: s => s.collection.has(1) },
  { id: 'kun', name: '厚德載物', desc: '抽到坤為地', test: s => s.collection.has(2) },
  { id: 'reunion', name: '舊識重逢', desc: '同一卦遇見 3 次', test: s => s.maxRepeat >= 3 },
  { id: 'half', name: '半部易經', desc: '收集 32 卦', test: s => s.collection.size >= 32 },
  { id: 'all', name: '六十四卦全', desc: '收集全部 64 卦', test: s => s.collection.size >= 64 },
  { id: 'fridayHero', name: '週五勇者', desc: '週五起卦，時運類仍有 70 分以上', test: s => s.fridayHero },
  { id: 'freeze', name: '時運不濟', desc: '時運類分數低於 10 分', test: s => s.freeze },
  { id: 'debugGod', name: '明察秋毫', desc: '分析類分數 90 分以上', test: s => s.debugGod },
  { id: 'muse', name: '靈感爆發', desc: '創意類分數 95 分以上', test: s => s.muse },
  { id: 'habit', name: '日日是好日', desc: '例行類拿到連續天數加成上限（連續 6 天）', test: s => s.habit },
  { id: 'weekend', name: '偷得浮生', desc: '週末起卦，休養類 90 分以上', test: s => s.weekendRest },
  { id: 'profane', name: '再三瀆', desc: '同一個問題一天問了三次', test: s => s.profane },
  { id: 'feedback10', name: '知行合一', desc: '回饋 10 次應驗結果', test: s => s.accuracy.rated >= 10 },
  { id: 'oracle', name: '鐵口直斷', desc: '回饋 30 項以上且準度達 80%', test: s => s.accuracy.total >= 30 && s.accuracy.rate >= 0.8 },
]

/**
 * 彙整所有進度
 * @returns {{ count: number, streak: number, best: number, collection: Map<number, {count: number, latest: object}>,
 *   maxRepeat: number, allMoving: boolean, fridayHero: boolean, freeze: boolean, debugGod: boolean, muse: boolean,
 *   habit: boolean, weekendRest: boolean, profane: boolean,
 *   accuracy: ReturnType<typeof accuracy>, unlocked: Set<string> }}
 */
export function summarize(hexagrams, records, now = Date.now()) {
  const s = {
    count: records.length,
    streak: currentStreak(records, now),
    best: bestStreak(records),
    collection: new Map(),
    maxRepeat: 0,
    allMoving: false,
    fridayHero: false,
    freeze: false,
    debugGod: false,
    muse: false,
    habit: false,
    weekendRest: false,
    profane: false,
    accuracy: accuracy(records),
    unlocked: new Set(),
  }
  for (const rec of records) {
    const ev = evaluate(hexagrams, rec)
    if (!ev) continue
    const n = ev.result.present.number
    const entry = s.collection.get(n) || { count: 0, latest: rec }
    entry.count++
    if (rec.time >= entry.latest.time) entry.latest = rec
    s.collection.set(n, entry)
    s.maxRepeat = Math.max(s.maxRepeat, entry.count)
    if (ev.result.lines.every(l => l.changing)) s.allMoving = true
    const c = ev.categories
    const has = (cat, rule) => c[cat].rules.some(r => r.rule === rule)
    if (has(FORTUNE, 'friday') && c[FORTUNE].score >= 70) s.fridayHero = true
    if (c[FORTUNE].score < 10) s.freeze = true
    if (c[ANALYZE].score >= 90) s.debugGod = true
    if (c[CREATE].score >= 95) s.muse = true
    if (c[ROUTINE].rules.some(r => r.rule === 'streak' && r.delta >= 10)) s.habit = true
    if (has(REST, 'weekend') && c[REST].score >= 90) s.weekendRest = true
    if (castKind(records, rec) === 'profane') s.profane = true
  }
  for (const a of ACHIEVEMENTS) if (a.test(s)) s.unlocked.add(a.id)
  return s
}
