// content.js
// Watches text fields on the page, warns when a credential pattern is detected,
// and BLOCKS sending (Enter key or form submit) until the user confirms.

(function () {
  const DEFAULT_SETTINGS = { enabled: true, blockSending: true, ignoredPatterns: [], ignoredDomains: [] };
  let settings = DEFAULT_SETTINGS;
  let banner = null;
  let modal = null;
  let lastWarnedValue = "";

  // Tracks the current finding for each text field
  const fieldFindings = new WeakMap();
  // Fields/forms allowed to pass through ONCE (after the user confirms)
  const allowOnceFields = new WeakSet();
  const allowOnceForms = new WeakSet();

  function loadSettings(cb) {
    chrome.storage.sync.get(DEFAULT_SETTINGS, (result) => {
      settings = result;
      cb();
    });
  }

  function currentDomain() {
    return window.location.hostname;
  }

  function isIgnoredDomain() {
    return settings.ignoredDomains.includes(currentDomain());
  }

  // --- Informational banner (shown while typing) ---

  function ensureBanner() {
    if (banner) return banner;
    banner = document.createElement("div");
    banner.id = "safekey-banner";
    banner.innerHTML = `
      <span id="safekey-banner-text"></span>
      <button id="safekey-dismiss">Dismiss</button>
      <button id="safekey-mute">Mute this site</button>
      <button id="safekey-close" aria-label="Close">✕</button>
    `;
    document.documentElement.appendChild(banner);
    banner.querySelector("#safekey-close").addEventListener("click", hideBanner);
    banner.querySelector("#safekey-dismiss").addEventListener("click", hideBanner);
    banner.querySelector("#safekey-mute").addEventListener("click", () => {
      settings.ignoredDomains.push(currentDomain());
      chrome.storage.sync.set({ ignoredDomains: settings.ignoredDomains });
      hideBanner();
    });
    return banner;
  }

  function showBanner(finding) {
    const el = ensureBanner();
    el.querySelector("#safekey-banner-text").textContent =
      `SafeKey: this looks like a ${finding.label}. Double-check before sending.`;
    el.classList.add("safekey-visible");
  }

  function hideBanner() {
    if (banner) banner.classList.remove("safekey-visible");
  }

  // --- Blocking modal (shown on send attempt) ---

  function ensureModal() {
    if (modal) return modal;
    modal = document.createElement("div");
    modal.id = "safekey-modal-overlay";
    modal.innerHTML = `
      <div id="safekey-modal">
        <div id="safekey-modal-icon">🛑</div>
        <h2>SafeKey blocked this send</h2>
        <p id="safekey-modal-text"></p>
        <div id="safekey-modal-actions">
          <button id="safekey-modal-cancel">Cancel and review</button>
          <button id="safekey-modal-confirm">Send anyway</button>
        </div>
      </div>
    `;
    document.documentElement.appendChild(modal);
    modal.querySelector("#safekey-modal-cancel").addEventListener("click", hideModal);
    modal.addEventListener("click", (e) => {
      if (e.target === modal) hideModal();
    });
    return modal;
  }

  let pendingConfirmAction = null;

  function showModal(finding, onConfirm) {
    const el = ensureModal();
    el.querySelector("#safekey-modal-text").textContent =
      `Detected: ${finding.label}. If you continue, it will be sent as written.`;
    pendingConfirmAction = onConfirm;
    el.querySelector("#safekey-modal-confirm").onclick = () => {
      hideModal();
      if (pendingConfirmAction) pendingConfirmAction();
      pendingConfirmAction = null;
    };
    el.classList.add("safekey-visible");
  }

  function hideModal() {
    if (modal) modal.classList.remove("safekey-visible");
    pendingConfirmAction = null;
  }

  // --- Detection while typing ---

  function getFieldValue(target) {
    return target.isContentEditable ? target.innerText : target.value;
  }

  function isEditableField(target) {
    if (!target) return false;
    return (
      target.tagName === "TEXTAREA" ||
      (target.tagName === "INPUT" && ["text", "search", "url", ""].includes(target.type)) ||
      target.isContentEditable
    );
  }

  function handleTextEvent(e) {
    if (!settings.enabled || isIgnoredDomain()) return;
    const target = e.target;
    if (!isEditableField(target)) return;

    const value = getFieldValue(target);
    const finding = value ? window.__safekeyScan(value) : null;
    fieldFindings.set(target, finding);

    if (!finding) {
      hideBanner();
      return;
    }
    if (value === lastWarnedValue) return;
    lastWarnedValue = value;
    showBanner(finding);
  }

  // --- Send interception: Enter-to-send ---

  function handleKeydownCapture(e) {
    if (!settings.enabled || !settings.blockSending || isIgnoredDomain()) return;
    if (e.key !== "Enter" || e.shiftKey || e.ctrlKey || e.altKey || e.metaKey) return;

    const target = e.target;
    if (!isEditableField(target)) return;
    if (allowOnceFields.has(target)) {
      allowOnceFields.delete(target);
      return; // let it through, the user already confirmed
    }

    const value = getFieldValue(target);
    const finding = value ? window.__safekeyScan(value) : null;
    if (!finding) return;

    // Block the send
    e.preventDefault();
    e.stopPropagation();
    e.stopImmediatePropagation();

    showModal(finding, () => {
      allowOnceFields.add(target);
      target.focus();
      // Re-dispatch Enter so the site can handle it normally
      const newEvent = new KeyboardEvent("keydown", {
        key: "Enter", code: "Enter", keyCode: 13, which: 13,
        bubbles: true, cancelable: true,
      });
      target.dispatchEvent(newEvent);
    });
  }

  // --- Send interception: native forms (<form submit>) ---

  function handleSubmitCapture(e) {
    if (!settings.enabled || !settings.blockSending || isIgnoredDomain()) return;
    const form = e.target;
    if (allowOnceForms.has(form)) {
      allowOnceForms.delete(form);
      return;
    }

    // Check every text field inside the form
    const fields = form.querySelectorAll("textarea, input[type=text], input[type=search], input:not([type])");
    let finding = null;
    for (const field of fields) {
      const value = getFieldValue(field);
      finding = value ? window.__safekeyScan(value) : null;
      if (finding) break;
    }
    if (!finding) return;

    e.preventDefault();
    e.stopPropagation();
    e.stopImmediatePropagation();

    showModal(finding, () => {
      allowOnceForms.add(form);
      if (form.requestSubmit) form.requestSubmit();
      else form.submit();
    });
  }

  loadSettings(() => {
    console.log("[SafeKey] content.js active on", window.location.hostname, "| enabled:", settings.enabled, "| blocking:", settings.blockSending);
    document.addEventListener("input", handleTextEvent, true);
    document.addEventListener("paste", (e) => {
      setTimeout(() => handleTextEvent(e), 0);
    }, true);
    document.addEventListener("keydown", handleKeydownCapture, true);
    document.addEventListener("submit", handleSubmitCapture, true);
  });

  chrome.storage.onChanged.addListener((changes) => {
    for (const key in changes) {
      settings[key] = changes[key].newValue;
    }
  });
})();
