# 📸 CDP-MCP (Chrome DevTools Protocol MCP Server)

> **版本**：v1.0.0 (Golden Benchmark)  
> **核心使命**：基於 Node.js 24 原生 WebSocket 與系統既有 Chrome / Edge 瀏覽器，提供高精確度、零外部龐大依賴（Zero-Dependency）的實機視覺驗收與自動化截圖 MCP 伺服器。  
> **由來**：從本機原創的 `chrome-cdp-screenshot` 技能完美進化，升級為符合 Model Context Protocol (MCP) 標準的獨立架構資產。  
>
> 📚 **深入評估與對照白皮書**：  
> * 🌐 **[全景橫向評估白皮書](./docs/market_cdp_solutions_comparison.md)**：包含 Playwright MCP、cdp-browser-mcp、undetectable-io、mcp-chromium-cdp 五大派系全維度指標對決。  
> * 🥊 **[單挑深度對照報告](./docs/comparison_with_undetectable_cdp.md)**：針對 25 款工具之 undetectable-io 進行 1v1 裸體深度對照（Token 消耗、React 穿透與原子化操作）。

---

## 🎯 核心技術特性

1. **零外部肥大套件依賴 (Zero Dependency)**：
   * 徹底拋棄動輒 300MB+ 的 Puppeteer / Playwright。
   * 僅依賴 Node.js 24 原生 `WebSocket` 與 `@modelcontextprotocol/sdk`。
2. **跨平台自動探測 (Cross-Platform Browser Detection)**：
   * 自動尋找 Windows、macOS 與 Linux 上已安裝的 Chrome 或 Edge 執行檔。
3. **React 19 / Vue 虛擬 DOM 原生事件穿透**：
   * 內建原生描述符注入（`HTMLInputElement.prototype` Setter Injection），突破受控組件（Controlled Components）狀態阻攔，實現真實打字模擬。
4. **DOM 節點物理座標無損裁切 (Element-Level BoundingRect Clip)**：
   * 直接由 Chrome 渲染合成器在指定像素邊界無損裁切 PNG，杜絕二次縮放模糊。
5. **獨立沙盒與生命週期自動管理 (Process Guard)**：
   * 每次啟動使用獨立的臨時 `--user-data-dir`，執行完畢自動清理暫存檔與殺死進程，絕不產生孤兒進程吃光記憶體。

---

## 📊 市面主流 CDP / 截圖方案橫向對照表

| 評估維度 | 官方派 (Playwright MCP) | 開源 CDP 派 (cdp-browser-mcp 等) | 重型控制派 (chromium-cdp-mcp) | 🌟 **cdp-mcp (本專案)** |
| :--- | :---: | :---: | :---: | :---: |
| **外部套件體積** | ❌ 300MB+ Chromium | 🟡 中等 (依賴第三方驅動) | 🟢 輕量 (原生 WebSocket) | 🟢 **極致輕量 (0 下載，本機 Chrome)** |
| **瀏覽器生命週期** | 啟動緩慢，佔記憶體 | ❌ 大多需**手動提前開瀏覽器** | ❌ 需**手動開瀏覽器**且必傳 Port | 🟢 **全自動探測啟動、用完自動秒殺** |
| **呼叫原子化程度** | 多步驟來回 | 多步驟來回 | ❌ 25 個細碎 Tool (來回 8 輪) | 🟢 **高階複合一步到位 (1 輪完成)** |
| **React 19 / Vue 穿透** | 框架級模擬 | ❌ 無 (普通 .value= 易失效) | ❌ 無 (Input.insertText 易丟事件) | 🟢 **原生 Setter 描述符注入，100% 穿透** |
| **DOM 局部無損裁切** | 需手動計算 | ❌ 僅 Viewport/FullPage | ❌ 僅 Viewport/FullPage | 🟢 **CSS Selector 像素級無損裁切** |
| **Agent 專屬特工閉環**| ❌ 僅 Raw Tools | ❌ 僅 Raw Tools | ❌ 僅 Raw Tools | 🟢 **自帶 visual-verifier 獨立沙盒特工** |
| **Token 消耗效率** | 🔴 消耗高 | 🟡 中等 | 🔴 8 輪往返 (~20k tokens) | 🟢 **單次原子呼叫 (~1.5k tokens)** |

> 詳細的逐項工具清單與 25 款工具深度評估，請參閱專題報告：  
> 📄 **[docs/comparison_with_undetectable_cdp.md](./docs/comparison_with_undetectable_cdp.md)**

---

## 🦾 提供的標準 MCP 工具清單 (Tools)

### 1. `take_screenshot`
* **功能**：對指定網址進行全景截圖或局部元素裁切截圖。
* **主要參數**：
  * `url` (必填): 目標網址 (如 `http://localhost:3000`)。
  * `outputPath` (必填): 儲存 PNG 檔案路徑。
  * `selector`: 目標 DOM 元素 CSS Selector（提供時進行精準裁切）。
  * `waitFor`: 等待出現的 CSS Selector。
  * `delay`: 額外等待毫秒數 (預設: 1000)。
  * `width` / `height`: 視口解析度 (預設: 1920x1080)。
  * `dpr`: 設備像素比 (設為 2 產出 Retina 高清圖)。

### 2. `interact_and_screenshot`
* **功能**：模擬表單輸入與按鈕點擊後再行截圖（支援 React 穿透）。
* **額外參數**：
  * `inputSelector` & `inputValue`: 輸入文字的目標表單。
  * `clickSelector`: 點擊展開的按鈕或下拉選單。

### 3. `inspect_element`
* **功能**：查詢 DOM 元素的物理邊界盒 (`x, y, width, height`) 與當前可見性 (`isVisible`)，專供 UI 跑版與元件位移檢測。

---

## 🤖 專屬視覺特工 (Visual Verifier Agent)

本專案附帶專用特工定義檔案：
* [agents/visual-verifier.agent.md](file:///d:/codespace/projects/cdp-mcp/agents/visual-verifier.agent.md)
* **安全沙盒**：限制僅能使用 `mcp__cdp-mcp__*` 與 `read_file`，物理剝奪寫入工具，保證「專職視覺驗收、絕對無法竄改專案代碼」。

---

## ⚙️ 在 Antigravity 中配置與啟用

在全域或專案的 `mcp_config.json` 中加入以下設定：

```json
{
  "mcpServers": {
    "cdp-mcp": {
      "command": "node",
      "args": [
        "d:/codespace/projects/cdp-mcp/dist/index.js"
      ]
    }
  }
}
```

---

## 🧪 整合測試

```bash
npm run build
node tests/test-mcp.js
```
