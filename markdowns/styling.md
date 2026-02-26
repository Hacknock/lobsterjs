# lobster.js — CSS Authoring Guide

lobster.js generates semantic HTML with `lbs-*` class names on every element.
No default stylesheet is bundled — you own the visual layer entirely.

This guide documents the exact HTML output for each Markdown construct so you
(or your AI assistant) can write accurate CSS without guesswork.

---

## Page structure

A rendered document is emitted in this order:

```html
<header class="lbs-header">...</header>   <!-- :::header block, if present -->

<!-- body blocks -->

<section class="lbs-footnotes">...</section>  <!-- if footnotes exist -->

<footer class="lbs-footer">...</footer>   <!-- :::footer block, if present -->
```

---

## Block elements

### Heading

`# H1` through `###### H6` — rendered as semantic `<h1>`…`<h6>` elements with `lbs-heading-N` class names.

```html
<h1 class="lbs-heading-1">…</h1>
<h2 class="lbs-heading-2">…</h2>
<!-- … lbs-heading-3 through lbs-heading-6 -->
```

### Paragraph

```html
<p class="lbs-paragraph">…</p>
```

### Horizontal rule

```html
<hr class="lbs-hr">
```

### Blockquote

```html
<blockquote class="lbs-blockquote">
  <!-- nested block elements -->
</blockquote>
```

### Code block

````markdown
```js:script.js
const x = 1;
```
````

```html
<div class="lbs-code-block">
  <div class="lbs-code-filename">script.js</div>   <!-- only when filename given -->
  <pre data-language="js" data-filename="script.js">
    <code class="language-js">const x = 1;</code>
  </pre>
</div>
```

- `data-language` and `class="language-*"` on `<code>` enable Prism.js / highlight.js integration.
- The filename header `lbs-code-filename` is only emitted when a filename is specified (`` ```js:script.js ``).

### Lists

```html
<!-- Bullet list (depth = nesting level, starts at 0) -->
<ul class="lbs-ul lbs-ul-depth-0">
  <li class="lbs-list-item">…</li>
  <li class="lbs-list-item">
    <!-- nested sub-list -->
    <ul class="lbs-ul lbs-ul-depth-1">…</ul>
  </li>
</ul>

<!-- Ordered list -->
<ol class="lbs-ol lbs-ol-depth-0">
  <li class="lbs-list-item">…</li>
</ol>

<!-- Checklist item -->
<li class="lbs-list-item">
  <input type="checkbox" class="lbs-checkbox" disabled> item text
</li>
<li class="lbs-list-item">
  <input type="checkbox" class="lbs-checkbox" checked disabled> done
</li>
```

### Table

```html
<table class="lbs-table">
  <thead>
    <tr>
      <th style="text-align:left">Name</th>
      <th>Age</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <td style="text-align:left">Alice</td>
      <td rowspan="2">30</td>   <!-- \--- vertical merge -->
    </tr>
    <tr>
      <td colspan="2">merged</td>   <!-- \| horizontal merge -->
    </tr>
  </tbody>
</table>
```

Silent table (layout grid, `~ |` prefix):

```html
<table class="lbs-table lbs-table-silent">…</table>
```

### Collapsible block (`:::details`)

```html
<details class="lbs-details">
  <summary class="lbs-summary">Click to expand</summary>
  <!-- nested block elements -->
</details>
```

### Header / Footer (`:::header` / `:::footer`)

```html
<header class="lbs-header">…</header>
<footer class="lbs-footer">…</footer>
```

---

## Inline elements

| Markdown | HTML output |
| :------- | :---------- |
| `**bold**` | `<span class="lbs-strong">bold</span>` |
| `*italic*` | `<span class="lbs-emphasis">italic</span>` |
| `~~strike~~` | `<span class="lbs-strikethrough">strike</span>` |
| `` `code` `` | `<code class="lbs-code-span">code</code>` |
| `[text](url)` | `<a href="url">text</a>` |
| `![alt](url =200x100)` | `<img src="url" alt="alt" width="200" height="100" class="lbs-image">` |
| `[^id]` | `<sup class="lbs-footnote-ref"><a href="#lbs-fn-id">[1]</a></sup>` |

---

## Footnotes

```html
<section class="lbs-footnotes">
  <ol>
    <li id="lbs-fn-id" class="lbs-footnote-item">[1] footnote text</li>
  </ol>
</section>
```

---

## CSS authoring tips

### Minimum viable stylesheet

```css
/* Typography */
.lbs-heading-1 { font-size: 2rem; font-weight: 700; margin: 1.5rem 0 0.5rem; }
.lbs-heading-2 { font-size: 1.5rem; font-weight: 700; margin: 1.5rem 0 0.5rem; }
.lbs-heading-3 { font-size: 1.25rem; font-weight: 600; margin: 1.25rem 0 0.5rem; }
.lbs-paragraph { margin: 0.75rem 0; line-height: 1.7; }

/* Code */
.lbs-code-span  { font-family: monospace; background: #f3f4f6; padding: 0.1em 0.4em; border-radius: 3px; }
.lbs-code-block { border: 1px solid #e5e7eb; border-radius: 6px; overflow: hidden; margin: 1em 0; }
.lbs-code-block pre  { margin: 0; padding: 1em; overflow-x: auto; }
.lbs-code-block code { font-family: monospace; font-size: 0.875em; }

/* Table */
.lbs-table { border-collapse: collapse; width: 100%; }
.lbs-table th, .lbs-table td { border: 1px solid #e5e7eb; padding: 0.5em 0.75em; }

/* Silent table (layout grid) */
.lbs-table-silent { table-layout: fixed; width: 100%; }
.lbs-table-silent thead { display: none; }
.lbs-table-silent th,
.lbs-table-silent td { border: none; vertical-align: top; padding: 0.5rem 1rem 0.5rem 0; }

/* Details */
.lbs-summary { cursor: pointer; font-weight: 600; }
```

### Dark mode

Add a `[data-theme="dark"]` attribute or use `prefers-color-scheme`:

```css
@media (prefers-color-scheme: dark) {
  .lbs-code-span  { background: #1e1e1e; color: #d4d4d4; }
  .lbs-code-block { border-color: #333; }
  .lbs-code-block pre { background: #1e1e1e; color: #d4d4d4; }
  .lbs-table th, .lbs-table td { border-color: #333; }
  .lbs-blockquote { border-left-color: #555; color: #aaa; }
}
```

### Prompt template for AI

When asking an AI to write CSS for lobster.js, start with:

> I'm using lobster.js, a Markdown renderer. It emits `lbs-*` class names.
> Headings are `<h1 class="lbs-heading-1">`…`<h6 class="lbs-heading-6">`, paragraphs are `<p class="lbs-paragraph">`,
> code blocks are `<div class="lbs-code-block"><pre><code class="language-*">`.
> Multi-column layout uses `<table class="lbs-table lbs-table-silent">`.
> Please write CSS that [your design goal here].
> Full HTML reference: https://github.com/Hacknock/lobsterjs/blob/main/markdowns/styling.md
