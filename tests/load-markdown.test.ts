// @vitest-environment happy-dom
// @vitest-environment-options {"url": "https://example.com/site/index.html"}
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { loadMarkdown } from "../src/index.js";

const files: Record<string, string> = {};
const fetchMock = vi.fn(async (url: string) => {
  const body = files[url];
  if (body === undefined) return new Response("missing", { status: 404, statusText: "Not Found" });
  return new Response(body, { status: 200 });
});

beforeEach(() => {
  vi.stubGlobal("fetch", fetchMock);
  document.body.innerHTML = "";
});

afterEach(() => {
  vi.unstubAllGlobals();
  fetchMock.mockClear();
  for (const url of Object.keys(files)) delete files[url];
});

function createContainer(): HTMLElement {
  const container = document.createElement("div");
  document.body.appendChild(container);
  return container;
}

describe("loadMarkdown", () => {
  it("fetches a file relative to the page and renders it into the container", async () => {
    files["https://example.com/site/content.md"] = "# Hello";
    const container = createContainer();

    await loadMarkdown("./content.md", container);

    expect(fetchMock).toHaveBeenCalledWith("https://example.com/site/content.md");
    expect(container.innerHTML).toBe('<h1 class="lbs-heading-1">Hello</h1>');
  });

  it("renders into document.body when no container is given", async () => {
    files["https://example.com/site/content.md"] = "text";

    await loadMarkdown("content.md");

    expect(document.body.innerHTML).toBe('<p class="lbs-paragraph">text</p>');
  });

  it("joins several files with a blank line and shares definitions across them", async () => {
    files["https://example.com/site/shared.md"] = "[home]: https://example.com\n\n:::warp note\nShared note\n:::";
    files["https://example.com/site/page.md"] = "Go [home].\n\n[~note]";
    const container = createContainer();

    await loadMarkdown(["shared.md", "page.md"], container);

    expect(container.innerHTML).toBe(
      '<p class="lbs-paragraph">Go <a href="https://example.com">home</a>.</p>\n<p class="lbs-paragraph">Shared note</p>'
    );
  });

  it("does not merge the last paragraph of one file with the first of the next", async () => {
    files["https://example.com/site/a.md"] = "end of a";
    files["https://example.com/site/b.md"] = "start of b";
    const container = createContainer();

    await loadMarkdown(["a.md", "b.md"], container);

    expect(container.innerHTML).toBe('<p class="lbs-paragraph">end of a</p>\n<p class="lbs-paragraph">start of b</p>');
  });

  it("resolves relative image paths against the first Markdown file", async () => {
    files["https://example.com/site/docs/page.md"] =
      "![a](images/a.png) ![b](/b.png) ![c](https://cdn.example.com/c.png) ![d](//cdn.example.com/d.png)";
    const container = createContainer();

    await loadMarkdown("docs/page.md", container);

    const sources = Array.from(container.querySelectorAll("img"), (image) => image.getAttribute("src"));
    expect(sources).toEqual([
      "https://example.com/site/docs/images/a.png",
      "https://example.com/b.png",
      "https://cdn.example.com/c.png",
      "//cdn.example.com/d.png",
    ]);
  });

  it("rejects with the status when a file cannot be fetched", async () => {
    const container = createContainer();
    container.innerHTML = "Loading...";

    await expect(loadMarkdown("missing.md", container)).rejects.toThrow("Failed to fetch missing.md: 404 Not Found");
    expect(container.innerHTML).toBe("Loading...");
  });
});
