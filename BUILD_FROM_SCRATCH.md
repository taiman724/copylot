# CopyPal をゼロから手書きで作るガイド

ファイル転送が制限された環境で同等の拡張を **手書きで再現** するための段階的ビルド手順書。スマホで読みながらでも、A4 印刷して見ながらでも進められるように構成。

ステップ 1 だけで「ホバー時にボタンが出てコピーできる」状態が完成する。後のステップは段階的に機能を追加していく形。

---

## 0. 用意するもの

| 必要 | 何 |
|---|---|
| ✅ | Google Chrome（既にあるはず） |
| ✅ | テキストエディタ。メモ帳でも書けるが、**VS Code か Notepad++** だと `Ctrl+S` の保存が楽 |
| ✅ | 任意のフォルダ。例: `C:\Users\自分\copypal\` |

注意点:
- フォルダは **後で消えない場所** に置く（Chrome は読み込んだフォルダを参照し続けるため）
- ファイルの **拡張子に注意**。メモ帳で保存すると勝手に `.txt` が付くので、保存時に「すべてのファイル」を選び `manifest.json` のように **完全なファイル名** で保存する

---

## 1. 全体ロードマップ

| Step | 追加機能 | 目安行数 | 目安時間 |
|---|---|---|---|
| 1 | **MVP**: ホバーで📋表示・クリックでコピー | 約 50 行 | 30 分 |
| 2 | popup（ON/OFF + 3 モード切替） | +200 行 | 1 時間 |
| 3 | コピー時に余分な空白を整える | +20 行 | 15 分 |
| 4 | ハイライト（青い枠） | +25 行 | 20 分 |
| 5 | コピー成功トースト | +60 行 | 30 分 |
| 6 | サイト別 ON/OFF | +50 行 | 30 分 |

**Step 1 が完動すれば最低限の利用は可能**。Step 2 まで行くとデフォルトで使い勝手が大きく上がる。Step 3 以降はあると嬉しい上乗せ。

---

# ステップ 1: MVP

### このステップのゴール
- 任意のページを開いてテキストにマウスを乗せると 📋 ボタンが出る
- ボタンを押すとそのテキストがクリップボードにコピーされる
- ラベル（th, dt, クラス名 label, "○○:" 終わり）にはボタンが出ない
- コピー後にボタンが ✅ に変わる

### ファイル構成
```
copypal/
├── manifest.json
└── content.js
```

### 1-1. フォルダ作成
任意の場所に `copypal` フォルダを作る。

### 1-2. `manifest.json`

```json
{
  "manifest_version": 3,
  "name": "CopyPal Mini",
  "version": "0.1",
  "description": "テキスト横にコピーボタンを置く",
  "permissions": ["clipboardWrite"],
  "content_scripts": [{
    "matches": ["<all_urls>"],
    "js": ["content.js"],
    "run_at": "document_idle"
  }]
}
```

### 1-3. `content.js`

```js
(() => {
  'use strict';

  const TARGETS = 'td,dd,span,p,li,div,h1,h2,h3,h4,h5,h6';
  const EXCL = 'button,a,input,textarea,select,label,th,dt,[contenteditable]';
  const LABEL_CLASS = /^(label|caption|key|legend|term)$/i;
  const LABEL_RE = /^.{1,20}[:：]\s*$/;

  function hasLabelClass(el) {
    for (const c of el.classList) if (LABEL_CLASS.test(c)) return true;
    return false;
  }

  function isLeaf(el) {
    if (el.children.length !== 0) return false;
    if (el.dataset.cp) return false;
    if (el.dataset.cphost) return false;
    if (el.closest(EXCL)) return false;
    const t = el.textContent.trim();
    if (!t || t.length > 200) return false;
    if (LABEL_RE.test(t)) return false;
    if (hasLabelClass(el)) return false;
    if (el.offsetParent === null) {
      const cs = getComputedStyle(el);
      if (cs.display === 'none' || cs.visibility === 'hidden') return false;
    }
    return true;
  }

  function attach(el) {
    el.dataset.cp = '1';
    const host = document.createElement('span');
    host.dataset.cphost = '1';
    const sh = host.attachShadow({ mode: 'open' });
    sh.innerHTML = '<style>:host{all:initial;display:inline-block}.b{all:initial;display:inline-flex;align-items:center;justify-content:center;width:28px;height:28px;margin-left:6px;border:1px solid #b8c2cf;border-radius:5px;background:#fff;cursor:pointer;font-size:18px;line-height:1;font-family:"Segoe UI Emoji",sans-serif;visibility:hidden;vertical-align:middle;box-shadow:0 1px 2px rgba(0,0,0,.1)}:host(.s) .b{visibility:visible}.b:hover{background:#eaf3ff;border-color:#4a90e2}</style><button class="b">📋</button>';
    const b = sh.querySelector('.b');
    b.onclick = async (e) => {
      e.stopPropagation();
      try {
        await navigator.clipboard.writeText(el.textContent.trim());
        b.textContent = '✅';
      } catch {
        b.textContent = '⚠️';
      }
      setTimeout(() => { b.textContent = '📋'; }, 800);
    };
    el.addEventListener('mouseenter', () => host.classList.add('s'));
    el.addEventListener('mouseleave', () => host.classList.remove('s'));
    el.appendChild(host);
  }

  function scan(root) {
    if (!(root instanceof Element) && !(root instanceof Document)) return;
    if (root instanceof Element && isLeaf(root)) attach(root);
    root.querySelectorAll(TARGETS).forEach(el => { if (isLeaf(el)) attach(el); });
  }

  scan(document.body);
  new MutationObserver(ms => {
    for (const m of ms) for (const n of m.addedNodes) {
      if (n.nodeType !== 1) continue;
      if (n.dataset && n.dataset.cphost) continue;
      scan(n);
    }
  }).observe(document.body, { subtree: true, childList: true });
})();
```

### 1-4. Chrome に読み込ませる
1. Chrome で `chrome://extensions/` を開く
2. 右上の「**デベロッパー モード**」を ON
3. 「**パッケージ化されていない拡張機能を読み込む**」をクリック
4. `copypal` フォルダを選ぶ
5. CopyPal Mini が表示されればOK

