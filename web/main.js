'use strict'

import { castHexagram, castFromLines } from './core/casting.js'
import { fullName, TRIGRAMS } from './core/hexagrams.js'
import { ACTIVITIES, AFFINITY, scoreActivities } from './core/scoring.js'
import { initInk, setInkMode, inkBurst, refreshColor } from './ink.js'
import { STORIES, TRAITS, relation, SCENES } from './activities.js'

const VERSION = 'V3.01'
const QUESTION = '今日六事'
const HISTORY_KEY = 'yaonomad.history'
const THEME_KEY = 'yaonomad.theme'
const HISTORY_MAX = 200

const LINE_POS = ['初爻', '二爻', '三爻', '四爻', '五爻', '上爻']
const LINE_KIND = { 6: '老陰（變）', 7: '少陽', 8: '少陰', 9: '老陽（變）' }
const COIN_FACE = { 2: '正', 3: '背' }
const METHOD = { coin: '三錢法', manual: '手動六爻' }
const methodName = m => METHOD[m] || METHOD.coin
const LEVEL = { good: '上佳', fair: '一般', bad: '不宜' }
const WEEKDAY = ['日', '一', '二', '三', '四', '五', '六']

/** 各活動在三種評等下的一句提醒，順序同 ACTIVITIES */
const TIPS = {
  '開會': { good: '宜主動發言、拍板定案，共識來得快。', fair: '照議程走，避免臨時加題。', bad: '能改用文字溝通就別開，開了也易各說各話。' },
  '撰寫報告': { good: '思路清晰，一氣呵成的好時機。', fair: '先列大綱再填內容，分段完成。', bad: '易卡文或寫偏，先蒐集資料，明天再修。' },
  '抓BUG': { good: '直覺敏銳，追根究柢容易找到病灶。', fair: '照步驟重現、二分排查，耐心是關鍵。', bad: '容易越修越亂，先記錄現象、找人一起看。' },
  '系統開發': { good: '適合開新功能、做架構設計。', fair: '以小步提交為主，邊做邊測。', bad: '不宜大改架構，先做規劃與文件。' },
  '程式上線': { good: '時機成熟，照檢查清單穩穩發布。', fair: '可以上線，但先確認回滾方案。', bad: '能延則延；非上不可就縮小範圍、全程盯監控。' },
  '餵魚/澆花': { good: '生活小事做起來特別療癒，順便放空。', fair: '記得就好，別忘了換水。', bad: '容易忘記或手滑，設個提醒吧。' },
}

const ACTIVITY_INDEX = Object.fromEntries(ACTIVITIES.map((name, i) => [name, i]))

const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)')
const view = document.getElementById('view')
let hexagramsPromise = null
let navToken = 0

// ---------- 工具 ----------

function loadHexagrams() {
  if (hexagramsPromise === null) {
    const embedded = document.getElementById('hexagrams-data')
    hexagramsPromise = embedded
      ? Promise.resolve(JSON.parse(embedded.textContent))
      : fetch('./data/hexagrams.json').then(res => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        return res.json()
      })
    hexagramsPromise.catch(() => { hexagramsPromise = null })
  }
  return hexagramsPromise
}

/** 全站文字一律半形：全形標點轉成半形，資料檔維持原樣，只在顯示時轉換 */
const HALF = {
  '，': ', ', '。': '. ', '、': ', ', '：': ': ', '；': '; ', '！': '! ', '？': '? ',
  '（': '(', '）': ')', '「': '"', '」': '"', '『': "'", '』': "'", '　': ' ', '…': '...', '—': '-', '～': '~', '／': '/',
}
const HALF_RE = new RegExp(`[${Object.keys(HALF).join('')}]`, 'g')
const hw = s => String(s).replace(HALF_RE, c => HALF[c])

function esc(s) {
  return String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c])
}

const pad = n => String(n).padStart(2, '0')

function formatDay(d) {
  return `${d.getMonth() + 1}/${d.getDate()}（週${WEEKDAY[d.getDay()]}）`
}

