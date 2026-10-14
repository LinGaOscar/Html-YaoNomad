'use strict'

/** 六事，順序即評分陣列順序 */
export const ACTIVITIES = ['開會', '撰寫報告', '抓BUG', '系統開發', '程式上線', '餵魚/澆花']

/**
 * 八卦對六事的基礎傾向（0–100），以三位碼為索引，欄位順序同 ACTIVITIES
 * 例：坎為險、為深 → 抓BUG 高、程式上線低；離為明 → 撰寫報告高
 */
const AFFINITY = [
  [40, 85, 55, 45, 20, 95], // 坤 地：承載、順從
  [50, 30, 70, 90, 65, 40], // 震 雷：發動、開創
  [25, 50, 95, 45, 10, 55], // 坎 水：險陷、深入
  [95, 45, 35, 40, 50, 85], // 兌 澤：喜悅、言說
  [30, 75, 60, 35, 15, 90], // 艮 山：止、靜
  [75, 95, 80, 65, 55, 40], // 離 火：光明、清晰
  [85, 80, 70, 55, 45, 60], // 巽 風：滲透、溝通
  [80, 50, 60, 95, 90, 30], // 乾 天：剛健、主導
]

const LAUNCH = ACTIVITIES.indexOf('程式上線')

/** 拉開中段分數：上下卦混合後易擠在 50–65，以 tanh 曲線（中心 55，六事傾向表的平均）向兩端展開，值域約 2–98 */
const spread = raw => 50 + 48 * Math.tanh(((raw - 55) * 1.8) / 48)

/** 單卦分數：內卦（下卦）佔 60%，外卦（上卦）佔 40% */
function hexagramScores(hexagram) {
  return ACTIVITIES.map((_, i) => 0.6 * AFFINITY[hexagram.lower][i] + 0.4 * AFFINITY[hexagram.upper][i])
}

/**
 * @typedef {Object} ActivityScore
 * @property {string} name - 活動名稱
 * @property {number} score - 0–100 的整數
 * @property {number} present - 本卦分數（未混合、已展開）
 * @property {number|null} future - 變卦分數（已展開）；無變卦時為 null
 * @property {'good'|'fair'|'bad'} level - ≥70 為 good，<40 為 bad，其餘 fair
 */

/**
 * 依卜卦結果為六事評分
 * 原始分 = 無變卦時為本卦分數，有變卦時為本卦 75% + 變卦 25%；
 * 分數 = spread(原始分)，每個變爻再使「程式上線」扣 4 分，最後四捨五入並限制在 0–100
 * @param {import('./models.js').CastResult} result
 * @returns {ActivityScore[]}
 */
export function scoreActivities(result) {
  const present = hexagramScores(result.present)
  const future = result.future ? hexagramScores(result.future) : null
  const changing = result.lines.filter(l => l.changing).length

  return ACTIVITIES.map((name, i) => {
    let score = spread(future ? 0.75 * present[i] + 0.25 * future[i] : present[i])
    if (i === LAUNCH) score -= 4 * changing
    score = Math.max(0, Math.min(100, Math.round(score)))
    return {
      name,
      score,
      present: Math.round(spread(present[i])),
      future: future ? Math.round(spread(future[i])) : null,
      level: score >= 70 ? 'good' : score < 40 ? 'bad' : 'fair',
    }
  })
}
