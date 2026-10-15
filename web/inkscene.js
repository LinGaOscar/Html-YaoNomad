'use strict'

/**
 * 事項展開面板的水墨粒子循環動畫（通用）：
 * 墨點依「主分類」的方式流動 → 聚成代表字的篆字（中山王篆，金文）→ 流動變形成今字（明體）→ 化開，無縫循環；
 * 一圈裡看得到字從金文演變到現代字。
 * 每個墨點的位置都直接由時間算出（不累積狀態），所以每一圈完全相同，看起來像一張循環 GIF；
 * 新增事項只要給一個代表字。純視覺，與評分無關。
 */

const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)')
const PERIOD = 9000
const TAU = Math.PI * 2
const SEAL_FAMILY = 'YaoNomad Seal'
const SEAL_FONT = `"${SEAL_FAMILY}"`
/** 今字（明體）字型；篆字字型無法載入時只顯示今字 */
const MODERN_FONT = '"Noto Serif TC", "Songti TC", "PMingLiU", "MingLiU", "STSong", serif'

// 一圈的時間軸（0–1）：流動 → 聚成篆字（GATHER）→ 停留 → 化為今字（MORPH）→ 停留 → 化開（RELEASE）→ 流動
const GATHER = [0.18, 0.32]
const MORPH = [0.48, 0.58]
const RELEASE = [0.76, 0.9]
const MAX_DELAY = 0.06
const MORPH_DELAY = 0.04
const STILL_U = 0.4 // 減少動態模式停在篆字成形時