function formatTime(ms) {
  const d = new Date(ms)
  return `${d.getFullYear()}/${pad(d.getMonth() + 1)}/${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`
}

/** 1–64 轉中文數字，如 44 → 四十四 */
function cnNum(n) {
  const d = ['', '一', '二', '三', '四', '五', '六', '七', '八', '九']
  if (n < 10) return d[n]
  if (n < 20) return '十' + d[n % 10]
  return d[Math.floor(n / 10)] + '十' + d[n % 10]
}

function trigramPair(hex) {
  const up = TRIGRAMS[hex.upper]
  const low = TRIGRAMS[hex.lower]
  return `${up.name}${up.image}上 · ${low.name}${low.image}下`
}

const sleep = ms => new Promise(r => setTimeout(r, reduceMotion.matches ? Math.min(ms, 120) : ms))

function toast(msg) {
  const el = document.getElementById('toast')
  el.textContent = hw(msg)
  el.classList.add('show')
  clearTimeout(toast.timer)
  toast.timer = setTimeout(() => el.classList.remove('show'), 1800)
}

// ---------- 歷史紀錄 ----------

/**
 * @typedef {Object} CastRecord
 * @property {string} id
 * @property {number} time - 起卦時間（ms）
 * @property {'coin'|'manual'} method
 * @property {number[]} values - 六爻值，index 0 = 初爻
 * @property {number[][]|null} coins - 每爻三枚硬幣（2/3）；手動輸入時為 null
 */

/** @returns {CastRecord[]} 由新至舊 */
function loadHistory() {
  try {
    const list = JSON.parse(localStorage.getItem(HISTORY_KEY) || '[]')
    return Array.isArray(list)
      ? list.filter(r => r && typeof r.id === 'string' && Array.isArray(r.values) && r.values.length === 6)
      : []
  } catch {
    return []
  }
}

function saveHistory(list) {
  try {
    localStorage.setItem(HISTORY_KEY, JSON.stringify(list.slice(0, HISTORY_MAX)))
  } catch {
    toast('無法保存紀錄（瀏覽器儲存空間不可用）')
  }
}

function addRecord(method, values, coins) {
  const record = { id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6), time: Date.now(), method, values, coins }
  saveHistory([record, ...loadHistory()])
  return record
}

// ---------- 路由 ----------

