(() => {
  // One-time migration: clear domain "no" decisions from old cancel button bug
  chrome.storage.local.get("migrated_v2", (r) => {
    if (r.migrated_v2) return;
    chrome.storage.local.get(null, (all) => {
      const staleKeys = Object.keys(all).filter(
        (k) => k.startsWith("decision:") && all[k] === "no"
      );
      if (staleKeys.length) chrome.storage.local.remove(staleKeys);
      chrome.storage.local.set({ migrated_v2: true });
    });
  });

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
  const trackableLinks = getVideoLinks(allFileLinks);

  if (trackableLinks.length < 2) return;

  const pageKey = location.origin + location.pathname;
  const pageSkipKey = "skip:" + pageKey;
  const domainDecisionKey = "decision:" + location.origin;

  chrome.storage.local.get([pageKey, pageSkipKey, domainDecisionKey], (result) => {
    // This specific page was cancelled — do nothing
    if (result[pageSkipKey]) return;

    const decision = result[domainDecisionKey];

    // Already declined for domain — do nothing
    if (decision === "no") return;

    // Already accepted or has watch data — inject directly
    if (decision === "yes" || (result[pageKey] && Object.keys(result[pageKey]).length > 0)) {
      injectTracker(result[pageKey] || {});
      return;
    }

    // First visit — show prompt
    showPrompt();
  });

  function el(tag, attrs, ...children) {
    const node = document.createElement(tag);
    if (attrs) Object.entries(attrs).forEach(([k, v]) => {
      if (k === "className") node.className = v;
      else if (k === "title") node.title = v;
      else node.setAttribute(k, v);
    });
    children.forEach((c) => {
      if (typeof c === "string") node.appendChild(document.createTextNode(c));
      else if (c) node.appendChild(c);
    });
    return node;
  }

  function showPrompt() {
    const yesBtn = el("button", { className: "et-btn et-btn-yes" }, "Yes");
    const noBtn = el("button", { className: "et-btn et-btn-no" }, "No");

    const overlay = el("div", { className: "episode-tracker-overlay" },
      el("div", { className: "episode-tracker-prompt" },
        el("strong", null, "Serial Episode Tracker"),
        el("p", null, "This looks like an episode listing.", document.createElement("br"), "Enable watch tracker on this page?"),
        el("div", { className: "episode-tracker-prompt-buttons" }, yesBtn, noBtn)
      )
    );
    document.body.appendChild(overlay);

    yesBtn.addEventListener("click", () => {
      chrome.storage.local.set({ [domainDecisionKey]: "yes" });
      overlay.remove();
      injectTracker({});
    });

    noBtn.addEventListener("click", () => {
      chrome.storage.local.set({ [domainDecisionKey]: "no" });
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
      stats.textContent = "";
      const cancelBtn = el("button", { className: "et-cancel-btn", title: "Remove tracker from this page" }, "\u00D7");
      const progressFill = el("div", { className: "progress-fill" });
      progressFill.style.width = (watchedCount / totalEpisodes) * 100 + "%";
      stats.appendChild(el("span", { className: "stats-text" }, `Watched: ${watchedCount} / ${totalEpisodes}`));
      stats.appendChild(cancelBtn);
      stats.appendChild(el("div", { className: "progress-bar" }, progressFill));
      cancelBtn.addEventListener("click", () => {
        chrome.storage.local.remove([pageKey]);
        chrome.storage.local.set({ [pageSkipKey]: true });
        stats.remove();
        document.querySelectorAll(".episode-checkbox").forEach((cb) => cb.remove());
        document.querySelectorAll(".episode-watched").forEach((e) => e.classList.remove("episode-watched"));
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
