'use strict'

/** 六類，代碼即索引（規則見 core-spec/README.md「六事評分」） */
export const CATEGORIES = ['溝通', '分析', '創意', '例行', '時運', '休養']
export const COMM = 0
export const ANALYZE = 1
export const CREATE = 2
export const ROUTINE = 3
export const FORTUNE = 4
export const REST = 5

/** 八卦對六類的傾向（0–100），以三位碼為索引，欄位順序同 CATEGORIES */
export const AFFINITY = [
  [50, 50, 30, 95, 40, 90], // 坤 地：柔順承載，利例行、休養
  [45, 25, 95, 20, 80, 25], // 震 雷：發動開創，利創意、時運
  [20, 85, 45, 35, 15, 45], // 坎 水：險陷深入，利分析，最忌時運
  [95, 35, 75, 50, 60, 75], // 兌 澤：喜悅言說，利溝通
  [25, 70, 20, 85, 30, 90], // 艮 山：止靜，利例行、休養
  [70, 95, 85, 45, 70, 40], // 離 火：光明清晰，利分析、創意
  [85, 55, 65, 70, 55, 60], // 巽 風：滲透溝通，利溝通
  [65, 65, 55, 60, 95, 20], // 乾 天：剛健主導，利時運，不利休養
]

/** 預設六事（工程師樣板）：cats 為 [主分類, 副分類] */
export const DEFAULT_ITEMS = [
  { id: 'meeting', name: '開會', cats: [COMM, ROUTINE] },
  { id: 'report', name: '撰寫報告', cats: [ANALYZE, CREATE] },
  { id: 'debug', name: '抓BUG', cats: [ANALYZE, FORTUNE] },
  { id: 'develop', name: '系統開發', cats: [CREATE, ANALYZE] },
  { id: 'deploy', name: '程式上線', cats: [FORTUNE, ROUTINE] },
  { id: 'fish', name: '餵魚/澆花', cats: [REST, ROUTINE] },
]

const clamp = n => Math.max(0, Math.min(100, Math.round(n)))
const spread = (raw, k) => 50 + 48 * Math.tanh(((raw - 55) * k) / 48)

/** 單卦對某類的原始分：一般內卦 60%、外卦 40%；時運類相反 */
function rawScore(hexagram, cat) {
  const [wLower, wUpper] = cat === FORTUNE ? [0.4, 0.6] : [0.6, 0.4]
  return wLower * AFFINITY[hexagram.lower][cat] + wUpper * AFFINITY[hexagram.upper][cat]
}

/**
 * @typedef {Object} CategoryScore
 * @property {number} cat - 類代碼
 * @property {string} name - 類名
 * @property {number} score - 0–100 整數（含專屬規則）
 * @property {number} present - 本卦分數（展開後、未含規則）
 * @property {number|null} future - 變卦分數；無變卦時為 null
 * @property {{rule: string, delta: number}[]} rules - 套用的專屬規則：monday、calm、change、streak、friday、weekend
 */

/**
 * 六類分數
 * @param {import('./models.js').CastResult} result
 * @param {{ date?: Date|null, streak?: number }} [options] - date：起卦時間；streak：連續起卦天數（含當天）
 * @returns {CategoryScore[]}
 */
export function scoreCategories(result, { date = null, streak = 0 } = {}) {
  const moving = result.lines.filter(l => l.changing).length
  const day = date instanceof Date ? date.getDay() : null

  return CATEGORIES.map((name, cat) => {
    const k = cat === FORTUNE ? 2.6 : 1.8
    const present = rawScore(result.present, cat)
    const future = result.future ? rawScore(result.future, cat) : null
    let score = spread(future === null ? present : 0.75 * present + 0.25 * future, k)
    const rules = []
    const apply = (rule, delta) => {
      rules.push({ rule, delta })
      score += delta
    }
    if (cat === COMM && day === 1) apply('monday', -10)
    if (cat === ANALYZE && moving === 0) apply('calm', 8)
    if (cat === CREATE && moving > 0) apply('change', Math.min(16, 4 * moving))
    if (cat === ROUTINE && streak > 1) apply('streak', Math.min(10, 2 * (streak - 1)))
    if (cat === FORTUNE && day === 5) apply('friday', -15)
    if (cat === REST && (day === 0 || day === 6)) apply('weekend', 10)
    return {
      cat,
      name,
      score: clamp(score),
      present: clamp(spread(present, k)),
      future: future === null ? null : clamp(spread(future, k)),
      rules,
    }
  })
}

const levelOf = score => (score >= 70 ? 'good' : score < 40 ? 'bad' : 'fair')

/**
 * @typedef {Object} ActivityScore
 * @property {string} name - 事項名稱
 * @property {number[]} cats - [主分類, 副分類]
 * @property {number} score - 0–100 的整數
 * @property {number} present - 本卦分數（未含規則）
 * @property {number|null} future - 變卦分數；無變卦時為 null
 * @property {{rule: string, delta: number, cat: number, weight: number}[]} rules - 主副分類套用的規則
 * @property {'good'|'fair'|'bad'} level - ≥70 為 good，<40 為 bad，其餘 fair
 */

/**
 * 依卜卦結果為六事評分：事項分數 = 主分類 70% + 副分類 30%
 * @param {import('./models.js').CastResult} result
 * @param {{ items?: {name: string, cats: number[]}[], date?: Date|null, streak?: number, categories?: CategoryScore[] }} [options]
 *   items：要評分的事項，預設 DEFAULT_ITEMS，事項的其他欄位（如 id）原樣帶到結果；categories：已算好的六類分數
 * @returns {ActivityScore[]}
 */
export function scoreActivities(result, { items = DEFAULT_ITEMS, date = null, streak = 0, categories = null } = {}) {
  const cats = categories || scoreCategories(result, { date, streak })
  return items.map(item => {
    const [p, s = p] = item.cats
    const mix = (a, b) => Math.round(0.7 * a + 0.3 * b)
    const score = mix(cats[p].score, cats[s].score)
    const rules = cats[p].rules.map(r => ({ ...r, cat: p, weight: s === p ? 1 : 0.7 }))
    if (s !== p) rules.push(...cats[s].rules.map(r => ({ ...r, cat: s, weight: 0.3 })))
    return {
      ...item,
      score,
      present: mix(cats[p].present, cats[s].present),
      future: cats[p].future === null ? null : mix(cats[p].future, cats[s].future),
      rules,
      level: levelOf(score),
    }
  })
}
