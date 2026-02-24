:::header

# ![lobster.js](./lobsterjs-light.png =48x48) lobster.js

**Markdownだけで、Webページを設計しよう。**

lobster.js を使えば拡張Markdown記法で簡単にリッチな静的Webサイトが作れます。

:::

このページ自体が lobster.js でレンダリングされています^[index.html はわずか 15 行。lobster.js を読み込み、Markdown ファイルを指定するだけで完成です。]。

---

## 普通の Markdown にできないこと

標準 Markdown では HTML の埋め込みが必要なことが、lobster.js では簡単な拡張Markdown記法で書けます。
下の 2 カラムレイアウトも HTML 埋め込み無しで実現できます。

~ | | |
~ | :--- | :--- |
~ | [~compare-no] | [~compare-yes] |

:::warp compare-no

### 標準 Markdown

- 段組レイアウト → **不可**
- テーブルセル結合 → **不可**
- 折りたたみ → `<details>` タグが必要
- ヘッダー / フッター → HTML 構造が必要
- 脚注 → パーサー依存、非対応が多い

:::

:::warp compare-yes

### lobster.js

- 段組 → `:::warp` + サイレントテーブル
- セル結合 → `\|`（横）/ `\---`（縦）
- 折りたたみ → `:::details タイトル`
- ヘッダー / フッター → `:::header` / `:::footer`
- 脚注 → `[^id]` またはインライン `^[テキスト]`

:::

---

## :::warp — Markdown で段組レイアウト

`:::warp id` で名前付きコンテンツブロックを定義し、`[~id]` でどこにでも配置できます。
ワープ参照をサイレントテーブル（`~ |`）に並べれば、HTML も CSS も書かずに段組が完成します。

~ | | | |
~ | :--- | :--- | :--- |
~ | [~card-light] | [~card-portable] | [~card-ast] |

:::warp card-light

### 軽量

依存ゼロ。ESM バンドルは **22 KB**（gzip: 6 KB）。

`<script type="module">` 1 行で動き始めます。

:::

:::warp card-portable

### ポータブル

コアパーサーは DOM 非依存の純粋関数。Node.js・Deno で動作し、iOS/Android への移植も視野に入れた設計です。

:::

:::warp card-ast

### AST ファースト

`parseDocument()` で完全な中間 AST を取得できます。カスタムレンダラーの構築や独自ツールへの統合が可能です。

:::

---

## :::details — 折りたたみブロック

標準 Markdown では `<details>` タグを書く必要があります。lobster.js なら`:::details`と`:::`で囲むだけです。

:::details インライン記法チートシート（クリックで展開）

~ | | |
~ | :--- | :--- |
~ | [~cheat-inline] | [~cheat-block] |

:::warp cheat-inline

**インライン記法**

| 記法           | 出力                                                            |
| :------------- | :-------------------------------------------------------------- |
| `**太字**`     | **太字**                                                        |
| `*斜体*`       | _斜体_                                                          |
| `~~打ち消し~~` | ~~打ち消し~~                                                    |
| `` `コード` `` | `コード`                                                        |
| `[text](url)`  | [リンク](https://github.com/Hacknock/lobsterjs)                 |
| `^[注]`        | インライン脚注^[脚注はドキュメント末尾にまとめて出力されます。] |

:::

:::warp cheat-block

**ブロック記法**

> 引用ブロック
>
> > ネストした引用

チェックリスト:

- [x] ヘッダー / フッター
- [x] 段組レイアウト
- [x] 折りたたみブロック
- [x] セル結合テーブル

:::

:::

---

## テーブルセル結合

標準 Markdown にはセル結合の仕様がありません。lobster.js は `\---`（縦方向）と `\|`（横方向）をサポートします。

| カテゴリ   | 機能                | 記法                           |
| :--------- | :------------------ | :----------------------------- |
| レイアウト | 段組レイアウト      | `:::warp` + サイレントテーブル |
| \---       | 折りたたみブロック  | `:::details タイトル`          |
| \---       | ヘッダー / フッター | `:::header` / `:::footer`      |
| テーブル   | 横方向セル結合      | `` `\|` ``                     |
| \---       | 縦方向セル結合      | `` `\---` ``                   |
| \---       | サイレントテーブル  | `` `~ \|` `` プレフィックス    |

左列の「レイアウト」と「テーブル」はそれぞれ 3 行にわたって縦方向セル結合しています。

---

## クイックスタート

```html:index.html
<!DOCTYPE html>
<html>
  <head>
    <!-- スターター CSS — 自分のスタイルシートに差し替えてください -->
    <link rel="stylesheet" href="https://hacknock.github.io/lobsterjs/style.css">
  </head>
  <body>
    <div id="content"></div>
    <script type="module">
      import { loadMarkdown } from 'https://hacknock.github.io/lobsterjs/lobster.js';
      loadMarkdown('./content.md', document.getElementById('content'));
    </script>
  </body>
</html>
```

Node.js / Deno でも動作します:

```typescript
import { toHTML, parseDocument } from "lobsterjs";

// 1 行で変換
const html = toHTML("# Hello **lobster**");

// AST 経由（カスタムレンダラー・ツール統合向け）
const ast = parseDocument(markdownString);
```

---

:::footer
[lobster.js on GitHub](https://github.com/Hacknock/lobsterjs) — MIT License
:::
