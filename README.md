# CopyPal

> ページ上のテキスト横にコピーボタン（📋）を配置し、転記作業を効率化する Chrome 拡張

[![Manifest V3](https://img.shields.io/badge/Manifest-V3-blue)](https://developer.chrome.com/docs/extensions/mv3/intro/)

---

## 何ができるか

ウェブページのテキスト要素にマウスを乗せると 📋 が現れ、クリックでクリップボードにコピーされる。「テキストをなぞって選択 → Ctrl+C」を **1 クリック** に短縮するだけのシンプルな拡張。

主な機能:
- **3 つの表示方式**: 常時 / ホバー / クリック の切替
- **対象要素のハイライト**: コピーされる範囲が視覚的にわかる
- **コピー成功トースト**: 画面中央上部に「✓ コピーしました 〇〇」を一瞬表示
- **コピー時の整形**: 余分な空白・改行を自動で整える
- **サイト別 ON/OFF**: ボタンが邪魔なサイトでは無効化可能
- **設定保持**: ブラウザを閉じても設定が残る

---

## インストール（プロトタイプ・開発者モード）

1. このリポジトリを **ZIP でダウンロード** または `git clone`
2. Chrome で `chrome://extensions/` を開く
3. 右上「**デベロッパー モード**」を ON
4. 「**パッケージ化されていない拡張機能を読み込む**」をクリック
5. `extension/` フォルダを選択
6. 完了。任意のページを開いてテキストにマウスを乗せると 📋 が出る

### アイコンを生成したい場合（Windows）
リポジトリには既にアイコン PNG が同梱されているが、再生成したい場合:
```powershell
powershell -ExecutionPolicy Bypass -File tools/make-icons.ps1
```

---

## 動作確認

`test/sample.html` を Chrome で開くと、各種レイアウト（テーブル / dl / div / カード / 動的追加）でボタンの挙動を確認できる。

---

## ファイル構成

```
copypal/
├── extension/              Chrome 拡張本体
│   ├── manifest.json
│   ├── content.js          ページに注入する本体ロジック
│   ├── content.css         ホスト要素のレイアウト + ハイライト
│   ├── popup.html / popup.js / popup.css   設定パネル
│   └── icons/icon{16,48,128}.png
├── test/sample.html        ローカル動作確認用ページ
├── tools/make-icons.ps1    アイコン PNG 生成スクリプト（Windows）
├── DESIGN.md               設計意図と背景
├── ARCHITECTURE.md         構造・技術・仕組みの解説
├── BUILD_FROM_SCRATCH.md   ゼロから手書きで再現するためのビルド手順書
└── README.md               本書
```

---

## 技術スタック

- **Manifest V3** — Chrome 拡張の最新規格
- **素の JavaScript / CSS** — フレームワーク・ビルドツールなし
- **Shadow DOM** — ボタンとスタイルをページ CSS から完全隔離
- **MutationObserver** — SPA・動的読込ページにも対応
- **chrome.storage.local** — 設定の永続化（業務データは保存しない）
- **navigator.clipboard.writeText** — クリップボード書き込み（読み取りはしない）

---

## 権限

| 権限 | 用途 |
|---|---|
| `activeTab` | 現在のタブの DOM 操作 + popup から現タブの hostname 取得 |
| `clipboardWrite` | コピーボタンでテキストをクリップボードに書き込み |
| `storage` | ユーザー設定（4 項目）の保存 |

**ネットワーク権限なし。データの外部送信ゼロ。** 詳細は [DESIGN.md](DESIGN.md) §7 を参照。

---

## ドキュメント

- **[DESIGN.md](DESIGN.md)** — なぜこういう設計にしたか（設計意図・トレードオフ）
- **[ARCHITECTURE.md](ARCHITECTURE.md)** — 構造・技術・仕組み（エンジニア以外にも読めるように整理）
- **[BUILD_FROM_SCRATCH.md](BUILD_FROM_SCRATCH.md)** — ファイル転送が制限された環境で同等の拡張を手書き再現する段階的ビルド手順書

---

## ライセンス

このリポジトリは個人プロジェクトとして公開しています。利用は自由ですが、再配布や改変版の公開時は出典を明記してください。
