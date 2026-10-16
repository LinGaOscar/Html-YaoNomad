'use strict'

/**
 * 水墨粒子背景：墨點沿流場漂移、留下淡淡墨痕；起卦時向中心聚攏，成卦時暈開。
 * 平時三種主題循環（各 40 秒，切換時 5 秒內漸變，角落短暫浮出主題名）：
 * - 雲湧：墨點隨橫向起伏的氣流翻湧，雲霧加濃；氣流方向每輪左右交替
 * - 崑崙：墨點沿層疊山脊沉積成山形，少數如雪緩緩飄落；山形緩緩往左捲動
 * - 明鏡：墨點繞畫面中心靜靜成環，環徑呼吸般縮放，水面不時盪開漣漪
 * 只負責視覺，與卜卦邏輯無關。
 */

const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)')

let canvas, ctx, w = 0, h = 0, dpr = 1
let particles = []
let blooms = []
let mode = 'calm'
let inkRGB = '38,48,43'
let pointer = { x: -9999, y: -9999 }
let running = false
let t = 0

const THEMES = [
  { name: '雲湧', mist: 2.2, mistSize: 1.7 },
  { name: '崑崙', mist: 0.8, mistSize: 1 },
  { name: '明鏡', mist: 0.45, mistSize: 1 },
]
const THEME_SEC = 40
const FADE_SEC = 5
const LABEL_SEC = 7
const clock0 = performance.now()
let ripples = []
let lastRipple = 0

const smooth = x => x * x * (3 - 2 * x)
/** 目前主題、上一個主題與漸變權重（0 → 1） */
function themeState() {
  const sec = (performance.now() - clock0) / 1000
  const n = Math.floor(sec / THEME_SEC)
  const local = sec - n * THEME_SEC
  return { n, cur: n % THEMES.length, prev: (n + THEMES.length - 1) % THEMES.length, k: n === 0 ? 1 : smooth(Math.min(1, local / FADE_SEC)), local, first: n === 0 }
}

/** 雲湧的氣流方向：每輪雲湧左右交替（1 往右、-1 往左） */
let wind = 1

/** 崑崙：三層山脊的高度（layer -1 最遠最高）；1 − |sin| 讓山峰尖、山谷圓。
 * 山形隨時間往左捲動，近山快、遠山慢，像行旅中看山 */
const ridge = (x, layer) => {
  x += t * (0.3 - (1 - layer) * 0.1)
  const peaks = 1 - Math.abs(Math.sin(x * (0.0042 - layer * 0.0008) + layer * 1.9))
  return h * (0.5 + layer * 0.09) - h * (0.13 - layer * 0.025) * peaks ** 1.6 - h * 0.012 * Math.sin(x * 0.02 + layer)
}

/** 各主題對單一墨點的加速度 */
function themeForce(i, p) {
  const frac = (p.seed % 1 + 1) % 1
  if (i === 0) {
    // 雲湧：橫向氣流（方向見 wind），上下翻捲
    const roll = Math.sin(p.y * 0.008 + t * 0.006 + p.seed) * 0.02
    return {
      ax: 0.022 * wind + roll,
      ay: Math.sin(p.x * 0.005 - t * 0.007 + p.seed) * 0.022 - 0.002,
    }
  }
  if (i === 1) {
    // 崑崙：四分之一的墨點如雪飄落，其餘沉到所屬山脊
    if (frac < 0.25) return { ax: Math.sin(t * 0.01 + p.seed) * 0.006, ay: 0.012 }
    const layer = Math.min(1, Math.floor((frac - 0.25) / 0.25) - 1) // -1、0、1 三層
    const ty = ridge(p.x, layer) + (frac * 97 % 1) * 40
    return { ax: 0.007, ay: Math.max(-0.08, Math.min(0.08, (ty - p.y) * 0.003)) - p.vy * 0.04 }
  }
  // 明鏡：繞中心成環，環徑如呼吸般緩緩縮放（約 10 秒一息）
  const cx = w / 2
  const cy = h * 0.42
  const R = (0.12 + frac * 0.42) * Math.min(w, h) * (1 + 0.12 * Math.sin(t * 0.01))
  const dx = p.x - cx
  const dy = p.y - cy
  const d = Math.hypot(dx, dy) || 1
  const pull = (R - d) * 0.0009
  return { ax: (dx / d) * pull + (-dy / d) * 0.012, ay: (dy / d) * pull + (dx / d) * 0.012 }
}

