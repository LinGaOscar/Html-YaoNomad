'use strict'

/**
 * 聲音：原創背景音樂〈墨韻〉（電子節拍 × 古風，E 羽調五聲音階）與點擊音效（毛筆掃過宣紙）。
 * 全部以 Web Audio 即時合成，不載入任何音檔；瀏覽器規定要使用者先點擊過才會出聲。
 *
 * 曲式（每小節 16 個十六分音符，84 BPM），循環：引子 4 小節 → A 段 8 → B 段 8 → A 段 8 → 間奏 4。
 * - 古箏：三角波＋鋸齒波、濾波快速收束，起音略低再滑上（按音），長音加揉弦；句尾偶有刮奏
 * - 和聲：空五度長音鋪底；低音隨和弦根音 E–G–A–D
 * - 電子：柔和的大鼓、閉合鈸、木魚取代小鼓；B 段加入方波琶音
 * 旋律由種子亂數依五聲音階隨機漫步產生，每一輪換新種子，所以每圈略有不同。
 */

const MUSIC_KEY = 'yaonomad.music'
const SFX_KEY = 'yaonomad.sfx'
const BPM = 84
const STEP = 60 / BPM / 4
const LOOKAHEAD = 0.15

const readPref = (key, fallback) => {
  try {
    const v = localStorage.getItem(key)
    return v === null ? fallback : v === '1'
  } catch {
    return fallback
  }
}
const writePref = (key, on) => {
  try { localStorage.setItem(key, on ? '1' : '0') } catch {}
}

let musicOn = readPref(MUSIC_KEY, false)
let sfxOn = readPref(SFX_KEY, true)
const listeners = new Set()
const notify = () => listeners.forEach(fn => fn({ music: musicOn, sfx: sfxOn }))

let ctx = null
let musicBus
let sfxBus
let reverbIn
let echoIn
let noiseBuf

function ensure() {
  if (!ctx) {
    const AC = window.AudioContext || window.webkitAudioContext
    if (!AC) return null
    ctx = new AC()
    const comp = ctx.createDynamicsCompressor()
    comp.threshold.value = -16
    comp.ratio.value = 3
    comp.connect(ctx.destination)
    musicBus = ctx.createGain()
    musicBus.gain.value = 0
    musicBus.connect(comp)
    sfxBus = ctx.createGain()
    sfxBus.gain.value = 0.7
    sfxBus.connect(comp)
    noiseBuf = makeNoise(2)

    // 殘響：以衰減雜訊當脈衝響應
    const conv = ctx.createConvolver()
    conv.buffer = makeImpulse(3)
    const wet = ctx.createGain()
    wet.gain.value = 0.32
    reverbIn = conv
    conv.connect(wet).connect(musicBus)

    // 回聲：附點八分音符，回授少許
    const delay = ctx.createDelay(2)
    delay.delayTime.value = STEP * 3
    const fb = ctx.createGain()
    fb.gain.value = 0.32
    const tone = ctx.createBiquadFilter()
    tone.type = 'lowpass'
    tone.frequency.value = 2400
    const echoOut = ctx.createGain()
    echoOut.gain.value = 0.28
    echoIn = delay
    delay.connect(tone).connect(fb).connect(delay)
    tone.connect(echoOut).connect(musicBus)
  }
  if (ctx.state === 'suspended') ctx.resume().catch(() => {})
  return ctx
}

function makeNoise(sec) {
  const buf = ctx.createBuffer(1, Math.floor(ctx.sampleRate * sec), ctx.sampleRate)
  const d = buf.getChannelData(0)
  let last = 0
  for (let i = 0; i < d.length; i++) {
    // 略偏粉紅的雜訊，筆刷聲比較柔
    last = 0.86 * last + 0.14 * (Math.random() * 2 - 1)
    d[i] = last * 3
  }
  return buf
}

function makeImpulse(sec) {
  const len = Math.floor(ctx.sampleRate * sec)
  const buf = ctx.createBuffer(2, len, ctx.sampleRate)
  for (let ch = 0; ch < 2; ch++) {
    const d = buf.getChannelData(ch)
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len) ** 3.2
  }
  return buf
}

const hz = midi => 440 * 2 ** ((midi - 69) / 12)

/** 包絡：從 0 起音到 peak，再指數衰減到幾乎無聲 */
function env(gain, t, attack, peak, decay) {
  gain.gain.setValueAtTime(0.0001, t)
  gain.gain.linearRampToValueAtTime(peak, t + attack)
  gain.gain.exponentialRampToValueAtTime(0.0001, t + attack + decay)
}

// ---------- 樂器 ----------

