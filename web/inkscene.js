'use strict'

/**
 * 六事展開面板的水墨粒子循環動畫（通用）：
 * 墨點依「主分類」的方式流動 → 聚成事項的代表字 → 停留暈墨 → 化開，無縫循環。
 * 每個墨點的位置都直接由時間算出（不累積狀態），所以每一圈完全相同，看起來像一張循環 GIF；
 * 新增事項只要給一個代表字。純視覺，與評分無關。
 */

const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)')
const PERIOD = 7000
const TAU = Math.PI * 2
const FONT = '"Noto Serif TC", "Songti TC", "PMingLiU", "MingLiU", "STSong", serif'

// 一圈的時間軸（0–1）：自由流動 → 聚字（GATHER）→ 停留 → 化開（RELEASE）→ 自由流動
const GATHER = [0.26, 0.44]
const RELEASE = [0.72, 0.88]
const MAX_DELAY = 0.08

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

/** 把代表字畫在離屏畫布上，取出筆畫上的點 */
function sampleGlyph(ch, W, H) {
  const c = document.createElement('canvas')
  c.width = Math.max(1, Math.round(W))
  c.height = Math.max(1, Math.round(H))
  const g = c.getContext('2d', { willReadFrequently: true })
  const size = Math.min(H * 0.78, W * 0.52)
  g.font = `700 ${size}px ${FONT}`
  g.textAlign = 'center'
  g.textBaseline = 'middle'
  g.fillText(ch, W / 2, H / 2 + size * 0.04)
  const { data } = g.getImageData(0, 0, c.width, c.height)
  const step = Math.max(2, Math.round(size / 40))
  const pts = []
  for (let y = 0; y < c.height; y += step) {
    for (let x = 0; x < c.width; x += step) {
      if (data[(y * c.width + x) * 4 + 3] > 140) pts.push([x, y])
    }
  }
  return { pts, size }
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
function renderHalo(ch, W, H, size, color, dpr) {
  const c = document.createElement('canvas')
  c.width = Math.round(W * dpr)
  c.height = Math.round(H * dpr)
  const g = c.getContext('2d')
  g.scale(dpr, dpr)
  g.font = `700 ${size}px ${FONT}`
  g.textAlign = 'center'
  g.textBaseline = 'middle'
  g.fillStyle = color
  g.shadowColor = color
  g.shadowBlur = size * 0.18
  g.fillText(ch, W / 2, H / 2 + size * 0.04)
  return c
}

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
 * @param {{ glyph: string, cat: number, level: 'good'|'fair'|'bad' }} opts
 * @returns {() => void} 停止函式；canvas 離開文件時也會自動停止
 */
export function startInkScene(canvas, { glyph, cat, level }) {
  const ctx = canvas.getContext('2d')
  const jitter = level === 'bad' ? 1.8 : level === 'good' ? 0.4 : 0.9
  let W = 0
  let H = 0
  let dpr = 1
  let particles = []
  let glyphSize = 0
  let halo = null
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
      if (W) halo = renderHalo(glyph, W, H, glyphSize, acc, dpr)
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
    try {
      await Promise.race([document.fonts.load(`700 40px "Noto Serif TC"`, glyph), new Promise(r => setTimeout(r, 1200))])
    } catch {}
    if (stopped) return
    const { pts, size } = sampleGlyph(glyph, W, H)
    const rand = rng(glyph.codePointAt(0) * 7 + cat)
    for (let i = pts.length - 1; i > 0; i--) {
      const j = Math.floor(rand() * (i + 1))
      ;[pts[i], pts[j]] = [pts[j], pts[i]]
    }
    const glyphCount = Math.max(160, Math.min(420, pts.length))
    const ambient = 40
    particles = Array.from({ length: glyphCount + ambient }, (_, i) => {
      const free = i >= glyphCount
      const [tx, ty] = pts.length ? pts[i % pts.length] : [W / 2, H / 2]
      const over = i >= pts.length && !free // 字點不夠時重複使用，稍微錯開
      const p = {
        i,
        free,
        s: rand(),
        s2: rand(),
        a: rand() * TAU,
        tx: tx + (over ? (rand() - 0.5) * 3 : 0),
        ty: ty + (over ? (rand() - 0.5) * 3 : 0),
        size: free ? 0.6 + rand() * 1.2 : 0.9 + rand() * 1.4,
        alpha: 0.45 + rand() * 0.5,
        acc: rand() < 0.14,
        coin: cat === 4 && rand() < 0.16,
        side: rand() < 0.5 ? -1 : 1,
      }
      p.delay = delayFor(cat, p, W, H)
      return p
    })
    glyphSize = size
    colors = null
    readColors()
  }

  function draw(now) {
    const u = reduceMotion.matches ? 0.58 : ((now - t0) % PERIOD) / PERIOD
    const θ = u * TAU
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    ctx.clearRect(0, 0, W, H)

    const hold = weight(u, 0)
    if (halo && hold > 0) {
      ctx.globalAlpha = 0.16 * hold
      ctx.drawImage(halo, 0, 0, W, H)
    }

    for (const p of particles) {
      const [fx, fy, fa, fs] = freeMotion(cat, p, θ, W, H)
      const w = p.free ? 0 : weight(u, p.delay)
      let x = fx
      let y = fy
      if (w > 0) {
        const dx = p.tx - fx
        const dy = p.ty - fy
        const len = Math.hypot(dx, dy) || 1
        const arc = Math.sin(Math.PI * w) * ARC[cat] * p.side
        x = fx + dx * w + (-dy / len) * arc
        y = fy + dy * w + (dx / len) * arc
        if (w > 0.98) {
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
    if (particles.length) draw(now)
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
