(() => {
  // Detect directory listing pages: look for <pre> or <table> containing file links
  // Common patterns: Apache index, Nginx autoindex, lighttpd, etc.
  const videoExtensions = /\.(mkv|mp4|avi|wmv|flv|mov|webm|m4v|ts|srt|sub|ass|ssa)$/i;

  function getFileLinks() {
    return [...document.querySelectorAll("a")].filter((a) => {
      const href = a.getAttribute("href");
      if (!href) return false;
      // Skip parent directory and sorting links
      if (href === "../" || href === "/" || href.startsWith("?")) return false;
      // Match video files or any file with extension in directory listings
      return videoExtensions.test(href);
    });
  }

  const fileLinks = getFileLinks();
  if (fileLinks.length === 0) return; // Not a relevant page

  const pageKey = location.origin + location.pathname;

  // Load watched state from storage
  chrome.storage.local.get([pageKey], (result) => {
    const watched = result[pageKey] || {};

    let totalEpisodes = fileLinks.length;
    let watchedCount = 0;

    // Create stats widget
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

      // Apply watched styling
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
  });
})();
