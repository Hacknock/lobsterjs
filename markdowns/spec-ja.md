# lobster.js 仕様書

> 英語版: [spec.md](./spec.md)

## 概要

lobster.js は拡張Markdown方言をパースしてHTML文書構造を生成するライブラリです。
**文書の構造だけを提供し、視覚的な表現はCSSに委ねます。** レンダリングされるHTMLには `lbs-*` クラス名が付与されるため、任意のスタイルシートで装飾できます。

### 基本方針

- パースは各行内で**前方一致（左から右、最初にマッチしたものが優先）**。
- 各行の末尾スペースはパース前に除去する。
- Markdown内のHTMLタグは**プレーンテキスト**として扱う（エスケープされる）。
- 同じ定義が複数ある場合、**後のものが上書き**する（例外あり）。

---

## 評価順序

```
ヘッダー > フッター >>> 詳細折りたたみ =>
  引用 => リスト > 見出し > 水平線 > コードブロック > サイレントテーブル > テーブル >
    画像 > インライン脚注 > 脚注参照 > ワープ参照 > インラインリンク > リンク >
      コードスパン > 強勢 > 強調 > 打ち消し線
```

`:::header` / `:::footer` / `:::warp` ブロックはドキュメント全体をスキャンする第一パスで抽出され、本文パースの前に取り出される。

---

## ブロック要素

### 見出し（Headings）

```
# H1
## H2
### H3
#### H4
##### H5
###### H6
```

- `#` の数がレベル（1〜6）を決める。`#` とテキストの間には1つ以上のスペースが必要。
- 行末のスペース + `#` は無視する: `# タイトル ##` → H1「タイトル」。
- 同じ行内の他のMarkdown記法も内包できる。

**HTML出力:**

```html
<p class="lbs-heading-1">…</p>
<!-- ～ -->
<p class="lbs-heading-6">…</p>
```

---

### 段落（Paragraph）

1つ以上の空行を境に段落を区切る。

**HTML出力:**

```html
<p class="lbs-paragraph">…</p>
```

---

### 改行（Line Breaks）

段落内の改行は `<br>` に変換される。段落の最後の改行は変換しない。

> 注意: 行末2スペースによる改行は特別扱いしない。単純な改行で `<br>` が入る。

---

### 水平線（Horizontal Rule）

`-` または `*` を3つ以上並べる（間にスペースを挟んでもよい）:

```
---
- - -
***
* * *
```

混在（`--**` など）は認識しない。

**HTML出力:**

```html
<hr class="lbs-hr">
```

---

### コードブロック（Code Block）

`` ``` `` または `~~~` 3文字以上でフェンスする。開始フェンスに言語識別子とオプションのファイル名を付けられる:

````
```js:filename.js
console.log("Hello");
```
````

- 言語: フェンスマーカー直後の英数字。
- ファイル名: 言語の後ろに `:ファイル名` で指定。使用不可文字: `` ` `` と `:`。
- 言語省略可（ファイル名だけも指定可能）。
- コンテンツはプレーンテキスト（Markdownとして解釈しない）。

**HTML出力:**

```html
<div class="lbs-code-block">
  <div class="lbs-code-filename">filename.js</div>  <!-- ファイル名なしの場合は省略 -->
  <pre data-language="js" data-filename="filename.js"><code>…</code></pre>
</div>
```

---

### 引用（Blockquote）

行頭の `>` で始まる行。連続した `>` 行（または空行なしの続き行）は一つの引用ブロックになる。`>` を重ねることで多重引用ができる:

```
> 外側の引用
> > 内側の引用
```

引用内では他のMarkdown記法を自由に使える。

**HTML出力:**

```html
<blockquote class="lbs-blockquote">…</blockquote>
```

---

### リスト（List）

先頭記号とテキストの間には1つ以上のスペースが必要。

#### 順序なしリスト（Bullet List）

先頭記号: `-`, `*`, `+`

