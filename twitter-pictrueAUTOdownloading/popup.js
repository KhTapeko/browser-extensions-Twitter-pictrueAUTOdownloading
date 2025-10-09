async function withActiveTwitterTab(fn) {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id || !tab.url) return; // 無有效分頁 → 不處理

  // 只允許在 x.com / twitter.com 執行；其他頁面直接不處理
  const ok = /^https?:\/\/(x\.com|twitter\.com)\//i.test(tab.url);
  if (!ok) return;

  return fn(tab.id);
}

function sendToContent(type) {
  return withActiveTwitterTab((tabId) => {
    // 使用 callback 並吞掉錯誤（若該分頁無 content script，不報錯不提示）
    chrome.tabs.sendMessage(tabId, { type }, () => void chrome.runtime.lastError);
  });
}

// 綁定按鈕
document.getElementById("start").addEventListener("click", () => {
  sendToContent("tw_start");
});
document.getElementById("toggle").addEventListener("click", () => {
  sendToContent("tw_toggle");
});
document.getElementById("scan").addEventListener("click", () => {
  sendToContent("tw_scan");
});
document.getElementById("stop").addEventListener("click", () => {
  sendToContent("tw_stop");
});