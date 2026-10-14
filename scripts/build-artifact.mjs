#!/usr/bin/env node
// 將 /web 打包成單一 HTML 片段（CSS、JS、卦象資料全部內嵌），供發布為 Claude artifact。
// artifact 發布時會自動包上 <!doctype>/<head>/<body>，因此輸出不含這些標籤。
// 用法：node scripts/build-artifact.mjs [輸出路徑，預設 dist/my-iching.html]
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { dirname, join, basename } from 'node:path'
import { fileURLToPath } from 'node:url'

const web = join(dirname(fileURLToPath(import.meta.url)), '..', 'web')
const out = process.argv[2] || join(web, '..', 'dist', 'my-iching.html')
const read = p => readFileSync(join(web, p), 'utf8')

// 依相依順序排列；每個模組包成 IIFE，避免頂層名稱互相衝突
const MODULES = ['core/hexagrams.js', 'core/casting.js', 'core/scoring.js', 'ink.js', 'main.js']

function wrapModule(path) {
  const exported = []
  let src = read(path)
    .replace(/^import \{([^}]+)\} from '([^']+)'\s*$/gm,
      (_, names, from) => `const {${names}} = __modules['${basename(from, '.js')}']`)
    .replace(/^export (function|const|let) (\w+)/gm, (_, kw, id) => {
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
for (const [name, text] of [['styles.css', read('styles.css')], ['bundle', bundle]]) {
  if (/<\/(style|script)/i.test(text)) throw new Error(`${name} 含有會提早結束標籤的字串`)
}

const page = `<title>My易經</title>
<meta name="claude:viewport-fit-sides" content="cover">
<meta name="description" content="三錢六擲，一卦觀六事。">
${fonts}
<style>
${read('styles.css')}
</style>
${themeScript}
${body.trim()}
<script type="application/json" id="hexagrams-data">${data}</script>
<script type="module">
${bundle}
</script>
`

mkdirSync(dirname(out), { recursive: true })
writeFileSync(out, page)
console.log(`已輸出 ${out}（${(page.length / 1024).toFixed(1)} KB）`)
