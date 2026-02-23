# lobster.js

> Extended Markdown parser that renders rich, structured web pages directly in the browser.

**[Demo & Docs →](https://Hacknock.github.io/lobsterjs/)**

lobster.js takes a Markdown file with its own extended syntax and turns a near-empty HTML page into a fully structured document — no build step, no framework.
It provides **document structure only**; appearance is entirely up to CSS via predictable `lbs-*` class names.

```html
<!DOCTYPE html>
<html>
  <head>
    <link rel="stylesheet" href="lobster-default.css" />
  </head>
  <body>
    <div id="app"></div>
    <script type="module">
      import { loadMarkdown } from "./lobster.js";
      loadMarkdown("./content.md", document.getElementById("app"));
    </script>
  </body>
</html>
```

---

## Features

- **All standard Markdown** — headings, paragraphs, bold, italic, strikethrough, code, blockquotes, lists, tables, links, images
- **Extended syntax** unique to lobster.js:
  - `:::header` / `:::footer` — semantic page header and footer regions
  - `:::details` — native collapsible `<details>` / `<summary>` blocks
  - `:::warp` + `[~id]` — define content once, place it anywhere (great for multi-column layouts)
  - Silent tables (`~ | … |`) — borderless layout grids
  - Table cell merging — horizontal (`\|`) and vertical (`\---`) colspan/rowspan
  - Image sizing — `![alt](url =800x600)`
  - Footnotes — reference (`[^id]`) and inline (`^[text]`)
- **CSS-first styling** — all elements get `lbs-*` class names; bring your own stylesheet
- **Platform-agnostic core** — `src/core/` has zero DOM/browser dependencies; portable to Node.js, Deno, and potentially native mobile
- **TypeScript** — full type definitions included

---

## Installation

### CDN / local file

Download `lobster.js` from the [releases page](https://github.com/Hacknock/lobsterjs/releases) and reference it directly:

```html
<script type="module">
  import { loadMarkdown } from "./lobster.js";
  loadMarkdown("./content.md", document.getElementById("app"));
</script>
```

### npm / pnpm

```sh
pnpm add lobsterjs
```

```ts
import { toHTML } from "lobsterjs";
const html = toHTML("# Hello **world**");
```

---

## API

### `toHTML(markdown: string): string`

Convenience one-liner. Parses and renders Markdown to an HTML string.

```ts
import { toHTML } from "lobsterjs";
const html = toHTML("# Hello");
```

### `parseDocument(markdown: string): Document`

Parses Markdown into an AST. Useful for inspecting or transforming the document tree before rendering.

```ts
import { parseDocument } from "lobsterjs";
const doc = parseDocument(markdown);
console.log(doc.body); // BlockNode[]
```

### `renderDocument(doc: Document): string`

Converts a `Document` AST into an HTML string.

```ts
import { parseDocument, renderDocument } from "lobsterjs";
const html = renderDocument(parseDocument(markdown));
```

### `loadMarkdown(src: string, container?: HTMLElement): Promise<void>`

Fetches a Markdown file and renders it into the given DOM element (defaults to `document.body`). Browser only.

```ts
import { loadMarkdown } from "lobsterjs";
await loadMarkdown("./content.md", document.getElementById("app"));
```

---

## Syntax overview

Standard Markdown works as you would expect. The sections below highlight lobster.js-specific extensions.

### Page layout blocks

```
:::header
# My Site
:::

:::footer
© 2025 My Site
:::
```

### Collapsible sections

```
:::details Click to expand
Hidden content goes here.
:::
```

### Multi-column layout with Warp

```
~ |      left      |      right      |
~ | [~col-left]    | [~col-right]    |

:::warp col-left
Left column content
:::

:::warp col-right
Right column content
:::
```

### Image sizing

```
![Logo](logo.png =200x)
![Banner](banner.jpg =1200x400)
```

### Footnotes

```
Lobster[^1] is great. So is inline^[No definition needed] footnotes.

[^1]: A crustacean — or a Markdown parser.
```

### Table cell merging

```
| A | B \|   |     ← B and the next cell merge horizontally
| \--- | C |       ← first cell merges with the one above
```

For the full syntax reference see [markdowns/spec.md](./markdowns/spec.md) (English) or [markdowns/spec-ja.md](./markdowns/spec-ja.md) (日本語).

---

## CSS classes

Every rendered element carries a `lbs-*` class name so any stylesheet can target it:

| Class                                               | Element            |
| :-------------------------------------------------- | :----------------- |
| `lbs-heading-1` … `lbs-heading-6`                   | Headings           |
| `lbs-paragraph`                                     | Paragraph          |
| `lbs-emphasis` / `lbs-strong` / `lbs-strikethrough` | Inline decorations |
| `lbs-code-span` / `lbs-code-block`                  | Code               |
| `lbs-blockquote`                                    | Blockquote         |
| `lbs-ul` / `lbs-ol` / `lbs-list-item`               | Lists              |
| `lbs-table` / `lbs-table-silent`                    | Tables             |
| `lbs-header` / `lbs-footer`                         | Page regions       |
| `lbs-details` / `lbs-summary`                       | Collapsible        |
| `lbs-footnote-ref` / `lbs-footnotes`                | Footnotes          |

---

## Development

### Requirements

| Tool                          | Version    |
| :---------------------------- | :--------- |
| [mise](https://mise.jdx.dev/) | 2026.2.19+ |
| pnpm                          | 10.30.1    |
| Node.js                       | 24.13.1    |

### Setup

```sh
# Install mise
brew install mise
echo 'eval "$(mise activate zsh)"' >> ~/.zshrc

# Install pnpm and Node.js (versions defined in mise.toml)
mise install

# Install dependencies
pnpm install
```

### Commands

```sh
pnpm test          # Run tests (Vitest)
pnpm test:watch    # Watch mode
pnpm build         # Bundle to dist/
pnpm build:docs    # Copy bundle to docs/ for GitHub Pages
```

### Project structure

```
src/
├── core/                # Platform-agnostic parser (no DOM dependency)
│   ├── types.ts         # All AST type definitions
│   ├── block-parser.ts  # Block-level parser
│   ├── inline-parser.ts # Inline-level parser
│   └── index.ts
├── renderer/html/
│   ├── renderer.ts      # AST → HTML string
│   └── dom.ts           # DOM helpers (browser only)
└── index.ts             # Public API entry point

tests/                   # Vitest test suites
markdowns/               # Specification documents
docs/                    # GitHub Pages demo site
```

---

## Contributing

Issues and pull requests are welcome.

1. Fork the repository
2. Create a feature branch: `git checkout -b feat/my-feature`
3. Add tests for any new behaviour
4. Run `pnpm test` and make sure all tests pass
5. Open a pull request

---

## License

[MIT](./LICENSE) © 2022 Hacknock
