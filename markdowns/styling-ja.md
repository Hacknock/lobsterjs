# lobster.js — CSS 作成ガイド

lobster.js はすべての要素に `lbs-*` クラス名を付与した HTML を出力します。
デフォルトのスタイルシートはバンドルされていません — 見た目は完全にあなたが管理します。

このガイドでは各 Markdown 記法に対応する正確な HTML 出力を示します。
CSS を自分で書く際、または AI に書かせる際の参照資料としてご利用ください。

---

## ページ全体の構造

レンダリング結果はこの順序で出力されます。

```html
<header class="lbs-header">...</header>   <!-- :::header ブロック（あれば） -->

<!-- 本文ブロック群 -->

<section class="lbs-footnotes">...</section>  <!-- 脚注が存在する場合 -->

<footer class="lbs-footer">...</footer>   <!-- :::footer ブロック（あれば） -->
```

---

## ブロック要素

### 見出し

`# H1` ～ `###### H6` は `<hN>` ではなく `<p>` として出力されます。
ページ見出し階層との衝突を避けるための設計です。

```html
<p class="lbs-heading-1">…</p>
<p class="lbs-heading-2">…</p>
<!-- … lbs-heading-3 〜 lbs-heading-6 -->
```

### 段落

```html
<p class="lbs-paragraph">…</p>
```

### 水平線

```html
<hr class="lbs-hr">
```

### 引用ブロック

```html
<blockquote class="lbs-blockquote">
  <!-- ネストしたブロック要素 -->
</blockquote>
```

### コードブロック

````markdown
```js:script.js
const x = 1;
```
````

```html
<div class="lbs-code-block">
  <div class="lbs-code-filename">script.js</div>   <!-- ファイル名指定時のみ -->
  <pre data-language="js" data-filename="script.js">
    <code class="language-js">const x = 1;</code>
  </pre>
</div>
```

- `data-language` および `<code>` の `class="language-*"` により Prism.js / highlight.js と連携できます。
- `lbs-code-filename` はファイル名が指定された場合（`` ```js:script.js ``）のみ出力されます。

### リスト

```html
<!-- 箇条書きリスト（depth = ネスト深度、0 始まり） -->
<ul class="lbs-ul lbs-ul-depth-0">
  <li class="lbs-list-item">…</li>
  <li class="lbs-list-item">
    <!-- サブリスト -->
    <ul class="lbs-ul lbs-ul-depth-1">…</ul>
  </li>
</ul>

<!-- 番号付きリスト -->
<ol class="lbs-ol lbs-ol-depth-0">
  <li class="lbs-list-item">…</li>
</ol>

<!-- チェックリスト -->
<li class="lbs-list-item">
  <input type="checkbox" class="lbs-checkbox" disabled> 未完了
</li>
<li class="lbs-list-item">
  <input type="checkbox" class="lbs-checkbox" checked disabled> 完了
</li>
```

### テーブル

```html
<table class="lbs-table">
  <thead>
    <tr>
      <th style="text-align:left">名前</th>
      <th>年齢</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <td style="text-align:left">Alice</td>
      <td rowspan="2">30</td>   <!-- \--- 垂直結合 -->
    </tr>
    <tr>
      <td colspan="2">結合セル</td>   <!-- \| 水平結合 -->
    </tr>
  </tbody>
</table>
```

サイレントテーブル（レイアウトグリッド、`~ |` プレフィックス）:

```html
<table class="lbs-table lbs-table-silent">…</table>
```

### 折りたたみブロック（`:::details`）

```html
<details class="lbs-details">
  <summary class="lbs-summary">クリックで展開</summary>
  <!-- ネストしたブロック要素 -->
</details>
```

### ヘッダー／フッター（`:::header` / `:::footer`）

```html
<header class="lbs-header">…</header>
<footer class="lbs-footer">…</footer>
```

---

## インライン要素

| Markdown | HTML 出力 |
| :------- | :-------- |
| `**太字**` | `<span class="lbs-strong">太字</span>` |
| `*斜体*` | `<span class="lbs-emphasis">斜体</span>` |
| `~~打ち消し~~` | `<span class="lbs-strikethrough">打ち消し</span>` |
| `` `コード` `` | `<code class="lbs-code-span">コード</code>` |
| `[テキスト](url)` | `<a href="url">テキスト</a>` |
| `![alt](url =200x100)` | `<img src="url" alt="alt" width="200" height="100" class="lbs-image">` |
| `[^id]` | `<sup class="lbs-footnote-ref"><a href="#lbs-fn-id">[1]</a></sup>` |

---

## 脚注

```html
<section class="lbs-footnotes">
  <ol>
    <li id="lbs-fn-id" class="lbs-footnote-item">[1] 脚注テキスト</li>
  </ol>
</section>
```

---

## CSS 作成のヒント

### 最小限のスタイルシート

```css
/* 見出し */
.lbs-heading-1 { font-size: 2rem; font-weight: 700; margin: 1.5rem 0 0.5rem; }
.lbs-heading-2 { font-size: 1.5rem; font-weight: 700; margin: 1.5rem 0 0.5rem; }
.lbs-heading-3 { font-size: 1.25rem; font-weight: 600; margin: 1.25rem 0 0.5rem; }
.lbs-paragraph { margin: 0.75rem 0; line-height: 1.7; }

/* コード */
.lbs-code-span  { font-family: monospace; background: #f3f4f6; padding: 0.1em 0.4em; border-radius: 3px; }
.lbs-code-block { border: 1px solid #e5e7eb; border-radius: 6px; overflow: hidden; margin: 1em 0; }
.lbs-code-block pre  { margin: 0; padding: 1em; overflow-x: auto; }
.lbs-code-block code { font-family: monospace; font-size: 0.875em; }

/* テーブル */
.lbs-table { border-collapse: collapse; width: 100%; }
.lbs-table th, .lbs-table td { border: 1px solid #e5e7eb; padding: 0.5em 0.75em; }

/* サイレントテーブル（段組レイアウト） */
.lbs-table-silent { table-layout: fixed; width: 100%; }
.lbs-table-silent thead { display: none; }
.lbs-table-silent th,
.lbs-table-silent td { border: none; vertical-align: top; padding: 0.5rem 1rem 0.5rem 0; }

/* 折りたたみ */
.lbs-summary { cursor: pointer; font-weight: 600; }
```

### ダークモード

```css
@media (prefers-color-scheme: dark) {
  .lbs-code-span  { background: #1e1e1e; color: #d4d4d4; }
  .lbs-code-block { border-color: #333; }
  .lbs-code-block pre { background: #1e1e1e; color: #d4d4d4; }
  .lbs-table th, .lbs-table td { border-color: #333; }
  .lbs-blockquote { border-left-color: #555; color: #aaa; }
}
```

### AI に CSS を書いてもらう場合のプロンプト例

> lobster.js という Markdown レンダラーを使っています。`lbs-*` クラス名が付与された HTML が出力されます。
> 見出しは `<p class="lbs-heading-N">`、段落は `<p class="lbs-paragraph">`、
> コードブロックは `<div class="lbs-code-block"><pre><code class="language-*">` という構造です。
> 段組レイアウトは `<table class="lbs-table lbs-table-silent">` を使います。
> [デザインの要件をここに書く] という CSS を書いてください。
> HTML 出力の完全なリファレンス: https://github.com/Hacknock/lobsterjs/blob/main/markdowns/styling-ja.md
