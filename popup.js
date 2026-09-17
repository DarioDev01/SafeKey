const DEFAULT_SETTINGS = { enabled: true, blockSending: true, ignoredPatterns: [], ignoredDomains: [] };

function render() {
  chrome.storage.sync.get(DEFAULT_SETTINGS, (settings) => {
    document.getElementById("enabled").checked = settings.enabled;
    document.getElementById("blockSending").checked = settings.blockSending;

    const domainsEl = document.getElementById("domains");
    domainsEl.innerHTML = "";
    if (settings.ignoredDomains.length === 0) {
      domainsEl.innerHTML = `<span class="empty">None yet.</span>`;
      return;
    }
    settings.ignoredDomains.forEach((domain) => {
      const row = document.createElement("div");
      row.className = "domain-row";
      row.innerHTML = `<span>${domain}</span><button data-domain="${domain}">remove</button>`;
      domainsEl.appendChild(row);
    });

    domainsEl.querySelectorAll("button").forEach((btn) => {
      btn.addEventListener("click", () => {
        const domain = btn.getAttribute("data-domain");
        const updated = settings.ignoredDomains.filter((d) => d !== domain);
        chrome.storage.sync.set({ ignoredDomains: updated }, render);
      });
    });
  });
}

document.getElementById("enabled").addEventListener("change", (e) => {
  chrome.storage.sync.set({ enabled: e.target.checked });
});

document.getElementById("blockSending").addEventListener("change", (e) => {
  chrome.storage.sync.set({ blockSending: e.target.checked });
});

render();
