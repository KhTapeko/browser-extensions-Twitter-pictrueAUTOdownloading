// 以 downloads API 執行下載，處理 orig→large 回退與檔名
const pending = new Map(); // downloadId -> { fallbackUrl, triedFallback }

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg?.type === "tw_download") {
    const { primaryUrl, fallbackUrl, filename } = msg;
    startDownload(primaryUrl, fallbackUrl, filename);
    sendResponse({ ok: true });
  }
  if (msg?.type === "tw_log") {
    // 可用於從 content.js 傳 log 來 debug
    console.log("[TW-CS]", msg.payload);
  }
  return true; // async
});

function startDownload(primaryUrl, fallbackUrl, filename) {
  chrome.downloads.download(
    {
      url: primaryUrl,
      filename,
      conflictAction: "uniquify",
      saveAs: false
    },
    (id) => {
      if (typeof id !== "number") {
        // 直接嘗試 fallback
        if (fallbackUrl) {
          chrome.downloads.download({
            url: fallbackUrl,
            filename,
            conflictAction: "uniquify",
            saveAs: false
          });
        }
        return;
      }
      pending.set(id, { fallbackUrl, triedFallback: false, filename });
    }
  );
}

chrome.downloads.onChanged.addListener((delta) => {
  if (!delta || typeof delta.id !== "number") return;
  const state = delta.state?.current;
  const info = pending.get(delta.id);
  if (!info) return;

  if (state === "complete") {
    pending.delete(delta.id);
  } else if (state === "interrupted") {
    // 下載失敗 → 若有 fallback 且未嘗試過，就改用 fallback
    if (info.fallbackUrl && !info.triedFallback) {
      info.triedFallback = true;
      chrome.downloads.download(
        {
          url: info.fallbackUrl,
          filename: info.filename,
          conflictAction: "uniquify",
          saveAs: false
        },
        (id2) => {
          if (typeof id2 === "number") {
            pending.set(id2, { ...info });
          }
        }
      );
    } else {
      pending.delete(delta.id);
    }
  }
});
