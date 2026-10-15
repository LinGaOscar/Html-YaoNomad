'use strict'

/** 我的卦簿（#/book）：統計、成就、準度，以及「問事」範圍設定（#/book/ask 直接捲到問事）；六十四卦圖鑑另有一頁（#/dex） */

import { fullName, TRIGRAMS } from './core/hexagrams.js'
import { castFromLines } from './core/casting.js'
import { scoreCategories } from './core/scoring.js'
import { ACHIEVEMENTS, summarize } from './core/progress.js'
import { ITEMS, TEMPLATES, TRAITS } from './activities.js'
import { esc, cnNum, formatDate, isStale, mount, toast, hw, loadHexagrams, bookRecords, bookSince, resetBook, loadTpls, saveTpls } from './ui.js'

/** 卦的小圖：六爻由下而上 */
export function glyphHTML(hex) {
  const bars = [0, 1, 2, 3, 4, 5].map(i => {
    const yang = i < 3 ? (hex.lower >> i) & 1 : (hex.upper >> (i - 3)) & 1
    return `<i class="${yang ? 'yang' : 'yin'}"></i>`
  })
  return `<span class="glyph" aria-hidden="true">${bars.join('')}</span>`
}

/** 卦的六爻值（無變爻）：7 陽、8 陰 */
const hexValues = hex => [0, 1, 2, 3, 4, 5].map(i => ((i < 3 ? hex.lower >> i : hex.upper >> (i - 3)) & 1 ? 7 : 8))

/** 未遇見的卦：六類傾向以假字模糊顯示，不放真實分數 */
const VEIL = { name: '某某', score: '00' }

/** 圖鑑小窗：卦象組成、一句話；遇見過才顯示六類傾向（未遇見模糊）、白話、卦辭、象曰、職場與最近卦例 */
function dexHTML(hexagrams, h, e) {
  const up = TRIGRAMS[h.upper]
  const low = TRIGRAMS[h.lower]
  const cats = scoreCategories(castFromLines(hexagrams, '', hexValues(h))).map(c => ({ name: c.name, score: c.score }))
  const sorted = [...cats].sort((a, b) => b.score - a.score)
  const chip = (c, cls) => `<span class="dx-chip ${cls}">${c.name} ${c.score}</span>`
  return `
    <header class="dx-head">
      <span class="dx-glyph">${glyphHTML(h)}</span>
      <div>
        <p class="kicker">第${cnNum(h.number)}卦${e ? ` · 遇見 ${e.count} 次` : ' · 尚未遇見'}</p>
        <h2>${esc(fullName(h))}</h2>
        <p class="dx-sub">${esc(up.name)}${esc(up.image)}在上 · ${esc(low.name)}${esc(low.image)}在下</p>
      </div>
      <button class="icon-btn dx-close" type="button" aria-label="關閉">✕</button>
    </header>
    <p class="dx-motto">${esc(h.motto)}</p>
    <p class="dx-compose">外卦${esc(up.name)}為${esc(up.image)}，${TRAITS[h.upper]}；內卦${esc(low.name)}為${esc(low.image)}，${TRAITS[h.lower]}。</p>
    ${e
      ? `<p class="dx-lean">此卦利 ${chip(sorted[0], 'good')}${chip(sorted[1], 'good')} 較弱 ${chip(sorted[5], 'bad')}</p>`
      : `<p class="dx-lean veiled" aria-label="遇見此卦後顯示">此卦利 ${chip(VEIL, 'good')}${chip(VEIL, 'good')} 較弱 ${chip(VEIL, 'bad')}</p>`}
    ${e ? `
    <dl class="dx-text">
      <dt>白話</dt><dd>${esc(h.plain)}</dd>
      <dt>卦辭</dt><dd class="classic">${esc(h.name)}：${esc(h.judgment)}</dd>
      <dt>象曰</dt><dd class="classic">${esc(h.image)}</dd>
      <dt>職場</dt><dd>${esc(h.advice)}</dd>
    </dl>
    <a class="dx-link" href="#/r/${esc(e.latest.id)}">看最近一次卦例（${formatDate(e.latest.time)}）→</a>`
    : '<p class="dx-locked">起卦遇見這一卦後，解鎖六類傾向、白話、卦辭、象曰與職場解讀。</p>'}
    <nav class="dx-nav">
      <button class="text-btn" type="button" data-step="-1">‹ 上一卦</button>
      <button class="text-btn" type="button" data-step="1">下一卦 ›</button>
    </nav>`
}