export function initInk(el) {
  canvas = el
  ctx = canvas.getContext('2d')
  resize()
  refreshColor()
  addEventListener('resize', resize)
  addEventListener('pointermove', e => { pointer.x = e.clientX; pointer.y = e.clientY })
  addEventListener('pointerleave', () => { pointer.x = pointer.y = -9999 })
  document.addEventListener('visibilitychange', () => (document.hidden ? stop() : start()))
  start()
}

/** 主題切換後重新讀取墨色 */
export function refreshColor() {
  const dark = getComputedStyle(document.documentElement).colorScheme === 'dark'
  inkRGB = dark ? '214,203,180' : '38,48,43'
}

/** 'calm'：漂移；'gather'：向中心旋聚 */
export function setInkMode(next) {
  mode = next
}

/** 在 (x, y) 暈開一團墨；未指定則為畫面中心偏上 */
export function inkBurst(x = w / 2, y = h * 0.4, strength = 1) {
  if (reduceMotion.matches) return
  for (const p of particles) {
    const dx = p.x - x
    const dy = p.y - y
    const d = Math.hypot(dx, dy) || 1
    const f = (6 * strength) / Math.max(1, d / 120)
    p.vx += (dx / d) * f
    p.vy += (dy / d) * f
  }
  const n = Math.round(4 + 4 * strength)
  for (let i = 0; i < n; i++) {
    const a = Math.random() * Math.PI * 2
    const r = Math.random() * 60 * strength
    blooms.push(makeBloom(x + Math.cos(a) * r, y + Math.sin(a) * r, 40 + Math.random() * 90 * strength))
  }
}

/**
 * 背景音樂的節拍同步（audio.js 在音符真正發聲的時刻呼叫）：
 * kick 大鼓 → 墨點自中心輕輕一震；wood 木魚 → 中心一圈小漣漪；
 * note 主旋律古箏 → 依音高由左到右落一點墨，形態隨主題（雲湧暈開、崑崙落在山脊、明鏡盪成小漣漪）
 */
export function inkBeat(kind, { midi = 64, vel = 0.2 } = {}) {
  if (reduceMotion.matches || mode === 'gather' || !w) return
  const cx = w / 2
  const cy = h * 0.42
  if (kind === 'kick') {
    for (const p of particles) {
      const dx = p.x - cx
      const dy = p.y - cy
      const d = Math.hypot(dx, dy) || 1
      const f = 0.9 / Math.max(1, d / 220)
      p.vx += (dx / d) * f
      p.vy += (dy / d) * f
    }
    return
  }
  if (kind === 'wood') {
    ripples.push({ x: cx, y: cy, age: 0, life: 70, size: 0.12 })
    return
  }
  // 音高 52–86 對應畫面寬度 12%–88%
  const x = w * (0.12 + 0.76 * Math.min(1, Math.max(0, (midi - 52) / 34))) + (Math.random() - 0.5) * 30
  const th = themeState()
  const theme = th.k > 0.5 ? th.cur : th.prev
  const strength = Math.min(1, vel / 0.24)
  if (theme === 1) {
    const y = ridge(x, midi > 70 ? -1 : midi > 60 ? 0 : 1)
    blooms.push(makeBloom(x, y, 18 + 40 * strength))
  } else if (theme === 2) {
    ripples.push({ x, y: cy + (Math.random() - 0.5) * h * 0.2, age: 0, life: 120, size: 0.1 + 0.08 * strength })
  } else {
    blooms.push(makeBloom(x, h * (0.18 + Math.random() * 0.4), 24 + 60 * strength))
  }
}

function makeBloom(x, y, max) {
  // 每團墨由數個偏移的圓疊成，邊緣不規則
  const lobes = Array.from({ length: 5 }, () => ({
    ox: (Math.random() - 0.5) * 0.6,
    oy: (Math.random() - 0.5) * 0.6,
    s: 0.5 + Math.random() * 0.5,
  }))
  return { x, y, max, age: 0, life: 110 + Math.random() * 60, lobes }
}

