/**
 * lobster.js — Extended Markdown parser for rich web pages.
 *
 * Core API (platform-agnostic):
 *   parseDocument(markdown)  → Document AST
 *   renderDocument(doc)      → HTML string
 *   toHTML(markdown)         → HTML string (convenience)
 *
 * Browser API:
 *   renderToDOM(doc, element)  → void
 *   loadMarkdown(src, element) → Promise<void>  (src: string | string[])
 *   autoInit()                 → void (auto-loads from data-src attribute)
 */

export { parseDocument, parseBlocks } from "./core/block-parser.js";
export { parseInline } from "./core/inline-parser.js";
export { renderDocument } from "./renderer/html/renderer.js";
export { renderToDOM, loadMarkdown, autoInit } from "./renderer/html/dom.js";
export type * from "./core/types.js";

import { parseDocument } from "./core/block-parser.js";
import { renderDocument } from "./renderer/html/renderer.js";

/**
 * Convenience function: Markdown string → HTML string.
 */
export function toHTML(markdown: string): string {
  return renderDocument(parseDocument(markdown));
}
