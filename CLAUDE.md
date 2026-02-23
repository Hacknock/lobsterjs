# lobster.js — CLAUDE.md

## プロジェクト概要

拡張Markdownパーサーライブラリ。独自記法を含むMarkdownをパースしてリッチなHTMLを生成する。
文書構造のみを提供し、見た目はCSSに委ねる設計。

仕様書: `markdowns/lobster-spec.md`

## アーキテクチャ決定事項

- **言語:** TypeScript（型定義がiOS/Android移植時の設計ドキュメントになる）
- **パイプライン:** Markdown → AST → HTML（コアはプラットフォーム非依存）
- **配布:** ViteでESMバンドル（npm公開 + CDN利用想定）
- **テスト:** Vitest

## ディレクトリ構成（目標）

```
src/
├── core/               # プラットフォーム非依存のコアロジック
│   ├── types.ts        # ASTノード型定義
│   ├── block-parser.ts # ブロック要素パーサー
│   ├── inline-parser.ts# インライン要素パーサー
│   └── index.ts
├── renderer/
│   └── html/
│       ├── renderer.ts # AST → HTML文字列
│       └── dom.ts      # DOM操作（ブラウザ向け）
└── index.ts            # メインエントリーポイント
tests/                  # Vitestテスト
docs/                   # GitHub Pages（lobster.js自身で構築）
markdowns/              # 仕様書・テストケースMD
```

## 評価順序（仕様書より）

パーサーはこの順序でブロック要素を評価する:

```
ヘッダー > フッター >>> 詳細折りたたみ =>
  引用 => リスト > 見出し > 水平線 > コードブロック > サイレントテーブル > テーブル >
    画像 > インライン脚注 > 脚注 > ワープ > リンク > インラインリンク >
      コードスパン > 強調 > 強勢 > 打ち消し線
```

## 開発コマンド

```bash
npm test          # Vitestでテスト実行
npm run build     # Viteでバンドル生成
npm run dev       # 開発サーバー（docs/確認用）
```

## コーディング規約

- コアロジック（`src/core/`）はDOM/ブラウザAPIに依存しない純粋関数のみ
- ASTノードはunion型で定義し、`type`フィールドで判別
- 各パーサー関数は単体テストを必ず書く
- 仕様書の記述と実装の対応がわかるようにコメントを入れる

## Lobster独自記法まとめ

| 記法 | 説明 |
|------|------|
| `:::header` ... `:::` | ページヘッダー領域 |
| `:::footer` ... `:::` | ページフッター領域 |
| `:::details タイトル` ... `:::` | 折りたたみ要素 |
| `:::warp id` ... `:::` | コンテンツのワープ（別場所への転記） |
| `~ \| ... \|` | サイレントテーブル（枠線なし） |
| `\|` (テーブル内) | 水平セル結合 |
| `\---` (テーブル内) | 垂直セル結合 |
| `![alt](url =WxH)` | 画像サイズ指定 |

## GitHub Pages方針

`docs/` 以下にlobster.js自身を使って構築したドキュメントサイトを置く。
lobster.jsをロードしたindex.htmlがMarkdownファイルを読み込んでDOMを構築するデモになる。
