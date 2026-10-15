'use strict'

/** 結果頁：自己的卦例（#/r/<id>）與朋友分享的卦（#v-...） */

import { fullName, TRIGRAMS } from './core/hexagrams.js'
import { AFFINITY, CATEGORIES, FORTUNE, scoreActivities } from './core/scoring.js'
import { castKind, evaluate, todayDaily } from './core/progress.js'
import { encodeShare, decodeShare } from './core/share.js'
import { ITEMS, TRAITS, relation, tipFor, storyFor, stampsOf, glyphFor, sealFor, sealOf, LEGACY_SEL, resolveSel, selToCode, codeToSel } from './activities.js'
import { startInkScene } from './inkscene.js'
import { inkBurst } from './ink.js'
import {
  LINE_POS, LINE_KIND, COIN_FACE, LEVEL, KIND_LABEL, methodName, reduceMotion, loadHexagrams, hw, esc,
  formatTime, formatDate, cnNum, trigramPair, isStale, mount, toast, copyToClipboard,
  loadHistory, addRecord, updateRecord, unlockedNow, announceUnlocks,
} from './ui.js'


// ---------- 片段 ----------

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

/** 評分卡上的印章彩蛋：文字依事項而定，週五／週一只看主分類是否套用該規則 */
function stampFor(s) {
  const st = stampsOf(s)
  const ruled = rule => s.rules.some(r => r.rule === rule && r.cat === s.cats[0])
  if (s.score < 10 && st.low) return st.low
  if (s.score >= 90 && st.high) return st.high
  if (ruled('friday') && st.friday) return st.friday
  if (ruled('monday') && st.monday) return st.monday
  return null
}

const shareCode = record => encodeShare({
  values: record.values, time: record.time, streak: record.streak || 0, sel: selToCode(record.sel || LEGACY_SEL),
})

const catLabel = s => (s.cats[1] !== undefined && s.cats[1] !== s.cats[0]
  ? `${CATEGORIES[s.cats[0]]} · ${CATEGORIES[s.cats[1]]}`
  : CATEGORIES[s.cats[0]])

const RULE_TEXT = {
  monday: () => '起卦日是週一，溝通類扣 10 分（週一症候群）',
  calm: () => '六爻皆靜、局勢清楚，分析類加 8 分',
  change: d => `變中生新，創意類加 ${d} 分`,
  streak: d => `連續起卦有恆，例行類加 ${d} 分`,
  friday: () => '起卦日是週五，古訓「週五不部署」，時運類扣 15 分',
  weekend: () => '週末好好休息，休養類加 10 分',
}

/** 為什麼是這個分數：主副分類、上下卦對主分類的影響、變卦，以及套用的專屬規則 */
function whyText(s, result) {
  const [p, q = p] = s.cats
  const part = (label, code) => {
    const t = TRIGRAMS[code]
    return `${label}${t.name}為${t.image}，主${TRAITS[code]}，對${CATEGORIES[p]}類${relation(AFFINITY[code][p])}`
  }
  const { present, future } = result
  let text = q === p
    ? `${s.name}屬${CATEGORIES[p]}類。`
    : `${s.name}以${CATEGORIES[p]}類為主（七成），兼看${CATEGORIES[q]}類（三成）。`
  text += present.upper === present.lower
    ? `本卦${fullName(present)}，${part('上下皆', present.lower)}。`
    : `本卦${fullName(present)}：${part('下卦', present.lower)}；${part('上卦', present.upper)}。`
  if (p === FORTUNE) text += '時運類以外卦為主，起伏也比較大。'
  if (future) {
    const diff = s.future - s.present
    const move = diff > 3 ? '把分數往上帶' : diff < -3 ? '把分數往下拉' : '對分數影響不大'
    text += `變卦${fullName(future)}佔四分之一，${move}。`
  }
  if (s.rules.length) {
    text += s.rules.map(r => RULE_TEXT[r.rule](r.delta) + (r.weight < 1 ? `，計入${r.weight >= 0.7 ? '七' : '三'}成` : '')).join('；') + '。'
  }
  return text
}

