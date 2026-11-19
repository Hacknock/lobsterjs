import { toHTML } from "../../to-html.js";

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
  container.innerHTML = toHTML(results.map((r) => r.text).join("\n\n"));

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