### 1-5. 動作確認
1. 適当なページ（Wikipedia 等）を開く
2. 文字にマウスを乗せると 📋 が出るか
3. クリックして、メモ帳に Ctrl+V で貼り付けて中身確認
4. リンクやボタンには 📋 が出ないことを確認

### コードを変更したら
`chrome://extensions/` の CopyPal Mini カードの **🔄 更新ボタン** を押してから、テストページを **Ctrl+F5** で再読み込み。

### 仕組みのポイント（後から思い出す用）
- `content_scripts` で全ページに content.js を注入
- `isLeaf` で「子要素を持たない、短い、ラベルじゃない」テキスト要素を選別
- `attachShadow` でボタンをページ CSS から隔離
- `el.appendChild(host)` で対象要素の子として挿入（兄弟挿入だと grid/dl が壊れる）
- `MutationObserver` で動的に追加された要素にも対応

**ここまでで Step 1 完了。明日とりあえず動かしたいだけならここで止めてもOK。**

---

# ステップ 2: popup で ON/OFF と 3 モード切替

### このステップのゴール
- 拡張アイコンをクリックすると設定パネルが出る
- ON/OFF と「常時/ホバー/クリック」モードを切替できる
- 設定が次回起動時も保持される（chrome.storage）

### 追加するファイル
```
copypal/
├── manifest.json     ← 書き換え
├── content.js        ← 書き換え
├── popup.html        ← 新規
├── popup.js          ← 新規
└── popup.css         ← 新規
```

### 2-1. `manifest.json`（書き換え）

```json
{
  "manifest_version": 3,
  "name": "CopyPal",
  "version": "0.2",
  "description": "テキスト横にコピーボタンを置く",
  "permissions": ["activeTab", "clipboardWrite", "storage"],
  "content_scripts": [{
    "matches": ["<all_urls>"],
    "js": ["content.js"],
    "run_at": "document_idle"
  }],
  "action": {
    "default_popup": "popup.html",
    "default_title": "CopyPal の設定"
  }
}
```

