'use strict'

/**
 * 在卦象列表中以上下卦三位碼查找對應卦象
 * @param {import('./models.js').Hexagram[]} hexagrams
 * @param {number} upper - 上卦三位碼（0–7）
 * @param {number} lower - 下卦三位碼（0–7）
 * @returns {import('./models.js').Hexagram}
 * @throws {Error} 若找不到對應卦象
 */
export function lookup(hexagrams, upper, lower) {
  const found = hexagrams.find(h => h.upper === upper && h.lower === lower)
  if (!found) {
    throw new Error(`找不到卦象: upper=${upper} lower=${lower}`)
  }
  return found
}

/** 八卦：以三位碼（0–7）為索引 */
export const TRIGRAMS = [
  { name: '坤', image: '地' },
  { name: '震', image: '雷' },
  { name: '坎', image: '水' },
  { name: '兌', image: '澤' },
  { name: '艮', image: '山' },
  { name: '離', image: '火' },
  { name: '巽', image: '風' },
  { name: '乾', image: '天' },
]

/**
 * 卦的全名：上下卦相同為「乾為天」，否則為「上象＋下象＋卦名」（如「天風姤」）
 * @param {import('./models.js').Hexagram} hexagram
 * @returns {string}
 */
export function fullName(hexagram) {
  const up = TRIGRAMS[hexagram.upper]
  const low = TRIGRAMS[hexagram.lower]
  if (hexagram.upper === hexagram.lower) return `${up.name}為${up.image}`
  return `${up.image}${low.image}${hexagram.name}`
}
