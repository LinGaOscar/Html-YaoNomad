import { test } from 'node:test'
import assert from 'node:assert/strict'
import { encodeShare, decodeShare } from './share.js'

const time = new Date(2026, 9, 16, 9, 30).getTime()

test('分享碼：預設樣板只帶爻值與日期', () => {
  const code = encodeShare({ values: [9, 8, 7, 6, 7, 7], time })
  assert.strictEqual(code, 'v-987677-20261016')
  const back = decodeShare('#' + code)
  assert.deepStrictEqual(back.values, [9, 8, 7, 6, 7, 7])
  assert.strictEqual(new Date(back.time).getDay(), 5)
  assert.strictEqual(back.sel, null)
})

test('分享碼：帶樣板代號或六個事項代號', () => {
  assert.strictEqual(decodeShare(encodeShare({ values: [7, 7, 7, 8, 8, 8], time, sel: 'student' })).sel, 'student')
  const sel = 'meeting.memo.exam.tidy.trip.nap'
  const code = encodeShare({ values: [7, 7, 7, 8, 8, 8], time, sel })
  assert.match(code, /^[A-Za-z0-9._-]+$/)
  assert.strictEqual(decodeShare('#/' + code).sel, sel)
})

test('分享碼：不合法時回傳 null', () => {
  for (const bad of ['', 'v-98767-20261016', 'v-987675-20261016', 'v-987677-20261340', 'v-987677-20261016-a.b', 'v-987677-20261016-Abc', 'x-987677-20261016']) {
    assert.strictEqual(decodeShare(bad), null, bad)
  }
})

test('分享碼：連續天數大於 1 才帶，且可與事項選擇並存', () => {
  assert.strictEqual(encodeShare({ values: [7, 7, 7, 7, 7, 7], time, streak: 1 }), 'v-777777-20261016')
  const code = encodeShare({ values: [7, 7, 7, 7, 7, 7], time, streak: 3, sel: 'student' })
  assert.strictEqual(code, 'v-777777-20261016-s3-student')
  const back = decodeShare(code)
  assert.deepStrictEqual([back.streak, back.sel], [3, 'student'])
  assert.strictEqual(decodeShare('v-777777-20261016').streak, 0)
})