変更点: `permissions` に `activeTab` と `storage` を追加、`action` を追加。

### 2-2. `popup.html`

```html
<!DOCTYPE html>
<html lang="ja">
<head>
  <meta charset="UTF-8">
  <link rel="stylesheet" href="popup.css">
</head>
<body>
  <h1>CopyPal</h1>
  <p class="lead">テキスト横の📋を押すとコピーされます。</p>

  <section class="block">
    <label class="row">
      <span>この拡張を有効にする</span>
      <input type="checkbox" id="enabled" />
    </label>
  </section>

  <section class="block" id="mode-block">
    <h2>表示方式</h2>
    <label class="radio"><input type="radio" name="mode" value="always"><span>常に表示</span></label>
    <label class="radio"><input type="radio" name="mode" value="hover"><span>ホバー時に表示</span></label>
    <label class="radio"><input type="radio" name="mode" value="click"><span>クリックで表示</span></label>
  </section>

  <script src="popup.js"></script>
</body>
</html>
```

### 2-3. `popup.js`

```js
(() => {
  'use strict';
  const DEFAULTS = { enabled: true, mode: 'hover' };
  const VALID_MODES = new Set(['always', 'hover', 'click']);

  const enabledEl = document.getElementById('enabled');
  const modeBlock = document.getElementById('mode-block');
  const modeInputs = Array.from(document.querySelectorAll('input[name="mode"]'));

  function reflectEnabled(en) {
    enabledEl.checked = !!en;
    modeBlock.classList.toggle('disabled', !en);
    modeInputs.forEach(i => { i.disabled = !en; });
  }
  function reflectMode(m) {
    if (!VALID_MODES.has(m)) m = DEFAULTS.mode;
    modeInputs.forEach(i => { i.checked = (i.value === m); });
  }

  chrome.storage.local.get(DEFAULTS).then(s => {
    reflectEnabled(s.enabled !== false);
    reflectMode(s.mode);
  });

  enabledEl.addEventListener('change', () => {
    reflectEnabled(enabledEl.checked);
    chrome.storage.local.set({ enabled: enabledEl.checked });
  });
  modeInputs.forEach(i => i.addEventListener('change', () => {
    if (!i.checked) return;
    chrome.storage.local.set({ mode: i.value });
  }));
})();
```

### 2-4. `popup.css`

```css
* { box-sizing: border-box; }
body {
  width: 260px; margin: 0; padding: 12px 16px;
  font-family: "Yu Gothic UI", "Segoe UI", sans-serif; font-size: 14px;
}
h1 { margin: 0 0 4px; font-size: 17px; }
h2 { margin: 0 0 6px; font-size: 12px; color: #666; }
.lead { color: #555; font-size: 12px; margin: 0 0 12px; }
.block { padding: 10px 0; border-top: 1px solid #eee; }
.row { display: flex; justify-content: space-between; align-items: center; cursor: pointer; }
.radio { display: flex; gap: 8px; padding: 6px 4px; cursor: pointer; }
.radio:hover { background: #eaf2ff; border-radius: 4px; }
.radio input:checked ~ span { color: #2f6fed; font-weight: 600; }
.disabled { opacity: 0.5; pointer-events: none; }
```

### 2-5. `content.js`（書き換え：完全版）

