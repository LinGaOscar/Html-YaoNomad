'use strict'

import { lookup } from './hexagrams.js'

/**
 * 執行一次三硬幣卜卦
 * @param {import('./models.js').Hexagram[]} hexagrams - 預先載入的 64 卦資料
 * @param {string} question - 使用者問題
 * @param {() => number} [coinFn] - 回傳 2 或 3 的函式；預設以 Math.random 模擬
 * @returns {import('./models.js').CastResult}
 */
export function castHexagram(hexagrams, question, coinFn = () => (Math.random() < 0.5 ? 2 : 3)) {
  const values = []
  for (let i = 0; i < 6; i++) {
    values.push(coinFn() + coinFn() + coinFn())
  }
  return castFromLines(hexagrams, question, values)
}

/**
 * 由六個爻值（6–9，index 0 = 初爻）直接成卦；供手動輸入六爻與重開歷史紀錄使用
 * @param {import('./models.js').Hexagram[]} hexagrams
 * @param {string} question
 * @param {number[]} values - 六個爻值
 * @returns {import('./models.js').CastResult}
 * @throws {Error} 若爻值數量不是 6 或不在 6–9
 */
export function castFromLines(hexagrams, question, values) {
  if (values.length !== 6 || values.some(v => ![6, 7, 8, 9].includes(v))) {
    throw new Error(`爻值須為 6 個 6–9 的整數: ${values}`)
  }
  const lines = values.map(sum => ({
    value: sum,
    yin: sum % 2 === 0,
    changing: sum === 6 || sum === 9,
  }))

  const lower = trigramCode(lines.slice(0, 3))
  const upper = trigramCode(lines.slice(3, 6))
  const present = lookup(hexagrams, upper, lower)

  const future = lines.some(l => l.changing)
    ? computeFuture(hexagrams, lines)
    : null

  return { question, lines, present, future }
}

/**
 * 計算三條爻的 trigram 三位碼（bit0 = 底爻，yang=1，yin=0）
 * @param {import('./models.js').Line[]} threeLines
 * @returns {number}
 */
function trigramCode(threeLines) {
  return threeLines.reduce((code, line, i) => {
    const yang = line.yin ? 0 : 1
    return code | (yang << i)
  }, 0)
}

/**
 * 計算變卦（將變爻的陰陽反轉後查卦）
 * @param {import('./models.js').Hexagram[]} hexagrams
 * @param {import('./models.js').Line[]} lines
 * @returns {import('./models.js').Hexagram}
 */
function computeFuture(hexagrams, lines) {
  const futureLines = lines.map(l => ({
    value: l.value,
    yin: l.changing ? !l.yin : l.yin,
    changing: l.changing,
  }))
  const lower = trigramCode(futureLines.slice(0, 3))
  const upper = trigramCode(futureLines.slice(3, 6))
  return lookup(hexagrams, upper, lower)
}
