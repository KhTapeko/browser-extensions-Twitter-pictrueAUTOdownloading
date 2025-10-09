(() => {
  if (window.__TwImgSaver__) return; // 防重複注入
  window.__TwImgSaver__ = true;

  // ======== 可調整參數 ========
  const SCROLL_INTERVAL_MS = 3000;
  const SCROLL_STEP = Math.round(window.innerHeight * 3);
  const IO_THRESHOLD = 0;
  const IO_ROOT_MARGIN = "200px 0px 200px 0px";
  const CONCURRENCY = 4;
  const SELECTOR = "[data-testid='tweetPhoto'] img[src*='pbs.twimg.com/media'], img[src*='pbs.twimg.com/media']";
  // ===========================

  let isPaused = false;
  let isStopped = false;
  let lastScrollHeight = 0;
  let sameHeightCount = 0;

  const downloaded = new Set();       // 以 primary.url 去重
  const observedImgs = new WeakSet(); // 避免重複 observe
  const scheduledImgs = new WeakSet();// 避免重複入隊

  const queue = [];
  let activeCount = 0;

  // 面板
  const panel = document.createElement("div");
  panel.style.cssText = `
    position: fixed; right: 16px; bottom: 16px; z-index: 999999;
    background: rgba(0,0,0,.75); color: #fff; padding: 12px 12px;
    border-radius: 12px; font-family: system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif;
    box-shadow: 0 8px 20px rgba(0,0,0,.35); min-width: 260px; backdrop-filter: saturate(1.4) blur(3px);
    display:none; /* 預設隱藏，等 start 才顯示 */
  `;
  panel.innerHTML = `
    <div style="font-weight:700; margin-bottom:8px;">Twitter Image Saver</div>
    <div style="font-size:12px; opacity:.9; margin-bottom:8px;">
      <span id="tw-counter">Downloaded: 0</span> • <span id="tw-queued">Queued: 0</span>
    </div>
    <div style="display:flex; gap:8px; flex-wrap:wrap; margin-bottom:8px;">
      <button id="tw-toggle" style="flex:1; padding:6px 10px; border-radius:8px; border:0; cursor:pointer;">Pause (Esc)</button>
      <button id="tw-stop" style="flex:1; padding:6px 10px; border-radius:8px; border:0; background:#e03131; color:#fff; cursor:pointer;">Stop (Shift+Esc)</button>
    </div>
    <div style="display:flex; gap:8px; flex-wrap:wrap;">
      <button id="tw-scan" style="flex:1; padding:6px 10px; border-radius:8px; border:0; background:#2f9e44; color:#fff; cursor:pointer;">Force Scan</button>
    </div>
    <div style="font-size:11px; opacity:.75; margin-top:8px; line-height:1.3">
      Scroll ${SCROLL_INTERVAL_MS}ms / step ${SCROLL_STEP}px • IO ${IO_THRESHOLD} • Concurrency ${CONCURRENCY}
    </div>
  `;
  document.body.appendChild(panel);

  const counterEl = panel.querySelector("#tw-counter");
  const queuedEl = panel.querySelector("#tw-queued");
  const toggleBtn = panel.querySelector("#tw-toggle");
  const stopBtn = panel.querySelector("#tw-stop");
  const scanBtn = panel.querySelector("#tw-scan");

  toggleBtn.onclick = () => {
    isPaused = !isPaused;
    toggleBtn.textContent = isPaused ? "Resume (Esc)" : "Pause (Esc)";
    panel.style.opacity = isPaused ? "0.85" : "1";
    if (!isPaused) pump();
  };
  stopBtn.onclick = () => stopAll();
  scanBtn.onclick = () => scanExistingImages(true);

  function updateCounters() {
    counterEl.textContent = `Downloaded: ${downloaded.size}`;
    queuedEl.textContent = `Queued: ${queue.length}`;
  }

  function buildUrlWithSize(u, size) {
    const urlObj = new URL(u);
    // format 缺時 → 路徑副檔名 → 預設 jpg
    let format = urlObj.searchParams.get("format");
    if (!format) {
      const m = urlObj.pathname.match(/\.(\w+)$/);
      format = m ? m[1] : "jpg";
      urlObj.searchParams.set("format", format);
    }
    urlObj.searchParams.set("name", size); // orig / large
    return { url: urlObj.toString(), format };
  }

  function normalizeUrl(raw) {
    try {
      const primary = buildUrlWithSize(raw, "orig");
      const fallback = buildUrlWithSize(raw, "large");
      return { primary, fallback };
    } catch {
      return {
        primary: { url: raw, format: "jpg" },
        fallback: { url: raw, format: "jpg" }
      };
    }
  }

  function mediaKeyFromUrl(u) {
    try {
      const name = (new URL(u)).pathname.split("/").pop() || "";
      return name.split(".")[0] || "Image";
    } catch {
      return "Image";
    }
  }

  function filenameFromUrl(primaryUrl, mimeHint = "") {
    const u = new URL(primaryUrl);
    let ext = (u.searchParams.get("format") || "").toLowerCase();
    if (!ext) {
      const m = u.pathname.match(/\.([a-zA-Z0-9]+)$/);
      if (m) ext = m[1].toLowerCase();
    }
    if (!ext && mimeHint) {
      const map = {
        "image/jpeg": "jpg", "image/jpg": "jpg",
        "image/png": "png",  "image/webp": "webp",
        "image/gif": "gif",  "image/bmp": "bmp",
        "image/x-ms-bmp": "bmp", "image/tiff": "tif",
        "image/svg+xml": "svg", "image/x-icon": "ico"
      };
      ext = map[mimeHint.toLowerCase()] || "jpg";
    }
    if (!ext) ext = "jpg";
    const base = mediaKeyFromUrl(primaryUrl);
    return `Twitter_${base}.${ext}`;
  }

  // ======== 下載任務：交給 background.js 的 downloads API，並處理回退 ========
  function enqueueDownload(imgEl) {
    if (!imgEl || scheduledImgs.has(imgEl)) return;
    scheduledImgs.add(imgEl);

    const src = imgEl.src;
    if (!src || !src.includes("pbs.twimg.com/media")) return;

    const { primary, fallback } = normalizeUrl(src);
    if (downloaded.has(primary.url)) return;

    // 決定檔名（依 URL 的 format）
    const filename = filenameFromUrl(primary.url);

    queue.push(async () => {
      if (isStopped) return;
      if (downloaded.has(primary.url)) return;
      try {
        // 交給背景下載（會自動處理 fallback）
        chrome.runtime.sendMessage({
          type: "tw_download",
          primaryUrl: primary.url,
          fallbackUrl: fallback.url,
          filename
        });
        downloaded.add(primary.url);
        updateCounters();
        console.log("✅ Queued:", filename);
      } catch (e) {
        console.warn("❌ Failed to send download message:", e);
      }
    });

    updateCounters();
    pump();
  }

  function pump() {
    if (isPaused || isStopped) return;
    while (activeCount < CONCURRENCY && queue.length > 0) {
      const task = queue.shift();
      activeCount++;
      task()
        .catch(() => {})
        .finally(() => {
          activeCount--;
          if (!isPaused && !isStopped) pump();
        });
    }
  }

  function isInView(el) {
    const r = el.getBoundingClientRect();
    return (
      r.bottom >= 0 &&
      r.right >= 0 &&
      r.top <= (window.innerHeight || document.documentElement.clientHeight) &&
      r.left <= (window.innerWidth || document.documentElement.clientWidth)
    );
  }

  const io = new IntersectionObserver((entries) => {
    if (isStopped) return;
    for (const entry of entries) {
      if (entry.isIntersecting) {
        enqueueDownload(entry.target);
        io.unobserve(entry.target);
      }
    }
  }, { root: null, rootMargin: IO_ROOT_MARGIN, threshold: IO_THRESHOLD });

  function observeImage(img) {
    if (!img || observedImgs.has(img)) return;
    observedImgs.add(img);
    if (isInView(img)) enqueueDownload(img);
    else io.observe(img);
  }

  function scanExistingImages(forceEnqueue = false) {
    const imgs = document.querySelectorAll(SELECTOR);
    imgs.forEach(img => {
      if (!img || observedImgs.has(img)) return;
      observedImgs.add(img);
      if (forceEnqueue || isInView(img)) enqueueDownload(img);
      else io.observe(img);
    });
  }

  const mo = new MutationObserver((mutations) => {
    if (isStopped) return;
    for (const m of mutations) {
      for (const node of m.addedNodes) {
        if (!(node instanceof HTMLElement)) continue;
        if (node.matches && node.matches(SELECTOR)) observeImage(node);
        const imgs = node.querySelectorAll ? node.querySelectorAll(SELECTOR) : [];
        imgs.forEach(observeImage);
      }
    }
  });

  // 自動捲動
  async function autoScroll() {
    console.log("🧭 Auto scroll start");
    while (!isStopped) {
      if (!isPaused) {
        const current = document.body.scrollHeight;
        if (current > lastScrollHeight) {
          window.scrollBy(0, SCROLL_STEP);
          lastScrollHeight = current;
          sameHeightCount = 0;
          scanExistingImages(false);
        } else {
          sameHeightCount++;
          if (sameHeightCount > 5) {
            console.log("✅ Reached bottom. Auto scroll stop.");
            break;
          }
        }
      }
      await new Promise(r => setTimeout(r, SCROLL_INTERVAL_MS));
    }
    // 收尾
    scanExistingImages(true);
    await waitDrain();
    console.log("🎉 Auto scroll finished. All queued tasks are done or drained.");
  }

  async function waitDrain() {
    while (!isStopped && (queue.length > 0 || activeCount > 0)) {
      await new Promise(r => setTimeout(r, 300));
    }
  }

  // 熱鍵
  function onKeydown(e) {
    if (e.key === "Escape" && e.shiftKey) {
      e.preventDefault();
      stopAll();
      return;
    }
    if (e.key === "Escape" && !e.shiftKey) {
      e.preventDefault();
      toggleBtn.click();
    }
  }

  // 對 popup 的控制訊息
  chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    if (!msg || !msg.type) return;
    if (msg.type === "tw_start") {
      startAll();
      sendResponse({ ok: true });
    } else if (msg.type === "tw_pause") {
      if (!isPaused) toggleBtn.click();
      sendResponse({ ok: true, paused: true });
    } else if (msg.type === "tw_resume") {
      if (isPaused) toggleBtn.click();
      sendResponse({ ok: true, paused: false });
    } else if (msg.type === "tw_toggle") {
      toggleBtn.click();
      sendResponse({ ok: true, paused: isPaused });
    } else if (msg.type === "tw_stop") {
      stopAll();
      sendResponse({ ok: true, stopped: true });
    } else if (msg.type === "tw_scan") {
      scanExistingImages(true);
      sendResponse({ ok: true });
    }
    return true;
  });

  function startAll() {
    if (isStopped) {
      // 重啟一輪：重置狀態
      isStopped = false;
      isPaused = false;
      lastScrollHeight = 0;
      sameHeightCount = 0;
    }
    panel.style.display = "block"; // 顯示控制面板
    window.addEventListener("keydown", onKeydown, true);
    mo.observe(document.documentElement || document.body, { childList: true, subtree: true });
    scanExistingImages(false);
    autoScroll();
  }

  function stopAll() {
    if (isStopped) return;
    isStopped = true;
    isPaused = true;
    try { io.disconnect(); } catch {}
    try { mo.disconnect(); } catch {}
    try { window.removeEventListener("keydown", onKeydown, true); } catch {}
    try { panel.style.display = "none"; } catch {}
    console.log("🛑 Stopped. Observers and UI cleaned up.");
  }

  // 預設不自動開始，等 popup 按 Start 或你想改成自動啟動就呼叫 startAll()
  // startAll();
})();