```js
(() => {
  'use strict';

  const TARGETS = 'td,dd,span,p,li,div,h1,h2,h3,h4,h5,h6';
  const EXCL = 'button,a,input,textarea,select,label,th,dt,[contenteditable]';
  const LABEL_CLASS = /^(label|caption|key|legend|term)$/i;
  const LABEL_RE = /^.{1,20}[:：]\s*$/;
  const VALID_MODES = new Set(['always', 'hover', 'click']);

  const state = { enabled: true, mode: 'hover' };

  function hasLabelClass(el) {
    for (const c of el.classList) if (LABEL_CLASS.test(c)) return true;
    return false;
  }

  function isLeaf(el) {
    if (!TARGETS.split(',').includes(el.tagName.toLowerCase())) return false;
    if (el.children.length !== 0) return false;
    if (el.dataset.cp) return false;
    if (el.dataset.cphost) return false;
    if (el.closest(EXCL)) return false;
    const t = el.textContent.trim();
    if (!t || t.length > 200) return false;
    if (LABEL_RE.test(t)) return false;
    if (hasLabelClass(el)) return false;
    if (el.offsetParent === null) {
      const cs = getComputedStyle(el);
      if (cs.display === 'none' || cs.visibility === 'hidden') return false;
    }
    return true;
  }

  function attach(el) {
    el.dataset.cp = '1';
    const host = document.createElement('span');
    host.dataset.cphost = '1';
    const sh = host.attachShadow({ mode: 'open' });
    sh.innerHTML = '<style>:host{all:initial;display:inline-block}.b{all:initial;display:inline-flex;align-items:center;justify-content:center;width:28px;height:28px;margin-left:6px;border:1px solid #b8c2cf;border-radius:5px;background:#fff;cursor:pointer;font-size:18px;line-height:1;font-family:"Segoe UI Emoji",sans-serif;visibility:hidden;vertical-align:middle;box-shadow:0 1px 2px rgba(0,0,0,.1)}:host(.s) .b{visibility:visible}.b:hover{background:#eaf3ff;border-color:#4a90e2}</style><button class="b">📋</button>';
    const b = sh.querySelector('.b');
    b.onclick = async (e) => {
      e.stopPropagation();
      try {
        await navigator.clipboard.writeText(el.textContent.trim());
        b.textContent = '✅';
      } catch {
        b.textContent = '⚠️';
      }
      setTimeout(() => { b.textContent = '📋'; }, 800);
    };
    el.addEventListener('mouseenter', () => {
      if (!state.enabled || state.mode === 'click') return;
      if (state.mode === 'hover') host.classList.add('s');
    });
    el.addEventListener('mouseleave', () => {
      if (!state.enabled || state.mode === 'click') return;
      if (state.mode === 'hover') setTimeout(() => host.classList.remove('s'), 120);
    });
    el.addEventListener('click', (e) => {
      if (!state.enabled || state.mode !== 'click') return;
      if (e.target.closest('[data-cphost]')) return;
      document.querySelectorAll('[data-cphost].s').forEach(h => h.classList.remove('s'));
      host.classList.add('s');
      e.stopPropagation();
    });
    el.appendChild(host);
    if (state.mode === 'always') host.classList.add('s');
  }

  function scan(root) {
    if (!state.enabled) return;
    if (!(root instanceof Element) && !(root instanceof Document)) return;
    if (root instanceof Element && isLeaf(root)) attach(root);
    root.querySelectorAll(TARGETS).forEach(el => { if (isLeaf(el)) attach(el); });
  }

  function applyMode() {
    const hosts = document.querySelectorAll('[data-cphost]');
    if (state.mode === 'always') hosts.forEach(h => h.classList.add('s'));
    else hosts.forEach(h => h.classList.remove('s'));
  }

  function removeAll() {
    document.querySelectorAll('[data-cphost]').forEach(h => h.remove());
    document.querySelectorAll('[data-cp]').forEach(el => delete el.dataset.cp);
  }

  function setEnabled(en) {
    state.enabled = !!en;
    if (en) { scan(document.body); applyMode(); } else { removeAll(); }
  }

  // 初期化
  chrome.storage.local.get({ enabled: true, mode: 'hover' }).then(s => {
    state.enabled = s.enabled !== false;
    state.mode = VALID_MODES.has(s.mode) ? s.mode : 'hover';
    if (state.enabled) scan(document.body);
    applyMode();
  });

  // ドキュメント全体クリックで click モードのボタンを閉じる
  document.addEventListener('click', (e) => {
    if (state.mode !== 'click' || !state.enabled) return;
    if (e.target.closest('[data-cphost]')) return;
    if (e.target.closest('[data-cp]')) return;
    document.querySelectorAll('[data-cphost].s').forEach(h => h.classList.remove('s'));
  }, true);

  // 設定変更を即時反映
  chrome.storage.onChanged.addListener((ch, area) => {
    if (area !== 'local') return;
    if ('enabled' in ch) setEnabled(ch.enabled.newValue !== false);
    if ('mode' in ch) {
      state.mode = VALID_MODES.has(ch.mode.newValue) ? ch.mode.newValue : 'hover';
      applyMode();
    }
  });

  // 動的追加対応
  new MutationObserver(ms => {
    if (!state.enabled) return;
    for (const m of ms) for (const n of m.addedNodes) {
      if (n.nodeType !== 1) continue;
      if (n.dataset && n.dataset.cphost) continue;
      scan(n);
    }
  }).observe(document.body, { subtree: true, childList: true });
})();
```