/** 六十四卦圖鑑區塊：s 為 summarize() 的結果 */
export function dexSectionHTML(hexagrams, s) {
  return `
      <section class="book-sec dex-sec">
        <div class="sec-head"><h2>六十四卦圖鑑</h2><span>${s.collection.size} / 64</span></div>
        <div class="dex">${[...hexagrams].sort((a, b) => a.number - b.number).map(h => {
          const e = s.collection.get(h.number)
          return e
            ? `<button type="button" class="dex-cell on" data-n="${h.number}" aria-label="${esc(fullName(h))}，遇見 ${e.count} 次">
                ${glyphHTML(h)}<span class="dex-name">${esc(fullName(h))}</span>${e.count > 1 ? `<span class="dex-count">×${e.count}</span>` : ''}
              </button>`
            : `<button type="button" class="dex-cell" data-n="${h.number}" aria-label="第${h.number}卦，尚未遇見">${glyphHTML(h)}<span class="dex-name">第${cnNum(h.number)}卦</span></button>`
        }).join('')}</div>
        <p class="fine">點任一卦看解說；遇見過的卦可再看白話、卦辭與最近一次卦例。只計本卦，變卦不算。</p>
        <dialog class="dex-dialog" aria-label="卦象解說"></dialog>
      </section>`
}

/** 六十四卦圖鑑頁（#/dex） */
export async function renderDex(token) {
  const hexagrams = await loadHexagrams()
  if (isStale(token)) return
  const s = summarize(hexagrams, bookRecords())
  const node = mount(`
    <section class="book">
      <div class="topbar"><a href="#/">← 返回首頁</a><a href="#/book">我的卦簿 →</a></div>
      <h1>六十四卦圖鑑</h1>
      ${dexSectionHTML(hexagrams, s)}
    </section>`)
  setupDex(node, hexagrams, s)
}

/** 圖鑑小窗：點格子開啟，可左右翻卦；點背景、✕ 或 Esc 關閉 */
export function setupDex(node, hexagrams, s) {
  const dialog = node.querySelector('.dex-dialog')
  const byNumber = new Map(hexagrams.map(h => [h.number, h]))
  const show = n => {
    dialog.dataset.n = n
    dialog.innerHTML = hw(dexHTML(hexagrams, byNumber.get(n), s.collection.get(n)))
    dialog.scrollTop = 0
    if (!dialog.open) dialog.showModal()
  }
  node.querySelector('.dex').addEventListener('click', ev => {
    const cell = ev.target.closest('[data-n]')
    if (cell) show(Number(cell.dataset.n))
  })
  dialog.addEventListener('click', ev => {
    if (ev.target === dialog || ev.target.closest('.dx-close')) return dialog.close()
    const step = ev.target.closest('[data-step]')
    if (step) show(((Number(dialog.dataset.n) - 1 + Number(step.dataset.step) + 64) % 64) + 1)
    if (ev.target.closest('.dx-link')) dialog.close()
  })
}

