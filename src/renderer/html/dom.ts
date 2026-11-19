import { toHTML } from "../../to-html.js";

/**
 * Fetches one or more Markdown files, concatenates them, parses, and renders
 * into the container. Multiple files are fetched in parallel and joined with
 * a blank line before parsing, so warp/link/footnote definitions are shared
 * across all files.
 *
 * @param src - URL(source) or path(source) to Markdown file(source)
 * @param container - Target DOM element (defaults to document.body)
 */
export async function loadMarkdown(
  src: string | string[],
  container: HTMLElement = document.body
): Promise<void> {
  const sources = Array.isArray(src) ? src : [src];
  const results = await Promise.all(
    sources.map(async (source) => {
      const absoluteUrl = new URL(source, location.href).href;
      const response = await fetch(absoluteUrl);
      if (!response.ok) {
        throw new Error(`Failed to fetch ${source}: ${response.status} ${response.statusText}`);
      }
      return { text: await response.text(), base: absoluteUrl };
    })
  );
  container.innerHTML = toHTML(results.map((result) => result.text).join("\n\n"));

  // Rebase relative image src attributes to the first markdown file's location.
  // Without this, the browser resolves relative paths against the HTML document
  // rather than the markdown file, causing images to not load.
  const baseUrl = results[0].base;
  container.querySelectorAll<HTMLImageElement>("img.lbs-image").forEach((image) => {
    const imageSource = image.getAttribute("src");
    if (imageSource && !/^(?:[a-z][a-z\d+\-.]*:|\/\/)/i.test(imageSource)) {
      image.src = new URL(imageSource, baseUrl).href;
    }
  });
}
