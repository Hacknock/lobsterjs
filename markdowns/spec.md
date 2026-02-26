# lobster.js Specification

> See also: [spec-ja.md](./spec-ja.md) (Japanese)

## Overview

lobster.js parses an extended Markdown dialect and renders it as structured HTML.
It provides **document structure only** — visual presentation is delegated to CSS via predictable `lbs-*` class names.

### Core principles

- Parsing is **left-to-right, first-match** within each line.
- Trailing spaces on every line are trimmed before parsing.
- HTML tags in Markdown source are treated as **plain text** (escaped).
- When the same definition appears multiple times, the **last one wins** (except where noted).

---

## Evaluation order

The parser processes elements in the following priority:

```
Header > Footer >>> Details =>
  Blockquote => List > Heading > Horizontal Rule > Code Block > Silent Table > Table >
    Image > Inline Footnote > Footnote Ref > Warp Ref > Inline Link > Link >
      Code Span > Strong > Emphasis > Strikethrough
```

Block-level elements (`:::header`, `:::footer`, `:::warp`) are extracted from the document in a first pass before the body is parsed.

---

## Block Elements

### Headings

```
# H1
## H2
### H3
#### H4
##### H5
###### H6
```

- `#` count determines level (1–6). A minimum of one space between `#` and text is required.
- Trailing `#` characters preceded by a space are ignored: `# Title ##` → H1 "Title".
- Text on the same line (including other Markdown) forms the heading content.

**Anchor ID (optional):**

Append `{#id}` at the end of a heading line to set an explicit `id` attribute:

```
## My Section {#my-section}
```

- The `{#id}` suffix is stripped from the visible text and emitted as an HTML `id`.
- Useful for deep-linking and in-page navigation (`href="#my-section"`).

**HTML output:**

```html
<h1 class="lbs-heading-1">…</h1>
<!-- through -->
<h6 class="lbs-heading-6">…</h6>

<!-- with anchor id -->
<h2 class="lbs-heading-2" id="my-section">My Section</h2>
```

---

### Paragraph

One or more blank lines separate paragraphs.

**HTML output:**

```html
<p class="lbs-paragraph">…</p>
```

---

### Line Breaks

A newline within a paragraph produces a `<br>`. The final newline of a paragraph is **not** converted.

> Note: trailing two-space line endings are **not** treated specially; a bare newline is enough.

---

### Horizontal Rule

Three or more `-` or `*` characters on a line, with optional spaces between them:

```
---
- - -
***
* * *
```

Mixed characters (`--**`) are not recognized.

**HTML output:**

```html
<hr class="lbs-hr">
```

---

### Code Block

Fenced with `` ``` `` or `~~~` (at least 3 characters). Opening fence may include a language identifier and an optional filename:

````
```js:filename.js
console.log("Hello");
```
````

- Language: any word characters after the fence marker.
- Filename: follows `:` after the language; may contain any character except `` ` `` and `:`.
- Language may be omitted while filename is still specified: ` ````:filename `.
- Content is treated as plain text (no Markdown parsing).

**HTML output:**

```html
<div class="lbs-code-block">
  <div class="lbs-code-filename">filename.js</div>  <!-- omitted if no filename -->
  <pre data-language="js" data-filename="filename.js"><code>…</code></pre>
</div>
```

---

### Blockquote

Lines starting with `>`. Consecutive `>` lines (or continuation lines) without a blank line form one blockquote block. Nesting is achieved by stacking `>`:

```
> Outer
> > Inner
```

All standard Markdown is valid inside blockquotes.

**HTML output:**

```html
<blockquote class="lbs-blockquote">…</blockquote>
```

---

### Lists

At least one space must separate the marker from the item text.

#### Bullet List

Markers: `-`, `*`, `+`

```
- Item
- Item
  - Nested item
```

Items with more indentation than the parent become sub-items. The nesting depth is tracked per list node.

**HTML output:**

```html
<ul class="lbs-ul lbs-ul-depth-0">
  <li class="lbs-list-item">…</li>
</ul>
```

#### Ordered List

Marker: `N.` where N is any integer.

```
1. First
2. Second
   1. Nested
```

`N\.` (backslash-escaped dot) is treated as plain text, not a list marker. The `start` attribute reflects the first item's number.

**HTML output:**

```html
<ol class="lbs-ol lbs-ol-depth-0" start="1">
  <li class="lbs-list-item">…</li>
</ol>
```

#### Checklist

Applies to both bullet and ordered lists:

