# lobster.js Specification

> See also: [spec-ja.md](./spec-ja.md) (Japanese)

## Overview

lobster.js parses an extended Markdown dialect and renders it as structured HTML.
It provides **document structure only** — visual presentation is delegated to CSS via predictable `lbs-*` class names.

### Core principles

- Parsing is **left-to-right, first-match** within each line.
- Trailing spaces on every line are trimmed before parsing.
- HTML tags in Markdown source are treated as **plain text** (escaped).
- When the same definition appears multiple times, the **last one wins**.

---

## Evaluation order

Link definitions and footnote definitions are collected from the whole document first.
Then blocks are parsed line by line from the top; the first block that starts at the current line wins, in this order:

```
::: blocks (Header, Footer, Details, Warp) > Heading > Horizontal Rule > Code Block > Blockquote > List > Table / Silent Table > Paragraph
```

Inline elements are scanned left to right; the first element that starts at the current position wins, in this order:

```
Backslash Escape > Code Span > Image > Inline Footnote > Footnote Ref > Warp Ref > Inline Link > Reference Link > Strong > Emphasis > Strikethrough
```

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

- Language: letters, digits, `_`, `+`, and `-` after the fence marker.
- Filename: follows `:` after the language; the rest of the line is the filename.
- Language may be omitted while filename is still specified: ` ````:filename `.
- Content is treated as plain text (no Markdown parsing).

**HTML output:**

```html
<div class="lbs-code-block">
  <div class="lbs-code-filename">filename.js</div>  <!-- omitted if no filename -->
  <pre data-language="js" data-filename="filename.js"><code class="language-js">…</code></pre>
</div>
```

---

### Blockquote

Lines starting with `>`. Consecutive `>` lines form one blockquote block. A following line without `>` continues the quote when it continues a quoted paragraph (not a quoted code block) and does not start another block. Nesting is achieved by stacking `>`:

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

Items with more indentation than the parent become sub-items. `lbs-ul-depth-N` / `lbs-ol-depth-N` give the nesting level: 0 at the top, 1 for a sub-list, and so on.

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

`N\.` (backslash-escaped dot) is treated as plain text, not a list marker. The `start` attribute reflects the first item's number and is omitted when it is 1.

**HTML output:**

```html
<ol class="lbs-ol lbs-ol-depth-0" start="3">
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

A cell whose entire content is a merge marker joins a neighboring cell.

| Marker | Meaning |
| :----- | :------ |
| `<<`   | Merge with the cell on the left (colspan) |
| `^^`   | Merge with the cell above (rowspan) |

```
| Time | Mon  | Tue      | Wed     |
| :--- | :--- | :---     | :---    |
| 1st  | Math | English  | <<      |
| 2nd  | ^^   | Japanese | Science |
| 3rd  | Assembly | <<   | <<      |
```

- Repeating a marker extends the merge (`| Assembly | << | << |` spans three columns).
- A marker merges into the cell that holds the content. If its neighbor is itself merged, the marker follows it, so `<<` and `^^` can form a rectangular block:

  ```
  | Block | << |
  | ^^    | ^^ |
  ```

- A marker is recognized only when it is the entire cell content. `a << b` is plain text.
- `<<` in the first column and `^^` in the first body row have nothing to merge with and are plain text.
- `<<` works in the header row. `^^` works in body rows only; in the header row it is plain text. Merges never cross the header/body boundary.
- If `^^` covers every column of a row, that row has no cells of its own and is rendered as an empty `<tr></tr>`.
- If a merge would not form a rectangle, the last marker of that region in reading order is treated as plain text, repeated until every merged region is a rectangle.
- Write `\<<` or `\^^` to show the marker characters as text.

#### Literal pipes

`\|` inside a cell is a literal `|`, not a column separator. A `|` inside a code span is also kept in the cell, so write `` `a|b` `` rather than `` `a\|b` ``. Unlike GFM, `\|` inside a code span is shown as-is.

#### Missing cells

If a row has fewer cells than the header, the missing cells are left empty. Cells beyond the header width are dropped.

**HTML output:**

```html
<table class="lbs-table">
  <thead><tr><th>…</th></tr></thead>
  <tbody><tr><td>…</td></tr></tbody>