```
- アイテム
- アイテム
  - ネストされたアイテム
```

インデントが親より深いとサブアイテムになる。ネスト深さはリストノードで管理される。

**HTML出力:**

```html
<ul class="lbs-ul lbs-ul-depth-0">
  <li class="lbs-list-item">…</li>
</ul>
```

#### 番号付きリスト（Ordered List）

先頭記号: `N.`（Nは任意の整数）

```
1. 最初
2. 二番目
   1. ネスト
```

`N\.`（バックスラッシュエスケープ）はリストとして扱わない。`start` 属性は最初のアイテムの番号を反映する。

**HTML出力:**

```html
<ol class="lbs-ol lbs-ol-depth-0" start="1">
  <li class="lbs-list-item">…</li>
</ol>
```

#### チェックリスト（Checklist）

順序なし・番号付きリスト両方に適用可能:

```
- [ ] 未チェック
- [x] チェック済み
- [X] チェック済み（大文字でも可）
```

**HTML出力:**

```html
<li class="lbs-list-item">
  <input type="checkbox" class="lbs-checkbox" disabled> …
  <!-- [x]/[X] には checked 属性が付く -->
</li>
```

---

### テーブル（Table）

最低限、ヘッダー行と整列行が必要。行頭・行末の `|` はなくてもパースできる。

```
| 名前  | 年齢 |
| ----- | ---- |
| Alice | 30   |
```

#### 整列（Alignment）

| セル記法 | 意味 |
| :------- | :--- |
| `---`    | デフォルト（CSSの `text-align` に従う） |
| `:---`   | 左寄せ |
| `:---:`  | 中央寄せ |
| `---:`   | 右寄せ |

セルの前後にスペースがあっても可。`---` や `:` の**間**にスペースは不可。

#### セルの結合（Lobster独自）

**水平結合** — `\|` でエスケープすると隣のセルと結合する:

```
| A | B \|   |
```

**垂直結合** — `\---`（ダッシュ1本以上）で上のセルと結合する:

```
| A | B |
| \--- | C |
```

#### カラム数の補完

ヘッダーより少ないセル数のアイテム行は、空セルで補完される。

**HTML出力:**

```html
<table class="lbs-table">
  <thead><tr><th>…</th></tr></thead>
  <tbody><tr><td>…</td></tr></tbody>
</table>
```

整列はインラインスタイル `style="text-align:…"` で各セルに付与される。

---

## インライン要素

ブロック内のテキストを左から右にパースする。

### コードスパン（Code Span）

`` `code` ``

バッククォートを含めたい場合は、使いたいバッククォートの数+1で囲む（前後のスペース1つが必要）:
`` `` `code` `` ``

開始デリミタが2つ以上のバッククォートの場合、コンテンツの先頭・末尾のスペース1つずつが除去される。

**HTML出力:** `<code class="lbs-code-span">…</code>`

---

### 強調 - 斜体（Emphasis）

`*テキスト*` または `_テキスト_`

- 開始・終了デリミタは同じ文字でないと認識しない。
- 改行をまたぐことはできない。
- `**テキスト*` → リテラル `*` + 強調 `*テキスト*`。

**HTML出力:** `<span class="lbs-emphasis">…</span>`

---

### 強勢 - 太字（Strong）

`**テキスト**` または `__テキスト__`

- 開始・終了デリミタは同じ文字でないと認識しない。
- 改行をまたぐことはできない。
- `***テキスト***` → リテラル `*` + 強勢 `**テキスト**` + リテラル `*`。

**HTML出力:** `<span class="lbs-strong">…</span>`

---

### 打ち消し線（Strikethrough）

`~~テキスト~~`

- `~~~テキスト~~~` のような場合は一番内側のペアのみを認識する。
- 改行をまたぐことはできない。

**HTML出力:** `<span class="lbs-strikethrough">…</span>`

---

### インラインリンク（Inline Link）

`[テキスト](URL "タイトル")`

