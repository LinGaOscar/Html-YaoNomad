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
  index.html        最小可用版 UI（無 CSS 檔、無 PWA 資源）
/tui-js/            終端機介面，main.js 直接 import ../web/core/
/docs/              設計文件
```

## 本機執行

### Web

直接用瀏覽器開啟 `web/index.html`，或起一個靜態伺服器（例如 `npx serve web`）。無編譯步驟。

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

目前僅 `web/core/` 有測試（`casting.test.js`、`hexagrams.test.js`）；`tui-js/main.js` 與 `web/index.html` 沒有自動化測試，需手動執行驗證。

## 資料同步注意事項

`core-spec/hexagrams.json` 為正本，`web/data/hexagrams.json` 為副本（`tui-js` 也直接讀這份副本）。修改卦象資料後，兩份檔案需手動同步，測試中的「64 筆 / upper-lower 唯一」檢查可用來驗證副本完整性。

## 部署

push 到 `main` 會觸發 `.github/workflows/deploy-pages.yml`，將 `/web` 部署到 GitHub Pages（`https://lingaoscar.github.io/YaoNomad/`）。`/tui-js`、`/core-spec` 不參與部署。
