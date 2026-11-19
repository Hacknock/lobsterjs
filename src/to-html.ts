import { parseDocument } from "./core/block-parser.js";
import { renderDocument } from "./renderer/html/renderer.js";

/**
 * Converts a Markdown string into an HTML string.
 */
export function toHTML(markdown: string): string {
  return renderDocument(parseDocument(markdown));
}