```
- [ ] Unchecked
- [x] Checked
- [X] Also checked
```

**HTML output:**

```html
<li class="lbs-list-item">
  <input type="checkbox" class="lbs-checkbox" disabled> …
  <!-- "checked" attribute added for [x]/[X] -->
</li>
```

---

### Table

A table requires at minimum a header row and an alignment row.
Leading and trailing `|` are optional.

```
| Name  | Age |
| ----- | --- |
| Alice | 30  |
```

#### Alignment

| Cell syntax | Meaning |
| :---------- | :------ |
| `---`       | Default (inherits CSS `text-align`) |
| `:---`      | Left |
| `:---:`     | Center |
| `---:`      | Right |

Spaces are allowed before/after cell content and alignment markers. No spaces within `---` or `:` sequences.

#### Cell Merge (Lobster extension)

**Horizontal merge** — escape `|` inside a cell with `\|`; the cell merges with the adjacent one:

```
| A | B \|   |
```

**Vertical merge** — use `\---` (one or more dashes) in a cell to merge upward:

```
| A | B |
| \--- | C |
```

#### Missing cells

If a row has fewer cells than the header, the missing cells are left empty.

**HTML output:**

```html
<table class="lbs-table">
  <thead><tr><th>…</th></tr></thead>
  <tbody><tr><td>…</td></tr></tbody>
</table>
```

Alignment is applied as inline `style="text-align:…"` on each cell.

---

## Inline Elements

Inline elements are parsed left-to-right within block content.

### Code Span

`` `code` ``

Use N backticks to include N−1 backticks inside: ` `` `code` `` ` → `` `code` ``

When the opening delimiter is two or more backticks, one leading and one trailing space (if both present) are stripped from the content.

**HTML output:** `<code class="lbs-code-span">…</code>`

---

### Emphasis (Italic)

`*text*` or `_text_`

- Opening and closing delimiter must be the same character.
- Cannot span newlines.
- `**text*` → literal `*` + emphasis `*text*`.

**HTML output:** `<span class="lbs-emphasis">…</span>`

---

### Strong (Bold)

`**text**` or `__text__`

- Opening and closing delimiter must be the same character.
- Cannot span newlines.
- `***text***` → literal `*` + strong `**text**` + literal `*`.

**HTML output:** `<span class="lbs-strong">…</span>`

---

### Strikethrough

`~~text~~`

- `~~~text~~~` — only the innermost `~~` pair is recognized.
- Cannot span newlines.

**HTML output:** `<span class="lbs-strikethrough">…</span>`

---

### Inline Link

`[text](url "title")`

- No space allowed between `]` and `(`.
- Title is optional; it may be wrapped in `"…"`, `'…'`, or `(…)`.
- `url` and `text` may be empty.

**HTML output:** `<a href="url" title="title">…</a>`

---

### Reference Link

```
[text][id]         ← reference
[id]: url "title"  ← definition (anywhere in document)
```

- `[text][]` — implicit shortcut: the text itself is the id.
- `[text]` — if the text matches a definition id, also resolves.
- id lookup is case-insensitive.
- Definition `title` may use `"…"`, `'…'`, or `(…)`.
- Multiple `[text][id]` references may share one definition (N:1).
- Definition lines are **not** rendered as content.

**HTML output:** `<a href="url" title="title">…</a>`

---

### Image

`![alt](url "title" =WxH)`

- Follows the same rules as inline links.
- `!` and `[` must be adjacent (no space).
- Size is optional: `=800x600`, `=800x` (width only), `=x600` (height only).

**HTML output:**

```html
<img src="url" alt="alt" title="title" width="800" height="600" class="lbs-image">
```

---

### Footnote Reference

```
[^id]              ← reference (inline)
[^id]: text        ← definition (anywhere in document)
```

- No spaces inside `[^id]` or `[^id]:`.
- Multiple references to the same footnote are numbered `[1]`, `[1:1]`, `[1:2]`, …
- Definition lines are **not** rendered as content.
- Definitions are rendered as a footnote section at the bottom of the document.

**HTML output (reference):**

```html
<sup class="lbs-footnote-ref"><a href="#lbs-fn-id">[1]</a></sup>
```

**HTML output (footnote section):**

```html
<section class="lbs-footnotes">
  <ol>
    <li id="lbs-fn-id" class="lbs-footnote-item">[1] …</li>
  </ol>
</section>
```

---

### Inline Footnote

`^[text]`

- No space between `^` and `[`.
- Behaves identically to a named footnote reference but the definition is written inline.
- Takes priority over named footnote references (left-to-right).

