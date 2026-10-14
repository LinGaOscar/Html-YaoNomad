# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 專案概述

YaoNomad 是以《易經》三枚硬幣卜卦法為核心的多平台系統，包含 Web PWA（`/web`）與 JS TUI（`/tui-js`）兩種介面實作。核心規格與介面實作嚴格分離。

**目前進度**：`core-spec` 與 `web/core/`（casting、hexagrams、scoring、models）已完成並通過測試；`tui-js/main.js` 可執行。`web/` 為「富邦大棒手 · 觀卦知時」PWA：`main.js`（hash 路由：`#/` 首頁、`#/cast` 起卦動畫、`#/r/<id>` 結果、`#/history` 歷史紀錄）、`ink.js`（水墨粒子背景）、`styles.css`、`manifest.json`、`service-worker.js`。歷史紀錄存於 localStorage，只存爻值與硬幣，重開時以 `castFromLines` 重算。詳細規劃見 `PLAN.md`。

線上部署（GitHub Pages）：https://lingaoscar.github.io/Html-YaoNomad/。本機開發環境設定見 `dev.md`。

## 架構原則

1. **`/core-spec` 為單一真實來源**：演算法或資料模型變更，必須先更新 `/core-spec/README.md`，再同步更新實作。
2. **核心與介面分離**：`castHexagram(hexagrams, question, coinFn?)` 位於 `web/core/`，不依賴任何 UI 框架，也不自行載入資料——由呼叫端注入 64 卦陣列（Web 用 `fetch('./data/hexagrams.json')`，TUI 與測試用 `readFileSync`）。`tui-js/main.js` 直接 import `../web/core/` 共用，不重複實作（README 所述「兩端各自獨立實作」已過時）。
3. **離線優先**：Web 端透過 Service Worker 快取所有靜態資源，保證離線可卜卦。
4. **資料檔同步**：`core-spec/hexagrams.json` 為正本；`web/data/hexagrams.json` 為副本（`tui-js` 直接引用此檔）。修改卦象資料後須手動複製至 `web/data/`。

## 核心資料模型

三個核心型別（定義於 `web/core/models.js`）：

- `Line`：爻值（6/7/8/9）、`yin`（偶數為陰）、`changing`（6 或 9 為變爻）
- `Hexagram`：`number`（1–64）、`name`、`upper`/`lower`（trigram 0–7）、`judgment`、`lines[6]`、`image`（象曰）、`motto`（一句話）、`plain`（白話）、`advice`（職場解讀）
- `CastResult`：`question`、`lines[6]`、`present`、`future`（無變爻時為 null）

## 狀態機

所有介面實作均須遵循此三段流程：

**問題輸入** → **卜卦動畫（逐爻顯示）** → **結果呈現**

## 開發指令

### TUI（`/tui-js`，需 Node.js）

```bash
node tui-js/main.js                  # 執行 TUI
```

### Web（`/web`，純 JavaScript，無編譯步驟）

測試使用 Node 內建的 `node:test`（`web/package.json` 僅設定 `"type": "module"`，無 `npm test` 指令，直接用 `node` 執行）。

```bash
node --test web/core/*.test.js                                           # 全部測試
node --test --test-name-pattern="<測試名稱>" web/core/casting.test.js   # 執行單一測試
```

需以靜態伺服器執行（例如 `npx serve web`）；修改 `web/` 靜態檔後須遞增 `service-worker.js` 的 `CACHE` 版本；`index.html` 使用 ES module 與 `fetch` 載入資料，以 `file://` 直接開啟會失敗。push 到 `main` 會由 `.github/workflows/deploy-pages.yml` 自動將 `/web` 部署到 GitHub Pages。

## 卜卦演算法（三硬幣法）

| 硬幣面 | 陰陽 | 數值 |
|--------|------|------|
| 正面（字面） | 陰 | 2 |
| 背面 | 陽 | 3 |

三枚硬幣加總得爻值：

| 結果 | 爻值 | 爻型 | 是否變爻 |
|------|------|------|----------|
| 3正（2+2+2） | 6 | 老陰，陰爻 | ✓ → 陽 |
| 2正1背（2+2+3） | 7 | 少陽，陽爻 | ✗ |
| 1正2背（2+3+3） | 8 | 少陰，陰爻 | ✗ |
| 3背（3+3+3） | 9 | 老陽，陽爻 | ✓ → 陰 |

- 重複六次，**自下而上**排列（index 0 = 初爻）
- 查卦：線性掃描 64 筆，以 `upper` 與 `lower` trigram 碼比對
- 有變爻則反轉對應爻的陰陽，查得變卦；無變爻則 `future = null`
- 六事評分（`web/core/scoring.js`）：八卦傾向表 × 內卦 60%／外卦 40%，有變卦時本卦 75%＋變卦 25%，經 tanh 曲線展開；≥70 上佳、<40 不宜。規則詳見 `core-spec/README.md`

## 八卦三位碼（bit0 = 底爻，yang=1）

乾=7，坤=0，震=1，巽=6，坎=2，離=5，艮=4，兌=3

## 測試策略

注入固定的 `coinFn`（回傳 2 或 3）取代 `Math.random` → 驗證六爻值（均在 6–9）→ 驗證本卦編號（1–64）→ 驗證變卦編號（若有）。測試位於 `web/core/*.test.js`。

詳細規格見：`docs/superpowers/specs/2026-06-15-core-design.md`
