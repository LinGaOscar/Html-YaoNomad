# YaoNomad

以《易經》三枚硬幣卜卦法為核心的多平台系統。

線上體驗：https://lingaoscar.github.io/Html-YaoNomad/

## 平台

| 平台 | 目錄 | 技術 |
|------|------|------|
| Web | `/web` | HTML / CSS / JavaScript（無框架、無外部依賴） |
| JS TUI | `/tui-js` | Node.js（無框架） |

`/web` 為「My易經」PWA：三錢起卦動畫、六事評分（開會、撰寫報告、抓BUG、系統開發、程式上線、餵魚/澆花，可自訂）與展開小故事、本卦/變卦解析、今日一卦與「再三瀆」提醒、應驗回饋與準度、64 卦圖鑑與成就、分享連結、手動輸入六爻、歷史紀錄（存於瀏覽器 localStorage），水墨粒子背景，支援深淺色與離線使用。

## 架構

```
/core-spec/        演算法規格與 64 卦資料正本
/web/              PWA 介面（離線可用）
/tui-js/           終端機介面
/docs/             設計文件
```

核心邏輯（卜卦演算法、資料模型）在兩端各自獨立實作，遵循 `/core-spec` 定義的規格。

## 卜卦流程

問題輸入 → 卜卦動畫（逐爻顯示） → 結果呈現（本卦 + 變卦）

## 快速開始

### JS TUI

```bash
node tui-js/main.js
```

### Web

需以靜態伺服器執行（例如 `npx serve web`），以 `file://` 直接開啟會因 ES module 與 `fetch` 限制而失敗。push 到 `main` 會由 GitHub Actions 自動部署到 GitHub Pages。

## 測試

```bash
node --test web/core/*.test.js
```

## 開發

本機開發環境設定、測試指令細節見 [dev.md](./dev.md)；架構規則與慣例見 [CLAUDE.md](./CLAUDE.md)；設計脈絡見 [設計規格](./docs/superpowers/specs/2026-06-15-core-design.md)。