export async function renderBook(token, { focusAsk = false } = {}) {
  const records = bookRecords()
  const since = bookSince()
  const hexagrams = await loadHexagrams()
  if (isStale(token)) return
  const s = summarize(hexagrams, records)
  const tpls = loadTpls()
  const acc = s.accuracy
  const pct = (hit, total) => Math.round((hit / total) * 100)

  const node = mount(`
    <section class="book">
      <div class="topbar"><a href="#/">← 返回首頁</a><a href="#/book/ask">問事 →</a></div>
      <h1>我的卦簿</h1>
      <p class="sub">${since ? `自 ${formatDate(since)} 重置後起算。` : '起卦、收集與應驗，都記在這個瀏覽器裡。'}</p>

      <div class="stats">
        <div class="stat"><span class="stat-label">起卦次數</span><b>${s.count}</b><small>次</small></div>
        <div class="stat"><span class="stat-label">連續天數</span><b>${s.streak}</b><small>天 · 最長 ${s.best} 天</small></div>
        <div class="stat"><span class="stat-label">已收集</span><b>${s.collection.size}</b><small>/ 64 卦</small></div>
        <div class="stat"><span class="stat-label">應驗準度</span><b>${acc.rate === null ? '—' : `${pct(acc.hit, acc.total)}%`}</b><small>${acc.total} 項回饋</small></div>
      </div>

      <section class="book-sec">
        <div class="sec-head"><h2>成就</h2><span>${s.unlocked.size} / ${ACHIEVEMENTS.length}</span></div>
        <ul class="badges">${ACHIEVEMENTS.map(a => {
          const on = s.unlocked.has(a.id)
          return `<li class="badge${on ? ' on' : ''}">
            <span class="badge-seal" aria-hidden="true">${a.name.slice(0, 1)}</span>
            <span class="badge-text"><b>${a.name}</b><small>${a.desc}</small></span>
            <span class="sr">${on ? '已解鎖' : '未解鎖'}</span>
          </li>`
        }).join('')}</ul>
      </section>

      <section class="book-sec">
        <div class="sec-head"><h2>應驗準度</h2><span>依主分類 · ${acc.rated} 卦有回饋</span></div>
        ${acc.total
          ? `<ul class="acc-list">${acc.byCat.map(r => {
              const total = r.hit + r.miss
              return `<li${total ? '' : ' class="none"'}>
                <span class="acc-name">${CATEGORIES[r.cat]}</span>
                <span class="acc-bar" aria-hidden="true"><i style="width:${total ? pct(r.hit, total) : 0}%"></i></span>
                <span class="acc-num">${total ? `${pct(r.hit, total)}% · ${r.hit}/${total}` : '尚無回饋'}</span>
              </li>`
            }).join('')}</ul>`
          : '<p class="empty-line">在結果頁的「應驗回饋」勾選準或不準，這裡會依六類統計準度：看看你是分析準，還是時運準。</p>'}
      </section>

      <section class="book-sec ask-sec" id="ask">
        <div class="sec-head"><h2>問事</h2><span>可複選</span></div>
        <p class="fine">選擇起卦時要占問的範圍，所選範圍的事項都會評分。只影響之後的新卦例。</p>
        <div class="tpl-grid" role="group" aria-label="問事範圍">
          ${TEMPLATES.map(t => {
            const on = tpls.includes(t.id)
            return `
            <button class="tpl${on ? ' on' : ''}" type="button" aria-pressed="${on}" data-tpl="${t.id}">
              <b>${t.name}</b>
              <small>${t.sel.map(id => ITEMS[id].name).join('、')}</small>
            </button>`
          }).join('')}
        </div>
      </section>

      <section class="book-sec reset-sec">
        <div class="sec-head"><h2>輪迴（重來）</h2></div>
        <p class="reset-text">前塵既盡，卦簿歸空；今日之卦、往日之例，盡付東流，一切從頭。</p>
        <p class="reset-warn">然天道循環，史未嘗不相似也。重開亦然，慎之。</p>
        <div><button class="btn danger-btn" type="button" data-reset>入輪迴</button></div>
      </section>
    </section>`)

  node.querySelectorAll('[data-tpl]').forEach(b => b.addEventListener('click', () => {
    const id = b.dataset.tpl
    const next = tpls.includes(id) ? tpls.filter(x => x !== id) : [...tpls, id]
    if (!next.length) {
      toast('至少要選一個問事範圍')
      return
    }
    if (!saveTpls(TEMPLATES.map(t => t.id).filter(x => next.includes(x)))) return
    toast(`問事：${TEMPLATES.filter(t => next.includes(t.id)).map(t => t.name).join('＋')}`)
    renderBook(token, { focusAsk: true })
  }))
  if (focusAsk) node.querySelector('#ask').scrollIntoView({ block: 'start' })

  // 頁內二次確認：第一次點擊改為警語，3 秒內再點一次才清空
  const btn = node.querySelector('[data-reset]')
  btn.addEventListener('click', () => {
    if (!btn.classList.contains('armed')) {
      btn.classList.add('armed')
      btn.textContent = hw('史必相似，重開亦然。再點一次')
      setTimeout(() => {
        btn.classList.remove('armed')
        btn.textContent = '入輪迴'
      }, 3000)
      return
    }
    if (resetBook()) {
      toast('已入輪迴，萬象歸零')
      location.hash = '#/'
    }
  })
}