/** 今日六類：每類一個小格，依分數上色 */
function categoriesHTML(categories) {
  const lv = n => (n >= 70 ? 'good' : n < 40 ? 'bad' : 'fair')
  return `<ul class="cat-strip" aria-label="今日六類分數">${categories.map(c =>
    `<li class="${lv(c.score)}"><span>${c.name}</span><b>${c.score}</b>${c.rules.length ? '<i aria-hidden="true">•</i>' : ''}</li>`).join('')}</ul>`
}

function detailHTML(s, result) {
  const story = storyFor(s, s.level)
  return `
    <div class="sd-scene">
      <canvas role="img" aria-label="墨點依${CATEGORIES[s.cats[0]]}類的方式流動，先聚成篆書「${glyphFor(s)}」字，再化為今字後散開"></canvas>
      <span class="seal-cap" aria-hidden="true">中山王篆 · ${glyphFor(s)}</span>
    </div>
    <div class="sd-text">
      <div class="sd-head">
        <h3>${esc(s.name)} <b>${s.score}</b><small>/100 · ${LEVEL[s.level]}</small></h3>
        <button class="sd-close" type="button" aria-label="收起說明">×</button>
      </div>
      <p class="sd-label">卦象白話</p>
      <p>${esc(whyText(s, result))}</p>
      ${story
        ? `<p class="sd-label">小故事</p><p class="sd-story">${esc(story)}</p>`
        : `<p class="sd-label">建議</p><p>${esc(tipFor(s, s.level))}</p>`}
    </div>`
}

/** 事項卡片點擊展開：說明面板插在該卡所在列的下方，橫跨整列 */
function setupScoreDetail(grid, scores, result) {
  const cards = [...grid.querySelectorAll('.score')]
  const panel = document.createElement('div')
  panel.id = 'score-detail'
  panel.setAttribute('role', 'region')
  let openIdx = -1
  let stopScene = null

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
    stopScene?.()
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
    stopScene?.()
    const s = scores[i]
    const cap = panel.querySelector('.seal-cap')
    stopScene = startInkScene(panel.querySelector('canvas'), {
      glyph: glyphFor(s),
      seal: sealFor(s),
      cat: s.cats[0],
      level: s.level,
      onPhase: phase => {
        cap.textContent = hw(`${phase === 'seal' ? '中山王篆' : '明體'} · ${glyphFor(s)}`)
        cap.classList.toggle('modern', phase === 'modern')
      },
    })
    panel.scrollIntoView({ block: 'nearest', behavior: reduceMotion.matches ? 'auto' : 'smooth' })
  }

  cards.forEach((c, i) => c.addEventListener('click', () => open(i)))
  panel.addEventListener('keydown', e => { if (e.key === 'Escape') close() })
  new ResizeObserver(place).observe(grid)
}

function shareURL(code) {
  const base = document.getElementById('hexagrams-data')?.dataset.shareBase || location.href.split('#')[0]
  return `${base}#${code}`
}

function copyText(ctx) {
  const { record, result, scores, kind } = ctx
  const { present, future, lines } = result
  const changing = lines.map((l, i) => (l.changing ? LINE_POS[i] : null)).filter(Boolean)
  const out = [
    `My易經 · ${KIND_LABEL[kind]}`,
    kind === 'shared' ? `起卦日期：${formatDate(record.time)}` : `起卦時間：${formatTime(record.time)}（${methodName(record.method)}）`,
  ]
  if (record.question) out.push(`所求：${record.question}`)
  out.push(
    `本卦：第${present.number}卦 ${fullName(present)}（${trigramPair(present)}）`,
    future ? `變卦：第${future.number}卦 ${fullName(future)}（變爻：${changing.join('、')}）` : '變卦：無（六爻皆靜）',
    `六爻（初→上）：${lines.map(l => l.value).join(' ')}`,
    '',
    `今日一句：${present.motto}`,
    '',
    ...(ctx.seek ? [`所求評分：${ctx.seek.score}（${LEVEL[ctx.seek.level]}，依${ctx.seek.basis}）${ctx.seek.tip}`, ''] : [
      `今日六類：${ctx.categories.map(c => `${c.name} ${c.score}`).join('、')}`,
      '',
      '諸事評分：',
      ...scores.map(s => `  ${s.name} ${s.score}（${LEVEL[s.level]}）${stampFor(s) ? `［${stampFor(s)}］` : ''}`),
      '',
    ]),
    `本卦卦辭：${present.name}：${present.judgment}`,
    `象曰：${present.image}`,
    `白話：${present.plain}`,
    `職場：${present.advice}`,
  )
  const moving = lines.map((l, i) => (l.changing ? present.lines[i] : null)).filter(Boolean)
  if (moving.length) out.push(`動爻：${moving.join(' ')}`)
  if (future) {
    out.push('', `變卦卦辭：${future.name}：${future.judgment}`, `象曰：${future.image}`, `白話：${future.plain}`, `職場：${future.advice}`)
  }
  out.push('', `分享連結：${shareURL(ctx.code)}`)
  return hw(out.join('\n'))
}

