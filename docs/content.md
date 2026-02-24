:::header

# ![lobster.js](./lobsterjs-light.png =48x48) lobster.js

**Design web pages using only Markdown.**

With lobster.js, you can easily create rich static websites using extended Markdown syntax.

:::

This page itself is rendered by lobster.js^[index.html is just 15 lines. Load lobster.js, point it at a Markdown file, and you're done.].

---

## What plain Markdown can't do

Tasks requiring embedded HTML in standard Markdown can be done with simple extended syntax in lobster.js.
Even the 2-column layout below is possible without any HTML.

~ | | |
~ | :--- | :--- |
~ | [~compare-no] | [~compare-yes] |

:::warp compare-no

### Standard Markdown

- Multi-column layout → **not possible**
- Table cell merging → **not possible**
- Collapsible blocks → needs `<details>` tag
- Page header / footer → needs HTML structure
- Footnotes → parser-dependent, often unsupported

:::

:::warp compare-yes

### lobster.js

- Multi-column → `:::warp` + silent table
- Cell merging → `\|` (horizontal) / `\---` (vertical)
- Collapsible → `:::details Title`
- Header / footer → `:::header` / `:::footer`
- Footnotes → `[^id]` or inline `^[text]`
  :::

---

## :::warp — multi-column layouts in Markdown

Define a named content block with `:::warp id`, then place it anywhere using `[~id]`.
Put warp references into a silent table (`~ |`) and you get a full column layout — no HTML, no CSS required.

~ | | | |
~ | :--- | :--- | :--- |
~ | [~card-light] | [~card-portable] | [~card-ast] |

:::warp card-light

### Lightweight

Zero dependencies. ESM bundle is **22 KB** (gzip: 6 KB).

One `<script type="module">` line and you're running.

:::

:::warp card-portable

### Portable

The core parser is pure functions with no DOM dependency. Works in Node.js and Deno, with iOS/Android portability in mind.

:::

:::warp card-ast

### AST-first

`parseDocument()` gives you the full intermediate AST. Build custom renderers or integrate with your own tooling.

:::

---

## :::details — collapsible blocks

Standard Markdown requires you to write raw `<details>` HTML. With lobster.js, just wrap it with `:::details` and `:::`.

:::details Inline syntax cheatsheet (click to expand)

~ | | |
~ | :--- | :--- |
~ | [~cheat-inline] | [~cheat-block] |

:::warp cheat-inline

**Inline syntax**

| Syntax        | Output                                                                |
| :------------ | :-------------------------------------------------------------------- |
| `**bold**`    | **bold**                                                              |
| `*italic*`    | _italic_                                                              |
| `~~strike~~`  | ~~strike~~                                                            |
| `` `code` ``  | `code`                                                                |
| `[text](url)` | [link](https://github.com/Hacknock/lobsterjs)                         |
| `^[note]`     | inline footnote^[Footnotes are collected at the end of the document.] |

:::

:::warp cheat-block

**Block syntax**

> Blockquote
>
> > Nested blockquote

Checklist:

- [x] Header / footer
- [x] Multi-column layout
- [x] Collapsible blocks
- [x] Cell-merging tables

:::

:::

---

## Table cell merging

Standard Markdown has no cell-merging spec. lobster.js supports `\---` (vertical span) and `\|` (horizontal span).

| Category | Feature               | Syntax                    |
| :------- | :-------------------- | :------------------------ |
| Layout   | Multi-column layout   | `:::warp` + silent table  |
| \---     | Collapsible block     | `:::details Title`        |
| \---     | Header / footer       | `:::header` / `:::footer` |
| Tables   | Horizontal cell merge | `` `\|` ``                |
| \---     | Vertical cell merge   | `` `\---` ``              |
| \---     | Silent table          | `` `~ \|` `` prefix       |

"Layout" and "Tables" in the left column each span three rows via vertical cell merging.

---

## Quick start

```html:index.html
<!DOCTYPE html>
<html>
  <head>
    <!-- starter CSS — swap for your own stylesheet -->
    <link rel="stylesheet" href="https://hacknock.github.io/lobsterjs/style.css">
  </head>
  <body>
    <div id="app"></div>
    <script type="module">
      import { loadMarkdown } from 'https://hacknock.github.io/lobsterjs/lobster.js';
      loadMarkdown('./content.md', document.getElementById('app'));
    </script>
  </body>
</html>
```

Works in Node.js / Deno too:

```typescript
import { toHTML, parseDocument } from "lobsterjs";

// One-liner
const html = toHTML("# Hello **lobster**");

// Via AST (for custom renderers / tooling)
const ast = parseDocument(markdownString);
```

---

:::footer
[lobster.js on GitHub](https://github.com/Hacknock/lobsterjs) — MIT License
:::