</table>
```

Alignment is applied as inline `style="text-align:…"` on each cell. A merged cell uses the alignment of the column it starts in.

---

## Inline Elements

Inline elements are parsed left-to-right within block content.

### Backslash Escapes

A backslash before an ASCII punctuation character makes that character literal, so it is not interpreted as Markdown syntax.

```
\*not emphasis\*
\# not a heading
1\. not a list
```

- Only ASCII punctuation (``!"#$%&'()*+,-./:;<=>?@[\]^_`{|}~``) can be escaped. A backslash before any other character is emitted as-is (e.g. `C:\path`).
- `\\` produces a single literal `\`.
- Escapes are not interpreted inside code spans or code blocks.
- Escapes are interpreted in link destinations, link titles, image alt text, image titles, and the destinations and titles of reference link definitions, and the backslash is removed.
- Escapes are not interpreted in footnote IDs, warp IDs, or reference link IDs.
- In table cells, `\|` is a literal `|` and does not split the row.

---

### Delimiter Rules for Emphasis, Strong, and Strikethrough

To avoid unintended formatting, the delimiters `*`, `_`, and `~~` follow these rules.

- An opening delimiter followed by whitespace is not an opener (`2 * 3 * 4` stays as-is).
- A closing delimiter preceded by whitespace is not a closer.
- `_` and `__` are not delimiters inside a word: an opener preceded by a letter or digit, or a closer followed by one, is ignored (`snake_case_name` stays as-is).
- `*` and `**` work inside words (`foo*bar*baz` → `foo` + emphasis `bar` + `baz`).
- The punctuation conditions of CommonMark's flanking rules are not applied, so strong text wrapping brackets such as `**「強調」**です` is still recognized.

---

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
- Footnotes are numbered in the order their first reference appears on the page: the header, the body (a warp counts where it is referenced), then the footer. References inside footnote definitions are numbered after those.
- Multiple references to the same footnote are numbered `[1]`, `[1:1]`, `[1:2]`, …
- A reference without a matching definition is plain text.
- Definition lines are **not** rendered as content.
- Only referenced footnotes are rendered, as a footnote section after the body and before the footer.

**HTML output (reference):**

```html
<sup class="lbs-footnote-ref"><a href="#lbs-fn-id" id="lbs-fnref-id-0">[1]</a></sup>
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

A `:::` line that does not open or close one of these blocks (for example, an unknown name such as `:::note`, a `:::warp` without an id, or a `:::` with no matching opener) is treated as plain text.

- A fenced code block inside a `:::` block is skipped when looking for the closing `:::`. If the fence is never closed, the code block ends where the `:::` block ends.
- The opening line of a `:::` block ends the paragraph, list, or table right before it, even without a blank line.
- `:::` blocks are not recognized inside blockquotes; there the lines are plain text.
- A `:::header` or `:::footer` nested inside another `:::` block is ignored, together with its content.

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
- When the same `id` is defined more than once, the last definition wins.
- An `id` is any run of characters other than spaces and `]`.
- Warp definitions are **not** rendered at their definition site; only at reference sites.

**Warp reference:**

`[~my-id]`

- Typically used inside silent table cells to create multi-column layouts.
- A reference to a warp that is already being expanded (for example, a warp that references itself) renders nothing.

**Example:**

A silent table requires at least a header row and an alignment row. Warp references can appear in either the header row (Pattern A) or a data row (Pattern B).

**Pattern A — warp refs in header row** (content rendered in `<th>`):

```
~ | [~col-left]  | [~col-right] |
~ | :---         | :---         |

:::warp col-left
Left column content
:::

:::warp col-right
Right column content
:::
```

**Pattern B — warp refs in data row** (content rendered in `<td>`, recommended for layouts):

```
~ |     left     |     right    |
~ | :---         | :---         |
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
// Browser: fetch one or more Markdown files and render them into a DOM element
import { loadMarkdown } from '@hacknock/lobster';
await loadMarkdown('./content.md', document.getElementById('content'));

// Browser or Node: Markdown → HTML string
import { toHTML } from '@hacknock/lobster';
const html = toHTML(markdownString);
```

The parsed AST is internal and not part of the API.

---

## References

- [Original Markdown Syntax](https://daringfireball.net/projects/markdown/syntax)
- [CommonMark Spec](https://spec.commonmark.org/)