### 2-6. 動作確認
- chrome://extensions/ で更新ボタンを押す
- 拡張アイコンをクリック → popup が出るか
- ON/OFF を切り替え → ボタンが消える/復帰する
- モードを切り替え → 挙動が変わる
- ブラウザを閉じて開き直しても設定が保持されている

---

# ステップ 3: コピー時に余分な空白を整える

### ゴール
コピーする値の先頭末尾の空白を除去し、改行/タブ/連続空白を 1 個の半角空白に統一。全角空白は保持。

### 3-1. `content.js` に関数を追加（最初の方、定数定義の下あたりに）

```js
function cleanText(s) {
  if (!s) return s;
  s = s.replace(/^[\s　]+|[\s　]+$/g, '');
  s = s.replace(/[\t\r\n\f\v]+/g, ' ');
  s = s.replace(/  +/g, ' ');
  return s;
}
```

### 3-2. `state` に `cleanWhitespace` を追加

`const state = { enabled: true, mode: 'hover', cleanWhitespace: true };`

### 3-3. `b.onclick` の中身を修正

```js
b.onclick = async (e) => {
  e.stopPropagation();
  const raw = el.textContent.trim();
  const text = state.cleanWhitespace ? cleanText(raw) : raw;
  try {
    await navigator.clipboard.writeText(text);
    b.textContent = '✅';
  } catch {
    b.textContent = '⚠️';
  }
  setTimeout(() => { b.textContent = '📋'; }, 800);
};
```

### 3-4. 初期化と onChanged を修正

初期化部分:
```js
chrome.storage.local.get({ enabled: true, mode: 'hover', cleanWhitespace: true }).then(s => {
  state.enabled = s.enabled !== false;
  state.mode = VALID_MODES.has(s.mode) ? s.mode : 'hover';
  state.cleanWhitespace = s.cleanWhitespace !== false;
  if (state.enabled) scan(document.body);
  applyMode();
});
```

`onChanged` に追加:
```js
if ('cleanWhitespace' in ch) state.cleanWhitespace = ch.cleanWhitespace.newValue !== false;
```

### 3-5. `popup.html` にチェックボックスを追加（mode-block の後ろに）

```html
<section class="block">
  <h2>コピー時の整形</h2>
  <label class="row">
    <span>余分な空白を整える</span>
    <input type="checkbox" id="clean" />
  </label>
</section>
```

### 3-6. `popup.js` に追加

定数追加（`DEFAULTS` を）:
```js
const DEFAULTS = { enabled: true, mode: 'hover', cleanWhitespace: true };
```

要素取得追加:
```js
const cleanEl = document.getElementById('clean');
```

`chrome.storage.local.get(DEFAULTS).then(...)` の中に追加:
```js
cleanEl.checked = s.cleanWhitespace !== false;
```

イベント追加:
```js
cleanEl.addEventListener('change', () => {
  chrome.storage.local.set({ cleanWhitespace: cleanEl.checked });
});
```

### 3-7. 動作確認
- popup に「余分な空白を整える」チェックが出る
- ON 状態でコピー → メモ帳に貼って、先頭末尾の空白がないこと
- 改行混入のテキストをコピー → 1 行になっていること

---

# ステップ 4: ハイライト

### ゴール
ホバー or クリック中の対象要素を青背景＋枠線でハイライト。

### 4-1. `content.css` を新規作成

