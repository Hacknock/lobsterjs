/**
 * lobster.js — Node.js entry point.
 *
 * Exports only platform-agnostic (pure) APIs.
 * Browser-only APIs (renderToDOM, loadMarkdown, autoInit) are excluded.
 */

export { parseDocument, parseBlocks } from "./core/block-parser.js";
export { parseInline } from "./core/inline-parser.js";
export { renderDocument } from "./renderer/html/renderer.js";
export type * from "./core/types.js";

import { parseDocument } from "./core/block-parser.js";
import { renderDocument } from "./renderer/html/renderer.js";

/**
 * Convenience function: Markdown string → HTML string.
 */
export function toHTML(markdown: string): string {
  return renderDocument(parseDocument(markdown));
}
