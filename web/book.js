'use strict'

/** 我的卦簿（#/book）與自訂六事（#/settings） */

import { fullName } from './core/hexagrams.js'
import { ACTIVITIES, TYPES } from './core/scoring.js'
import { ACHIEVEMENTS, summarize } from './core/progress.js'
import { esc, cnNum, isStale, mount, toast, loadHexagrams, loadHistory, loadItems, saveItems, isDefaultItems } from './ui.js'

/** 卦的小圖：六爻由下而上 */
export function glyphHTML(hex) {
  const bars = [0, 1, 2, 3, 4, 5].map(i => {
    const yang = i < 3 ? (hex.lower >> i) & 1 : (hex.upper >> (i - 3)) & 1
    return `<i class="${yang ? 'yang' : 'yin'}"></i>`
  })
  return `<span class="glyph" aria-hidden="true">${bars.join('')}</span>`
}

const TYPE_EXAMPLES = ['開會、面談、談判、約會', '報告、文件、筆記、寫信', '除錯、研究、對帳、考試', '開發、裝修、做菜、學新技能', '上線、出發、投履歷、做決定', '餵魚、澆花、運動、休息']

export async function renderBook(token) {
  const records = loadHistory()
  const hexagrams = await loadHexagrams()
  if (isStale(token)) return
  const s = summarize(hexagrams, records)
  const acc = s.accuracy
  const pct = (hit, total) => Math.round((hit / total) * 100)

  mount(`
    <section class="book">
      <div class="topbar"><a href="#/">← 返回首頁</a><a href="#/settings">自訂六事 →</a></div>
      <h1>我的卦簿</h1>
      <p class="sub">起卦、收集與應驗，都記在這個瀏覽器裡。</p>

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
        <div class="sec-head"><h2>應驗準度</h2><span>${acc.rated} 卦有回饋</span></div>
        ${acc.total
          ? `<ul class="acc-list">${acc.byName.map(r => {
              const total = r.hit + r.miss
              return `<li>
                <span class="acc-name">${esc(r.name)}</span>
                <span class="acc-bar" aria-hidden="true"><i style="width:${pct(r.hit, total)}%"></i></span>
                <span class="acc-num">${pct(r.hit, total)}% · ${r.hit}/${total}</span>
              </li>`
            }).join('')}</ul>`
          : '<p class="empty-line">在結果頁的「應驗回饋」勾選準或不準，這裡會統計每件事的準度。</p>'}
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
    </section>`)
}

export function renderSettings() {
  const items = loadItems()
  const node = mount(`
    <section class="settings">
      <div class="topbar"><a href="#/">← 返回首頁</a><a href="#/book">我的卦簿 →</a></div>
      <h1>自訂六事</h1>
      <p class="sub">換成你自己在意的六件事。每件事選一種事類，評分沿用該事類的八卦傾向。</p>
      <form class="items-form" novalidate>
        ${items.map((it, i) => `
          <div class="item-row">
            <span class="item-no" aria-hidden="true">${'一二三四五六'[i]}</span>
            <label class="sr" for="item-name-${i}">第 ${i + 1} 件事的名稱</label>
            <input id="item-name-${i}" name="name${i}" maxlength="8" value="${esc(it.name)}" autocomplete="off">
            <label class="sr" for="item-type-${i}">第 ${i + 1} 件事的事類</label>
            <select id="item-type-${i}" name="type${i}">${TYPES.map((t, k) =>
              `<option value="${k}"${it.type === k ? ' selected' : ''}>${t}類（如：${ACTIVITIES[k]}）</option>`).join('')}
            </select>
          </div>`).join('')}
        <p class="form-error" role="alert" hidden></p>
        <div class="form-actions">
          <button class="btn primary" type="submit">儲存六事</button>
          <button class="btn" type="button" data-reset>還原預設</button>
        </div>
      </form>
      <section class="card type-guide">
        <h2>事類說明</h2>
        <dl>${TYPES.map((t, k) => `<div><dt>${t}</dt><dd>${TYPE_EXAMPLES[k]}</dd></div>`).join('')}</dl>
      </section>
      <p class="fine">只影響之後的新卦例，舊卦例保留當時的六事。自訂事項沒有專屬小故事，展開時改顯示事類建議；發布類同樣適用「週五不部署」。</p>
    </section>`)

  const form = node.querySelector('.items-form')
  const error = form.querySelector('.form-error')
  form.addEventListener('submit', e => {
    e.preventDefault()
    const data = new FormData(form)
    const next = [0, 1, 2, 3, 4, 5].map(i => ({ name: String(data.get(`name${i}`)).trim(), type: Number(data.get(`type${i}`)) }))
    const empty = next.findIndex(it => !it.name)
    if (empty >= 0) {
      error.textContent = `第 ${empty + 1} 件事還沒有名稱。`
      error.hidden = false
      form.querySelector(`#item-name-${empty}`).focus()
      return
    }
    if (saveItems(isDefaultItems(next) ? null : next)) {
      toast('已儲存六事')
      location.hash = '#/'
    }
  })
  form.querySelector('[data-reset]').addEventListener('click', () => {
    if (saveItems(null)) {
      toast('已還原預設六事')
      renderSettings()
    }
  })
}
