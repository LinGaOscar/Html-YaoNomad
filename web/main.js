'use strict'

/** 路由與首頁、起卦動畫、歷史紀錄；結果頁見 result.js，卦簿與自訂六事見 book.js */

import { castHexagram } from './core/casting.js'
import { fullName } from './core/hexagrams.js'
import { ACHIEVEMENTS, castKind, dayKey, evaluate, summarize, todayDaily } from './core/progress.js'
import { initInk, setInkMode, inkBurst, refreshColor } from './ink.js'
import { renderResult, renderShared } from './result.js'
import { renderBook, renderSettings, glyphHTML } from './book.js'
import {
  VERSION, LINE_POS, LINE_KIND, COIN_FACE, KIND_LABEL, methodName, loadHexagrams, hw, esc, formatDay, formatTime, sleep,
  nextToken, isStale, mount, toast, loadHistory, saveHistory, addRecord, loadItems, unlockedNow, announceUnlocks,
} from './ui.js'

const THEME_KEY = 'yaonomad.theme'
const DAY = 86400000

/** 首頁輸入的問題，交給起卦畫面使用 */
let pendingQuestion = ''

// ---------- 路由 ----------

async function route() {
  const token = nextToken()
  const hash = location.hash.replace(/^#/, '') || '/'
  setInkMode('calm')
  try {
    if (/^\/?v-/.test(hash)) return await renderShared(token, hash)
    if (hash === '/cast') return await renderCasting(token)
    if (hash === '/history') return await renderHistory(token)
    if (hash === '/book') return await renderBook(token)
    if (hash === '/settings') return renderSettings()
    const m = hash.match(/^\/r\/([\w-]+)(\/fb)?$/)
    if (m) return await renderResult(token, m[1], { focusFeedback: Boolean(m[2]) })
    await renderHome(token)
  } catch (err) {
    console.error(err)
    mount(`<section class="empty"><p>卦象資料載入失敗，請確認網路或重新整理。</p>
      <a class="btn" href="#/">返回首頁</a></section>`)
  }
}

// ---------- 首頁 ----------

/** 最近一個過去日子（7 天內）的第一卦，若還沒回饋就提醒 */
function feedbackNudge(history, now) {
  const today = dayKey(now)
  const past = history.find(r => dayKey(r.time) !== today && now - r.time < 7 * DAY)
  if (!past) return null
  const rec = todayDaily(history, past.time)
  if (!rec || (rec.feedback || []).some(v => typeof v === 'boolean')) return null
  const when = dayKey(rec.time) === dayKey(now - DAY) ? '昨天' : formatDay(new Date(rec.time)).replace(/（.*/, '')
  return { rec, when }
}

async function renderHome(token) {
  const history = loadHistory()
  const items = loadItems()
  const now = Date.now()
  const hexagrams = history.length ? await loadHexagrams() : null
  if (isStale(token)) return

  const daily = todayDaily(history, now)
  const dailyEv = daily ? evaluate(hexagrams, daily) : null
  const stats = hexagrams ? summarize(hexagrams, history, now) : null
  const nudge = hexagrams ? feedbackNudge(history, now) : null
  const nudgeEv = nudge ? evaluate(hexagrams, nudge.rec) : null
  const sep = '<span class="sep"> · </span>'
  const names = items.map(it => esc(it.name))

  const node = mount(`
    <section class="home">
      <div class="meta-row"><span>周易 · 六十四卦</span><span>${formatDay(new Date(now))}${stats?.streak ? ` · 連續 ${stats.streak} 天` : ''}</span></div>
      ${nudgeEv ? `
      <a class="nudge" href="#/r/${esc(nudge.rec.id)}/fb">
        <span class="nudge-seal" aria-hidden="true">驗</span>
        <span>${nudge.when}的「${esc(fullName(nudgeEv.result.present))}」準嗎？回來勾一下 →</span>
      </a>` : ''}
      <div class="home-grid">
        <div class="hero">
          <div class="seal" aria-hidden="true">易</div>
          <p class="kicker">靜心一念</p>
          <h1>觀卦知時，從容行事。</h1>
          <p class="lead">一卦觀六事，為當下理清方向。</p>
          <form class="ask" autocomplete="off">
            <label class="sr" for="question">心中所問</label>
            <input id="question" name="q" maxlength="40" placeholder="心中所問（可留白）">
            ${daily ? '<button class="btn ask-btn" type="submit">再起一卦</button>' : ''}
          </form>
          <p class="ask-hint">${daily
            ? '今天已起過卦。換個問題是「另問」，同一個問題再問，易經會念你。'
            : '選填。寫下想問的事，或留白直接看今日六事。'}</p>
        </div>
        <nav class="actions">
          ${dailyEv ? `
          <a class="action primary corner today" href="#/r/${esc(daily.id)}">
            <span class="action-icon today-glyph">${glyphHTML(dailyEv.result.present)}</span>
            <span><span class="action-kicker">今日一卦</span><span class="action-title">${esc(fullName(dailyEv.result.present))}</span>
              <span class="action-sub">${esc(dailyEv.result.present.motto)}</span></span>
            <span class="action-arrow" aria-hidden="true">→</span>
          </a>` : `
          <a class="action primary corner" href="#/cast" data-cast>
            <svg class="action-icon" viewBox="0 0 48 48" aria-hidden="true"><g fill="none" stroke="currentColor" stroke-width="2">
              <circle cx="24" cy="17" r="10"/><circle cx="16.5" cy="29" r="10"/><circle cx="31.5" cy="29" r="10"/>
              <rect x="21" y="14" width="6" height="6"/></g></svg>
            <span><span class="action-title">開始卜卦</span><span class="action-sub">起今日一卦 · 一次評分六件事</span></span>
            <span class="action-arrow" aria-hidden="true">→</span>
          </a>`}
          <a class="action corner" href="#/history">
            <svg class="action-icon" viewBox="0 0 48 48" aria-hidden="true"><g fill="none" stroke="currentColor" stroke-width="2">
              <path d="M14 10h18l6 6v24H14z"/><path d="M10 14v30h24"/><path d="M20 22h12M20 28h12M20 34h8"/></g></svg>
            <span><span class="action-title">歷史紀錄</span>
              <span class="action-sub">${history.length ? `已有 ${history.length} 則卦例，重讀當時的提醒` : '尚無卦例，起卦後自動保存'}</span></span>
            <span class="action-arrow" aria-hidden="true">→</span>
          </a>
          <a class="action corner" href="#/book">
            <svg class="action-icon" viewBox="0 0 48 48" aria-hidden="true"><g fill="none" stroke="currentColor" stroke-width="2">
              <rect x="10" y="8" width="28" height="32" rx="2"/><path d="M16 8v32"/><circle cx="27" cy="22" r="5"/><path d="M24 26l-2 7 5-3 5 3-2-7"/></g></svg>
            <span><span class="action-title">我的卦簿</span>
              <span class="action-sub">${stats
                ? `已收集 ${stats.collection.size}/64 卦 · 成就 ${stats.unlocked.size}/${ACHIEVEMENTS.length}`
                : '收集六十四卦、解鎖成就、統計準度'}</span></span>
            <span class="action-arrow" aria-hidden="true">→</span>
          </a>
        </nav>
      </div>
      <p class="six">${names.slice(0, 3).join(sep)}<span class="br"></span>${sep}${names.slice(3).join(sep)}
        <a class="six-edit" href="#/settings">自訂六事</a></p>
      <footer class="home-foot"><span>三錢六擲，由下成卦</span><span>本機運算 · 離線可用</span></footer>
      <span class="version">${VERSION}</span>
    </section>`)

  const input = node.querySelector('#question')
  node.querySelector('.ask').addEventListener('submit', e => {
    e.preventDefault()
    pendingQuestion = input.value
    location.hash = '#/cast'
  })
  node.querySelector('[data-cast]')?.addEventListener('click', () => { pendingQuestion = input.value })

  for (const a of node.querySelectorAll('.action')) {
    a.addEventListener('pointerdown', e => {
      const rect = a.getBoundingClientRect()
      const size = Math.max(rect.width, rect.height) * 2
      const r = document.createElement('span')
      r.className = 'ripple'
      r.style.cssText = `left:${e.clientX - rect.left}px;top:${e.clientY - rect.top}px;width:${size}px;height:${size}px`
      a.appendChild(r)
      r.addEventListener('animationend', () => r.remove())
      inkBurst(e.clientX, e.clientY, 0.5)
    })
  }
}

// ---------- 起卦動畫 ----------

async function renderCasting(token) {
  const question = pendingQuestion.trim()
  pendingQuestion = ''
  const node = mount(`
    <section class="casting">
      <div class="seal" aria-hidden="true">易</div>
      <p class="kicker">三錢六擲</p>
      <h1>正在起卦</h1>
      <p class="lead">${question ? `所問：${esc(question)}` : '靜候卦象成形，為當下理清方向。'}</p>
      <div class="coins" aria-hidden="true">
        ${'<span class="coin"><span class="glyph-coin"><span>通</span><span>寶</span><span>開</span><span>元</span></span></span>'.repeat(3)}
      </div>
      <p class="cast-status" aria-live="polite">擲爻中…</p>
      <div class="build" aria-hidden="true">${'<div class="build-line"><i></i></div>'.repeat(6)}</div>
      <button class="text-btn" type="button" data-skip>略過動畫</button>
    </section>`)

  const hexagrams = await loadHexagrams()
  if (isStale(token)) return

  const flat = []
  const coinFn = () => {
    const v = Math.random() < 0.5 ? 2 : 3
    flat.push(v)
    return v
  }
  const result = castHexagram(hexagrams, question, coinFn)
  const values = result.lines.map(l => l.value)
  const coins = values.map((_, i) => flat.slice(i * 3, i * 3 + 3))

  let done = false
  const finish = () => {
    if (done || isStale(token)) return
    done = true
    const before = unlockedNow(hexagrams)
    const record = addRecord('coin', values, coins, question)
    setInkMode('calm')
    inkBurst(innerWidth / 2, innerHeight * 0.35, 1.2)
    location.replace(`#/r/${record.id}`)
    announceUnlocks(hexagrams, before)
  }
  node.querySelector('[data-skip]').addEventListener('click', finish)

  setInkMode('gather')
  const coinEls = [...node.querySelectorAll('.coin')]
  const lineEls = [...node.querySelectorAll('.build-line')]
  const status = node.querySelector('.cast-status')

  await sleep(500)
  for (let i = 0; i < 6; i++) {
    if (done || isStale(token)) return
    status.textContent = hw(`擲${LINE_POS[i]}中…`)
    for (const c of coinEls) {
      c.classList.remove('spin', 'head')
      void c.offsetWidth // 重新觸發動畫
      c.classList.add('spin')
    }
    await sleep(700)
    if (done || isStale(token)) return
    coins[i].forEach((v, k) => coinEls[k].classList.toggle('head', v === 2))
    const line = result.lines[i]
    status.textContent = hw(`${LINE_POS[i]}：${coins[i].map(v => COIN_FACE[v]).join(' ')} → ${line.value} ${LINE_KIND[line.value]}`)
    const el = lineEls[i]
    el.innerHTML = line.yin ? '<i></i><i></i>' : '<i></i>'
    el.classList.add('on')
    el.classList.toggle('changing', line.changing)
    await sleep(520)
  }
  status.textContent = '卦成'
  await sleep(450)
  finish()
}

// ---------- 歷史紀錄頁 ----------

async function renderHistory(token) {
  const list = loadHistory()
  const hexagrams = list.length ? await loadHexagrams() : []
  if (isStale(token)) return

  const cards = list.map((rec, i) => {
    const ev = evaluate(hexagrams, rec)
    if (!ev) return ''
    const { result, scores } = ev
    const moving = result.lines.filter(l => l.changing).length
    const top = [...scores].sort((a, b) => b.score - a.score).slice(0, 2)
    const rated = (rec.feedback || []).some(v => typeof v === 'boolean')
    return `
      <a class="hist-card" href="#/r/${esc(rec.id)}" style="animation-delay:${Math.min(i, 12) * 0.04}s">
        <div class="hist-top"><h2>${esc(fullName(result.present))}</h2><time>${formatTime(rec.time)}</time></div>
        <p class="hist-meta">${KIND_LABEL[castKind(list, rec)]} · ${methodName(rec.method)} · ${moving ? `${moving} 爻動 · 之 ${esc(fullName(result.future))}` : '無動爻'}${rated ? ' · 已回饋' : ''}</p>
        ${rec.question ? `<p class="hist-q">所問：${esc(rec.question)}</p>` : ''}
        <p class="hist-top3">較高評分：${top.map(s => `${esc(s.name)} ${s.score}`).join(' · ')}</p>
      </a>`
  }).join('')

  const node = mount(`
    <section class="history">
      <div class="topbar"><a href="#/">← 返回首頁</a>${list.length ? '<button class="text-btn danger" type="button" data-clear>清空紀錄</button>' : ''}</div>
      <h1>歷史紀錄</h1>
      <p class="sub">${list.length} 則卦例 · 由新至舊排列</p>
      ${list.length
        ? `<div class="hist-grid">${cards}</div>`
        : '<div class="empty"><p>尚無卦例。靜心一念，起一卦吧。</p><a class="btn primary" href="#/cast">開始卜卦</a></div>'}
      <p class="fine">歷史紀錄保存在此瀏覽器；點擊紀錄會重開原卦例。清空後卦簿的收集與成就也會歸零。</p>
    </section>`)

  // 頁內二次確認：第一次點擊改為「確定清空？」，3 秒內再點一次才清空
  const clearBtn = node.querySelector('[data-clear]')
  clearBtn?.addEventListener('click', () => {
    if (!clearBtn.classList.contains('armed')) {
      clearBtn.classList.add('armed')
      clearBtn.textContent = hw('確定清空？再點一次')
      setTimeout(() => {
        clearBtn.classList.remove('armed')
        clearBtn.textContent = '清空紀錄'
      }, 3000)
      return
    }
    saveHistory([])
    toast('已清空歷史紀錄')
    route()
  })
}

// ---------- 外框：主題、全螢幕 ----------

function setupChrome() {
  const dark = matchMedia('(prefers-color-scheme: dark)')

  document.getElementById('theme-btn').addEventListener('click', () => {
    const current = document.documentElement.dataset.theme || (dark.matches ? 'dark' : 'light')
    const next = current === 'dark' ? 'light' : 'dark'
    document.documentElement.dataset.theme = next
    try { localStorage.setItem(THEME_KEY, next) } catch {}
    refreshColor()
  })
  dark.addEventListener('change', refreshColor)

  const fsBtn = document.getElementById('fs-btn')
  if (document.fullscreenEnabled) {
    fsBtn.hidden = false
    fsBtn.addEventListener('click', () => {
      if (document.fullscreenElement) document.exitFullscreen()
      else document.documentElement.requestFullscreen().catch(() => {})
    })
  }

  // 單檔版（artifact）沒有 service-worker.js，且其執行環境不支援 Service Worker
  const bundled = document.getElementById('hexagrams-data')
  if (!bundled && 'serviceWorker' in navigator && location.protocol.startsWith('http')) {
    navigator.serviceWorker.register('./service-worker.js').catch(() => {})
  }
}

setupChrome()
initInk(document.getElementById('ink'))
addEventListener('hashchange', route)
route()