**HTML output:** same as footnote reference.

---

## Lobster Extensions

All custom blocks (`:::header`, `:::footer`, `:::details`, `:::warp`) are closed by a `:::` line. Leading whitespace before `:::` is ignored, so formatter-indented closing markers work correctly.

> **Recommended style:** Place a blank line before the closing `:::`. This prevents Markdown formatters (e.g. Prettier) from treating `:::` as a continuation of the preceding block (such as a list item) and indenting it unexpectedly.

### Header (`:::header`)

```
:::header
content
:::
```

- Only one header per document; subsequent ones overwrite the previous.
- May contain any Markdown except another `:::header` or `:::footer`.
- Rendered before the document body.

**HTML output:**

```html
<header class="lbs-header">…</header>
```

---

### Footer (`:::footer`)

```
:::footer
content
:::
```

Same rules as header. Rendered after the footnote section (if any), at the very end.

**HTML output:**

```html
<footer class="lbs-footer">…</footer>
```

---

### Details (`:::details`)

```
:::details Summary title
content
:::
```

- The title follows `:::details` on the same line.
- May contain any Markdown except `:::header` / `:::footer`.

**HTML output:**

```html
<details class="lbs-details">
  <summary class="lbs-summary">Summary title</summary>
  …
</details>
```

---

### Warp (`:::warp`)

```
:::warp my-id
content
:::
```

- Defines a named content block that can be placed elsewhere with `[~my-id]`.
- `id` must be unique within the document; duplicate ids cause all content to be rendered as plain text.
- Valid id characters: alphanumeric, `-`, `_`.
- Warp definitions are **not** rendered at their definition site; only at reference sites.

**Warp reference:**

`[~my-id]`

- Typically used inside silent table cells to create multi-column layouts.

**Example:**

```
~ |     left     |     right    |
~ | [~col-left]  | [~col-right] |

:::warp col-left
Left column content
:::

:::warp col-right
Right column content
:::
```

---

### Silent Table

Prefix every row of a table with `~ ` to suppress borders:

```
~ | Col1 | Col2 |
~ | ---- | ---- |
~ | A    | B    |
```

**HTML output:**

```html
<table class="lbs-table lbs-table-silent">…</table>
```

---

## CSS Class Reference

| Class | Element |
| :---- | :------ |
| `lbs-heading-1` … `lbs-heading-6` | Headings (`<h1>`…`<h6>`) |
| `lbs-paragraph` | Body paragraph |
| `lbs-emphasis` | Italic span |
| `lbs-strong` | Bold span |
| `lbs-strikethrough` | Strikethrough span |
| `lbs-code-span` | Inline code |
| `lbs-hr` | Horizontal rule |
| `lbs-code-block` | Code block wrapper `<div>` |
| `lbs-code-filename` | Filename label inside code block |
| `lbs-blockquote` | Blockquote |
| `lbs-ul` | Unordered list |
| `lbs-ul-depth-N` | Depth indicator (0 = top level) |
| `lbs-ol` | Ordered list |
| `lbs-ol-depth-N` | Depth indicator |
| `lbs-list-item` | List item |
| `lbs-checkbox` | Checklist checkbox |
| `lbs-table` | Table |
| `lbs-table-silent` | Silent (borderless) table |
| `lbs-image` | Image |
| `lbs-header` | Page header |
| `lbs-footer` | Page footer |
| `lbs-details` | Details/summary block |
| `lbs-summary` | Summary element inside details |
| `lbs-footnote-ref` | Footnote superscript |
| `lbs-footnotes` | Footnote section |
| `lbs-footnote-item` | Individual footnote entry |

---

## API

```typescript
import { toHTML, parseDocument, renderDocument } from 'lobsterjs';

// Convenience: Markdown → HTML string
const html = toHTML(markdownString);

// Step-by-step (useful for tooling or custom renderers)
const doc = parseDocument(markdownString);  // → Document AST
const html = renderDocument(doc);           // → HTML string

// Browser: fetch and render a Markdown file into a DOM element
import { loadMarkdown } from 'lobsterjs';
await loadMarkdown('./content.md', document.getElementById('content'));
```

### Document AST

`parseDocument` returns a `Document` object:

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

The full type definitions are in [`src/core/types.ts`](../src/core/types.ts).

---

## References

- [Original Markdown Syntax](https://daringfireball.net/projects/markdown/syntax)
- [CommonMark Spec](https://spec.commonmark.org/)
