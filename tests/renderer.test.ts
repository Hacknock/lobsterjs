import { describe, it, expect } from "vitest";
import { toHTML } from "../src/index.js";

describe("toHTML — headings", () => {
  it("renders H1 with lbs-heading-1 class", () => {
    const html = toHTML("# Hello");
    expect(html).toContain('class="lbs-heading-1"');
    expect(html).toContain("Hello");
  });

  it("renders H3", () => {
    const html = toHTML("### Section");
    expect(html).toContain('class="lbs-heading-3"');
  });
});

describe("toHTML — paragraph", () => {
  it("wraps text in <p>", () => {
    const html = toHTML("Hello world");
    expect(html).toContain("<p");
    expect(html).toContain("Hello world");
  });

  it("HTML-escapes special characters", () => {
    const html = toHTML("5 < 10 & 10 > 5");
    expect(html).toContain("&lt;");
    expect(html).toContain("&gt;");
    expect(html).toContain("&amp;");
  });
});

describe("toHTML — inline decorations", () => {
  it("**bold** renders with lbs-strong", () => {
    const html = toHTML("**bold text**");
    expect(html).toContain('class="lbs-strong"');
    expect(html).toContain("bold text");
  });

  it("*italic* renders with lbs-emphasis", () => {
    const html = toHTML("*italic text*");
    expect(html).toContain('class="lbs-emphasis"');
  });

  it("~~strike~~ renders with lbs-strikethrough", () => {
    const html = toHTML("~~strikethrough~~");
    expect(html).toContain('class="lbs-strikethrough"');
  });

  it("`code` renders <code>", () => {
    const html = toHTML("`inline code`");
    expect(html).toContain("<code");
    expect(html).toContain("inline code");
  });
});

describe("toHTML — horizontal rule", () => {
  it("--- renders <hr>", () => {
    const html = toHTML("---");
    expect(html).toContain("<hr");
  });
});

describe("toHTML — code block", () => {
  it("renders <pre><code>", () => {
    const html = toHTML("```\nconst x = 1;\n```");
    expect(html).toContain("<pre");
    expect(html).toContain("<code>");
    expect(html).toContain("const x = 1;");
  });

  it("includes language as data attribute", () => {
    const html = toHTML("```typescript\nlet x: number;\n```");
    expect(html).toContain('data-language="typescript"');
  });

  it("includes filename in header div", () => {
    const html = toHTML("```ts:index.ts\nlet x;\n```");
    expect(html).toContain("index.ts");
    expect(html).toContain("lbs-code-filename");
  });

  it("escapes HTML in code blocks", () => {
    const html = toHTML("```\n<script>alert('xss')</script>\n```");
    expect(html).not.toContain("<script>");
    expect(html).toContain("&lt;script&gt;");
  });
});

describe("toHTML — blockquote", () => {
  it("renders <blockquote>", () => {
    const html = toHTML("> A quote");
    expect(html).toContain("<blockquote");
  });
});

describe("toHTML — lists", () => {
  it("bullet list renders <ul>", () => {
    const html = toHTML("- Item 1\n- Item 2");
    expect(html).toContain("<ul");
    expect(html).toContain("<li");
    expect(html).toContain("Item 1");
    expect(html).toContain("Item 2");
  });

  it("ordered list renders <ol>", () => {
    const html = toHTML("1. First\n2. Second");
    expect(html).toContain("<ol");
    expect(html).toContain("First");
    expect(html).toContain("Second");
  });

  it("checklist renders checkboxes", () => {
    const html = toHTML("- [ ] Todo\n- [x] Done");
    expect(html).toContain('type="checkbox"');
    expect(html).toContain("checked");
  });
});

describe("toHTML — links", () => {
  it("inline link [text](url)", () => {
    const html = toHTML("[Click](https://example.com)");
    expect(html).toContain('<a href="https://example.com"');
    expect(html).toContain("Click");
  });

  it('link with title [text](url "title")', () => {
    const html = toHTML('[Go](https://example.com "My Site")');
    expect(html).toContain('title="My Site"');
  });

  it("reference link [text][id]", () => {
    const md = "[example]: https://example.com\n\n[Click][example]";
    const html = toHTML(md);
    expect(html).toContain('<a href="https://example.com"');
    expect(html).toContain("Click");
  });
});

describe("toHTML — images", () => {
  it("![alt](url)", () => {
    const html = toHTML("![Logo](logo.png)");
    expect(html).toContain('<img');
    expect(html).toContain('src="logo.png"');
    expect(html).toContain('alt="Logo"');
  });

  it("image with size =WxH", () => {
    const html = toHTML("![img](photo.jpg =800x600)");
    expect(html).toContain('width="800"');
    expect(html).toContain('height="600"');
  });
});

describe("toHTML — table", () => {
  it("renders table with thead and tbody", () => {
    const md = "| Name | Age |\n| ---- | --- |\n| Alice | 30 |";
    const html = toHTML(md);
    expect(html).toContain("<table");
    expect(html).toContain("<thead");
    expect(html).toContain("<tbody");
    expect(html).toContain("<th");
    expect(html).toContain("<td");
    expect(html).toContain("Alice");
  });

  it("silent table has lbs-table-silent class", () => {
    const md = "~ | A | B |\n~ | -- | -- |\n~ | 1 | 2 |";
    const html = toHTML(md);
    expect(html).toContain("lbs-table-silent");
  });

  it("alignment sets text-align style", () => {
    const md = "| A | B |\n| :--- | ---: |\n| left | right |";
    const html = toHTML(md);
    expect(html).toContain("text-align:left");
    expect(html).toContain("text-align:right");
  });
});

describe("toHTML — custom blocks", () => {
  it(":::header renders <header>", () => {
    const md = ":::header\nSite Name\n:::";
    const html = toHTML(md);
    expect(html).toContain("<header");
    expect(html).toContain("Site Name");
  });

  it(":::footer renders <footer>", () => {
    const md = ":::footer\n© 2025\n:::";
    const html = toHTML(md);
    expect(html).toContain("<footer");
    expect(html).toContain("© 2025");
  });

  it(":::details renders <details> with <summary>", () => {
    const md = ":::details Click to expand\nHidden content\n:::";
    const html = toHTML(md);
    expect(html).toContain("<details");
    expect(html).toContain("<summary");
    expect(html).toContain("Click to expand");
    expect(html).toContain("Hidden content");
  });
});

describe("toHTML — footnotes", () => {
  it("[^id] renders as superscript link", () => {
    const md = "See[^note]\n\n[^note]: Footnote text";
    const html = toHTML(md);
    expect(html).toContain("<sup");
    expect(html).toContain("[1]");
  });

  it("footnote definitions rendered at bottom", () => {
    const md = "Hello[^a]\n\n[^a]: Note content";
    const html = toHTML(md);
    expect(html).toContain("lbs-footnotes");
    expect(html).toContain("Note content");
  });
});