```css
[data-cp-active] {
  background-color: #eaf2ff !important;
  box-shadow: inset 0 0 0 2px #4a90e2 !important;
  transition: background-color 100ms ease, box-shadow 100ms ease !important;
}
```

### 4-2. `manifest.json` で content.css を読み込ませる

`content_scripts` に `"css": ["content.css"]` を追加:
```json
"content_scripts": [{
  "matches": ["<all_urls>"],
  "js": ["content.js"],
  "css": ["content.css"],
  "run_at": "document_idle"
}],
```

### 4-3. `content.js` の `attach` 関数内のイベントを修正

mouseenter/mouseleave/click を以下に置換:

```js
let activeTimer = null;
const showActive = () => {
  clearTimeout(activeTimer);
  el.dataset.cpActive = '1';
};
const scheduleActiveHide = () => {
  clearTimeout(activeTimer);
  activeTimer = setTimeout(() => delete el.dataset.cpActive, 120);
};

el.addEventListener('mouseenter', () => {
  if (!state.enabled || state.mode === 'click') return;
  showActive();
  if (state.mode === 'hover') host.classList.add('s');
});
el.addEventListener('mouseleave', () => {
  if (!state.enabled || state.mode === 'click') return;
  scheduleActiveHide();
  if (state.mode === 'hover') setTimeout(() => host.classList.remove('s'), 120);
});
el.addEventListener('click', (e) => {
  if (!state.enabled || state.mode !== 'click') return;
  if (e.target.closest('[data-cphost]')) return;
  document.querySelectorAll('[data-cphost].s').forEach(h => h.classList.remove('s'));
  document.querySelectorAll('[data-cp-active]').forEach(x => delete x.dataset.cpActive);
  host.classList.add('s');
  showActive();
  e.stopPropagation();
});
```

### 4-4. `removeAll` と document 全体クリックも修正

`removeAll` に追加:
```js
document.querySelectorAll('[data-cp-active]').forEach(x => delete x.dataset.cpActive);
```

document 全体クリックハンドラ内の `forEach` の後ろに追加:
```js
document.querySelectorAll('[data-cp-active]').forEach(x => delete x.dataset.cpActive);
```

### 4-5. 動作確認
- ホバー時に青枠で対象要素がハイライトされる
- クリックモード時はクリックでハイライト持続、別領域クリックで解除

---

# ステップ 5: コピー成功トースト

### ゴール
コピー成功時に画面中央上部に「✓ コピーしました 〇〇」を 1.7 秒表示。

### 5-1. `content.js` に `showToast` 関数を追加（`isLeaf` の前あたり）

```js
let toastEl = null;
let toastTimer = null;

function showToast(text) {
  if (!toastEl || !toastEl.isConnected) {
    toastEl = document.createElement('div');
    toastEl.dataset.cptoast = '1';
    const sh = toastEl.attachShadow({ mode: 'open' });
    sh.innerHTML = '<style>:host{all:initial!important;position:fixed!important;top:30%!important;left:50%!important;transform:translate(-50%,-50%)!important;z-index:2147483647!important;pointer-events:none!important}.t{display:inline-flex;align-items:center;gap:8px;max-width:380px;padding:10px 14px;font-family:"Yu Gothic UI","Segoe UI",sans-serif;font-size:13px;color:#fff;background:rgba(30,41,59,.94);border-radius:6px;box-shadow:0 6px 20px rgba(0,0,0,.3);opacity:0;transform:translateY(8px);transition:opacity 160ms ease,transform 160ms ease}.t.show{opacity:1;transform:translateY(0)}.l{color:#cbd5e1}.x{font-weight:600;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}</style><div class="t"><span>✓</span><span class="l">コピーしました</span><span class="x"></span></div>';
    document.body.appendChild(toastEl);
  }
  const t = toastEl.shadowRoot.querySelector('.t');
  const x = toastEl.shadowRoot.querySelector('.x');
  x.textContent = text.length > 40 ? text.slice(0, 40) + '…' : text;
  t.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('show'), 1700);
}
```

### 5-2. `b.onclick` に `showToast` 呼び出しを追加