async function route() {
  const token = ++navToken
  const hash = location.hash.replace(/^#/, '') || '/'
  setInkMode('calm')
  try {
    if (hash === '/cast') return await renderCasting(token)
    if (hash === '/history') return await renderHistory(token)
    const m = hash.match(/^\/r\/([\w-]+)$/)
    if (m) return await renderResult(token, m[1])
    renderHome()
  } catch (err) {
    console.error(err)
    mount(`<section class="empty"><p>卦象資料載入失敗，請確認網路或重新整理。</p>
      <a class="btn" href="#/">返回首頁</a></section>`)
  }
}

/** 以模板字串渲染畫面；所有外來字串皆須先經 esc() */
function mount(html) {
  const tpl = document.createElement('template')
  tpl.innerHTML = hw(html.trim())
  const node = tpl.content.firstElementChild
  node.classList.add('view-enter')
  view.replaceChildren(node)
  scrollTo({ top: 0 })
  return node
}

// ---------- 首頁 ----------

function renderHome() {
  const count = loadHistory().length
  const sep = '<span class="sep"> · </span>'
  const node = mount(`
    <section class="home">
      <div class="meta-row"><span>周易 · 六十四卦</span><span>${formatDay(new Date())}</span></div>
      <div class="home-grid">
        <div class="hero">
          <div class="seal" aria-hidden="true">易</div>
          <p class="kicker">靜心一念</p>
          <h1>觀卦知時，從容行事。</h1>
          <p class="lead">一卦觀六事，為當下理清方向。</p>
        </div>
        <nav class="actions">
          <a class="action primary corner" href="#/cast">
            <svg class="action-icon" viewBox="0 0 48 48" aria-hidden="true"><g fill="none" stroke="currentColor" stroke-width="2">
              <circle cx="24" cy="17" r="10"/><circle cx="16.5" cy="29" r="10"/><circle cx="31.5" cy="29" r="10"/>
              <rect x="21" y="14" width="6" height="6"/></g></svg>
            <span><span class="action-title">開始卜卦</span><span class="action-sub">即時起卦 · 一次評分六項活動</span></span>
            <span class="action-arrow" aria-hidden="true">→</span>
          </a>
          <a class="action corner" href="#/history">
            <svg class="action-icon" viewBox="0 0 48 48" aria-hidden="true"><g fill="none" stroke="currentColor" stroke-width="2">
              <path d="M14 10h18l6 6v24H14z"/><path d="M10 14v30h24"/><path d="M20 22h12M20 28h12M20 34h8"/></g></svg>
            <span><span class="action-title">歷史紀錄</span>
              <span class="action-sub">${count ? `已有 ${count} 則卦例，重讀當時的提醒` : '尚無卦例，起卦後自動保存'}</span></span>
            <span class="action-arrow" aria-hidden="true">→</span>
          </a>
        </nav>
      </div>
      <p class="six">開會${sep}撰寫報告${sep}抓BUG<span class="br"></span>${sep}系統開發${sep}程式上線${sep}餵魚/澆花</p>
      <footer class="home-foot"><span>三錢六擲，由下成卦</span><span>本機運算 · 離線可用</span></footer>
      <span class="version">${VERSION}</span>
    </section>`)

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
  const node = mount(`
    <section class="casting">
      <div class="seal" aria-hidden="true">易</div>
      <p class="kicker">三錢六擲</p>
      <h1>正在起卦</h1>
      <p class="lead">靜候卦象成形，為當下理清方向。</p>
      <div class="coins" aria-hidden="true">
        ${'<span class="coin"><span class="glyph"><span>通</span><span>寶</span><span>開</span><span>元</span></span></span>'.repeat(3)}
      </div>
      <p class="cast-status" aria-live="polite">擲爻中…</p>
      <div class="build" aria-hidden="true">${'<div class="build-line"><i></i></div>'.repeat(6)}</div>
      <button class="text-btn" type="button" data-skip>略過動畫</button>
    </section>`)

  const hexagrams = await loadHexagrams()
  if (token !== navToken) return

  const flat = []
  const coinFn = () => {
    const v = Math.random() < 0.5 ? 2 : 3
    flat.push(v)
    return v
  }
  const result = castHexagram(hexagrams, QUESTION, coinFn)
  const values = result.lines.map(l => l.value)
  const coins = values.map((_, i) => flat.slice(i * 3, i * 3 + 3))

  let done = false
  const finish = () => {
    if (done || token !== navToken) return
    done = true
    const record = addRecord('coin', values, coins)
    setInkMode('calm')
    inkBurst(innerWidth / 2, innerHeight * 0.35, 1.2)
    location.replace(`#/r/${record.id}`)
  }
  node.querySelector('[data-skip]').addEventListener('click', finish)

  setInkMode('gather')
  const coinEls = [...node.querySelectorAll('.coin')]
  const lineEls = [...node.querySelectorAll('.build-line')]
  const status = node.querySelector('.cast-status')

  await sleep(500)
  for (let i = 0; i < 6; i++) {
    if (done || token !== navToken) return
    status.textContent = hw(`擲${LINE_POS[i]}中…`)
    for (const c of coinEls) {
      c.classList.remove('spin', 'head')
      void c.offsetWidth // 重新觸發動畫
      c.classList.add('spin')
    }
    await sleep(700)
    if (done || token !== navToken) return
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

// ---------- 結果 ----------

function hexHTML(lines, highlight, delay = 0) {
  return `<div class="hex" role="img" aria-label="六爻圖">${lines.map((l, i) => {
    const style = `style="animation-delay:${delay + i * 0.08}s"`
    const bars = l.yin ? `<i ${style}></i><i ${style}></i>` : `<i ${style}></i>`
    return `<div class="hex-line${highlight && l.changing ? ' changing' : ''}">${bars}</div>`
  }).join('')}</div>`
}

function readingHTML(title, hex, movingLines) {
  return `
    <article class="card reading">
      <div class="sec-head"><h2>${title}</h2><span>第${cnNum(hex.number)}卦 · ${esc(hex.name)}</span></div>
      <dl>
        <dt>卦辭</dt><dd class="classic">${esc(hex.name)}：${esc(hex.judgment)}</dd>
        <dt>象曰</dt><dd class="classic">${esc(hex.image)}</dd>
        <dt>白話</dt><dd>${esc(hex.plain)}</dd>
        <dt>職場</dt><dd>${esc(hex.advice)}</dd>
        ${movingLines.length ? `<dt>動爻</dt><dd class="moving">${movingLines.map(t => `<p>${esc(t)}</p>`).join('')}</dd>` : ''}
      </dl>
    </article>`
}

/** 為什麼是這個分數：用上下卦的性質說明，有變卦再說明它把分數往哪帶 */
function whyText(s, result) {
  const i = ACTIVITY_INDEX[s.name]
  const part = (label, code) => {
    const t = TRIGRAMS[code]
    return `${label}${t.name}為${t.image}，主${TRAITS[code]}，對${s.name}${relation(AFFINITY[code][i])}`
  }
  const { present, future, lines } = result
  const head = present.upper === present.lower
    ? `本卦${fullName(present)}，${part('上下皆', present.lower)}。`
    : `本卦${fullName(present)}：${part('下卦', present.lower)}；${part('上卦', present.upper)}。`
  let tail = ''
  if (future) {
    const diff = s.future - s.present
    const move = diff > 3 ? '把分數往上帶' : diff < -3 ? '把分數往下拉' : '對分數影響不大'
    tail += `變卦${fullName(future)}佔四分之一，${move}。`
  }
  const moving = lines.filter(l => l.changing).length
  if (s.name === '程式上線' && moving) tail += `另有 ${moving} 個變爻，局勢未定，上線再扣 ${moving * 4} 分。`
  return head + tail
}

function detailHTML(s, result) {
  return `
    <div class="sd-scene">${SCENES[s.name]}</div>
    <div class="sd-text">
      <div class="sd-head">
        <h3>${esc(s.name)} <b>${s.score}</b><small>/100 · ${LEVEL[s.level]}</small></h3>
        <button class="sd-close" type="button" aria-label="收起說明">×</button>
      </div>
      <p class="sd-label">卦象白話</p>
      <p>${esc(whyText(s, result))}</p>
      <p class="sd-label">小故事</p>
      <p class="sd-story">${esc(STORIES[s.name][s.level])}</p>
    </div>`
}

/** 六事卡片點擊展開：說明面板插在該卡所在列的下方，橫跨整列 */
function setupScoreDetail(grid, scores, result) {
  const cards = [...grid.querySelectorAll('.score')]
  const panel = document.createElement('div')
  panel.id = 'score-detail'
  panel.setAttribute('role', 'region')
  let openIdx = -1

  const place = () => {
    if (openIdx < 0) return
    const cols = getComputedStyle(grid).gridTemplateColumns.split(' ').filter(Boolean).length || 1
    const end = Math.min(cards.length - 1, Math.floor(openIdx / cols) * cols + cols - 1)
    if (panel.previousElementSibling !== cards[end]) cards[end].after(panel)
    const c = cards[openIdx].getBoundingClientRect()
    const g = grid.getBoundingClientRect()
    panel.style.setProperty('--notch', `${c.left - g.left + c.width / 2}px`)
  }

  const close = () => {
    const card = cards[openIdx]
    openIdx = -1
    panel.remove()
    cards.forEach(c => { c.classList.remove('open'); c.setAttribute('aria-expanded', 'false') })
    card?.focus()
  }

  const open = i => {
    if (openIdx === i) return close()
    openIdx = i
    cards.forEach((c, k) => { c.classList.toggle('open', k === i); c.setAttribute('aria-expanded', String(k === i)) })
    panel.className = `score-detail ${scores[i].level}`
    panel.setAttribute('aria-label', `${scores[i].name}說明`)
    panel.innerHTML = hw(detailHTML(scores[i], result))
    panel.querySelector('.sd-close').addEventListener('click', close)
    panel.remove() // 重新插入以重播進場動畫
    place()
    panel.scrollIntoView({ block: 'nearest', behavior: reduceMotion.matches ? 'auto' : 'smooth' })
  }

  cards.forEach((c, i) => c.addEventListener('click', () => open(i)))
  panel.addEventListener('keydown', e => { if (e.key === 'Escape') close() })
  new ResizeObserver(place).observe(grid)
}

function copyText(record, result, scores) {
  const { present, future, lines } = result
  const changing = lines.map((l, i) => (l.changing ? LINE_POS[i] : null)).filter(Boolean)
  const out = [
    'My易經 · 觀卦知時',
    `起卦時間：${formatTime(record.time)}（${methodName(record.method)}）`,
    `本卦：第${present.number}卦 ${fullName(present)}（${trigramPair(present)}）`,
    future ? `變卦：第${future.number}卦 ${fullName(future)}（變爻：${changing.join('、')}）` : '變卦：無（六爻皆靜）',
    `六爻（初→上）：${lines.map(l => l.value).join(' ')}`,
    '',
    `今日一句：${present.motto}`,
    '',
    '六事評分：',
    ...scores.map(s => `  ${s.name} ${s.score}（${LEVEL[s.level]}）`),
    '',
    `本卦卦辭：${present.name}：${present.judgment}`,
    `象曰：${present.image}`,
    `白話：${present.plain}`,
    `職場：${present.advice}`,
  ]
  const moving = lines.map((l, i) => (l.changing ? present.lines[i] : null)).filter(Boolean)
  if (moving.length) out.push(`動爻：${moving.join(' ')}`)
  if (future) {
    out.push('', `變卦卦辭：${future.name}：${future.judgment}`, `象曰：${future.image}`, `白話：${future.plain}`, `職場：${future.advice}`)
  }
  return hw(out.join('\n'))
}

async function copyToClipboard(text) {
  try {
    await navigator.clipboard.writeText(text)
  } catch {
    const ta = document.createElement('textarea')
    ta.value = text
    ta.style.cssText = 'position:fixed;opacity:0'
    document.body.appendChild(ta)
    ta.select()
    document.execCommand('copy')
    ta.remove()
  }
}

async function renderResult(token, id) {
  const record = loadHistory().find(r => r.id === id)
  if (!record) {
    toast('找不到這則卦例')
    location.replace('#/')
    return
  }
  const hexagrams = await loadHexagrams()
  if (token !== navToken) return

  const result = castFromLines(hexagrams, QUESTION, record.values)
  const { present, future, lines } = result
  const scores = scoreActivities(result)
  const changingIdx = lines.map((l, i) => (l.changing ? i : -1)).filter(i => i >= 0)
  const futureLines = lines.map(l => ({ yin: l.changing ? !l.yin : l.yin, changing: false }))

  const good = scores.filter(s => s.level === 'good').sort((a, b) => b.score - a.score)
  const bad = scores.filter(s => s.level === 'bad').sort((a, b) => a.score - b.score)
  const fair = scores.length - good.length - bad.length
  const listText = (arr, cls = '') => (arr.length
    ? arr.map(s => `<span class="nw"><b class="${cls}">${esc(s.name)}</b>（${s.score}）</span>`).join(' · ')
    : '—')

  const node = mount(`
    <section class="result">
      <div class="topbar"><a href="#/">← 返回首頁</a><span>${methodName(record.method)}${changingIdx.length ? ` · ${changingIdx.length} 爻動` : ' · 無動爻'}</span></div>

      <header class="r-head">
        <div>
          <p class="kicker">卦象已成</p>
          <h1>${esc(fullName(present))}</h1>
          <p class="sub">起卦時間：${formatTime(record.time)}</p>
        </div>
        <div class="no-box">第<b>${present.number}</b>卦</div>
      </header>

      <blockquote class="motto">
        <p class="kicker">今日一句</p>
        <p class="motto-text">${esc(present.motto)}</p>
        <cite>My易經 · My I Ching</cite>
      </blockquote>

      <section>
        <div class="sec-head"><h2>六事評分</h2><span>宜 ${good.length} · 平 ${fair} · 忌 ${bad.length}</span></div>
        <p class="summary">宜：${listText(good)}<br>忌：${listText(bad, 'bad')}</p>
        <div class="score-grid">
          ${scores.map((s, i) => `
            <button class="score ${s.level}" type="button" aria-expanded="false" aria-controls="score-detail" style="animation-delay:${0.1 + i * 0.07}s">
              <span class="score-name">${esc(s.name)}</span>
              <span class="chip">${LEVEL[s.level]}</span>
              <span class="num"><b>${s.score}</b><small>/100</small></span>
              <span class="meter" aria-hidden="true"><i style="width:${s.score}%"></i></span>
              <span class="mix">本卦 ${s.present} · ${s.future === null ? '無變卦' : `變卦 ${s.future}`}</span>
              <span class="tip">${esc(TIPS[s.name][s.level])}</span>
              <span class="more" aria-hidden="true">看故事</span>
            </button>`).join('')}
        </div>
        <p class="fine note">點任一項可展開白話說明與小故事。分數依本卦（75%）與變卦（25%）上下卦的取象計算，變爻越多越不利上線；僅供參考，請依實際情況判斷。</p>
      </section>

      <div class="r-grid">
        <div class="r-main">
          <figure class="card figure">
            <div class="fig-row">
              <div class="fig-hex">
                <span class="fig-label">本卦</span>
                ${hexHTML(lines, true, 0.2)}
                <span class="fig-name">${esc(fullName(present))}</span>
                <span class="fig-sub">${trigramPair(present)}</span>
              </div>
              ${future ? `
              <span class="fig-arrow" aria-label="之">之</span>
              <div class="fig-hex">
                <span class="fig-label">變卦</span>
                ${hexHTML(futureLines, false, 0.8)}
                <span class="fig-name">${esc(fullName(future))}</span>
                <span class="fig-sub">${trigramPair(future)}</span>
              </div>` : ''}
            </div>
            <figcaption class="figcap">${changingIdx.length
              ? `變爻：${changingIdx.map(i => LINE_POS[i]).join('、')} · 金色為變爻，由下往上讀卦`
              : '六爻皆靜，無變卦 · 由下往上讀卦'}</figcaption>
          </figure>

          ${readingHTML('本卦解析', present, changingIdx.map(i => present.lines[i]))}
          ${future
            ? readingHTML('變卦解析', future, [])
            : `<article class="card reading"><div class="sec-head"><h2>變卦解析</h2><span>無</span></div>
                <dl><dd>六爻皆靜，沒有變卦。以本卦卦辭為主：事態穩定，照目前的方向走即可。</dd></dl></article>`}
        </div>

        <aside class="r-side">
          <details class="card" open>
            <summary>六爻擲錢紀錄</summary>
            <div class="details-body">
              <div class="table-wrap"><table class="toss-table">
                <thead><tr><th>爻位</th><th>三錢結果</th><th>數值</th><th>爻性</th></tr></thead>
                <tbody>${lines.map((l, i) => i).reverse().map(i => `
                  <tr class="${lines[i].changing ? 'changing' : ''}">
                    <td>${LINE_POS[i]}</td>
                    <td>${Array.isArray(record.coins?.[i]) ? record.coins[i].map(v => COIN_FACE[v] ?? '?').join(' · ') : '手動'}</td>
                    <td>${lines[i].value}</td>
                    <td>${LINE_KIND[lines[i].value]}</td>
                  </tr>`).join('')}
                </tbody>
              </table></div>
              <p class="toss-foot">六爻值（初→上）：${lines.map(l => l.value).join(' ')}</p>
            </div>
          </details>

          <details class="card">
            <summary>本卦六爻爻辭</summary>
            <div class="details-body">
              <ol class="yao-list">${present.lines.map((t, i) => i).reverse().map(i =>
                `<li class="${lines[i].changing ? 'changing' : ''}">${esc(present.lines[i])}</li>`).join('')}</ol>
            </div>
          </details>

          <details class="card">
            <summary>手動輸入六爻</summary>
            <div class="details-body">
              <form class="manual">
                <p>自己擲了硬幣？由上爻往下填入爻值，即可成卦並存入紀錄。</p>
                ${[5, 4, 3, 2, 1, 0].map(i => `
                  <label>${LINE_POS[i]}
                    <select name="l${i}">${[7, 8, 9, 6].map(v =>
                      `<option value="${v}"${lines[i].value === v ? ' selected' : ''}>${v} · ${LINE_KIND[v]}</option>`).join('')}
                    </select>
                  </label>`).join('')}
                <button class="btn" type="submit">以此六爻成卦</button>
              </form>
            </div>
          </details>

          <details class="card">
            <summary>起卦方法說明</summary>
            <div class="details-body">
              <p>三枚硬幣同擲，正面（字面）記 2、背面記 3，加總得 6、7、8、9。</p>
              <p>6 老陰、9 老陽為變爻，會陰陽互換形成變卦；7 少陽、8 少陰不變。</p>
              <p>共擲六次，由下往上排成六爻，得本卦；有變爻再得變卦。</p>
            </div>
          </details>
        </aside>
      </div>

      <div class="r-actions">
        <p class="fine hint">每次起卦都會自動保存到歷史紀錄。</p>
        <button class="btn primary" type="button" data-copy>複製完整卦象</button>
        <a class="btn" href="#/cast">再起一卦</a>
        <a class="push" href="#/history">查看歷史紀錄 →</a>
      </div>
      <p class="fine">卦象由本機亂數產生，僅供娛樂與自省，不構成任何決策建議。</p>
    </section>`)

  setupScoreDetail(node.querySelector('.score-grid'), scores, result)

  node.querySelector('[data-copy]').addEventListener('click', async () => {
    await copyToClipboard(copyText(record, result, scores))
    toast('已複製完整卦象')
  })

  node.querySelector('.manual').addEventListener('submit', e => {
    e.preventDefault()
    const form = new FormData(e.currentTarget)
    const values = [0, 1, 2, 3, 4, 5].map(i => Number(form.get(`l${i}`)))
    const rec = addRecord('manual', values, null)
    inkBurst(innerWidth / 2, innerHeight * 0.35, 1)
    location.hash = `#/r/${rec.id}`
  })
}

// ---------- 歷史紀錄頁 ----------

async function renderHistory(token) {
  const list = loadHistory()
  const hexagrams = list.length ? await loadHexagrams() : []
  if (token !== navToken) return

  const cards = list.map((rec, i) => {
    let result
    try {
      result = castFromLines(hexagrams, QUESTION, rec.values)
    } catch {
      return ''
    }
    const moving = result.lines.filter(l => l.changing).length
    const top = scoreActivities(result).sort((a, b) => b.score - a.score).slice(0, 2)
    return `
      <a class="hist-card" href="#/r/${esc(rec.id)}" style="animation-delay:${Math.min(i, 12) * 0.04}s">
        <div class="hist-top"><h2>${esc(fullName(result.present))}</h2><time>${formatTime(rec.time)}</time></div>
        <p class="hist-meta">${methodName(rec.method)} · ${moving ? `${moving} 爻動 · 之 ${esc(fullName(result.future))}` : '無動爻'}</p>
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
        : `<div class="empty"><p>尚無卦例。靜心一念，起一卦吧。</p><a class="btn primary" href="#/cast">開始卜卦</a></div>`}
      <p class="fine">歷史紀錄保存在此瀏覽器；點擊紀錄會重開原卦例。</p>
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
