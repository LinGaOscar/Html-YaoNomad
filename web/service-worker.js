'use strict'

// 改動任何靜態檔後請遞增版本，舊快取會在 activate 時清除
const CACHE = 'yaonomad-v3.22-1'
const ASSETS = [
  './',
  './index.html',
  './styles.css',
  './main.js',
  './ink.js',
  './activities.js',
  './inkscene.js',
  './ui.js',
  './result.js',
  './book.js',
  './manifest.json',
  './icon.svg',
  './fonts/yao-seal.woff2',
  './core/casting.js',
  './core/hexagrams.js',
  './core/scoring.js',
  './core/progress.js',
  './core/share.js',
  './core/models.js',
  './data/hexagrams.json',
]

self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(ASSETS)).then(() => self.skipWaiting()))
})

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  )
})

// 網路優先、失敗時回快取：線上能拿到最新版，離線仍可卜卦
self.addEventListener('fetch', event => {
  const { request } = event
  if (request.method !== 'GET' || new URL(request.url).origin !== self.location.origin) return
  event.respondWith(
    fetch(request)
      .then(res => {
        if (res.ok) {
          const copy = res.clone()
          caches.open(CACHE).then(cache => cache.put(request, copy))
        }
        return res
      })
      .catch(() => caches.match(request, { ignoreSearch: true }).then(hit => hit || caches.match('./index.html')))
  )
})
