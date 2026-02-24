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
 * Fetches one or more Markdown files, concatenates them, parses, and renders
 * into the container. Multiple files are fetched in parallel and joined with
 * a blank line before parsing, so warp/link/footnote definitions are shared
 * across all files.
 *
 * @param src - URL(s) or path(s) to Markdown file(s)
 * @param container - Target DOM element (defaults to document.body)
 */
export async function loadMarkdown(
  src: string | string[],
  container: HTMLElement = document.body
): Promise<void> {
  const srcs = Array.isArray(src) ? src : [src];
  const results = await Promise.all(
    srcs.map(async (s) => {
      const absoluteSrc = new URL(s, location.href).href;
      const response = await fetch(absoluteSrc);
      if (!response.ok) {
        throw new Error(`Failed to fetch ${s}: ${response.status} ${response.statusText}`);
      }
      return { text: await response.text(), base: absoluteSrc };
    })
  );
  const doc = parseDocument(results.map((r) => r.text).join("\n\n"));
  renderToDOM(doc, container);

  // Rebase relative image src attributes to the first markdown file's location.
  // Without this, the browser resolves relative paths against the HTML document
  // rather than the markdown file, causing images to not load.
  const baseUrl = results[0].base;
  container.querySelectorAll<HTMLImageElement>("img.lbs-image").forEach((img) => {
    const imgSrc = img.getAttribute("src");
    if (imgSrc && !/^(?:[a-z][a-z\d+\-.]*:|\/\/)/i.test(imgSrc)) {
      img.src = new URL(imgSrc, baseUrl).href;
    }
  });
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
