# CopyPal — 構造・技術・仕組みの解説

このドキュメントは「CopyPal が何で、どう動いているか」を **エンジニア以外にも読めるように** 整理したものです。審査時の説明資料、同僚への共有、将来の自分が「あれどうなってたっけ」と思ったときの早見表として使えます。

---

## 0. 一言で言うと

> ページのテキストの横に **📋 ボタン** を出して、押したらクリップボードにコピーするだけの Chrome 拡張。送信先サイトには一切触らない。

---

## 1. ファイル構成と役割

```
copypal/
├── DESIGN.md                    なぜこういう設計にしたか（設計意図）
├── ARCHITECTURE.md              本書（実装の構造と技術）
├── BUILD_FROM_SCRATCH.md        ゼロから手書きで再現するためのビルド手順書
├── README.md                    リポジトリ概要
├── extension/                   Chrome 拡張本体
│   ├── manifest.json            権限と構成の宣言
│   ├── content.js               ページに注入されてボタンを置く本体ロジック
│   ├── content.css              ホスト要素のレイアウト + ハイライトスタイル
│   ├── popup.html               拡張アイコンクリック時のパネル UI
│   ├── popup.js                 popup の挙動（設定読み書き）
│   ├── popup.css                popup のスタイル
│   └── icons/icon{16,48,128}.png  拡張アイコン
├── test/sample.html             ローカル動作確認用ページ
└── tools/make-icons.ps1         アイコン PNG 生成スクリプト
```

| ファイル | 役割 | 行数（目安） |
|---|---|---|
| `manifest.json` | Chrome に「この拡張は何ができるか」を宣言 | ~30 |
| `content.js` | 本体ロジック。ページを走査・ボタン注入・クリップボード書込・モード制御・ハイライト・トースト | ~440 |
| `content.css` | ホスト span のレイアウトとハイライトの 2 つだけ（残りは Shadow DOM 内） | ~25 |
| `popup.*` | ON/OFF、サイト無効化、表示方式、整形 ON/OFF の設定 UI | 各 100〜200 |

---

## 2. 動作フロー（ユーザーがページを開いてコピーするまで）

```
[ユーザー]                  [Chrome]                [content.js]            [Web ページ]
     │                          │                        │                        │
 ① ページを開く ───────────►│                        │                        │
                                │ ② content.js を注入──►                        │
                                                         │ ③ 設定を読み込む       │
                                                         │   (chrome.storage)     │
                                                         │ ④ ページを走査 ───────►│
                                                         │ ⑤ 対象要素にボタン挿入 │
                                                         │   (Shadow DOM)         │
 ⑥ テキストにマウスを置く ─────────────────────────────►│  ボタン表示&ハイライト │
 ⑦ 📋 ボタンを押す ────────────────────────────────────►│ ⑧ textContent 取得     │
                                                         │ ⑨ 整形（オプション）   │
                                                         │ ⑩ Clipboard API 書込   │
                                                         │ ⑪ ✅ + トースト表示    │
 ⑫ 別タブに切り替え                                     │                        │
 ⑬ Ctrl+V で貼り付け                                    │                        │
```

ポイント:
- `content.js` はページが読み込まれるたびに **新しく注入される**（タブごとに独立）
- `chrome.storage.local` の値は **全タブで共有**。popup で設定を変えると、開いている全タブの content.js が即座に反映する
- 通信は `chrome.storage` と `clipboard` 以外発生しない（外部サーバーへのリクエストはゼロ）

---

## 3. 使っている主な技術

### Manifest V3
Chrome 拡張の最新規格（2023〜）。古い MV2 と比べてセキュリティが強化されており、IT 審査でも標準的な構成として通りやすい。CopyPal は **service worker（常駐プロセス）を一切使わない** 最小構成で実装している。

### Content Script
拡張がページに注入する JavaScript のこと。`manifest.json` の `content_scripts` で `<all_urls>` 指定（全 URL に注入、ただしクリックされたタブだけが `activeTab` 権限の対象）。
- ページの DOM を読み書きできる
- ページ自身の JS とは **別空間（Isolated World）** で動くので、変数や関数が混ざらない
- ページの window.fetch などをフックすることはできない

### Shadow DOM
ボタンとそのスタイルを「ページから見えにくい箱」に閉じ込める標準 Web API。
```
<span data-copypal-host="1">     ← ホスト（light DOM）
   #shadow-root (open)            ← この中はページの CSS が入ってこない
     <style>...</style>
     <button>📋</button>
</span>
```
これによりページの CSS がボタンに干渉せず、逆にボタンの CSS がページに漏れない。`mode: 'open'` だがスタイルは隔離される。

