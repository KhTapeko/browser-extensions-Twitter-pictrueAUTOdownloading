# Twitter-pictrueAUTOdownloading

Twitter（現稱 X）圖片自動下載工具。

## Description 描述

透過瀏覽器擴充功能自動捲動 Twitter（X）頁面，偵測已載入的推文圖片，並批次下載至瀏覽器的預設下載資料夾。程式會優先下載原始尺寸圖片，若下載失敗則自動改用大尺寸圖片。

## Supported Browsers 支援瀏覽器

- Google Chrome
- Brave
- Microsoft Edge
- 其他支援 Manifest V3 的 Chromium 瀏覽器

> 使用前須先登入 Twitter（X）帳號。Internet Explorer 不支援 Manifest V3，因此無法使用本工具。

## Features 主要功能

1. 自動捲動 Twitter（X）頁面並載入更多內容。
2. 自動偵測頁面中的推文圖片。
3. 批次下載偵測到的圖片。
4. 優先下載原始尺寸（`orig`），失敗時改用大尺寸（`large`）。
5. 避免同一次執行中重複下載相同圖片。
6. 顯示已下載與排隊中的圖片數量。
7. 提供開始、暫停／繼續、強制掃描與停止功能。

## Getting Started 安裝教學

### 1. 下載專案

下載或 clone 本專案至本機，並解壓縮至任意資料夾。

### 2. 開啟擴充功能管理頁面

依照使用的瀏覽器，在網址列輸入：

- Chrome：`chrome://extensions/`
- Brave：`brave://extensions/`
- Edge：`edge://extensions/`

### 3. 載入擴充功能

1. 開啟「開發人員模式」。
2. 點擊「載入未封裝項目」或「載入解壓縮的擴充功能」。
3. 選擇本專案中包含 `manifest.json` 的資料夾。

## How to Use 如何使用

1. 開啟 [Twitter（X）](https://x.com/) 並登入帳號。
2. 進入要下載圖片的頁面，例如首頁、搜尋結果或使用者頁面。
3. 點擊瀏覽器工具列上的 **Twitter Image Saver** 擴充功能圖示。
4. 點擊 **Start**，程式會開始自動捲動並下載圖片。
5. 可透過彈出視窗或頁面右下角的控制面板操作：
   - **Pause/Resume**：暫停或繼續執行。
   - **Force Scan**：立即掃描目前頁面中的圖片。
   - **Stop**：停止執行並關閉控制面板。

如需查看執行紀錄，可按下 `F12` 開啟開發人員工具，並切換至 **Console** 頁籤。

## Keyboard Shortcuts 快捷鍵

- `Esc`：暫停／繼續。
- `Shift + Esc`：停止執行。

## Download Rules 下載規則

- 圖片會儲存至瀏覽器設定的預設下載資料夾。
- 檔名格式為 `Twitter_<圖片識別碼>.<副檔名>`。
- 檔名重複時，瀏覽器會自動產生不重複的檔名。
- 程式每次最多同時處理 4 個下載工作。
- 自動捲動接近頁面底部且一段時間未載入新內容時，程式會結束掃描。
- 實際可下載的內容取決於頁面是否成功載入，以及 Twitter（X）當下的頁面結構。

## Folder Structure 資料夾結構

```text
twitter-pictrueAUTOdownloading/
├─ icons/          # 擴充功能圖示
├─ background.js   # 處理圖片下載與失敗重試
├─ content.js      # 自動捲動、圖片偵測與頁面控制面板
├─ manifest.json   # 擴充功能設定
├─ popup.html      # 擴充功能彈出視窗
├─ popup.js        # 彈出視窗操作邏輯
└─ README.md       # 專案說明文件
```

## Future 未來規劃

1. 支援影片與 GIF 下載。
2. 增加下載狀態與錯誤提示。
3. 提供更多自動捲動與檔名設定。

## Notes 注意事項

- Twitter（X）更新網頁結構後，圖片偵測功能可能需要同步調整。
- 大量下載前，請確認瀏覽器下載設定與磁碟可用空間。
- 請遵守 Twitter（X）的服務條款、著作權規範及所在地法律。
