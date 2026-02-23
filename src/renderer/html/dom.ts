import type { Document } from "../../core/types.js";
import { parseDocument } from "../../core/block-parser.js";
import { renderDocument } from "./renderer.js";

/**
 * Renders a Document AST into the given DOM container element.
 * Replaces the container's innerHTML with the rendered HTML.
 */
export function renderToDOM(doc: Document, container: HTMLElement): void {
  container.innerHTML = renderDocument(doc);
}

/**
 * Fetches a Markdown file, parses it, and renders it into the container.
 * Requires the `parseDocument` function to be available at runtime.
 *
 * @param src - URL or path to the Markdown file
 * @param container - Target DOM element (defaults to document.body)
 */
export async function loadMarkdown(
  src: string,
  container: HTMLElement = document.body
): Promise<void> {
  const response = await fetch(src);
  if (!response.ok) {
    throw new Error(`Failed to fetch ${src}: ${response.status} ${response.statusText}`);
  }
  const markdown = await response.text();
  const doc = parseDocument(markdown);
  renderToDOM(doc, container);
}

/**
 * Auto-initializes lobster.js when used as a classic script tag.
 *
 * Usage in HTML:
 *   <script src="lobster.js" data-src="content.md"></script>
 *
 * The script tag's `data-src` attribute specifies the Markdown file to load.
 * The rendered content replaces `document.body`.
 */
export function autoInit(): void {
  if (typeof document === "undefined") return;

  const scripts = document.querySelectorAll<HTMLScriptElement>(
    'script[src*="lobster"]'
  );

  let src: string | null = null;
  scripts.forEach((s) => {
    if (s.dataset.src) src = s.dataset.src;
  });

  if (src) {
    document.addEventListener("DOMContentLoaded", () => {
      loadMarkdown(src!).catch(console.error);
    });
  }
}