function resize() {
  dpr = Math.min(devicePixelRatio || 1, 2)
  w = innerWidth
  h = innerHeight
  canvas.width = Math.round(w * dpr)
  canvas.height = Math.round(h * dpr)
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
  const target = Math.max(36, Math.min(120, Math.round((w * h) / 12000)))
  while (particles.length < target) particles.push(makeParticle(true))
  particles.length = target
}

function makeParticle(anywhere) {
  const mist = Math.random() < 0.12
  return {
    x: Math.random() * w,
    y: anywhere ? Math.random() * h : h + 10,
    vx: 0,
    vy: 0,
    r: mist ? 10 + Math.random() * 26 : 0.8 + Math.random() * 2.4,
    a: mist ? 0.03 + Math.random() * 0.04 : 0.18 + Math.random() * 0.32,
    mist,
    seed: Math.random() * 1000,
    trail: [],
  }
}

function start() {
  if (running || !ctx) return
  running = true
  requestAnimationFrame(frame)
}

function stop() {
  running = false
}

function frame() {
  if (!running) return
  t += reduceMotion.matches ? 0.2 : 1
  step()
  draw()
  requestAnimationFrame(frame)
}

function step() {
  const cx = w / 2
  const cy = h * 0.4
  const speed = reduceMotion.matches ? 0.15 : 1
  const trailLen = mode === 'gather' ? 16 : 7
  const th = themeState()
  const cloudRound = Math.floor((th.cur === 0 ? th.n : th.n - 1) / THEMES.length)
  wind = cloudRound % 2 ? -1 : 1
  for (const p of particles) {
    // 流場：平滑的正弦組合，模擬水流中墨的飄移；再疊上主題的力（切換時新舊主題漸變）
    const ang = Math.sin(p.x * 0.0021 + t * 0.0021 + p.seed) * Math.cos(p.y * 0.0018 - t * 0.0016) * Math.PI
    let ax = Math.cos(ang) * 0.008
    let ay = Math.sin(ang) * 0.008
    if (mode !== 'gather') {
      const a = themeForce(th.cur, p)
      const b = th.k < 1 ? themeForce(th.prev, p) : a
      ax += a.ax * th.k + b.ax * (1 - th.k)
      ay += a.ay * th.k + b.ay * (1 - th.k)
    } else {
      ax += Math.cos(ang) * 0.012
      ay += Math.sin(ang) * 0.012 - 0.006
    }

    if (mode === 'gather') {
      const dx = cx - p.x
      const dy = cy - p.y
      const d = Math.hypot(dx, dy) || 1
      ax += (dx / d) * 0.09 + (-dy / d) * 0.12
      ay += (dy / d) * 0.09 + (dx / d) * 0.12
    }

    const px = p.x - pointer.x
    const py = p.y - pointer.y
    const pd = Math.hypot(px, py)
    if (pd < 110 && pd > 0) {
      ax += (px / pd) * 0.25 * (1 - pd / 110)
      ay += (py / pd) * 0.25 * (1 - pd / 110)
    }

    p.vx = (p.vx + ax) * 0.965
    p.vy = (p.vy + ay) * 0.965
    p.x += p.vx * speed * (p.mist ? 0.6 : 1)
    p.y += p.vy * speed * (p.mist ? 0.6 : 1)

    const m = p.r + 20
    let wrapped = false
    if (p.x < -m) { p.x = w + m; wrapped = true }
    if (p.x > w + m) { p.x = -m; wrapped = true }
    if (p.y < -m) { p.y = h + m; wrapped = true }
    if (p.y > h + m) { p.y = -m; wrapped = true }

    if (!p.mist) {
      if (wrapped) p.trail.length = 0
      p.trail.push({ x: p.x, y: p.y })
      if (p.trail.length > trailLen) p.trail.splice(0, p.trail.length - trailLen)
    }
  }
  for (const b of blooms) b.age++
  blooms = blooms.filter(b => b.age < b.life)

  // 明鏡：每隔幾秒在中心附近盪開一圈漣漪
  if (mode !== 'gather' && th.cur === 2 && th.k > 0.5 && t - lastRipple > 240) {
    lastRipple = t
    ripples.push({ x: w / 2 + (Math.random() - 0.5) * w * 0.2, y: h * 0.42 + (Math.random() - 0.5) * h * 0.1, age: 0, life: 360, size: 0.5 })
  }
  for (const r of ripples) r.age++
  ripples = ripples.filter(r => r.age < r.life)
}