function omenHTML(kind, daily) {
  if (kind === 'shared') {
    return `
      <aside class="omen card shared">
        <span class="omen-seal" aria-hidden="true">贈</span>
        <div><p>這是朋友分享給你的一卦，不會存進你的紀錄。</p><p><a href="#/cast">我也來起一卦 →</a></p></div>
      </aside>`
  }
  if (kind !== 'again' && kind !== 'profane') return ''
  const link = daily ? ` <a href="#/r/${esc(daily.id)}">看今日一卦 →</a>` : ''
  return `
    <aside class="omen card ${kind}">
      <span class="omen-seal" aria-hidden="true">${kind === 'profane' ? '瀆' : '再'}</span>
      <div>
        <p class="omen-quote">初筮告，再三瀆，瀆則不告。<cite>《蒙》卦辭</cite></p>
        <p>${kind === 'again'
          ? '今天已經起過卦了。第一次的答案最誠懇，以今日一卦為準。'
          : '今天問到第三次，易經說問太多就不告訴你了，這卦當作娛樂就好。'}${link}</p>
      </div>
    </aside>`
}

const FORTUNE_TIP = {
  good: '時機正好，放手去求。',
  fair: '可求，但要多花心思、按部就班。',
  bad: '時機未到，先緩一緩、多做準備。',
}
const levelOf = n => (n >= 70 ? 'good' : n < 40 ? 'bad' : 'fair')

/**
 * 求卦的評分與墨字：所求裡提到某個事項名稱（如「開會」「考試」）就以該事項評分，否則看時運類。
 * 墨字：所求含該事項的代表字就用它，否則從所求中隨機取一字（依卦例固定），優先取有篆字的代表字；沒有漢字時用本卦卦名首字
 */
function seekInfo(record, result, categories) {
  const q = record.question
  const hit = Object.entries(ITEMS)
    .filter(([, it]) => q.includes(it.name))
    .sort((a, b) => b[1].name.length - a[1].name.length)[0]
  let info
  if (hit) {
    const [id, it] = hit
    const s = scoreActivities(result, { items: [{ id, name: it.name, cats: it.cats }], categories })[0]
    info = { score: s.score, level: s.level, basis: `「${it.name}」`, tip: tipFor(s, s.level), cat: it.cats[0] }
  } else {
    const score = categories[FORTUNE].score
    info = { score, level: levelOf(score), basis: '時運', tip: FORTUNE_TIP[levelOf(score)], cat: FORTUNE }
  }
  let h = 0
  for (const c of record.id) h = (h * 31 + c.charCodeAt(0)) >>> 0
  const chars = [...q].filter(c => /\p{Script=Han}/u.test(c))
  const seals = chars.filter(sealOf)
  const pool = seals.length ? seals : chars
  const own = hit && q.includes(hit[1].glyph) ? hit[1].glyph : null
  const glyph = own || (pool.length ? pool[h % pool.length] : result.present.name[0])
  return { ...info, glyph, seal: sealOf(glyph) }
}

function seekHTML(seek) {
  return `
      <section class="seek ${seek.level}">
        <div class="sec-head"><h2>所求評分</h2><span>依${esc(seek.basis)}</span></div>
        <div class="seek-score">
          <b>${seek.score}</b>
          <div><span class="chip">${LEVEL[seek.level]}</span><p>${esc(seek.tip)}</p></div>
        </div>
        <div class="sd-scene seek-scene">
          <canvas role="img" aria-label="墨點聚成所求中的「${esc(seek.glyph)}」字"></canvas><span class="seal-cap"></span>
        </div>
        <p class="seek-note">所求一字「<b>${esc(seek.glyph)}</b>」· 墨隨卦勢聚散</p>
      </section>`
}

