'use strict'

/** 我的卦簿（#/book）：統計、成就、準度、圖鑑，以及「問事」範圍設定（#/book/ask 直接捲到問事） */

import { fullName } from './core/hexagrams.js'
import { ACHIEVEMENTS, summarize } from './core/progress.js'
import { ITEMS, TEMPLATES } from './activities.js'
import { esc, cnNum, formatDate, isStale, mount, toast, hw, loadHexagrams, bookRecords, bookSince, resetBook, loadTpls, saveTpls } from './ui.js'

/** 卦的小圖：六爻由下而上 */
export function glyphHTML(hex) {
  const bars = [0, 1, 2, 3, 4, 5].map(i => {
    const yang = i < 3 ? (hex.lower >> i) & 1 : (hex.upper >> (i - 3)) & 1
    return `<i class="${yang ? 'yang' : 'yin'}"></i>`
  })
  return `<span class="glyph" aria-hidden="true">${bars.join('')}</span>`
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

      <section class="book-sec">
        <div class="sec-head"><h2>六十四卦圖鑑</h2><span>${s.collection.size} / 64</span></div>
        <div class="dex">${[...hexagrams].sort((a, b) => a.number - b.number).map(h => {
          const e = s.collection.get(h.number)
          return e
            ? `<a class="dex-cell on" href="#/r/${esc(e.latest.id)}" aria-label="${esc(fullName(h))}，遇見 ${e.count} 次">
                ${glyphHTML(h)}<span class="dex-name">${esc(fullName(h))}</span>${e.count > 1 ? `<span class="dex-count">×${e.count}</span>` : ''}
              </a>`
            : `<span class="dex-cell" aria-label="第${h.number}卦，尚未遇見">${glyphHTML(h)}<span class="dex-name">第${cnNum(h.number)}卦</span></span>`
        }).join('')}</div>
        <p class="fine">點亮的卦可以點開最近一次的卦例。只計本卦，變卦不算。</p>
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
        <div class="sec-head"><h2>輪迴</h2></div>
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
