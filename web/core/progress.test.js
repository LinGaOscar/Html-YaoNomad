import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { castKind, todayDaily, currentStreak, bestStreak, accuracy, summarize } from './progress.js'

const __dirname = dirname(fileURLToPath(import.meta.url))
const hexagrams = JSON.parse(readFileSync(join(__dirname, '../data/hexagrams.json'), 'utf-8'))

const at = (y, m, d, h = 9) => new Date(y, m - 1, d, h).getTime()
let seq = 0
const rec = (time, extra = {}) => ({ id: `r${seq++}`, time, method: 'coin', values: [7, 7, 7, 7, 7, 7], coins: null, ...extra })

test('castKind：求卦不計入當天次數；今日一卦、再問、再三瀆', () => {
  const s = rec(at(2026, 10, 14, 8), { question: '要不要換工作' })
  const a = rec(at(2026, 10, 14, 9))
  const b = rec(at(2026, 10, 14, 10), { question: '面試順利嗎' })
  const c = rec(at(2026, 10, 14, 11))
  const d = rec(at(2026, 10, 14, 12), { question: '  ' })
  const list = [d, c, b, a, s]
  assert.strictEqual(castKind(list, s), 'seek')
  assert.strictEqual(castKind(list, a), 'daily')
  assert.strictEqual(castKind(list, b), 'seek')
  assert.strictEqual(castKind(list, c), 'again')
  assert.strictEqual(castKind(list, d), 'profane')
  assert.strictEqual(castKind([rec(at(2026, 10, 15)), ...list], list[0]), 'profane')
})

test('todayDaily：取今天最早的一卦，求卦不算', () => {
  const s = rec(at(2026, 10, 14, 8), { question: '要不要換工作' })
  const a = rec(at(2026, 10, 14, 9))
  const b = rec(at(2026, 10, 14, 15))
  assert.strictEqual(todayDaily([b, a, s], at(2026, 10, 14, 20)), a)
  assert.strictEqual(todayDaily([s], at(2026, 10, 14, 20)), null)
  assert.strictEqual(todayDaily([b, a], at(2026, 10, 15, 8)), null)
})

test('連續天數：今天未起卦時從昨天算；最長連續', () => {
  const list = [12, 13, 14, 16].map(d => rec(at(2026, 10, d)))
  assert.strictEqual(currentStreak(list, at(2026, 10, 16, 20)), 1)
  assert.strictEqual(currentStreak(list, at(2026, 10, 17, 8)), 1)
  assert.strictEqual(currentStreak(list, at(2026, 10, 15, 8)), 3)
  assert.strictEqual(currentStreak(list, at(2026, 10, 18, 8)), 0)
  assert.strictEqual(bestStreak(list), 3)
  assert.strictEqual(bestStreak([]), 0)
})

test('accuracy：只計 true/false', () => {
  const list = [
    rec(at(2026, 10, 14), { feedback: [true, false, null, true, undefined, true] }),
    rec(at(2026, 10, 15), { feedback: [false] }),
    rec(at(2026, 10, 16)),
  ]
  const a = accuracy(list)
  assert.deepStrictEqual([a.hit, a.miss, a.total, a.rated], [3, 2, 5, 2])
  assert.strictEqual(a.rate, 0.6)
  assert.deepStrictEqual(a.byName.find(r => r.name === '開會'), { name: '開會', hit: 1, miss: 1 })
})

test('summarize：圖鑑與成就', () => {
  const list = [
    rec(at(2026, 10, 14)), // 乾為天
    rec(at(2026, 10, 14, 10)), // 再問
    rec(at(2026, 10, 14, 11)), // 再三瀆、乾為天第 3 次
    rec(at(2026, 10, 15), { values: [9, 9, 9, 6, 6, 6] }), // 六爻皆動
  ]
  const s = summarize(hexagrams, list, at(2026, 10, 15, 20))
  assert.strictEqual(s.collection.get(1).count, 3)
  assert.strictEqual(s.collection.size, 2)
  for (const id of ['first', 'qian', 'reunion', 'profane', 'allMoving']) assert.ok(s.unlocked.has(id), id)
  for (const id of ['kun', 'streak7', 'half', 'feedback10']) assert.ok(!s.unlocked.has(id), id)
  assert.strictEqual(s.streak, 2)
})

test('summarize：依六類分數解鎖「時運不濟」與「日日是好日」', () => {
  const kan = rec(at(2026, 10, 14), { values: [8, 7, 8, 8, 7, 8] }) // 坎為水，時運類谷底
  const habit = rec(at(2026, 10, 20), { streak: 6 })
  const s = summarize(hexagrams, [kan, habit], at(2026, 10, 20, 20))
  assert.ok(s.unlocked.has('freeze'))
  assert.ok(s.unlocked.has('habit'))
  assert.ok(!s.unlocked.has('weekend'))
})

test('accuracy：依主分類統計', () => {
  const a = accuracy([rec(at(2026, 10, 14), { feedback: [true, false, true] })])
  // 預設事項：開會（溝通）、撰寫報告（分析）、抓BUG（分析）
  assert.deepStrictEqual(a.byCat[0], { cat: 0, hit: 1, miss: 0 })
  assert.deepStrictEqual(a.byCat[1], { cat: 1, hit: 1, miss: 1 })
})