- `]` と `(` の間にスペースがあってはいけない。
- タイトルは省略可。`"…"` / `'…'` / `(…)` いずれでもよい。
- テキスト・URLは空でもパースできる。

**HTML出力:** `<a href="URL" title="タイトル">…</a>`

---

### リンク（Reference Link）

```
[テキスト][id]        ← 参照
[id]: URL "タイトル"  ← 定義（ドキュメント内のどこでも可）
```

- `[テキスト][]` — 省略記法: テキスト自体がidになる。
- `[テキスト]` — 定義idと一致すれば解決する（暗黙的ショートカット）。
- idの照合は大文字・小文字を区別しない。
- タイトルは `"…"` / `'…'` / `(…)` いずれでもよい。タイトルは次の行に書いてもよい。
- 複数の `[テキスト][id]` が一つの定義を共有できる（N対1）。
- 定義行はコンテンツとして出力されない。

**HTML出力:** `<a href="URL" title="タイトル">…</a>`

---

### 画像（Image）

`![alt](URL "タイトル" =WxH)`

- インラインリンクと同じルール。
- `!` と `[` の間にスペースは不可。
- サイズは省略可: `=800x600`、`=800x`（幅のみ）、`=x600`（高さのみ）。

**HTML出力:**

```html
<img src="URL" alt="alt" title="タイトル" width="800" height="600" class="lbs-image">
```

---

### 脚注参照（Footnote Reference）

```
[^id]              ← 参照（インライン）
[^id]: テキスト   ← 定義（ドキュメント内のどこでも可）
```

- `[^id]` と `[^id]:` の中にスペースを入れてはいけない。
- 同じ脚注への複数参照は `[1]`, `[1:1]`, `[1:2]`, … と番号付けされる。
- 定義行はコンテンツとして出力されない。
- 定義はドキュメント末尾に脚注セクションとして出力される。

**HTML出力（参照部）:**

```html
<sup class="lbs-footnote-ref"><a href="#lbs-fn-id">[1]</a></sup>
```

**HTML出力（脚注セクション）:**

```html
<section class="lbs-footnotes">
  <ol>
    <li id="lbs-fn-id" class="lbs-footnote-item">[1] …</li>
  </ol>
</section>
```

---

### インライン脚注（Inline Footnote）

`^[テキスト]`

- `^` と `[` の間にスペースは不可。
- 名前付き脚注参照と同じように動作するが、定義をインラインに書く形式。
- 脚注参照より優先される（前方一致）。

**HTML出力:** 脚注参照と同じ。

---

## Lobster独自記法

すべてのカスタムブロック（`:::header`、`:::footer`、`:::details`、`:::warp`）は `:::` 行で閉じる。閉じ `:::` の先頭の空白は無視されるため、フォーマッターがインデントしても正しく動作する。

> **推奨スタイル:** 閉じ `:::` の直前に空行を入れる。これにより、Markdownフォーマッター（Prettierなど）が `:::` をリスト項目などの継続行として誤って解釈・インデントするのを防げる。

### ヘッダー（Header）

```
:::header
コンテンツ
:::
```

- ドキュメントに1つだけ。複数記述した場合は後のものが上書きする。
- `:::header` / `:::footer` 以外のMarkdownを自由に使える。
- 本文より先に出力される。

**HTML出力:**

```html
<header class="lbs-header">…</header>
```

---

### フッター（Footer）

```
:::footer
コンテンツ
:::
```

ヘッダーと同じルール。脚注セクション（あれば）の後、ドキュメントの末尾に出力される。

**HTML出力:**

```html
<footer class="lbs-footer">…</footer>
```

---

### 詳細折りたたみ（Details）

```
:::details サマリータイトル
コンテンツ
:::
```

- タイトルは `:::details` と同じ行に書く。
- `:::header` / `:::footer` 以外のMarkdownを使える。

**HTML出力:**

```html
<details class="lbs-details">
  <summary class="lbs-summary">サマリータイトル</summary>
  …
</details>
```