/** 墨點依評分所依的類別流動，聚成所求之字：有篆字的先篆後今，其餘只聚成明體 */
function setupSeek(node, seek) {
  const box = node.querySelector('.seek-scene')
  const cap = box.querySelector('.seal-cap')
  startInkScene(box.querySelector('canvas'), {
    glyph: seek.glyph,
    seal: seek.seal,
    cat: seek.cat,
    level: seek.level,
    onPhase: phase => {
      cap.textContent = hw(`${phase === 'seal' ? '中山王篆' : '明體'} · ${seek.glyph}`)
      cap.classList.toggle('modern', phase === 'modern')
    },
  })
}

function feedbackHTML(scores, feedback, open) {
  const rated = feedback.filter(v => typeof v === 'boolean').length
  return `
    <details class="card" id="feedback"${open ? ' open' : ''}>
      <summary>應驗回饋 <span class="fb-count">${rated}/${scores.length}</span></summary>
      <div class="details-body">
        <p>事情過後回來勾一下：這些評分準不準？會統計到「我的卦簿」。</p>
        <ul class="fb-list">${scores.map((s, i) => `
          <li>
            <span class="fb-name">${esc(s.name)}</span>
            <span class="fb-score ${s.level}">${s.score}</span>
            <span class="fb-btns" role="group" aria-label="${esc(s.name)}準不準">
              <button type="button" class="fb-btn hit" data-i="${i}" data-v="1" aria-pressed="${feedback[i] === true}">準</button>
              <button type="button" class="fb-btn miss" data-i="${i}" data-v="0" aria-pressed="${feedback[i] === false}">不準</button>
            </span>
          </li>`).join('')}
        </ul>
      </div>
    </details>`
}

// ---------- 主畫面 ----------

/**
 * @param {object} ctx
 * @param {'daily'|'seek'|'again'|'profane'|'shared'} ctx.kind
 * @param {import('./ui.js').CastRecord} ctx.record
 * @param {boolean} ctx.own - 自己的紀錄（可回饋、可手動成卦）
 */
