(() => {
  'use strict';

  // ラベル系タグ（TH, DT, LABEL）は最初から除外して値のみを対象にする
  const TARGET_TAGS = new Set(['TD', 'DD', 'SPAN', 'P', 'LI', 'DIV', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6']);
  const TARGET_SELECTOR = 'td, dd, span, p, li, div, h1, h2, h3, h4, h5, h6';
  const EXCLUDED_ANCESTOR_SELECTOR = 'button, a, input, textarea, select, label, [contenteditable=""], [contenteditable="true"]';
  const LABEL_CLASS_RE = /^(label|caption|key|legend|term)$/i;
  const LABEL_TEXT_RE = /^.{1,20}[:：]\s*$/;
  const MAX_LENGTH = 200;
  const VALID_MODES = new Set(['always', 'hover', 'click']);
  const HOVER_HIDE_DELAY_MS = 120;
  const FEEDBACK_RESET_MS = 800;
  const TOAST_DURATION_MS = 1700;
  const TOAST_MAX_LEN = 40;

  const state = {
    enabled: true,        // 実効値（rawEnabled かつ サイト無効化されていない）
    mode: 'hover',
    cleanWhitespace: true,
  };

  let rawEnabled = true;
  let disabledHosts = [];

  let mutationObserver = null;
  let documentClickHandler = null;
  let initialized = false;
  let toastHostEl = null;
  let toastHideTimer = null;

  function getSiteKey() {
    if (location.protocol === 'file:') return '__file__';
    if (location.protocol === 'http:' || location.protocol === 'https:') {
      return location.hostname || null;
    }
    return null;
  }

  function isCurrentSiteDisabled() {
    const key = getSiteKey();
    return key !== null && disabledHosts.includes(key);
  }

  function cleanWhitespaceText(s) {
    if (!s) return s;
    // 先頭末尾の空白（半角・全角・タブ・改行）を除去
    s = s.replace(/^[\s　]+|[\s　]+$/g, '');
    // 内側のタブ/改行/CR を半角空白に置換（全角空白 U+3000 は保持）
    s = s.replace(/[\t\r\n\f\v]+/g, ' ');
    // 連続する半角空白を 1 個に
    s = s.replace(/  +/g, ' ');
    return s;
  }

  function showToast(text) {
    if (!toastHostEl || !toastHostEl.isConnected) {
      toastHostEl = document.createElement('div');
      toastHostEl.dataset.copypalToast = '1';
      const shadow = toastHostEl.attachShadow({ mode: 'open' });
      const style = document.createElement('style');
      style.textContent = `
        :host {
          all: initial !important;
          position: fixed !important;
          top: 30% !important;
          left: 50% !important;
          transform: translate(-50%, -50%) !important;
          z-index: 2147483647 !important;
          pointer-events: none !important;
        }
        .toast {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          max-width: 380px;
          padding: 10px 14px 10px 12px;
          font-family: "Segoe UI", "Yu Gothic UI", "Hiragino Sans", "Meiryo", system-ui, sans-serif;
          font-size: 13px;
          line-height: 1.45;
          color: #ffffff;
          background: rgba(30, 41, 59, 0.94);
          border-radius: 6px;
          box-shadow: 0 6px 20px rgba(0, 0, 0, 0.30);
          opacity: 0;
          transform: translateY(8px);
          transition: opacity 160ms ease, transform 160ms ease;
        }
        .toast.show { opacity: 1; transform: translateY(0); }
        .icon { font-size: 14px; line-height: 1; }
        .label { color: #cbd5e1; flex-shrink: 0; }
        .text { font-weight: 600; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
      `;
      const toast = document.createElement('div');
      toast.className = 'toast';
      const icon = document.createElement('span');
      icon.className = 'icon';
      icon.textContent = '✓';
      const label = document.createElement('span');
      label.className = 'label';
      label.textContent = 'コピーしました';
      const textSpan = document.createElement('span');
      textSpan.className = 'text';
      toast.append(icon, label, textSpan);
      shadow.append(style, toast);
      document.body.appendChild(toastHostEl);
    }
    const toast = toastHostEl.shadowRoot.querySelector('.toast');
    const textSpan = toastHostEl.shadowRoot.querySelector('.text');
    const truncated = text.length > TOAST_MAX_LEN ? text.slice(0, TOAST_MAX_LEN) + '…' : text;
    textSpan.textContent = truncated;
    toast.classList.add('show');
    clearTimeout(toastHideTimer);
    toastHideTimer = setTimeout(() => {
      toast.classList.remove('show');
    }, TOAST_DURATION_MS);
  }

  function hasLabelClass(el) {
    if (!el.classList) return false;
    for (const c of el.classList) {
      if (LABEL_CLASS_RE.test(c)) return true;
    }
    return false;
  }

  function isCopyTarget(el) {
    if (!(el instanceof Element)) return false;
    if (!TARGET_TAGS.has(el.tagName)) return false;
    if (el.dataset.copypal === '1') return false;
    if (el.dataset.copypalHost === '1') return false;
    if (el.dataset.copypalToast === '1') return false;
    if (el.children.length !== 0) return false;
    const text = el.textContent.trim();
    if (text.length === 0 || text.length > MAX_LENGTH) return false;
    if (el.closest(EXCLUDED_ANCESTOR_SELECTOR)) return false;
    if (hasLabelClass(el)) return false;
    if (LABEL_TEXT_RE.test(text)) return false;
    if (el.offsetParent === null) {
      const cs = el.ownerDocument.defaultView.getComputedStyle(el);
      if (cs.display === 'none' || cs.visibility === 'hidden') return false;
    }
    return true;
  }

  function buildShadow(host, targetEl) {
    const shadow = host.attachShadow({ mode: 'open' });
    const style = document.createElement('style');
    style.textContent = `
      :host { all: initial; display: inline-block; }
      .btn {
        all: initial;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        box-sizing: border-box;
        width: 28px;
        height: 28px;
        margin-left: 6px;
        margin-right: 2px;
        padding: 0;
        border: 1px solid #b8c2cf;
        border-radius: 5px;
        background: #ffffff;
        cursor: pointer;
        font-size: 18px;
        line-height: 1;
        font-family: "Segoe UI Emoji", "Apple Color Emoji", "Noto Color Emoji", system-ui, sans-serif;
        color: #333;
        box-shadow: 0 1px 2px rgba(0,0,0,0.10);
        user-select: none;
        vertical-align: middle;
        visibility: hidden;
        transition: background-color 120ms ease, border-color 120ms ease, transform 80ms ease;
      }
      :host(.copypal-show) .btn { visibility: visible; }
      .btn:hover { background: #eaf3ff; border-color: #4a90e2; }
      .btn:active { transform: translateY(1px); }
      .btn.copied { background: #e8f6ee; border-color: #2e9e5f; }
      .btn.failed { background: #fdecea; border-color: #d9534f; }
    `;
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'btn';
    button.textContent = '📋';
    button.title = 'クリップボードにコピー';

    button.addEventListener('click', async (e) => {
      e.stopPropagation();
      e.preventDefault();
      const raw = (targetEl.textContent || '').trim();
      if (!raw) return;
      const text = state.cleanWhitespace ? cleanWhitespaceText(raw) : raw;
      try {
        await navigator.clipboard.writeText(text);
        button.textContent = '✅';
        button.classList.add('copied');
        showToast(text);
      } catch {
        button.textContent = '⚠️';
        button.classList.add('failed');
      }
      setTimeout(() => {
        button.textContent = '📋';
        button.classList.remove('copied', 'failed');
      }, FEEDBACK_RESET_MS);
    });

    shadow.append(style, button);
  }

  function attachButton(targetEl) {
    if (targetEl.dataset.copypal === '1') return;

    const host = document.createElement('span');
    host.dataset.copypalHost = '1';
    host.className = 'copypal-host';

    buildShadow(host, targetEl);

    let hideTimer = null;
    const showHost = () => {
      clearTimeout(hideTimer);
      host.classList.add('copypal-show');
    };
    const scheduleHostHide = () => {
      clearTimeout(hideTimer);
      hideTimer = setTimeout(() => host.classList.remove('copypal-show'), HOVER_HIDE_DELAY_MS);
    };

    let activeHideTimer = null;
    const showActive = () => {
      clearTimeout(activeHideTimer);
      targetEl.dataset.copypalActive = '1';
    };
    const scheduleActiveHide = () => {
      clearTimeout(activeHideTimer);
      activeHideTimer = setTimeout(() => {
        delete targetEl.dataset.copypalActive;
      }, HOVER_HIDE_DELAY_MS);
    };

    // host は target の子。target を出ない限り mouseleave は発火しないので、
    // target 側のリスナだけで十分（host へホップしても表示維持される）。
    // ハイライト（active）は click モード以外（A/B）でホバー追従、click モードのみクリック追従。
    targetEl.addEventListener('mouseenter', () => {
      if (!state.enabled) return;
      if (state.mode === 'click') return;
      showActive();
      if (state.mode === 'hover') showHost();
    });
    targetEl.addEventListener('mouseleave', () => {
      if (!state.enabled) return;
      if (state.mode === 'click') return;
      scheduleActiveHide();
      if (state.mode === 'hover') scheduleHostHide();
    });

    targetEl.addEventListener('click', (e) => {
      if (!state.enabled || state.mode !== 'click') return;
      if (e.target.closest('[data-copypal-host="1"]')) return;
      hideAllShownHosts();
      showHost();
      showActive();
      e.stopPropagation();
    });

    targetEl.dataset.copypal = '1';
    // ホストを子として追加することで、grid/flex/dl 等のレイアウトを崩さない。
    // また dataset.copypal=1 で「すでに処理済み」と識別するので、子が増えても再処理されない。
    targetEl.appendChild(host);

    if (state.mode === 'always') host.classList.add('copypal-show');
  }

  function clearAllActiveTargets() {
    document.querySelectorAll('[data-copypal-active="1"]').forEach(el => {
      delete el.dataset.copypalActive;
    });
  }

  function hideAllShownHosts() {
    document.querySelectorAll('[data-copypal-host="1"].copypal-show').forEach(h => h.classList.remove('copypal-show'));
    clearAllActiveTargets();
  }

  function applyModeToExistingHosts() {
    const hosts = document.querySelectorAll('[data-copypal-host="1"]');
    if (state.mode === 'always') {
      hosts.forEach(h => h.classList.add('copypal-show'));
    } else {
      hosts.forEach(h => h.classList.remove('copypal-show'));
    }
    // モード切替時、前モードでホバー/クリック中だったハイライトをリセット
    clearAllActiveTargets();
  }

  function scanRoot(root) {
    if (!state.enabled) return;
    if (!(root instanceof Element) && !(root instanceof Document) && !(root instanceof DocumentFragment)) return;
    if (root instanceof Element) {
      if (root.dataset && root.dataset.copypalHost === '1') return;
      if (isCopyTarget(root)) attachButton(root);
    }
    const candidates = root.querySelectorAll ? root.querySelectorAll(TARGET_SELECTOR) : [];
    candidates.forEach(el => {
      if (isCopyTarget(el)) attachButton(el);
    });
  }

  function removeAllButtons() {
    document.querySelectorAll('[data-copypal-host="1"]').forEach(h => h.remove());
    document.querySelectorAll('[data-copypal="1"]').forEach(el => {
      delete el.dataset.copypal;
    });
    clearAllActiveTargets();
  }

  function setMode(mode) {
    if (!VALID_MODES.has(mode)) mode = 'hover';
    state.mode = mode;
    document.body.classList.remove('copypal-mode-always', 'copypal-mode-hover', 'copypal-mode-click');
    document.body.classList.add(`copypal-mode-${mode}`);
    applyModeToExistingHosts();
  }

  function setEnabled(enabled) {
    state.enabled = !!enabled;
    if (state.enabled) {
      document.body.classList.add('copypal-active');
      scanRoot(document.body);
      applyModeToExistingHosts();
    } else {
      document.body.classList.remove('copypal-active');
      removeAllButtons();
    }
  }

  function startObserving() {
    if (mutationObserver) return;
    let pending = [];
    let scheduled = false;
    const flush = () => {
      scheduled = false;
      const batch = pending;
      pending = [];
      if (!state.enabled) return;
      batch.forEach(node => scanRoot(node));
    };
    mutationObserver = new MutationObserver(mutations => {
      if (!state.enabled) return;
      for (const m of mutations) {
        for (const node of m.addedNodes) {
          if (node.nodeType !== Node.ELEMENT_NODE) continue;
          if (node.dataset && (node.dataset.copypalHost === '1' || node.dataset.copypalToast === '1')) continue;
          pending.push(node);
        }
      }
      if (pending.length > 0 && !scheduled) {
        scheduled = true;
        queueMicrotask(flush);
      }
    });
    mutationObserver.observe(document.body, { subtree: true, childList: true });
  }

  function setupGlobalListeners() {
    if (documentClickHandler) return;
    documentClickHandler = (e) => {
      if (state.mode !== 'click' || !state.enabled) return;
      if (e.target.closest('[data-copypal-host="1"]')) return;
      if (e.target.closest('[data-copypal="1"]')) return;
      hideAllShownHosts();
    };
    document.addEventListener('click', documentClickHandler, true);
  }

  async function readSettings() {
    try {
      const stored = await chrome.storage.local.get({
        enabled: true,
        mode: 'hover',
        cleanWhitespace: true,
        disabledHosts: [],
      });
      rawEnabled = stored.enabled !== false;
      disabledHosts = Array.isArray(stored.disabledHosts) ? stored.disabledHosts : [];
      state.mode = VALID_MODES.has(stored.mode) ? stored.mode : 'hover';
      state.cleanWhitespace = stored.cleanWhitespace !== false;
      state.enabled = rawEnabled && !isCurrentSiteDisabled();
    } catch {
      // chrome.storage が使えない場合はデフォルトのまま
    }
  }

  function recomputeEnabled() {
    const eff = rawEnabled && !isCurrentSiteDisabled();
    if (eff !== state.enabled) setEnabled(eff);
  }

  async function init() {
    if (initialized) return;
    if (!document.body) {
      window.addEventListener('DOMContentLoaded', init, { once: true });
      return;
    }
    initialized = true;

    await readSettings();

    document.body.classList.add('copypal-root');
    document.body.classList.add(`copypal-mode-${state.mode}`);
    if (state.enabled) document.body.classList.add('copypal-active');

    setupGlobalListeners();
    if (state.enabled) scanRoot(document.body);
    applyModeToExistingHosts();
    startObserving();

    if (chrome.storage && chrome.storage.onChanged) {
      chrome.storage.onChanged.addListener((changes, area) => {
        if (area !== 'local') return;
        let needRecomputeEnabled = false;
        if ('enabled' in changes) {
          rawEnabled = changes.enabled.newValue !== false;
          needRecomputeEnabled = true;
        }
        if ('disabledHosts' in changes) {
          disabledHosts = Array.isArray(changes.disabledHosts.newValue) ? changes.disabledHosts.newValue : [];
          needRecomputeEnabled = true;
        }
        if ('mode' in changes) {
          setMode(changes.mode.newValue);
        }
        if ('cleanWhitespace' in changes) {
          state.cleanWhitespace = changes.cleanWhitespace.newValue !== false;
        }
        if (needRecomputeEnabled) recomputeEnabled();
      });
    }
  }

  init();
})();