function zheng(t, midi, vel = 0.22, long = false) {
  const f = hz(midi)
  const out = ctx.createGain()
  env(out, t, 0.004, vel, long ? 2.4 : 1.4)
  const lp = ctx.createBiquadFilter()
  lp.type = 'lowpass'
  lp.Q.value = 2
  lp.frequency.setValueAtTime(5200, t)
  lp.frequency.exponentialRampToValueAtTime(900, t + 0.5)
  const oscs = [['triangle', 1], ['sawtooth', 0.28]].map(([type, level]) => {
    const o = ctx.createOscillator()
    o.type = type
    // 按音：起音略低，很快滑到正音
    o.frequency.setValueAtTime(f * 2 ** (-0.7 / 12), t)
    o.frequency.exponentialRampToValueAtTime(f, t + 0.07)
    const g = ctx.createGain()
    g.gain.value = level
    o.connect(g).connect(lp)
    return o
  })
  if (long) {
    // 揉弦
    const lfo = ctx.createOscillator()
    const depth = ctx.createGain()
    lfo.frequency.value = 5.4
    depth.gain.setValueAtTime(0, t)
    depth.gain.linearRampToValueAtTime(f * 0.006, t + 0.5)
    lfo.connect(depth)
    oscs.forEach(o => depth.connect(o.frequency))
    lfo.start(t)
    lfo.stop(t + 2.6)
  }
  lp.connect(out)
  out.connect(musicBus)
  const send = ctx.createGain()
  send.gain.value = 0.6
  out.connect(send)
  send.connect(reverbIn)
  send.connect(echoIn)
  oscs.forEach(o => { o.start(t); o.stop(t + (long ? 2.6 : 1.6)) })
}

function bass(t, midi, dur) {
  const o = ctx.createOscillator()
  const sq = ctx.createOscillator()
  o.type = 'sine'
  sq.type = 'square'
  o.frequency.value = sq.frequency.value = hz(midi)
  const lp = ctx.createBiquadFilter()
  lp.type = 'lowpass'
  lp.frequency.value = 280
  const sqg = ctx.createGain()
  sqg.gain.value = 0.18
  const g = ctx.createGain()
  g.gain.setValueAtTime(0.0001, t)
  g.gain.linearRampToValueAtTime(0.32, t + 0.02)
  g.gain.setTargetAtTime(0.0001, t + dur * 0.7, dur * 0.2)
  o.connect(lp)
  sq.connect(sqg).connect(lp)
  lp.connect(g).connect(musicBus)
  ;[o, sq].forEach(x => { x.start(t); x.stop(t + dur + 0.3) })
}

function pad(t, midis, dur) {
  const g = ctx.createGain()
  g.gain.setValueAtTime(0.0001, t)
  g.gain.linearRampToValueAtTime(0.05, t + dur * 0.35)
  g.gain.linearRampToValueAtTime(0.0001, t + dur + 0.6)
  const lp = ctx.createBiquadFilter()
  lp.type = 'lowpass'
  lp.frequency.value = 850
  lp.connect(g)
  g.connect(musicBus)
  g.connect(reverbIn)
  for (const m of midis) {
    for (const det of [-7, 7]) {
      const o = ctx.createOscillator()
      o.type = 'sawtooth'
      o.frequency.value = hz(m)
      o.detune.value = det
      o.connect(lp)
      o.start(t)
      o.stop(t + dur + 0.7)
    }
  }
}

function noiseHit(t, { type, freq, q = 1, peak, decay, rate = 1 }) {
  const src = ctx.createBufferSource()
  src.buffer = noiseBuf
  src.playbackRate.value = rate
  const f = ctx.createBiquadFilter()
  f.type = type
  f.frequency.value = freq
  f.Q.value = q
  const g = ctx.createGain()
  env(g, t, 0.002, peak, decay)
  src.connect(f).connect(g).connect(musicBus)
  src.start(t, Math.random() * 1.5)
  src.stop(t + decay + 0.05)
}

function kick(t) {
  const o = ctx.createOscillator()
  o.frequency.setValueAtTime(110, t)
  o.frequency.exponentialRampToValueAtTime(42, t + 0.14)
  const g = ctx.createGain()
  env(g, t, 0.003, 0.55, 0.32)
  o.connect(g).connect(musicBus)
  o.start(t)
  o.stop(t + 0.4)
}

const hat = (t, v) => noiseHit(t, { type: 'highpass', freq: 7500, peak: v, decay: 0.045, rate: 1.6 })