function draw() {
  ctx.clearRect(0, 0, w, h)
  const th = themeState()
  const mistGain = THEMES[th.cur].mist * th.k + THEMES[th.prev].mist * (1 - th.k)
  const mistSize = THEMES[th.cur].mistSize * th.k + THEMES[th.prev].mistSize * (1 - th.k)

  ctx.lineWidth = 1
  for (const r of ripples) {
    const k = r.age / r.life
    const rx = 12 + k * Math.min(w, h) * r.size
    ctx.strokeStyle = `rgba(${inkRGB},${0.2 * (1 - k)})`
    ctx.beginPath()
    ctx.ellipse(r.x, r.y, rx, rx * 0.35, 0, 0, Math.PI * 2)
    ctx.stroke()
  }

  // 崑崙：淡墨勾出三層山脊
  const kunlun = th.cur === 1 ? th.k : th.prev === 1 ? 1 - th.k : 0
  if (kunlun > 0.01 && mode !== 'gather') {
    for (let layer = -1; layer <= 1; layer++) {
      ctx.strokeStyle = `rgba(${inkRGB},${0.07 * kunlun * (1.4 - (layer + 1) * 0.35)})`
      ctx.lineWidth = 1.6 - layer * 0.4
      ctx.beginPath()
      for (let x = 0; x <= w; x += 12) {
        const y = ridge(x, layer)
        if (x === 0) ctx.moveTo(x, y)
        else ctx.lineTo(x, y)
      }
      ctx.stroke()
    }
  }

  // 主題名：切換後在右下角淡淡浮現幾秒
  if (th.local < LABEL_SEC && !th.first) {
    const a = Math.sin(Math.PI * th.local / LABEL_SEC) * 0.32
    ctx.fillStyle = `rgba(${inkRGB},${a})`
    ctx.font = '500 15px "Noto Serif TC", serif'
    ctx.textAlign = 'right'
    ctx.fillText(THEMES[th.cur].name.split('').join(' '), w - 20, h - 18)
  }

  for (const b of blooms) {
    const k = b.age / b.life
    const r = b.max * (1 - Math.pow(1 - Math.min(1, k * 1.6), 3))
    const alpha = 0.07 * (1 - k)
    for (const l of b.lobes) {
      const x = b.x + l.ox * r
      const y = b.y + l.oy * r
      const rr = r * l.s
      const g = ctx.createRadialGradient(x, y, 0, x, y, rr)
      g.addColorStop(0, `rgba(${inkRGB},${alpha})`)
      g.addColorStop(1, `rgba(${inkRGB},0)`)
      ctx.fillStyle = g
      ctx.beginPath()
      ctx.arc(x, y, rr, 0, Math.PI * 2)
      ctx.fill()
    }
  }

  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'
  for (const p of particles) {
    if (p.mist) {
      const r = p.r * mistSize
      const g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, r)
      g.addColorStop(0, `rgba(${inkRGB},${Math.min(0.2, p.a * mistGain)})`)
      g.addColorStop(1, `rgba(${inkRGB},0)`)
      ctx.fillStyle = g
      ctx.beginPath()
      ctx.arc(p.x, p.y, r, 0, Math.PI * 2)
      ctx.fill()
      continue
    }
    // 墨痕：以最近幾幀位置畫一筆淡淡的拖尾
    const tr = p.trail
    if (tr.length > 2) {
      ctx.strokeStyle = `rgba(${inkRGB},${p.a * 0.35})`
      ctx.lineWidth = p.r * 1.4
      ctx.beginPath()
      ctx.moveTo(tr[0].x, tr[0].y)
      for (let i = 1; i < tr.length; i++) ctx.lineTo(tr[i].x, tr[i].y)
      ctx.stroke()
    }
    const g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.r * 1.8)
    g.addColorStop(0, `rgba(${inkRGB},${p.a})`)
    g.addColorStop(0.5, `rgba(${inkRGB},${p.a * 0.6})`)
    g.addColorStop(1, `rgba(${inkRGB},0)`)
    ctx.fillStyle = g
    ctx.beginPath()
    ctx.arc(p.x, p.y, p.r * 1.8, 0, Math.PI * 2)
    ctx.fill()
  }
}
