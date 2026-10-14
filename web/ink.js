'use strict'

/**
 * 水墨粒子背景：墨點沿流場漂移、留下淡淡墨痕；起卦時向中心聚攏，成卦時暈開。
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
  for (const p of particles) {
    // 流場：平滑的正弦組合，模擬水流中墨的飄移
    const ang = Math.sin(p.x * 0.0021 + t * 0.0021 + p.seed) * Math.cos(p.y * 0.0018 - t * 0.0016) * Math.PI
    let ax = Math.cos(ang) * 0.02
    let ay = Math.sin(ang) * 0.02 - 0.006

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
}

function draw() {
  ctx.clearRect(0, 0, w, h)

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
      const g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.r)
      g.addColorStop(0, `rgba(${inkRGB},${p.a})`)
      g.addColorStop(1, `rgba(${inkRGB},0)`)
      ctx.fillStyle = g
      ctx.beginPath()
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2)
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