/** 木魚：短促的木質敲擊 */
function woodblock(t, v = 0.16) {
  const o = ctx.createOscillator()
  o.type = 'sine'
  o.frequency.setValueAtTime(1050, t)
  o.frequency.exponentialRampToValueAtTime(820, t + 0.05)
  const g = ctx.createGain()
  env(g, t, 0.001, v, 0.09)
  o.connect(g).connect(musicBus)
  const send = ctx.createGain()
  send.gain.value = 0.4
  g.connect(send).connect(reverbIn)
  o.start(t)
  o.stop(t + 0.15)
}

function arp(t, midi) {
  const o = ctx.createOscillator()
  o.type = 'square'
  o.frequency.value = hz(midi)
  const lp = ctx.createBiquadFilter()
  lp.type = 'lowpass'
  lp.frequency.setValueAtTime(2200, t)
  lp.frequency.exponentialRampToValueAtTime(500, t + 0.15)
  const g = ctx.createGain()
  env(g, t, 0.003, 0.035, 0.18)
  o.connect(lp).connect(g).connect(musicBus)
  g.connect(echoIn)
  o.start(t)
  o.stop(t + 0.25)
}

// ---------- 編曲 ----------

const SCALE = [52, 55, 57, 59, 62, 64, 67, 69, 71, 74, 76, 79, 81, 83, 86] // E 羽調五聲：E G A B D
const CHORDS = [{ root: 40, deg: 5 }, { root: 43, deg: 6 }, { root: 45, deg: 7 }, { root: 38, deg: 4 }] // Em G Am D，deg 為旋律起點
const RHYTHMS = [
  [[0, 4], [4, 2], [6, 2], [8, 8]],
  [[0, 3], [3, 3], [6, 2], [10, 2], [12, 4]],
  [[0, 2], [2, 2], [4, 4], [8, 2], [11, 5]],
  [[0, 6], [6, 2], [8, 4], [12, 2], [14, 2]],
  [[0, 8], [8, 3], [11, 5]],
]
const SECTIONS = [['intro', 4], ['A', 8], ['B', 8], ['A', 8], ['break', 4]]

function rng(seed) {
  let s = seed >>> 0
  return () => {
    s = (s + 0x6d2b79f5) >>> 0
    let x = s
    x = Math.imul(x ^ (x >>> 15), x | 1)
    x ^= x + Math.imul(x ^ (x >>> 7), x | 61)
    return ((x ^ (x >>> 14)) >>> 0) / 4294967296
  }
}

/** 一段四小節的旋律動機：每小節一個節奏型，音高在五聲音階上隨機漫步，小節首拍落在和弦音附近 */
function motif(rand) {
  return CHORDS.map(({ deg }) => {
    const rhythm = RHYTHMS[Math.floor(rand() * RHYTHMS.length)]
    let i = deg + Math.floor(rand() * 3) - 1
    return rhythm.map(([step, len], k) => {
      if (k) i = Math.max(0, Math.min(SCALE.length - 1, i + [-2, -1, -1, 1, 1, 2, 0][Math.floor(rand() * 7)]))
      return { step, len, midi: SCALE[i] }
    })
  })
}

let timer = 0
let nextTime = 0
let pos = 0 // 從曲首起算的十六分音符數
let cycle = 0
let motifs = null

const totalBars = SECTIONS.reduce((n, [, bars]) => n + bars, 0)

function sectionAt(bar) {
  let b = bar % totalBars
  for (const [name, bars] of SECTIONS) {
    if (b < bars) return { name, barIn: b }
    b -= bars
  }
  return { name: 'A', barIn: 0 }
}

function scheduleStep(t, n) {
  const bar = Math.floor(n / 16)
  const step = n % 16
  if (bar % totalBars === 0 && step === 0) {
    const rand = rng(0x9e3779b9 + cycle++ * 7919)
    motifs = { A: motif(rand), B: motif(rand) }
  }
  const { name, barIn } = sectionAt(bar)
  const chord = CHORDS[bar % 4]
  const drums = name === 'A' || name === 'B'

  if (step === 0) {
    pad(t, [chord.root + 12, chord.root + 19, chord.root + 24], STEP * 16)
    if (name !== 'intro') bass(t, chord.root, STEP * 6)
  }
  if (name !== 'intro' && step === 8) bass(t, chord.root + (bar % 2 ? 7 : 12), STEP * 5)

  if (drums) {
    if (step === 0 || step === 10) kick(t)
    if (step % 2 === 0) hat(t, step % 4 === 2 ? 0.05 : 0.025)
    if (step === 4 || step === 12) woodblock(t, step === 12 ? 0.17 : 0.11)
    if (name === 'B' && step % 2 === 1) arp(t, chord.root + 24 + [0, 7, 12, 7][(step >> 1) % 4])
  } else if (step === 12 && name === 'break') {
    woodblock(t, 0.1)
  }

  // 旋律：A／B 段完整；引子與間奏只彈每小節第一個音
  const phrase = name === 'B' ? motifs.B : motifs.A
  const notes = phrase[bar % 4]
  const variant = barIn >= 4 && bar % 4 === 3 // 後半句最後一小節改成長音收尾
  for (const note of notes) {
    if (note.step !== step) continue
    if ((name === 'intro' || name === 'break') && note !== notes[0]) continue
    if (variant && note !== notes[0]) continue
    zheng(t, note.midi, name === 'intro' || name === 'break' ? 0.16 : 0.2, variant || note.len >= 5)
  }
  // 句尾刮奏
  if (variant && step === 8 && name === 'A') {
    for (let k = 0; k < 7; k++) zheng(t + k * 0.035, SCALE[3 + k], 0.07)
  }
}