/** 色票轉成 #rrggbb，方便在漸層裡加透明度 */
function toHex(color) {
  if (/^#[0-9a-f]{6}$/i.test(color)) return color
  const c = document.createElement('canvas').getContext('2d')
  c.fillStyle = color
  const v = c.fillStyle
  return /^#[0-9a-f]{6}$/i.test(v) ? v : '#25302a'
}

const smooth = x => (x <= 0 ? 0 : x >= 1 ? 1 : x * x * (3 - 2 * x))
const frac = x => x - Math.floor(x)

/** 聚字權重：0 = 自由流動，1 = 停在字上；delay 讓墨點錯開，形成筆順或掃描感 */
function weight(u, delay) {
  if (u < GATHER[1] + delay) return smooth((u - GATHER[0] - delay) / (GATHER[1] - GATHER[0]))
  return 1 - smooth((u - RELEASE[0] - delay) / (RELEASE[1] - RELEASE[0]))
}

function rng(seed) {
  let t = seed >>> 0
  return () => {
    t = (t + 0x6d2b79f5) >>> 0
    let r = Math.imul(t ^ (t >>> 15), 1 | t)
    r = (r + Math.imul(r ^ (r >>> 7), 61 | r)) ^ r
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296
  }
}

/** 依字形的實際外框縮放並置中（篆字多半修長），回傳字級與基線位置 */
function layout(g, ch, W, H, font, weight) {
  const probe = 100
  g.font = `${weight} ${probe}px ${font}`
  const m = g.measureText(ch)
  const left = m.actualBoundingBoxLeft || 0
  const right = m.actualBoundingBoxRight || probe
  const ascent = m.actualBoundingBoxAscent || probe * 0.8
  const descent = m.actualBoundingBoxDescent || probe * 0.2
  const scale = Math.min((W * 0.62) / (left + right), (H * 0.84) / (ascent + descent))
  return {
    font: `${weight} ${probe * scale}px ${font}`,
    size: probe * scale,
    x: W / 2 - ((right - left) / 2) * scale,
    y: H / 2 + ((ascent - descent) / 2) * scale,
  }
}

function drawGlyph(g, ch, lay) {
  g.font = lay.font
  g.textAlign = 'left'
  g.textBaseline = 'alphabetic'
  g.fillText(ch, lay.x, lay.y)
}

/** 把字畫在離屏畫布上，取出筆畫上的點；篆字筆畫細，取點較密 */
function sampleGlyph(ch, W, H, font, weight) {
  const c = document.createElement('canvas')
  c.width = Math.max(1, Math.round(W))
  c.height = Math.max(1, Math.round(H))
  const g = c.getContext('2d', { willReadFrequently: true })
  const lay = layout(g, ch, W, H, font, weight)
  drawGlyph(g, ch, lay)
  const { data } = g.getImageData(0, 0, c.width, c.height)
  const step = Math.max(2, Math.round(Math.min(W, H) / 70))
  const pts = []
  for (let y = 0; y < c.height; y += step) {
    for (let x = 0; x < c.width; x += step) {
      if (data[(y * c.width + x) * 4 + 3] > 110) pts.push([x, y])
    }
  }
  return { pts, lay, ch }
}

/** 依繞字心的角度排序，再取 n 個點；篆字與今字用同樣的順序對應，變形時墨點沿角度流動 */
function orderedPoints(pts, n) {
  if (!pts.length) return []
  let cx = 0
  let cy = 0
  for (const [x, y] of pts) {
    cx += x
    cy += y
  }
  cx /= pts.length
  cy /= pts.length
  const sorted = pts.map(([x, y]) => [x, y, Math.atan2(y - cy, x - cx)]).sort((a, b) => a[2] - b[2])
  return Array.from({ length: n }, (_, i) => sorted[Math.floor((i * sorted.length) / n)])
}

/** 柔邊墨點貼圖：中心濃、邊緣化開，比逐點畫圓更像墨也更省效能 */
function inkSprite(color) {
  const c = document.createElement('canvas')
  c.width = c.height = 32
  const g = c.getContext('2d')
  const grad = g.createRadialGradient(16, 16, 0, 16, 16, 16)
  grad.addColorStop(0, color)
  grad.addColorStop(0.38, color)
  grad.addColorStop(0.62, color + '8c')
  grad.addColorStop(1, color + '00')
  g.fillStyle = grad
  g.fillRect(0, 0, 32, 32)
  return c
}

/** 停留時的暈墨：同一個字加上大範圍陰影模糊，預先畫好 */
function renderHalo(ch, W, H, lay, color, dpr) {
  const c = document.createElement('canvas')
  c.width = Math.round(W * dpr)
  c.height = Math.round(H * dpr)
  const g = c.getContext('2d')
  g.scale(dpr, dpr)
  g.fillStyle = color
  g.shadowColor = color
  g.shadowBlur = lay.size * 0.1
  drawGlyph(g, ch, lay)
  return c
}

const sealReady = () => [...document.fonts].some(f => f.family.replace(/["']/g, '') === SEAL_FAMILY && f.status === 'loaded')

/**
 * 各主分類的自由流動：回傳 [x, y, 透明度係數, 大小係數]。θ 每圈走 2π，所以都是週期函數。
 * 0 溝通：三群墨點輪流「說話」，有墨點在群間傳遞
 * 1 分析：墨點排成一行行字，一枚透鏡掃過放大
 * 2 創意：黃金角螺旋向外綻放
 * 3 例行：三圈同心軌道規律轉動
 * 4 時運：墨點像銅錢雨落下，金色錢幣翻轉
 * 5 休養：一團墨雲緩慢呼吸，漣漪擴散
 */
function freeMotion(cat, p, θ, W, H) {
  const cx = W / 2
  const cy = H / 2
  const R = Math.min(W, H) * 0.42
  switch (cat) {
    case 0: {
      const g = p.i % 3
      const ga = (g * TAU) / 3 - Math.PI / 2
      const gx = cx + Math.cos(ga) * R * 0.62
      const gy = cy + Math.sin(ga) * R * 0.5
      if (p.s < 0.12) {
        const ng = ((g + 1) * TAU) / 3 - Math.PI / 2
        const k = frac(p.s2 + θ / TAU * 2)
        const x = gx + (cx + Math.cos(ng) * R * 0.62 - gx) * k
        const y = gy + (cy + Math.sin(ng) * R * 0.5 - gy) * k - Math.sin(Math.PI * k) * R * 0.25
        return [x, y, Math.sin(Math.PI * k), 1]
      }
      const talk = Math.max(0, Math.sin(θ - (g * TAU) / 3)) ** 2
      const r = R * (0.08 + 0.22 * p.s2 * (1 + 0.9 * talk))
      const a = p.a + θ * (1 + (p.i % 2))
      return [gx + Math.cos(a) * r, gy + Math.sin(a) * r * 0.8, 0.55 + 0.45 * talk, 1]
    }
    case 1: {
      const rows = 7
      const row = p.i % rows
      const y = H * 0.16 + (row * H * 0.68) / (rows - 1)
      const k = frac(p.s + θ / TAU)
      let x = W * (k * 1.1 - 0.05)
      let yy = y
      const lx = cx + Math.cos(θ) * R * 0.95
      const ly = cy + Math.sin(θ * 2) * R * 0.35
      const d = Math.hypot(x - lx, yy - ly)
      let boost = 0
      if (d < R * 0.32) {
        boost = 1 - d / (R * 0.32)
        x = lx + (x - lx) * (1 + 0.45 * boost)
        yy = ly + (yy - ly) * (1 + 0.45 * boost)
      }
      return [x, yy, Math.sin(Math.PI * k) * (0.5 + 0.5 * boost), 1 + boost * 0.6]
    }
    case 2: {
      const k = frac(p.s + θ / TAU)
      const r = R * 1.1 * k
      const a = p.i * 2.39996 + θ * 2 + k * 3
      return [cx + Math.cos(a) * r, cy + Math.sin(a) * r * 0.85, Math.sin(Math.PI * k), 0.6 + 1.1 * k]
    }
    case 3: {
      const ring = p.i % 3
      const r = R * (0.38 + ring * 0.3)
      const dir = ring % 2 ? -1 : 1
      const a = p.a + dir * θ * (ring + 1)
      return [cx + Math.cos(a) * r, cy + Math.sin(a) * r * 0.7, 0.85, 1]
    }
    case 4: {
      const k = frac(p.s2 + (θ / TAU) * (1 + (p.i % 2)))
      const x = W * (0.06 + 0.88 * p.s) + Math.sin(θ * 2 + p.a) * 6
      const y = -12 + (H + 24) * k
      return [x, y, Math.min(1, Math.sin(Math.PI * k) * 1.6), 1]
    }
    default: {
      if (p.s < 0.14) {
        const k = frac(p.s2 + θ / TAU)
        const a = p.a
        return [cx + Math.cos(a) * R * 1.15 * k, cy + Math.sin(a) * R * 0.8 * k, (1 - k) * 0.9, 0.9]
      }
      const r = R * (0.2 + 0.55 * Math.sqrt(p.s2)) * (1 + 0.14 * Math.sin(θ))
      const a = p.a + θ * (p.i % 2 ? 1 : -1)
      return [cx + Math.cos(a) * r, cy + Math.sin(a) * r * 0.62, 0.75, 1]
    }
  }
}

/** 聚字時的路徑弧度（垂直偏移量），以及錯開方式 */
const ARC = [10, 0, 46, 6, 26, 14]
function delayFor(cat, p, W, H) {
  switch (cat) {
    case 0: return (p.i % 3) * 0.03 // 三群依序
    case 1: return (p.tx / W) * MAX_DELAY // 由左往右掃
    case 3: return (p.ty / H) * MAX_DELAY // 由上而下，像筆順
    default: return p.s * MAX_DELAY * 0.7
  }
}

/**
 * 在 canvas 上播放循環動畫
 * @param {HTMLCanvasElement} canvas - 尺寸由 CSS 決定
 * @param {{ glyph: string, seal?: string, cat: number, level: 'good'|'fair'|'bad', onPhase?: (phase: 'seal'|'modern') => void }} opts
 *   glyph：代表字（繁體，今字用）；seal：篆字字型中的字碼；onPhase：畫面在篆字／今字之間切換時呼叫
 * @returns {() => void} 停止函式；canvas 離開文件時也會自動停止
 */
export function startInkScene(canvas, { glyph, seal = glyph, cat, level, onPhase = () => {} }) {
  const ctx = canvas.getContext('2d')
  const jitter = level === 'bad' ? 1.8 : level === 'good' ? 0.4 : 0.9
  let W = 0
  let H = 0
  let dpr = 1
  let particles = []
  let shapes = null // { seal, modern }：各自的 { lay, ch }；篆字字型無法使用時 seal 為 null
  let halos = null
  let phase = null
  let sprites = null
  let colors = null
  let raf = 0
  let stopped = false
  let frameCount = 0
  const t0 = performance.now()

  const readColors = () => {
    const cs = getComputedStyle(canvas)
    const ink = cs.getPropertyValue('--text').trim() || '#25302A'
    const acc = cs.getPropertyValue('--acc').trim() || cs.getPropertyValue('--gold').trim() || ink
    const gold = cs.getPropertyValue('--gold').trim() || acc
    if (!colors || colors.ink !== ink || colors.acc !== acc) {
      colors = { ink, acc, gold }
      sprites = { ink: inkSprite(toHex(ink)), acc: inkSprite(toHex(acc)), gold: inkSprite(toHex(gold)) }
      if (W && shapes) {
        halos = {
          seal: shapes.seal && renderHalo(shapes.seal.ch, W, H, shapes.seal.lay, acc, dpr),
          modern: renderHalo(shapes.modern.ch, W, H, shapes.modern.lay, acc, dpr),
        }
      }
    }
  }

  async function setup() {
    const rect = canvas.getBoundingClientRect()
    if (!rect.width || !rect.height) return
    W = rect.width
    H = rect.height
    dpr = Math.min(devicePixelRatio || 1, 2)
    canvas.width = Math.round(W * dpr)
    canvas.height = Math.round(H * dpr)
    const timeout = new Promise(r => setTimeout(r, 1500))
    try {
      await Promise.race([
        Promise.all([document.fonts.load(`40px ${SEAL_FONT}`, seal), document.fonts.load(`700 40px "Noto Serif TC"`, glyph)]),
        timeout,
      ])
    } catch {}
    if (stopped) return
    const modern = sampleGlyph(glyph, W, H, MODERN_FONT, 700)
    const sealShape = sealReady() ? sampleGlyph(seal, W, H, SEAL_FONT, 400) : null
    shapes = { seal: sealShape, modern }
    const rand = rng(glyph.codePointAt(0) * 7 + cat)
    const glyphCount = Math.max(180, Math.min(600, Math.max(modern.pts.length, sealShape?.pts.length || 0)))
    const modernPts = orderedPoints(modern.pts, glyphCount)
    const sealPts = sealShape ? orderedPoints(sealShape.pts, glyphCount) : modernPts
    const ambient = 40
    particles = Array.from({ length: glyphCount + ambient }, (_, i) => {
      const free = i >= glyphCount
      const [sx, sy] = sealPts[i] || [W / 2, H / 2]
      const [mx, my] = modernPts[i] || [sx, sy]
      const p = {
        i,
        free,
        s: rand(),
        s2: rand(),
        a: rand() * TAU,
        tx: sx,
        ty: sy,
        mx,
        my,
        md: (i / glyphCount) * MORPH_DELAY,
        size: free ? 0.6 + rand() * 1.2 : 0.9 + rand() * 1.4,
        alpha: 0.45 + rand() * 0.5,
        acc: rand() < 0.14,
        coin: cat === 4 && rand() < 0.16,
        side: rand() < 0.5 ? -1 : 1,
      }
      p.delay = delayFor(cat, p, W, H)
      return p
    })
    colors = null
    readColors()
  }

  function draw(now) {
    const u = reduceMotion.matches ? STILL_U : ((now - t0) % PERIOD) / PERIOD
    const θ = u * TAU
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    ctx.clearRect(0, 0, W, H)

    const hasSeal = Boolean(shapes.seal)
    const next = hasSeal && u < (MORPH[0] + MORPH[1]) / 2 ? 'seal' : 'modern'
    if (next !== phase) {
      phase = next
      onPhase(phase)
    }

    const hold = weight(u, 0)
    const morph = hasSeal ? smooth((u - MORPH[0]) / (MORPH[1] - MORPH[0])) : 1
    if (halos && hold > 0) {
      if (halos.seal && morph < 1) {
        ctx.globalAlpha = 0.16 * hold * (1 - morph)
        ctx.drawImage(halos.seal, 0, 0, W, H)
      }
      if (morph > 0) {
        ctx.globalAlpha = 0.16 * hold * morph
        ctx.drawImage(halos.modern, 0, 0, W, H)
      }
    }

    for (const p of particles) {
      const [fx, fy, fa, fs] = freeMotion(cat, p, θ, W, H)
      const w = p.free ? 0 : weight(u, p.delay)
      let x = fx
      let y = fy
      if (w > 0) {
        // 目標點：篆字 → 今字
        const m = hasSeal ? smooth((u - MORPH[0] - p.md) / (MORPH[1] - MORPH[0])) : 1
        let tx = p.tx + (p.mx - p.tx) * m
        let ty = p.ty + (p.my - p.ty) * m
        if (m > 0 && m < 1) {
          const mdx = p.mx - p.tx
          const mdy = p.my - p.ty
          const mlen = Math.hypot(mdx, mdy) || 1
          const bend = Math.sin(Math.PI * m) * 12 * p.side
          tx += (-mdy / mlen) * bend
          ty += (mdx / mlen) * bend
        }
        const dx = tx - fx
        const dy = ty - fy
        const len = Math.hypot(dx, dy) || 1
        const arc = Math.sin(Math.PI * w) * ARC[cat] * p.side
        x = fx + dx * w + (-dy / len) * arc
        y = fy + dy * w + (dx / len) * arc
        if (w > 0.98 && (m < 0.02 || m > 0.98)) {
          x += Math.sin(θ * 6 + p.a) * jitter
          y += Math.cos(θ * 5 + p.a) * jitter
        }
      }
      const alpha = p.alpha * (fa + (1 - fa) * w)
      if (alpha <= 0.01) continue
      const size = p.size * (fs + (1 - fs) * w)
      ctx.globalAlpha = alpha
      if (p.coin && w < 0.5) {
        const spin = Math.abs(Math.cos(θ * 4 + p.a))
        ctx.fillStyle = colors.gold
        ctx.beginPath()
        ctx.ellipse(x, y, 3 * Math.max(0.15, spin), 3, 0, 0, TAU)
        ctx.fill()
      } else {
        const r = size * 1.6
        ctx.drawImage(p.acc ? sprites.acc : sprites.ink, x - r, y - r, r * 2, r * 2)
      }
    }
    ctx.globalAlpha = 1
  }

  function frame(now) {
    if (stopped || !canvas.isConnected) return stop()
    if (++frameCount % 45 === 0) readColors()
    if (particles.length && shapes) draw(now)
    if (!reduceMotion.matches) raf = requestAnimationFrame(frame)
  }

  const ro = new ResizeObserver(() => {
    const rect = canvas.getBoundingClientRect()
    if (Math.abs(rect.width - W) > 1 || Math.abs(rect.height - H) > 1) {
      setup().then(() => {
        if (stopped) return
        cancelAnimationFrame(raf)
        raf = requestAnimationFrame(frame)
      })
    }
  })

  function stop() {
    stopped = true
    cancelAnimationFrame(raf)
    ro.disconnect()
  }

  setup().then(() => {
    if (stopped) return
    ro.observe(canvas)
    raf = requestAnimationFrame(frame)
  })
  return stop
}
