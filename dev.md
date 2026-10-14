# 開發指南

## 需求

- Node.js（無指定版本下限；`node:test` 需 Node 18+）
- 無其他相依套件（`web/package.json`、`tui-js/package.json` 皆僅設定 `"type": "module"`）

## 目錄結構

```
/core-spec/        演算法規格與 64 卦資料正本（單一真實來源）
/web/               Web 介面
  core/             核心邏輯（castHexagram、hexagrams lookup、型別定義），無 UI 依賴
  data/             hexagrams.json 副本（從 core-spec 手動同步）
  index.html        外框（標題列、粒子畫布）
  main.js           hash 路由、首頁、起卦動畫、歷史紀錄
  result.js         結果頁（自己的卦例、朋友分享）
  book.js           我的卦簿、六事樣板
  ui.js             共用工具與 localStorage 存取
  ink.js            水墨粒子背景（純視覺）
  activities.js     事項池與樣板（分類、代表字、提醒、小故事、印章文字）、八卦性質
  inkscene.js       六事展開面板的水墨粒子循環動畫（依主分類流動、聚成代表字）
  styles.css        色票與版面（深淺色）
  service-worker.js 網路優先、離線回快取；改靜態檔後請遞增 CACHE 版本
/tui-js/            終端機介面，main.js 直接 import ../web/core/
/docs/              設計文件
```

## 本機執行

### Web

起一個靜態伺服器（例如 `npx serve web` 或 `python3 -m http.server -d web`）。無編譯步驟；以 `file://` 直接開啟會因 ES module 與 `fetch` 限制而失敗。

### 單檔版（Claude artifact）

```bash
node scripts/build-artifact.mjs [輸出路徑] [--share-base <artifact 網址>]   # 預設輸出 dist/my-iching.html
```

把 `/web` 的 CSS、JS 與卦象資料全部內嵌成一個 HTML 片段（不含 `<html>`/`<head>`/`<body>`，由 artifact 發布時包上）。單檔版不註冊 Service Worker。artifact 內無法得知自己的公開網址，分享連結的基底要用 `--share-base` 指定（目前為 https://claude.ai/artifact/5spvV1jA7SNqdPLSfsKrdG）。新增 `web/*.js` 模組時，要同步加進腳本的 `MODULES`（依相依順序）與 `service-worker.js` 的 `ASSETS`。

### TUI

```bash
node tui-js/main.js
```

## 測試

測試框架為 Node 內建的 `node:test`（無 `npm test` script，直接用 `node --test` 執行）：

```bash
node --test web/core/*.test.js                                          # 全部測試
node --test --test-name-pattern="<測試名稱>" web/core/casting.test.js  # 執行單一測試
```

目前僅 `web/core/` 有測試（`casting`、`hexagrams`、`scoring`、`progress`、`share`）；`tui-js/main.js` 與 Web 介面沒有自動化測試，需手動執行驗證。

## 資料同步注意事項

`core-spec/hexagrams.json` 為正本，`web/data/hexagrams.json` 為副本（`tui-js` 也直接讀這份副本）。修改卦象資料後，兩份檔案需手動同步，測試中的「64 筆 / upper-lower 唯一」檢查可用來驗證副本完整性。

## 部署

push 到 `main` 會觸發 `.github/workflows/deploy-pages.yml`，將 `/web` 部署到 GitHub Pages（`https://lingaoscar.github.io/Html-YaoNomad/`）。`/tui-js`、`/core-spec` 不參與部署。
