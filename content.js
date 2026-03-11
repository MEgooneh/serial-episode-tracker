(() => {
  function isDirectoryListing() {
    const title = document.title.toLowerCase();
    if (/index of/i.test(title)) return true;
    const h1 = document.querySelector("h1");
    if (h1 && /index of/i.test(h1.textContent)) return true;
    // Table-based directory listings (custom styled servers)
    const table = document.querySelector("table");
    if (table) {
      const links = table.querySelectorAll("a");
      if (links.length > 2 && [...links].some((a) => /\.\w{2,4}$/.test(a.getAttribute("href") || ""))) return true;
    }
    // Pre-based directory listings (nginx/apache default)
    const pre = document.querySelector("pre");
    if (pre) {
      const links = pre.querySelectorAll("a");
      if (links.length > 2 && [...links].some((a) => /\.\w{2,4}$/.test(a.getAttribute("href") || ""))) return true;
    }
    return false;
  }

  if (!isDirectoryListing()) return;

  const videoExtensions = /\.(mkv|mp4|avi|wmv|flv|mov|webm|m4v|srt|sub|ass|ssa)$/i;

  function getFileLinks() {
    return [...document.querySelectorAll("a")].filter((a) => {
      const href = a.getAttribute("href");
      if (!href) return false;
      if (href === "../" || href === "/" || href.startsWith("?")) return false;
      return videoExtensions.test(href);
    });
  }

  const fileLinks = getFileLinks();
  if (fileLinks.length === 0) return;

  const pageKey = location.origin + location.pathname;
  const decisionKey = "decision:" + pageKey;

  chrome.storage.local.get([pageKey, decisionKey], (result) => {
    const decision = result[decisionKey];

    // Already declined — do nothing
    if (decision === "no") return;

    // Already accepted or has watch data — inject directly
    if (decision === "yes" || (result[pageKey] && Object.keys(result[pageKey]).length > 0)) {
      injectTracker(result[pageKey] || {});
      return;
    }

    // First visit — show prompt
    showPrompt();
  });

  function showPrompt() {
    const overlay = document.createElement("div");
    overlay.className = "episode-tracker-overlay";
    overlay.innerHTML = `
      <div class="episode-tracker-prompt">
        <p>This looks like an episode listing.<br>Enable watch tracker on this page?</p>
        <div class="episode-tracker-prompt-buttons">
          <button class="et-btn et-btn-yes">Yes</button>
          <button class="et-btn et-btn-no">No</button>
        </div>
      </div>
    `;
    document.body.appendChild(overlay);

    overlay.querySelector(".et-btn-yes").addEventListener("click", () => {
      chrome.storage.local.set({ [decisionKey]: "yes" });
      overlay.remove();
      injectTracker({});
    });

    overlay.querySelector(".et-btn-no").addEventListener("click", () => {
      chrome.storage.local.set({ [decisionKey]: "no" });
      overlay.remove();
    });
  }

  function injectTracker(watched) {
    let totalEpisodes = fileLinks.length;
    let watchedCount = 0;

    const stats = document.createElement("div");
    stats.className = "episode-tracker-stats";
    document.body.appendChild(stats);

    function updateStats() {
      watchedCount = Object.values(watched).filter(Boolean).length;
      stats.innerHTML = `
        Watched: ${watchedCount} / ${totalEpisodes}
        <div class="progress-bar">
          <div class="progress-fill" style="width: ${(watchedCount / totalEpisodes) * 100}%"></div>
        </div>
      `;
    }

    fileLinks.forEach((link) => {
      const href = link.getAttribute("href");
      const checkbox = document.createElement("input");
      checkbox.type = "checkbox";
      checkbox.className = "episode-checkbox";
      checkbox.checked = !!watched[href];

      if (watched[href]) {
        link.parentElement.classList.add("episode-watched");
      }

      checkbox.addEventListener("change", () => {
        watched[href] = checkbox.checked;
        if (checkbox.checked) {
          link.parentElement.classList.add("episode-watched");
        } else {
          link.parentElement.classList.remove("episode-watched");
        }
        chrome.storage.local.set({ [pageKey]: watched });
        updateStats();
      });

      link.parentElement.insertBefore(checkbox, link);
    });

    updateStats();
  }
})();