function tick() {
  while (nextTime < ctx.currentTime + LOOKAHEAD) {
    scheduleStep(nextTime, pos++)
    nextTime += STEP
  }
}

function startMusic() {
  if (!ensure() || timer) return
  pos = 0
  nextTime = ctx.currentTime + 0.1
  musicBus.gain.cancelScheduledValues(ctx.currentTime)
  musicBus.gain.setValueAtTime(musicBus.gain.value, ctx.currentTime)
  musicBus.gain.linearRampToValueAtTime(0.55, ctx.currentTime + 2.5)
  timer = setInterval(tick, 25)
  tick()
}

function stopMusic() {
  if (!timer) return
  clearInterval(timer)
  timer = 0
  const now = ctx.currentTime
  musicBus.gain.cancelScheduledValues(now)
  musicBus.gain.setValueAtTime(musicBus.gain.value, now)
  musicBus.gain.linearRampToValueAtTime(0, now + 0.8)
}

// ---------- 點擊音效：毛筆 ----------

/** 毛筆掃過宣紙：帶通雜訊由亮轉暗，先輕後重再收筆，另加一層細碎的筆毛擦紙聲 */
export function brush() {
  if (!sfxOn || !ensure()) return
  const t = ctx.currentTime + 0.005
  const dur = 0.16 + Math.random() * 0.08
  const f0 = 2000 + Math.random() * 900

  const body = ctx.createBufferSource()
  body.buffer = noiseBuf
  body.playbackRate.value = 0.85 + Math.random() * 0.3
  const bp = ctx.createBiquadFilter()
  bp.type = 'bandpass'
  bp.Q.value = 0.8
  bp.frequency.setValueAtTime(f0, t)
  bp.frequency.exponentialRampToValueAtTime(f0 * 0.4, t + dur)
  const g = ctx.createGain()
  g.gain.setValueAtTime(0.0001, t)
  g.gain.linearRampToValueAtTime(0.32, t + dur * 0.3)
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur)
  body.connect(bp).connect(g).connect(sfxBus)
  body.start(t, Math.random() * 1.5)
  body.stop(t + dur + 0.02)

  const hair = ctx.createBufferSource()
  hair.buffer = noiseBuf
  hair.playbackRate.value = 1.8
  const hp = ctx.createBiquadFilter()
  hp.type = 'highpass'
  hp.frequency.value = 5200
  const hg = ctx.createGain()
  hg.gain.setValueAtTime(0.0001, t)
  hg.gain.linearRampToValueAtTime(0.06, t + 0.02)
  hg.gain.exponentialRampToValueAtTime(0.0001, t + dur * 0.7)
  hair.connect(hp).connect(hg).connect(sfxBus)
  hair.start(t, Math.random() * 1.5)
  hair.stop(t + dur)
}

// ---------- 對外 ----------

export const soundState = () => ({ music: musicOn, sfx: sfxOn })
export const onSoundChange = fn => { listeners.add(fn); return () => listeners.delete(fn) }

export function setMusic(on) {
  musicOn = on
  writePref(MUSIC_KEY, on)
  if (on) startMusic()
  else stopMusic()
  notify()
}

export function setSfx(on) {
  sfxOn = on
  writePref(SFX_KEY, on)
  notify()
}

/** 全站點擊音效與音樂的生命週期；啟動時呼叫一次 */
export function initSound() {
  const CLICKABLE = 'a, button, summary, select, label, input[type="checkbox"]'
  document.addEventListener('pointerdown', e => {
    // 瀏覽器要求先有使用者操作才能出聲：音樂偏好為開時，第一次點擊就開始播放
    if (musicOn && !timer) startMusic()
    if (e.target.closest?.(CLICKABLE)) brush()
  }, true)
  document.addEventListener('visibilitychange', () => {
    if (!ctx) return
    if (document.hidden) ctx.suspend().catch(() => {})
    else if (musicOn || sfxOn) ctx.resume().catch(() => {})
  })
}