### MutationObserver
DOM が変更されたことを検知する API。SPA や動的読込のページでも、新しく追加された要素にボタンを付与できる。
```js
new MutationObserver(callback).observe(document.body, {
  subtree: true,    // 子孫すべて
  childList: true,  // 子要素の追加・削除を監視
});
```
追加されたノードを `queueMicrotask` でバッチ処理し、頻繁な更新でも軽い。

### chrome.storage.local
ローカル PC 内に Key-Value で値を保存する API（同期しない）。
- 保存される 4 つのキー: `enabled`, `mode`, `cleanWhitespace`, `disabledHosts`
- 業務データ（取り扱う情報）は一切入らない
- `chrome.storage.onChanged` を購読すると、別タブやポップアップでの変更を即受信できる → 全タブ同期の仕組み

### navigator.clipboard.writeText
ブラウザ標準のクリップボード書き込み API。
- 書き込み専用（`writeText`）。読み取り（`readText`）は使わない、権限も要求しない
- ユーザー操作（クリック）の延長で呼ぶ必要がある（Chrome の制約）→ ボタンクリックハンドラ内で呼ぶので問題なし

---

## 4. 状態管理（設定の保存と同期）

```
[popup.js]                        [chrome.storage.local]                    [content.js × N タブ]
    │                                       │                                        │
    │ chrome.storage.local.set ────────────►│                                        │
    │  { enabled, mode, ... }               │ ──────── onChanged を発火 ───────────►│ ① 設定を更新
    │                                                                                │ ② 必要なら再スキャン or
    │                                                                                │   既存ボタンの表示更新
    └─ chrome.storage.local.get ◄──────────┤
       初期表示時に値を読む
```

### 保存される設定
| キー | 型 | デフォルト | 意味 |
|---|---|---|---|
| `enabled` | boolean | `true` | 拡張全体の ON/OFF |
| `mode` | string | `'hover'` | 表示方式: `'always'` / `'hover'` / `'click'` |
| `cleanWhitespace` | boolean | `true` | コピー時に空白整形するか |
| `disabledHosts` | string[] | `[]` | 無効化するサイトのキー一覧（hostname または `__file__`） |

### 「実効的に有効か」の計算
グローバル ON かつ 現サイトが `disabledHosts` に入っていない、の AND。content.js 内では:
```
state.enabled = rawEnabled && !disabledHosts.includes(getSiteKey())
```
popup や別タブの設定変更時、content.js 側で再計算され、必要なら全ボタンを取り外す or 再付与する。

---

## 5. 対象テキストの判定ロジック

ボタンを付ける対象を選ぶフィルタ（`isCopyTarget` 関数）:

| ステップ | チェック内容 |
|---|---|
| ① タグ | `td` / `dd` / `span` / `p` / `li` / `div` / `h1〜h6` のいずれか |
| ② 既処理 | `data-copypal="1"` が付いていないこと |
| ③ ホスト | 自分自身が CopyPal のホスト or トーストでない |
| ④ 末端 | 子に Element ノードを持たない（テキストのみ） |
| ⑤ テキスト長 | 1〜200 文字（空でなく長すぎない） |
| ⑥ 除外祖先 | `button` / `a` / `input` / `textarea` / `select` / `label` / `[contenteditable]` の中にいない |
| ⑦ ラベルクラス | `label` / `caption` / `key` / `legend` / `term` のクラスを持たない |
| ⑧ ラベルパターン | コロン終端の短いテキスト（`住所:`, `電話：`等）でない |
| ⑨ 表示中 | `display:none` / `visibility:hidden` でない |

これらをすべて通った要素にボタンを付ける。**ラベルではなく "値" だけを対象にする** ためのフィルタ。

---

## 6. 表示モードの違い

| モード | ボタン | ハイライト | 使い時 |
|---|---|---|---|
| **A: always**（常時） | 常時表示 | ホバー中のみ | サクサク連打したい人向け。画面が📋だらけになる |
| **B: hover**（ホバー） | ホバー時のみ | ホバー時のみ | デフォルト。画面が静かでバランス良い |
| **C: click**（クリック） | クリックで出現 / 別領域クリックで消える | クリック後持続 | 誤タップを避けたい人向け。1 ステップ多い |

実装上はすべて同じ「ホスト要素 + Shadow DOM のボタン」を使い、表示の制御だけが違う。モード切替は `body` の class と各ホスト要素の `copypal-show` class を付け替えるだけで完了する（重い再構築なし）。

---

## 7. コピーボタンが出るまで

```
<td>山田 太郎</td>
                ↓ content.js が走査
<td data-copypal="1">山田 太郎<span data-copypal-host="1">
                                 #shadow-root
                                   <style>.btn {...}</style>
                                   <button class="btn">📋</button>
                               </span></td>
```

- 元の `<td>` には `data-copypal="1"` マーカーが付き、ホスト span が **子要素として** 末尾に挿入される
- 兄弟挿入だと `<dl>` / grid / flex 等の親レイアウトを壊すため、子挿入を採用
- ホスト span は Shadow DOM を持ち、ボタンとそのスタイルが完全隔離される

