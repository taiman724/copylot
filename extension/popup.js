(() => {
  'use strict';

  const DEFAULTS = {
    enabled: true,
    mode: 'hover',
    cleanWhitespace: true,
    disabledHosts: [],
  };
  const VALID_MODES = new Set(['always', 'hover', 'click']);

  const enabledToggle = document.getElementById('enabled-toggle');
  const modeBlock = document.getElementById('mode-block');
  const modeInputs = Array.from(document.querySelectorAll('input[name="mode"]'));
  const cleanToggle = document.getElementById('clean-toggle');
  const siteBlock = document.getElementById('site-block');
  const siteToggle = document.getElementById('site-disable-toggle');
  const siteHostnameEl = document.getElementById('site-hostname');

  let currentSiteKey = null;

  function getSiteKey(url) {
    try {
      const u = new URL(url);
      if (u.protocol === 'file:') return '__file__';
      if (u.protocol === 'http:' || u.protocol === 'https:') {
        return u.hostname || null;
      }
      return null;
    } catch {
      return null;
    }
  }

  function getSiteLabel(key) {
    if (key === '__file__') return 'ローカルファイル';
    return key;
  }

  function reflectEnabled(enabled) {
    enabledToggle.checked = !!enabled;
    modeBlock.classList.toggle('disabled', !enabled);
    modeInputs.forEach(i => { i.disabled = !enabled; });
  }

  function reflectMode(mode) {
    if (!VALID_MODES.has(mode)) mode = DEFAULTS.mode;
    modeInputs.forEach(i => { i.checked = (i.value === mode); });
  }

  function reflectCleanWhitespace(on) {
    cleanToggle.checked = on !== false;
  }

  function reflectSiteDisabled(disabled) {
    siteToggle.checked = !!disabled;
  }

  async function getActiveTab() {
    try {
      const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
      return tabs && tabs[0];
    } catch {
      return null;
    }
  }

  async function load() {
    const stored = await chrome.storage.local.get(DEFAULTS);
    reflectEnabled(stored.enabled !== false);
    reflectMode(stored.mode);
    reflectCleanWhitespace(stored.cleanWhitespace !== false);

    const tab = await getActiveTab();
    if (tab && tab.url) {
      currentSiteKey = getSiteKey(tab.url);
      if (currentSiteKey) {
        siteBlock.hidden = false;
        siteHostnameEl.textContent = getSiteLabel(currentSiteKey);
        const disabledHosts = Array.isArray(stored.disabledHosts) ? stored.disabledHosts : [];
        reflectSiteDisabled(disabledHosts.includes(currentSiteKey));
      }
    }
  }

  enabledToggle.addEventListener('change', () => {
    const enabled = enabledToggle.checked;
    reflectEnabled(enabled);
    chrome.storage.local.set({ enabled });
  });

  modeInputs.forEach(input => {
    input.addEventListener('change', () => {
      if (!input.checked) return;
      const mode = input.value;
      if (!VALID_MODES.has(mode)) return;
      chrome.storage.local.set({ mode });
    });
  });

  cleanToggle.addEventListener('change', () => {
    chrome.storage.local.set({ cleanWhitespace: cleanToggle.checked });
  });

  siteToggle.addEventListener('change', async () => {
    if (!currentSiteKey) return;
    const stored = await chrome.storage.local.get({ disabledHosts: [] });
    const list = Array.isArray(stored.disabledHosts) ? stored.disabledHosts.slice() : [];
    const idx = list.indexOf(currentSiteKey);
    if (siteToggle.checked) {
      if (idx === -1) list.push(currentSiteKey);
    } else {
      if (idx !== -1) list.splice(idx, 1);
    }
    await chrome.storage.local.set({ disabledHosts: list });
  });

  load();
})();
