/**
 * lobster.js — Extended Markdown parser for rich web pages.
 *
 *   loadMarkdown(src, element) → Promise<void>  (browser; src: string | string[])
 *   toHTML(markdown)           → HTML string
 */

export { loadMarkdown } from "./renderer/html/dom.js";
export { toHTML } from "./to-html.js";
