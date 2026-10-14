'use strict'

/** 預設六事；索引即事類代碼 */
export const ACTIVITIES = ['開會', '撰寫報告', '抓BUG', '系統開發', '程式上線', '餵魚/澆花']

/** 事類名稱，順序同 AFFINITY 欄位 */
export const TYPES = ['溝通', '寫作', '分析', '建造', '發布', '照顧']

/** 預設事項：{ name, type } × 6 */
export const DEFAULT_ITEMS = ACTIVITIES.map((name, type) => ({ name, type }))

/** 發布類（程式上線）的事類代碼 */
export const LAUNCH = 4

/** 週五發布類扣分（古訓：週五不部署） */
export const FRIDAY_PENALTY = 15

/**
 * 八卦對六個事類的基礎傾向（0–100），以三位碼為索引，欄位為事類
 * 例：坎為險、為深 → 分析高、發布低；離為明 → 寫作高
 */
export const AFFINITY = [
  [40, 85, 55, 45, 20, 95], // 坤 地：承載、順從
  [50, 30, 70, 90, 65, 40], // 震 雷：發動、開創
  [25, 50, 95, 45, 10, 55], // 坎 水：險陷、深入
  [95, 45, 35, 40, 50, 85], // 兌 澤：喜悅、言說
  [30, 75, 60, 35, 15, 90], // 艮 山：止、靜
  [75, 95, 80, 65, 55, 40], // 離 火：光明、清晰
  [85, 80, 70, 55, 45, 60], // 巽 風：滲透、溝通
  [80, 50, 60, 95, 90, 30], // 乾 天：剛健、主導
]

/** 拉開中段分數：上下卦混合後易擠在 50–65，以 tanh 曲線（中心 55，傾向表的平均）向兩端展開，值域約 2–98 */
const spread = raw => 50 + 48 * Math.tanh(((raw - 55) * 1.8) / 48)

/** 單卦對某事類的分數：內卦（下卦）佔 60%，外卦（上卦）佔 40% */
const hexagramScore = (hexagram, type) => 0.6 * AFFINITY[hexagram.lower][type] + 0.4 * AFFINITY[hexagram.upper][type]

/**
 * @typedef {Object} ActivityScore
 * @property {string} name - 事項名稱
 * @property {number} type - 事類代碼 0–5
 * @property {number} score - 0–100 的整數
 * @property {number} present - 本卦分數（未混合、已展開）
 * @property {number|null} future - 變卦分數（已展開）；無變卦時為 null
 * @property {boolean} friday - 是否套用週五扣分
 * @property {'good'|'fair'|'bad'} level - ≥70 為 good，<40 為 bad，其餘 fair
 */

/**
 * 依卜卦結果為六事評分（規則見 core-spec/README.md「六事評分」）
 * @param {import('./models.js').CastResult} result
 * @param {{ items?: {name: string, type: number}[], date?: Date|null }} [options]
 *   items：要評分的事項，預設 DEFAULT_ITEMS，事項的其他欄位（如 id）原樣帶到結果；date：起卦時間，用於週五規則
 * @returns {ActivityScore[]}
 */
export function scoreActivities(result, { items = DEFAULT_ITEMS, date = null } = {}) {
  const changing = result.lines.filter(l => l.changing).length
  const isFriday = date instanceof Date && date.getDay() === 5

  return items.map(item => {
    const { type } = item
    const present = hexagramScore(result.present, type)
    const future = result.future ? hexagramScore(result.future, type) : null
    let score = spread(future === null ? present : 0.75 * present + 0.25 * future)
    const friday = type === LAUNCH && isFriday
    if (type === LAUNCH) score -= 4 * changing
    if (friday) score -= FRIDAY_PENALTY
    score = Math.max(0, Math.min(100, Math.round(score)))
    return {
      ...item,
      score,
      present: Math.round(spread(present)),
      future: future === null ? null : Math.round(spread(future)),
      friday,
      level: score >= 70 ? 'good' : score < 40 ? 'bad' : 'fair',
    }
  })
}
