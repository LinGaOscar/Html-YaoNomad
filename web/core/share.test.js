import { test } from 'node:test'
import assert from 'node:assert/strict'
import { encodeShare, decodeShare } from './share.js'
import { DEFAULT_ITEMS } from './scoring.js'

const time = new Date(2026, 9, 16, 9, 30).getTime()

test('分享碼：預設六事只帶爻值與日期', () => {
  const code = encodeShare({ values: [9, 8, 7, 6, 7, 7], time, items: DEFAULT_ITEMS })
  assert.strictEqual(code, 'v-987677-20261016')
  assert.match(code, /^[A-Za-z0-9_-]+$/)
  const back = decodeShare('#' + code)
  assert.deepStrictEqual(back.values, [9, 8, 7, 6, 7, 7])
  assert.strictEqual(new Date(back.time).getDay(), 5)
  assert.strictEqual(back.items, null)
})

test('分享碼：自訂事項以 base64url 帶中文名稱', () => {
  const items = [['讀書', 1], ['跑步', 4], ['開會', 0], ['寫 code', 3], ['追劇', 5], ['debug', 2]].map(([name, type]) => ({ name, type }))
  const code = encodeShare({ values: [7, 7, 7, 8, 8, 8], time, items })
  assert.match(code, /^[A-Za-z0-9_-]+$/)
  assert.deepStrictEqual(decodeShare(code).items, items)
  assert.deepStrictEqual(decodeShare('#/' + code).items, items)
})

test('分享碼：不合法時回傳 null', () => {
  for (const bad of ['', 'v-98767-20261016', 'v-987675-20261016', 'v-987677-20261340', 'v-987677-20261016-@@', 'x-987677-20261016']) {
    assert.strictEqual(decodeShare(bad), null, bad)
  }
})
