'use strict'

/** 我的卦簿（#/book）與自訂六事（#/settings） */

import { fullName } from './core/hexagrams.js'
import { CATEGORIES } from './core/scoring.js'
import { ACHIEVEMENTS, summarize } from './core/progress.js'
import { ITEMS, TEMPLATES, templateOf } from './activities.js'
import { esc, cnNum, formatDate, isStale, mount, toast, hw, loadHexagrams, bookRecords, bookSince, resetBook, loadSel, saveSel } from './ui.js'

/** 卦的小圖：六爻由下而上 */
export function glyphHTML(hex) {
  const bars = [0, 1, 2, 3, 4, 5].map(i => {
    const yang = i < 3 ? (hex.lower >> i) & 1 : (hex.upper >> (i - 3)) & 1
    return `<i class="${yang ? 'yang' : 'yin'}"></i>`
  })
  return `<span class="glyph" aria-hidden="true">${bars.join('')}</span>`
}

export async function renderBook(token) {
  const records = bookRecords()
  const since = bookSince()
  const hexagrams = await loadHexagrams()
  if (isStale(token)) return
  const s = summarize(hexagrams, records)
  const acc = s.accuracy
  const pct = (hit, total) => Math.round((hit / total) * 100)

  const node = mount(`
    <section class="book">
      <div class="topbar"><a href="#/">← 返回首頁</a><a href="#/settings">六事樣板 →</a></div>
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

      <section class="book-sec reset-sec">
        <div class="sec-head"><h2>重新開始</h2></div>
        <p class="fine">重置後，收集、成就、連續天數與準度都從零開始；歷史紀錄會保留。</p>
        <div><button class="btn danger-btn" type="button" data-reset>重置卦簿</button></div>
      </section>
    </section>`)

  // 頁內二次確認：第一次點擊改為「確定重置？」，3 秒內再點一次才重置
  const btn = node.querySelector('[data-reset]')
  btn.addEventListener('click', () => {
    if (!btn.classList.contains('armed')) {
      btn.classList.add('armed')
      btn.textContent = hw('確定重置？再點一次')
      setTimeout(() => {
        btn.classList.remove('armed')
        btn.textContent = '重置卦簿'
      }, 3000)
      return
    }
    if (resetBook()) {
      toast('卦簿已重置，從今天重新開始')
      renderBook(token)
    }
  })
}

export function renderSettings(focusId = null) {
  const sel = loadSel()
  const current = templateOf(sel)
  const node = mount(`
    <section class="settings">
      <div class="topbar"><a href="#/">← 返回首頁</a><a href="#/book">我的卦簿 →</a></div>
      <h1>六事樣板</h1>
      <p class="sub">選一個樣板，或在下方逐項替換。每個事項都有專屬的提醒與小故事。</p>

      <div class="tpl-grid" role="radiogroup" aria-label="樣板">
        ${TEMPLATES.map(t => `
          <button class="tpl${t === current ? ' on' : ''}" type="button" role="radio" aria-checked="${t === current}" data-tpl="${t.id}">
            <b>${t.name}</b>
            <small>${t.sel.map(id => ITEMS[id].name).join('、')}</small>
          </button>`).join('')}
      </div>

      <section class="book-sec">
        <div class="sec-head"><h2>逐項替換</h2><span>目前：${current ? `${current.name}樣板` : '自訂組合'}</span></div>
        <div class="slots">
          ${sel.map((cur, i) => `
            <div class="slot">
              <label for="slot-${i}">第${'一二三四五六'[i]}事</label>
              <select id="slot-${i}" data-i="${i}">${CATEGORIES.map((cat, c) => `
                <optgroup label="${cat}類為主">${Object.entries(ITEMS).filter(([, it]) => it.cats[0] === c).map(([id, it]) =>
                  `<option value="${id}"${cur === id ? ' selected' : ''}>${it.name}（${cat}・${CATEGORIES[it.cats[1]]}）</option>`).join('')}
                </optgroup>`).join('')}
              </select>
            </div>`).join('')}
        </div>
      </section>
      <p class="fine">括號內為主分類・副分類。選到已在其他格的事項時，兩格會對調。更換後只影響之後的新卦例，舊卦例保留當時的六事。</p>
    </section>`)

  const apply = (next, msg, focusId) => {
    if (!saveSel(next)) return
    toast(msg)
    renderSettings(focusId)
  }
  if (focusId) document.getElementById(focusId)?.focus()
  node.querySelectorAll('[data-tpl]').forEach(b => b.addEventListener('click', () => {
    const t = TEMPLATES.find(x => x.id === b.dataset.tpl)
    apply(t.sel, `已套用${t.name}樣板`, null)
  }))
  node.querySelectorAll('.slot select').forEach(el => el.addEventListener('change', () => {
    const i = Number(el.dataset.i)
    const next = [...sel]
    const j = next.indexOf(el.value)
    if (j >= 0) next[j] = next[i] // 已在其他格：兩格對調
    next[i] = el.value
    apply(next, j >= 0 ? `已與第${'一二三四五六'[j]}事對調` : `已換成${ITEMS[el.value].name}`, el.id)
  }))
}
