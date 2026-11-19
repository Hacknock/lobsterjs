# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Overview

lobster.js is an extended Markdown parser library. It parses Markdown (including lobster-specific syntax) into an AST, then renders rich HTML. The design principle is that the library provides document structure only — visual styling is entirely left to CSS.

Spec: `markdowns/spec.md` (English), `markdowns/spec-ja.md` (Japanese)

## Commands

This project uses **npm** (declared via `devEngines`; requires npm `12.2.1` for the `min-release-age` setting in `.npmrc`).

```bash
npm test           # Run all tests once (Vitest)
npm run test:watch # Run tests in watch mode
npm run build      # Build ESM bundle + emit .d.ts declarations
npm run build:docs # Build and copy dist/lobster.js → docs/lobster.js
```

To run a single test file:
```bash
npx vitest run tests/block-parser.test.ts
```

## Architecture

**Pipeline:** `parseDocument(markdown)` → `Document` AST → `renderDocument(doc)` → HTML string

The package exports only `loadMarkdown` (browser) and `toHTML` (browser and Node). The AST and every other function are internal, so their shape can change freely.

### Source layout

```
src/
├── core/
│   ├── types.ts          # All AST node type definitions (union types)
│   ├── block-parser.ts   # Block-level parser (entry: parseDocument, parseBlocks)
│   └── inline-parser.ts  # Inline-level parser (entry: parseInline)
├── renderer/html/
│   ├── renderer.ts       # AST → HTML string (entry: renderDocument)
│   └── dom.ts            # Browser API: loadMarkdown
├── to-html.ts            # toHTML (parseDocument + renderDocument)
├── index.ts              # Browser entry: loadMarkdown, toHTML
└── index.node.ts         # Node entry: toHTML
tests/                    # Vitest tests (mirrors src/core/ and src/renderer/)
markdowns/                # Spec docs and test-case Markdown files
docs/                     # GitHub Pages demo site (lobster.js loads its own content)
```

### Parsing pipeline (block-parser.ts)

`parseDocument` runs in two passes:

1. **Pre-scan** (`collectDefinitions`): Extracts link definitions `[id]: url` and footnote definitions `[^id]: text` from all lines.
2. **Block parsing** (`parseBlocks`): Processes the remaining lines in order. `tryParseContainer` handles `:::header`, `:::footer`, `:::details Title`, and `:::warp id` first (it finds the matching `:::` with `findContainerEnd`, skipping fenced code and nested blocks). Header, footer, and warp definitions are recorded in `ParseContext`; details stay in place. Then the `tryParse*` functions run in priority order: heading → horizontal_rule → code_block → blockquote → list → table → paragraph (fallback). A `BlockScope` decides where `:::` blocks are recognized: the document, inside other `:::` blocks, but not inside blockquotes.

### Evaluation order (per spec)

```
blocks:  ::: blocks (header / footer / details / warp) → heading → horizontal_rule → code_block → blockquote → list → table / silent_table → paragraph
inlines: backslash_escape → code_span → image → inline_footnote → footnote_ref → warp_ref → inline link → reference link → strong → emphasis → strikethrough
```

### Key types (types.ts)

- `Document`: `{ header?, footer?, body, linkDefs, footnoteDefs, warpDefs }`
- `BlockNode`: union of the block node types that appear in `body`, discriminated by `type` field
- `InlineNode`: union of all inline node types, discriminated by `type` field
- `ParseContext`: shared mutable state during parsing (linkDefs, footnoteDefs, definedFootnoteIds, warpDefs, inlineFootnoteCount, header, footer)
- Footnote numbers are assigned in the renderer, in the order references are rendered (`RenderContext.footnoteOrder`).

### HTML output conventions

All rendered elements carry `lbs-*` CSS class names (e.g. `lbs-heading-1`, `lbs-paragraph`, `lbs-code-block`, `lbs-table`, `lbs-table-silent`). No inline styles except for table cell alignment (`style="text-align:..."`).

Headings are rendered as `<hN class="lbs-heading-N">` (e.g. `<h1 class="lbs-heading-1">`).

### Browser API (dom.ts)

- `loadMarkdown(src, element?)` — fetches one or more `.md` files, joins them, and renders them into the element

## Lobster-specific syntax

| Syntax | Description |
|--------|-------------|
| `:::header` ... `:::` | Page header region → `<header class="lbs-header">` |
| `:::footer` ... `:::` | Page footer region → `<footer class="lbs-footer">` |
| `:::details Title` ... `:::` | Collapsible block → `<details><summary>` |
| `:::warp id` ... `:::` | Named content block; referenced via `[~id]` |
| `~ \| ... \|` | Silent table (no border) → adds `lbs-table-silent` class |
| `<<` as a table cell | Merge with the cell on the left (colspan) |
| `^^` as a table body cell | Merge with the cell above (rowspan) |
| `![alt](url =WxH)` | Image with explicit width/height |

## Coding rules

- `src/core/` must be pure functions with no DOM/browser API dependencies.
- AST nodes use union types discriminated by `type` field.
- Comments should map implementation to the corresponding spec section.
- Each parser function should have corresponding Vitest tests.
