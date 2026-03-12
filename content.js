(() => {
  const videoExtensions = /\.(mkv|mp4|avi|wmv|flv|mov|webm|m4v|srt|sub|ass|ssa)$/i;

  function getAllFileLinks() {
    return [...document.querySelectorAll("a")].filter((a) => {
      const href = a.getAttribute("href");
      if (!href) return false;
      if (href === "../" || href === "/" || href.startsWith("?")) return false;
      // Match any link with a file extension
      return /\.\w{2,4}$/.test(href);
    });
  }

  function getVideoLinks(allLinks) {
    return allLinks.filter((a) => videoExtensions.test(a.getAttribute("href")));
  }

  const allFileLinks = getAllFileLinks();
  // Use video links if available, otherwise fall back to all file links
  const fileLinks = getVideoLinks(allFileLinks);
  const trackableLinks = fileLinks.length > 0 ? fileLinks : allFileLinks;

  if (trackableLinks.length === 0) return;

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
        <strong>Serial Episode Tracker</strong>
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
    let totalEpisodes = trackableLinks.length;
    let watchedCount = 0;

    const stats = document.createElement("div");
    stats.className = "episode-tracker-stats";
    document.body.appendChild(stats);

    function updateStats() {
      watchedCount = Object.values(watched).filter(Boolean).length;
      stats.innerHTML = `
        <span class="stats-text">Watched: ${watchedCount} / ${totalEpisodes}</span>
        <button class="et-cancel-btn" title="Remove tracker from this page">&times;</button>
        <div class="progress-bar">
          <div class="progress-fill" style="width: ${(watchedCount / totalEpisodes) * 100}%"></div>
        </div>
      `;
      stats.querySelector(".et-cancel-btn").addEventListener("click", () => {
        chrome.storage.local.remove([pageKey]);
        chrome.storage.local.set({ [decisionKey]: "no" });
        stats.remove();
        document.querySelectorAll(".episode-checkbox").forEach((cb) => cb.remove());
        document.querySelectorAll(".episode-watched").forEach((el) => el.classList.remove("episode-watched"));
      });
    }

    trackableLinks.forEach((link) => {
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