成功時の `b.textContent = '✅';` の次の行に:
```js
showToast(text);
```

### 5-3. `isLeaf` で toast 要素を除外

`if (el.dataset.cphost) return false;` の次の行に:
```js
if (el.dataset.cptoast) return false;
```

### 5-4. MutationObserver でも toast を除外

`if (n.dataset && n.dataset.cphost) continue;` を以下に変更:
```js
if (n.dataset && (n.dataset.cphost || n.dataset.cptoast)) continue;
```

### 5-5. 動作確認
- コピー時に画面中央上部にトーストが出る
- 40 文字超は `…` で省略される
- 1.7 秒で自動消滅

---

# ステップ 6: サイト別 ON/OFF

### ゴール
popup に「このサイトでは無効化」チェックを追加。特定のサイトでだけ拡張を切れる。

### 6-1. `content.js` に site-key 判定を追加

定数の下あたりに:
```js
let disabledHosts = [];
let rawEnabled = true;

function getSiteKey() {
  if (location.protocol === 'file:') return '__file__';
  if (location.protocol === 'http:' || location.protocol === 'https:') return location.hostname || null;
  return null;
}

function isCurrentSiteDisabled() {
  const k = getSiteKey();
  return k !== null && disabledHosts.includes(k);
}
```

### 6-2. 初期化と onChanged を修正

初期化:
```js
chrome.storage.local.get({ enabled: true, mode: 'hover', cleanWhitespace: true, disabledHosts: [] }).then(s => {
  rawEnabled = s.enabled !== false;
  disabledHosts = Array.isArray(s.disabledHosts) ? s.disabledHosts : [];
  state.mode = VALID_MODES.has(s.mode) ? s.mode : 'hover';
  state.cleanWhitespace = s.cleanWhitespace !== false;
  state.enabled = rawEnabled && !isCurrentSiteDisabled();
  if (state.enabled) scan(document.body);
  applyMode();
});
```

`onChanged`:
```js
chrome.storage.onChanged.addListener((ch, area) => {
  if (area !== 'local') return;
  let recompute = false;
  if ('enabled' in ch) { rawEnabled = ch.enabled.newValue !== false; recompute = true; }
  if ('disabledHosts' in ch) { disabledHosts = Array.isArray(ch.disabledHosts.newValue) ? ch.disabledHosts.newValue : []; recompute = true; }
  if ('mode' in ch) { state.mode = VALID_MODES.has(ch.mode.newValue) ? ch.mode.newValue : 'hover'; applyMode(); }
  if ('cleanWhitespace' in ch) state.cleanWhitespace = ch.cleanWhitespace.newValue !== false;
  if (recompute) {
    const eff = rawEnabled && !isCurrentSiteDisabled();
    if (eff !== state.enabled) setEnabled(eff);
  }
});
```

### 6-3. `popup.html` に site セクションを追加（enabled の下、mode の上）

```html
<section class="block" id="site-block" hidden>
  <label class="row">
    <span>このサイトでは無効化 <small id="host"></small></span>
    <input type="checkbox" id="site-disable" />
  </label>
</section>
```

### 6-4. `popup.js` に追加

要素取得:
```js
const siteBlock = document.getElementById('site-block');
const siteDisable = document.getElementById('site-disable');
const hostEl = document.getElementById('host');
let currentKey = null;

function getSiteKey(url) {
  try {
    const u = new URL(url);
    if (u.protocol === 'file:') return '__file__';
    if (u.protocol === 'http:' || u.protocol === 'https:') return u.hostname || null;
  } catch {}
  return null;
}
```

`DEFAULTS` を更新:
```js
const DEFAULTS = { enabled: true, mode: 'hover', cleanWhitespace: true, disabledHosts: [] };
```

