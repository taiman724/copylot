# CopyPal

> ページ上のテキスト横にコピーボタン (📋) を表示するシンプルな Chrome 拡張

[![Manifest V3](https://img.shields.io/badge/Manifest-V3-blue)](https://developer.chrome.com/docs/extensions/mv3/intro/)

「テキストをなぞって選択 → Ctrl+C」を **1 クリック** に短縮します。

---

## 使い方

1. テキストにマウスを乗せると、要素の右側に 📋 が現れる
2. 📋 をクリックでクリップボードにコピー（中央上に「✓ コピーしました 〇〇」のトーストが出る）
3. 必要なところに移動して `Ctrl+V` で貼り付け

---

## インストール（開発者モード）

1. このリポジトリを ZIP でダウンロード、または `git clone`
2. Chrome で `chrome://extensions/` を開く
3. 右上の **「デベロッパー モード」** を ON
4. 左上の **「パッケージ化されていない拡張機能を読み込む」** をクリック
5. `extension/` フォルダを選択
6. 任意のページを開いてテキストにマウスを乗せると 📋 が表示される

---

## 機能

- **ホバー時のみコピーボタンを表示** — 通常時は完全に非表示でページのレイアウトに一切影響しない
- **対象要素のハイライト** — どの範囲がコピーされるかを視覚化
- **コピー成功トースト** — 画面中央上部に「✓ コピーしました 〇〇」を一瞬表示
- **コピー時の整形** — 先頭末尾の空白除去、改行・タブ・連続半角空白を 1 個の半角空白に（全角空白は保持）
- **サイト別 ON/OFF** — ボタンが邪魔なサイトでは無効化可能
- **設定の永続化** — ブラウザを閉じても設定は保持される

ツールバーの 📋 アイコンから設定パネルを開けます。

---

## 権限

| 権限 | 用途 |
|---|---|
| `activeTab` | 現在のタブの DOM にボタンを注入 |
| `clipboardWrite` | クリップボードへの書き込み（読み取り権限なし） |
| `storage` | ユーザー設定の保存（ローカルのみ） |

**ネットワーク権限なし。データの外部送信ゼロ。** 完全ローカル動作。

---

## 技術スタック

- **Manifest V3** — Chrome 拡張の最新規格
- **素の JavaScript / CSS** — フレームワーク・ビルドツールなし
- **Shadow DOM** — ボタンとスタイルをページ CSS から完全隔離
- **MutationObserver** — SPA・動的読込ページにも対応
- **chrome.storage.local** — 設定の永続化
- **navigator.clipboard.writeText** — クリップボード書き込み

---

## ファイル構成

```
copylot/
├── extension/              Chrome 拡張本体
│   ├── manifest.json
│   ├── content.js          ページに注入する本体ロジック
│   ├── content.css         ホスト要素のレイアウト + ハイライト
│   ├── popup.html / popup.js / popup.css   設定パネル
│   └── icons/icon{16,48,128}.png
├── tools/make-icons.ps1    アイコン PNG 生成スクリプト（Windows）
└── README.md               本書
```

### アイコンを再生成したい場合（Windows）

```powershell
powershell -ExecutionPolicy Bypass -File .\tools\make-icons.ps1
```

---

## ライセンス

このリポジトリは個人プロジェクトとして公開しています。利用は自由ですが、再配布や改変版の公開時は出典を明記してください。