---

### ワープ（Warp）

```
:::warp my-id
コンテンツ
:::
```

- 名前付きコンテンツブロックを定義し、`[~my-id]` で別の場所に展開する。
- idはドキュメント内で一意でなければならない。重複した場合、内容は全てプレーンテキストとして扱われる。
- 使用可能なid文字: 英数字、`-`、`_`。
- 定義場所では出力されず、参照場所でのみ出力される。

**ワープ参照:**

`[~my-id]`

サイレントテーブルのセルで使うと段組みレイアウトを作れる。

**例:**

```
~ |     左     |     右    |
~ | [~col-left] | [~col-right] |

:::warp col-left
左カラムのコンテンツ
:::

:::warp col-right
右カラムのコンテンツ
:::
```

---

### サイレントテーブル（Silent Table）

テーブルの全行に `~ ` プレフィックスを付けると枠線が非表示になる:

```
~ | カラム1 | カラム2 |
~ | ------- | ------- |
~ | A       | B       |
```

**HTML出力:**

```html
<table class="lbs-table lbs-table-silent">…</table>
```

---

## CSSクラス一覧

| クラス | 要素 |
| :----- | :--- |
| `lbs-heading-1` 〜 `lbs-heading-6` | 見出し段落 |
| `lbs-paragraph` | 本文段落 |
| `lbs-emphasis` | 斜体スパン |
| `lbs-strong` | 太字スパン |
| `lbs-strikethrough` | 打ち消し線スパン |
| `lbs-code-span` | インラインコード |
| `lbs-hr` | 水平線 |
| `lbs-code-block` | コードブロックのラッパー `<div>` |
| `lbs-code-filename` | コードブロック内のファイル名ラベル |
| `lbs-blockquote` | 引用ブロック |
| `lbs-ul` | 順序なしリスト |
| `lbs-ul-depth-N` | ネスト深さ（0がトップレベル） |
| `lbs-ol` | 番号付きリスト |
| `lbs-ol-depth-N` | ネスト深さ |
| `lbs-list-item` | リストアイテム |
| `lbs-checkbox` | チェックリストのチェックボックス |
| `lbs-table` | テーブル |
| `lbs-table-silent` | サイレント（枠線なし）テーブル |
| `lbs-image` | 画像 |
| `lbs-header` | ページヘッダー |
| `lbs-footer` | ページフッター |
| `lbs-details` | 詳細折りたたみブロック |
| `lbs-summary` | 詳細折りたたみのサマリー要素 |
| `lbs-footnote-ref` | 脚注の上付き文字 |
| `lbs-footnotes` | 脚注セクション |
| `lbs-footnote-item` | 個別の脚注エントリ |

---

## API

```typescript
import { toHTML, parseDocument, renderDocument } from 'lobsterjs';

// 一番シンプル: Markdown → HTML文字列
const html = toHTML(markdownString);

// ステップ分割（ツール連携やカスタムレンダラー向け）
const doc = parseDocument(markdownString);  // → Document AST
const html = renderDocument(doc);           // → HTML文字列

// ブラウザ: MarkdownファイルをフェッチしてDOM要素にレンダリング
import { loadMarkdown } from 'lobsterjs';
await loadMarkdown('./content.md', document.getElementById('app'));
```

### Document AST

`parseDocument` が返す `Document` オブジェクト:

```typescript
interface Document {
  header?: HeaderContainerNode;
  footer?: FooterContainerNode;
  body: BlockNode[];
  linkDefs: Record<string, LinkDef>;
  footnoteDefs: Record<string, InlineNode[]>;
  footnoteRefs: string[];
  warpDefs: Record<string, WarpDefinitionNode>;
}
```

全型定義は [`src/core/types.ts`](../src/core/types.ts) を参照。

---

## 参考

- [Original Markdown Syntax](https://daringfireball.net/projects/markdown/syntax)
- [CommonMark Spec](https://spec.commonmark.org/)
