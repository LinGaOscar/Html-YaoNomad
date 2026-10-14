import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { castFromLines } from './casting.js'
import { fullName } from './hexagrams.js'
import { CATEGORIES, DEFAULT_ITEMS, COMM, ANALYZE, CREATE, ROUTINE, FORTUNE, REST, scoreCategories, scoreActivities } from './scoring.js'

const __dirname = dirname(fileURLToPath(import.meta.url))
const hexagrams = JSON.parse(readFileSync(join(__dirname, '../data/hexagrams.json'), 'utf-8'))
const cast = values => castFromLines(hexagrams, '', values)
const QIAN = [7, 7, 7, 7, 7, 7]
const day = d => new Date(2026, 9, d, 9) // 2026/10/12 週一 … 10/18 週日

test('fullName：重卦為「乾為天」，其餘為上象下象＋卦名', () => {
  const byNo = n => hexagrams.find(h => h.number === n)
  assert.strictEqual(fullName(byNo(1)), '乾為天')
  assert.strictEqual(fullName(byNo(2)), '坤為地')
  assert.strictEqual(fullName(byNo(44)), '天風姤')
  assert.strictEqual(fullName(byNo(9)), '風天小畜')
  assert.strictEqual(fullName(byNo(54)), '雷澤歸妹')
})

test('scoreCategories：六類皆為 0–100 整數', () => {
  for (const values of [QIAN, [6, 8, 9, 7, 6, 9], [9, 9, 9, 9, 9, 9], [8, 7, 8, 8, 7, 8]]) {
    const cats = scoreCategories(cast(values), { date: day(16), streak: 9 })
    assert.deepStrictEqual(cats.map(c => c.name), CATEGORIES)
    for (const c of cats) assert.ok(Number.isInteger(c.score) && c.score >= 0 && c.score <= 100, `${c.name} ${c.score}`)
  }
})

test('scoreCategories：乾為天、無規則日（依規格手算）', () => {
  const c = scoreCategories(cast(QIAN))
  // 溝通 spread(65, 1.8) = 67.2；分析 67.2 + 靜爻 8；時運 spread(95, 2.6) = 96.8
  assert.strictEqual(c[COMM].score, 67)
  assert.strictEqual(c[ANALYZE].score, 75)
  assert.deepStrictEqual(c[ANALYZE].rules, [{ rule: 'calm', delta: 8 }])
  assert.strictEqual(c[FORTUNE].score, 97)
  assert.strictEqual(c[FORTUNE].future, null)
})

test('scoreCategories：坎為水的時運類跌到谷底', () => {
  assert.ok(scoreCategories(cast([8, 7, 8, 8, 7, 8]))[FORTUNE].score < 10)
})

test('專屬規則：週一溝通 −10、週五時運 −15、週末休養 +10', () => {
  const base = scoreCategories(cast([8, 8, 8, 8, 8, 8]), { date: day(14) }) // 週三
  const mon = scoreCategories(cast([8, 8, 8, 8, 8, 8]), { date: day(12) })
  const fri = scoreCategories(cast([8, 8, 8, 8, 8, 8]), { date: day(16) })
  const sun = scoreCategories(cast([8, 8, 8, 8, 8, 8]), { date: day(18) })
  assert.strictEqual(mon[COMM].score, base[COMM].score - 10)
  assert.strictEqual(fri[FORTUNE].score, base[FORTUNE].score - 15)
  assert.strictEqual(sun[REST].score, Math.min(100, base[REST].score + 10))
  assert.deepStrictEqual(fri.map(c => c.score).filter((_, i) => i !== FORTUNE), base.map(c => c.score).filter((_, i) => i !== FORTUNE))
})

test('專屬規則：創意每個變爻 +4（上限 16）、分析只在六爻皆靜時加分', () => {
  const one = scoreCategories(cast([9, 7, 7, 7, 7, 7]))
  assert.deepStrictEqual(one[CREATE].rules, [{ rule: 'change', delta: 4 }])
  assert.deepStrictEqual(one[ANALYZE].rules, [])
  const all = scoreCategories(cast([9, 9, 9, 9, 9, 9]))
  assert.deepStrictEqual(all[CREATE].rules, [{ rule: 'change', delta: 16 }])
})

test('專屬規則：例行類連續天數每天 +2，第 6 天達上限 +10', () => {
  const at = streak => scoreCategories(cast(QIAN), { streak })[ROUTINE]
  assert.deepStrictEqual(at(1).rules, [])
  assert.strictEqual(at(4).score, at(1).score + 6)
  assert.strictEqual(at(6).score, at(1).score + 10)
  assert.strictEqual(at(30).score, at(1).score + 10)
})

test('scoreActivities：主分類 70% + 副分類 30%，規則依權重列出', () => {
  const r = cast(QIAN)
  const c = scoreCategories(r, { date: day(16) })
  const s = scoreActivities(r, { categories: c })
  const deploy = s.find(x => x.id === 'deploy') // 時運＋例行
  assert.strictEqual(deploy.score, Math.round(0.7 * c[FORTUNE].score + 0.3 * c[ROUTINE].score))
  assert.deepStrictEqual(deploy.rules, [{ rule: 'friday', delta: -15, cat: FORTUNE, weight: 0.7 }])
  assert.deepStrictEqual(s.map(x => x.name), DEFAULT_ITEMS.map(x => x.name))
  for (const x of s) assert.strictEqual(x.level, x.score >= 70 ? 'good' : x.score < 40 ? 'bad' : 'fair')
})

test('scoreActivities：事項的其他欄位原樣帶到結果；只有主分類時權重為 1', () => {
  const [s] = scoreActivities(cast(QIAN), { items: [{ id: 'exam', name: '考試', cats: [ANALYZE] }] })
  assert.deepStrictEqual([s.id, s.name], ['exam', '考試'])
  assert.deepStrictEqual(s.rules, [{ rule: 'calm', delta: 8, cat: ANALYZE, weight: 1 }])
})

test('castFromLines：爻值不合法時丟出錯誤', () => {
  assert.throws(() => castFromLines(hexagrams, '', [7, 7, 7]))
  assert.throws(() => castFromLines(hexagrams, '', [5, 7, 7, 7, 7, 7]))
})
