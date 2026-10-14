#!/usr/bin/env node
// 將 /web 打包成單一 HTML 片段（CSS、JS、卦象資料全部內嵌），供發布為 Claude artifact。
// artifact 發布時會自動包上 <!doctype>/<head>/<body>，因此輸出不含這些標籤。
// 用法：node scripts/build-artifact.mjs [輸出路徑，預設 dist/my-iching.html] [--share-base <artifact 網址>]
// --share-base：分享連結的基底網址；artifact 內無法得知自己的公開網址，需在打包時指定
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { dirname, join, basename } from 'node:path'
import { fileURLToPath } from 'node:url'

const web = join(dirname(fileURLToPath(import.meta.url)), '..', 'web')
const args = process.argv.slice(2)
const baseAt = args.indexOf('--share-base')
const shareBase = baseAt >= 0 ? args.splice(baseAt, 2)[1] : ''
const out = args[0] || join(web, '..', 'dist', 'my-iching.html')
const read = p => readFileSync(join(web, p), 'utf8')

// 依相依順序排列；每個模組包成 IIFE，避免頂層名稱互相衝突
const MODULES = [
  'core/hexagrams.js', 'core/casting.js', 'core/scoring.js', 'core/progress.js', 'core/share.js',
  'ink.js', 'activities.js', 'ui.js', 'inkscene.js', 'result.js', 'book.js', 'main.js',
]

function wrapModule(path) {
  const exported = []
  let src = read(path)
    .replace(/^import \{([^}]+)\} from '([^']+)'\s*$/gm,
      (_, names, from) => `const {${names}} = __modules['${basename(from, '.js')}']`)
    .replace(/^export (async function|function|const|let) (\w+)/gm, (_, kw, id) => {
      exported.push(id)
      return `${kw} ${id}`
    })
  if (/^\s*(import|export)\b/m.test(src)) throw new Error(`${path}：有無法轉換的 import/export`)
  return `__modules['${basename(path, '.js')}'] = (() => {\n${src}\nreturn { ${exported.join(', ')} }\n})()\n`
}

const html = read('index.html')
const pick = (re, what) => {
  const m = html.match(re)
  if (!m) throw new Error(`index.html 找不到 ${what}`)
  return m[1]
}
const fonts = [...html.matchAll(/<link rel="(?:preconnect|stylesheet)" href="https:\/\/fonts\.[^>]*>/g)].map(m => m[0]).join('\n')
const themeScript = pick(/(<script>[\s\S]*?<\/script>)/, '主題預載 script')
const body = pick(/<body>([\s\S]*?)<script type="module"/, 'body 內容')
const data = JSON.stringify(JSON.parse(read('data/hexagrams.json'))).replace(/</g, '\\u003c')
const bundle = `const __modules = {}\n${MODULES.map(wrapModule).join('\n')}`
// 篆字字型內嵌成 data URI（artifact 只允許 Google Fonts 或內嵌字型）
const sealFont = readFileSync(join(web, 'fonts', 'yao-seal.woff2')).toString('base64')
const css = read('styles.css').replace('url("./fonts/yao-seal.woff2")', `url("data:font/woff2;base64,${sealFont}")`)
if (!css.includes('data:font/woff2')) throw new Error('styles.css 找不到篆字字型的 @font-face')

for (const [name, text] of [['styles.css', css], ['bundle', bundle]]) {
  if (/<\/(style|script)/i.test(text)) throw new Error(`${name} 含有會提早結束標籤的字串`)
}

const page = `<title>My易經</title>
<meta name="claude:viewport-fit-sides" content="cover">
<meta name="description" content="三錢六擲, 一卦觀六事.">
${fonts}
<style>
${css}
</style>
${themeScript}
${body.trim()}
<script type="application/json" id="hexagrams-data"${shareBase ? ` data-share-base="${shareBase.replace(/"/g, '')}"` : ''}>${data}</script>
<script type="module">
${bundle}
</script>
`

mkdirSync(dirname(out), { recursive: true })
writeFileSync(out, page)
console.log(`已輸出 ${out}（${(page.length / 1024).toFixed(1)} KB）`)