`chrome.storage.local.get(DEFAULTS).then(...)` の中の処理を非同期化:
```js
chrome.storage.local.get(DEFAULTS).then(async s => {
  reflectEnabled(s.enabled !== false);
  reflectMode(s.mode);
  cleanEl.checked = s.cleanWhitespace !== false;

  const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
  if (tabs[0] && tabs[0].url) {
    currentKey = getSiteKey(tabs[0].url);
    if (currentKey) {
      siteBlock.hidden = false;
      hostEl.textContent = currentKey === '__file__' ? '（ローカルファイル）' : currentKey;
      siteDisable.checked = (s.disabledHosts || []).includes(currentKey);
    }
  }
});
```

イベント追加:
```js
siteDisable.addEventListener('change', async () => {
  if (!currentKey) return;
  const s = await chrome.storage.local.get({ disabledHosts: [] });
  const list = Array.isArray(s.disabledHosts) ? s.disabledHosts.slice() : [];
  const idx = list.indexOf(currentKey);
  if (siteDisable.checked) { if (idx === -1) list.push(currentKey); }
  else { if (idx !== -1) list.splice(idx, 1); }
  await chrome.storage.local.set({ disabledHosts: list });
});
```

### 6-5. 動作確認
- 任意の URL で popup を開くとサイト名が表示される
- チェックを入れるとそのサイトでは📋が消える
- 別サイトでは普通に動く

---

# トラブルシューティング

| 症状 | 確認 |
|---|---|
| 拡張が読み込めない | `manifest.json` の構文エラー（コンマ忘れ等）。Chrome がエラー表示してくれる |
| 📋 が出ない | content.js が注入されてるか DevTools の Sources タブで確認。F12 → Console でエラー確認 |
| popup が出ない | manifest の `action.default_popup` 設定を確認 |
| 設定が保存されない | `permissions` に `storage` が入っているか |
| クリップボードに入らない | `permissions` に `clipboardWrite` が入っているか。https / http ページでテスト（file:// は制限あり） |
| 修正が反映されない | chrome://extensions/ の更新ボタン → ページ Ctrl+F5 |

# DevTools での確認方法

1. F12 で DevTools を開く
2. Console タブ: エラーが出ていないか
3. Elements タブ: `data-cp="1"` や `data-cphost="1"` が付いた要素を確認
4. ⚙️ アイコン → Show user agent shadow DOM にチェック → Shadow DOM の中身も見える

# 動作確認チェックリスト（最終形）

Step 6 まで完了したら以下が動くこと:

- [ ] 拡張アイコンクリックで popup 表示
- [ ] ON/OFF 切替でボタンが消える/復帰
- [ ] 3 モード切替が即時反映
- [ ] サイト別無効化が動く（hostname 表示も）
- [ ] 余分な空白整形 ON/OFF が動く
- [ ] ホバー時にハイライト＋ボタン表示
- [ ] クリック後にトースト表示
- [ ] ブラウザ再起動後も設定が保持される
- [ ] 動的追加された要素にもボタンが付く
- [ ] th, dt, label クラス, コロン終わりにはボタン出ない
- [ ] 200 文字超にはボタン出ない

---

# 補足: 一気に書くコツ

スマホでこのファイルを見ながら書く場合:
1. **manifest.json から始める** — 一番短い。ここで manifest 構文に慣れる
2. **content.js の Step 1 を完成させる** — 最も大事。ここまでで動く
3. **動作確認を都度やる** — 数行書くごとにリロードして確認すると、エラー位置が特定しやすい
4. **複雑な innerHTML はあとで** — Shadow DOM の `sh.innerHTML = '...'` は長い。最初は中身を空にしてもよい（ただしボタンが出ない）

VS Code が使えるなら、ファイル全体をコピペできるので圧倒的に楽。手元の PC で何が使えるか事前に把握しておく。

---

# 最後に: ファイル一覧（最終形）

```
copypal/
├── manifest.json          ステップ 1, 2 で作成・更新（4 で css 追加）
├── content.js             全ステップで追加修正
├── content.css            ステップ 4 で新規作成
├── popup.html             ステップ 2 で作成（3, 6 で追加）
├── popup.js               ステップ 2 で作成（3, 6 で追加）
└── popup.css              ステップ 2 で作成
```

これで全機能完備。エディタが限られた環境でも、ステップ 1 だけならすぐ動かせる。健闘を祈る。