function renderView(ctx) {
  const { record, result, scores, kind, own, daily, hexagrams } = ctx
  const { present, future, lines } = result
  const changingIdx = lines.map((l, i) => (l.changing ? i : -1)).filter(i => i >= 0)
  const futureLines = lines.map(l => ({ yin: l.changing ? !l.yin : l.yin, changing: false }))
  const feedback = Array.isArray(record.feedback) ? record.feedback : []
  const isPastDay = new Date(record.time).toDateString() !== new Date().toDateString()
  // 有輸入所求時是「求卦」，只看卦象，不顯示問事的評分與回饋
  const asking = Boolean(record.question)
  if (asking) ctx.seek = seekInfo(record, result, ctx.categories)
  const openFeedback = own && !asking && (ctx.focusFeedback || (isPastDay && !feedback.some(v => typeof v === 'boolean')))

  const good = scores.filter(s => s.level === 'good').sort((a, b) => b.score - a.score)
  const bad = scores.filter(s => s.level === 'bad').sort((a, b) => a.score - b.score)
  const fair = scores.length - good.length - bad.length
  const listText = (arr, cls = '') => (arr.length
    ? arr.map(s => `<span class="nw"><b class="${cls}">${esc(s.name)}</b>（${s.score}）</span>`).join(' · ')
    : '—')
  const meta = kind === 'shared' ? '分享' : methodName(record.method)

  const node = mount(`
    <section class="result">
      <div class="topbar"><a href="#/">← 返回首頁</a><span>${meta}${changingIdx.length ? ` · ${changingIdx.length} 爻動` : ' · 無動爻'}</span></div>

      <header class="r-head">
        <div>
          <p class="kicker">${KIND_LABEL[kind]}</p>
          <h1>${esc(fullName(present))}</h1>
          ${record.question ? `<p class="ask-line">所求：${esc(record.question)}</p>` : ''}
          <p class="sub">${kind === 'shared' ? `起卦日期：${formatDate(record.time)}` : `起卦時間：${formatTime(record.time)}`}</p>
        </div>
        <div class="no-box">第<b>${present.number}</b>卦</div>
      </header>

      ${omenHTML(kind, daily)}

      <blockquote class="motto">
        <p class="kicker">今日一句</p>
        <p class="motto-text">${esc(present.motto)}</p>
        <cite>My易經 · Might Easying</cite>
      </blockquote>

      ${asking ? seekHTML(ctx.seek) : ''}

      ${asking ? '' : `<section>
        <div class="sec-head"><h2>諸事評分</h2><span>宜 ${good.length} · 平 ${fair} · 忌 ${bad.length}</span></div>
        <p class="summary">宜：${listText(good)}<br>忌：${listText(bad, 'bad')}</p>
        ${categoriesHTML(ctx.categories)}
        <div class="score-grid">
          ${scores.map((s, i) => {
            const stamp = stampFor(s)
            return `
            <button class="score ${s.level}" type="button" aria-expanded="false" aria-controls="score-detail" style="animation-delay:${0.1 + i * 0.07}s">
              <span class="score-name">${esc(s.name)}<small class="cats">${catLabel(s)}</small></span>
              <span class="chip">${LEVEL[s.level]}</span>
              <span class="num"><b>${s.score}</b><small>/100</small></span>
              <span class="meter" aria-hidden="true"><i style="width:${s.score}%"></i></span>
              <span class="mix">本卦 ${s.present} · ${s.future === null ? '無變卦' : `變卦 ${s.future}`}</span>
              <span class="tip">${esc(tipFor(s, s.level))}</span>
              <span class="more" aria-hidden="true">${storyFor(s, s.level) ? '看故事' : '看說明'}</span>
              ${stamp ? `<span class="stamp${stamp.length > 3 ? ' long' : ''}">${stamp}</span>` : ''}
            </button>`
          }).join('')}
        </div>
        <p class="fine note">點任一項可展開白話說明與小故事。每件事由主分類（七成）與副分類（三成）組成；六類各有專屬規則，有規則加減的類別標上圓點。僅供參考，請依實際情況判斷。</p>
      </section>`}

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
          ${own && !asking ? feedbackHTML(scores, feedback, openFeedback) : ''}

          <details class="card"${openFeedback ? '' : ' open'}>
            <summary>六爻擲錢紀錄</summary>
            <div class="details-body">
              <div class="table-wrap"><table class="toss-table">
                <thead><tr><th>爻位</th><th>三錢結果</th><th>數值</th><th>爻性</th></tr></thead>
                <tbody>${[5, 4, 3, 2, 1, 0].map(i => `
                  <tr class="${lines[i].changing ? 'changing' : ''}">
                    <td>${LINE_POS[i]}</td>
                    <td>${Array.isArray(record.coins?.[i]) ? record.coins[i].map(v => COIN_FACE[v] ?? '?').join(' · ') : '—'}</td>
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
              <ol class="yao-list">${[5, 4, 3, 2, 1, 0].map(i =>
                `<li class="${lines[i].changing ? 'changing' : ''}">${esc(present.lines[i])}</li>`).join('')}</ol>
            </div>
          </details>

          ${own ? `
          <details class="card">
            <summary>手動輸入六爻</summary>
            <div class="details-body">
              <form class="manual">
                <p>自己擲了硬幣？由上爻往下填入爻值，即可成卦並存入紀錄。</p>
                ${[5, 4, 3, 2, 1, 0].map(i => `
                  <label>${LINE_POS[i]}
                    <select name="l${i}" id="manual-l${i}">${[7, 8, 9, 6].map(v =>
                      `<option value="${v}"${lines[i].value === v ? ' selected' : ''}>${v} · ${LINE_KIND[v]}</option>`).join('')}
                    </select>
                  </label>`).join('')}
                <button class="btn" type="submit">以此六爻成卦</button>
              </form>
            </div>
          </details>` : ''}

          <details class="card">
            <summary>起卦方法說明</summary>
            <div class="details-body">
              <p>三枚硬幣同擲，正面（字面）記 2、背面記 3，加總得 6、7、8、9。</p>
              <p>6 老陰、9 老陽為變爻，會陰陽互換形成變卦；7 少陽、8 少陰不變。</p>
              <p>共擲六次，由下往上排成六爻，得本卦；有變爻再得變卦。</p>
              <p>事項動畫中的篆字取自「敬峰中山王篆」字型（劉敬峰，SIL OFL 1.1），為戰國中山國銅器金文風格。</p>
            </div>
          </details>
        </aside>
      </div>

      <div class="r-actions">
        <p class="fine hint">${own ? '每次起卦都會自動保存到歷史紀錄。' : '分享連結只帶六爻與日期，打開的人看到的是同一卦。'}</p>
        <button class="btn primary" type="button" data-share>分享連結</button>
        <button class="btn" type="button" data-copy>複製完整卦象</button>
        <a class="btn" href="#/cast">${own ? '再起一卦' : '我也起一卦'}</a>
        <a class="push" href="#/history">查看歷史紀錄 →</a>
      </div>
      <p class="fine">卦象由本機亂數產生，僅供娛樂與自省，不構成任何決策建議。</p>
    </section>`)

  if (asking) setupSeek(node, ctx.seek)
  else setupScoreDetail(node.querySelector('.score-grid'), scores, result)

  node.querySelector('[data-share]').addEventListener('click', async () => {
    await copyToClipboard(shareURL(ctx.code))
    toast('已複製分享連結')
  })
  node.querySelector('[data-copy]').addEventListener('click', async () => {
    await copyToClipboard(copyText(ctx))
    toast('已複製完整卦象')
  })

  if (!own) return

  node.querySelector('.manual').addEventListener('submit', e => {
    e.preventDefault()
    const form = new FormData(e.currentTarget)
    const values = [0, 1, 2, 3, 4, 5].map(i => Number(form.get(`l${i}`)))
    const before = unlockedNow(hexagrams)
    const rec = addRecord('manual', values, null, record.question || '')
    inkBurst(innerWidth / 2, innerHeight * 0.35, 1)
    location.hash = `#/r/${rec.id}`
    announceUnlocks(hexagrams, before)
  })

  const fb = [...feedback]
  const fbBox = node.querySelector('#feedback')
  if (!fbBox) return
  fbBox.addEventListener('click', e => {
    const btn = e.target.closest('.fb-btn')
    if (!btn) return
    const i = Number(btn.dataset.i)
    const v = btn.dataset.v === '1'
    fb[i] = fb[i] === v ? null : v
    const before = unlockedNow(hexagrams)
    updateRecord(record.id, { feedback: fb })
    fbBox.querySelectorAll(`.fb-btn[data-i="${i}"]`).forEach(b => b.setAttribute('aria-pressed', String(fb[i] === (b.dataset.v === '1'))))
    fbBox.querySelector('.fb-count').textContent = `${fb.filter(x => typeof x === 'boolean').length}/${scores.length}`
    announceUnlocks(hexagrams, before)
  })
  if (ctx.focusFeedback) fbBox.scrollIntoView({ block: 'center', behavior: reduceMotion.matches ? 'auto' : 'smooth' })
}

