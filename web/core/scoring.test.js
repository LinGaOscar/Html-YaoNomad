import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { castFromLines } from './casting.js'
import { fullName } from './hexagrams.js'
import { ACTIVITIES, scoreActivities } from './scoring.js'

const __dirname = dirname(fileURLToPath(import.meta.url))
const hexagrams = JSON.parse(readFileSync(join(__dirname, '../data/hexagrams.json'), 'utf-8'))

test('fullName：重卦為「乾為天」，其餘為上象下象＋卦名', () => {
  const byNo = n => hexagrams.find(h => h.number === n)
  assert.strictEqual(fullName(byNo(1)), '乾為天')
  assert.strictEqual(fullName(byNo(2)), '坤為地')
  assert.strictEqual(fullName(byNo(44)), '天風姤')
  assert.strictEqual(fullName(byNo(9)), '風天小畜')
  assert.strictEqual(fullName(byNo(54)), '雷澤歸妹')
})

test('scoreActivities：六事皆為 0–100 整數且 level 與分數一致', () => {
  for (const values of [[7, 7, 7, 7, 7, 7], [6, 8, 9, 7, 6, 9], [9, 9, 9, 9, 9, 9]]) {
    const scores = scoreActivities(castFromLines(hexagrams, '', values))
    assert.deepStrictEqual(scores.map(s => s.name), ACTIVITIES)
    for (const s of scores) {
      assert.ok(Number.isInteger(s.score) && s.score >= 0 && s.score <= 100)
      const level = s.score >= 70 ? 'good' : s.score < 40 ? 'bad' : 'fair'
      assert.strictEqual(s.level, level)
    }
  }
})

test('scoreActivities：無變爻時 future 為 null，分數等於本卦分數', () => {
  const scores = scoreActivities(castFromLines(hexagrams, '', [7, 7, 7, 7, 7, 7]))
  for (const s of scores) {
    assert.strictEqual(s.future, null)
    assert.strictEqual(s.score, s.present)
  }
  // 乾為天：開會原始 80 → spread 85；程式上線原始 90 → 92
  assert.strictEqual(scores[0].score, 85)
  assert.strictEqual(scores[4].score, 92)
})

test('scoreActivities：變爻越多，程式上線分數越低', () => {
  const calm = scoreActivities(castFromLines(hexagrams, '', [7, 7, 7, 7, 7, 7]))[4].score
  const moving = scoreActivities(castFromLines(hexagrams, '', [9, 7, 7, 7, 7, 7]))[4]
  // 乾之姤：原始 0.75×90 + 0.25×(0.6×45 + 0.4×90) = 83.25 → spread 87.7 − 4 = 84
  assert.strictEqual(moving.score, 84)
  assert.ok(moving.score < calm)
})

test('scoreActivities：分數有足夠分布，64 卦中有「上佳」也有「不宜」', () => {
  const levels = new Set()
  for (let n = 0; n < 64; n++) {
    const values = [0, 1, 2, 3, 4, 5].map(b => ((n >> b) & 1 ? 7 : 8))
    for (const s of scoreActivities(castFromLines(hexagrams, '', values))) levels.add(s.level)
  }
  assert.deepStrictEqual([...levels].sort(), ['bad', 'fair', 'good'])
})

test('castFromLines：爻值不合法時丟出錯誤', () => {
  assert.throws(() => castFromLines(hexagrams, '', [7, 7, 7]))
  assert.throws(() => castFromLines(hexagrams, '', [5, 7, 7, 7, 7, 7]))
})
