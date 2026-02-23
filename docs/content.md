:::header
# lobster.js
:::

# What is lobster.js?

**lobster.js** is an extended Markdown parser that renders rich HTML web pages directly in the browser.

Drop a single `<script>` tag into a minimal HTML file, point it at a Markdown document, and you get a fully structured web page — no build step required for the reader.

~~~html
<!DOCTYPE html>
<html>
  <head>
    <link rel="stylesheet" href="lobster-default.css">
  </head>
  <body>
    <div id="app"></div>
    <script type="module">
      import { loadMarkdown } from './lobster.js';
      loadMarkdown('./content.md', document.getElementById('app'));
    </script>
  </body>
</html>
~~~

## Features

- [x] All standard Markdown syntax
- [x] Extended Lobster syntax (`:::header`, `:::footer`, `:::details`, `:::warp`)
- [x] Tables with alignment and cell merging
- [x] Silent tables (borderless layout grids)
- [x] Footnotes and inline footnotes
- [x] Image sizing (`=WxH`)
- [ ] Syntax highlighting (Prism.js integration — coming soon)
- [ ] Dark mode CSS theme

## Inline Syntax

| Syntax | Result |
| :--- | :--- |
| `**bold**` | **bold** |
| `*italic*` | *italic* |
| `~~strike~~` | ~~strike~~ |
| `` `code` `` | `code` |
| `[text](url)` | link |
| `![alt](url)` | image |

## Custom Blocks

### :::details

:::details Click to see example
This content is hidden until the user clicks the summary.

You can put any Markdown inside a `:::details` block.
:::

### :::warp

The `:::warp` block lets you define content once and place it anywhere using `[~id]`:

~~~
~ |     left     |     right    |
~ | [~col-left]  | [~col-right] |

:::warp col-left
Left column content
:::

:::warp col-right
Right column content
:::
~~~

## API

```typescript
import { toHTML, parseDocument, renderDocument } from 'lobsterjs';

// One-liner
const html = toHTML('# Hello **world**');

// Step by step (useful for tooling)
const doc = parseDocument(markdownString);
const html = renderDocument(doc);
```

## Design Philosophy

lobster.js provides **document structure only** — styling is entirely up to CSS. The rendered HTML uses predictable `lbs-*` class names so any stylesheet can target them.

The core parser (`src/core/`) contains no DOM or browser dependencies, making it portable to Node.js, Deno, and potentially iOS/Android in the future.

---

:::footer
lobster.js — MIT License
:::