/** 自己的卦例 */
export async function renderResult(token, id, { focusFeedback = false } = {}) {
  const history = loadHistory()
  const record = history.find(r => r.id === id)
  if (!record) {
    toast('找不到這則卦例')
    location.replace('#/')
    return
  }
  const hexagrams = await loadHexagrams()
  if (isStale(token)) return
  const ev = evaluate(hexagrams, record)
  if (!ev) {
    toast('這則卦例資料有誤')
    location.replace('#/')
    return
  }
  const kind = castKind(history, record)
  renderView({
    ...ev,
    record,
    kind,
    own: true,
    hexagrams,
    focusFeedback,
    daily: kind === 'again' || kind === 'profane' ? todayDaily(history, record.time) : null,
    code: shareCode(record),
  })
}

/** 朋友分享的卦（不存進紀錄） */
export async function renderShared(token, code) {
  const data = decodeShare(code)
  const sel = data && codeToSel(data.sel)
  if (!sel) {
    toast('分享連結無效')
    location.replace('#/')
    return
  }
  const hexagrams = await loadHexagrams()
  if (isStale(token)) return
  const record = { id: 'shared', time: data.time, method: 'coin', values: data.values, coins: null, sel, items: resolveSel(sel) }
  if (data.streak > 1) record.streak = data.streak
  const ev = evaluate(hexagrams, record)
  renderView({ ...ev, record, kind: 'shared', own: false, hexagrams, daily: null, code: shareCode(record) })
}