---

## 8. コピーが起きるまで

```js
// 簡略化した擬似コード
async function onButtonClick() {
  const raw = targetEl.textContent.trim();
  const text = state.cleanWhitespace ? cleanWhitespaceText(raw) : raw;
  await navigator.clipboard.writeText(text);
  showToast(text);                     // 画面中央上に「コピーしました 〇〇」
  button.textContent = '✅';
  setTimeout(() => button.textContent = '📋', 800);
}
```

- `targetEl.textContent` は **light DOM** のテキストのみ。Shadow DOM 内のボタン（📋）は混入しない（ブラウザ標準仕様）
- 整形オン時:
  - 先頭末尾の空白除去（半角・全角・タブ・改行すべて）
  - 中の改行/タブ/連続半角空白 → 1 個の半角空白
  - 全角空白は保持（`山田　太郎` の中央の `　` はそのまま）
- トーストも Shadow DOM 内に作る（ページ CSS の影響なし）

---

## 9. セキュリティ設計

### 通信
**ゼロ**。`fetch` / `XMLHttpRequest` / `WebSocket` / `Image src` 等のネットワーク呼び出しは全コードを通じて存在しない。`manifest.json` にも `host_permissions` や `webRequest` を含まない。

### 権限の最小性
| 取っている権限 | 必要な理由 |
|---|---|
| `activeTab` | ボタン注入 + popup から現タブの hostname 取得 |
| `clipboardWrite` | クリップボード書き込み |
| `storage` | ユーザー設定 4 項目の保存 |

取っていないもの: `tabs`, `clipboardRead`, `cookies`, `webRequest`, `host_permissions`, `bookmarks`, `history`, `downloads`, `nativeMessaging` など。

### データ保存
- **業務データは保存しない**（クリップボードに書き込んだら役目終了）
- `chrome.storage.local` に入るのは UI の設定 4 項目のみ
- ローカル PC 内のみで完結。外部送信なし

### ページへの書き込み
- 対象要素に `data-copypal` 属性を付ける
- 対象要素の末尾に `<span class="copypal-host">` を 1 個挿入する
- それ以外（フォーム入力、リンク追加、ページ遷移、JS 関数呼び出し等）は **一切しない**

### 隔離
- Content Script は Isolated World で実行され、ページ自身の JS と変数空間を共有しない
- ボタンの見た目とロジックは Shadow DOM に閉じ込められ、ページ CSS の干渉を受けない

---

## 10. 既知の制限と将来の余地

| 項目 | 現状 | 対応案 |
|---|---|---|
| iframe 内のテキスト | ボタン出ない（`all_frames: false`） | 対象ページが iframe 構造なら `all_frames: true` に変更（審査説明追記必要） |
| 200 文字超のテキスト | 対象外 | 段落文の自動コピーは別 UI で対応する余地あり |
| Shadow DOM 内のページ要素 | 対象外（ページ側の Shadow には入れない） | 標準仕様の制約。回避不可 |
| chrome:// などの内部 URL | 注入されない | Chrome の仕様。回避不可 |
| ラベル判定の取りこぼし | クラス名が `field-label` 等の場合は除外されない | 必要なら正規表現を `label` 部分一致に拡張 |
| キーボードショートカット | なし | 必要なら `commands` API で追加可能 |
| コピー履歴 | なし | 拡張範囲を超える（IT 審査で論点増える） |

---

## 11. 動作確認手順（短縮版）

1. `chrome://extensions/` を開いてデベロッパーモード ON
2. 「パッケージ化されていない拡張機能を読み込む」→ `extension/` フォルダを選択
3. `test/sample.html` を Chrome で開く
4. ツールバーの 📋 アイコンから popup を開いて各モード切替・整形 ON/OFF・サイト無効化を試す
5. ボタンクリック後にメモ帳等に Ctrl+V して中身を確認

詳細は [DESIGN.md](DESIGN.md) §動作確認手順 を参照。

---

## 12. 用語集

| 用語 | 意味 |
|---|---|
| Manifest V3 | Chrome 拡張の最新規格。background はサービスワーカー（常駐ではない） |
| content script | ページに注入される JS。Isolated World で動く |
| Isolated World | content script 専用の変数空間。ページの JS とは混ざらない |
| Shadow DOM | 要素の中に独立した DOM ツリーを作る Web 標準。スタイルが隔離される |
| MutationObserver | DOM 変更を検知する API |
| Light DOM | 通常の DOM（Shadow DOM の外側） |
| `<all_urls>` | manifest の matches 指定で「すべての URL」を意味する |
| `activeTab` | ユーザーが拡張アイコンをクリックしたタブにだけ与えられる一時的な権限 |
